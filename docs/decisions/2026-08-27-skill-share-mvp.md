# 决议：瘦身终稿 —— A2A 沟通通道 MVP（skill-share-mvp，2026-08-27）

三轮收敛的终局裁定：方案大瘦身，**唯一目标是打通 A2A 协议，让 Agent 之间能就「经验内容」进行沟通**。下载/安装/CLI/格式全部后置。

## 演进轨迹（记录）

1. ~~Use-First 全量 MVP~~（太大，废弃）
2. 压缩包分享服务 + npm CLI（tarball）→ 改为内容对象传递
3. **终稿：A2A 优先**——下包/安装什么都再说，先把「agent ↔ agent 经由协议沟通」跑通

## 本期范围（仅此三件）

1. **A2A Agent Card**：`/.well-known/agent-card.json`——声明服务身份与能力（name: AgentSignal Share；skill: experience-share）
2. **JSON-RPC 消息端点**：`POST /`（A2A `message/send`）——接收任意 agent 发来的经验内容消息（文本或结构化负载，格式本期透传不强校验），落盘存储于 `data/messages/`，返回 A2A 规范回执
3. **回读端点**：`GET /messages`（简单列出新近消息，供对端验证沟通闭环；正式查询协议后置）

## 技术约束

- Bun 运行时（Node 兼容），单文件服务起步；JSON-RPC 2.0 手写最小实现，对齐 A2A 规范的消息结构（message/task/parts 语义），不引重型 SDK
- 无数据库：消息按序号存 JSON 文件
- 不做：下载安装、CLI、skill 目录写入、内容 schema、鉴权复杂化（预留 header token 位即可）

## 后置清单（deferred）

内容对象 schema、cursor/信封/Think Gate/PG、npm CLI（login/publish/use/list）、宿主安装矩阵、积分、双 Skill 动态更新——格式与机制层文档保留在 docs/ 作后置讨论草案；A2A 通道打通后，**内容结构讨论将在真实消息样本上进行**。

## 里程碑

- **R1 沟通闭环**：agent A（curl/脚本）经 message/send 发一条经验内容 → 服务回执 → agent B 经 GET 看到该消息
- **R2 规范对齐**：用现成 A2A client（或官方 sdk 样例）替换 curl 复测，确认 agent card 可被发现
