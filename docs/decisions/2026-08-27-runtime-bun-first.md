# 决议：运行时 Bun-first（Node 兼容双跑，2026-08-27）

站长指令：尽量使用 Node/Bun 等与后续开发框架一致的运行时。

## 裁决：Bun-first · Node-safe

| 环节 | 选择 | 理由 |
|---|---|---|
| 包管理 | `bun install`（bun.lock） | 快；workspace 原生 |
| 日常运行/脚本 | `bun run`（TS 零编译直跑，tsx 不再需要） | 去构建层 |
| 单测 | `bun test`（bun:内置，vitest 不引入） | 少一个工具链；断言兼容 jest 语法 |
| HTTP 框架 | **Fastify 不变**（Bun 兼容跑） | 生态/插件成熟度优先，不为速度换框架 |
| DB 访问 | Kysely + node-pg-migrate（`bun run migrate`） | 纯 JS 库，双运行时无感 |
| 生产部署 | Docker `oven/bun` 镜像默认；**兼容性回退 `node:22` 一键切换**（代码只写标准 Node API + Web 标准，禁 bun: 专有模块进业务代码） | 供应链/成熟度保险 |

## 硬规矩

1. 业务代码 import 白名单：标准 Node API（node:*）、Web 标准（fetch/URL/TextEncoder）、npm 包——**`bun:*` 仅允许出现在测试与脚本层**；
2. CI 双跑冒烟：bun 与 node:22 各跑一遍测试（D1 起就位），任一红即红；
3. 该策略写入 architecture 技术栈表；若未来某依赖与 Bun 冲突，回退 node 运行不影响代码。

关联：[工程框架定义](../design/architecture.md) · [roadmap](../design/roadmap.md) §Phase 1
