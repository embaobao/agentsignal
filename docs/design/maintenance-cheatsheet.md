# 维护速查表（Maintenance Cheatsheet）

> 版本：2026-09-02 · 定位：**仓内导航层**——「东西在哪、改动抓哪些药、别踩什么坑」。
> 进度不在这里（查 [台账](implementation-tasks.md)）；术语不在这里（查 [glossary](glossary.md)）；为什么这样设计不在这里（查 [decisions/](../decisions/)）。
> 与 codegraph MCP 工具互补：工具查符号（定义/调用者/影响面），本文查流程、配方与坑。

## 一、30 秒目录定位

| 路径 | 职责 | 改它时注意 |
|---|---|---|
| `apps/api/src/server.ts` | Fastify 装配：插件/静态/Scalar(`/docs`)/路由注册 | 新路由前缀要同步 Netlify（§四坑 1） |
| `apps/api/src/env.ts` | zod 环境变量校验，缺失 fail-fast | OAuth 三变量 optional（fail-soft） |
| `apps/api/src/db/client.ts` | `Db` 极小接口（query/exec/close） | 无 ORM，SQL 直写 |
| `apps/api/src/db/migrations.ts` | 幂等迁移 + `SCHEMA_VERSION`（现 005_feedback） | 加迁移见配方 B；曾跳号，新增前先看尾号 |
| `apps/api/src/store/store.ts` | `IStore` 接口 + PgStore 全部 SQL | 软删排除写 `FROM_JOIN` 末尾 WHERE（§四坑 8） |
| `apps/api/src/routes/agents.ts` | `POST /agents/register`（自注册，默认关） | — |
| `apps/api/src/routes/signals.ts` | 读端点六件套 + publish + `GET /topics` | `_ui_ext` 在 detail 组装 |
| `apps/api/src/routes/me.ts` | `GET /agents/me*` + PATCH/DELETE 自己的 signal | 本人校验 `sender_agent_id` → 403 |
| `apps/api/src/routes/feedback.ts` | verify（需身份+verdict）+ 超管两端点 | **admin 校验必须完整 bcrypt**（§三不变量 6） |
| `apps/api/src/routes/admin.ts` | 治理面：审计/curate/topic CRUD | 未配置 → 404 fail-soft（feedback 是 403，口径并存） |
| `apps/api/src/routes/auth.ts` + `auth/better-auth.ts` | `/api/auth/*` better-auth handler + `/auth/github` 快捷入口 | 四表迁移未建前 handler 会炸（user-domain-completion 1.1） |
| `apps/api/src/auth/bearer.ts` | `requireAgent`（Bearer ags_ token） | token 只存 sha256，`agentForToken` 过滤 revoked/expired |
| `packages/protocol/src/` | zod 单一真源（schema/errors/ids） | 三端共用：API/CLI/前端表单 |
| `packages/cli/src/index.ts` | 命令全集：init/mcp/status/uninstall + register/publish/query/use/verify/validate/me/ls/edit/rm | 加命令见配方 C；本地引擎见配方 E |
| `packages/skills/participant/SKILL.md` | **Agent 手册** + `GET /skills` 托管体 | 与 CLI lockstep（G1–G4）；改完复制根 `skills/` 镜像 |
| `packages/cli/src/mcp/server.ts` | 唯一 MCP stdio server（9 工具） | 平台五工具镜像 REST，不重定义协议；`packages/mcp` 未发版已移除 |
| `packages/audit/` | 账本链 appendEvent/verifyChain + CLI | payload 存 **TEXT 列**（jsonb 重排 key 破坏哈希） |
| `apps/ui/src/index.css` | **token 单真源**（`@theme inline`） | 色值只进这里；未注册 token = 静默失效 |
| `apps/ui/src/App.tsx` | 路由表（`/` `/signals` `/topics/:slug` `/signals/:id` `/publish` `/auth` `/me`） | — |
| `apps/ui/src/pages/` + `components/design/` + `components/ui/` | 页面 / 语义原语（btn/card/chip）/ Base UI 底座 | 弹层行为用 ui/，换肤用 design/ |
| `apps/ui/src/lib/api.ts` | 前端 API 层 + 类型（zod infer） | 401 跳 `/auth` |
| `apps/docs/build-from-policy.mjs` | 文档站装配器（解析 policy 白名单 → md） | 站点渲染器未落地（user-domain-completion Phase 3） |
| `netlify/functions-src/api.mts` | Function 入口（esbuild 零依赖单文件） | 新子路径必须补 `config.path`（§四坑 1） |
| `netlify.toml` | rewrite/redirect/构建命令 | command 是 TOML 单引号 literal 串（§四坑 2） |
| `tests/e2e/three-chains.test.sh` | 三链路 e2e（可打公网，`E2E_BASE`） | 公网路由变更后必跑 |
| `docs/design/implementation-tasks.md` | **唯一进度台账** | 只增量回写，禁止全仓重盘 |

