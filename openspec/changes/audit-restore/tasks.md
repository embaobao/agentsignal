# 任务拆分清单 — audit-restore（Phase 1B）

> 前置条件：`openspec/changes/design-driven-ui-and-three-chains` 已完成 D5 全量验收并放行。
> 执行顺序：1B-1（基础） → 1B-2（还原+裁决） → 1B-3（守卫，可选）。每阶段完成独立 e2e 绿。

---

## 1B-1 账本+快照 基础设施（Week 1）

- [ ] 1.1 packages/audit 子包创建 + workspace 登记 + package.json（bun test；deps：diff minimal / commander / picocolors）
- [ ] 1.2 LedgerWriter：JSON Lines；按日滚动；链式 hash（prev_hash + 本 hash = sha256(self-sans-hash)）；CRC 自检；ts 严格
- [ ] 1.3 LedgerReader：分页读 + entity_type/actor/between 过滤 + `verify(day)` 重算 hash 链；坏链返回 AG_LEDGER_BROKEN 标记
- [ ] 1.4 event schema zod：event_id/prev_hash/actor/entity/action/diff/snapshot_ref/hash 全部字段校验；非法事件写前拒绝
- [ ] 1.5 Snapshot Store：写前快照；每实体 LRU 50（超过按时间删最旧，可选 gzip 压缩超 10 条）；unified diff 生成
- [ ] 1.6 Hook 注入：apps/api server → `audit.injectHooks(store)`，注册 putSignal before/after、registerAgent after、rotateToken after
- [ ] 1.7 管理员端点：`GET /admin/audit/events?from_ts&to_ts&entity_type&actor&limit&cursor`（Basic + 第二个 admin Bearer 双鉴权）
- [ ] 1.8 CLI `agentsignal-audit log --day 2026-08-28 --format json|table|csv --filter <k=v>`
- [ ] 1.9 单测：ledger.hash.chain（good/bad 路径）/ snapshot.lru-50 / hook-count（3×publish → 6 events）
- [ ] 1.10 e2e：three-chains 跑通后 `audit verify --day <today>` 通过；手动篡改 1 byte → verify 失败

## 1B-2 还原 + 裁决（Week 2）

- [ ] 2.1 Restore Signal：`POST /admin/restore/signal/:id` 支持 `to_event_id` 或 `to_rev`；**必须先 dry-run 拿 diff，再申请 apply**（两步端点分离）
- [ ] 2.2 Restore Agent（轻量）：还原 display_name/description/ext_sso，不回 token（见 design §5 铁律 ⑥）
- [ ] 2.3 Dry-run：`restore/dry-run` 返回 unified diff；diff 过大（>1024 行）必须给出 warning
- [ ] 2.4 Verdict Store：verdicts.json；Signal 状态机转移表 publish→keep/amend/freeze → tombstone；非法转移抛错（不静默）
- [ ] 2.5 双签：approvals.json 登记 admin 执行人 sha；1B-2 MVP 要求 ≥2 admin approval 才 apply；单 admin env 豁免（`AS_ADMIN_SINGLE=y`）
- [ ] 2.6 Tombstone：列表默认不显示（除非 `?include=tombstone`）；还原 tombstone 先到 frozen → keep（两步）
- [ ] 2.7 CLI 四命令：`agentsignal-audit verify/restore/verdict/approve`；restore 默认 dry-run，`--apply` 还要求 STDIN 输入 `YES, I ACCEPT RESPONSIBILITY`
- [ ] 2.8 管理员 UI 四页：仪表盘 / logs / restore wizard / verdict panel（纯 HTML 表格 + inline vanilla script；零框架）
- [ ] 2.9 Basic auth：bcrypt hash，环境变量 `AS_ADMIN_PASS_BCRYPT`（别存明文）
- [ ] 2.10 单测：状态机 6 条转移（含 2 条必失败路径）/ restore 幂等（同一 to_rev 两次无变化）/ tombstone→published 直接恢复禁止
- [ ] 2.11 e2e：publish → 再 publish（改内容）→ restore 到 rev1 → diff 匹配 rev1 内容 → verify log 链仍自洽

## 1B-3 Guardrail 准入守卫（Week 3 · 可选）

- [ ] 3.1 三项检查 + pass/warn/block 级别：
  - ① format：四节标题存在率 ≥3/4？digest 三段式匹配？
  - ② similarity：topic 内 digest Levenshtein ≥0.85 → warn
  - ③ reputation：sender tombstone+freeze 计数 ≥3 → block
- [ ] 3.2 GuardrailRunner.run()：输出 level + checks[]；写入账本事件 `guardrail-run`
- [ ] 3.3 `POST /validate/envelope` 追加 guardrail 字段（扩展原端点，零破坏性）
- [ ] 3.4 主 UI 03 详情页：Guardrail 警告条（0–3 行黄色块；block 级红色；最上方位置）
- [ ] 3.5 CLI `agentsignal-audit scan --topic ai-research --checks all --format md >reports/scan-2026-08-28.md`（批量扫描 + Markdown 审计报告：主题分布 / 检查统计 / 问题信号清单 / 时间戳）
- [ ] 3.6 管理员 UI Guardrail 页：最近 50 guardrail-run + 7 日柱（纯 SVG 画，无图库）
- [ ] 3.7 单测：三项各 3 case（pass/warn/block）共 9 条；批量 scan 报告结构完整
- [ ] 3.8 e2e：publish 后账本有 guardrail-run；`scan` 产出 Markdown 报告可归档（docs 目录保存一次样本）

## 集成（Phase 1B Final）

- [ ] F.1 主链路无回归：three-chains.test.sh 全通过 + 新 e2e 审计还原通过
- [ ] F.2 耦合点：packages/protocol 两个扩展字段都有、主 UI 显示正常
- [ ] F.3 bun verify（check + lint + test + test:node）全绿
- [ ] F.4 文档落盘：glossary 追加 6 条新术语（Audit/Ledger/Snapshot/Restore/Verdict/Guardrail）
