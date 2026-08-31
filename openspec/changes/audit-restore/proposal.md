> **状态（2026-08-31）**：前置（design-driven D5 放行）已解除——三链路落地、e2e 21/21，**ready to start**。
> 执行口径按 [standardize-node-postgres 决议](../../../docs/decisions/2026-08-28-standardize-node-postgres.md) 修订：
> ① 账本/verdict/snapshot 落 **Postgres 表**（pg_dump 备份链），弃 JSON Lines 文件方案；
> ② 工具链 pnpm + Node ≥22.18（node:test 单口径，非 bun test）；③ deps 以 workspace 现有为准，不引 commander/picocolors。
> 顺手闭环运营后台缺口：admin 端点带 `recommended`/`stats_tag` 写路径（原协议有列无写路径）。

# 提案（独立模块）：审计还原（Audit & Restore）

完整提案：`docs/design/audit-restore-proposal.md`。本文件是 openspec change 的简短入口说明。

## 一句话提案

独立开发 `packages/audit` + 独立 CLI `agentsignal-audit` + 独立管理后台 `/admin/`，为经验总线提供「不可变账本 + 可验证还原 + 治理裁决 + 发布准入守卫」的治理能力；此模块必须等 P5 三链路最小闭环上线后才启动（Phase 1B），**绝不拖慢主 MVP**。

## 为什么独立

- 治理能力与主 MVP"分享 → 检索 → 构建发布"正交；混编码会拖慢 D1/D2/D5 主裁决点。
- 管理员权限与普通 `ags_` 身份权限分开（HTTP Basic + 双签更安全）。
- 账本 hash 链是**高可靠**要求（一旦坏链禁止还原），不建议跟业务端点用同一进程内状态；独立子包、独立测试、独立 e2e。

## 三期交付（Phase 1B 三周）

1B-1：账 + 快照 基础设施（Week 1）——所有写入有日志，可被查询。
1B-2：还原 + 裁决（Week 2）——管理员 dry-run → 双签 → apply；状态机。
1B-3：Guardrail 准入守卫（Week 3，可选）——发布前第二道防线，默认 warn 不拦。

## 主链路耦合点（只有 3 个，最小爆炸）

- packages/protocol：追加 `SignalEnvelopeExt.guardrail_warnings[]` · `SignalFull.verdicts[]`
- apps/api/server.ts：`audit.injectHooks(store)` 前后 hook（**不改 store 内部**）
- 主 UI 03 详情页：显示 verdict chip + Guardrail 警告条（只读，不做治理按钮）