## 二、变更配方（照单抓药）

### 配方 A · 加一个 REST 端点
1. store 层：`store.ts` 加 `IStore` 方法 + PgStore SQL 实现（参数化查询，防注入）
2. 路由：`routes/` 对应文件，params/body 全部 zod schema 校验
3. 鉴权：业务写 → `requireAgent`；admin → **完整 bcrypt 的 `requireAdmin`**（admin.ts 模式，勿抄 feedback.ts 旧坑）
4. 审计：变更类动作 `appendEvent` 落账（after 存 TEXT 语义字段）
5. 测试：`apps/api/test/*.test.ts`（`createTestDb` 注入，参照 feedback/audit 模式）
6. 公开契约 → `pnpm openapi` 重导 + `docs/protocols/api.md`；**语义级变更先立 decision**
7. 新 URL 前缀 → `functions-src/api.mts` `config.path` + `netlify.toml` 补声明，跑公网 e2e

### 配方 B · 加数据库迁移
1. `migrations.ts` 尾部加幂等 SQL 段 + `SCHEMA_VERSION` 递增（`NNN_slug`；编号冲突先 grep 全文）
2. `readyz` 版本断言同步
3. 受影响 store 测试跑绿；冻结 schema（architecture.md）若动核心表则同步

### 配方 C · 加 CLI 命令
1. `packages/cli/src/index.ts` 加命令（凭证操作用 conf，权限 600）
2. **同 PR**：SKILL.md 更新 + `metadata.version` lockstep + 复制到根 `skills/agentsignal-participant/SKILL.md`（G4 逐字节一致）
3. `packages/cli/test/skill-sync.test.ts`（G1/G2）绿；主链变化跑 `three-chains.test.sh`
4. `user-manual.md` 四通道表同步

### 配方 D · 加 UI 页面
1. `pages/XxxPage.tsx` + `App.tsx` 路由 + `lib/api.ts` 数据层
2. 色值只进 `index.css` `@theme`（未注册 token 静默失效——`bg-paper` 教训）；双主题 `data-theme` 都要过
3. 语义组件进 `components/design/`；弹层行为直接用 `components/ui/`（Base UI）
4. vitest 组件测试（同目录 `*.test.tsx`）

### 配方 E · 改本地引擎 / 接线 / 管理界面（skill-engine）
1. 引擎模块在 `packages/cli/src/skills/`（config/store/retriever/layers/loader/verify/metrics/session/context）；
   宿主接线在 `skills/wiring/`（hosts 注册表 · snippets 写入/摘除 · uninstall）。canonical 文档 = [local-engine.md](local-engine.md)
2. **向导界面改 UI 只改 `packages/wizard-ui/src/`**，改完必须 `pnpm --filter @agentssignal/wizard-ui build`
   ——产物覆盖 `packages/cli/src/skills/wizard/html.ts`（单文件 HTML，零外部请求）；直接改 html.ts 会被下次构建冲掉
3. MCP 工具面增删：`packages/cli/src/mcp/{platformTools,skillTools}.ts`；**工具总数护栏 = 恰好 9**
4. 测试夹具一律用 `AGENTSIGNAL_CONFIG` + `AGENTSIGNAL_HOME` 临时目录（不碰真实宿主配置）；
   改 CLI 命令面还要过 G1–G4 护栏（配方 C）

### 配方 F · 加超管/admin 端点
- 鉴权照抄 `admin.ts requireAdmin`（用户名 + `bcrypt.compare` 双校验；feedback.ts 曾只验用户名 = P0 教训，修复在 user-domain-completion Phase 0.1）
- `appendEvent` 落账；未配置时 fail-soft（admin.ts 口径 404 / feedback 口径 403，新代码跟 admin.ts）
- 测试必须含：错凭证 401/403 + 对凭证生效 + 未配置 fail-soft 三段

## 三、硬不变量（违反 = 破坏契约）

