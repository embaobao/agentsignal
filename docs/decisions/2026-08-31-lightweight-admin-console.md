# 决议：轻量运营后台 —— admin 策展端点内嵌（兑现 standardize-node-postgres D5 承诺）

日期：2026-08-31 · 状态：Accepted（实现已随 [d3daeb3] 落地，本决议补记账面）· 决策人：站长（zhumeng）
**上位**：[standardize-node-postgres](2026-08-28-standardize-node-postgres.md) D5（Payload CMS 全量接入否决，承诺轻量方案另立 ADR）
**关联**：[admin-guide.md](../design/admin-guide.md)（操作手册）· [audit-restore 提案](../../openspec/changes/audit-restore/proposal.md)（基建来源 1B-1）

## 背景与缺口

- `signals.recommended` / `stats_tag` **有列**（migrations）**有读**（列表/详情 `_ui_ext`）**零写路径**——运营无法打标，
  M4 Testnet 前必须闭环，否则「编辑推荐」位永远是空的。
- D5 已否决 Payload CMS 全量接入（重、引 ORM、破「禁成品 UI 库」约束），承诺以轻量方案补位。

## 裁决

### D1 形态：无独立后台应用，admin 端点内嵌 apps/api

不建管理前端 SPA、不引 CMS。运营操作 = HTTP Basic + curl/CLI 直调 `/admin/*` 端点；
未配置 `AS_ADMIN_USER`/`AS_ADMIN_PASS_BCRYPT` 时整体 **404 fail-soft**（不泄露存在性，不影响其他端点）。

### D2 策展写路径：`PATCH /admin/signals/:id/curate`

- body：`{"recommended": boolean?, "stats_tag": string[]?}`（tags ≤8，超限 400）
- 语义：`recommended=true` 进首页推荐位；`stats_tag` 空时列表侧自动回落 `["编辑推荐"]`（读侧既有逻辑）
- **每次策展自动落审计账本**（actor=`admin:<user>`，before/after 全记）——篡改可验、误操作可溯源

### D3 基建复用 audit-restore 1B-1，不为运营单开体系

Basic 认证、`appendEvent` 落账、`/admin/audit/events` 流水查询全部复用既有实现；
1B-2 的双签/verdict 状态机按原计划推进（本决议不预支）。`AS_ADMIN_SINGLE=y` 豁免双签的开关已预留。

### D4 约束坚守：无 ORM · 禁成品 UI 库

- `updateCuration` 走 `Db` 接口直写 PG SQL（与全仓一致，零 ORM）
- 不新增任何 UI 依赖；若 1B-2 需要管理界面，按其任务口径走「纯 HTML 表格 + inline vanilla script、零框架」

### D5 明确不做（到 M4 为止）

- 不做多管理员/RBAC（单管理员 + 1B-2 双签足够）
- 不做管理端 CLI 之外的 UI（策展频率低，curl/audit CLI 够用）
- 不把 `/admin/*` 写进对外协议 api.md（管理面非公开契约；口径以 admin-guide.md 为 canonical）

## 验收（已满足）

- [x] 端点实现 + 单测（`apps/api/test/audit.test.ts` 覆盖 curate 全分支）
- [x] 策展动作落账可验（`/admin/audit/verify` 链完整性）
- [x] `.env.example` 与 deployment.md §3.8 同步登记 AS_ADMIN_* 变量
- [x] admin-guide.md 三端点操作手册（含 bcrypt 生成命令）
