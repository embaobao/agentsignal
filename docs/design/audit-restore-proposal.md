# 独立模块提案：审计还原（Audit & Restore）

> 状态：**独立模块 · 单独立项 · 单独开发**（不和 P3/P5 UI 主链路并行）
> 前置依赖：**先完成三链路最小闭环（P5 已上线）**；此模块是 P5 之后的 **Phase 1B**。
> 配套：[backend-architecture.md](backend-architecture.md) · [design-driven-proposal.md](design-driven-proposal.md) · [openspec/changes/audit-restore/]（同步落地）

---

## 一、为什么要独立拆？

「审计还原」**不是** MVP 三链路（分享/检索/构建发布）的一部分，而是独立的治理工具——**在经验总线发生污染、误删、格式漂移时，给站长/管理员一套"能看、能判、能回滚"的工具**。

如果把它混进 P3/P5 主链路编码：
- 端点复杂度翻倍；
- 管理员 UI 与普通用户 UI 混在同一 SPA，权限爆炸；
- 三链路主路径被治理边界拖慢。

**因此本提案独立：独立仓库子包 `packages/audit` + 独立 CLI `agentsignal-audit` + 独立管理后台路径 `/admin/`（带 HTTP Basic 二次鉴权，不走常规 token）。**

---

## 二、定义与 canonical 术语

> 术语权威定义见 [glossary.md](glossary.md)。下面只列本模块引入的新增术语（提案通过后应追加 glossary）。

| 术语 | 定义 | Canonical 指针 |
|---|---|---|
| **Audit**（审计） | 对 Signal/Agent/Token 三类实体的写入事件做**不可变日志记录**（append-only, sha-chained） | packages/audit `audit-log.md` |
| **Restore**（还原） | 把某实体的状态还原到**某个审计事件发生前**的快照 | packages/audit `restore.md` |
| **Ledger**（审计账） | `data/audit/ledger-YYYYMMDD.jsonl`（JSON Lines），每日滚动；事件 sha256 链：`prev_hash` 字段 | packages/audit `ledger-format.md` |
| **Snapshot**（快照） | Signal 写入前的完整状态。`putSignal` 每次先存 snapshot，再写新值；还原 = 取 snapshot 覆盖当前 | packages/audit `snapshot-format.md` |
| **Verdict**（裁决） | 管理员对 Signal 的定性：`keep / amend / freeze / tombstone`（见 §六） | packages/audit `verdict-enum.md` |
| **Guardrail**（准入守卫） | publish 前的**第二道防线**（第一道是 zod+软约束）：内容/主题/声誉 复合检查；独立审计写入 `guardrail-run` 事件 | packages/audit `guardrail.md` |

---

## 三、功能范围与分期（Phase 1B 独立里程碑）

### 1B-1：账 + 快照 基础设施（Week 1）

**目标：所有写入都有账本，可被查询。不提供任何还原操作。**

| # | 功能 | 交付物 |
|---|---|---|
| 1.1 | **写入 Hook**：`IStore.putSignal/registerAgent/rotateToken` 前后触发审计事件（SignalBefore/AgentCreated/TokenRotated） | `packages/audit/src/hooks.ts`；后端 storage 层注入，不改业务逻辑 |
| 1.2 | **Ledger 写入器**：JSON Lines，按日滚动；每条 `{ts, event_id, prev_hash, actor, entity, diff, snapshot_ref, hash}` | `LedgerWriter.append()`；CRC 校验 + 链式 hash 自检 |
| 1.3 | **Snapshot 存储**：Signal 写前完整快照（快照 = 写入前 JSON）+ Signal 版本号（seq+rev）；每实体保留最近 50 个快照（LRU 清） | `data/audit/snapshots/sig_01HCYJ78A1BD4P5K2R99S6B3/001_2026-08-28T10.json` |
| 1.4 | **端点（仅管理员）**：`GET /admin/audit/events?from&to&entity_type&actor=` 分页返回账本 JSON Lines | HTTP Basic `admin-user / admin-pass`（环境变量，非 ags_ token）|
| 1.5 | **CLI `agentsignal-audit log`**：读账本 + grep 过滤 + 表格输出（`--format json|table|csv`） | `packages/audit/src/cli.ts` |

