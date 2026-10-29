# To-Do List 小工具（SubAgent 課綱範例）

使用 **Node.js + Express + SQLite（better-sqlite3）** 打造的簡易待辦事項工具，作為 SubAgent 課程的示範基底專案。

## 技術棧

- **後端**：Node.js (ESM) + Express 5
- **資料庫**：SQLite（透過 better-sqlite3）
- **前端**：原生 HTML / CSS / JavaScript（無框架）

## 專案結構

```
2026-ai-adv-subagent-sample/
├── package.json
├── data/                 # SQLite 資料庫檔案（自動產生，已 gitignore）
├── src/
│   ├── server.js         # Express 進入點
│   ├── db.js             # SQLite 連線與資料表初始化
│   └── routes/
│       └── todos.js      # To-Do REST API 路由
└── public/               # 前端靜態檔案
    ├── index.html
    ├── style.css
    └── app.js
```

## 安裝與啟動

```bash
# 安裝相依套件
npm install

# 啟動伺服器
npm start

# 開發模式（檔案變更時自動重啟）
npm run dev
```

啟動後開啟瀏覽器： http://localhost:3000

## API 一覽

| 方法   | 路徑              | 說明               |
| ------ | ----------------- | ------------------ |
| GET    | `/api/todos`      | 取得所有待辦事項   |
| POST   | `/api/todos`      | 新增待辦事項       |
| PATCH  | `/api/todos/:id`  | 更新標題或完成狀態 |
| DELETE | `/api/todos/:id`  | 刪除待辦事項       |

### 範例

```bash
# 新增
curl -X POST http://localhost:3000/api/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"準備 SubAgent 課綱"}'

# 查詢
curl http://localhost:3000/api/todos

# 標記完成
curl -X PATCH http://localhost:3000/api/todos/1 \
  -H "Content-Type: application/json" \
  -d '{"completed":true}'

# 刪除
curl -X DELETE http://localhost:3000/api/todos/1
```

## 驗證與錯誤回應

所有錯誤一律回 `application/json`，格式固定為 `{ "error": "..." }`，不會回傳 HTML 或 stack trace。

| 狀態碼 | 情境 |
| ------ | ---- |
| 400 | 欄位缺失、型別錯誤、title 空白／過長／含控制或不可見字元、id 格式錯誤、JSON 格式錯誤、body 不是合法的 UTF-8 |
| 404 | 路徑或待辦事項不存在 |
| 413 | 請求 body 超過 100 KB（`express.json()` 預設上限） |
| 415 | POST／PATCH 的 `Content-Type` 存在但型別不是 `application/json`，或帶 body 卻沒帶 header；charset／encoding 不支援 |
| 500 | 未預期例外（細節只寫入伺服器 log） |

請求依下列順序處理，先命中者先回：

1. 傳輸／解析：body 超過 100 KB → 413；JSON 語法錯誤 → 400；`Content-Type`／charset／encoding 不支援 → 415。
2. 路徑 id 格式錯誤 → 400。
3. 資源不存在 → 404。
4. body schema（欄位、型別、長度、字元）不合法 → 400。

因此 413、415 與 JSON 語法錯誤會先於 id 與存在性檢查；只有語法合法的 JSON 才會走到 404。

request body 必須是合法的 UTF-8（charset 為 `utf-8` 或未指定）。非法位元組回 400，不會靜默替換成 U+FFFD。

寫入規則：

- `POST /api/todos`
  - body 必須是 JSON 物件，只接受 `title` 一個欄位；未知欄位回 400。
  - `title` 必填、必須是字串；前後空白會 trim。
  - trim 後長度 1–200 個 Unicode code point（emoji 以 code point 計）。
  - 不可包含下列字元：
    - Unicode 類別 Cc（控制）、Cs（孤立代理字元）、Zl／Zp（行／段落分隔）。
    - 所有 Cf（格式字元），但 ZWNJ（U+200C）與 ZWJ（U+200D）例外。
    - 類別不是 Cf、但視覺上等於空白的字元：U+034F、U+115F、U+1160、U+2065、U+2800、U+3164、U+FFA0。
  - 允許一般空白、組合字元與 variation selector（例如 ❤️ 的 U+FE0F）。
  - 已知副作用：所有 Cf 都會被擋，包含阿拉伯數字記號、敘利亞縮寫記號、emoji tag 序列（如 🏴󠁧󠁢󠁳󠁣󠁴󠁿）等少數正常排版字元。
- `PATCH /api/todos/:id`
  - body 必須是 JSON 物件，只接受 `title`、`completed`，且至少要提供其中一個；未知欄位回 400。
  - `title` 規則同上；`completed` 必須是 boolean。
- `DELETE /api/todos/:id`
  - 路徑 id 必須是不含前導零的正整數（`1`、`2`…），否則回 400。
- `POST`／`PATCH` 的 `Content-Type` 若存在，media type 必須是 `application/json`（可附 `charset=utf-8`）；沒有 header 時，只要帶 body 也回 415。完全沒有 body 的請求不在此限，交由路由回 400（缺欄位）。

## 測試

```bash
npm test
```

Jest 會在任何測試模組載入前設定 `NODE_ENV=test`（`tests/setup-env.js`），`src/db.js` 因此使用 in-memory SQLite，不會讀寫 `data/todos.db`。若在 Jest 中卻偵測不到 `NODE_ENV=test`，`src/db.js` 會直接拋錯，避免誤清真實資料。

測試以 `tests/helpers/api.js` 在每個測試檔啟動一個長駐 server（`127.0.0.1` 隨機埠），再用 `node:http` 呼叫 API；不使用 supertest，原因見該檔開頭註解。

## 已知限制

- `GET /api/todos` 一次回傳全部資料，沒有分頁。
- 不支援的路徑或 method 一律回 404，不回 405。
- 沒有身分驗證、授權與 rate limiting。
- `PATCH /api/todos/:id` 在 JSON 語法合法的前提下，先檢查 id 是否存在（404），再驗證 body schema；因此「不存在的 id + 語法合法的非法 body」回 404。若 JSON 語法錯誤、body 過大或 `Content-Type` 不支援，會在進入路由前先回 400／413／415。
- `PATCH` 只驗證本次送出的 `title`。規則上線前已存在、含不可見字元或超過 200 字的舊資料，仍可更新 `completed`，不會被新規則擋下。
- 413 的門檻取自 `express.json()` 的預設上限；若日後調整 `limit`，測試與文件需同步。
- 嚴格 UTF-8 檢查只在 charset 為 `utf-8`（含未指定）時生效；`charset=utf-16le` 等其他編碼仍由 iconv 解碼，非法序列可能被替換成 U+FFFD。
- 本環境（Windows + Node 24 + better-sqlite3 12.x）曾觀察到偶發原生崩潰（`0xC0000409`）；最小重現不涉及本專案程式碼。worker 模式累計 150 次執行通過（預設 100 次、`maxWorkers=2`／`1` 各 25 次），但 `--runInBand` 明顯較不穩定，請避免使用。實測 better-sqlite3 13.0.3 仍有 1/20 單檔崩潰，升級無法解決；若 CI 仍遇到，建議改用 Node 22 LTS（未驗證）或在 CI 加 retry。
