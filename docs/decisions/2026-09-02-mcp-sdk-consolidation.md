# 决议：MCP 收敛官方 SDK + 唯一 server 九工具面（2026-09-02）

来源：[skill-engine 提案](../../openspec/changes/skill-engine/proposal.md)（裁决 2/13）· 修订 [mcp-early-access 决议](2026-08-27-mcp-early-access.md) 的边界。

## 裁决

**1. 官方 SDK 迁移**：`agentsignal mcp` 改用 `@modelcontextprotocol/sdk`（`McpServer` + `StdioServerTransport`），替换 packages/mcp 现有零依赖手写 stdio JSON-RPC。协议跟进不自己背；lockfile 锁定版本，迁移 PR 单独可回滚。

**2. 唯一 MCP server**：全系统只保留一个 MCP server = `agentsignal mcp`（实现在 `packages/cli/src/mcp/`，五平台工具 run 逻辑与 client.ts 原样迁入）。`@agentssignal/mcp` 降级为**兼容壳 bin**（转调 `agentsignal mcp`，README deprecated），现有用户配置不破。

**3. 工具面 5+3+1 = 恰好九个**：

| 组 | 工具 | 说明 |
|---|---|---|
| 平台五工具（不动） | list_spaces / query_signals / use_signal / publish_signal / report_outcome | 1:1 镜像 REST，铁律不变 |
| 技能三工具 | search_skills / load_skill_detail / verify_skill | 模型消费本地技能的唯一入口；共享 CLI 引擎单例；verify 只写本地 lifecycle.metrics（用户域暂缓，裁决 5） |
| 管理一工具 | open_setup | 拉起本地 web 管理/向导界面（无配置即向导、有配置即状态/管理视图）；Agent 可替用户触发初始化与调整 |

**4. 边界修订**（对 mcp-early-access 决议）：「恰好五个 tool」修订为「恰好九个 tool（5 平台 + 3 技能 + 1 管理）」；「不新增任何语义」铁律保留——三技能工具不镜像 REST（本地引擎面），但平台五工具仍零新增语义；维护类能力（技能增删/索引重建/参数编辑）**不开 MCP 工具**，CLI 内置。

**5. 生命周期与调用管线**（skill-engine design §4.8）：

- 状态机：BOOTING → WAITING_CONFIG（无 config 拉向导，**不报错不退出**）/ READY ⇄ CALLING → SHUTTING_DOWN；旁路 DEGRADED（索引损坏整库重建回 READY）。
- 调用管线：zod 参数校验（失败 = isError + USAGE_INVALID 中文说明）→ 引擎单例处理 → protocol 统一错误码结构化 JSON → Trace（Phase 2 只记录不审计）→ graceful shutdown。
- 多宿主并发：stdio 一宿主一实例，共享 `~/.agentsignal`——索引 tmp+rename 原子写、metrics 追加写。

**6. 工具描述 = 行为引导**：九个工具 description 写清何时用/何时别用，不写功能罗列。

## 影响

- `packages/mcp/test/tools.test.ts` 迁移为 SDK InMemoryTransport 集成测试（挂 `packages/cli/test/`）。
- tools list 数量护栏：恰好 9 为验收硬断言。
- mcp-early-access 决议文本不回写（ADR 纪律）；阅读时以本文为准。

## 修订注记（2026-09-03，站长指令）

裁决 2 的「兼容壳 bin」条款**不再成立**：`@agentssignal/mcp` 从未发版（0.3.0 lockstep 尚未发布过含手写 JSON-RPC server 的 mcp 包），无存量用户需要保护——**packages/mcp 已整体移除**，仓库内唯一 MCP server 就是 `agentsignal mcp`（CLI 内实现）。本决议其余条款（SDK、九工具面、边界、生命周期、行为引导描述）不变。正文按 ADR 纪律保留原貌，阅读裁决 2 时以本注记为准。
