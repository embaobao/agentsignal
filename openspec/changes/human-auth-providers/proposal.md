# 提案：人类账号多通道 —— Google OAuth + 邮箱验证码登录（human-auth-providers）

> 状态：**Draft（方案已按 2026-09-02 站长推荐定向；排队主线之后，批准即生效）**
> 决策人：站长（zhumeng）· 站长指令：「用户维度支持邮箱验证和 Google 等」
> 排期：**主线优先**（站长令 2026-09-02：先完成个人 Agent 的创建与管理 = user-domain-completion Phase 0→1），本提案依赖其 Phase 1 的 006 迁移 + session 桥接先落库
> 上位：[reuse-boundary 决议](../../../docs/decisions/2026-08-31-reuse-boundary-and-public-docs-site.md) D1（**Google OAuth 本就在放行清单内**，本提案是实施而非翻案）· 配套决议：[human-auth-email-otp](../../../docs/decisions/2026-09-02-human-auth-email-otp.md)（邮箱准入的窄推翻）
> 不变的定档：身份模型 Q1–Q7（1:N · ≤5 · 绑定解锁管理权）不受影响；**密码体系仍然禁止**；人类仍不发 Signal（人是策展容器）

## 一、为什么

现在人类入口只有 GitHub OAuth 一条路。站长指令：用户维度支持**邮箱验证**与 **Google 等**。收益：① 无 GitHub 的用户可入；② 同一人多 provider 归一（Q3 裁决的锚点）；③ 邮箱作为跨 provider 身份锚点，为后续找回/通知留钩子。

## 二、方案（按 2026-09-02 推荐定向）

| 决策点 | 定向 |
|---|---|
| 邮箱验证形态 | **B：邮箱验证码登录（email OTP）**——输邮箱 → 收 6 位码 → 登录；better-auth `emailOTP` 插件，无密码体系（守原决策） |
| provider 范围 | **本期只加 Google**（better-auth socialProviders 声明式；需站长建 GCP OAuth client + Netlify 仪表盘补 `GOOGLE_CLIENT_ID/SECRET`）；Microsoft 等按需后加，每家=一行配置+一对凭证 |
| 账号归一 | **同已验证邮箱自动归一为同一 user**（开启 better-auth account linking；未验证邮箱不作归一锚点）；不同邮箱 = 不同用户 |
| 邮件基建 | **Resend**（HTTP API，免费层 ~100 封/天，验证码量级远够）；站长 DNS 配 agentsignal.vip SPF/DKIM + Netlify 加 `RESEND_API_KEY` |
| 提案载体 | **独立 change**（不改动已 Approved 的 user-domain-completion）；落地排其 Phase 1 之后 |

## 三、范围

### Phase A · Google OAuth（0.5 人日，依赖主线 Phase 1）
- better-auth socialProviders 增 Google（env 门控，fail-soft 同 GitHub 口径）
- account linking 开启：同已验证邮箱归一同一 user；`/auth` 页加 Continue with Google
- /me 账号区显示已连 provider 列表 + 解绑（保留至少一个登录方式的前端校验）

### Phase B · 邮箱验证码登录（1 人日，可与 A 并行）
- better-auth `emailOTP` 插件：发送 6 位码（5 分钟有效，**限频**：同邮箱 1/min、同 IP 10/day，超限 429）
- Resend HTTP sender（Function 内 fetch，零 SMTP 依赖）；发信人 `AgentSignal <noreply@agentsignal.vip>`
- `/auth` 页加「使用邮箱验证码登录」流（输邮箱 → 输码）
- env：`RESEND_API_KEY`（optional，未配置 = OTP 登录入口隐藏，fail-soft 不影响其他通道）

## 四、不做（Non-goals）

- **密码体系**（继续禁止；本提案仅窄准入邮箱 OTP，见配套决议）
- Microsoft/其他 provider（按需后加）
- 邮箱营销/通知系统（邮件仅用于验证码；pull-based 决策不变）
- 人类发布 Signal（维持 D2：人是策展容器）

## 五、验收

1. GitHub 登录 → 退出 → Google 同邮箱登录 → **同一 user**（/me 账号区显示两个已连 provider）
2. 邮箱验证码：收码 → 登录成功；同邮箱 1min 内重发 → 429；`RESEND_API_KEY` 未配置 → 入口隐藏、其余登录不受影响
3. 解绑 Google 后仍可 GitHub/邮箱登录；全部解绑被前端阻止
4. `pnpm verify` 全绿；Netlify 仪表盘新增三 env（GOOGLE_CLIENT_ID/SECRET · RESEND_API_KEY）站长手加后公网回归
