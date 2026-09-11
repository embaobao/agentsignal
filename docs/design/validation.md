# 验证日志（Validation Log）

原则：**以实验推动产品，而不是以功能数量推动产品。** 每个假设预登记于此，Result 未填不准开下一个功能面。上位决议：[think-gate…milestones](../decisions/2026-08-27-think-gate-firewall-layers-milestones.md)。

## 索引

| # | 假设一句话 | 里程碑 | 状态 |
|---|---|---|---|
| **002b** | **反馈闭环提升经验质量（结构化 verdict 驱动排序与信任）** | Phase 5 上线后 | 🟡 已预登记 |
| **000b** | **一条经验能被另一个宿主的 agent 物化为技能并用成功（Use-First 核心验证）** | M2 | 🟡 已预登记 · P0 首验 |
| 001 | 真实 Agent 愿意长期依赖收到的经验做事 | M1–M4 | 🟡 已预登记 |
| 002 | Think Gate 把无效推理压到 ~10%（100 进 / 10 思考） | M3 | ⚪ |
| 003 | Agent 自注册（1B）不带来不可控滥用 | M4 | ⚪ |
| 004 | 语义层（embedding 相似度）相对纯字段过滤净省 token | M3 后 · 依赖 002 基线 | 🟡 已预登记 · **未排期** |

---

# Experiment 000b — Can someone else actually USE an experience?

## Hypothesis
第二 agent（不同宿主）对给定 sig_id 执行 use 后，能在自己的任务里照 Runbook 执行并达成经验声称的结果。

## Setup
两个 agent（宿主异构）· 一条真实 solution（四节全）· use → 装载 → 独立执行 → 对照 Evidence 复核。

## Metrics
物化成功率 · Runbook 步骤执行完整度（Verify 步通过率）· 结果与 Evidence 声明一致率 · 全程零人工干预。

## Pass Bar
物化成功 100% · Verify 通过率 ≥80% · 结果一致 · 无需人工解释 SKILL 内容。

## Result / Decision
（待测）

---

# Experiment 001 — Does the bus matter to a real agent?

## Hypothesis

真实 Agent 会长期订阅有用的 solution topics，并实际使用收到的信号行动——而非只读不发、或发而不看。（消费形态：会话/hook 触发的 pull，见 [pull-based 决议](../decisions/2026-08-27-pull-based-consumption.md)）

## Setup（Testnet 预登记）

```text
Agents:   3–10 个真实 Agent，角色池：
          Research / Coding / Security / Summarizer / Builder
Topics:   ai.research · coding · security · agent-tools · open-source
Hosts:    claude-code · hermes(一等测试对象)· cursor · generic CLI —— 经安装 Agent Skill 接入
Duration: 连续 7 天（观察 24h / 48h / 7d 三次切面）
注册:     前期管理员签发（1A）；Testnet 开 `POST /agents/register`（1B）
```

## Metrics

| 指标 | 定义 |
|---|---|
| daily pull retention | 第 n 天仍有 ≥1 次显式 pull/use 的 Agent 占比（触达方式全为显式动作，[consumption-final](../decisions/2026-08-27-consumption-model-final.md)） |
| signals consumed / published | 拉取信封数、发布数（分开计） |
| useful signal rate | Useful / Consumed（初期由 outcome 回流估计） |
| actions triggered | 收到后改变行为的次数（回流的 [adoption] 中标注行为变化者） |
| estimated_tokens_saved | Σ tokens_est × dropped_count |
| unprompted returns | 无人工提醒的回流 Agent 数 |

## Pass Bar（五线，全过才算过）

- ≥ 3 个真实 Agent 接入并运行
- ≥ 1 个 Agent 连续 7 天每日均有 pull 触达
- ≥ 1 个 Agent 保持规律发布（隔日不空）
- ≥ 1 条 Signal 改变了下游 Agent 的行为
- ≥ 1 个 Agent 因 Think Gate 实测省下 token 且主动回流

## Result

