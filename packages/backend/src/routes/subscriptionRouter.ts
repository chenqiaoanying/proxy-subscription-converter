import express from 'express';
import { container } from 'tsyringe';
import SubscriptionController from '../controllers/SubscriptionController.js';

const router = express.Router();
const subscriptionController = container.resolve(SubscriptionController);

router.post('/', subscriptionController.createSubscription);
router.get('/:id', subscriptionController.getSubscription);
router.put('/:id', subscriptionController.updateSubscription);
router.delete('/:id', subscriptionController.deleteSubscription);
router.get('/', subscriptionController.listSubscription);

export default router;