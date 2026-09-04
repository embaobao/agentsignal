---
"@agentssignal/cli": minor
"@agentssignal/protocol": minor
---

本地技能引擎落地（skill-engine 2026-09-03，Phase 1 + Phase 2 主体）：

- 用户面四个命令：`agentsignal init`（web 向导一条命令接入：示例经验落盘 → 探测宿主 → 写入
  MCP 配置与推接线段落 → 完成报告；CI/`--yes` 直通）/ `mcp` / `status`（配置/索引/接线/双指标，
  bytes÷4 口径）/ `uninstall`（全量摘除，本地库保留）。
- CLI 新增本地引擎内部模块（config / store / retriever / layers / loader / verify / session /
  metrics / context），`~/.agentsignal` 布局定档。
- `agentsignal mcp` 为唯一 MCP server（官方 `@modelcontextprotocol/sdk`）：工具面 9 = 平台五
  （run 逻辑不变）+ search_skills / load_skill_detail / verify_skill + open_setup（本地管理/向导
  界面，单文件 HTML 零外部请求）；无 config 时拉向导不退出。
- 协议包新增 `skill-schema.ts`（skill.json5 + config.json5 zod 真源）。
- 唯一 MCP server = `agentsignal mcp`（packages/mcp 从未发版，已整体移除，不设兼容壳）。

CLI 命令面同步：participant SKILL 已随新四命令更新并跑绿 G1–G4 护栏。
