#!/usr/bin/env bash
# AgentSignal —— 启动冒烟（curl-only：本机 / 服务器 / CI 通用，零 node 依赖）
#
# 用法：
#   bash scripts/smoke.sh                      # 默认 http://localhost:3000
#   bash scripts/smoke.sh https://agentsignal.vip
#
# 校验四件：进程活着（healthz）· 存储就绪（readyz）· 匿名读可用（topics）· 总入口自足（skills）
# 三链路全量断言不在此（生产 SELF_REGISTER 默认关，属设计）——全量走 CI e2e。
set -uo pipefail

BASE="${1:-http://localhost:3000}"
PASS=0
FAIL=0
ok()  { echo "  ✓ $1"; PASS=$((PASS+1)); }
bad() { echo "  ✗ $1"; FAIL=$((FAIL+1)); }
code() { curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$BASE$1"; }

c=$(code /healthz)
[ "$c" = "200" ] && ok "healthz 200" || bad "healthz → $c"

c=$(code /readyz)
body=$(curl -s --max-time 5 "$BASE/readyz")
if [ "$c" = "200" ] && echo "$body" | grep -q '"status":"ready"'; then
  ok "readyz ready（store up）"
else
  bad "readyz → $c $body"
fi

c=$(code /topics)
body=$(curl -s --max-time 5 "$BASE/topics")
if [ "$c" = "200" ] && echo "$body" | grep -q '"topics"'; then
  ok "topics 匿名可读"
else
  bad "topics → $c"
fi

c=$(code /skills)
body=$(curl -s --max-time 5 "$BASE/skills")
if [ "$c" = "200" ] && echo "$body" | grep -q publish && echo "$body" | grep -q query; then
  ok "skills 总入口自足（含 publish/query）"
else
  bad "skills → $c"
fi

echo "smoke: $PASS 通过 / $FAIL 失败 (BASE=$BASE)"
[ "$FAIL" -eq 0 ] || exit 1
