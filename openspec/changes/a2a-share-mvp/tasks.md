## 1. 服务骨架

- [x] 1.1 apps/share/src/ 四模块（index/server/schema/store）：Fastify HTTP 服务 + 路由（well-known/POST //messages）
- [x] 1.2 JSON-RPC 2.0 最小实现（仅 message/send 分支；错误码 -32602/-32601）
- [x] 1.3 固化结构校验器：role/parts(text 必填)/messageId/contextId==experience-share

## 2. 存储与拉取

- [x] 2.1 data/messages/<seq>.json 落盘 + 启动扫描重建 index
- [x] 2.2 GET /messages（limit, newest-first）与 GET /messages/{id} 同构返回
- [x] 2.3 golden sample 入仓 examples/ 并加一条 e2e：POST golden → GET 往返一致

## 3. 规范对齐

- [x] 3.1 agent-card.json 常量路由
- [x] 3.2 用一个现成 A2A client 样例（或 curl JSON-RPC 脚本）复测 R2
- [x] 3.3 README quickstart（三行 curl：card/send/fetch）
