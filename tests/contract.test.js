import { api } from './helpers/api.js';
import db from '../src/db.js';

beforeEach(() => {
  db.exec('DELETE FROM todos');
});

async function createTodo(title = '既有事項') {
  const res = await api('POST', '/api/todos', { body: { title } });
  return res.body;
}

describe('回應契約', () => {
  test('GET 依建立時間與 id 由新到舊排序', async () => {
    await createTodo('A');
    await createTodo('B');
    await createTodo('C');

    const res = await api('GET', '/api/todos');

    expect(res.body.map((todo) => todo.title)).toEqual(['C', 'B', 'A']);
  });

  test('GET 的 completed 為 boolean true', async () => {
    const todo = await createTodo();
    await api('PATCH', `/api/todos/${todo.id}`, { body: { completed: true } });

    const res = await api('GET', '/api/todos');

    expect(res.body[0].completed).toBe(true);
  });

  test('PATCH 同時更新 title 與 completed', async () => {
    const todo = await createTodo('舊標題');

    const res = await api('PATCH', `/api/todos/${todo.id}`, {
      body: { title: '新標題', completed: true },
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: '新標題', completed: true });
  });

  test('POST 與 PATCH 會 trim 前後空白', async () => {
    const created = await api('POST', '/api/todos', { body: { title: '  買牛奶  ' } });
    expect(created.body.title).toBe('買牛奶');

    const updated = await api('PATCH', `/api/todos/${created.body.id}`, {
      body: { title: '  寫作業  ' },
    });
    expect(updated.body.title).toBe('寫作業');
  });

  test.each(['', '   '])('PATCH title 為 %p 時回 400 且原標題不變', async (title) => {
    const todo = await createTodo('原標題');

    const res = await api('PATCH', `/api/todos/${todo.id}`, { body: { title } });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('title 不可為空');

    const list = await api('GET', '/api/todos');
    expect(list.body[0].title).toBe('原標題');
  });

  test('POST title 為空字串回 400', async () => {
    const res = await api('POST', '/api/todos', { body: { title: '' } });

    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  test('DELETE 成功回 204 且 body 為空', async () => {
    const todo = await createTodo();

    const res = await api('DELETE', `/api/todos/${todo.id}`);

    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect(res.headers['content-type']).toBeUndefined();
  });

  test('GET / 回傳首頁 HTML', async () => {
    const res = await api('GET', '/');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
  });
});
