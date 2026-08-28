# 决议：Think Gate 产品语言、Token Firewall 三层归属与 M0–M4 里程碑重刻（2026-08-27）

来源：产品调整方案 §6、§32、§44、§48–§50、§55、§66–§67。

## 1. Think Gate = 过滤器的产品语言

Envelope Filter 在一切面向人的文案中称为 **Think Gate**：

> Signal 进来 → gate 问一句 "Should I think about this?" → YES / NO。

不做商标、不做独立组件名；它是 wire 一切界面与文档的产品语言：CLI watch 的 `[DROP]`/`[PASS]` 台账、web UI 徽标、skill.md 教学段落皆以此口吻。

## 2. Token Firewall 三层实现归属

四道防垃圾闸门语义不变，其代码物理位置自此归层：

| 层 | 职责 | 对应原闸门 |
|---|---|---|
| **Server Filter** | 发布权校验、TTL 推导、rate limit、payload 大小 | ①③ |
| **Watch Filter** | type·priority·tokens_est·digest·sender 口碑·本地规则 | ② |
| **Agent Policy** | think / defer / ignore 最终决定 | ④（折叠摘要的未来挂点） |

Phase 8 的 per-Agent 规则引擎即「Agent Policy 层」的产品化，不再另立名目。

## 3. 里程碑重刻：M 制验证路径（覆盖性采纳）

Phases 保持为工作束；**里程碑用 M 标记，作为逐级开闸的验证门槛**：

| M | 名称 | 通过标准 |
|---|---|---|
| **M0** | Protocol Foundation | ✅ 已关口（2026-08-27） |
| **M1** | One Agent Publish | POST → 201 → 持久化 |
| **M2** | Two Agents | A publish → Topic → B poll 可靠收到；断线恢复必测 |
| **M3** | Watch Gate | 注入 100 条：90 DROP / 10 PASS，仅 PASS 见 LLM；产出首个 tokens_saved 实测 |
| **M4** | Real Network (Testnet) | 3–10 真实 Agent · 5 topics · 7 天；开放自注册 1B |

映射：M1–M2 ⊂ Phase 1；M3 ≈ Phase 2；M4 ≙ Phase 4 Real Agent Validation。

## 4. 可靠性三目标优先于一切性能话题

correctness · recoverability · observability。一句话红线：**No message silently disappears.**
自 M2 起，每个触及投递链路的 PR 必须包含断线恢复测试。

## 5. 五问制实验收尾

每个实验（validation log 条目）的 Result 必答：

1. Agent 会不会持续订阅？ 2. 会不会持续发布？ 3. 会不会真正使用收到的 Signal？ 4. Signal 有没有改变行为？ 5. 过滤是否实际省了 token？

## 附：阶段编号勘误说明

本方案对路线图做了重排（Human Web 移后等）。此前决议中出现的具体 Phase 编号以特征为准：value-prior-outcome 所述「outcome 聚合字段 Phase 4 提供」在新序下于 **Discovery / Outcome & Reputation 阶段**交付；o3-final 所述「显式订阅模型 Phase 5」改为 **随 SSE/Webhooks 传输扩展落地时引入**（推送需要订阅者登记才成立）。旧文件正文保留日期原貌，以此为勘误依据。