### 1B-2：还原操作（Week 2）

**目标：管理员可以从账本安全地还原 Signal / Agent。**

| # | 功能 | 交付物 |
|---|---|---|
| 2.1 | `POST /admin/restore/signal/:id` — `{to_event_id}` 或 `{to_rev}` 双重入口；还原后**再记录一次审计事件 SignalRestored（含新的快照引用）** | 还原幂等：同一 event_id 重调是 no-op |
| 2.2 | `POST /admin/agents/verdict/:id` — 裁决 `{verdict, reason, expires_at?}`；冻结后 publish → 403；墓碑后列表不再显示（除非 `?include=tombstone`） | verdicts 存 `data/audit/verdicts.json` |
| 2.3 | CLI `agentsignal-audit restore sig_xxx --before 2026-08-28T10:00:00Z --dry-run` — **先 dry-run 看 diff，不加 `--apply` 不真写** | diff 输出用 unified diff 格式（可保存、可复核） |
| 2.4 | **操作双签（Four Eyes）**：还原/裁决 必须 2 个管理员分别 `approve`（MVP 简化：命令行交互让输入 `YES, I ACCEPT RESPONSIBILITY`，并在 `data/audit/approvals.json` 登记执行人 sha + 时间；真实管理员 ≥2 时要求二次审批） | 保护：没人能一键 delete；命令行默认 dry-run |

### 1B-3：Guardrail 准入守卫（Week 3，可选 · 看 1B-1 的账本数据量）

**目标：发布前做第二道防线。P5 主链路已经发布成功 —— Guardrail 可作为可选插件，不拦主路径。**

| # | 功能 | 交付物 |
|---|---|---|
| 3.1 | 三项检查（每项独立 pass/warn/block 分级）：①格式检查（四节标题存在率 ≥3/4？digest 三段式？）②相似内容去重（topic 内 digest 相似度 ≥0.85 → warn）③ 发送者声誉（sender_tombstone_count ≥3 → block） | `GuardrailRunner.run(kind, digest, body, sender)` → `{level, checks[]}` |
| 3.2 | **默认不拦**：所有检查结果只写入账本 `guardrail-run` 事件 + 信号 `_ui_ext.guardrail_warnings` 字段（前端显示 "此方案有 3 条格式风险"，不强制拦截，除非管理员开"严格模式"主题） | 软约束精神：宁可脏一点，不要挡真实经验 |
| 3.3 | CLI `agentsignal-audit scan --topic ai-research --checks all` 批量扫全库，生成 Markdown 审计报告 | `reports/scan-2026-08-28.md`（仓库 docs 归档） |

---

## 四、账本格式（JSON Lines）

```jsonc
// data/audit/ledger-20260828.jsonl
{
  "ts": 1787908800123,
  "event_id": "evt_01HCYJ78A1BD4P5K2R99S6B3",
  "prev_hash": "4a9e5f…（上条 hash）",           // 链断了 = 账本损坏，还原禁止
  "actor": {
    "type": "admin"|"agent"|"system"|"cli",
    "agent_id": "agt_01H…" | null,
    "admin_basic_sha": "2c7d…" | null
  },
  "entity": {
    "type": "signal"|"agent"|"token"|"verdict"|"restore",
    "id": "sig_01H…",
    "rev_before": 2, "rev_after": 3
  },
  "action": "signal.put.after" | "agent.create" | "token.rotate" | "verdict.tombstone" | "signal.restore",
  "diff": {                                      // JSON Patch (RFC 6902) 格式，可直接 replay
    "add": {"digest": "…新"}, "remove": {"kind":null}, "replace": {"tokens_est":1200→1240}
  },
  "snapshot_ref": {                              // 可空；Token 事件无快照
    "path": "data/audit/snapshots/sig_01H…/002_2026-08-28T10-00.json",
    "sha256": "b1c3e5…"
  },
  "guardrail_result": {                          // 3.1 才有；早期 null
    "level": "pass", "checks": []
  },
  "hash": "9c1a2f…（本条所有字段除 hash 自身的 sha256）"
}
```

**每日账本自检**：CLI `agentsignal-audit verify --day 2026-08-28` 逐条重算 hash + `prev_hash` 串联；**任一失败 = 当日账本不可用，还原操作停止**。

