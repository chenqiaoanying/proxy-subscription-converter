import {PrismaClient, Prisma} from '@psc/database';
import {singleton} from "tsyringe";
import * as common from "@psc/common";
import type {GeneratorCreateOrUpdate, Subscription} from "@psc/common";
import GeneratorCreateInput = Prisma.GeneratorCreateInput;
import GeneratorUpdateInput = Prisma.GeneratorUpdateInput;
import GeneratorGetPayload = Prisma.GeneratorGetPayload;
import {KnownError} from "../errors/KnownError.js";
import axios from "axios";
import FilterService from "./FilterService.js";
import SubscriptionService from "./SubscriptionService.js";

@singleton()
export default class GeneratorService {
    constructor(
        private readonly prisma: PrismaClient,
        private readonly filterService: FilterService,
        private readonly subscriptionService: SubscriptionService,
    ) {
    }

    private toContract(generatorEntity: GeneratorGetPayload<{ include: { filters: true } }>) {
        return common.GeneratorSchema.parse({
            id: generatorEntity.id,
            name: generatorEntity.name,
            type: generatorEntity.type,
            content: generatorEntity.content,
            url: generatorEntity.url,
            filterIds: generatorEntity.filters.map((filter) => filter.filterId),
        });
    }

    private save = async (id: number | undefined, generator: GeneratorCreateOrUpdate) => {
        const upsertInput: GeneratorCreateInput & GeneratorUpdateInput = {
            name: generator.name,
            type: generator.type,
            content: generator.type === "json" ? JSON.stringify(generator.content) : undefined,
            url: generator.type === "url" ? generator.url : undefined,
            filters: {
                createMany: {
                    data: generator.filterIds?.map(filterId => ({
                        filterId
                    })) ?? []
                }
            }
        };
        if (id) {
            await this.prisma.generatorOnFilter.deleteMany({
                where: {generatorId: id},
            })
            return this.prisma.generator.update({
                where: {id},
                data: upsertInput,
                include: {filters: true}
            });
        } else {
            return this.prisma.generator.create({
                data: upsertInput,
                include: {filters: true}
            });
        }
    }

    // 创建 Generator
    createGenerator = async (generatorCreate: GeneratorCreateOrUpdate) => {
        const savedRequestGeneratorEntity = await this.save(undefined, generatorCreate);
        return {id: savedRequestGeneratorEntity.id, ...generatorCreate};
    }

    // 更新 Generator
    updateGenerator = async (id: number, generatorCreate: GeneratorCreateOrUpdate) => {
        const savedEntities = await this.save(id, generatorCreate);
        return this.toContract(savedEntities);
    }

    // 获取所有 Generator
    getAllGenerators = async () => {
        const generatorEntities = await this.prisma.generator.findMany({include: {filters: true}});
        return generatorEntities.map((generator) => this.toContract(generator));
    }

    // 根据 ID 获取单个 Generator
    getGeneratorById = async (id: number) => {
        const generator = await this.prisma.generator.findUnique({
            where: {id: Number(id)},
            include: {filters: true}
        });

        if (!generator) {
            return null;
        }

        return this.toContract(generator);
    }

    // 删除 Generator
    deleteGenerator = async (id: number) => {
        await this.prisma.generator.delete({
            where: {id: Number(id)}
        });

        return id;
    }

    generate = async (id: number, refresh = false) => {
        const generator = await this.getGeneratorById(id)
        if (!generator) throw new KnownError('Generator not found');
        let content: any;
        switch (generator.type) {
            case "json":
                content = generator.content;
                break;
            case "url":
                content = await axios.get(generator.url, {responseType: "json"}).then((res) => res.data);
                break;
        }
        if (!content) throw new KnownError('Fail to load generator content');

        const filters = await this.filterService.listFiltersById(generator.filterIds);
        const allSubscriptions = await this.subscriptionService.listSubscription();
        const needsAllSubscriptions = !!filters.find(filter => filter.subscriptionIds == undefined || filter.subscriptionIds.length === 0);
        const involvedIds = needsAllSubscriptions
            ? allSubscriptions.map(s => s.id)
            : [...new Set(filters.flatMap(filter => filter.subscriptionIds ?? []))];

        if (refresh) {
            await Promise.all(involvedIds.map(sid => this.subscriptionService.getSubscription(sid, true)));
        }

        let subscriptions: Subscription[] = [];
        if (needsAllSubscriptions) subscriptions = refresh ? await this.subscriptionService.listSubscription() : allSubscriptions;
        else subscriptions = await this.subscriptionService.listSubscriptionsById(involvedIds);
        const subscriptionsById = subscriptions.reduce((acc, subscription) => {
            acc[subscription.id] = subscription;
            return acc;
        }, {} as Record<number, Subscription>);

        const proxyMap = new Map<string, any>();
        const filterGroups = filters.map(filter => {
            const {tag, subscriptionIds, proxyTypeFilterMode, proxyTypes, includePattern, excludePattern} = filter;
            const parsedIncludeRegex = includePattern && includePattern.length > 0 ? new RegExp(includePattern) : null;
            const parsedExcludeRegex = excludePattern && excludePattern.length > 0 ? new RegExp(excludePattern) : null;
            const selectedSubscriptions = subscriptionIds == null || subscriptionIds.length == 0 ? subscriptions : subscriptionIds.map(id => subscriptionsById[id]);
            const selectedProxies = selectedSubscriptions.flatMap(subscription =>
                subscription.proxies.filter(proxy => {
                    if (proxyTypes.length > 0 && proxyTypeFilterMode === "include" && !proxyTypes.includes(proxy.type)) return false;
                    if (proxyTypes.length > 0 && proxyTypeFilterMode === "exclude" && proxyTypes.includes(proxy.type)) return false;
                    if (parsedIncludeRegex && !parsedIncludeRegex.test(proxy.tag)) return false;
                    return !(parsedExcludeRegex && parsedExcludeRegex.test(proxy.tag));
                })
            );
            for (const proxy of selectedProxies) proxyMap.set(proxy.tag, proxy);
            return {tag, type: filter.type, outbounds: selectedProxies.map(p => p.tag)};
        });
        const outbounds = [...filterGroups, ...proxyMap.values(), ...(content.outbounds ?? [])];
        return {...content, outbounds};

    }
}
