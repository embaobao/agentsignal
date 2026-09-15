> **口径注记（2026-08-31）**：本文任务清单为提案原稿；执行按 standardize-node-postgres 决议修订——
> bun test → node:test · JSON Lines 账本 → PG 表（audit_events/verdicts/snapshots）· commander/picocolors 不引。
> 动工时逐条按新口径换算，勿照抄旧依赖与文件方案。

# 任务拆分清单 — audit-restore（Phase 1B）

> 前置条件：`openspec/changes/design-driven-ui-and-three-chains` 已完成 D5 全量验收并放行。
> 执行顺序：1B-1（基础） → 1B-2（还原+裁决） → 1B-3（守卫，可选）。每阶段完成独立 e2e 绿。

---

## 1B-1 账本+快照 基础设施（Week 1）

- [x] 1.1 packages/audit 子包创建 + workspace 登记 + package.json（node:test；零新增运行时依赖（口径修订））
- [x] 1.2 LedgerWriter：PG 表 audit_events（text 载荷字节级精确）；链式 hash（prev_hash + 本 hash = sha256(self-sans-hash)）；verify 全链重算；TS strict
- [x] 1.3 LedgerReader：分页读 + entity_type/actor/between 过滤 + `verify(day)` 重算 hash 链；坏链返回 AG_LEDGER_BROKEN 标记
- [x] 1.4 事件字段以 TS 类型 + SQL 约束固化（zod schema 后置到 1B-2 restore 入口）：event_id/prev_hash/actor/entity/action/diff/snapshot_ref/hash 全部字段校验；非法事件写前拒绝
- [x] 1.5 Snapshot Store：写前快照；每实体 LRU 50（超时删最旧）；unified diff 生成
- [x] 1.6 Hook 注入：`withAudit(store, db)` 原型委托包装：registerAgent/putSignal 落账、rotateToken after
- [x] 1.7 管理员端点：`GET /admin/audit/events?day&entity_type&actor&limit`（Basic 单管理员；未配置 404 fail-soft）
- [x] 1.8 CLI `agentsignal-audit log --day --limit` / `verify --day`（走 admin HTTP，本机零 DB 凭证）
- [x] 1.9 单测：ledger.hash.chain（good/bad 路径）/ snapshot.lru-50 / hook-count（3×publish → 6 events）
- [x] 1.10 e2e：集成测试：publish×3+register → verify 链完整；直改 hash → 坏链定位 event_id

## 1B-2 还原 + 裁决（Week 2）

- [x] 2.1 Restore Signal：`POST /admin/restore/signal/:id/apply` + `/dry-run` 两步端点分离（支持 to_event_id/to_rev；dry-run 返回 target/current/diff/diff_lines；apply 走 verifyChain 门 → 快照当前 → updateSignal 还原 → 追加 restore 事件）— 2026-09-11 完成（IStore.findSignal 接口扩展 includeDeleted 可选参；连带接线：putSignal 后全行快照 rev1、updateSignal 前快照+补 update 事件——修订史来源）
- [x] 2.2 Restore Agent（轻量）：还原 name/description（现行 schema 无 display_name/ext_sso 字段，落到现实字段；不回 token——agent_tokens 零触碰断言）（design §5 铁律 ⑥）— 2026-09-11 完成（agent 全行快照接线（registerAgent 后 rev1）· IStore.updateAgentIdentity 新方法 · /admin/restore/agent/:id/dry-run + /apply 端点（dry-run/还原/幂等同 signal 口径））
- [x] 2.3 Dry-run：返回 unified diff（手写 LCS 零依赖，packages/audit/restore.ts）；diff_lines > 1024 给 warning 字段 — 2026-09-10 完成（>1024 大 diff 用例留待 2.10 测试批次补；audit-restore.test.ts 5 用例绿：dry-run diff/apply 还原+事件/幂等/链坏 409/to_event_id）
- [x] 2.4 Verdict Store：verdicts.json；Signal 状态机转移表 publish→keep/amend/freeze → tombstone；非法转移抛错（不静默）— 2026-09-11 完成（packages/audit/src/verdict.ts：五态固定转移表 + VerdictError + VerdictStore 文件存储（tmp+rename 原子写）+ history 追加；非法转移抛错不落盘；tombstoned→published 直接恢复禁止（两步第一步先到 frozen）；verdict-store.test.ts 6 用例）
- [x] 2.5 双签：approvals.json 登记 admin 执行人 sha；1B-2 MVP 要求 ≥2 admin approval 才 apply；单 admin env 豁免（`AS_ADMIN_SINGLE=y`）— 2026-09-11 完成（packages/audit/src/approvals.ts：ApprovalsStore（同管理员去重/approvals.json 原子写）+ operationSha 操作指纹（审批绑定实体+目标不可挪用）；apply 路由接线：登记→配额（默认 2 / SINGLE=y 豁免 1）不足返回 202 pending 不执行；env 增 AS_AUDIT_STATE_DIR（审批/verdict 落盘目录）；approvals.test.ts 3 用例；跨修 capability-providers.test.ts 严格模式下标访问（他会话提交挡共享门禁，机械修复注明））
- [x] 2.6 Tombstone：列表默认不显示（除非 `?include=tombstone`）；还原 tombstone 先到 frozen → keep（两步）— 2026-09-11 完成（admin 三端点 tombstone/unfreeze/keep：VerdictStore 状态机接线（软删 hidden + verdict=tombstoned；unfreeze=frozen 仍隐藏；keep=恢复可见）；VerdictError → 409 跳步禁止；tombstone 全环用例）
- [ ] 2.7 CLI 四命令：`agentsignal-audit verify/restore/verdict/approve`；restore 默认 dry-run，`--apply` 还要求 STDIN 输入 `YES, I ACCEPT RESPONSIBILITY`
- [ ] 2.8 管理员 UI 四页：仪表盘 / logs / restore wizard / verdict panel（纯 HTML 表格 + inline vanilla script；零框架）
- [ ] 2.9 Basic auth：bcrypt hash，环境变量 `AS_ADMIN_PASS_BCRYPT`（别存明文）
- [ ] 2.10 单测：状态机 6 条转移（含 2 条必失败路径）/ restore 幂等（同一 to_rev 两次无变化）/ tombstone→published 直接恢复禁止
- [ ] 2.11 e2e：publish → 再 publish（改内容）→ restore 到 rev1 → diff 匹配 rev1 内容 → verify log 链仍自洽

## 1B-3 Guardrail 准入守卫（**备选 · 不在三日排期内**——1B-2 与宿主矩阵优先；站长点头的空窗夜再启用）

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
- [ ] F.3 pnpm verify（check + lint + test + test:ui）全绿（口径修正：bun 运行时已于 2026-08-28 标准化决议弃用）
- [ ] F.4 文档落盘：glossary 追加 6 条新术语（Audit/Ledger/Snapshot/Restore/Verdict/Guardrail）
