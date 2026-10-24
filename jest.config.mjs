// Jest 設定：以原生 ESM 模式執行（配合 package.json 的 "type": "module"）
// 執行方式見 package.json 的 test script（跨平台，不依賴 POSIX 的環境變數前綴）：
//   node --experimental-vm-modules node_modules/jest/bin/jest.js
export default {
  testEnvironment: 'node',
  // 專案本身就是 ESM，不需要任何 transform
  transform: {},
  // 只收 tests/ 資料夾內的 *.test.js
  testMatch: ['**/tests/**/*.test.js'],
  // 在任何測試模組被 import 前設定 NODE_ENV=test，
  // 讓 src/db.js 使用 :memory:，不會連到真實的 data/todos.db
  setupFiles: ['<rootDir>/tests/setup-env.js'],
  clearMocks: true,
};
