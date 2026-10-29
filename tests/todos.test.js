import { api } from './helpers/api.js';
import db from '../src/db.js';

// 每個測試前清空 todos 資料表，避免 in-memory SQLite 資料在測試間互相污染
beforeEach(() => {
  db.exec('DELETE FROM todos');
});

describe('GET /api/todos', () => {
  test('資料表為空時回傳空陣列', async () => {
    const res = await api('GET', '/api/todos');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('有資料時回傳包含該筆待辦事項的陣列', async () => {
    await api('POST', '/api/todos', { body: { title: '買牛奶' } });

    const res = await api('GET', '/api/todos');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ title: '買牛奶', completed: false });
  });

  test('不解析 request body：malformed JSON 不影響查詢', async () => {
    const body = '{"broken": ';
    const res = await api('GET', '/api/todos', {
      body,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': String(Buffer.byteLength(body)),
      },
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('POST /api/todos', () => {
  test('提供合法 title 時新增成功，回傳 201 與正確欄位', async () => {
    const res = await api('POST', '/api/todos', { body: { title: '寫作業' } });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(
      expect.objectContaining({
        id: expect.any(Number),
        title: '寫作業',
        completed: false,
        created_at: expect.any(String),
      })
    );
  });

  test('title 為空白字串時回傳 400', async () => {
    const res = await api('POST', '/api/todos', { body: { title: '  ' } });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('未提供 title 欄位時回傳 400', async () => {
    const res = await api('POST', '/api/todos', { body: {} });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});

describe('PATCH /api/todos/:id', () => {
  async function createTodo(title = '待完成的事') {
    const res = await api('POST', '/api/todos', { body: { title } });
    return res.body;
  }

  test('可切換 completed 狀態（false -> true）', async () => {
    const todo = await createTodo();

    const res = await api('PATCH', `/api/todos/${todo.id}`, {
      body: { completed: true },
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: todo.id, completed: true, title: todo.title });
  });

  test('可切換 completed 狀態（true -> false），且持久化', async () => {
    const todo = await createTodo();
    await api('PATCH', `/api/todos/${todo.id}`, { body: { completed: true } });

    const res = await api('PATCH', `/api/todos/${todo.id}`, { body: { completed: false } });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: todo.id, completed: false });

    const list = await api('GET', '/api/todos');
    expect(list.body[0].completed).toBe(false);
  });

  test('可更新 title 內容', async () => {
    const todo = await createTodo('舊標題');

    const res = await api('PATCH', `/api/todos/${todo.id}`, {
      body: { title: '新標題' },
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: todo.id, title: '新標題', completed: false });
  });

  test('更新 title 後 GET 取得新標題', async () => {
    const todo = await createTodo('舊標題');
    await api('PATCH', `/api/todos/${todo.id}`, { body: { title: '新標題' } });

    const list = await api('GET', '/api/todos');
    expect(list.body[0].title).toBe('新標題');
  });

  test('只更新 title 時保留 completed=true', async () => {
    const todo = await createTodo('舊標題');
    await api('PATCH', `/api/todos/${todo.id}`, { body: { completed: true } });

    const res = await api('PATCH', `/api/todos/${todo.id}`, { body: { title: '新標題' } });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: todo.id, title: '新標題', completed: true });

    const list = await api('GET', '/api/todos');
    expect(list.body[0]).toMatchObject({ title: '新標題', completed: true });
  });

  test('更新不存在的 id 時回傳 404', async () => {
    const res = await api('PATCH', '/api/todos/999999', { body: { completed: true } });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });
});

describe('DELETE /api/todos/:id', () => {
  test('刪除成功回傳 204，且該筆資料不再出現於 GET 結果中', async () => {
    const createRes = await api('POST', '/api/todos', { body: { title: '要被刪除的事' } });
    const { id } = createRes.body;

    const deleteRes = await api('DELETE', `/api/todos/${id}`);
    expect(deleteRes.status).toBe(204);

    const listRes = await api('GET', '/api/todos');
    expect(listRes.body.find((todo) => todo.id === id)).toBeUndefined();
  });

  test('刪除不存在的 id 時回傳 404', async () => {
    const res = await api('DELETE', '/api/todos/999999');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  test('刪除其中一筆不影響其他筆', async () => {
    const a = await api('POST', '/api/todos', { body: { title: 'A' } }).then((r) => r.body);
    const b = await api('POST', '/api/todos', { body: { title: 'B' } }).then((r) => r.body);

    const deleteRes = await api('DELETE', `/api/todos/${a.id}`);
    expect(deleteRes.status).toBe(204);

    const listRes = await api('GET', '/api/todos');
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0]).toMatchObject({ id: b.id, title: 'B' });
  });

  test('不解析 request body：malformed JSON 仍可刪除', async () => {
    const created = await api('POST', '/api/todos', { body: { title: '要被刪除的事' } });
    const { id } = created.body;
    const body = '{"broken": ';

    const deleteRes = await api('DELETE', `/api/todos/${id}`, {
      body,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': String(Buffer.byteLength(body)),
      },
    });

    expect(deleteRes.status).toBe(204);

    const listRes = await api('GET', '/api/todos');
    expect(listRes.body.find((todo) => todo.id === id)).toBeUndefined();
  });

  test('重複刪除同一 id，第二次回 404 且其他資料不變', async () => {
    const a = await api('POST', '/api/todos', { body: { title: 'A' } }).then((r) => r.body);
    const b = await api('POST', '/api/todos', { body: { title: 'B' } }).then((r) => r.body);

    expect((await api('DELETE', `/api/todos/${a.id}`)).status).toBe(204);

    const second = await api('DELETE', `/api/todos/${a.id}`);
    expect(second.status).toBe(404);
    expect(second.body.error).toBe('找不到這筆待辦事項');

    const listRes = await api('GET', '/api/todos');
    expect(listRes.body.map((todo) => todo.id)).toEqual([b.id]);
  });
});
