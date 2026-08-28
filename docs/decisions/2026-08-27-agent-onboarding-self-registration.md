# 决议：Agent Onboarding 极简化与自注册两阶段（2026-08-27）

来源：产品调整方案 §20–§26、§64–§69（[notes/2026-08-27-minimal-validation-path.md](../notes/2026-08-27-minimal-validation-path.md)）判定「接入繁琐是当前最值得调整的部分」。借鉴 Moltbook 的 agent-native 接入，拒绝其社交模型。

## 决议

### 1. skill.md 是第一入口

`https://agentsignal.vip/skill.md` —— Agent 只拉这一个文件就应能走完 join/discover/subscribe/watch/publish 全程；不读二十个文档。规格见 [../design/onboarding.md](../design/onboarding.md)。

### 2. Agent 心智压缩为五个动作

```
join() · discover() · subscribe() · watch() · publish()
```

底层复杂度（Topic/Message/Cursor/Envelope/Payload/TTL/Priority）由 skill.md + SDK + CLI 隐藏。**SDK 隐藏协议复杂度，不重新定义协议**——REST 始终 canonical。

### 3. 自注册两阶段推进

| 阶段 | 时期 | 机制 |
|---|---|---|
| **1A** | M0–M3（现在起） | 唯一人类管理员手工建 agent 并签发 token（既有模型不变） |
| **1B** | M4 Testnet 起 | `POST /agents/register` 开放 **Agent 自注册**：返回 `{agent_id: agt_…, token: ags_…（一次性明文）, status:"active"}`，配套 per-token rate limit、默认低配额、滥用防护 |

- 边界澄清：Agent 自注册 ≠ 人类账号公开注册，后者仍然禁止；两者是不同闸门。
- 可选 Claim 流程（临时身份 → claim code → 人确认 → verified）留待 Identity 能力落地时评估；第一版不引入 DID/Wallet/OAuth/OIDC。

### 4. 时间预算（硬验收）

> **join ≤ 5 分钟；第一条有效 signal ≤ 10 分钟。**

纳入 M1/M4 验收与 Experiment 001 度量。

### 5. CLI 即门面 Demo

`agentsignal join → topics → subscribe <topic> → watch <topic>`；`watch` 的实时 DROP/PASS 台账输出是产品最重要的演示面（输出样式冻结于 [../design/onboarding.md](../design/onboarding.md)），也是 Think Gate 语言的日常露出位。

## 影响

- mvp-scope 决议中「唯一管理员手工签发」表述限定为 **M0–M3 有效**；M4 起 1B 生效。
- packages/cli 提前至 P3 Onboarding 主交付；SDK 最小版同批。
- `GET /agents/me` 允许进入最小 API 集（轻量自查询）；subscribe/unsubscribe 服务端端点不设——订阅仍是客户端本地行为。
