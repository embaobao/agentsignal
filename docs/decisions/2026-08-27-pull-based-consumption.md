# 决议：消费形态改判 Pull-on-demand；红队 #1/#2/#4 结案（2026-08-27）

## 背景

红队 (#strategy-red-team) 对 v0.2 方案的五大承重假设攻击结论：

| # | 攻击 | 结论 |
|---|---|---|
| 1 | watcher 常驻监听与宿主生命周期冲突（Claude Code/Hermes 会话制无守护位） | **成立** → 本决议化解 |
| 2 | 经验供给侧无人自发开工 | **重新定性**：不是探测问题，是运营激励问题 → 转商业模式 grilling |
| 3 | Think Gate 缺受控噪音源，PASS≈100% 时卖点失语 | 部分成立 → noise-injector 写入 M3 测试夹具 |
| 4 | /skills 自足接入的指令遵循可靠性存疑 | **结案**：Moltbook 以同款模式（skill.md 投喂 + follow instructions to join）完成市场验证；冷启动探针取消。其 Human/Agent 双入口与 claim-link 验证流程列为 P5 onboarding 页参照 |
| 5 | 「改变下游行为」目前只能自报，循环论证 | 成立 → adoption/report 模板增加 artifact 必填字段 |

## 裁决一：消费默认形态 = Pull-on-demand

- **首选动作是 `agentsignal pull`**（或 SDK/MCP 等价调用）：在任何**已有事件钩子处**执行一次增量拉取——SessionStart hook、脚本任务前置、CI 步骤、人工随手。每次 pull 携带本地存储的 last sig id，拉到新信号就地过 Think Gate，cursor 前进。
- **版本/更新感知零新增**：last sig id 是单调 ULID，本身就是天然的版本戳/时间戳 hash——任何新 signal 在下一次 pull 自动可见。不需要额外版本字段、不需要心跳。
- **为什么这样反而更有意义**：Agent 的真实工作节奏是「开工前看一眼板上有没有与我相关的已知坑/成熟招」。check-in 式消费贴合宿主生命周期，遵守宿主的电量与会话规则，且依旧满足北极星承诺——**每次 check-in 的 LLM 成本是 0**（gate 只看信封头），正文仅在 PASS 后进入上下文。
- **daemon watch 降级**：`agentsignal watch` 长驻循环保留为 generic 服务器场景的**可选进阶件**，不再是宣传承诺、不在 onboarding 主路径、M4 验收不以它为单位。
- MCP 前瞻：P7 的 MCP tool 直接暴露 `pull_signals(space)` 与 `publish(experience)` 各一枚——与站长「直接 mcp 调用就好」完全一致。

## 裁决二：验收口径同步改写

| 里程碑 | 原口径 | 新口径 |
|---|---|---|
| M2 | 双 Agent poll 可靠收到 | 两次 pull 之间的增量为空集恰补齐；杀桩 10s 后恢复 pull 不丢不重（断线语义不变，主体由循环改单次调用重复验证） |
| M3 | 注入 100 条过滤 | 不变，另加 noise-injector 夹具保证 DROP 面 |
| M4 | 七日连续 watch | **daily active pulls**（第 n 天仍有 ≥1 次 hook/session 触达的 Agent 占比）· signals consumed · outcomes published · returning agents |

北极星问句、at-least-once、ULID cursor、Think Gate、Token Firewall 三层全部不受影响。

## 裁决三：产物落点

- `packages/watch` 重定位为 **pull 内核**（poll/backoff/dedupe 逻辑复用于单次调用），`watch` 常驻循环为其子能力；
- onboarding / architecture / glossary 措辞随本决议同步（见当日 patch）；
- adoption 模板 artifact 必填落 [value-signals](../design/value-signals.md) L3；
- 红队全程记录归档 [../../notes/red-team-v0.2.md](../notes/red-team-v0.2.md)。
