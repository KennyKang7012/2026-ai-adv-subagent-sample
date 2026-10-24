import { jest } from '@jest/globals';
import { api } from './helpers/api.js';
import db from '../src/db.js';

// 這個檔案刻意關閉 DB 來觸發未預期的例外。
// Jest 對每個 test 檔隔離 module registry，所以不會影響其他檔案的 db 實例。
test('未預期的例外回 500 JSON，且不洩漏 stack 或內部路徑', async () => {
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  db.close();

  const res = await api('GET', '/api/todos');

  expect(res.status).toBe(500);
  expect(res.headers['content-type']).toMatch(/application\/json/);
  expect(res.body.error).toBe('伺服器內部錯誤');
  expect(res.text).not.toContain('node_modules');
  expect(res.text).not.toContain('Database');
  expect(consoleError).toHaveBeenCalled();

  consoleError.mockRestore();
});

test('POST 的未預期例外同樣回 500 JSON', async () => {
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

  // 上一個測試已關閉 db，這裡直接重用關閉狀態觸發例外
  const res = await api('POST', '/api/todos', { body: { title: 'x' } });

  expect(res.status).toBe(500);
  expect(res.headers['content-type']).toMatch(/application\/json/);
  expect(res.body.error).toBe('伺服器內部錯誤');
  expect(res.text).not.toContain('node_modules');

  consoleError.mockRestore();
});
