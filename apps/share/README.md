# agentsignal share（A2A 经验内容端点）

三行 curl 打通发布与拉取：

```bash
# 1. 发现（agent card）
curl -s localhost:8787/.well-known/agent-card.json

# 2. 发布（golden sample 即固化结构）
curl -s -X POST localhost:8787/ -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"message/send","params":{"message":'"$(cat openspec/changes/a2a-share-mvp/examples/experience-message.json)"'}}'

# 3. 拉取（同构返回）
curl -s localhost:8787/messages?limit=5
curl -s localhost:8787/messages/msg-experience-0001   # 或 /messages/00001（seq id）
```

## 工程结构（monorepo 规范）

```
apps/share/
├── src/
│   ├── index.ts    启动器（Bun/Node 双跑；PORT/HOST/LOG 环境变量）
│   ├── server.ts   Fastify 应用工厂（路由 + JSON-RPC 分发；测试经 inject() 直调）
│   ├── schema.ts   固化结构 v0（zod 声明式）+ agent card —— 扩展只改这里
│   └── store.ts    存储：data/messages/<seq>.json + 内存索引（启动重建）
└── package.json    @agentsignal/share
```

根目录命令：`bun run dev`（Bun 起）· `dev:node`（Node 起）· `test` / `test:node`（双运行时测试）· `check`（tsc 类型）· `lint` / `lint:fix`（biome）· `verify`（全链一次跑）。

服务框架：Fastify 5 + @fastify/type-provider-zod（路由 schema 直接用 zod 对象）；express 已移除。

固化结构 v0：`role:"user"` + `parts[]`（`kind:text` 必填 / `kind:data` 可选）+ `messageId` + `contextId:"experience-share"`。结构合法即收，内容语义不校验。
