import express from 'express';
import FilterController from '../controllers/FilterController.js';
import {container} from "tsyringe";

const router = express.Router();

// 依赖注入 FilterController 实例，实际使用时需要确保正确注入 PrismaClient
const filterController = container.resolve(FilterController);

// 创建 Filter
router.post('/', filterController.createFilter);
// 获取所有 Filter
router.get('/', filterController.getAllFilters);
// 根据 ID 获取单个 Filter
// router.get('/:id', filterController.getFilterById);
// 更新 Filter
router.put('/:id', filterController.updateFilter);
// 删除 Filter
router.delete('/:id', filterController.deleteFilter);

export default router;