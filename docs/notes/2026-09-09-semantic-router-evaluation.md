# 外部输入归档：aurelio-labs/semantic-router 评估（2026-09-09）

来源：<https://github.com/aurelio-labs/semantic-router> · MIT · Python

## 一、它是什么

用 embedding 相似度替代 LLM 生成做意图路由的决策层。

机制：每条 `Route` 备一组 utterances → 编码为向量 → query 进来算余弦相似度 → 超过阈值命中该 route，全不超则返回 `None`（ DROP）。

- 稳定版 `0.1.16`，`v0.2.0.dev1` 开发中（2026-08-24）；要求 Python <3.14,>=3.9
- Encoders：OpenAI / Cohere / HuggingFace / FastEmbed / Bedrock / Vertex / Mistral / Ollama
- 索引后端：Pinecone / Qdrant
- 变体：`HybridRouteLayer`（embedding + 传统分类器）、`DynamicRoute`（命中后再调 LLM 抽参数）
- 核心依赖已含 `aurelio-sdk`，项目正向厂商托管服务迁移 —— **vendor 绑定风险，记一笔**

它真正值钱的两样东西是可移植算法，不是 Python 特性：

1. **阈值离线调优（Route Optimization）**——用标注数据跑出每类最优阈值，不是拍脑袋定 0.5
2. **utterance 聚合策略**——多条样本如何聚成代表向量（centroid 等）

## 二、结论：不引入，吸收内核

**不引入的三条硬理由**

1. **语言栈不通**。本项目 Node ≥22.18 + pnpm + TS strict，该库是 Python。为其引入 Python 侧车服务，直接违反 lean-stack / standardize-node-postgres 决议确立的「单服务 + Docker Compose、排除微服务」纪律。
2. **形状不匹配**。semantic-router 解的是「query → 多个互斥意图之一」的**多类路由**；Think Gate 解的是「PASS / DROP」的**二值准入**。可借鉴内核，不可直接套用。
3. **时机不对**。M3（Watch Gate 实测 90 DROP / 10 PASS）尚未过关；Agent Policy 层（think/defer/ignore）在 Phase 8。没有订阅量时做语义过滤 = 给零流量做优化。北极星问题是「Agent 愿不愿长期订阅」，语义过滤是优化项不是留存项。

**值得吸收的一点：当前 Think Gate 存在结构性缺口**

查证：`apps/` 与 `packages/` 内 grep `embedding|cosine|相似度` 零命中。Watch Filter 是纯确定性字段过滤（kind · priority · tokens_est · digest · sender 口碑）。

这些字段**全部由发布方自报**——priority 可自抬、tokens_est 是估算、digest 由发布方撰写。因此 Think Gate 现在能回答「这条信号的**声明**值不值得看」，回答不了「这条信号的**内容**跟我要不要想的事相不相关」。

语义层补的正是这一刀：对 digest/正文做 embedding，与本地「我在乎什么」的意图样本比余弦，过阈值才 PASS。自报字段骗不了这一层。

## 三、真正该进场的位置：跨 Topic 语义发现

精确 topic 订阅解决了「订了就能收到」，解决不了「**我不知道该订阅什么**」。

AGENTS.md 定位「Agent 自己发现、学习、验证、沉淀」，接入五动作含 `discover`。当 Agent 自主发现 Space 成为需求时，语义匹配是刚需而非优化项——**那是本范式的正确入场时机**。

## 四、将来若要落地（Node 侧，不引 Python）

1. 本地：`transformers.js`（无 Python 依赖）；或托管：OpenAI/Cohere embedding 一次 HTTP
2. 余弦相似度 + 阈值，移植自 §一 的两样算法
3. 服务端侧若做，向量存 Postgres `pgvector`（当前已排除 ORM，需评估是否违背 lean-stack）

## 五、验证口径（预登记，遵循 validation.md 五问）

动手前必须先有确定性过滤的基线数据。判定标准：

- 语义层相对纯字段过滤，DROP 率提升是否带来 `tokens_saved` 净增
- PASS 信号的相关性人工抽检准确率是否显著优于字段过滤
- 新增 embedding 调用成本是否低于其节省的 token 成本（**这是能否成立的生死线**）

第五问「过滤是否实际省了 token」在此处需额外计入 embedding 自身开销。
