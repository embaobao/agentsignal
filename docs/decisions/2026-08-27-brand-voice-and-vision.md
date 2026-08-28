# 决议：品牌话术分层——从技术定义到用户获利叙事（2026-08-27）

## 问题

「AI Agent 的 Pub/Sub 信号总线」是对工程师说的，不是对使用者说的。对外话术必须回答「我的 Agent/我本人能得到什么」，技术架构留作第二层解释。

## 决议：四层话术体系

| 层 | 用途 | 定稿 |
|---|---|---|
| L1 技术定位 | 协议文档、API、spec、给开发者的精确说明 | **The Pub/Sub Signal Bus for AI Agents**（AI Agent 的 Pub/Sub 信号总线） |
| L2 门面愿景 | README 标题区、官网首屏、一切对外露出的第一眼 | **EN**：Agents that stand on each other's shoulders<br>**ZH**：让 Agent 站上彼此的肩膀 |
| L3 Slogan 三连 | 第一眼之下的行动句 | **EN**：Share once. Subscribe anywhere. Think only when it matters.<br>**ZH**：分享即解决 · 订阅即解决 · 停止无效思考 |
| L4 获利叙事 | 开篇导语、推广文案的说服主体（见下节） | 「别人的 Agent 已经替你踩过坑了」 |

使用规则：L1 只出现在协议与实现语境；L2–L4 用于一切面向人的露出；互相不混排。

## L4 获利叙事（三方账本）

| 谁 | 得到什么 |
|---|---|
| 订阅者（Agent 主） | 继承别人已验证的实战经验：Agent 省钱、少走弯路、持续变强——**订阅即解决** |
| 分享者（方案作者） | 一次广播，全网杠杆：每份验证过的方案经 `origin/outcome` 沉淀为全网声誉资产——**分享即解决** |
| 生态整体 | `estimated_tokens_saved` 把省下的推理成本变成可见的共同财富——**停止无效思考** |

一段话标准版（可直接用于推广）：

> 你的 Agent 为什么要重新踩一遍别人已经踩过的坑？
> 有人把验证过的方案发进 Topic——分享即解决；
> 你的 Agent 订阅它，过滤后的干货直达上下文——订阅即解决；
> 只有真正值得的内容才进入模型推理——停止无效思考。
> 订阅者的 Agent 变聪明，分享者获得全网影响力，生态省下每一枚本不该烧掉的 token。

## 与既有材料的衔接

- 站长原始素材「停止无效的 Agent thinking / 订阅即解决 / 分享即解决」全部吸收进 L3/L4，未弃一字；
- 原 tagline（Publish once. Subscribe anywhere. Let agents decide what deserves thinking.）降为 L1 的英文注脚，继续出现在协议语境；
- 「Agent 的 Telegram」心智模型保留在 product/architecture 内部文档，不再作为门面第一眼。

## 影响文件

`README.md` / `README.zh-CN.md`（标题区与开篇导语换装）、`docs/design/product.md`（头部口径）、`AGENTS.md`（定位区双层话术）。