---

## 五、还原语义（硬约束 MUST NOT BREAK）

```
Restore 六铁律：
  ① 先查账本 hash 链完整性；坏 → 禁止还原，返回 500 {code:AG_LEDGER_BROKEN}
  ② 先 dry-run 出 unified diff；diff 必须 ≥1 个 admin 确认才 apply
  ③ 还原后产生 NEW 版本号 rev + NEW SignalRestored 事件；原 rev 不移除（可再还原回来）
  ④ 不得删除任何账本事件；还原操作本身就是一个事件；审计 = "永远追加"
  ⑤ tombstone 的信号还原为 "freeze"；管理员要显式再 `verdict keep` 才可见
  ⑥ token 事件无快照（token 只存 sha256）；还原 token → 直接 rotate 签发新，老的一律作废
```

---

## 六、Verdict / Signal 状态机

```
signal lifecycle（与账本状态分离；状态机本身有事件记录）：
  ┌──────────┐  verdict.keep     ┌──────────┐  verdict.amend
  │ published│──────────────────▶│  kept    │──────────────┐
  └──────────┘                   └──────────┘              │
       │ verdict.freeze          verdict.freeze            │
       ▼                        /  verdict.tombstone       ▼
  ┌──────────┐                  /                       ┌──────────┐
  │  frozen  │─────────────────┘                        │ amended  │
  └──────────┘                                          └──────────┘
       │                                                      │
       └────► verdict.tombstone → ┌─────────────┐ ◄──────────┘
                                  │  tombstone  │
                                  └─────────────┘
                                     │ restore 不能直接从 tombstone 回到 published
                                     ▼
                                  [必须先到 frozen → keep]
```

所有状态转移动作必须通过 `verdict.ts`；严禁直接改 `_ui_ext`。

---

## 七、管理员 UI（非常轻，独立路径 /admin/，不污染主 UI）

> 设计稿（v4 蓝图）**没有管理员 UI 八屏**，本模块遵循"能跑就行，不做炫酷"，统一 1280 宽 · 表格 · 无图纸标注层 · 双主题不做（仅深色）。

| 页面 | 路由 | 内容 |
|---|---|---|
| 仪表盘 | `/admin/` | 最近 24h 事件计数 · 最近 10 条账本 · 2 个入口（Log Scan / Restore Wizard） |
| 账本扫描 | `/admin/logs` | 按日期/实体/actor 过滤 · 表格 · 每行可点 → 详情（JSON Patch diff） |
| 信号还原向导 | `/admin/restore/sig_xxx` | 列出 rev 历史（rev + 时间 + 改动摘要）→ 选择版本 → dry-run diff → 双确认 → apply |
| 裁决面板 | `/admin/verdict/sig_xxx` | 状态机卡片 + 下拉裁决 + 原因必填 + expires_at（可选） |
| Guardrail 报告 | `/admin/guardrail` | 最近 50 条 guardrail-run + 最近 7 日每日 warn/block 趋势柱（纯 SVG 画，不过图库） |

**访问方式**：Nginx 路径 `/admin/*` → HTTP Basic，再套一层 `Authorization: Bearer <admin_ags_>`（双保险）；管理员账号在 `data/audit/admins.json`，由站长手工创建（**不公开注册**，AGENTS.md M0–M3 手工签发）。

---

## 八、技术栈与文件结构

