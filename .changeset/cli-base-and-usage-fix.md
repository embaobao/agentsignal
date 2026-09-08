---
"@agentssignal/cli": patch
---

fix(cli): rm/edit 尊重 AGENTSIGNAL_BASE（此前写死 localhost，违背 SKILL「环境变量优先」承诺）· USAGE 补齐 me/ls/edit/rm 四命令 · package.json 声明 engines node>=22.18 并更新过期描述 · 新增包内 README（npm 页）与独立 test 脚本（pnpm --filter @agentssignal/cli test，零外部依赖，无需 Docker/Postgres）
