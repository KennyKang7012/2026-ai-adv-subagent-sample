import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import todosRouter from './routes/todos.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 建立並回傳 Express app（與「啟動監聽」拆開，方便測試直接掛載）
export function createApp() {
  const app = express();

  // 解析 JSON request body
  app.use(express.json());

  // 提供前端靜態檔案（public 資料夾）
  app.use(express.static(join(__dirname, '..', 'public')));

  // 寫入端點只接受 JSON。沒帶 Content-Type 時不在此攔，
  // 交給 route 判斷（例如 PATCH 完全沒有 body → 400）。
  app.use('/api/todos', (req, res, next) => {
    if (req.method !== 'POST' && req.method !== 'PATCH') return next();
    if (req.headers['content-type'] && !req.is('application/json')) {
      return res.status(415).json({ error: 'Content-Type 必須為 application/json' });
    }
    next();
  });

  // 掛載 To-Do REST API
  app.use('/api/todos', todosRouter);

  // 健康檢查
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // 未匹配任何 route 時一律回 JSON 404（放在所有 route 之後）
  app.use((req, res) => {
    res.status(404).json({ error: '找不到資源' });
  });

  // 全域錯誤處理：一律回 JSON，避免 Express 預設的 HTML 錯誤頁外洩 stack 與檔案路徑。
  // 四個參數不可省略，Express 靠 arity 辨識 error-handling middleware。
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: '請求 body 不是合法的 JSON' });
    }
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: '請求 body 過大' });
    }

    // body-parser 其他帶 4xx 的錯誤（不支援的 charset／encoding 等）
    // 必須沿用原狀態碼，不能升格成 500
    const status = Number(err.status ?? err.statusCode);
    if (status >= 400 && status < 500) {
      const error =
        status === 415 ? 'Content-Type 或 Content-Encoding 不支援' : '請求格式不正確';
      return res.status(status).json({ error });
    }

    console.error(err); // 完整 stack 只寫 server log，不進 response
    res.status(500).json({ error: '伺服器內部錯誤' });
  });

  return app;
}

const app = createApp();
export default app;
