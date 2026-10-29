// Jest setupFiles：在任何測試模組被 import 之前執行。
// src/db.js 於 import 當下就讀取 NODE_ENV 決定 DB 路徑，所以必須先設定。
// 放在這裡而不是只寫在 package.json 的 script，確保 IDE、CI、直接呼叫 jest 都吃到同一層保護。
process.env.NODE_ENV = 'test';
