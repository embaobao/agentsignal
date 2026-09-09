#!/usr/bin/env bash
# 打包发布验证 —— 模拟"真实环境使用 CLI"：
#   1. pnpm pack @agentssignal/protocol + @agentssignal/cli（workspace:* 自动替换为实版本）
#   2. 临时沙箱 npm install 两个 tgz（= 未来用户 npm install -g 的等价物）
#   3. 沙箱 CLI 打**正在运行的真实 API** 走完整链路：register → publish → query → use
#
# 前置：API 已在 $AGENTSIGNAL_BASE（默认 http://localhost:3000）运行。
# 产物：dist/pack/*.tgz（发布前人工/CI 复核）。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PACK_DIR="$ROOT/dist/pack"
BASE="${AGENTSIGNAL_BASE:-http://localhost:3000}"
mkdir -p "$PACK_DIR"

step() { printf "\n\033[1;32m[%s]\033[0m %s\n" "$1" "$2"; }

step "1/5" "打包（pnpm pack：workspace:* → 实版本）"
( cd "$ROOT/packages/protocol" && pnpm pack --pack-destination "$PACK_DIR" >&2 )
( cd "$ROOT/packages/cli" && pnpm pack --pack-destination "$PACK_DIR" >&2 )
PRO_TGZ="$PACK_DIR/agentsignal-protocol-$(
  node -e "console.log(require('$ROOT/packages/protocol/package.json').version)").tgz"
CLI_TGZ="$PACK_DIR/agentsignal-cli-$(
  node -e "console.log(require('$ROOT/packages/cli/package.json').version)").tgz"
# pnpm v10 pack 产物可见性怪异（精确路径 ls/-f 偶发 ENOENT，glob 与后续 npm install 均可见）：
# 以 glob 探测 + 沙箱安装为真验收
# pnpm v10 pack 落盘可见性有延迟（实测最长 30s+），轮询等待；条件上下文避免 set -e 误杀
PRO_GLOB=""
CLI_GLOB=""
for _ in $(seq 1 60); do
  PRO_GLOB="$(ls "$PACK_DIR"/agentsignal-protocol-*.tgz 2>/dev/null | tail -1 || true)"
  CLI_GLOB="$(ls "$PACK_DIR"/agentsignal-cli-*.tgz 2>/dev/null | tail -1 || true)"
  if [ -n "$PRO_GLOB" ] && [ -n "$CLI_GLOB" ]; then break; fi
  sleep 1
done
if [ -z "$PRO_GLOB" ] || [ -z "$CLI_GLOB" ]; then
  echo "pack 产物缺失（glob 探测为空）" >&2
  ls -la "$PACK_DIR" >&2 || true
  exit 1
fi
step "2/5" "沙箱安装（npm install 两个 tgz）"
SANDBOX="$(mkdtemp -d 2>/dev/null || mktemp -d)"
echo "{\"name\":\"sandbox\",\"private\":true}" > "$SANDBOX/package.json"
( cd "$SANDBOX" && npm install --no-audit --no-fund "$PRO_GLOB" "$CLI_GLOB" >/dev/null 2>&1 ) \
  || { echo "npm install 失败"; exit 1; }
[ -x "$SANDBOX/node_modules/.bin/agentsignal" ] || { echo "bin 未安装"; exit 1; }
echo "sandbox: $SANDBOX"

step "3/5" "沙箱 CLI · register（HOME 隔离，不碰真实凭证）"
export HOME="$SANDBOX"
export AGENTSIGNAL_BASE="$BASE"
RUN="$SANDBOX/node_modules/.bin/agentsignal"
REG_OUT="$($RUN register --name pack-verify-$$)"
TOKEN="$(echo "$REG_OUT" | grep -o 'ags_[A-Z0-9]*' | head -1)"
[ -n "$TOKEN" ] || { echo "register 失败：$REG_OUT"; exit 1; }
echo "token ✓（${#TOKEN} 字符）"

step "4/5" "沙箱 CLI · publish → query → use（打真实 API）"
BODY="$SANDBOX/body.md"
cat > "$BODY" <<'MD'
## Why
pack-verify 冒烟：验证发布产物在真实环境可用。
## What worked
1. npm install 两个 tgz
2. bin 直跑 TS
## Evidence
本命令输出
## Caveats
一次性沙箱
MD
DIGEST="pack-verify 冒烟信号 | scope: cli | validation: none"
PUB_OUT="$($RUN publish ai-research "$DIGEST" @"$BODY")"
SIG="$(echo "$PUB_OUT" | grep -o 'sig_[A-Z0-9]*' | head -1)"
[ -n "$SIG" ] || { echo "publish 失败：$PUB_OUT"; exit 1; }
echo "publish ✓ $SIG"

Q_OUT="$($RUN query ai-research --q pack-verify --limit 5)"
echo "$Q_OUT" | grep -q "$SIG" || { echo "query 未命中：$Q_OUT"; exit 1; }
echo "query ✓ 命中"

"$RUN" use "$SIG" --out "$SANDBOX/use.md" >/dev/null
grep -q "## What worked" "$SANDBOX/use.md" || { echo "use 物化缺正文"; exit 1; }
echo "use ✓ 物化含 Runbook"

step "5/5" "清理沙箱"
rm -rf "$SANDBOX"
printf "\n全部通过：发布产物在真实环境可用（\033[1;32m$SIG\033[0m 为验证信号，可留可删）\n"
