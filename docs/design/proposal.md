# 开发提案（Development Proposal）— AgentSignal v0.2 Use-First MVP

状态：待放行 · 汇总提案书（细则以 canonical 文档为准，本文为单一入口）

> **UI 权威真源（设计完成后同步到所有前端实现）**：[ui-blueprint-prompt.md](ui-blueprint-prompt.md)（v5 · 2026-08-28 起单色极简，v4 工程图纸风已废弃）。
> 关联 IA：[web-ia.md](web-ia.md)（八屏骨架 + 三栏布局 + 字段冻结）。
> 产品对外第一眼：见 [product.md](product.md) 头部（给你 Agent 一个解决问题的能力 · 感知·复用·分享）。

## 一句话提案

用**最少代码**验证一个假设——**一条经验能被另一个宿主的 Agent 物化为技能并成功使用**——并在此过程中落成可复用的经验标准、模板簇与双 Skill 交付物；分享机制的顺滑化工程在验证成功后才建。

## 范围（P0 验证链 · 对应 roadmap §Phase 1）

| 包 | 交付 |
|---|---|
| packages/protocol | 信封/Topic/Agent 类型 + ULID（sig_/topic_/agt_/tok_）+ digest/supersedes 解析 |
| apps/api | 六端点（/skills、/topics、POST+GET /signals、admin 签发、/agents/me 占位）+ Bearer 鉴权 + Server Filter 基础 |
| packages/watch | use 物化器（experience→本地 SKILL）+ pull 内核（M2 用最小版） |
| packages/cli | `use`（P0）· `publish --admin`（最简）· `pull`（P1）· `connect`（P2） |
| packages/skills | **builder**（D1 自举）· **participant**（D5 初稿，动态版本+全模板） |
| MCP | stdio 五工具（P2·D6–D7） |
| templates/ | EXPERIENCE / OUTCOME / SKILL.generated 三模板（P0–P2） |
| tests | 集成矩阵 + **use 闭环 e2e（M2 硬验收）** + 断线恢复 + seed |

## 技术栈（Bun-first，见决议）

bun install/run/test · Fastify + zod · PGlite（WASM PostgreSQL，`Db` 接口直写 PG SQL + 幂等迁移；Phase 2 换生产 PG 只换 driver）· pino · Docker（oven/bun 默认，node:22 回退）· TS strict 全仓 · 业务代码禁 bun:* 专有 API。前端：React 19 / Vite / Tailwind v4 / Base UI（瘦栈决议）。

## 里程碑与裁决点

| M | 内容 | 裁决 |
|---|---|---|
| M1 | 有人能发（admin curl→201→持久化） | 基础可用 |
| **M2** | **他人 Use 成功**（异宿主物化技能→照 Runbook 执行→结果一致）+ 断线恢复 | **核心假设裁决——不过全案停** |
| M3 | Think Gate：100 进 ~10 过 + noise 夹具 + tokens_saved 实测 | 过滤价值成立 |
| M4a | 内部 Testnet 七日（签发+手工安装，Hermes 在列） | 持续依赖出现 |
| M4b | 自注册 + connect 全量 → 开放接入 | 规模化 |
| P2 滑梯 | 交互 publish/MCP/积分工具 | 验证成功后 |

验证计划：Experiment 000b（use-loop，P0 首验）→ 001（七日五线）→ 002/003。全部预登记于 [validation.md](validation.md)。

## 仓库脚手架（D1 一次性生成）

```
package.json (workspaces) bun.lock
apps/api/src/{routes/{skills,topics,signals,agents},plugins/{auth,rate-limit},db/{migrations,seed},lib/{ulid,errors}}
packages/protocol/src/{envelope.ts,ulid.ts,digest.ts,kinds.ts}
packages/watch/src/{pull.ts,gate.ts,materialize.ts}
packages/cli/src/{connect.ts,pull.ts,use.ts,publish.ts}
packages/skills/{participant/SKILL.md,builder/SKILL.md}
packages/mcp/src/server.ts        (P2)
templates/{EXPERIENCE,OUTCOME,SKILL.generated}.md
tests/{api/,e2e/}  docker-compose.yml  .github/workflows/ci.yml(bun+node 双跑)
```

## 工作流与治理

九步流（问题→最小解→协议→测试→实现→集成→度量→落盘→继续）· DoD 八件套 · 每定义变更走 glossary 治理规程主动传播 · builder SKILL 装入工程 agent 即持全案上下文。

## 风险与回退

| 风险 | 回退 |
|---|---|
| Bun 兼容性 | node:22 运行切换（代码无感） |
| M2 use 闭环失败 | 停止一切滑梯投资；归因 SKILL 模板/Runbook 规范，修订后单点重测 |
| Testnet 无自发经验 | Stop-hook 试点 + curator 荣誉制（运营手段，非代码） |
| Gate PASS≈100% | noise-injector 夹具已在计划内 |

## 启动方式（放行后）

1. 生成脚手架 + packages/protocol（D1 上午）
2. builder SKILL 写入并装入工程 agent 工作流（D1 下午）
3. 此后按 roadmap §Phase 1 Day 表推进，每 M 关口回本提案对账
