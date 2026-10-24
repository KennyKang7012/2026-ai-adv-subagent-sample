import { api } from './helpers/api.js';

// 最小 smoke test：確認 Jest 工具鏈可正常執行。
// 完整的 todos API / db 測試留給 test-writer SubAgent 示範補齊。
describe('GET /health', () => {
  test('回傳 200 與 { status: "ok" }', async () => {
    const res = await api('GET', '/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
