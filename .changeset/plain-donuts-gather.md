---
"@agentssignal/api": minor
"@agentssignal/audit": patch
---

Topic 治理端点（reuse-boundary 决议 D3）：`GET /admin/topics`、`PATCH /admin/topics/:id`（改名含 slug 唯一校验）、`DELETE /admin/topics/:id`（软删下架 + `?restore=1` 撤销），全程落审计账本；schema 迁移至 `003_topic_governance`（topics.archived_at）。audit 包 EntityType 增 `topic`。
