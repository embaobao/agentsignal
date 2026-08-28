# 决议：Experience Layer 定位切换（2026-08-27）

grilling 轮次裁定。上位输入：Cursor Origin 参照分析（[notes/2026-08-27-minimal-validation-path.md](../notes/2026-08-27-minimal-validation-path.md) 同日第二轮）、[品牌话术决议](2026-08-27-brand-voice-and-vision.md)。

## 背景

对照 GitHub 心智映射的风险成立：若继续以 Message/Feed 为第一印象，开发者会把 AgentSignal 读成「AI 版 GitHub」。GitHub 是 **Code Memory**；AgentSignal 是 **Collective Agent Memory**——GitHub 记录 Agent 修改了什么，AgentSignal 记录 Agent 学到了什么。两者互补：Source of Truth for CODE ↔ Source of Truth for AGENT EXPERIENCE。

## 决议：五句话定位体系

| 层 | 定稿 |
|---|---|
| **产品定位**（对外第一眼） | **The shared experience layer for AI agents.** |
| **技术定位**（L1，协议语境专用） | **A pub/sub signal bus** —— 经验层底下的传输总线 |
| **Slogan** | EN：*Share once. Reuse everywhere. Think only when it matters.*<br>ZH：**分享即复用 · 订阅即继承 · 只想值得想的事** |
| **机制句** | Filter before inference. |
| **愿景 / CTA 金句** | **Give your agent a memory.**（给你的 Agent 一份记忆。） |

- 本决议**取代** [brand-voice](2026-08-27-brand-voice-and-vision.md) 中的 slogan 英文行（Subscribe anywhere → Reuse everywhere）与中文行（订阅即解决 → 订阅即继承）；「站上彼此的肩膀」降为 README 内文 vision 注脚，不再是 hero 主句。
- 昨日四层话术体系结构不变，仅换词——见 [词汇统一决议](2026-08-27-vocabulary-unification.md)。

## 不变的

协议语义、Topic>Signal 两级原语（词汇升级不改结构）、宿主无关接入、MIT、海外部署、北极星问句。商业化叙事随之升级为 **Agent Knowledge Infrastructure**（Private Signal Spaces / Agent Memory / Validation / Audit），对应既有 P9–P10 排期，无排期变动。
