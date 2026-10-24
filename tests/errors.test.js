import { api } from './helpers/api.js';

function expectJsonError(res, status) {
  expect(res.status).toBe(status);
  expect(res.headers['content-type']).toMatch(/application\/json/);
  expect(typeof res.body.error).toBe('string');
  expect(res.body.error.length).toBeGreaterThan(0);
}

describe('全域錯誤處理', () => {
  test('malformed JSON 回 400 JSON，且不洩漏 stack 或內部路徑', async () => {
    const res = await api('POST', '/api/todos', {
      body: '{"title": ',
      headers: { 'Content-Type': 'application/json' },
    });

    expectJsonError(res, 400);
    expect(res.body.error).toBe('請求 body 不是合法的 JSON');
    expect(res.text).not.toContain('SyntaxError');
    expect(res.text).not.toContain('node_modules');
  });

  test('body 超過 100kb 回 413 JSON', async () => {
    const res = await api('POST', '/api/todos', {
      body: { title: 'a'.repeat(200 * 1024) },
    });

    expectJsonError(res, 413);
    expect(res.body.error).toBe('請求 body 過大');
  });
});

describe('Content-Type／Content-Encoding 不支援', () => {
  test('POST 使用不支援的 charset 回 415 JSON', async () => {
    const res = await api('POST', '/api/todos', {
      body: '{"title":"x"}',
      headers: { 'Content-Type': 'application/json; charset=koi8-r' },
    });

    expectJsonError(res, 415);
  });

  test('POST 使用不支援的 Content-Encoding 回 415 JSON', async () => {
    const res = await api('POST', '/api/todos', {
      body: { title: 'x' },
      headers: { 'Content-Encoding': 'compress' },
    });

    expectJsonError(res, 415);
  });

  test('POST 使用 text/plain 回 415 JSON', async () => {
    const res = await api('POST', '/api/todos', {
      body: '{"title":"x"}',
      headers: { 'Content-Type': 'text/plain' },
    });

    expectJsonError(res, 415);
  });

  test('PATCH 使用 text/plain 回 415 JSON', async () => {
    const res = await api('PATCH', '/api/todos/1', {
      body: '{"completed":true}',
      headers: { 'Content-Type': 'text/plain' },
    });

    expectJsonError(res, 415);
  });
});

describe('404 處理', () => {
  test('未知 API 路徑回 404 JSON', async () => {
    const res = await api('GET', '/api/unknown');

    expectJsonError(res, 404);
  });

  test('不支援的 method 回 404 JSON', async () => {
    const res = await api('PUT', '/api/todos/1', { body: { title: 'x' } });

    expectJsonError(res, 404);
  });

  test('不存在的靜態資源回 404 JSON', async () => {
    const res = await api('GET', '/missing.css');

    expectJsonError(res, 404);
  });
});
