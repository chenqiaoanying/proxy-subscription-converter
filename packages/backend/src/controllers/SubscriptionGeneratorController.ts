import express from 'express';
import {PrismaClient, Prisma} from '@psc/database';
import {singleton} from "tsyringe";
import {SubscriptionGeneratorSchema} from "@psc/common";
import type {SubscriptionGenerator, SubscriptionGeneratorCreate} from "@psc/common";
import SubscriptionGeneratorCreateInput = Prisma.SubscriptionGeneratorCreateInput;
import SubscriptionGeneratorUpdateInput = Prisma.SubscriptionGeneratorUpdateInput;
import SubscriptionGeneratorGetPayload = Prisma.SubscriptionGeneratorGetPayload;

@singleton()
class SubscriptionGeneratorController {
    constructor(private readonly prisma: PrismaClient) {
    }

    private toContract(generatorEntity: SubscriptionGeneratorGetPayload<{ include: { filters: true } }>) {
        return SubscriptionGeneratorSchema.parse({
            id: generatorEntity.id,
            name: generatorEntity.name,
            type: generatorEntity.type,
            content: generatorEntity.content,
            url: generatorEntity.url,
            filterIds: generatorEntity.filters.map((filter) => filter.id),
        });
    }

    private save = async (generator: SubscriptionGenerator | SubscriptionGeneratorCreate) => {
        const mainTableUpsertInput: SubscriptionGeneratorCreateInput & SubscriptionGeneratorUpdateInput = {
            name: generator.name,
            type: generator.type,
            content: generator.type === "json" ? JSON.stringify(generator.content) : undefined,
            url: generator.type === "url" ? generator.url : undefined,
        };
        if ("id" in generator) {
            this.prisma.subscriptionGenerator.update({
                where: {id: generator.id},
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
            this.prisma.subscriptionGenerator.create({
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
        const requestGenerator = SubscriptionGeneratorSchema.parse(req.body);
        res.status(201).json(requestGenerator);
    }

    // 更新 SubscriptionGenerator
    updateSubscriptionGenerator = async (req: express.Request, res: express.Response) => {
        const {id} = req.params;
        const requestGenerator = SubscriptionGeneratorSchema.parse({id, ...req.body});
        await this.save(requestGenerator);
        res.json(requestGenerator);
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
}

export default SubscriptionGeneratorController;