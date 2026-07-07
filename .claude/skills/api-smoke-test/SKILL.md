---
name: api-smoke-test
description: 對「執行中的」To-Do List 伺服器做 API 端對端 smoke 測試——依序打 health、新增、查詢、驗證、標記完成、刪除等端點並檢查 HTTP 狀態碼。當使用者想「快速確認 API 還活著 / 上線前 smoke check / 驗證伺服器行為」時使用。需要伺服器已在 localhost:3000 執行。
---

# api-smoke-test

對「執行中的」To-Do API 做快速 smoke 測試。

這與專案的 Jest 單元測試**不同**：Jest 用 in-memory SQLite 測邏輯、不需啟動伺服器；本 Skill 是對「真正跑起來的伺服器」打真實 HTTP，做整合層級的健康檢查，適合上線前或部署後快速確認。

## 前置條件
伺服器需已啟動：在專案根目錄執行 `npm start`（預設 http://localhost:3000）。

## 執行方式
```bash
bash .claude/skills/api-smoke-test/scripts/smoke.sh
```
可用環境變數覆蓋目標網址：
```bash
BASE_URL=http://localhost:3000 bash .claude/skills/api-smoke-test/scripts/smoke.sh
```

## 判讀結果
- 腳本會逐項印出 ✅ / ❌ 與 HTTP 狀態碼，最後給「通過 / 失敗」統計。
- exit code：全數通過 `0`；有任一失敗 `1`；連不到伺服器 `2`。
- 若看到 exit `2`，提醒使用者先 `npm start` 再重跑，**不要**嘗試修改程式。

## 涵蓋端點
- `GET /health`
- `POST /api/todos`（正常新增，以及空白 title 應回 400）
- `GET /api/todos`
- `PATCH /api/todos/:id`（標記完成）
- `DELETE /api/todos/:id`（正常刪除，以及不存在 id 應回 404）
