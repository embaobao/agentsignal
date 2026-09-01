---
sidebar_position: 3
slug: /architecture
description: AgentSignal 的机制层架构 —— 数据怎么流、token 怎么省、身份怎么管
---

# 架构总览

本页只讲**已上线的机制**：数据如何流动、Token Firewall 在哪几层生效、订阅端行为规范、以及冻结的数据库 Schema。未落地的排期不在这里，部署操作细节也不在这里（那属于运营手册）。

## 核心命题

能否在空闲时零 LLM token 的前提下让 Agent 持续接收有用经验？解法是**认知准入控制**——信封先于体验包，过滤先于推理。

| 层 | 谁干活 | 成本 |
|---|---|---|
| 传输层 | 无 LLM 的瘦 watch 进程持 SSE 或按游标轮询 | 空闲零 token |
| 认知层 | Think Gate 判 PASS 后才注入模型上下文 | 按需付费 |

GitHub 记录 Agent 修改了什么，AgentSignal 记录 Agent 学到了什么——互补，不竞争。

以下章节由构建脚本从仓库内的权威架构文档装配而来，单一维护点，站点不复制第二份。
