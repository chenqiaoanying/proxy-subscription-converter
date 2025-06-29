import express from 'express';
import axios from "axios";
import {z} from "zod";
import {DataUsage, Proxy, ProxySchema, SubscriptionSchema, DataUsageSchema} from "@psc/common";
import {KnownError} from '../errors/KnownError.js';
import {singleton} from "tsyringe";
import FileService from "../services/FileService.js";

const loadProxyFromUrl = async (url: string, userAgent: string | undefined): Promise<[DataUsage | undefined, Proxy[]]> =>
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
    constructor(private fileService: FileService) {
        this.loadAndSaveProxy = this.loadAndSaveProxy.bind(this);
        this.listSubscription = this.listSubscription.bind(this);
    }

    private readonly loadAndSaveProxyQuerySchema = z.object({
        name: z.string({message: '无效的名称'}).nonempty("名称不能为空"),
        url: z.string({message: "无效的URL"}).url({message: "无效的URL"}),
        userAgent: z.string({message: "'无效的User-Agent'"}).optional(),
    });

    async loadAndSaveProxy(req: express.Request, res: express.Response) {
        let {name, url, userAgent} = this.loadAndSaveProxyQuerySchema.parse(req.query);
        const [dataUsage, proxies] = await loadProxyFromUrl(url, userAgent);
        const subscription = SubscriptionSchema.parse({
            name,
            userAgent,
            dataUsage,
            proxies,
            url,
        });
        this.fileService.saveSubscription(subscription);
        res.json(subscription);
    };

    async listSubscription(_req: express.Request, res: express.Response) {
        const subscriptionList = this.fileService.listSubscription()
        res.json(subscriptionList);
    }
}

export default SubscriptionController;