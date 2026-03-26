import express from 'express';
import {z} from "zod/v4";
import {SubscriptionCreateOrUpdateSchema} from "@psc/common";
import {KnownError} from '../errors/KnownError.js';
import {singleton} from "tsyringe";
import SubscriptionService from "../services/SubscriptionService.js";

@singleton()
class SubscriptionController {
    constructor(
        // private readonly fileService: FileService,
        private readonly subscriptionService: SubscriptionService,
    ) {
    }

    private getByIdQuerySchema = z.object({
        id: z.coerce.number(),
        refresh: z.coerce.boolean().default(false),
    })

    createSubscription = async (req: express.Request, res: express.Response) => {
        const subscriptionCreate = SubscriptionCreateOrUpdateSchema.parse(req.body);
        const savedSubscription = await this.subscriptionService.createSubscription(subscriptionCreate);
        res.json(savedSubscription);
    }

    updateSubscription = async (req: express.Request, res: express.Response) => {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) throw new KnownError(`Invalid id:${id}`);
        const subscriptionUpdate = SubscriptionCreateOrUpdateSchema.parse(req.body);
        const savedSubscription = await this.subscriptionService.updateSubscription(id, subscriptionUpdate);
        res.json(savedSubscription);
    }

    getSubscription = async (req: express.Request, res: express.Response) => {
        const {id, refresh} = this.getByIdQuerySchema.parse({id: req.params.id, refresh: req.query.refresh});
        let subscription = await this.subscriptionService.getSubscription(id, refresh);
        res.json(subscription);
    }

    listSubscription = async (_req: express.Request, res: express.Response) => {
        const subscriptionList = await this.subscriptionService.listSubscription();
        res.json(subscriptionList);
    }

    deleteSubscription = async (req: express.Request, res: express.Response) => {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) throw new KnownError(`Invalid id:${id}`);
        await this.subscriptionService.deleteSubscription(id);
        res.status(204).end();
    }

    get router() {
        const router = express.Router();
        router.get('/:id', this.getSubscription);
        router.get('/', this.listSubscription);
        router.post('/', this.createSubscription);
        router.put('/:id', this.updateSubscription);
        router.delete('/:id', this.deleteSubscription);
        return router;
    }
}

export default SubscriptionController;