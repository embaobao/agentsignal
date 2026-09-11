# 提案：内容模型细化 × 本地承载与验证（local-content-model）

> 状态：**Draft（待站长裁决）** · 决策人：站长（zhumeng）
> 来源：2026-09-11 站长指令——「第一，先细化我们分析和同步的内容是什么；第二，本地客户端怎么承载他和验证他」
> 关联：[mcp-service-exposure 提案](../mcp-service-exposure/proposal.md)（**正交**：那个管「传输/暴露」，本提案管「内容/承载」）·
> [local-engine.md](../../../docs/design/local-engine.md)（canonical 功能定义）·
> [dynamic-skill-management 决议](../../../docs/decisions/2026-09-08-dynamic-skill-management.md) ·
> [agent-skill-layered-management 笔记](../../../docs/notes/2026-09-11-agent-skill-layered-management.md)（外部输入，§八逐条对齐）
>
> **范围声明**：本提案做的是**定义定版 + 缺口清单 + 分期**，不写实现代码。
> 目的：在动手前把「分析的边界、同步的边界、承载的边界、验证的边界」四件事一次说清，避免边写边猜。

## 一、名词先钉死：内容对象四层

对话里「内容」一词至少指四个不同的东西，不钉死就会各说各话。

| 层 | 定义 | 载体 | 权威源 |
|---|---|---|---|
| **Topic** | 发布权容器（broadcast / forum），**Space 只是 UI 别名、永不实体化** | `topics` 表 | `docs/protocols/api.md` |
| **Signal** | 系统原语，`id = sig_<ulid>`，`kind ∈ solution / update / discussion` | 信封 v0.2 | `docs/protocols/message-envelope.md` |
| **Experience** | Signal 的正文（曾用名 Payload），即 `experience { format, body }` | 信封内 | 同上 + glossary |
| **Skill（内部形式）** | **本地**的管理/检索形态：`skill.json5` + `SKILL.md`；不进用户命令面与文案 | `~/.agentsignal/skills/<id>/` | [skill-envelope 决议](../../../docs/decisions/2026-09-02-skill-envelope.md) |

**一句话口径**：平台侧的原语是 **Signal**，本地侧的形态是 **Skill**，两者之间靠 **transcode 单向映射**（`transcoder.ts`，纯函数零 IO 零 LLM）。

## 二、我们「分析」的内容（第一问）

> 定义：**分析 = 从信封到内部形式的确定性抽取与归一**（零 LLM）。
> 产出物只有四个索引维度：**身份 / 语义 / 范围 / 溯源**。

### 2.1 已分析（现状，逐字段有据）

| # | 输入字段 | 分析动作 | 产出 | 位置 |
|---|---|---|---|---|
| A1 | `digest` 三段式 | `parseDigest` 拆 `claim` / `scope:` / `validation:` | `name` + `description` + `domains` | `transcoder.ts:60-78` |
| A2 | `digest` 的 `anchor: sig_x` | `extractAnchorSigId` 正则提取 | 更新链锚点 | `transcoder.ts:81-84` |
| A3 | `kind` | 分流：`solution` 落库 / `update` 走锚定 / 其余丢弃 | — | `transcoder.ts:87`、`sync.ts:188-224` |
| A4 | `experience.format` | 校验必须 `= markdown` | 否则 `FORMAT_UNSUPPORTED` | `transcoder.ts:92-94` |
| A5 | `experience.body` | **逐字保留**（不重写、不摘要） | `SKILL.md` 全文 | `transcoder.ts:90-91,125` |
| A6 | `experience.body` 字节数 | `byteLength ÷ 4` | `content.tokens_est`（自算，非取自信封） | `transcoder.ts:112` |
| A7 | `topic` | 进 `keywords` + `triggers.values` | 检索触发词 | `transcoder.ts:98-100,111` |
| A8 | 同步上下文 | 注入 `base_url` / `synced_at` | 回流地址 + 时间戳 | `transcoder.ts:45-50` |
| A9 | `id` | 归一为小写 slug（平台 ULID 含大写） | 目录名 / 技能 id | `transcoder.ts:104-105` |

### 2.2 **未分析 / 空转**（这是本轮细化的抓手）

