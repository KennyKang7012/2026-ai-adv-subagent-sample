import { execFileSync } from 'node:child_process';
import db from '../src/db.js';

// 守護測試環境設定：若 jest.config.mjs 的 setupFiles 被移除，
// 或有人改了 src/db.js 的路徑判斷，這個測試會立刻失敗，
// 而不是等到某次執行把 data/todos.db 的資料清空才發現。
test('測試環境應使用 in-memory 資料庫', () => {
  expect(process.env.NODE_ENV).toBe('test');
  expect(db.name).toBe(':memory:');
});

test('Jest 執行中但 NODE_ENV 不是 test 時，應拒絕連線檔案資料庫', () => {
  const dbUrl = new URL('../src/db.js', import.meta.url).href;
  const env = { ...process.env, JEST_WORKER_ID: '1' };
  delete env.NODE_ENV;

  let stderr = '';
  try {
    execFileSync(
      process.execPath,
      ['--input-type=module', '-e', `import(${JSON.stringify(dbUrl)})`],
      { env, stdio: 'pipe' }
    );
  } catch (error) {
    stderr = String(error.stderr);
  }

  expect(stderr).toContain('NODE_ENV 不是 test');
});
