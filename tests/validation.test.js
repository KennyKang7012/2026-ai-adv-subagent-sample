import { api } from './helpers/api.js';
import db from '../src/db.js';

const ZWSP = String.fromCodePoint(0x200b);

beforeEach(() => {
  db.exec('DELETE FROM todos');
});

async function createTodo(title = '既有事項') {
  const res = await api('POST', '/api/todos', { body: { title } });
  return res.body;
}

// 所有輸入錯誤都應是 400 + JSON，而不是 Express 預設的 HTML 錯誤頁
function expectJsonError(res, status) {
  expect(res.status).toBe(status);
  expect(res.headers['content-type']).toMatch(/application\/json/);
  expect(typeof res.body.error).toBe('string');
  expect(res.body.error.length).toBeGreaterThan(0);
}

describe('POST /api/todos：title 型別', () => {
  test.each([
    ['數字', 123],
    ['布林 false', false],
    ['物件', { a: 1 }],
    ['陣列', ['a']],
    ['null', null],
  ])('title 為 %s 時回 400 且不寫入', async (_label, title) => {
    const res = await api('POST', '/api/todos', { body: { title } });

    expectJsonError(res, 400);

    const list = await api('GET', '/api/todos');
    expect(list.body).toHaveLength(0);
  });
});

describe('PATCH /api/todos/:id：至少一個可更新欄位', () => {
  test.each([
    ['完全沒有 body', undefined, '請至少提供 title 或 completed'],
    ['空物件', {}, '請至少提供 title 或 completed'],
    ['只有未知欄位', { titel: 'typo' }, '不支援的欄位'],
    ['陣列 body', [1, 2], '請求 body 必須為 JSON 物件'],
  ])('%s 時回 400 且原資料不變', async (_label, body, expectedError) => {
    const todo = await createTodo('原標題');

    const res = await api(
      'PATCH',
      `/api/todos/${todo.id}`,
      body === undefined ? undefined : { body }
    );

    expectJsonError(res, 400);
    expect(res.body.error).toContain(expectedError);

    const list = await api('GET', '/api/todos');
    expect(list.body).toHaveLength(1);
    expect(list.body[0].title).toBe('原標題');
  });

  test('帶 application/json 但沒有 body 時回 400，不是 415', async () => {
    const todo = await createTodo('原標題');

    const res = await api('PATCH', `/api/todos/${todo.id}`, {
      headers: { 'Content-Type': 'application/json' },
    });

    expectJsonError(res, 400);

    const list = await api('GET', '/api/todos');
    expect(list.body).toHaveLength(1);
    expect(list.body[0].title).toBe('原標題');
  });
});

describe('PATCH 同時送多個欄位：任一欄位非法時整筆不變', () => {
  test.each([
    ['completed 型別錯誤', { title: '新標題', completed: 'yes' }],
    ['title 超長', { title: 'a'.repeat(201), completed: true }],
    ['title 含不可見字元', { title: `a${ZWSP}b`, completed: true }],
    ['未知欄位', { title: '新標題', completed: true, extra: 1 }],
  ])('%s 時回 400，title 與 completed 都不變', async (_label, body) => {
    const todo = await createTodo('原標題');

    const res = await api('PATCH', `/api/todos/${todo.id}`, { body });

    expectJsonError(res, 400);

    const list = await api('GET', '/api/todos');
    expect(list.body[0]).toMatchObject({ title: '原標題', completed: false });
  });
});

describe('title 長度上限 200 字元', () => {
  test('POST 剛好 200 字元可建立', async () => {
    const res = await api('POST', '/api/todos', { body: { title: 'a'.repeat(200) } });

    expect(res.status).toBe(201);
  });

  test('POST 201 字元回 400', async () => {
    const res = await api('POST', '/api/todos', { body: { title: 'a'.repeat(201) } });

    expectJsonError(res, 400);
    expect(res.body.error).toContain('200');
  });

  test('長度以 Unicode code point 計算：200 個 emoji 可建立', async () => {
    const res = await api('POST', '/api/todos', { body: { title: '😀'.repeat(200) } });

    expect(res.status).toBe(201);
  });

  test('trim 後才計長：前後空白的 200 字元可建立', async () => {
    const res = await api('POST', '/api/todos', {
      body: { title: `  ${'a'.repeat(200)}  ` },
    });

    expect(res.status).toBe(201);
  });

  test('PATCH 超過 200 字元回 400 且原標題不變', async () => {
    const todo = await createTodo('原標題');

    const res = await api('PATCH', `/api/todos/${todo.id}`, {
      body: { title: 'b'.repeat(201) },
    });

    expectJsonError(res, 400);

    const list = await api('GET', '/api/todos');
    expect(list.body[0].title).toBe('原標題');
  });
});

