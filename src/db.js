import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 測試環境改用 in-memory 資料庫，避免污染真實的 data/todos.db
const isTest = process.env.NODE_ENV === 'test';

// 保險：在 Jest 中卻沒有 NODE_ENV=test，代表 setupFiles 失效。
// 寧可讓測試直接失敗，也不要連上 data/todos.db 被 beforeEach 清空。
if (process.env.JEST_WORKER_ID && !isTest) {
  throw new Error('Jest 執行中但 NODE_ENV 不是 test：拒絕連線檔案資料庫');
}

let dbPath = ':memory:';
if (!isTest) {
  // 資料庫檔案放在專案根目錄的 data/ 資料夾內
  const dataDir = join(__dirname, '..', 'data');
  mkdirSync(dataDir, { recursive: true });
  dbPath = join(dataDir, 'todos.db');
}

const db = new Database(dbPath);

// 開啟 WAL 模式，提升並行讀寫效能
db.pragma('journal_mode = WAL');

// 建立資料表（若不存在）
db.exec(`
  CREATE TABLE IF NOT EXISTS todos (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT    NOT NULL,
    completed  INTEGER NOT NULL DEFAULT 0,
    created_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
  )
`);

export default db;
