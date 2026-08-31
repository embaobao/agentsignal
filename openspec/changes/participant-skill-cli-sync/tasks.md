# 任务拆分清单 — participant-skill-cli-sync

> 执行口径：node:test 单口径（AGENTS.md 测试随行）；裁决 R1=A / R2=A / R3=A 已定。

## A. 提案与方案（先行）

- [x] A.1 openspec change 立项：proposal.md（功能点 S1–S5/C1–C5/G1–G4/D 全量）+ tasks.md + .openspec.yaml
- [x] A.2 完整方案落盘：docs/design/participant-skill-redesign.md（业务边界 + 开放标准调研 + 七节结构 + 护栏机制）并登记 docs/README 索引

## B. CLI（C1–C2）

- [x] B.1 `verify <sig_id>` 命令：POST /signals/:id/verify，输出 verify_count + 回流提示；USAGE/头注/package.json 同步五命令→六命令
- [x] B.2 changeset 登记（@agentssignal/cli minor，fixed 组 lockstep：.changeset/lucky-pans-smile.md）

## C. skill（S1–S5）

- [x] C.1 SKILL.md 按七节结构定稿：无写死地址、无 curl、`--help` 自纠兜底行、六命令逐条对应
- [x] C.2 frontmatter 定稿：description 触发路由规则（功能+五类场景+不适用）；metadata.version/cli 锚点

## D. 护栏（G1–G3）

- [x] D.1 `packages/cli/test/skill-sync.test.ts`：G1 版本断言 + G2 命令面双向断言（从 src/index.ts `case` 提取命令集）
- [x] D.2 根 `package.json` test glob 追加 `packages/cli/test/*.test.ts`
- [x] D.3 e2e G3：GET /skills 响应体 === 仓库 SKILL.md 内容（逐字节）

## E. 漂移清偿 + 治理（R3 + G4）

- [x] E.1 onboarding.md：路径修正（packages/agent-skill/→packages/skills/participant/）、幽灵命令映射为六命令（connect 保留 P3 标注）、SKILL 规格节对齐七节结构
- [x] E.2 glossary.md：「五动作」行工具面刷新为 CLI 六命令；功能注册表登记 participant-skill-cli-sync
- [x] E.3 AGENTS.md 文档治理节追加第 9 条（CLI 命令面变更 → 同 PR 更新 SKILL.md 并跑绿 G1–G3）

## F. 验收

- [x] F.1 `pnpm verify` 全绿（check + lint + test 57/57 含新增护栏 + test:ui 26/26）
- [x] F.2 verify 端点行为由 e2e 三链路断言背书（HTTP 端点）；CLI verify 为薄封装（5 行 api 调用），`pnpm check`/lint 锁定
- [ ] F.3 本清单全勾后归档（openspec archive 动作，随下个收口节点执行）
