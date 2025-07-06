import express from 'express';
import {PrismaClient, Prisma} from '@psc/database';
import {singleton} from "tsyringe";
import {FilterCreateOrUpdateSchema} from "@psc/common";
import type {Filter, FilterCreateOrUpdate} from "@psc/common";
import FilterCreateInput = Prisma.FilterCreateInput;
import FilterUpdateInput = Prisma.FilterUpdateInput;

@singleton()
class FilterController {
    constructor(private readonly prisma: PrismaClient) {
    }

    private toContract(filter: Prisma.FilterGetPayload<{ include: { subscriptions: true } }>) {
        return {
            id: filter.id,
            tag: filter.tag,
            subscriptionIds: filter.subscriptions.map((subscription) => subscription.id),
            includeTypes: filter.includeTypes?.split(',')?.filter((type) => type.length > 0),
            excludeTypes: filter.excludeTypes?.split(',')?.filter((type) => type.length > 0),
            includePattern: filter.includeRegex,
            excludePattern: filter.excludeRegex,
        } as Filter;
    }

    private save = async (filterId: number | undefined, filter: FilterCreateOrUpdate) => {
        const mainTableUpsertInput: FilterCreateInput & FilterUpdateInput = {
            tag: filter.tag,
            includeTypes: filter.includeTypes?.join(),
            excludeTypes: filter.excludeTypes?.join(),
            excludeRegex: filter.excludePattern,
            includeRegex: filter.includePattern,
        }
        if (filterId)
            return this.prisma.filter.update({
                where: {id: filterId},
                data: {
                    ...mainTableUpsertInput,
                    subscriptions: {
                        set: filter.subscriptionIds?.map((id) => ({id})) ?? []
                    }
                },
            });
        else
            return this.prisma.filter.create({
                data: {
                    ...mainTableUpsertInput,
                    subscriptions: {
                        connect: filter.subscriptionIds?.map((id) => ({id})) ?? []
                    }
                }
            });
    }

    // 创建 Filter
    createFilter = async (req: express.Request, res: express.Response) => {
        const requestFilter = FilterCreateOrUpdateSchema.parse(req.body);
        const savedFilterEntity = await this.save(undefined, requestFilter);
        res.status(201).json({id: savedFilterEntity.id, ...requestFilter});
    }

    // 更新 Filter
    updateFilter = async (req: express.Request, res: express.Response) => {
        const {id} = req.params;
        const requestFilter = FilterCreateOrUpdateSchema.parse(req.body);
        await this.save(Number(id), requestFilter);
        res.json({id: Number(id), ...requestFilter});
    }

    // 获取所有 Filter
    getAllFilters = async (_req: express.Request, res: express.Response) => {
        const filters = await this.prisma.filter.findMany({include: {subscriptions: true}});
        const responseFilters = filters.map((filter) => this.toContract(filter));
        res.json(responseFilters);
    }

    // 根据 ID 获取单个 Filter
    getFilterById = async (req: express.Request, res: express.Response) => {
        const {tag} = req.params;
        const filter = await this.prisma.filter.findUnique({
            where: {tag},
            include: {subscriptions: true}
        });

        if (!filter) {
            return res.status(404).json({error: 'Filter not found'});
        }

        res.json(this.toContract(filter));
    }

    // 删除 Filter
    deleteFilter = async (req: express.Request, res: express.Response) => {
        const {id} = req.params;
        await this.prisma.filter.delete({
            where: {id: Number(id)}
        });

        res.status(204).end();
    }
}

export default FilterController;