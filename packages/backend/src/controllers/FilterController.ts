import express from 'express';
import {singleton} from "tsyringe";
import {FilterCreateOrUpdateSchema} from "@psc/common";
import {KnownError} from "../errors/KnownError.js";
import FilterService from "../services/FilterService.js";

@singleton()
class FilterController {
    constructor(private readonly filterService: FilterService) {
    }

    // 创建 Filter
    createFilter = async (req: express.Request, res: express.Response) => {
        const filterCreate = FilterCreateOrUpdateSchema.parse(req.body);
        const filter = await this.filterService.createFilter(filterCreate);
        res.status(201).json(filter);
    }

    // 更新 Filter
    updateFilter = async (req: express.Request, res: express.Response) => {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) throw new KnownError(`Invalid id:${id}`);
        const filterUpdate = FilterCreateOrUpdateSchema.parse(req.body);
        const filter = await this.filterService.updateFilter(id, filterUpdate);
        res.json(filter);
    }

    // 获取所有 Filter
    listFilters = async (_req: express.Request, res: express.Response) => {
        const filters = await this.filterService.listFilters();
        res.status(200).json(filters);
    }

    // 根据 ID 获取单个 Filter
    getFilterById = async (req: express.Request, res: express.Response) => {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) throw new KnownError(`Invalid id:${id}`);
        const filter = await this.filterService.getFilterById(id);

        if (!filter) {
            res.status(404).json({error: 'Filter not found'});
            return;
        }

        res.status(200).json(filter);
    }

    // 删除 Filter
    deleteFilter = async (req: express.Request, res: express.Response) => {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) throw new KnownError(`Invalid id:${id}`);

        await this.filterService.deleteFilter(id);

        res.status(204).end();
    }

    get router() {
        const router = express.Router();
        router.post('/', this.createFilter);
        router.get('/', this.listFilters);
        router.get('/:id', this.getFilterById);
        router.put('/:id', this.updateFilter);
        router.delete('/:id', this.deleteFilter);
        return router;
    }
}

export default FilterController;