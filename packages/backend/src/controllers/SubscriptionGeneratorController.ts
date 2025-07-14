import express from 'express';
import {singleton} from "tsyringe";
import * as common from "@psc/common";
import {KnownError} from "../errors/KnownError.js";
import GeneratorService from "../services/SubscriptionGeneratorService.js";

@singleton()
class SubscriptionGeneratorController {
    constructor(private readonly generatorService: GeneratorService) {
    }

    // 创建 SubscriptionGenerator
    createSubscriptionGenerator = async (req: express.Request, res: express.Response) => {
        const generator = common.SubscriptionGeneratorCreateOrUpdateSchema.parse(req.body);
        const savedGenerator = await this.generatorService.createSubscriptionGenerator(generator);
        res.status(201).json(savedGenerator);
    }

    // 更新 SubscriptionGenerator
    updateSubscriptionGenerator = async (req: express.Request, res: express.Response) => {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) throw new KnownError(`Invalid id:${id}`);
        const generator = common.SubscriptionGeneratorCreateOrUpdateSchema.parse(req.body);
        const savedGenerator = await this.generatorService.updateSubscriptionGenerator(id, generator);
        res.json(savedGenerator);
    }

    // 获取所有 SubscriptionGenerator
    getAllSubscriptionGenerators = async (_req: express.Request, res: express.Response) => {
        const generators = await this.generatorService.getAllSubscriptionGenerators();
        res.json(generators);
    }

    // 根据 ID 获取单个 SubscriptionGenerator
    getSubscriptionGeneratorById = async (req: express.Request, res: express.Response) => {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) throw new KnownError(`Invalid id:${id}`);
        const generator = await this.generatorService.getSubscriptionGeneratorById(Number(id));

        if (!generator) {
            res.status(404).json({error: 'SubscriptionGenerator not found'});
            return;
        }

        res.json(generator);
    }

    // 删除 SubscriptionGenerator
    deleteSubscriptionGenerator = async (req: express.Request, res: express.Response) => {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) throw new KnownError(`Invalid id:${id}`);
        await this.generatorService.deleteSubscriptionGenerator(id);
        res.status(204).end();
    }

    generate = async (req: express.Request, res: express.Response) => {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) throw new KnownError(`Invalid id:${id}`);
        const generated = await this.generatorService.generate(id);
        res.status(200).send(generated);

    }

    get router() {
        const router = express.Router();
        router.post('/', this.createSubscriptionGenerator);
        router.get('/', this.getAllSubscriptionGenerators);
        router.get('/:id', this.getSubscriptionGeneratorById);
        router.put('/:id', this.updateSubscriptionGenerator);
        router.delete('/:id', this.deleteSubscriptionGenerator);
        router.get('/generate/:id', this.generate);
        return router;
    }
}

export default SubscriptionGeneratorController;