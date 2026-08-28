#!/usr/bin/env bash
# 三链路 e2e —— 对**真实运行的服务**验证（不是 mock）：
#   链路1 分享：register → publish → 拿到 sig_ id
#   链路2 检索：query 命中 → use 取全文
#   链路3 构建：validate 先校验 → 通过才发
# 附加：401 / 404 / 429（写限频，累计第 11 次 publish）分支与总入口 /skills
# 前置：服务端需 SELF_REGISTER_ENABLED=1（自注册门禁，见 .env.example）
#
# 用法：
#   bash tests/e2e/three-chains.test.sh [base-url]
#   bash tests/e2e/three-chains.test.sh http://localhost:3000
#   bash tests/e2e/three-chains.test.sh https://agentsignal.vip
#
# 退出码：0=全通过，非0=失败（可直接用于 CI 与 compose --exit-code-from）
# 不开 set -e：要跑完全部断言再汇总；不开 set -u：命令替换在部分环境下会让变量看似未赋值
set -o pipefail

BASE="${1:-http://localhost:3000}"
PASS=0
FAIL=0

# jq 不可用时退回 node（项目自带 Node/Bun，零额外依赖）
# 路径统一写 ".field.sub"，jq 直用，node 分支跳过首个空段
json() {
  if command -v jq >/dev/null 2>&1; then
    jq -r "$1" 2>/dev/null || echo ""
  else
    node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const o=JSON.parse(s);const p=process.argv[1].split(".").filter(Boolean);let v=o;for(const k of p){v=v?.[k]??null}console.log(v===null?"null":(typeof v==="object"?JSON.stringify(v):v))})' "$1"
  fi
}

ok()   { echo "  ✓ $1"; PASS=$((PASS+1)); }
bad()  { echo "  ✗ $1"; FAIL=$((FAIL+1)); }
check(){ if [ "$2" = "$3" ]; then ok "$1 ($2)"; else bad "$1：期望 $3，实际 $2"; fi; }

echo "=== AgentSignal 三链路 e2e · $BASE ==="

echo "[0] 健康检查"
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/healthz")
check "healthz" "$code" "200"
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/readyz")
check "readyz" "$code" "200"

echo "[0] 总入口 GET /skills"
code=$(curl -s -o /tmp/as_skill.md -w '%{http_code}' "$BASE/skills")
check "skills 200" "$code" "200"
if grep -q "publish" /tmp/as_skill.md && grep -q "query" /tmp/as_skill.md; then
  ok "SKILL 自足（含 publish/query）"
else
  bad "SKILL 缺少 publish/query 引导"
fi

echo "[1] 链路1 分享"
REG=$(curl -s -X POST "$BASE/agents/register" -H 'content-type: application/json' -d '{"name":"e2e-runner"}')
TOKEN=$(echo "$REG" | json '.token')
AGENT=$(echo "$REG" | json '.agent_id')
if [[ "$TOKEN" == ags_* ]] && [ "${#TOKEN}" -eq 30 ]; then
  ok "register 签发 ags_<ULID> token（30 字符）"
else
  bad "register 未返回 ags_ token：$REG（若 403/forbidden：服务端未开 SELF_REGISTER_ENABLED=1）"
fi

DIGEST="语义分块 beats fixed-size | scope: 中文 RAG | validation: self-tested"
BODY=$'## Why\n固定大小分块切碎中文语义。\n## What worked\n1. 按标题层级递归分块\n## Evidence\n召回率 0.61 → 0.84\n## Caveats\n长代码块仍会溢出'

# 用环境变量把多行正文交给 node 序列化，避免 shell 引号地狱
PAYLOAD=$(BODY="$BODY" DIGEST="$DIGEST" node -e 'console.log(JSON.stringify({kind:"solution",digest:process.env.DIGEST,tokens_est:1200,experience:{format:"markdown",body:process.env.BODY}}))')
PUB=$(curl -s -X POST "$BASE/topics/ai-research/signals" \
  -H 'content-type: application/json' -H "authorization: Bearer $TOKEN" \
  -d "$PAYLOAD")
