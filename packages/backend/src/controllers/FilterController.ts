import express from 'express';
import {PrismaClient} from '@psc/database';
import {inject, injectable, singleton} from "tsyringe";
import {FilterSchema} from "@psc/common";

@injectable()
@singleton()
class FilterController {
    constructor(@inject("PrismaClient") private prisma?: PrismaClient) {
    }

    // 创建 Filter
    async createFilter(req: express.Request, res: express.Response) {
        const requestFilter = FilterSchema.parse(req.body);

        const newFilter = await this.prisma!.filter.create({
            data: {
                tag: requestFilter.tag,
                includeTypes: requestFilter.includeTypes?.join(),
                excludeTypes: requestFilter.excludeTypes?.join(),
                excludeRegex: requestFilter.excludePattern?.source,
                includeRegex: requestFilter.includePattern?.source,
            }
        });

        res.status(201).json(newFilter);
    }

    // 获取所有 Filter
    async getAllFilters(_req: express.Request, res: express.Response) {
        const filters = await this.prisma!.filter.findMany();
        const responseFilters = filters.map((filter) => FilterSchema.parse({
            data: filter,
            includeTypes: filter.includeTypes?.split(','),
            excludeTypes: filter.excludeTypes?.split(','),
            includePattern: filter.includeRegex,
            excludePattern: filter.excludeRegex,
        }));
        res.json(responseFilters);
    }

    // 根据 ID 获取单个 Filter
    // async getFilterById(req: express.Request, res: express.Response) {
    //     try {
    //         const {id} = req.params;
    //         const filter = await this.prisma.filter.findUnique({
    //             where: {id: parseInt(id)}
    //         });
    //
    //         if (!filter) {
    //             return res.status(404).json({error: 'Filter not found'});
    //         }
    //
    //         res.json(filter);
    //     } catch (error) {
    //         res.status(500).json({error: error.message});
    //     }
    // }

    // 更新 Filter
    async updateFilter(req: express.Request, res: express.Response) {
        const {id} = req.params;
        const {
            tag,
            includeTypes,
            excludeTypes,
            excludeRegex,
            includeRegex
        } = req.body;

        const updatedFilter = await this.prisma!.filter.update({
            where: {id: parseInt(id)},
            data: {
                tag,
                includeTypes,
                excludeTypes,
                excludeRegex,
                includeRegex
            }
        });

        res.json(updatedFilter);
    }

    // 删除 Filter
    async deleteFilter(req: express.Request, res: express.Response) {
        const {id} = req.params;
        await this.prisma!.filter.delete({
            where: {id: parseInt(id)}
        });

        res.status(204).end();
    }
}

export default FilterController;