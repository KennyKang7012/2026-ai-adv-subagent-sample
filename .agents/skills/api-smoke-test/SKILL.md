---
name: api-smoke-test
description: 對執行中的 To-Do List 伺服器執行 API 端對端 smoke 測試，依序驗證 health、新增、查詢、輸入驗證、標記完成與刪除等端點及 HTTP 狀態碼。當使用者要求快速確認 API、上線前 smoke check、部署後健康檢查或驗證 localhost:3000 的伺服器行為時使用。
---

# API Smoke Test

對真正執行中的 To-Do API 發送 HTTP request。不要把此流程當成 Jest 測試；Jest 使用 in-memory SQLite，而本 skill 驗證已啟動服務的整合行為。

## 執行

1. 確認使用者已啟動伺服器。不要自行啟動或修改程式。
2. 從專案根目錄執行：

```bash
bash .agents/skills/api-smoke-test/scripts/smoke.sh
```

若要改用其他目標網址，設定 `BASE_URL`：

```bash
BASE_URL=http://localhost:3000 bash .agents/skills/api-smoke-test/scripts/smoke.sh
```

## 判讀

- 逐項回報腳本輸出的 ✅／❌ 與 HTTP 狀態碼。
- exit code `0`：全部通過。
- exit code `1`：至少一個檢查失敗；列出失敗端點與實際狀態碼。
- exit code `2`：無法連線；提醒使用者先在專案根目錄執行 `npm start`，不要修改程式。

## 涵蓋範圍

- `GET /health`
- `POST /api/todos`：正常新增與空白 title 回 400
- `GET /api/todos`
- `PATCH /api/todos/:id`：標記完成
- `DELETE /api/todos/:id`：正常刪除與不存在 id 回 404
