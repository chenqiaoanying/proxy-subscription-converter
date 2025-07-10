import express from 'express';
import axios from "axios";
import {z} from "zod/v4";
import {DataUsage, Proxy, ProxySchema, SubscriptionSchema, SubscriptionCreateOrUpdateSchema, DataUsageSchema, SubscriptionCreateOrUpdate} from "@psc/common";
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
    }

    private getByIdQuerySchema = z.object({
        id: z.coerce.number(),
        refresh: z.coerce.boolean().default(false),
    })

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

    private save = async (id: number | undefined, subscription: SubscriptionCreateOrUpdate) => {
        const [dataUsage, proxies] = await loadProxyFromUrl(subscription.url, subscription.userAgent);
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
                        raw: JSON.stringify(proxy),
                    }))
                },
            }
        }

        let savedSubscription;
        if (id) {
            await this.prisma.proxy.deleteMany({
                where: {subscriptionId: id},
            })
            savedSubscription = await this.prisma.subscription.update({
                where: {id},
                data: upsertInput,
                include: {proxies: true},
            })
        } else {
            savedSubscription = await this.prisma.subscription.create({
                data: upsertInput,
                include: {proxies: true},
            })
        }
        return savedSubscription;
    }

    createSubscription = async (req: express.Request, res: express.Response) => {
        const subscriptionCreate = SubscriptionCreateOrUpdateSchema.parse(req.body);

        const saveSubscriptionEntity = await this.save(undefined, subscriptionCreate);

        // this.fileService.saveSubscription(subscription);
        res.json(this.toContract(saveSubscriptionEntity));
    }

    updateSubscription = async (req: express.Request, res: express.Response) => {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) throw new KnownError(`Invalid id:${id}`);
        const subscriptionUpdate = SubscriptionCreateOrUpdateSchema.parse(req.body);

        const saveSubscriptionEntity = await this.save(undefined, subscriptionUpdate);

        // this.fileService.saveSubscription(subscription);
        res.json(this.toContract(saveSubscriptionEntity));
    }

    getSubscription = async (req: express.Request, res: express.Response) => {
        const {id, refresh} = this.getByIdQuerySchema.parse(req.params);
        let subscriptionEntity = await this.prisma.subscription.findUnique({
            where: {id: Number(id)},
            include: {proxies: true},
        });
        if (!subscriptionEntity) throw new KnownError('订阅不存在');
        if (refresh) {
            subscriptionEntity = await this.save(id, {name: subscriptionEntity.name, url: subscriptionEntity.url, userAgent: subscriptionEntity.userAgent ?? undefined});
        }
        let subscription = this.toContract(subscriptionEntity);
        res.json({subscription});
    }

    listSubscription = async (_req: express.Request, res: express.Response) => {
        // const subscriptionList = this.fileService.listSubscription()
        const dbSubscriptions = await this.prisma.subscription.findMany({include: {proxies: true}});
        const subscriptionList = dbSubscriptions.map((subscription) => this.toContract(subscription));
        res.json(subscriptionList);
    }

    deleteSubscription = async (req: express.Request, res: express.Response) => {
        const {id} = req.params;
        await this.prisma.subscription.delete({where: {id: Number(id)}});
        res.status(204).end();
    }
}

export default SubscriptionController;