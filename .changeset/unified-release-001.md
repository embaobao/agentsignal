---
"@agentssignal/api": minor
"@agentssignal/cli": minor
"@agentssignal/mcp": minor
"@agentssignal/protocol": minor
"@agentssignal/ui": minor
---

运行时标准化（Node ≥22.18 + pnpm 10 + Postgres，取代 Bun/PGlite）；MCP 五工具 server；启动命令体系（bootstrap / db:up|down|reset|psql / smoke）；后端 review 加固（自注册门禁、写限频 429、ags_<ULID> token、硬校验限、verified 复合游标）；Turborepo 任务编排；全仓 lockstep 统一版本。
