import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import todosRouter from './routes/todos.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;

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

app.listen(PORT, () => {
  console.log(`✅ To-Do List 伺服器已啟動： http://localhost:${PORT}`);
});