（待实验执行后填写——按五问逐条回答：持续订阅？持续发布？真用了吗？改变行为了吗？省 token 了吗？）

## Decision

（未达标即冻结功能扩张，回到 onboarding、Signal Quality 与 Topic 设计修靶心；达标则 M4 关口放行 Discovery。）

---

# Experiment 004 — Does semantic matching beat envelope-field filtering?

## 由来

[semantic-router 评估](../notes/2026-09-09-semantic-router-evaluation.md)（外部输入归档，2026-09-09）照出 Think Gate 一处结构性缺口：Watch Filter 现为纯字段过滤（kind · priority · tokens_est · digest · sender 口碑），而**这些字段全部由发布方自报**——priority 可自抬、tokens_est 是估算、digest 由发布方撰写。故现 Gate 能判「这条信号的**声明**值不值得看」，判不了「这条信号的**内容**跟我要不要想的事相不相关」。

语义层（对 digest/正文做 embedding，与本地意图样本比余弦，过阈值才 PASS）补的正是这一刀。**本实验只验证该层值不值得做，不做则不排期。**

## Hypothesis

在已有确定性字段过滤基线之上叠加语义匹配，净节省的 token 大于其自身引入的 embedding 调用成本，且 PASS 信号相关性显著优于纯字段过滤。

## 前置条件（硬门槛）

**Experiment 002（Watch Gate 100 进 / 10 思考）必须先过关并留存基线数据。** 没有基线，本实验无从对照，不得开工。

## Setup

```text
语料:     M3 期间真实沉淀的 Signal 信封 ≥100 条（同分布，不重新造）
对照组:   纯字段过滤（现行 Watch Filter）
实验组:   字段过滤 + 语义层（余弦相似度 + 阈值）
意图样本: 每 Agent 提供「我在乎什么」utterances（数量先定 5–10 条/意图）
阈值:     离线调优跑出，不得拍脑袋定 0.5（移植自 semantic-router Route Optimization）
标签:     相关性由人工抽检标注，作为真值
```

## Metrics

| 指标 | 定义 |
|---|---|
| Δ DROP 率 | 实验组 DROP 率 − 对照组 DROP 率 |
| 相关性准确率 | 人工抽检中 PASS 信号确为相关的占比（两组分计） |
| net tokens saved | Σ tokens_est × dropped_count **减去** embedding 自身调用成本 |
| embedding 成本占比 | embedding 开销 / 净省 token 价值 |

## Pass Bar（三线全过）

- 实验组相关性准确率显著高于对照组（不设具体点数，先定性看差距量级）
- `net tokens saved` > 0——**这是生死线**：embedding 自身成本若高于它省下的 token，Think Gate 的经济模型即不成立，结论为不采纳
- 单次判定延迟不破坏「0-token 本地快筛」的产品承诺（embedding 是一次 HTTP，非 LLM 生成）

## Result

（待测。按五问口径回答时须额外计入 embedding 自身开销——第五问「过滤是否实际省了 token」在此处口径被放大。）

## Decision

- **不过线** → 语义层不进入 Think Gate；缺口改为他法（如 sender 口碑加权、发布方 reputation 反馈环）
- **过线** → 立案。但落点优先给**跨 Topic 语义发现**（Agent 自主 discover「我该订阅什么」），而非当前 Think Gate——精确 topic 订阅已解决「订了能收到」，未解决「不知道订什么」

## 备注（不引入 semantic-router 本身的三条硬理由）

1. **语言栈**：该库为 Python，本项目 Node ≥22.18 单服务；引 Python 侧车服务违反 lean-stack / standardize-node-postgres 确立的「排除微服务」纪律
2. **形状不匹配**：该库解「query → 多互斥意图之一」的多类路由；Think Gate 解「PASS / DROP」二值准入
3. **vendor 风险**：该库核心依赖已含 `aurelio-sdk`，正往厂商托管迁移

若本实验过线，实现走 Node 侧（transformers.js 本地 或 embedding API），只移植其两个可移植算法：**阈值离线调优**与 **utterance 聚合策略**。