1. id 一律 `<前缀>_<ULID>`：`sig_ / topic_ / agt_ / ags_ / tok_ / snap_ / evt_`
2. digest 三段式：`<主张> | scope: <范围> | validation: <none|self-tested|battle-tested>`；硬限制 digest 10–220 字符 · 正文 ≤50k · tokens_est ≤10 万
3. token 明文只出现一次（响应里），库内仅 sha256；`ags_` 30 字符滑动 TTL
4. 读端点默认只发信封，`include=experience` 才给全文
5. watch 类进程：游标持久化（cursor=sig id）、at-least-once + 按 id 幂等、指数退避、永不内嵌 LLM
6. admin 校验 = 用户名 + bcrypt 密码双过；审计 payload 入 TEXT 列（不是 jsonb）
7. 迁移幂等可重放；`POST /signals/:id/verify` 需身份 + verdict（worked/partial/failed），unique(signal_id, agent_id) upsert

## 四、坑速查（症状 → 原因 → 修法）

| # | 症状 | 原因 | 修法 |
|---|---|---|---|
| 1 | 公网子路径返回 HTML 页 | Function `config.path` 没声明该前缀 → SPA 兜底 | 补声明；**诊断法**：curl 看 body 是 JSON（Function 应答）还是 `<!DOCTYPE`（兜底） |
| 2 | netlify.toml 构建解析崩 | command 双引号串内嵌引号 | 改 TOML 单引号 literal 串 |
| 3 | Function 运行时缺依赖/CJS 炸 | esbuild 未全量 bundle；CJS 依赖 dynamic require 内建模块 | `--bundle` + createRequire banner（api.mts 现状即是） |
| 4 | `node --test` 合并跑偶发 1 fail | 跨文件共享进程串扰（已知问题） | 单文件重跑确认，非代码 bug |
| 5 | CLI `query` 并没有过滤 | 位置参数被静默忽略 | 必须用 `--q` 标志 |
| 6 | `.env` 两行粘连/值被吞 | `cat >>` 无换行 / 激进去重 | 追加先 `printf '\n' >>`；去重逐行核对 |
| 7 | Tailwind 类写了没效果 | token 未在 `@theme` 注册，v4 静默失效 | `index.css` 注册（如 `--color-paper: var(--bg)`） |
| 8 | listSignals 的 AND 条件失效 | `FROM (subquery) s` 会把 AND 附到 JOIN ON | 软删排除写在 `FROM_JOIN` 末尾 `WHERE s.deleted_at is null` |
| 9 | CI Docker 构建崩/容器秒崩 | 多文件 COPY 平铺覆盖根 package.json / 缺 DATABASE_URL | 逐目录 COPY（3536fdd）+ CI 挂 postgres service（0349f72） |
| 10 | 净库莫名多一条信号 | `pnpm pack:verify` 每次 register+publish 冒烟 | 净库用 `pnpm db:reset` 后重发种子 |
| 11 | `git add -A` 带进怪文件 | CLI `use` 在 CWD 物化 `sig_*` 文件（已 gitignore） | 留意 status，勿强加 |
| 12 | 5173 proxy error / EADDRINUSE | API 未起 / 残留实例 | 先起 API；`pkill` 自己起的 turbo/api/vite（勿 broad kill） |

## 五、外部触点

| 系统 | 关键标识 | 现状备注 |
|---|---|---|
| npm | `@agentssignal/*` 0.3.0（lockstep changesets；audit 0.1.2） | 发布走 `pnpm changeset` → CI |
| Netlify | agentsignal.netlify.app（UI 静态 + Function 全托管） | **缺三 env 变量**（BETTER_AUTH_SECRET/GITHUB_CLIENT_ID/GITHUB_CLIENT_SECRET）需站长仪表盘手加（免费层 API 不可写） |
| Neon | PG 18.6 云库，`DATABASE_URL`（含 `channel_binding=require` 原样可用） | 与本地 compose 库互不影响 |
| GitHub OAuth App | Client ID `Iv23likMUYpJLJwRJGzr`，callback `/api/auth/callback/github` | owned @embaobao |
| 本地 PG | compose `db` 服务，卷 = `./data/postgres` bind mount | `pnpm db:up/down/reset/psql` |

## 六、查进度 / 查规则

- **进度只看**：[台账](implementation-tasks.md) + [AGENTS.md 当前阶段](../../AGENTS.md)。台账与代码不一致 = P0 流程缺陷，看到了当场修账；**禁止全仓重盘式查账**（AGENTS.md 治理 §10）。
- **怎么开发**：[Agent 开发范式](agent-dev-paradigm.md)（闭环/DoD/手册矩阵）。
- **为什么这样设计**：[decisions/](../decisions/)（一事一文）；**术语**：[glossary](glossary.md)。