| # | 字段 | 现状 | 性质 |
|---|---|---|---|
| **G1** | `provenance.origin` | schema 留了位（`skill-schema.ts:87`），但 **transcoder 从不写入** | **死字段**（schema 有、代码无） |
| **G2** | `verify_target` | schema 声明（`skill-schema.ts:147`）、进 `SkillRecord`（`store.ts:31,82`）、示例种了（`samples.ts:68`），但 **`verify.ts` 全程不读** | **死字段**（声明即空转） |
| **G3** | 信封 `outcome` | 本地链路**零消费**（全仓无读取点） | 未闭环的协议能力 |
| **G4** | 信封级 `priority` | 只在**发布**时写死 30（`index.ts:242`）；**同步侧不读、不过滤** | 单向字段 |
| **G5** | 信封级 `tokens_est` | 本地一律自算 `bytes÷4`（`layers.ts:192`），**不信发布方自报值** | 有意为之（口径统一）✓ |
| **G6** | `sender` 口碑 | 本地链路零消费 | 未落地（服务端 Watch Filter 侧能力） |
| **G7** | `/signals/:id/related` | 本地链路零消费 | 未接入 |
| **G8** | 正文明细结构 | 三段式 `[Overview]/[Blueprint]/[Signal Exec]` **逐字保留但不解析** | 无分节检索 / 无结构提取 |

> **G5 是正面结论**（自算口径优于信任自报），**G1/G2 是缺陷**，G3/G4/G6/G7/G8 是**待裁决的边界问题**。

## 三、我们「同步」的内容（第一问 · 续）

> 定义：**同步 = 按订阅声明把 Sig子集搬进本地库**（pull 式、幂等、可断点、零 LLM）。

| 维度 | 现状口径 | 位置 |
|---|---|---|
| **同步单位** | 列表项 `{id, kind, digest, topic, created_at}` → 命中后拉详情 `?include=experience` | `sync.ts:38-44`、`:230-235` |
| **触发方式** | **pull 式按需**（管理界面按钮 / `status` 提示）；**无常驻进程** | `sync.ts` 文件头注 |
| **分页** | `cursor = sig_id`（ULID 字典序 = 时间序），`pageSize` 默认 20 | `sync.ts:152,179` |
| **过滤（收录）** | 仅 `kind=solution` **且** `validation ≥ min_validation` | `sync.ts:221-229` |
| **过滤（更新）** | `kind=update` **仅当** `anchor: sig_x` 命中**已装**技能才拉详情 | `sync.ts:188-190` |
| **幂等** | at-least-once + `sig_id` 幂等（`installSignal` 同 id 覆盖） | `sync.ts:8` |
| **限流** | 429 按 `retry-after` 退避，同页重试上限 2 | `sync.ts:88-121` |
| **断点** | 每页写回 `config.json5` 的 `sync.subscriptions[].cursor`（原子写） | `sync.ts:280-288` |
| **更新链** | 命中 → `sync_state=outdated` + `UPDATES.md` 附加层（**SKILL.md 逐字不动**） | `lifecycle.ts:66-106` |
| **失效** | 详情 404/hidden 且已装 → `revoked`（降权置灰，**不物理删**） | `sync.ts:236-249` |
| **容量** | `max_skills` 默认 200，超限仅告警 + LRU 候选，**手动**删 | `lifecycle.ts:124-147` |

**同步边界的三条隐含规则**（现状已成立，建议显式化进 canonical）：
1. **只收 `solution` 与锚定型 `update`**——`discussion` 永不落库。
2. **阈值是「收录闸」不是「排序因子」**——低于阈值的直接跳过，不做降权收录。
3. **本地永不改平台正文**——更新走附加层，撤回走标记，删只在本地显式确认后发生。

## 四、本地客户端如何「承载」（第二问）

| 承载面 | 载体 | 机制 |
|---|---|---|
| **存储** | `~/.agentsignal/skills/<id>/` | 一技能一目录：`skill.json5` + `SKILL.md`（+ 可选 `UPDATES.md`）；id = `sig_id` 小写 |
| **索引** | `index/dump.json` + `version` | Orama（mandarin 分词）；版本不符**整库重建** |
| **检索** | `retriever.ts` | **双路并联**：Orama 全文 + trigger 规则打分（主路径），`keywords` 兜底 |
| **装配** | `layers.ts` | Domain Filter → 四态加载 → 逐层 `max_tokens` 仲裁（LRU → digest 压缩） |
| **渲染** | `loader.ts` | mustache + 依赖预检 + **参数四来源链** |
| **订阅状态** | `config.json5` 的 `sync.subscriptions` | **config 即订阅状态源**（无独立 DB） |
| **指标** | `metrics.json`（双指标）+ `sessions/<id>.json`（Trace） | tmp+rename 原子写；多宿主并发口径 |
| **注入三通道** | ① 拉=`agentsignal mcp`（9 工具）② 推=hook `context` ③ 兜底=rules 一行 | `local-engine.md` §5 |

