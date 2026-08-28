# 决议：词汇全链路统一 —— Signal / Experience（2026-08-27）

grilling 轮次裁定（站长）：「都还没开发，能根据业务直接定义减少代码和业务的不同，即打通。」零代码窗口期是名词免费的最后机会，采纳**协议词汇=业务词汇，一刀切齐**。

## 裁决

| 新词（唯一合法） | 取代 | 定义（权威源见 [glossary](../design/glossary.md)） |
|---|---|---|
| **Signal** | ~~Message~~ | 一次经验广播的整体 = 信封 + 体验包；id 前缀 `sig_<ulid>`；路由 `/topics/{id}/signals` |
| **Experience** | ~~Payload~~ | Signal 的正文；字段 `experience: { format, body }`；取正文参数 `include=experience` |
| **Outcome** | （不变） | 回流的使用结果（kind=update，`[adoption]`/`[report]`） |
| **Topic**（不变） | —— | 知识领域订阅单元；**UI 可显示别名叫 Experience Space，但永不实体化**（无表、无端点——Space 列入 Room/Workspace 同级禁令） |

- kind 三枚举保留：`solution / update / discussion`（Signal 的种类，不更名）。
- cursor 语义完全不变：cursor 就是 signal 的 ULID id。
- Think Gate / Token Firewall / Envelope / at-least-once 等原有词汇不受影响。

## 生效范围（即刻，零代码期）

`protocols/*`、`design/*`、README 双语、未来全部代码（表名 `signals`、列 `experience jsonb`、路由、SDK 方法）。migrations 尚不存在，DDL 直接按新词落地。

## 免责范围

- `docs/decisions/` 历史文本**不回写**（ADR 是日期锚点）；[data-model-o3-final](2026-08-27-data-model-o3-final.md) 的 id 前缀表述以头部勘误注补正：**msg_ → sig_**。
- `notes/` 外部输入原稿（minimal-validation-path、后续 Codex 方案归档）保留旧词汇，读者按本词表映射。
- 协议文件名 `message-envelope.md`、`api.md` **保持不变**（稳定锚点防断链），文件内术语即时更新；此例外记录于 glossary。

## 治理义务（响应站长制度要求）

- **[glossary](../design/glossary.md) 是唯一权威词源**，兼作功能定义注册表（每功能一个 canonical 文档）。
- 任何定义变更的责任流：改 canonical → grep 全库传播同步 → 更新 `docs/README.md` 索引 → 语义变化另立决议。**由执行 agent 主动完成全程，不以站长发现为触发条件。**
