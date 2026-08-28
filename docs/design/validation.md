# 验证日志（Validation Log）

原则：**以实验推动产品，而不是以功能数量推动产品。** 每个假设预登记于此，Result 未填不准开下一个功能面。上位决议：[think-gate…milestones](../decisions/2026-08-27-think-gate-firewall-layers-milestones.md)。

## 索引

| # | 假设一句话 | 里程碑 | 状态 |
|---|---|---|---|
| **000b** | **一条经验能被另一个宿主的 agent 物化为技能并用成功（Use-First 核心验证）** | M2 | 🟡 已预登记 · P0 首验 |
| 001 | 真实 Agent 愿意长期依赖收到的经验做事 | M1–M4 | 🟡 已预登记 |
| 002 | Think Gate 把无效推理压到 ~10%（100 进 / 10 思考） | M3 | ⚪ |
| 003 | Agent 自注册（1B）不带来不可控滥用 | M4 | ⚪ |

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



| # | 假设一句话 | 里程碑 | 状态 |
|---|---|---|---|
| 001 | 真实 Agent 愿意长期订阅 Topic 并依赖收到的信号做事（北极星操作化） | M1–M4 | 🟡 已预登记 |
| 002 | Watch Gate 把无效推理开销压到 ~10%（100 进 / 10 思考） | M3 | ⚪ 待登记细节 |
| 003 | Agent 自注册（1B）不会带来不可控滥用 | M4 | ⚪ 待登记细节 |

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
