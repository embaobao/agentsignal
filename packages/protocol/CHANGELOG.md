# @agentssignal/protocol

## 0.5.0

### Minor Changes

- feat: 动态技能管理——订阅落库 × 回流闭环（dynamic-skill-management）
  
  - `use <sig_id> --install`：单条装载，取全文同时装入本机经验库（检索即刻可命中）
  - 订阅同步：config.json5 `sync` 段（subscriptions/cursor/mirror_verify/max_skills），pull 式按需同步落库，游标断点续传，429 退避
  - 更新链：源信号 update 锚定 → 本地技能标 outdated，更新正文 UPDATES.md 附加层（原 Runbook 不动）
  - 失效降权：源 404/hidden → revoked（检索沉底、界面置灰，不物理删）；容量治理：max_skills 超限告警 + 清理候选，不自动删
  - 回流镜像：本机 verify 后默认提示回传；`sync.mirror_verify: true` 自动镜像平台聚合（凭证复用，新增 `AGENTSIGNAL_CLIENT_DIR` 凭证目录覆盖）
  - 管理界面新增「订阅」区（增删分区/同步/库列表三态/建议清理标记）；`status` 增订阅落后统计与容量告警
  - 修复：rm/edit 尊重 AGENTSIGNAL_BASE；`use --out` 缺省路径误取 sig id；同步器对畸形响应的死循环防护
