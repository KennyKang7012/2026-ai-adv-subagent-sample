// Jest 設定：以原生 ESM 模式執行（配合 package.json 的 "type": "module"）
// 執行方式見 package.json 的 test script：
//   NODE_OPTIONS=--experimental-vm-modules NODE_ENV=test jest
export default {
  testEnvironment: 'node',
  // 專案本身就是 ESM，不需要任何 transform
  transform: {},
  // 只收 tests/ 資料夾內的 *.test.js
  testMatch: ['**/tests/**/*.test.js'],
  clearMocks: true,
};
