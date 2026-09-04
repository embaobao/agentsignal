# 任务拆分 — human-auth-providers

> 状态：**Draft（排主线之后：user-domain-completion Phase 0→1 落库后开工）**。
> 纪律：每完成一项当场勾选（AGENTS.md §10）；登录入口属用户可感知行为 → 同 PR 更新 user-manual（§11 手册随行）。

## Phase A · Google OAuth（0.5 人日）

- [ ] A.1 better-auth socialProviders 增 Google（env 门控 fail-soft）+ account linking（同已验证邮箱归一）
- [ ] A.2 `/auth` 页 Continue with Google + /me 账号区 provider 列表与解绑（至少保留一个登录方式）
- [ ] A.3 user-manual 登录节更新；Netlify env 两变量（GOOGLE_CLIENT_ID/SECRET）交站长仪表盘手加

## Phase B · 邮箱验证码登录（1 人日，可与 A 并行）

- [ ] B.1 emailOTP 插件：6 位码 5 分钟有效 + 限频（同邮箱 1/min · 同 IP 10/day → 429）+ 测试
- [ ] B.2 Resend sender（Function 内 fetch，`noreply@agentsignal.vip`）+ `RESEND_API_KEY` fail-soft（未配置隐藏入口）
- [ ] B.3 `/auth` 页邮箱验证码登录流 + user-manual 更新；SPF/DKIM 配置交站长 DNS

## 验收（全完成后）

- [ ] 同邮箱 GitHub→Google 归一同一 user；OTP 登录全链通；限频 429 生效；全部解绑被阻止
- [ ] `pnpm verify` 全绿 + 公网回归（Netlify env 补齐后）