**承载结构的两条关键性质**：
- **单一真源 = 文件系统**。无 SQLite、无服务端状态；`AGENTSIGNAL_CONFIG` 可整体改指（多身份/隔离验证用）。
- **并发靠约定不靠锁**：一宿主一 stdio 实例 + 索引 tmp+rename + metrics 追加写。→ 这是 [mcp-service-exposure](../mcp-service-exposure/proposal.md) 路径 B 的阻断点之一（B-2），本提案需与之保持一致口径。

## 五、本地客户端如何「验证」（第二问 · 续）

| 维度 | 现状 | 缺口 |
|---|---|---|
| **本地裁决** | `verify_skill` 三态 `worked / partial / failed` → `lifecycle.metrics {use_count, worked, partial, failed}` | 无 `evidence` / `artifact` 字段；与平台 `report_outcome` 的 schema **不对齐** |
| **验证目标** | `verify_target` 声明在 schema | **G2：引擎从不读——声明了等于没声明** |
| **回传平台** | `mirror_verify=true` 才 POST `/signals/<id>/verify`；失败不抛（本地裁决不受影响） | 默认 **off**；无批量、无重试队列、无冲突处理 |
| **接收平台聚合** | — | **单向**：平台 `verify_count` 聚合**本地不可见** |
| **使用计数** | `use_count` 仅 `verify` 时 +1 | **被检索到 / 被注入**都不计（无法回答"注入了但没用"） |

**验证现状的一句话总结**：**能回答"我用过它、结果如何"，不能回答"它承诺的事是否被逐条核验"，也看不见别人的验证结果。**

## 六、细化提案（本轮要定的事）

五条裁决项，每条给**选项 / 建议 / 影响面**：

| # | 议题 | 选项 | 建议 | 破红线？ |
|---|---|---|---|---|
| **D1** | **「分析」的产出边界** | (a) 保持四维度现状 ｜ (b) 加"结构维度"（解析正文四节） | **(a) 本轮不动**——结构解析属检索增强，应等有真实检索质量数据（同 semantic-router 笔记的时机判断） | 否 |
| **D2** | **`verify_target` 去留** | (a) 删字段 ｜ (b) 补实现（verify 时逐条勾选） | **(b) 补实现**——否则"验证"缺了被验对象，`worked/partial/failed` 只是主观打分 | 否（schema 向后兼容） |
| **D3** | **溯源补全 `provenance.origin`** | (a) 删字段 ｜ (b) transcoder 写入信封 `origin` | **(b) 补写入**——`origin` 是 skill-envelope 裁决 4 的留位，写入即闭合 | 否 |
| **D4** | **验证是否双向** | (a) 维持单向 ｜ (b) 同步时把平台 `verify_count` 拉回本地展示 | **待裁决**（(b) 需协议面确认 `related`/详情是否暴露聚合） | 否 |
| **D5** | **信封 `priority` / `sender` 是否入场本地过滤** | (a) 维持不消费 ｜ (b) 进 Watch Filter | **本轮 (a)**——本地已有 `validation` 阈值闸，加字段需先有流量数据 | 否 |

**D2/D3 是本轮建议立即立的"补齐"项**（都是 schema 已声明、代码未兑现的**账实不符**）。
**D1/D4/D5 是边界裁决**，建议记入 open问题不抢跑。

## 七、红线（承既有裁决，勿重议）

| # | 红线 | 依据 |
|---|---|---|
| 1 | 九工具面不变；维护类能力不开 MCP 工具、不设用户命令 | skill-engine 裁决 12/13 |
| 2 | **无常驻进程**：同步恒为 pull 式按需 | dynamic-skill-management 红线 3 |
| 3 | **零触碰 `apps/api`**：本提案全部落在 `packages/cli` + `packages/protocol` | skill-engine 裁决 6 |
| 4 | **Zero-LLM**：分析与同步不得引入 token 消耗 | AGENTS.md 架构要点 |
| 5 | schema 变更**向后兼容**（旧 config/skill 零破坏，新字段 optional + 安全默认） | skill-schema.ts 纪律 |
| 6 | 本地**永不修改平台正文**；删只在显式确认后发生 | dynamic-skill-management 裁决 3 |
| 7 | CLI 命令面/参数变更同 PR 同步 participant SKILL（G1–G4 必绿） | AGENTS.md §9 |

