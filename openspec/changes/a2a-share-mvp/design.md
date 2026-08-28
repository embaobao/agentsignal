## Context

三轮收敛终稿：放弃全量 MVP 与压缩包/CLI 路线，先以 A2A 协议打通 agent 间经验内容沟通，并把消息结构**固化**为标准。决策依据：docs/decisions/2026-08-27-skill-share-mvp.md（终稿）。Bun 运行时既定；无存量代码。

## Goals / Non-Goals

**Goals:**
- R1 沟通闭环：发布（message/send 固化结构）→ 服务回执 → 拉取（GET 同构返回）
- R2 规范对齐：agent card 可被发现；结构固化件（schema + golden sample）入仓可复用
- 校验最小化：结构合法即收，内容语义不做任何判断

**Non-Goals:**
- 下载安装/CLI、业务 schema（四节模板等）、鉴权（仅预留 token header 位）、检索/订阅、持久化数据库、多租户

## Decisions

| 决策 | 选择 | 为什么不是替代方案 |
|---|---|---|
| 传输协议 | A2A 规范子集：JSON-RPC 2.0 `message/send` | 自造协议违反红线；官方 SDK（@a2a-js/sdk）executor/eventBus 为 task 流设计，对本服务过重——已引包作未来切换点（jsonRpcHandler），v0 用 Fastify 5 + @fastify/type-provider-zod 承载路由与校验（路由 schema 直接用 zod 对象），单方法分发保持极简 |
| 固化结构 | `role+parts(kind:text 必填 / kind:data 可选)+messageId+contextId` | 直接采用 A2A Part 模型，未来切官方 SDK 零迁移；自造 shape 会被生态抛弃 |
| 拉取形态 | REST GET /messages（同构 JSON 返回） | 拉取不必也是 JSON-RPC——消费方多为简单 agent；A2A tasks 语义后置 |
| 校验 | 最小结构校验（必填字段/类型），内容透传 | 「格式后置」裁定：结构固化 ≠ 内容 schema 化 |
| 存储 | data/messages/<seq>.json + index 内存数组 | 无 DB 依赖；seq 即简单游标 |
| 运行时 | Bun-first/Node-safe（apps/share/src/ 四模块：index 启动·server 路由·schema 固化结构·store 存储） | Node-safe 写法；测试经 fastify inject() 双运行时跑 |

## Risks / Trade-offs

- [A2A 规范版本变动] → 固化范围声明为 v0 子集；golden sample 是对账锚
- [无鉴权被滥发] → 预留 header token 位；公开 MVP 期接受噪音，量级可控
- [内存 index 重启丢失序] → 启动时扫描 data/messages/ 重建

## Migration Plan

无存量。部署 = `bun run dev`（或 `dev:node`，入口 apps/share/src/index.ts）；回滚 = 删 data/ 与进程。工具链：tsc check + biome lint + 双运行时 test（`bun run verify` 一次全跑）。

## Open Questions

无——范围三件套已由站长三轮裁定锁死。
