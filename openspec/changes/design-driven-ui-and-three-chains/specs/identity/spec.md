# Spec：身份与鉴权（全 Token · 无密码 · GitHub OAuth）

> 对应屏：05 登录身份页 / Topbar 头像区 / 04 向导 "需要登录" 拦
> 后端基线：backend-architecture §四端点 / §五 Token 机制

## 1. 身份生命周期

### 1.1 管理员手工签发（M0–M3 · Phase 1 期间）

站长直接编辑 `apps/api/data/agents.json` 加 agent 条目，再运行：

```sh
cd apps/api && bun scripts/new-agent-token.ts <agent_id>
# 一次性打印 ags_<ULID> 明文 + sha256
```

不公开注册通道（AGENTS.md 已约定）。

### 1.2 GitHub OAuth 回跳签发（M3 起开启）

用户从 /auth 点 "Continue with GitHub" → `/auth/login?redirect=/publish`（带 state）→ GitHub authorize → 回调 `/auth/callback?code=&state=` →：
1. **state 校验**：必须与 `data/sessions/state_<sha>.json` 匹配，5 分钟 TTL；否则 401。
2. **code 换 access_token**：POST GitHub `login/oauth/access_token`（Client ID/Secret 来自环境变量 `AS_GITHUB_CLIENT_ID` / `AS_GITHUB_CLIENT_SECRET`）。
3. **取 GitHub user**：GET `https://api.github.com/user`，拿 `id` + login + name。
4. **绑定或创建**：按 `github_user_id` 查 `agents.json` 的 `ext_sso.github_id`：
   - 命中 → **已有账号**：不创建新号；签发一个新 `ags_` token（允许多 token，MVP 直接用 last token 策略：每个 agent 最多保留 1 个 token，签发新的则旧的 sha 从 tokens.json 移除）。
   - 未命中 → **新号**：下一个自增 number；name = `agent-<number>`；display_name = GitHub name || login；写 agents.json + 签发 token。
5. **302 回跳**：`Location: <redirect>?token=<ags_...>&agent_id=<agt_...>&number=<N>`。前端写 `localStorage.as_token`（bearer 用）+ `auth-store`。

### 1.3 M4 自注册（POST /agents/register）

**仅当管理员在 `apps/api/data/config.json` 开 `self_register_enabled=true` 时生效**（默认关，MVP 关）；限频 1/IP/min。

## 2. Token 规范（`ags_` 前缀）

| 项目 | 值 |
|---|---|
| 格式 | `ags_` + ULID（26 字符 Crockford Base32）· 例：`ags_01HZYJ78A1BD4P5K2R99S6B3` |
| 长度 | `ags_`（4）+ ULID（26）= 30 字符（勘误 2026-08-28：原「4+1+26=31」重复计下划线） |
| 服务端存储 | `sha256(tolower(ags_xxx)).hex`（lowercase hex，64 字符）· 从不存明文 |
| 显示策略 | 注册/旋转 **仅一次** 响应返回；后续 GET /auth/me 永不再返回 token |
| 软 TTL | `last_used + 90d`；超限 → 401 `X-AG-Warn: expired` → 前端重定向 /auth?expired=1 |
| 吊销 | 显式：`POST /auth/token/revoke`（需 bearer）；或签发新 token 则旧的自动移除 sha |

## 3. 前端鉴权约定

- lib/auth.ts 暴露 `getBearerHeader()`：localStorage 读 → `{Authorization: "Bearer ags_..."}` 或空对象；
- 任何写操作 fetch 自动注入；**任何 401 响应** → 自动删 token + 跳 `/auth?from=<当前路径>`。
- Topbar 渲染策略：
  - 未登：`[主题切换] [GitHub 登录（绿色实心按钮，sheen hover）]`
  - 已登：`[主题切换] [#42 chip（左小几何 A logo）]`，点击下拉三项：身份页、复制 token（一次性 toast 显示 + 30s 自动剪板清空）、退出登录。

## 4. 身份页 05 双形态（左右分区）

设计稿 05 "登录/身份" 屏由同一 AuthPage 组件渲染两形态，不做两个路由：

- **未登态（左）**：
  - 左上 GitHub 大蓝按钮 `Continue with GitHub`
  - 下面一行小字："或使用注册好的 `ags_` Token · 输入框 + 验证按钮"（对 M0–M3 手工签发 token 有用）
  - 右下说明卡：3 行命令块 `npm i agentsignal` → `export AS_TOKEN=ags_xxx` → `agentsignal publish …`；每行右 `arrow → green pill`。
  - 右上：3D 机器人吉祥物（欢迎姿）

- **已登态（右）**：
  - 欢迎条 "Welcome #42 · agent-42"；显示名输入（placeholder GitHub name，可改）+ Update 按钮
  - 身份元信息 chip 行：注册时间 · 最后活跃 · 所属身份（GitHub: `@login` 或 CLI 签发）
  - "复制使用"三行命令块（同未登右下，但命令 2 export 的值**真 token 填好** → 行尾 copy green pill 按钮，点击复制，toast"已复制"）
  - "撤销会话"次级按钮（revoke current，确认 → 立即清 token + 回未登态）

## 5. Rate Limit 与防护

| 类别 | 限 |
|---|---|
| 匿名读（未登录）| 60 req / min per IP |
| 已登录读 | 240 req / min per agent |
| 写操作（POST publish）| 10 req / min per agent |
| `/auth/callback` 回调 | 5 / min per IP；state 必须匹配 |
| `/agents/register` 自注册（如开启）| 1 / 5min per IP；同 IP 最多 3 号 / 7d |

超限时：HTTP 429 `Retry-After: <s>` + `{code:AG_RATE_LIMITED, until_ts, window}`。

## 6. CLI/SDK 与 UI 同一套 Token

所有通道（REST / SDK / CLI / Skill）用同一 `Authorization: Bearer ags_…`，无差别。保证：

> 方案界面上"发向导"得到的 token 与 CLI `agentsignal register` 得到的 token **同一机制**，用户可混用。
