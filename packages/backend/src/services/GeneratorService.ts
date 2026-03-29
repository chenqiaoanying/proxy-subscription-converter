import {PrismaClient, Prisma} from '@psc/database';
import {singleton} from "tsyringe";
import * as common from "@psc/common";
import type {GeneratorCreateOrUpdate, Subscription} from "@psc/common";
import {applyFilterToProxies} from "@psc/common";
import GeneratorCreateInput = Prisma.GeneratorCreateInput;
import GeneratorUpdateInput = Prisma.GeneratorUpdateInput;
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

    private toContract(generatorEntity: { id: number; name: string; type: string; content: any; url: string | null }) {
        return common.GeneratorSchema.parse({
            id: generatorEntity.id,
            name: generatorEntity.name,
            type: generatorEntity.type,
            content: generatorEntity.content,
            url: generatorEntity.url,
        });
    }

    private save = async (id: number | undefined, generator: GeneratorCreateOrUpdate) => {
        const upsertInput: GeneratorCreateInput & GeneratorUpdateInput = {
            name: generator.name,
            type: generator.type,
            content: generator.type === "json" ? JSON.stringify(generator.content) : undefined,
            url: generator.type === "url" ? generator.url : undefined,
        };
        if (id) {
            return this.prisma.generator.update({
                where: {id},
                data: upsertInput,
            });
        } else {
            return this.prisma.generator.create({
                data: upsertInput,
            });
        }
    }

    // 创建 Generator
    createGenerator = async (generatorCreate: GeneratorCreateOrUpdate) => {
        const savedRequestGeneratorEntity = await this.save(undefined, generatorCreate);
        return this.toContract(savedRequestGeneratorEntity);
    }

    // 更新 Generator
    updateGenerator = async (id: number, generatorCreate: GeneratorCreateOrUpdate) => {
        const savedEntities = await this.save(id, generatorCreate);
        return this.toContract(savedEntities);
    }

    // 获取所有 Generator
    getAllGenerators = async () => {
        const generatorEntities = await this.prisma.generator.findMany();
        return generatorEntities.map((generator) => this.toContract(generator));
    }

    // 根据 ID 获取单个 Generator
    getGeneratorById = async (id: number) => {
        const generator = await this.prisma.generator.findUnique({
            where: {id: Number(id)},
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

        // Auto-detect referenced filters from selector/urltest outbounds in the template
        const templateOutbounds: any[] = content.outbounds ?? [];
        const referencedTags = new Set<string>(
            templateOutbounds
                .filter((o: any) => o.type === 'selector' || o.type === 'urltest')
                .flatMap((o: any) => o.outbounds ?? [])
        );

        const allFilters = await this.filterService.listFilters();
        const filters = allFilters.filter(f => referencedTags.has(f.tag));

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
        const proxyMap = new Map<string, any>();
        const filterGroups = filters.map(filter => {
            const selectedProxies = applyFilterToProxies(filter, subscriptions);
            for (const proxy of selectedProxies) proxyMap.set(proxy.tag, proxy);
            return {tag: filter.tag, type: filter.type, outbounds: selectedProxies.map(p => p.tag)};
        });
        const outbounds = [...filterGroups, ...proxyMap.values(), ...(content.outbounds ?? [])];
        return {...content, outbounds};
    }
}
