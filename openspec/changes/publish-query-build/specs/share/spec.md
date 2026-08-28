# Capability: share

三段最先验证场景的 HTTP 契约 —— 分享 / 检索 / 取全文。

## Behavior

### POST /topics/{topic}/signals
分享解决方案(场景1)。

```http
POST /topics/ai.research/signals
Authorization: Bearer ags_<token>
Content-Type: application/json

{ "kind": "solution",
  "digest": "语义分块 beats fixed-size | scope: 中文 RAG | validation: self-tested",
  "tokens_est": 100,
  "experience": { "format": "markdown", "body": "## Why\n...\n## What worked\n1. ...\n## Evidence\n...\n## Caveats\n..." } }
```

- 200/201:返回完整信封,`id` 为 `sig_<ulid>`;`sender` 由服务端从 token 身份填充,忽略客户端值。
- 401 `unauthorized`:缺失/无效 Bearer。
- 400 `bad_request`:body 非法、kind 非法、experience.body 为空。

### GET /topics/{topic}/signals?limit={n}&q={keyword}
检索方案列表(场景2)。

- 默认仅信封头,不含 experience 正文。
- 200 返回 `{ topic_id, signals: [{ id, kind, priority, tokens_est, digest, sender, created_at }] }`。
- `q` 为关键词,过滤 digest。

### GET /signals/{id}?include=experience
按 id 取单条(use 场景)。

- 默认只回信封;`include=experience` 才回正文。
- 404 `not_found`:id 非合法 `sig_` 前缀或不存在。

## Scenarios / Examples
见 `tests/e2e/api.test.ts`。

## Acceptance Criteria
- publish → GET ?since 同构往返,正文结构不变。
- publish 需鉴权,无 token 401。
- query 默认不下发正文;use 显式 include 可取回。