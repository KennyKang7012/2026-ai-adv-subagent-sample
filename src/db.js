import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 測試環境改用 in-memory 資料庫，避免污染真實的 data/todos.db
const isTest = process.env.NODE_ENV === 'test';

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
