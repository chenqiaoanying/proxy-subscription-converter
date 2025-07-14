import {PrismaClient, Prisma} from '@psc/database';
import {singleton} from "tsyringe";
import * as common from "@psc/common";
import type {SubscriptionGeneratorCreateOrUpdate, Subscription} from "@psc/common";
import SubscriptionGeneratorCreateInput = Prisma.SubscriptionGeneratorCreateInput;
import SubscriptionGeneratorUpdateInput = Prisma.SubscriptionGeneratorUpdateInput;
import SubscriptionGeneratorGetPayload = Prisma.SubscriptionGeneratorGetPayload;
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

    private toContract(generatorEntity: SubscriptionGeneratorGetPayload<{ include: { filters: true } }>) {
        return common.SubscriptionGeneratorSchema.parse({
            id: generatorEntity.id,
            name: generatorEntity.name,
            type: generatorEntity.type,
            content: generatorEntity.content,
            url: generatorEntity.url,
            filterIds: generatorEntity.filters.map((filter) => filter.filterId),
        });
    }

    private save = async (id: number | undefined, generator: SubscriptionGeneratorCreateOrUpdate) => {
        const upsertInput: SubscriptionGeneratorCreateInput & SubscriptionGeneratorUpdateInput = {
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
            return this.prisma.subscriptionGenerator.update({
                where: {id},
                data: upsertInput,
                include: {filters: true}
            });
        } else {
            return this.prisma.subscriptionGenerator.create({
                data: upsertInput,
                include: {filters: true}
            });
        }
    }

    // 创建 SubscriptionGenerator
    createSubscriptionGenerator = async (generatorCreate: SubscriptionGeneratorCreateOrUpdate) => {
        const savedRequestGeneratorEntity = await this.save(undefined, generatorCreate);
        return {id: savedRequestGeneratorEntity.id, ...generatorCreate};
    }

    // 更新 SubscriptionGenerator
    updateSubscriptionGenerator = async (id: number, generatorCreate: SubscriptionGeneratorCreateOrUpdate) => {
        const savedEntities = await this.save(id, generatorCreate);
        return this.toContract(savedEntities);
    }

    // 获取所有 SubscriptionGenerator
    getAllSubscriptionGenerators = async () => {
        const generatorEntities = await this.prisma.subscriptionGenerator.findMany({include: {filters: true}});
        return generatorEntities.map((generator) => this.toContract(generator));
    }

    // 根据 ID 获取单个 SubscriptionGenerator
    getSubscriptionGeneratorById = async (id: number) => {
        const generator = await this.prisma.subscriptionGenerator.findUnique({
            where: {id: Number(id)},
            include: {filters: true}
        });

        if (!generator) {
            return null;
        }

        return this.toContract(generator);
    }

    // 删除 SubscriptionGenerator
    deleteSubscriptionGenerator = async (id: number) => {
        await this.prisma.subscriptionGenerator.delete({
            where: {id: Number(id)}
        });

        return id;
    }

    generate = async (id: number) => {
        const generator = await this.getSubscriptionGeneratorById(id)
        if (!generator) throw new KnownError('SubscriptionGenerator not found');
        let content: any;
        switch (generator.type) {
            case "json":
                content = generator.content;
                break;
            case "url":
                content = await axios.get(generator.url, {responseType: "json"}).then((res) => res.data);
                break;
        }
        if (!content) throw new KnownError('Fail to load subscriptionGenerator content');

        const filters = await this.filterService.listFiltersById(generator.filterIds);
        let subscriptions: Subscription[] = [];
        if (filters.find(filter => filter.subscriptionIds == undefined || filter.subscriptionIds.length === 0)) subscriptions = await this.subscriptionService.listSubscription();
        else subscriptions = await this.subscriptionService.listSubscriptionsById(filters.flatMap(filter => filter.subscriptionIds ?? []));
        const subscriptionsById = subscriptions.reduce((acc, subscription) => {
            acc[subscription.id] = subscription;
            return acc;
        }, {} as Record<number, Subscription>);

        const outbounds = filters.map(filter => {
            const {tag, subscriptionIds, proxyTypeFilterMode, proxyTypes, includePattern, excludePattern} = filter;
            const parsedIncludeRegex = includePattern && includePattern.length > 0 ? new RegExp(includePattern) : null;
            const parsedExcludeRegex = excludePattern && excludePattern.length > 0 ? new RegExp(excludePattern) : null;
            const selectedSubscriptions = subscriptionIds?.map(id => subscriptionsById[id]) ?? subscriptions;
            const selectedProxies = selectedSubscriptions.flatMap(subscription =>
                subscription.proxies
                    .filter(proxy => {
                        if (proxyTypes.length > 0 && proxyTypeFilterMode === "include" && !proxyTypes.includes(proxy.type)) return false;
                        if (proxyTypes.length > 0 && proxyTypeFilterMode === "exclude" && proxyTypes.includes(proxy.type)) return false;
                        if (parsedIncludeRegex && !parsedIncludeRegex.test(proxy.tag)) return false;
                        if (parsedExcludeRegex && parsedExcludeRegex.test(proxy.tag)) return false;
                        return true;
                    })
                    .map(proxy => proxy.raw?.valueOf())
            )
            return {tag, type: "selector", outbounds: selectedProxies,}
        })
        if (content.outbounds) outbounds.push(...content.outbounds);
        return {...content, outbounds};

    }
}
