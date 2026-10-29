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

  test('POST 未帶 Content-Type 但有 body 回 415 JSON', async () => {
    const res = await api('POST', '/api/todos', { body: '{"title":"x"}' });

    expectJsonError(res, 415);
    expect(res.body.error).toBe('Content-Type 必須為 application/json');
  });

  test('PATCH 未帶 Content-Type 但有 body 回 415 JSON', async () => {
    const res = await api('PATCH', '/api/todos/1', { body: '{"completed":true}' });

    expectJsonError(res, 415);
    expect(res.body.error).toBe('Content-Type 必須為 application/json');
  });
});

describe('沒有 body 的寫入請求', () => {
  test('POST 帶 application/json 但沒有 body 回 400 JSON，不是 415', async () => {
    const res = await api('POST', '/api/todos', {
      headers: { 'Content-Type': 'application/json' },
    });

    expectJsonError(res, 400);
    expect(res.body.error).toBe('title 為必填欄位');
  });
});

describe('body 編碼', () => {
  test('非法 UTF-8 body 回 400 JSON，不會靜默變成 U+FFFD', async () => {
    const body = Buffer.concat([
      Buffer.from('{"title":"a'),
      Buffer.from([0xed, 0xa0, 0x80]), // 以 UTF-8 編碼的孤立代理字元，屬非法序列
      Buffer.from('b"}'),
    ]);

    const res = await api('POST', '/api/todos', {
      body,
      headers: { 'Content-Type': 'application/json' },
    });

    expectJsonError(res, 400);
    expect(res.body.error).toBe('請求 body 不是合法的 UTF-8');
  });
});

describe('錯誤優先序', () => {
  test('PATCH 不存在的 id + malformed JSON 回 400（parse 先於存在性）', async () => {
    const res = await api('PATCH', '/api/todos/999999', {
      body: '{"title": ',
      headers: { 'Content-Type': 'application/json' },
    });

    expectJsonError(res, 400);
    expect(res.body.error).toBe('請求 body 不是合法的 JSON');
  });

  test('PATCH 不存在的 id + 合法 JSON 但非法 schema 回 404（存在性先於 schema）', async () => {
    const res = await api('PATCH', '/api/todos/999999', {
      body: { completed: 'yes' },
    });

    expectJsonError(res, 404);
    expect(res.body.error).toBe('找不到這筆待辦事項');
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
