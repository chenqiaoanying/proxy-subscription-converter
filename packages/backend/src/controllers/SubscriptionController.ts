import express from 'express';
import axios from "axios";
import {ProxySchema, SubscriptionSchema, SubscriptionInfoSchema} from "@psc/common";
import {KnownError} from '../errors/KnownError.js';
import {injectable} from "tsyringe";
import FileService from "../services/FileService.js";

const loadProxyFromUrl = async (url: string, userAgent: string) =>
    axios.get(url, {responseType: 'json', headers: {'User-Agent': userAgent}})
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
// parse header Subscription-Userinfo like 'upload=61903278937; download=1348494238989; total=5801856991232; expire=1763742604'
            let subscriptionInfo;
            if (response.headers['Subscription-Userinfo']) {
                const rawSubscriptionInfo = (response.headers['Subscription-Userinfo'] as string)
                    .split(';')
                    .reduce((acc, item) => {
                        const [key, value] = item.trim().split('=');
                        acc[key] = value;
                        return acc;
                    }, {} as Record<string, string>);
                subscriptionInfo = SubscriptionInfoSchema.parse({
                    total: rawSubscriptionInfo.total,
                    upload: rawSubscriptionInfo.upload,
                    download: rawSubscriptionInfo.download,
                    expiredAt: typeof rawSubscriptionInfo.expire != undefined && isNaN(parseInt(rawSubscriptionInfo.expire)) ? new Date(parseInt(rawSubscriptionInfo.expire) * 1000) : rawSubscriptionInfo.expire,
                });
            }

            return SubscriptionSchema.parse({
                name: data.name,
                userAgent: userAgent,
                dataUsage: subscriptionInfo,
                proxies: (data.outbounds as any[]).map(outbound => ProxySchema.parse(outbound)),
                url,
            })
        });

@injectable()
class SubscriptionController {
    constructor(private fileService: FileService) {
    }

    async loadAndSaveProxy(req: express.Request, res: express.Response) {
        const {name, url, userAgent} = req.query;

        if (typeof name !== 'string' || name.length === 0) {
            throw new KnownError('请提供有效的名称');
        }

        if (typeof url !== 'string') {
            throw new KnownError('请提供有效的 URL');
        }
        if (typeof userAgent != undefined || typeof userAgent !== 'string') {
            throw new KnownError('请提供有效的 User-Agent');
        }
        const result = await loadProxyFromUrl(url, userAgent || 'proxy-subscribe-converter');
        this.fileService.saveSubscription(result);
        res.json(result);
    };

    async listSubscription(_req: express.Request, res: express.Response) {
        const subscriptionList = this.fileService.listSubscription()
        res.json(subscriptionList);
    }
}

export default SubscriptionController;