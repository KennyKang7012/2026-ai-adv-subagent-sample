#!/usr/bin/env bash
# 對執行中的 To-Do API 做端對端 smoke 測試。
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
  curl -s -o /dev/null -w '%{http_code}' "$@"
}

printf '▶ 目標： %s\n\n' "$BASE_URL"

if [ "$(status "$BASE_URL/health")" != "200" ]; then
  printf '❌ 無法連線到 %s\n   請先在專案根目錄執行 "npm start" 再重跑。\n' "$BASE_URL"
  exit 2
fi

check "GET /health" 200 "$(status "$BASE_URL/health")"

resp="$(curl -s -w '\n%{http_code}' -X POST "$BASE_URL/api/todos" \
  -H 'Content-Type: application/json' \
  -d '{"title":"smoke-test 項目"}')"
create_code="${resp##*$'\n'}"
create_body="${resp%$'\n'*}"
check "POST /api/todos 新增" 201 "$create_code"
id="$(printf '%s' "$create_body" | grep -o '"id":[0-9]*' | head -n1 | grep -o '[0-9]*')"

check "GET /api/todos 查詢" 200 "$(status "$BASE_URL/api/todos")"
check "POST 空白 title 應為 400" 400 \
  "$(status -X POST "$BASE_URL/api/todos" -H 'Content-Type: application/json' -d '{"title":"   "}')"

if [ -n "${id:-}" ]; then
  check "PATCH /api/todos/$id 完成" 200 \
    "$(status -X PATCH "$BASE_URL/api/todos/$id" -H 'Content-Type: application/json' -d '{"completed":true}')"
  check "DELETE /api/todos/$id" 204 "$(status -X DELETE "$BASE_URL/api/todos/$id")"
else
  printf '  ⚠️  無法解析新增回傳的 id，略過 PATCH / DELETE\n'
  fail=$((fail + 1))
fi

check "DELETE 不存在 id 應為 404" 404 "$(status -X DELETE "$BASE_URL/api/todos/999999")"

printf '\n─────────────────────────────\n'
printf '結果：通過 %s，失敗 %s\n' "$pass" "$fail"
if [ "$fail" -eq 0 ]; then
  printf '🎉 全部通過\n'
  exit 0
fi

printf '⚠️  有測試失敗\n'
exit 1
