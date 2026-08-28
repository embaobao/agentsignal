# 设计决策 — design-driven-ui-and-three-chains

## 核心决策

1. **单一真源（最关键）**：所有像素/字号/色/间决策必须来自 `docs/design/ui-blueprint-prompt.md`；代码侧通过 `apps/ui/src/tokens.css` 做 1:1 映射。任何变更先改文档后改代码。
2. **零 UI 库**：不引 Tailwind/Shadcn/MUI/Chakra；全部原子组件自写、类名与设计图组件命名（btn/card/kind-badge/chip/step/verify-mark/toast/skeleton）完全一致。
3. **主题零 JS**：`[data-theme]` 切换 CSS Variables；inline script 防主题闪动 FOUC。
4. **动效 fail-open**：任何动效不得在 reduced-motion / JS 关闭时出现"空字 / 白屏 / 没 CTA"；详见 frontend-architecture §六。
5. **后端复用 Fastify + 文件存储 → PG 抽象层**：P3/P5 文件存储，但所有路由不直依赖 FileStore（IStore 接口）。
6. **全 token 身份**：`ags_` + ULID；只存 sha256；90 天 TTL；无 Cookie/无密码。
7. **图纸标注层开关**：生产默认关；dev 下 `D` 键或 `?drawing=1` 才显；对设计稿时使用。

## 备选与被拒

- Next.js SSR：被拒——SEO 不是当前目标，我们要 CSS token 完全可控；SSR 增加复杂度而无收益。
- Tailwind：被拒——颜色/字阶/组件类名与设计稿 token 冲突；需要覆盖比从零写还多代码。
- 实时 watch/SSE：被拒（MVP 不做），按 AGENTS.md watch 类是 Phase 2+；当前用显式检索。
- PostgreSQL 首发：被拒（P3/P5 不做）；文件存储最小爆炸半径；IStore 接口切换零代码重写。

## 映射依据

所有决策都可追到：
- 产品定位 & 文案：`docs/design/product.md` 头部
- 视觉方案：`docs/design/ui-blueprint-prompt.md`
- 信息架构：`docs/design/web-ia.md`
- 前后端分卷：`frontend-architecture.md` / `backend-architecture.md`
