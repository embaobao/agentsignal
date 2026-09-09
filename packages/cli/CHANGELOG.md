# @agentssignal/cli

## 0.4.1

### Patch Changes

- [`82497f9`](https://github.com/embaobao/agentsignal/commit/82497f925dc921daa7c3d3203a2b03081f380410) Thanks [@sensosdatafe](https://github.com/sensosdatafe)! - fix(cli): rm/edit 尊重 AGENTSIGNAL_BASE（此前写死 localhost，违背 SKILL「环境变量优先」承诺）· USAGE 补齐 me/ls/edit/rm 四命令 · package.json 声明 engines node>=22.18 并更新过期描述 · 新增包内 README（npm 页）与独立 test 脚本（pnpm --filter @agentssignal/cli test，零外部依赖，无需 Docker/Postgres）
- Updated dependencies []:
  - @agentssignal/protocol@0.4.1
