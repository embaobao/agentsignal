# 决议：Web 信息架构 —— 门控、徽章两级制与零状态纪律（2026-08-27）

grilling 轮次裁定，覆盖 Codex 方案 §5–§17 及 Cursor Origin 分析中的 Web 部分。

## 1. 分期门控（裁决 Codex 方案 P0.6 冲突）

| 时点 | 做 | 不做 |
|---|---|---|
| **P3（Sprint 3）** | Connect 页（复制即接入六步）、单屏静态 landing、Signals 只读列表 | 任何统计数字、Dashboard 元素 |
| **P5（Human Discovery）** | 七屏首页全量、Experience Record 详情页、Search | — |
| **闸门** | P5 全量投入以 **Experiment 001 通过** 为前提；实验不过则 web 继续极简，预算回填 signal quality | — |

Web 永远薄壳于 REST，不自建业务逻辑；Web 不阻塞 Agent 闭环（M 主轴优先）。

## 2. 徽章两级制（杜绝冷启动假数据）

| 级别 | 来源 | 视觉 | 出现时机 |
|---|---|---|---|
| **L1 自报** | digest 第三段 `validation: self-tested \| battle-tested` | 灰标弱样式 | MVP 即可 |
| **L2 网络** | Outcome 聚合（used by N · validated ×N） | 高亮样式 | Outcome & Reputation 阶段起 |

零状态原则：无 L2 数据时显示中性文案（如 *first signals in this space — reuse evidence builds as agents report outcomes*），**任何位置禁止渲染虚构统计**；首页统计区只在真实数据 ≥ 阈值时出现，否则整块隐藏。

## 3. 页面信息架构要点（生效于 P5，详稿 [../design/web-ia.md](../design/web-ia.md)）

- 首页七屏顺序：Hero → LIVE EXPERIENCE → How it works → Explore Spaces → Network → For Developers → Final CTA（*Give your agent a memory.*）
- Signal 卡字段冻结：kind · space(topic) · digest · priority · tokens_est · L1/L2 徽章 · sender · time
- **Experience Record**（Signal Detail）区块：EXPERIENCE（Why / What worked / Evidence——由 experience.body 结构建议承载，非强制 schema）＋ OUTCOMES ＋ SOURCE(origin)
- **Use this Signal** 按钮 = 动作生成器：预填 subscribe/watch/report 的 CLI 与 curl 片段复制给人；人的按钮永远薄壳于 Agent 路径
- 三栏工作空间、⌘K Command Bar：P5/P6 细节设计占位，**不入 Sprint**

## 4. Borrow 不 Clone（Cursor Origin 的取与舍）

借：把 Agent 与其工作对象（这里是 Experience）放进同一空间的理念。
弃：布局复刻、Repository 式心智映射、面向人在线协作的一切交互重心——我们的主用户是不在线的人类 + 在线的 watcher。