describe('PATCH /api/todos/:id：title 型別', () => {
  test.each([
    ['null', null],
    ['物件', { a: 1 }],
    ['陣列', [1, 2]],
    ['數字', 123],
  ])('title 為 %s 時回 400 且原標題不變', async (_label, title) => {
    const todo = await createTodo('原標題');

    const res = await api('PATCH', `/api/todos/${todo.id}`, { body: { title } });

    expectJsonError(res, 400);

    const list = await api('GET', '/api/todos');
    expect(list.body).toHaveLength(1);
    expect(list.body[0].title).toBe('原標題');
  });
});

describe('PATCH /api/todos/:id：completed 型別', () => {
  test.each([
    ['字串 "false"', 'false'],
    ['數字 0', 0],
    ['null', null],
    ['物件', {}],
  ])('completed 為 %s 時回 400 且狀態不變', async (_label, completed) => {
    const todo = await createTodo();

    const res = await api('PATCH', `/api/todos/${todo.id}`, { body: { completed } });

    expectJsonError(res, 400);

    const list = await api('GET', '/api/todos');
    expect(list.body[0].completed).toBe(false);
  });
});

describe('body 必須是 JSON 物件', () => {
  test.each([
    ['陣列', '[{"title":"a"}]'],
    ['頂層字串', '"hi"'],
  ])('POST body 為%s時回 400', async (_label, raw) => {
    const res = await api('POST', '/api/todos', {
      body: raw,
      headers: { 'Content-Type': 'application/json' },
    });

    expectJsonError(res, 400);
  });

  test('PATCH body 為陣列時回 400 且原資料不變', async () => {
    const todo = await createTodo('原標題');

    const res = await api('PATCH', `/api/todos/${todo.id}`, { body: [1, 2] });

    expectJsonError(res, 400);

    const list = await api('GET', '/api/todos');
    expect(list.body[0].title).toBe('原標題');
  });
});

describe('未知欄位', () => {
  test('POST 帶未知欄位回 400 且不寫入', async () => {
    const res = await api('POST', '/api/todos', {
      body: { title: '合法標題', titel: 'typo' },
    });

    expectJsonError(res, 400);
    expect(res.body.error).toContain('titel');

    const list = await api('GET', '/api/todos');
    expect(list.body).toHaveLength(0);
  });

  test('PATCH 帶未知欄位回 400 且原資料不變', async () => {
    const todo = await createTodo('原標題');

    const res = await api('PATCH', `/api/todos/${todo.id}`, {
      body: { title: '新標題', done: true },
    });

    expectJsonError(res, 400);
    expect(res.body.error).toContain('done');

    const list = await api('GET', '/api/todos');
    expect(list.body[0].title).toBe('原標題');
    expect(list.body[0].completed).toBe(false);
  });
});