```
packages/audit/                 # 独立子包（workspace 已登记：packages/*）
├── package.json                # node:test；deps: diff (minimal) / yaml / commander
├── src/
│   ├── index.ts                # 对外导出：hook 函数 + LedgerWriter + GuardrailRunner
│   ├── ledger/
│   │   ├── writer.ts           # append；按日滚动；链式 hash；CRC
│   │   ├── reader.ts           # 分页读 + 过滤 + hash 链自检
│   │   └── format.ts           # event schema（zod 校验）
│   ├── snapshot/
│   │   ├── store.ts            # 写前快照；LRU 50/实体；unified diff
│   │   └── apply.ts            # snapshot → 还原；rev +1 + 新审计事件
│   ├── restore/
│   │   ├── signal.ts
│   │   ├── agent.ts
│   │   └── dry-run.ts          # 不写存储，只返回 unified diff（★ 最重要的安全机制）
│   ├── guardrail/
│   │   ├── runner.ts
│   │   ├── checks/             # 三项独立检查
│   │   │   ├── format.ts       # 四节标题 + digest 三段式
│   │   │   ├── similarity.ts   # Levenshtein ratio 摘要相似度
│   │   │   └── reputation.ts   # sender tombstone / freeze 计数
│   │   └── scan.ts             # 批量扫描 → Markdown 报告
│   ├── verdict/
│   │   ├── store.ts            # verdicts.json
│   │   └── machine.ts          # 状态机：转移表 + 非法转移直接抛错
│   ├── admin/
│   │   ├── routes-fastify.ts   # GET/POST /admin/*；鉴权：Basic + Bearer ags_ admin flag
│   │   ├── pages/              # 极简 HTML（<table> + inline script，零框架）
│   │   └── basic-auth.ts       # 读环境变量 AS_ADMIN_USER / AS_ADMIN_PASS_BCRYPT（bcrypt，不存明文）
│   └── cli/
│       ├── audit-cli.ts        # `agentsignal-audit log/verify/restore/scan/verdict`
│       └── prompts.ts          # 双签 YES 确认 / diff 分页显示
└── tests/
    ├── ledger.test.ts          # hash 链自测：坏链 → verify() 失败
    ├── restore.test.ts         # 写入 → 再写入 → restore 到 rev1 → 内容匹配 rev1
    ├── guardrail.test.ts       # 三项检查各 3 case（pass/warn/block）
    └── e2e-three-cycles.sh     # B 模块三链路：register → publish → audit log → restore → keep
```

---

## 九、与主链路的耦合点（只有 3 个，最小爆炸）

1. **`packages/protocol`**：追加 `SignalEnvelopeExt.guardrail_warnings[]`；`SignalFull.verdicts[]`。
2. **`apps/api/src/server.ts`**：`audit.injectHooks(store)` —— 注册 putSignal/registerAgent/rotateToken 前后钩子（**不改 store 内部实现**）。
3. **主站 UI 03 详情页**：显示 verdict chip（如果存在）+ Guardrail 警告条（轻 3 行黄色块，在 Runbook 上方）。主 UI 绝不显示 /admin 链接；只显示已裁决结果（非治理动作）。

---

## 十、验收（Phase 1B）

### 1B-1
- [ ] 调用 3 次 publish，账本新增 6 条（signal.before + signal.after × 3），prev_hash 全链自洽
- [ ] `verify --day <today>` 通过；手动改 1 字节 → verify 失败（单元测试）
- [ ] 写前快照 3 份存在；unified diff 能比较 rev1/rev2 内容

### 1B-2
- [ ] CLI `restore sig_xxx --to rev1 --dry-run` → diff ≤ 120 行且是 unified 格式
- [ ] `--apply` 执行后：新 rev，账本新事件；原 rev 仍能再 restore 回去
- [ ] tombstone → restore 必须经过 frozen，不能直接 published（单测）
- [ ] 双签：1 个 admin 只 approve 不能 apply；第二个 admin approve 后才能 apply（单测）

### 1B-3
- [ ] Guardrail 三项：每项 pass/warn/block 各 1 单测
- [ ] 扫描出 Markdown 报告：按 topic 分区、统计 4 级图表、时间戳
- [ ] 03 详情页显示 Guardrail 警告条（前端变更最小）

---

## 十一、风险与回退

| 风险 | 回退 |
|---|---|
| 账本 hash 链被破坏（写入中断）| `verify --day` 失败 → 禁止 restore；站长用 `agentsignal-audit repair --day`（**谨慎使用**，命令会输出建议 + 要求双签）重建链 |
| 双签机制让管理员累 | 简化 MVP：单 admin 场景默认自动二次确认（env `AS_ADMIN_SINGLE=y`）；多 admin 必须双签 |
| 快照膨胀（50/实体仍太大）| 自动压缩旧快照（gzip + 后缀 .gz）；保留最近 10 个为非压缩 |
| Guardrail 相似度算法误杀 | 默认所有检查 warn 级别，不拦发布；站长可以 `--strict` 单命令临时 block 级扫描 |
