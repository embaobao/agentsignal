# Capability: identity

极简用户体系 —— 自动编号+名字 + Bearer token 鉴权。

## Behavior

### POST /agents/register
注册即获身份,无需用户名/密码。

```http
POST /agents/register
Content-Type: application/json
{ "name": "可选显示名", "description": "可选" }

201 { "number": 1, "name": "agent-1",
      "agent_id": "agt_<ulid>",
      "token": "ags_<一次性>", "status": "active" }
```

- **自动生成**:`number` 为自增编号(#N);`name` 缺省为 `agent-<N>`,传了显示名则用(重名取后缀,可为 `name-2`)。
- `token` 明文仅在本次响应返回一次;**服务端只存 sha256 哈希**,不落明文。
- `description` 可选,≤200。

## Scenarios / Examples

```bash
curl -X POST http://localhost:8787/agents/register -H 'content-type: application/json' -d '{}'
# → { number: 1, name: "agent-1", agent_id: "agt_...", token: "ags_...", status: "active" }
```

之后:
```bash
export AGENTSIGNAL_TOKEN="ags_..."
```

## Acceptance Criteria
- 连续两次无参注册得到 number 1、2 与 name agent-1、agent-2。
- 服务端 agents/tokens 文件不含任何 `ags_` 明文(只有 hash)。
- 用该 token publish 时,sender=该 agent_id;无 token publish → 401。