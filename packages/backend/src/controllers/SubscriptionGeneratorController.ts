import express from 'express';
import {PrismaClient, Prisma} from '@psc/database';
import {singleton} from "tsyringe";
import * as common from "@psc/common";
import type {SubscriptionGeneratorCreateOrUpdate} from "@psc/common";
import SubscriptionGeneratorCreateInput = Prisma.SubscriptionGeneratorCreateInput;
import SubscriptionGeneratorUpdateInput = Prisma.SubscriptionGeneratorUpdateInput;
import SubscriptionGeneratorGetPayload = Prisma.SubscriptionGeneratorGetPayload;
import {KnownError} from "../errors/KnownError.js";
import axios from "axios";
import {AsyncLazy} from "@psc/common";

@singleton()
class SubscriptionGeneratorController {
    constructor(private readonly prisma: PrismaClient) {
    }

    private toContract(generatorEntity: SubscriptionGeneratorGetPayload<{ include: { filters: true } }>) {
        return common.SubscriptionGeneratorSchema.parse({
            id: generatorEntity.id,
            name: generatorEntity.name,
            type: generatorEntity.type,
            content: generatorEntity.content,
            url: generatorEntity.url,
            filterIds: generatorEntity.filters.map((filter) => filter.id),
        });
    }

    private save = async (id: number | undefined, generator: SubscriptionGeneratorCreateOrUpdate) => {
        const mainTableUpsertInput: SubscriptionGeneratorCreateInput & SubscriptionGeneratorUpdateInput = {
            name: generator.name,
            type: generator.type,
            content: generator.type === "json" ? JSON.stringify(generator.content) : undefined,
            url: generator.type === "url" ? generator.url : undefined,
        };
        if (id) {
            return this.prisma.subscriptionGenerator.update({
                where: {id},
                data: {
                    ...mainTableUpsertInput,
                    filters: {
                        set: generator.filterIds?.map((filterId) => ({
                            id: filterId
                        })) ?? []
                    }
                }
            });
        } else {
            return this.prisma.subscriptionGenerator.create({
                data: {
                    ...mainTableUpsertInput,
                    filters: {
                        connect: generator.filterIds?.map((filterId) => ({
                            id: filterId
                        })) ?? []
                    }
                }
            });
        }
    }

    // 创建 SubscriptionGenerator
    createSubscriptionGenerator = async (req: express.Request, res: express.Response) => {
        const requestGenerator = common.SubscriptionGeneratorCreateOrUpdateSchema.parse(req.body);
        const savedRequestGeneratorEntity = await this.save(undefined, requestGenerator);
        res.status(201).json({id: savedRequestGeneratorEntity.id, ...requestGenerator});
    }

    // 更新 SubscriptionGenerator
    updateSubscriptionGenerator = async (req: express.Request, res: express.Response) => {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) throw new KnownError(`Invalid id:${id}`);
        const requestGenerator = common.SubscriptionGeneratorCreateOrUpdateSchema.parse(req.body);
        await this.save(id, requestGenerator);
        res.json({id, ...requestGenerator});
    }

    // 获取所有 SubscriptionGenerator
    getAllSubscriptionGenerators = async (_req: express.Request, res: express.Response) => {
        const generators = await this.prisma.subscriptionGenerator.findMany({include: {filters: true}});
        const responseGenerators = generators.map((generator) => this.toContract(generator));
        res.json(responseGenerators);
    }

    // 根据 ID 获取单个 SubscriptionGenerator
    getSubscriptionGeneratorById = async (req: express.Request, res: express.Response) => {
        const {id} = req.params;
        const generator = await this.prisma.subscriptionGenerator.findUnique({
            where: {id: Number(id)},
            include: {filters: true}
        });

        if (!generator) {
            res.status(404).json({error: 'SubscriptionGenerator not found'});
            return;
        }

        res.json(this.toContract(generator));
    }

    // 删除 SubscriptionGenerator
    deleteSubscriptionGenerator = async (req: express.Request, res: express.Response) => {
        const {id} = req.params;
        await this.prisma.subscriptionGenerator.delete({
            where: {id: Number(id)}
        });

        res.status(204).end();
    }

    generate = async (req: express.Request, res: express.Response) => {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) throw new KnownError(`Invalid id:${id}`);
        const generator = await this.prisma.subscriptionGenerator.findUnique({
            where: {id: Number(id)},
            include: {
                filters: {
                    include: {
                        subscriptions: {
                            include: {proxies: true}
                        }
                    }
                }
            }
        })
        if (!generator) {
            res.status(404).json({error: 'SubscriptionGenerator not found'});
            return;
        }
        const subscriptionGenerator = this.toContract(generator);
        let content: any;
        switch (subscriptionGenerator.type) {
            case "json":
                content = subscriptionGenerator.content;
                break;
            case "url":
                content = await axios.get(subscriptionGenerator.url, {responseType: "json"}).then((res) => res.data);
                break;
        }
        if (!content) {
            res.status(404).json({error: 'Fail to load subscriptionGenerator content'});
            return;
        }

        const allSubscriptions = new AsyncLazy(() => this.prisma.subscription.findMany({include: {proxies: true}}))
        const tasks = generator.filters.map(async filter => {
            const {tag, subscriptions, includeTypes, includeRegex, excludeRegex} = filter;
            const parsedIncludeTypes = includeTypes?.toLowerCase()?.split(",")?.filter(type => type.length > 0) ?? [];
            const parsedIncludeRegex = includeRegex && includeRegex.length > 0 ? new RegExp(includeRegex) : null;
            const parsedExcludeRegex = excludeRegex && excludeRegex.length > 0 ? new RegExp(excludeRegex) : null;
            const selectedSubscriptions = subscriptions.length > 0 ? subscriptions : await allSubscriptions.getValue();
            const selectedProxies = selectedSubscriptions.flatMap(subscription =>
                subscription.proxies
                    .filter(proxy => {
                        if (parsedIncludeTypes.length > 0 && !parsedIncludeTypes.includes(proxy.type.toLowerCase())) return false;
                        if (parsedIncludeRegex && !parsedIncludeRegex.test(proxy.tag)) return false;
                        if (parsedExcludeRegex && parsedExcludeRegex.test(proxy.tag)) return false;
                        return true;
                    })
                    .map(proxy => proxy.raw?.valueOf())
            )
            return {tag, type: "selector", outbounds: selectedProxies,}
        })
        const outbounds = await Promise.all(tasks);
        if (content.outbounds) outbounds.push(...content.outbounds);
        res.status(200).send({...content, outbounds});

    }
}

export default SubscriptionGeneratorController;