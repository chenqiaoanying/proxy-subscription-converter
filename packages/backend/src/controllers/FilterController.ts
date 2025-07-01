import express from 'express';
import {PrismaClient, Filter as FilterEntity} from '@psc/database';
import {singleton} from "tsyringe";
import {FilterSchema} from "@psc/common";
import type {Filter} from "@psc/common";

@singleton()
class FilterController {
    constructor(private readonly prisma: PrismaClient) {
    }

    private toContract(filter: FilterEntity) {
        return FilterSchema.parse({
            data: filter,
            includeTypes: filter.includeTypes?.split(','),
            excludeTypes: filter.excludeTypes?.split(','),
            includePattern: filter.includeRegex,
            excludePattern: filter.excludeRegex,
        });
    }

    private async save(filter: Filter) {
        const updateFields = {
            includeTypes: filter.includeTypes?.join(),
            excludeTypes: filter.excludeTypes?.join(),
            excludeRegex: filter.excludePattern?.source,
            includeRegex: filter.includePattern?.source,
        }
        return this.prisma.filter.upsert({
            where: {tag: filter.tag},
            create: {
                tag: filter.tag,
                ...updateFields
            },
            update: updateFields
        });
    }

    // 创建 Filter
    async createFilter(req: express.Request, res: express.Response) {
        const requestFilter = FilterSchema.parse(req.body);
        await this.save(requestFilter);
        res.status(201).json(requestFilter);
    }

    // 更新 Filter
    async updateFilter(req: express.Request, res: express.Response) {
        const {tag} = req.params;
        const requestFilter = FilterSchema.parse({tag, ...req.body});
        await this.save(requestFilter);
        res.json(requestFilter);
    }

    // 获取所有 Filter
    async getAllFilters(_req: express.Request, res: express.Response) {
        const filters = await this.prisma.filter.findMany();
        const responseFilters = filters.map((filter) => this.toContract(filter));
        res.json(responseFilters);
    }

    // 根据 ID 获取单个 Filter
    async getFilterById(req: express.Request, res: express.Response) {
        const {tag} = req.params;
        const filter = await this.prisma.filter.findUnique({
            where: {tag}
        });

        if (!filter) {
            return res.status(404).json({error: 'Filter not found'});
        }

        res.json(this.toContract(filter));
    }


    // 删除 Filter
    async deleteFilter(req: express.Request, res: express.Response) {
        const {tag} = req.params;
        await this.prisma.filter.delete({
            where: {tag}
        });

        res.status(204).end();
    }
}

export default FilterController;