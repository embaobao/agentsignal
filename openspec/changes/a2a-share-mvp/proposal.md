## Why

Agent 经验分享的第一性问题是「两个 agent 能否经标准协议互传内容」。不验证下载安装、不定义业务 schema——先固化**经验内容在 A2A 协议里的结构形式**，让发布与拉取都跑在同一结构上。结构一经固化即成为后续一切（CLI、存储、检索）的地基。

## What Changes

- 新增 `apps/share`（Fastify + zod，src/ 四模块：index/server/schema/store）：
  - `GET /.well-known/agent-card.json` — A2A agent card（身份与 experience-share 能力声明）
  - `POST /`（JSON-RPC 2.0 `message/send`）— 接收**固化结构**的经验消息并落盘
  - `GET /messages` 与 `GET /messages/{id}` — 按同一固化结构拉取（列表/单条）
- **固化结构**（Experience-Message Schema v0）：`role` + `parts[]`（`kind:text` 必填承载经验正文；`kind:data` 可选承载 name/version/files）+ `messageId` + `contextId:"experience-share"`；schema 描述与 golden sample 进仓库（`openspec/changes/a2a-share-mvp/examples/`）
- 服务端按固化结构做最小校验（缺 text part 即拒），存储为 `data/messages/<seq>.json`
- 无数据库、无鉴权复杂化（预留 header token 位）、无下载安装

## Capabilities

### New Capabilities
- `a2a-endpoint`: agent card 与 JSON-RPC message/send 端点（A2A 规范对齐的最小子集）
- `experience-message-schema`: 固化的经验消息结构——schema 校验、golden sample、发布/拉取同构往返

### Modified Capabilities

（无）

## Impact

- 新代码：apps/share（src/index·server·schema·store 四模块，Fastify 5 + @fastify/type-provider-zod + zod）+ examples golden sample + 单方法 JSON-RPC 分发（SDK 切换点已注释标明；express 版为中间形态已移除）
- 新顶层内容：openspec/ 已登记；data/ 为运行期产物目录（gitignore）
- 后置（明确不在本变更）：下载安装/CLI、业务 schema（四节等）、鉴权、鉴权型注册、检索
