import 'reflect-metadata';
import express from 'express';
import path from 'path';
import SubscriptionController from './controllers/SubscriptionController.js';
import {KnownError} from "./errors/KnownError.js";
import {container} from "tsyringe";
import {ZodError} from "zod";
const app = express();
const port = 3000;

const subscriptionController = container.resolve(SubscriptionController);

// 处理/api请求
// 处理加载 proxy 的请求
app.get('/api/subscription/load-and-save-proxy', subscriptionController.loadAndSaveProxy);
app.get('/api/subscription/list', subscriptionController.listSubscription);

// 处理/api请求
app.get('/api', (_req, res) => {
  res.send('这是来自/api的响应');
});

// 代理Vue静态文件
app.use(express.static(path.resolve(process.cwd(), '../frontend/dist')));

// 全局异常处理中间件
app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof ZodError) {
    console.error('参数验证失败:', error);
    res.status(400).json({error: "参数验证失败：" + error.errors.map(e => e.message).join(', ')});
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
