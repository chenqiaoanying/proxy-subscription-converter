import axios from "axios";
import {
    DataUsage,
    Proxy,
    ProxySchema,
    SubscriptionSchema,
    DataUsageSchema,
    SubscriptionCreateOrUpdate
} from "@psc/common";
import { KnownError } from '../errors/KnownError.js';
import { singleton } from "tsyringe";
import { PrismaClient, Prisma } from "@psc/database";
import SubscriptionUpdateInput = Prisma.SubscriptionUpdateInput;
import SubscriptionCreateInput = Prisma.SubscriptionCreateInput;

@singleton()
export default class SubscriptionService {
    constructor(
        private readonly prisma: PrismaClient,
    ) {
    }

    private toContract(subscription: Prisma.SubscriptionGetPayload<{ include: { proxies: true } }>) {
        return SubscriptionSchema.parse({
            id: subscription.id,
            name: subscription.name,
            userAgent: subscription.userAgent,
            dataUsage: subscription.dataTotal && subscription.dataUpload && subscription.dataDownload && subscription.expireAt ? {
                total: subscription.dataTotal,
                upload: subscription.dataUpload,
                download: subscription.dataDownload,
                expiredAt: new Date(Number(subscription.expireAt.toString())),
            } : undefined,
            proxies: subscription.proxies.map(p => ProxySchema.parse({ ...p, ...(p.raw as any), raw: undefined })),
            url: subscription.url,
        });
    }

    loadProxyFromUrl = async (url: string, userAgent: string | undefined | null): Promise<[DataUsage | undefined, Proxy[]]> =>
        axios.get(url, { responseType: 'json', headers: { 'User-Agent': userAgent ?? 'proxy-subscribe-converter' } })
            .catch(error => {
                throw new KnownError('获取代理列表失败', error);
            })
            .then(response => {
                let data = response.data;
                try {
                    data = typeof data === 'string' ? JSON.parse(data) : data;
                } catch (error) {
                    throw new KnownError('解析响应失败，请检查数据格式', error);
                }
                if (!Array.isArray(data.outbounds))
                    throw new KnownError('响应中不存在代理信息');
                const proxyList = (data.outbounds as any[]).map(outbound => ProxySchema.parse(outbound))
                    .filter(proxy => "server" in proxy);
                if (proxyList.length === 0)
                    throw new KnownError('响应中不存在代理信息');
                // parse header Subscription-Userinfo like 'upload=61903278937; download=1348494238989; total=5801856991232; expire=1763742604'
                let dataUsage;
                if (response.headers['Subscription-Userinfo']) {
                    const rawDataUsage = (response.headers['Subscription-Userinfo'] as string)
                        .split(';')
                        .reduce((acc, item) => {
                            const [key, value] = item.trim().split('=');
                            acc[key] = value;
                            return acc;
                        }, {} as Record<string, string>);
                    dataUsage = DataUsageSchema.parse({
                        total: rawDataUsage.total,
                        upload: rawDataUsage.upload,
                        download: rawDataUsage.download,
                        expiredAt: typeof rawDataUsage.expire != undefined && isNaN(parseInt(rawDataUsage.expire)) ? new Date(parseInt(rawDataUsage.expire) * 1000) : rawDataUsage.expire,
                    });
                }

                return [dataUsage, proxyList];

                /*return SubscriptionSchema.parse({
                    name: name,
                    userAgent: userAgent,
                    dataUsage: subscriptionInfo,
                    proxies: (data.outbounds as any[]).map(outbound => ProxySchema.parse(outbound)),
                    url,
                })*/
            });

    private save = async (id: number | undefined, subscription: SubscriptionCreateOrUpdate) => {
        const [dataUsage, proxies] = await this.loadProxyFromUrl(subscription.url, subscription.userAgent);
        const upsertInput: SubscriptionUpdateInput & SubscriptionCreateInput = {
            name: subscription.name,
            userAgent: subscription.userAgent,
            url: subscription.url,
            dataUpload: dataUsage?.upload,
            dataDownload: dataUsage?.download,
            dataTotal: dataUsage?.total,
            expireAt: dataUsage?.expiredAt?.getTime(),
            proxies: {
                createMany: {
                    data: proxies.map(proxy => ({
                        tag: proxy.tag,
                        type: proxy.type,
                        raw: proxy,
                    }))
                },
            }
        }

        let savedSubscription;
        if (id) {
            await this.prisma.proxy.deleteMany({
                where: { subscriptionId: id },
            })
            savedSubscription = await this.prisma.subscription.update({
                where: { id },
                data: upsertInput,
                include: { proxies: true },
            })
        } else {
            savedSubscription = await this.prisma.subscription.create({
                data: upsertInput,
                include: { proxies: true },
            })
        }
        return savedSubscription;
    }

    createSubscription = async (subscriptionCreate: SubscriptionCreateOrUpdate) => {
        const saveSubscriptionEntity = await this.save(undefined, subscriptionCreate);
        // this.fileService.saveSubscription(subscription);
        return this.toContract(saveSubscriptionEntity);
    }

    updateSubscription = async (id: number, subscriptionUpdate: SubscriptionCreateOrUpdate) => {
        const saveSubscriptionEntity = await this.save(id, subscriptionUpdate);
        return this.toContract(saveSubscriptionEntity);
    }

    getSubscription = async (id: number, refresh: boolean) => {
        let subscriptionEntity = await this.prisma.subscription.findUnique({
            where: { id: Number(id) },
            include: { proxies: true },
        });
        if (!subscriptionEntity) throw new KnownError('订阅不存在');
        if (refresh) {
            subscriptionEntity = await this.save(id, {
                name: subscriptionEntity.name,
                url: subscriptionEntity.url,
                userAgent: subscriptionEntity.userAgent ?? undefined
            });
        }
        return this.toContract(subscriptionEntity);
    }

    listSubscription = async (refresh = false) => {
        // const subscriptionList = this.fileService.listSubscription()
        const subscriptionEntities = await this.prisma.subscription.findMany({ include: { proxies: true } });
        if (refresh) {

        }
        return subscriptionEntities.map((subscription) => this.toContract(subscription));
    }

    listSubscriptionsById = async (ids: number[]) => {
        // const subscriptionList = this.fileService.listSubscription()
        const subscriptionEntities = await this.prisma.subscription.findMany({
            where: {
                id: {
                    in: ids
                }
            },
            include: {
                proxies: true
            }
        });
        return subscriptionEntities.map((subscription) => this.toContract(subscription));
    }

    deleteSubscription = async (id: number) => {
        return this.prisma.subscription.delete({ where: { id } });
    }
}
