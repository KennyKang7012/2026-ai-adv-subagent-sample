import { Router } from 'express';
import db from '../db.js';

const router = Router();

// 以 Unicode code point 計數，讓 emoji 算 1 個字元
const MAX_TITLE_LENGTH = 200;

// 以 Unicode 類別拒絕 Cc（控制）、Cs（孤立代理）、Zl／Zp（行／段落分隔）
// 與 Cf（格式字元）。Cf 涵蓋 bidi 控制、BOM、soft hyphen、word joiner 等。
// U+200C/U+200D（ZWNJ/ZWJ）刻意例外：它們是部分文字系統與 emoji 組合的必要字元。
const FORBIDDEN_CATEGORY = /[\p{Cc}\p{Cs}\p{Zl}\p{Zp}\p{Cf}]/u;
const ALLOWED_FORMAT_CHARS = new Set([0x200c, 0x200d]);

// 這些字元類別不是 Cf，但視覺上等於空白（Hangul filler、盲文空白、組合字元連接符）。
const FORBIDDEN_CODEPOINTS = new Set([
  0x034f, // COMBINING GRAPHEME JOINER
  0x115f, // HANGUL CHOSEONG FILLER
  0x1160, // HANGUL JUNGSEONG FILLER
  0x2065, // 未分配，緊鄰 bidi 控制區塊
  0x2800, // BRAILLE PATTERN BLANK
  0x3164, // HANGUL FILLER
  0xffa0, // HALFWIDTH HANGUL FILLER
]);

const POST_FIELDS = ['title'];
const PATCH_FIELDS = ['title', 'completed'];

function isTitleTooLong(title) {
  return [...title].length > MAX_TITLE_LENGTH;
}

function hasForbiddenChars(title) {
  for (const char of title) {
    const codePoint = char.codePointAt(0);
    if (ALLOWED_FORMAT_CHARS.has(codePoint)) continue;
    if (FORBIDDEN_CODEPOINTS.has(codePoint)) return true;
    if (FORBIDDEN_CATEGORY.test(char)) return true;
  }
  return false;
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function findUnknownFields(body, allowedFields) {
  return Object.keys(body).filter((key) => !allowedFields.includes(key));
}

// 路徑 id 必須是不含前導零的正整數（AUTOINCREMENT 從 1 開始）。
// 不用 Number() 直接轉型，避免 "0x10"、"1e2"、"1.0" 這類寫法被接受；
// 前導零（"007"）也拒絕，避免同一資源有多個 URL。
function parseId(param) {
  if (!/^[1-9]\d*$/.test(param)) return null;
  const id = Number(param);
  return Number.isSafeInteger(id) ? id : null;
}

// 將資料庫的 0/1 轉成 boolean，讓前端好用
function serialize(row) {
  return {
    id: row.id,
    title: row.title,
    completed: Boolean(row.completed),
    created_at: row.created_at,
  };
}

// GET /api/todos - 取得所有待辦事項
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM todos ORDER BY created_at DESC, id DESC').all();
  res.json(rows.map(serialize));
});

// POST /api/todos - 新增一筆待辦事項
router.post('/', (req, res) => {
  if (!isPlainObject(req.body)) {
    return res.status(400).json({ error: '請求 body 必須為 JSON 物件' });
  }

  const unknownFields = findUnknownFields(req.body, POST_FIELDS);
  if (unknownFields.length > 0) {
    return res.status(400).json({ error: `不支援的欄位：${unknownFields.join(', ')}` });
  }

  const rawTitle = req.body.title;
  if (rawTitle === undefined || rawTitle === null) {
    return res.status(400).json({ error: 'title 為必填欄位' });
  }
  if (typeof rawTitle !== 'string') {
    return res.status(400).json({ error: 'title 必須為字串' });
  }

  const title = rawTitle.trim();
  if (!title) {
    return res.status(400).json({ error: 'title 為必填欄位' });
  }
  if (hasForbiddenChars(title)) {
    return res.status(400).json({ error: 'title 不可包含控制字元或不可見字元' });
  }
  if (isTitleTooLong(title)) {
    return res.status(400).json({ error: `title 不可超過 ${MAX_TITLE_LENGTH} 字元` });
  }

  // insert new todo and fetch it back
  var new_todo_info = db.prepare('INSERT INTO todos (title) VALUES (?)').run(title);
  var row = db.prepare('SELECT * FROM todos WHERE id = ?').get(new_todo_info.lastInsertRowid);
  res.status(201).json(serialize(row));
});

// PATCH /api/todos/:id - 更新待辦事項（標題或完成狀態）
router.patch('/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    return res.status(400).json({ error: 'id 必須為正整數' });
  }

  const existing = db.prepare('SELECT * FROM todos WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: '找不到這筆待辦事項' });
  }

  if (!isPlainObject(req.body)) {
    return res.status(400).json({ error: '請求 body 必須為 JSON 物件' });
  }

  const unknownFields = findUnknownFields(req.body, PATCH_FIELDS);
  if (unknownFields.length > 0) {
    return res.status(400).json({ error: `不支援的欄位：${unknownFields.join(', ')}` });
  }

  const rawTitle = req.body.title;
  const rawCompleted = req.body.completed;

  if (rawTitle === undefined && rawCompleted === undefined) {
    return res.status(400).json({ error: '請至少提供 title 或 completed' });
  }
  if (rawTitle !== undefined && typeof rawTitle !== 'string') {
    return res.status(400).json({ error: 'title 必須為字串' });
  }
  if (rawCompleted !== undefined && typeof rawCompleted !== 'boolean') {
    return res.status(400).json({ error: 'completed 必須為 boolean' });
  }

  const title = rawTitle !== undefined ? rawTitle.trim() : existing.title;
  const completed = rawCompleted !== undefined ? (rawCompleted ? 1 : 0) : existing.completed;

  // 只驗證本次送來的 title。既有資料若在規則上線前已存在，
  // 不應因為只更新 completed 就被擋下。
  if (rawTitle !== undefined) {
    if (!title) {
      return res.status(400).json({ error: 'title 不可為空' });
    }
    if (hasForbiddenChars(title)) {
      return res.status(400).json({ error: 'title 不可包含控制字元或不可見字元' });
    }
    if (isTitleTooLong(title)) {
      return res.status(400).json({ error: `title 不可超過 ${MAX_TITLE_LENGTH} 字元` });
    }
  }

  db.prepare('UPDATE todos SET title = ?, completed = ? WHERE id = ?').run(title, completed, id);
  const row = db.prepare('SELECT * FROM todos WHERE id = ?').get(id);
  res.json(serialize(row));
});

// DELETE /api/todos/:id - 刪除一筆待辦事項
router.delete('/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    return res.status(400).json({ error: 'id 必須為正整數' });
  }

  const info = db.prepare('DELETE FROM todos WHERE id = ?').run(id);
  if (info.changes === 0) {
    return res.status(404).json({ error: '找不到這筆待辦事項' });
  }
  res.status(204).end();
});

export default router;
