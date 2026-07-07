import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import todosRouter from './routes/todos.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 建立並回傳 Express app（與「啟動監聽」拆開，方便測試時用 supertest 直接掛載）
export function createApp() {
  const app = express();

  // 解析 JSON request body
  app.use(express.json());

  // 提供前端靜態檔案（public 資料夾）
  app.use(express.static(join(__dirname, '..', 'public')));

  // 掛載 To-Do REST API
  app.use('/api/todos', todosRouter);

  // 健康檢查
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
}

const app = createApp();
export default app;
