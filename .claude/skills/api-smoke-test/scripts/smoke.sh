#!/usr/bin/env bash
# api-smoke-test：對執行中的 To-Do API 做端對端 smoke 測試。
# 用法： bash smoke.sh   （可用 BASE_URL 覆蓋目標網址）
set -u

BASE_URL="${BASE_URL:-http://localhost:3000}"
pass=0
fail=0

check() {
  local name="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    printf '  ✅ %s (HTTP %s)\n' "$name" "$actual"
    pass=$((pass + 1))
  else
    printf '  ❌ %s (預期 %s，實際 %s)\n' "$name" "$expected" "$actual"
    fail=$((fail + 1))
  fi
}

status() {
  # 只回傳 HTTP 狀態碼
  curl -s -o /dev/null -w '%{http_code}' "$@"
}

printf '▶ 目標： %s\n\n' "$BASE_URL"

# 0) 先確認伺服器有起來
if [ "$(status "$BASE_URL/health")" != "200" ]; then
  printf '❌ 無法連線到 %s\n   請先在專案根目錄執行 "npm start" 再重跑。\n' "$BASE_URL"
  exit 2
fi

# 1) health
check "GET /health" 200 "$(status "$BASE_URL/health")"

# 2) 新增（單次 POST 同時取回 body 與狀態碼，避免多留一筆資料）
resp="$(curl -s -w '\n%{http_code}' -X POST "$BASE_URL/api/todos" \
  -H 'Content-Type: application/json' \
  -d '{"title":"smoke-test 項目"}')"
create_code="${resp##*$'\n'}"   # 最後一行 = HTTP 狀態碼
create_body="${resp%$'\n'*}"    # 其餘 = 回傳的 JSON body
check "POST /api/todos 新增" 201 "$create_code"
id="$(printf '%s' "$create_body" | grep -o '"id":[0-9]*' | head -n1 | grep -o '[0-9]*')"

# 3) 查詢清單
check "GET /api/todos 查詢" 200 "$(status "$BASE_URL/api/todos")"

# 4) 空白 title 應被拒絕
check "POST 空白 title 應為 400" 400 \
  "$(status -X POST "$BASE_URL/api/todos" -H 'Content-Type: application/json' -d '{"title":"   "}')"

# 5) 標記完成
if [ -n "${id:-}" ]; then
  check "PATCH /api/todos/$id 完成" 200 \
    "$(status -X PATCH "$BASE_URL/api/todos/$id" -H 'Content-Type: application/json' -d '{"completed":true}')"
  # 6) 刪除
  check "DELETE /api/todos/$id" 204 "$(status -X DELETE "$BASE_URL/api/todos/$id")"
else
  printf '  ⚠️  無法解析新增回傳的 id，略過 PATCH / DELETE\n'
  fail=$((fail + 1))
fi

# 7) 刪除不存在的 id 應為 404
check "DELETE 不存在 id 應為 404" 404 "$(status -X DELETE "$BASE_URL/api/todos/999999")"

printf '\n─────────────────────────────\n'
printf '結果：通過 %s，失敗 %s\n' "$pass" "$fail"
if [ "$fail" -eq 0 ]; then
  printf '🎉 全部通過\n'
  exit 0
else
  printf '⚠️  有測試失敗\n'
  exit 1
fi
