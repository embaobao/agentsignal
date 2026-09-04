# 决议：人类账号准入邮箱验证码登录（窄推翻「邮箱注册不做」）

日期：2026-09-02 · 状态：**Accepted（站长指令「用户维度支持邮箱验证和 Google 等」）** · 决策人：站长（zhumeng）
**上位**：[reuse-boundary 决议](decisions/2026-08-31-reuse-boundary-and-public-docs-site.md) D1（Better Auth 人类账号体系 · Google/GitHub OAuth 本已放行）
**落地**：[human-auth-providers 提案](../changes/../openspec/changes/human-auth-providers/proposal.md)

## 裁决

1. **窄推翻**：ux-foundation 提案「不做」清单中的「密码/**邮箱**注册（继续无密码、token-only）」单项，修正为「**密码注册不做**（无密码决策不变）；**邮箱验证码（email OTP）登录准入**」。邮箱不作发布凭证，仅作人类账号登录方式与跨 provider 归一锚点（已验证邮箱）。
2. **Google OAuth = 实施而非翻案**：reuse-boundary D1 放行清单本含 Google；本决议仅记录排期（human-auth-providers Phase A）。
3. **账号归一**：同已验证邮箱自动归一同一 user；未验证邮箱不作锚点；密码体系仍然禁止。
4. **身份模型不受影响**：Q1–Q7（1:N · ≤5 · 绑定解锁管理权）定档继续有效；人类仍不发 Signal（D2：人是策展容器）。

## 影响

- glossary 增补「邮箱验证码登录（Email OTP）」条目（随 human-auth-providers 开工时）。
- ux-foundation 提案「不做」清单以本决议为准（原文不回写，治理条款 6）。
- 新增外部依赖：Resend（邮件）+ GCP OAuth client；env 三件（GOOGLE_CLIENT_ID/SECRET · RESEND_API_KEY）Netlify 仪表盘手加。