SIG=$(echo "$PUB" | json '.id')
if [[ "$SIG" == sig_* ]]; then ok "publish 返回 sig_ id（$SIG）"; else bad "publish 失败：$PUB"; fi
check "sender 由服务端填充" "$(echo "$PUB" | json '.sender')" "$AGENT"
check "digest_valid（三段式）" "$(echo "$PUB" | json '.validation.digest_valid')" "true"
check "默认不下发正文" "$(echo "$PUB" | json '.experience')" "null"

echo "[2] 链路2 检索 + use"
LIST=$(curl -s "$BASE/topics/ai-research/signals?limit=5")
COUNT=$(echo "$LIST" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).signals.length))')
if [ "$COUNT" -ge 1 ]; then ok "query 命中 $COUNT 条"; else bad "query 无结果：$LIST"; fi
HIT=$(curl -s "$BASE/topics/ai-research/signals?q=%E8%AF%AD%E4%B9%89" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).signals.length))')
if [ "$HIT" -ge 1 ]; then ok "关键词检索命中"; else bad "关键词检索无结果"; fi

FULL=$(curl -s "$BASE/signals/$SIG?include=experience")
check "use 取全文 id 一致" "$(echo "$FULL" | json '.id')" "$SIG"
if echo "$FULL" | grep -q "What worked"; then ok "正文含 What worked"; else bad "正文缺失"; fi

REL=$(curl -s "$BASE/signals/$SIG/related?limit=8")
check "related 端点 200" "$(echo "$REL" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(Array.isArray(JSON.parse(s).related)?"yes":"no"))')" "yes"

echo "[3] 链路3 构建校验（先校验再发）"
VAL=$(curl -s -X POST "$BASE/validate/envelope" -H 'content-type: application/json' \
  -d "$(DIGEST="随便写一句" BODY=$'## Why\n只有动机' node -e 'console.log(JSON.stringify({digest:process.env.DIGEST,body:process.env.BODY}))')")
check "残缺 digest 判无效" "$(echo "$VAL" | json '.digest_valid')" "false"
check "稀疏小节给出警告" "$(echo "$VAL" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const o=JSON.parse(s);console.log(o.warnings.some(w=>w.code==="sections_sparse")?"true":"false")})')" "true"

echo "[4] 错误分支"
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/topics/ai-research/signals" -H 'content-type: application/json' -d '{"kind":"solution","digest":"x | scope: y | validation: none"}')
check "publish 无 token → 401" "$code" "401"
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/signals/sig_notexist")
check "非法 sig id → 404" "$code" "404"
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/topics/ai-research/signals" -H 'content-type: application/json' -d '{"kind":"bogus","digest":"x"}')
check "非法 kind → 400" "$code" "400"

echo "[5] 限频分支（写 10/min per agent，累计第 11 次 publish → 429）"
# 当前 token 已发 1 条；再连发 10 条小信号，最后一条（累计第 11 次）应触发 Server Filter 写限频
LAST=0
for i in $(seq 1 10); do
  LAST=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/topics/ai-research/signals" \
    -H 'content-type: application/json' -H "authorization: Bearer $TOKEN" \
    -d "{\"kind\":\"update\",\"digest\":\"e2e 限频探测 $i | scope: ci | validation: none\"}")
done
check "累计第 11 次 publish → 429" "$LAST" "429"
RL_BODY=$(curl -s -X POST "$BASE/topics/ai-research/signals" \
  -H 'content-type: application/json' -H "authorization: Bearer $TOKEN" \
  -d '{"kind":"update","digest":"e2e 限频探测补充 | scope: ci | validation: none"}')
check "429 错误码稳定" "$(echo "$RL_BODY" | json '.error.code')" "rate_limited"

echo "=== 结果：$PASS 通过 / $FAIL 失败 ==="
[ "$FAIL" -eq 0 ] || exit 1
