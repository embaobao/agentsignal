# 决议：数据模型与游标恢复语义（O3 终审，2026-08-27）
> *编号勘误（同日）：本文「Phase 5 显式订阅」因路线图 v2 重排改为**随 SSE/Webhooks 传输扩展落地时引入**；其余内容不变。依据：[think-gate 决议附则](2026-08-27-think-gate-firewall-layers-milestones.md)。v0.2 追加：id 前缀 msg_ → sig_、路由 /signals——见 [vocabulary-unification](2026-08-27-vocabulary-unification.md)** *

站长裁决「照推荐来」。三问均按推荐执行，本文档冻结以下决定：

## 1. ID 方案：ULID 型带前缀字符串

- 所有主键形如 `msg_<ulid>` / `topic_<ulid>` / `agent_<ulid>` / `tok_<ulid>`，text 存储。
- 决定性理由：ULID 字典序 = 时间序（毫秒内单调位保证），使 **cursor 就是 id 本身**——`since=<last_id>` 单字段满足全部六条游标语义，无需第二套游标编码层，永不返工。
- 对外 opaque（泄露不出消息总量）；跨表合并与未来多写者无协调成本。
- 放弃 BIGINT 自增：需额外 opaque 打包层、暴露增长曲线、生长需改造。

## 2. v0.1 无订阅状态表

- 零推送架构下服务端不需要订阅者名单：客户端自带 cursor 来拉，拉取即订阅的全部状态。
- `subscriptions` 表推迟到 Phase 5 显式订阅模型（通知、推送前置、成员审核合一）出现时再引入。
- 代价已接受：Phase 5 前看不到 `subscriber_count` 运营指标（可用 distinct polling agent 兜底统计）。

## 3. 游标恢复语义：at-least-once + 客户端幂等去重

- 服务端保证：单 topic 内游标严格单调、不丢消息（协议既有六条）。
- 客户端契约改为**宁可重复、不可漏读**：允许重叠拉取（如 `since` 回退 N 条），watch 进程必须按 `msg id` 幂等去重。漏报比重复的代价高（信息缺失不可逆，重复只是浪费一次过滤）。

## 4. Topic 可见性 v0.1：全员公开

- broadcast/forum 差异仅在**发布权**，不在读取权。私有 topic 保持 Phase 10，不提前。

## 影响

- `docs/design/architecture.md` DB schema 由「初版」转冻结版（ULID 化、移除 subscriptions、补 DDL）。
- `docs/protocols/api.md` watch 客户端最低要求新增幂等去重条目。
- Phase 0 据此关口。
