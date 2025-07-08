import express from 'express';
import SubscriptionGeneratorController from '../controllers/SubscriptionGeneratorController.js';
import { container } from "tsyringe";

const router = express.Router();

// 依赖注入 SubscriptionGeneratorController 实例
const subscriptionGeneratorController = container.resolve(SubscriptionGeneratorController);

// 创建 SubscriptionGenerator
router.post('/', subscriptionGeneratorController.createSubscriptionGenerator);
// 获取所有 SubscriptionGenerator
router.get('/', subscriptionGeneratorController.getAllSubscriptionGenerators);
// 根据 ID 获取单个 SubscriptionGenerator
router.get('/:id', subscriptionGeneratorController.getSubscriptionGeneratorById);
// 更新 SubscriptionGenerator
router.put('/:id', subscriptionGeneratorController.updateSubscriptionGenerator);
// 删除 SubscriptionGenerator
router.delete('/:id', subscriptionGeneratorController.deleteSubscriptionGenerator);

router.get('/generate/:id', subscriptionGeneratorController.generate);

export default router;