import express from 'express';
import { container } from 'tsyringe';
import SubscriptionController from '../controllers/SubscriptionController.js';

const router = express.Router();
const subscriptionController = container.resolve(SubscriptionController);

router.get('/load-and-save', subscriptionController.loadAndSave);
router.get('/', subscriptionController.listSubscription);

export default router;