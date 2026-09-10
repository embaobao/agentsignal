# 任务拆分 — ux-foundation

## Phase 1 · 三步接入叙事
- [x] 1.1 CLI `init` 命令（交互式：名字→注册→引导首条发布）
- [x] 1.2 SKILL.md 重写开头（三步叙事；使用指南挪 references/usage.md）— 2026-09-10 完成（开头 = 安装→init→publish 三步叙事 + base 同源规则；命令详解/错误速查迁 references/usage.md；主文件保留能力速览表（G2① 全命令覆盖）/触发表/质量契约/纪律；G1–G4 绿 + G4 镜像同步）
- [x] 1.3 首页终端块改叙事（我是人→init / 我是 Agent→三步）— 2026-09-10 完成（i18n zh/en 双语：人 tab = `npx @agentssignal/cli init` 一条命令；Agent tab = 安装→init→publish 三行叙事 + /skills 指引注释；旧「/skills 链接 + curl」断言按新叙事重写；test:ui 34/34 绿）
- [x] 1.4 /skills 首节 = 三步叙事 — 2026-09-10 完成（/skills 服务源 = canonical SKILL.md（SKILL_FALLBACK 直指），1.2 重写后实弹验证：GET /skills 首节即「三步接入（复制即用）」含 npm install / agentsignal init；three-chains e2e 增永久断言「SKILL 首节三步叙事」）

## Phase 2 · 个人管理
- [x] 2.1 API `GET /agents/me` · `GET /agents/me/signals`
- [x] 2.2 API `PATCH /signals/:id` · `DELETE /signals/:id`（软删）
- [x] 2.3 CLI `me` / `ls` / `edit` / `rm`
- [x] 2.4 UI `/me` 页（身份卡 + 我的信号列表 + 编辑/隐藏按钮）
- [x] 2.5 审计事件覆盖 edit/rm

## Phase 3 · OAuth + token 管理
- [ ] 3.1 `GET /auth/github` → callback → 绑定/创建
- [ ] 3.2 `GET /agents/me/tokens` · rotate · revoke
- [ ] 3.3 CLI `login`（设备码流程）· `token ls/rotate/revoke`
- [ ] 3.4 UI GitHub 按钮 + /me token 管理区

## Phase 4 · 文档托管 + 检索闭环
- [ ] 4.1 apps/docs 部署到 /docs 路径：
  - [x] 4.1a Scalar API 参考迁 /docs → /api-docs — 2026-09-10 完成（server.ts routePrefix 迁移；netlify/functions-src config.path 增 /api-docs（保留 /docs 过渡，随下次部署生效——部署面 toml 按纪律未动）；three-chains e2e 增 /api-docs 200 断言；隔离栈实弹：/api-docs → 200（Scalar UI），旧 /docs 本地为 SPA 兜底、公网归文档站）；**部署面遗留：下次 Netlify 部署时 function config.path 随构建自动带上，无需仪表盘操作**
  - [ ] 4.1b 渲染器（Docusaurus 3 裁决）落地 + apps/docs 构建产物部署 /docs
- [x] 4.2 检索页 topic 分区浏览 + 关键词框 — 2026-09-10 完成（**账实对照：功能已随 v5 搜索优先页上线**（TopicPage：大搜索框→?q= 导航、topic 分区 pills、关键词回显、Latest/Most verified 排序、列表/卡片视图），本轮补 TopicPage.test.tsx 3 用例契约背书（搜索导航/分区 pills/参数链路）；test:ui 37/37 绿）
- [ ] 4.3 首页/SKILL 互链 /docs
