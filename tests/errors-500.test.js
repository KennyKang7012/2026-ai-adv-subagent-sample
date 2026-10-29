import { jest } from '@jest/globals';
import { api } from './helpers/api.js';
import db from '../src/db.js';

// 這個檔案刻意關閉 DB 來觸發未預期的例外。
// 每個測試各自確保 DB 已關閉，避免依賴測試執行順序。
beforeEach(() => {
  if (db.open) db.close();
});

function expect500(res, consoleError) {
  expect(res.status).toBe(500);
  expect(res.headers['content-type']).toMatch(/application\/json/);
  expect(res.body.error).toBe('伺服器內部錯誤');
  expect(res.text).not.toContain('node_modules');
  expect(res.text).not.toContain('Database');
  expect(consoleError).toHaveBeenCalled();
}

test('GET 的未預期例外回 500 JSON，且不洩漏 stack 或內部路徑', async () => {
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

  const res = await api('GET', '/api/todos');

  expect500(res, consoleError);

  consoleError.mockRestore();
});

test('POST 的未預期例外同樣回 500 JSON', async () => {
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

  const res = await api('POST', '/api/todos', { body: { title: 'x' } });

  expect500(res, consoleError);

  consoleError.mockRestore();
});

test('PATCH 的未預期例外同樣回 500 JSON', async () => {
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

  const res = await api('PATCH', '/api/todos/1', { body: { completed: true } });

  expect500(res, consoleError);

  consoleError.mockRestore();
});

test('DELETE 的未預期例外同樣回 500 JSON', async () => {
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

  const res = await api('DELETE', '/api/todos/1');

  expect500(res, consoleError);

  consoleError.mockRestore();
});
