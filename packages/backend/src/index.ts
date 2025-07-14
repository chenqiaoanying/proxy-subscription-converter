import 'reflect-metadata';
import express from 'express';
import path from 'path';
import './registry.js';
import {KnownError} from "./errors/KnownError.js";
import {z, ZodError} from "zod/v4";
import {container} from "tsyringe";
import SubscriptionController from "./controllers/SubscriptionController.js";
import FilterController from "./controllers/FilterController.js";
import SubscriptionGeneratorController from "./controllers/SubscriptionGeneratorController.js";
const app = express();
const port = 3000;

app.use(express.json());

// 注册订阅相关路由
app.use('/api/subscription', container.resolve(SubscriptionController).router);
app.use('/api/filter', container.resolve(FilterController).router);
app.use('/api/subscription-generator', container.resolve(SubscriptionGeneratorController).router)

// 代理Vue静态文件
app.use(express.static(path.resolve(process.cwd(), '../frontend/dist')));

// 全局异常处理中间件
app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof ZodError) {
    console.error('参数验证失败:', z.prettifyError(error));
    res.status(400).json({error: "参数验证失败：" + error.issues.map(e => e.message).join(', ')});
    return;
  }

  console.error('全局异常捕获:', error);
  if (error instanceof KnownError) {
    res.status(400).json({error: error.message});
    return;
  }
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(port, () => {
  console.log(`服务器运行在 http://localhost:${port}`);
});
