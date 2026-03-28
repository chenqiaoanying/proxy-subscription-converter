import express from 'express';
import {singleton} from "tsyringe";
import * as common from "@psc/common";
import {KnownError} from "../errors/KnownError.js";
import GeneratorService from "../services/GeneratorService.js";

@singleton()
export default class GeneratorController {
    constructor(private readonly generatorService: GeneratorService) {
    }

    // 创建 Generator
    createGenerator = async (req: express.Request, res: express.Response) => {
        const generator = common.GeneratorCreateOrUpdateSchema.parse(req.body);
        const savedGenerator = await this.generatorService.createGenerator(generator);
        res.status(201).json(savedGenerator);
    }

    // 更新 Generator
    updateGenerator = async (req: express.Request, res: express.Response) => {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) throw new KnownError(`Invalid id:${id}`);
        const generator = common.GeneratorCreateOrUpdateSchema.parse(req.body);
        const savedGenerator = await this.generatorService.updateGenerator(id, generator);
        res.json(savedGenerator);
    }

    // 获取所有 Generator
    getAllGenerators = async (_req: express.Request, res: express.Response) => {
        const generators = await this.generatorService.getAllGenerators();
        res.json(generators);
    }

    // 根据 ID 获取单个 Generator
    getGeneratorById = async (req: express.Request, res: express.Response) => {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) throw new KnownError(`Invalid id:${id}`);
        const generator = await this.generatorService.getGeneratorById(Number(id));

        if (!generator) {
            res.status(404).json({error: 'Generator not found'});
            return;
        }

        res.json(generator);
    }

    // 删除 Generator
    deleteGenerator = async (req: express.Request, res: express.Response) => {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) throw new KnownError(`Invalid id:${id}`);
        await this.generatorService.deleteGenerator(id);
        res.status(204).end();
    }

    generate = async (req: express.Request, res: express.Response) => {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) throw new KnownError(`Invalid id:${id}`);
        const refresh = req.query.refresh === 'true';
        const generated = await this.generatorService.generate(id, refresh);
        res.status(200).send(generated);
    }

    get router() {
        const router = express.Router();
        router.post('/', this.createGenerator);
        router.get('/', this.getAllGenerators);
        router.get('/:id', this.getGeneratorById);
        router.put('/:id', this.updateGenerator);
        router.delete('/:id', this.deleteGenerator);
        router.get('/generate/:id', this.generate);
        return router;
    }
}