describe('title 不可包含控制字元或不可見字元', () => {
  const cp = String.fromCodePoint;

  const forbiddenCases = [
    ['NUL', `a${cp(0x0000)}b`],
    ['換行', `a${cp(0x000a)}b`],
    ['C1 控制字元', `a${cp(0x0085)}b`],
    ['DEL', `a${cp(0x007f)}b`],
    ['soft hyphen', `a${cp(0x00ad)}b`],
    ['zero-width space', `a${cp(0x200b)}b`],
    ['word joiner', `a${cp(0x2060)}b`],
    ['BOM 內嵌', `a${cp(0xfeff)}b`],
    ['bidi：RTL override', `a${cp(0x202e)}b`],
    ['bidi：LRM', `a${cp(0x200e)}b`],
    ['bidi：RLM', `a${cp(0x200f)}b`],
    ['bidi：ALM', `a${cp(0x061c)}b`],
    ['bidi isolate', `a${cp(0x2066)}b`],
    ['line separator', `a${cp(0x2028)}b`],
    ['paragraph separator', `a${cp(0x2029)}b`],
    ['Braille pattern blank', cp(0x2800).repeat(2)],
    ['Hangul filler', `a${cp(0x3164)}b`],
    ['Hangul choseong filler', `a${cp(0x115f)}b`],
    ['Hangul jungseong filler', `a${cp(0x1160)}b`],
    ['halfwidth Hangul filler', `a${cp(0xffa0)}b`],
    ['combining grapheme joiner', `a${cp(0x034f)}b`],
    ['tag character', `a${cp(0xe0041)}b`],
    ['孤立代理字元', `a${cp(0xd800)}b`],
    ['整串 zero-width', cp(0x200b).repeat(2)],
  ];

  test.each(forbiddenCases)('POST title 含 %s 時回 400 且不寫入', async (_label, title) => {
    const res = await api('POST', '/api/todos', { body: { title } });

    expectJsonError(res, 400);
    expect(res.body.error).toContain('不可見字元');

    const list = await api('GET', '/api/todos');
    expect(list.body).toHaveLength(0);
  });

  test.each([
    ['bidi RLM', `a${cp(0x200f)}b`],
    ['line separator', `a${cp(0x2028)}b`],
    ['Braille pattern blank', cp(0x2800)],
  ])('PATCH title 含 %s 時回 400 且原標題不變', async (_label, title) => {
    const todo = await createTodo('原標題');

    const res = await api('PATCH', `/api/todos/${todo.id}`, { body: { title } });

    expectJsonError(res, 400);

    const list = await api('GET', '/api/todos');
    expect(list.body[0].title).toBe('原標題');
  });

  test('既有資料的 title 不合新規則時，仍可只更新 completed', async () => {
    const todo = await createTodo('舊資料');
    db.prepare('UPDATE todos SET title = ? WHERE id = ?').run(`a${cp(0x200b)}b`, todo.id);

    const res = await api('PATCH', `/api/todos/${todo.id}`, {
      body: { completed: true },
    });

    expect(res.status).toBe(200);
    expect(res.body.completed).toBe(true);
    expect(res.body.title).toBe(`a${cp(0x200b)}b`);
  });

  test.each([
    ['ZWNJ', `a${cp(0x200c)}b`],
    ['ZWJ 家庭 emoji', `${cp(0x1f468)}${cp(0x200d)}${cp(0x1f469)}${cp(0x200d)}${cp(0x1f467)}${cp(0x200d)}${cp(0x1f466)} 家庭`],
    ['variation selector-16', cp(0x2764, 0xfe0f)],
    ['組合字元', cp(0x0065, 0x0301)],
    ['一般空白', '買 牛奶'],
    ['全形空白', `買${cp(0x3000)}牛奶`],
  ])('%s 可建立且原樣保存', async (_label, title) => {
    const res = await api('POST', '/api/todos', { body: { title } });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe(title);
  });
});

describe('title 必須包含可見基底字元', () => {
  test.each([
    ['組合重音', String.fromCodePoint(0x0301)],
    ['包圍記號', String.fromCodePoint(0x20dd)],
    ['ZWJ', String.fromCodePoint(0x200d)],
    ['ZWNJ', String.fromCodePoint(0x200c)],
    ['variation selector-16', String.fromCodePoint(0xfe0f)],
    ['組合重音重複', String.fromCodePoint(0x0301, 0x0301)],
  ])('POST title 只有%s時回 400 且不寫入', async (_label, title) => {
    const res = await api('POST', '/api/todos', { body: { title } });

    expectJsonError(res, 400);
    expect(res.body.error).toBe('title 必須包含至少一個可見字元');

    const list = await api('GET', '/api/todos');
    expect(list.body).toHaveLength(0);
  });

  test('PATCH title 只有 ZWJ 時回 400 且原標題不變', async () => {
    const todo = await createTodo('原標題');

    const res = await api('PATCH', `/api/todos/${todo.id}`, {
      body: { title: String.fromCodePoint(0x200d) },
    });

    expectJsonError(res, 400);
    expect(res.body.error).toBe('title 必須包含至少一個可見字元');

    const list = await api('GET', '/api/todos');
    expect(list.body[0].title).toBe('原標題');
  });
});

describe('PATCH / DELETE：id 必須是正整數', () => {
  const invalidIds = [
    'abc',
    '0',
    '-1',
    '1.0',
    '0x10',
    '1e2',
    '007',
    '0001',
    '99999999999999999999',
    '9007199254740992',
  ];

  test.each(invalidIds)('PATCH /api/todos/%s 回 400', async (id) => {
    const res = await api('PATCH', `/api/todos/${id}`, { body: { completed: true } });

    expectJsonError(res, 400);
  });

  test.each(invalidIds)('DELETE /api/todos/%s 回 400', async (id) => {
    const res = await api('DELETE', `/api/todos/${id}`);

    expectJsonError(res, 400);
  });

  test('PATCH 的 id 為 MAX_SAFE_INTEGER 時回 404', async () => {
    const res = await api('PATCH', '/api/todos/9007199254740991', { body: { completed: true } });

    expectJsonError(res, 404);
    expect(res.body.error).toBe('找不到這筆待辦事項');
  });

  test('DELETE 的 id 為 MAX_SAFE_INTEGER 時回 404', async () => {
    const res = await api('DELETE', '/api/todos/9007199254740991');

    expectJsonError(res, 404);
    expect(res.body.error).toBe('找不到這筆待辦事項');
  });
});
