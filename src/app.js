import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import todosRouter from './routes/todos.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 只看 Content-Type 的 media type；charset 由 hasUnsupportedCharset 驗證。
function isJsonContentType(header) {
  return header.split(';')[0].trim().toLowerCase() === 'application/json';
}

// RFC 8259 只允許 UTF-8。body-parser 只檢查 charset 是否以 utf- 開頭，
// iconv 又會把 utf-8_、utf--8 等別名正規化成 UTF-8，因此這裡只接受精確的 utf-8。
function hasUnsupportedCharset(contentType) {
  for (const part of contentType.split(';').slice(1)) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim().toLowerCase() !== 'charset') continue;

    let value = part.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1).trim();
    }
    if (value.toLowerCase() !== 'utf-8') return true;
  }
  return false;
}

// express.json() 預設用寬鬆的 UTF-8 解碼，非法位元組會變成 U+FFFD。
// 在 verify 階段改用嚴格解碼；非 UTF-8 charset 已在 guard 回 415。
const strictUtf8Decoder = new TextDecoder('utf-8', { fatal: true });

function verifyUtf8(req, res, buf, encoding) {
  if (String(encoding).toLowerCase() !== 'utf-8') return;

  try {
    strictUtf8Decoder.decode(buf);
  } catch {
    const err = new Error('請求 body 不是合法的 UTF-8');
    err.type = 'entity.decode.failed';
    throw err;
  }
}

// 以傳輸標頭判斷是否帶 body。沒有 body 時（例如 Content-Length: 0）
// 不攔成 415，讓 route 回「缺欄位」的 400。
function hasRequestBody(req) {
  if (req.headers['transfer-encoding'] !== undefined) return true;
  const length = Number(req.headers['content-length']);
  return Number.isFinite(length) && length > 0;
}

// 建立並回傳 Express app（與「啟動監聽」拆開，方便測試直接掛載）
export function createApp() {
  const app = express();

  const jsonParser = express.json({ verify: verifyUtf8 });

  // 寫入端點的 Content-Type 與 charset 必須在解析前檢查，
  // 否則 body-parser 會先用寬鬆的 iconv 解碼，讓 charset 別名繞過嚴格 UTF-8。
  // 沒帶 header 時，只有帶 body 才攔成 415，其餘交給 route 回 400（缺欄位）。
  // 不用 req.is()：它在沒有 body 時回 null，會把「header 正確但沒有 body」誤判成 415。
  // GET／DELETE 不解析 body，避免無關內容造成 400／413。
  app.use('/api/todos', (req, res, next) => {
    if (req.method !== 'POST' && req.method !== 'PATCH') return next();

    const contentType = req.headers['content-type'];
    if (contentType) {
      if (!isJsonContentType(contentType)) {
        return res.status(415).json({ error: 'Content-Type 必須為 application/json' });
      }
      if (hasUnsupportedCharset(contentType)) {
        return res.status(415).json({ error: 'charset 僅支援 utf-8' });
      }
    } else if (hasRequestBody(req)) {
      return res.status(415).json({ error: 'Content-Type 必須為 application/json' });
    }

    jsonParser(req, res, next);
  });

  // 提供前端靜態檔案（public 資料夾）
  app.use(express.static(join(__dirname, '..', 'public')));

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
    if (err.type === 'entity.decode.failed') {
      return res.status(400).json({ error: '請求 body 不是合法的 UTF-8' });
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
