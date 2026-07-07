# To-Do List 小工具（SubAgent 課綱範例）

使用 **Node.js + Express + SQLite（better-sqlite3）** 打造的簡易待辦事項工具，作為 SubAgent 課程的示範基底專案。

## 技術棧

- **後端**：Node.js (ESM) + Express 5
- **資料庫**：SQLite（透過 better-sqlite3）
- **前端**：原生 HTML / CSS / JavaScript（無框架）

## 專案結構

```
01-sample/
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
