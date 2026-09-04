# 任务拆分 — user-domain-completion

> 状态：**Approved（2026-09-02 站长全案裁定，见 proposal §五裁决记录）**。
> 开工顺序：**Phase 0 批准后立即开工**（安全洞在公网暴露）；Phase 1 依序；Phase 2 / Phase 3 可并行。
> 纪律：每完成一项当场勾选（AGENTS.md 文档治理 §10 账实同步）；CLI 面变更项必须同 PR 同步 SKILL（G1–G4）+ 手册随行（§11）。

## Phase 0 · P0 修复包（先行，≤0.5 人日，独立可发）

- [x] 0.1 `feedback.ts` requireAdminBasic 补 bcrypt 密码校验（对齐 admin.ts requireAdmin）
- [x] 0.2 新增 `apps/api/test/feedback.test.ts`：超管两端点鉴权矩阵（错密码 403/对密码 204/再删 404）+ verify 匿名 401/Bearer 200/admin 代验/错密码 401
- [x] 0.3 CLI `verify`（缺省 worked，`--verdict` 可选覆盖）+ UI useVerifySignal 补 verdict body + UI 三选按钮（修 400 漂移）+ SKILL lockstep
- [x] 0.4 `_ui_ext` 下发 verify_total/worked/partial/failed + SignalDetail「N 验证 · X 成功」展示
- [x] 0.5 AuthPage 按钮文字不可见修复：index.css 注册 `--color-paper: var(--bg)`（text-paper/bg-paper 静默失效，站长报障 2026-09-02）
- [x] 0.6 AuthPage GitHub 按钮渲染条件与文案对齐（推荐：改文案为实况；env gate 随 1.7）

## Phase 1 · creds 落地（2 人日，依赖 Phase 0）

> **WIP 暂停（2026-09-02 站长令：保留为 WIP，暂停，待审完三痛点文档讨论后再动）**
> 代码未删、留在工作区；**全部未跑通测试、未提交、未上公网**。以下状态为 2026-09-02 如实落账，不得混读为已完成。

- [~] 1.1 迁移 007_auth：better-auth 四表（user/session/account/verification）（006 已被 verify_actor 占用：verify_logs.agent_id FK 放宽，Phase 0.7）
  → **代码已写**：`apps/api/src/db/migrations.ts` 新增 007_auth（PG 方言单数表名，expand-only 幂等），`SCHEMA_VERSION = "007_auth"`。**未跑迁移、未验证**。
- [~] 1.2 session↔agents 桥接：callback 内 getSession → findAgentByGithub（激活 store 死代码）
  → **WIP**：新增 `apps/api/src/auth/bridge.ts`（`getSessionContext`）；`GET /agents/me/session` 端点已写。**未跑通**。
- [~] 1.3 claim：`/auth` 登录页「绑定已有身份」入口（粘 ags_ token）+ `POST /agents/claim` → bindGithub
  → **WIP**：`POST/DELETE /agents/claim` 已写（冲突 409）；**UI 入口未做**。
- [~] 1.4 token 管理：GET /agents/me/tokens · rotate · revoke
  → **WIP**：三端点已写在 `apps/api/src/routes/me.ts`（rotate 原行换 hash、id 不变，明文只返回一次）。**未跑通**。
- [ ] 1.5 CLI `login` + `token ls/rotate/revoke` + SKILL lockstep — **未开工**
- [ ] 1.6 /me 页增量：token 管理区 + claim 入口（基础版已落库 ea669c3：身份卡+我的信号+编辑/隐藏+审计；增量依赖 1.3/1.4 端点）— **未开工**
- [ ] 1.7 netlify.toml + Function config.path 补 `/api/*`、`/auth/*` 转发 + 公网 e2e 回归 — **未开工**
  → 落点提醒：`/auth` 是 UI SPA 路由（登录页），**只能转发 `/auth/github`**，不得整段 `/auth/*` 转发，否则登录页 404。
- [~] 1.8 用户域创建 agent：`POST /agents`（session 鉴权·出生即绑定·≤5 上限）+ /me 页「新建 Agent」入口（自注册路径不变）
  → **WIP**：`POST /agents` 已写（`AGENTS_PER_USER_MAX` 默认 5，审计 actor=`user:<id>`）；**/me 页入口未做**。

**配套改动（同批 WIP）**：`apps/api/src/store/store.ts`（`AgentRow.github_id` + `unbindGithub/agentsByGithub/countAgentsByGithub/githubIdForUser/listAgentTokens/rotateAgentToken/revokeAgentToken` + `AgentTokenRow`）· `apps/api/src/env.ts`（`AGENTS_PER_USER_MAX`）· `apps/api/src/auth/better-auth.ts`（透传 `secret`）· `apps/api/src/server.ts`（装配 `registerUserAgentRoutes`）· `apps/api/test/userdomain.test.ts`（新建，**未跑通**：种子直插 user/account/session 行 + 复刻 better-call HMAC-SHA256 签名合成 session cookie）。

**已知阻塞**：`apps/api/test/userdomain.test.ts` 未跑通（项目测试口径是 `node:test`，根 `pnpm test`；`pnpm --filter @agentssignal/api exec tsx --test` 报 tsx 不在依赖）。恢复时先修此项。

## Phase 2 · 私有 topic + 引用式书签（1–2 人日，依赖 Phase 1）

- [ ] 2.1 迁移 007_user_domain：topics.visibility + owner_user_id + topic_bookmarks
- [ ] 2.2 OAuth 首登自动建默认私有 topic
- [ ] 2.3 发现面排除私有（listTopics 过滤 + 泄露防护单测）
- [ ] 2.4 书签 PUT/DELETE/列表 + tombstone「已失效」
- [ ] 2.5 协议先行：message-envelope.md 补 human 批注者字段（先协议后代码）

## Phase 3 · 文档站 + 检索闭环（1–2 人日，可与 Phase 2 并行）

- [ ] 3.1 `/docs` 归文档站，Scalar 迁 `/api-docs`（netlify rewrite + server.ts routePrefix + user-manual 指针同步）
- [ ] 3.2 apps/docs 接 Docusaurus 3 + package.json + 根/turbo 构建脚本（装配器保留为内容管线）
- [ ] 3.3 Netlify 托管 + 本地搜索（Pagefind 类，禁 Algolia SaaS）
- [ ] 3.4 CLI query `--topic all` 文档化 + SKILL/首页互链 /docs

## 验收（全完成后）

- [ ] `pnpm verify` 全绿；e2e 公网三链路 21/21 + /api/auth/* 非 SPA 兜底
- [ ] 登录 → /me 双层 → rotate 后旧 token 401 → 私域不可见 → 书签 tombstone
- [ ] /docs = 文档站；互链一致；G1–G4 全绿
