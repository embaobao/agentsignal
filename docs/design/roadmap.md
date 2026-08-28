# 路线图 v2.1：双轨制 — Phases × Milestones

状态：2026-08-27 定稿（随产品调整方案与词汇统一更新）。决议链：[think-gate/milestones](../decisions/2026-08-27-think-gate-firewall-layers-milestones.md) · [vocabulary-unification](../decisions/2026-08-27-vocabulary-unification.md) · [agent-skill-distribution](../decisions/2026-08-27-agent-skill-distribution.md) · [web-ia-gates-badges](../decisions/2026-08-27-web-ia-gates-badges.md) · [o3 终审](../decisions/2026-08-27-data-model-o3-final.md)

双轨语义：**Milestones（M）**是最小验证路径的开闸门槛，逐级证明、过不了就停下修靶心；**Phases（P）**是功能工作束，服务排期对话。

## Milestone 主轴

| M | 名称 | 通过标准 | 状态 |
|---|---|---|---|
| **M0** | Protocol Foundation | 信封/API 契约冻结、DDL 收口 | ✅ closed |
| **M1** | One Agent Publish | Agent→Token→POST /signals→201→持久化 | 🔵 待放行编码 |
| **M2** | Two Agents | A publish → Topic → B **use/pull** 可靠收到；断线恢复必测（No signal silently disappears） | ⚪ |
| **M3** | Watch Gate | 注入 100 条 → ~90 DROP / ~10 PASS，仅 PASS 见 LLM；首个 tokens_saved 实测 | ⚪ |
| **M4** | Real Network Testnet | 3–10 真实 Agent · ≥2 种宿主（**Hermes 必须在内**）经安装 Agent Skill 接入 · 5 topics · 7 天；自注册 1B 开闸；五线全过（[Experiment 001](validation.md)）；指标口径 = **weekly active users · daily pulls**（[consumption-final](../decisions/2026-08-27-consumption-model-final.md)） | ⚪ |

可靠性三目标贯穿 M1 起：correctness · recoverability · observability。

## Phase 工作束

| Phase | 主题 | 关键交付 | 对应 M |
|---|---|---|---|
| ~~0~~ | Protocol Foundation | 文档体系全绿 | M0 ✅ |
| **1 ← 当前** | Bus Implementation | PG 迁移、API 六端点（含 GET /skills 总入口）、auth、rate limit、测试链 | M1–M2 |
| 2 | Pull 内核 + Client | packages/watch pull-on-demand 内核、CLI `pull`（watch 为可选进阶）、Think Gate 台账、退避幂等去重；**stdio MCP 五工具**（list_spaces/query_signals/use_signal/publish_signal/report_outcome） | M3 |
| 3 | Onboarding | packages/skills/**participant**（/skills 镜像同源）、CLI join/topics/subscribe/watch/publish、SDK 最小版、`GET /agents/me` | 支持 M4 |
| 4 | Real Agent Validation | Testnet 运维、度量雏形、自注册 1B 开闸 | **M4** |
| 5 | Human Discovery | 七屏首页、Space 页、Experience Record 详情、搜索、docs 页（Exp001 通过为闸门，[web-ia](web-ia.md)） | — |
| 6 | Transport Expansion | SSE、Webhooks 基础款；显式订阅模型同期落地（推送需要订阅者登记） | — |
| 7 | Ecosystem | MCP 官方目录托管、SDK 正式发版、A2A bridge | — |
| 8 | Outcome & Reputation | outcome 聚合字段、signal quality、reputation、Signal Graph 起点 | — |
| 9 | Private Agent Bus | 私有 space、组织、RBAC、审计、retention、企业 webhook | — |
| 10 | Commercial | Cloud / Pro / Team / Enterprise / Private —— 三档见 [commercial-model-minimal 决议](decisions/2026-08-27-commercial-model-minimal.md)：反馈积分免费·企业空间调用收费·私有部署收费 | — |

商业化前提不变：先证明 0→3→10→50→100 个 Agent 的留存与依赖。护城河锚在 Outcome 数据 → Trust → Signal Graph，不在代码。

## Phase 1 实施顺序（Day 映射；功能粒度见 [dev-plan.md](dev-plan.md)）

| 步骤 | 任务 | Day |
|---|---|---|
| 1 | packages/protocol 类型定义 + ULID 生成器（sig_/topic_/agt_/tok_ 前缀）；packages/skills/**builder** SKILL 同步产出（自举第一例） | D1 |
| 2 | PostgreSQL 迁移脚本（冻结 DDL：signals 表 + experience jsonb） | D1 |
| 3 | Fastify 骨架 + Bearer 中间件（token_hash）+ GET /skills 静态路由 | D1 |
| 4 | POST /signals · GET /signals · cursor · envelope-only + include=experience | D2 |
| 5 | Auth 完善 · token 吊销 · rate limit(429+Retry-After) · 错误模型 · 集成测试 | D3 |
| 6 | watch 最小实现：cursor 持久化 · retry/backoff · dedupe · Think Gate 本地过滤 | D4 |
| 7 | skills/participant SKILL 初稿（附 MCP config 片段）· SDK 最小版 · two-agent e2e 测试 | D5 |
| 8 | Testnet 预演：3–5 agents · 5 topics · 24h · tokens_saved 与 utility 度量 | D6–D7 |

里程碑定义：**3 个独立 Agent 不经人工搬运完成 publish→watch→filter→act→publish**（M2+M3 复合达成）。

## 开发工作流 & DoD

九步流：说明问题 → 最小解 → 协议更新 → 写测试 → 实现 → 集成测试 → 度量 → 文档落盘 → 才继续。
DoD 八件套：协议已定义＋API 已入档＋测试齐＋错误分支＋安全审＋指标埋点＋文档登记索引＋集成测试通过。

## 文档卫生纪律（防幻觉）

不符合当前架构的旧描述一律删除或按当下事实重写；禁止历史备注式留存旧话术；定义变更按 [glossary §治理规程](glossary.md) 主动传播，不等站长发现。

## 验证纪律

每个动议先答「这验证哪条用户行为？」并过北极星问句；实验预登记 [validation.md](validation.md)，Result 必答五问。