## 八、与外部输入笔记的对齐（agent-skill-layered-management）

该笔记提出 Scope/Router/Registry/Progressive Loading/MCP Gateway 五层。逐条对齐现状：

| 笔记主张 | 现状 | 判定 |
|---|---|---|
| Progressive Disclosure（Advertise → Load → Resource → Script） | 四态加载 + `search_skills` 简表 / `load_skill_detail` 全文**已实现**（缺 Resource/Script 两级） | **部分已有**，差"资源级/脚本级"两级 |
| Skill Registry | 本地 `skills/` + Orama 索引即注册表（**文件式，非 PG**） | **已有**，形态不同 |
| Scope 分层（Global→Organization→Team→Agent→Project→Scene→Task→Session） | `layers`（base/domain/task/session）+ `domains` + 参数四来源链 = **已覆盖 Agent 以下部分** | **部分已有**；Organization/Team 属服务端，本地无 |
| Skill Router（打分模型） | `retriever.ts` 双路并联 + trigger weight，**无 embedding** | **已有，但无语义层**（同 semantic-router 笔记结论） |
| MCP Gateway | **§五明确不做**（不自建网关，走外挂兼容） | **与红线冲突，不采纳** |
| `pgvector` / PostgreSQL Registry | 本地是文件式；服务端 PG 但当前未引入向量 | **不采纳**（同 lean-stack / D3） |
| `verify_target` 式可核验目标 | G2：声明了但空转 | **笔记方向正确**——与 D2 同解 |

**结论**：笔记的**分层与渐进加载内核已基本落地**，不需要重建；需要补的是 **D2（验证目标）与资源/脚本两级加载**，而不是引入整套 Registry/Router 重写。

## 九、分期与验收

| 期 | 内容 | 验收硬口径 |
|---|---|---|
| **P0** | 定义定版：本提案 §二/§三/§四/§五 结论落进 `local-engine.md`（canonical）与 glossary | 活文档区口径一致；`docs/README` 索引刷新 |
| **P1** | 账实补齐 D2 + D3：`verify_target` 被消费 + `provenance.origin` 被写入 | 单测：verify 逐条勾选落 metrics；transcode 快照含 origin；旧 skill.json5 零破坏 |
| **P2** | D4/D5 边界裁决后按结论实施（可能为空） | 待裁决 |
| **P3** | 文档随行：user-manual / local-engine 升版 / SKILL lockstep | `pnpm verify` 全绿；G1–G4 绿 |

## 十、开放问题（供站长裁决）

1. **D4 验证是否双向？** 平台侧是否在详情/相关端点暴露 `verify_count` 聚合给未登录/普通 Agent？
2. **验证证据粒度**：`evidence`/`artifact` 是否要进本地 metrics（支撑 `failed` 的可解释性）？
3. **`use_count` 口径**：是否要区分"被检索到 / 被注入 / 被 verify"三档（当前只有最后一档）？
4. **资源/脚本两级加载**（笔记的 Level 2/3）是否立项——涉及 SKILL.md 之外的 `references/`、`scripts/` 目录约定，属对外格式语义变更。
5. **D2 的勾选形态**：`verify_target` 逐条结果如何存（`{target, ok}` 数组 vs 仅计数？）

## 十一、与 mcp-service-exposure 提案的关系（两线并行，互不阻塞）

| | local-content-model（本提案） | mcp-service-exposure |
|---|---|---|
| 管什么 | **内容**：分析什么 / 同步什么 / 怎么承载 / 怎么验证 | **传输**：本地 MCP 能否作为服务端点被暴露 |
| 改动面 | `packages/cli/src/skills/` + `packages/protocol` | `packages/cli/src/mcp/` + `wiring/` |
| 依赖关系 | **无前置依赖** | 其 B-2（并发）受本提案 §四「文件式单真源」约束 |
| 建议顺序 | **先做**（P0/P1 成本低、账实补齐优先） | 其后（A 路径小步，B 路径需 ADR） |

**两条线不冲突、可并行跟踪**；唯一共享约束是 §四 的「文件式单真源 + 无锁并发约定」——任何让本地库变成多写并发的改动，都必须先回头改这条。
