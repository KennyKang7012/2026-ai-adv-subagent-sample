import { Router } from 'express';
import db from '../db.js';

const router = Router();

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
  const title = (req.body?.title ?? '').trim();
  if (!title) {
    return res.status(400).json({ error: 'title 為必填欄位' });
  }

  const info = db.prepare('INSERT INTO todos (title) VALUES (?)').run(title);
  const row = db.prepare('SELECT * FROM todos WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(serialize(row));
});

// PATCH /api/todos/:id - 更新待辦事項（標題或完成狀態）
router.patch('/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM todos WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: '找不到這筆待辦事項' });
  }

  const title = req.body?.title !== undefined ? String(req.body.title).trim() : existing.title;
  const completed =
    req.body?.completed !== undefined ? (req.body.completed ? 1 : 0) : existing.completed;

  if (!title) {
    return res.status(400).json({ error: 'title 不可為空' });
  }

  db.prepare('UPDATE todos SET title = ?, completed = ? WHERE id = ?').run(title, completed, id);
  const row = db.prepare('SELECT * FROM todos WHERE id = ?').get(id);
  res.json(serialize(row));
});

// DELETE /api/todos/:id - 刪除一筆待辦事項
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const info = db.prepare('DELETE FROM todos WHERE id = ?').run(id);
  if (info.changes === 0) {
    return res.status(404).json({ error: '找不到這筆待辦事項' });
  }
  res.status(204).end();
});

export default router;
