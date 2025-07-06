import express from 'express';
import axios from "axios";
import {z} from "zod";
import {DataUsage, Proxy, ProxySchema, SubscriptionSchema, SubscriptionCreateSchema, DataUsageSchema, Subscription, SubscriptionCreate} from "@psc/common";
import {KnownError} from '../errors/KnownError.js';
import {singleton} from "tsyringe";
import {PrismaClient, Prisma} from "@psc/database";
import SubscriptionUpdateInput = Prisma.SubscriptionUpdateInput;
import SubscriptionCreateInput = Prisma.SubscriptionCreateInput;

const loadProxyFromUrl = async (url: string, userAgent: string | undefined | null): Promise<[DataUsage | undefined, Proxy[]]> =>
    axios.get(url, {responseType: 'json', headers: {'User-Agent': userAgent ?? 'proxy-subscribe-converter'}})
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
            const blackList = ["selector", "urltest", "direct", "dns", "block"];
            const proxyList = (data.outbounds as any[]).map(outbound => ProxySchema.parse(outbound))
                .filter(proxy => !blackList.includes(proxy.type));
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

@singleton()
class SubscriptionController {
    constructor(
        // private readonly fileService: FileService,
        private readonly prisma: PrismaClient,
    ) {
        this.load = this.load.bind(this);
        this.listSubscription = this.listSubscription.bind(this);
    }

    private readonly loadAndSaveProxyQuerySchema = z.object({
        name: z.string({message: '无效的名称'}).nonempty("名称不能为空"),
        url: z.string({message: "无效的URL"}).url({message: "无效的URL"}),
        userAgent: z.string({message: "'无效的User-Agent'"}).optional(),
    });

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
            proxies: subscription.proxies,
            url: subscription.url,
        });
    }

    private save = async (subscription: Subscription | SubscriptionCreate) => {
        const upsertInput: SubscriptionUpdateInput & SubscriptionCreateInput = {
            name: subscription.name,
            userAgent: subscription.userAgent,
            url: subscription.url,
            dataUpload: subscription.dataUsage?.upload,
            dataDownload: subscription.dataUsage?.download,
            dataTotal: subscription.dataUsage?.total,
            expireAt: subscription.dataUsage?.expiredAt?.getTime(),
            proxies: {
                createMany: {
                    data: subscription.proxies.map(proxy => ({
                        tag: proxy.tag,
                        type: proxy.type,
                        raw: JSON.stringify(proxy),
                    }))
                },
            }
        }

        let savedSubscription;
        if ("id" in subscription) {
            await this.prisma.proxy.deleteMany({
                where: {subscriptionId: subscription.id},
            })
            savedSubscription = await this.prisma.subscription.update({
                where: {id: subscription.id},
                data: upsertInput
            })
        } else {
            savedSubscription = await this.prisma.subscription.create({
                data: upsertInput
            })
        }
        return savedSubscription;
    }

    async load(req: express.Request, res: express.Response) {
        const {name, url, userAgent} = this.loadAndSaveProxyQuerySchema.parse(req.query);
        const [dataUsage, proxies] = await loadProxyFromUrl(url, userAgent);
        const subscription = SubscriptionCreateSchema.parse({
            name,
            userAgent,
            dataUsage,
            proxies,
            url,
        });

        const saveSubscriptionEntity = await this.save(subscription);

        // this.fileService.saveSubscription(subscription);
        res.json({id: saveSubscriptionEntity.id, ...subscription});
    }

    async loadById(req: express.Request, res: express.Response) {
        const {id} = req.params;
        let subscriptionEntity = await this.prisma.subscription.findUnique({
            where: {id: Number(id)},
            include: {proxies: true},
        });
        if (!subscriptionEntity)
            throw new KnownError('订阅不存在');
        let subscription = this.toContract(subscriptionEntity);
        const [dataUsage, proxies] = await loadProxyFromUrl(subscriptionEntity.url, subscriptionEntity.userAgent);
        subscription = {
            ...subscription,
            dataUsage,
            proxies,
        };

        await this.save(subscription);
        res.json({subscription});
    }

    async listSubscription(_req: express.Request, res: express.Response) {
        // const subscriptionList = this.fileService.listSubscription()
        const dbSubscriptions = await this.prisma.subscription.findMany({include: {proxies: true}});
        const subscriptionList = dbSubscriptions.map((subscription) => this.toContract(subscription));
        res.json(subscriptionList);
    }
}

export default SubscriptionController;