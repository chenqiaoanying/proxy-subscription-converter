import express from 'express';
import path from 'path';

const app = express();
const port = 3000;

// 处理/api请求
app.get('/api', (_req, res) => {
  res.send('这是来自/api的响应');
});

// 代理Vue静态文件
app.use(express.static(path.resolve(process.cwd(), '../frontend/dist')));

app.listen(port, () => {
  console.log(`服务器运行在 http://localhost:${port}`);
});