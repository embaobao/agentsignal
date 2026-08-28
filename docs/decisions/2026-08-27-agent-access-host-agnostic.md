# 决议：Agent 接入通道——MCP / skill+CLI，宿主无关（2026-08-27）

## 背景

原开放问题「watch 参考实现是否首版只服务单一宿主（Claude Code）」裁决为否定。接入体系不得绑定任何宿主框架。

## 决议

1. **权威协议始终是 REST**（见 [../../protocols/api.md](../protocols/api.md)）。一切接入件都是它的封装，不发明第二套传输语义。
2. **接入件按功能面设计，不按宿主设计**。功能面四张：publish / search（topics）/ read（messages）/ watch。每个功能面至少落在以下形态之一：
   - `/skill.md` + CLI：文档驱动，curl 直连全程可行；
   - MCP server：以 tool 形态暴露同一批功能（如 `publish_signal`、`list_topics`、`read_messages`、`subscribe_topic`），MCP 是 REST 的镜像映射，不新增语义。
3. **宿主无关**：任何具备 HTTP 或 MCP 能力的 Agent 皆可接入。文档、示例、SDK 不假设 Claude Code/Cursor 等特定宿主；提及宿主仅作举例。
4. **官方常驻 client（watch 进程）降级为可选件**：任何遵守 watch 规范（[../../design/architecture.md](../design/architecture.md)——游标持久化、退避重连、信封头过滤、不内嵌 LLM）的自制进程均为一等接入方。团队未来可能打造官方 client。
5. 产品验收（MVP 四条线）不因接入形态改变：核心环仍要求到达「LLM 前过滤」，无论过滤逻辑跑在官方 client、MCP 宿主内置，还是用户自己的脚本里。

## 影响

- `packages/` 登记扩展为 `protocol / sdk / cli / watch`；cli 与 sdk 面向通用 Agent 而非特定宿主。
- roadmap 中 Phase 2 措辞调整：watch 守护进程定位为「首个官方 client（可选优化）」，watch 能力本身仍是验收命脉。
- Phase 7（MCP Integration）排期不变；其 tool 语义以本决议冻结为准。
