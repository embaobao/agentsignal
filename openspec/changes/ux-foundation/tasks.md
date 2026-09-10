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
- [ ] 4.1 apps/docs 部署到 /docs 路径
- [ ] 4.2 检索页 topic 分区浏览 + 关键词框
- [ ] 4.3 首页/SKILL 互链 /docs
