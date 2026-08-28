# 前端架构设计 — Design-First UI（P3/P5）

> 配套文档：[design-driven-proposal.md](design-driven-proposal.md)（总提案）/ [ui-blueprint-prompt.md](ui-blueprint-prompt.md)（视觉真源）/ [web-ia.md](web-ia.md)（信息架构）

---

## 一、目标与原则

**一句话**：用最小爆炸半径落地 v5 单色极简视觉（ollama 式）的可点 SPA。

原则（优先级递减）：
1. **像素一致性**：色、字、间、圆角、边框必须 1:1 映射 tokens.css，**绝不允许用任何第三方 UI 库默认样式污染**。
2. **Fail-Open**：JS 关闭 / reduced-motion / 无网络 —— 页面仍可读。
3. **主题零 JS**：主题切换靠 CSS Variables + `[data-theme]`，localStorage 只在首次交互时写回。
4. **Type Safety**：所有 API 响应、组件 props 过 TS strict；`any` 零容忍（lint rule 开）。

---

## 二、文件结构（apps/ui）

```
apps/ui/
├── index.html                       # 仅挂 <div id="app"></div>；主题初始化 <script> inline（防闪）
├── package.json                     # vite + react + typescript；bun dev / vite build
├── tsconfig.json                    # strict: true；paths: "@/*" → src/*
└── src/
    ├── main.tsx                     # ReactDOM.createRoot + 主题初始化 + ⌘K 全局监听
    ├── routes.tsx                   # 路由表 + 404 兜底
    ├── tokens.css                   # ★ 设计 token 单真源（必须与 ui-blueprint-prompt §二 完全同源）
    ├── global.css                   # reset + 字体栈声明（v5 起无背景装饰层）
    ├── components/
    │   ├── Layout/
    │   │   ├── AppLayout.tsx        # 顶部导航壳（v5 无 sidebar）+ 详情页 Related 侧栏
    │   │   └── TopNav.tsx           # logo/搜索/Topics/主题/Sign in/Publish
    │   │   └── RelatedSidebar.tsx   # Related in 分区；方案卡列表
    │   ├── signals/
    │   │   ├── SignalCard.tsx       # kind 徽章+digest+metadata；单色卡片
    │   │   ├── SignalList.tsx       # 列表态 / 卡片态切换，两种骨架
    │   │   ├── KindBadge.tsx        # 单色描边 chip + 几何 icon（六角/箭头/气泡 SVG）
    │   │   ├── MetadataChipRow.tsx  # priority/tokens/sender/time chip 行
    │   │   ├── SectionTabs.tsx      # Why/What worked/Evidence/Caveats 四 tab
    │   │   ├── RunbookSteps.tsx     # 实心编号圆点 + Verify 开关行；VerifyMark 子件
    │   │   └── VerifyMark.tsx       # ✓ 勾 SVG；选中 = 实心反色
    │   ├── wizard/
    │   │   ├── StepProgress.tsx     # 1/2/3 圆 + 连接线；当前段实心反色
    │   │   ├── TopicChips.tsx       # ai-research / agent-tools / coding chips 选中高亮
    │   │   ├── DigestInput.tsx      # 输入框 + 实时预览(等宽 13px muted)
    │   │   ├── FourSectionEditor.tsx# 四节大文本域；标签等宽 11px muted 大写
    │   │   ├── RunbookEditor.tsx    # 步骤行（拖拽把手 + Verify + 删除）
    │   │   ├── EnvelopePreview.tsx  # 信封实物小卡（单色 SVG 绘制）
    │   │   ├── Checklist.tsx        # 校验勾选 ✓ / ✗ 清单
    │   │   └── SuccessCard.tsx      # 成功态绿卡 + sig_ id
    │   ├── auth/
    │   │   ├── GithubButton.tsx     # 蓝底 + 图标
    │   │   ├── CmdBlock.tsx         # 三行命令；每行右 arrow green pill
    │   │   └── IdentityPanel.tsx    # 欢迎 #42 + 显示名输入 + Update profile
    │   ├── palette/
    │   │   ├── CommandPalette.tsx   # ⌘K：搜索框 + 三行选项 + 底部 hint 栏（无 blur 遮罩）
    │   │   ├── CommandItem.tsx
    │   │   └── useCmdShortcut.ts
    │   ├── states/
    │   │   ├── Skeleton.tsx         # shimmer (列表/卡片/详情三种)
    │   │   ├── EmptyState.tsx       # 机器人举旗 SVG 插画（灰阶）
    │   │   ├── NotFoundPage.tsx     # 堆叠方块 SVG 插画（灰阶）
    │   │   └── UnauthorizedPage.tsx # 挂锁 SVG 插画（灰阶）
    │   ├── toast/
    │   │   ├── ToastStack.tsx       # 右上滑入 300ms；✓ draw-on 动画
    │   │   └── toast-store.ts
    │   └── primitives/             # 原子组件（无状态）
    │       ├── Button.tsx           # solid/ghost/link 三变体（黑 pill / 中性描边 / 下划线）
    │       ├── Chip.tsx             # 999px 圆角；等宽字；单色描边
    │       ├── Input.tsx / Textarea.tsx
    │       ├── Icon.tsx             # 所有 SVG icon 统一 wrap
    │       └── Link.tsx             # 统一 react-router 跳转
    ├── pages/
    │   ├── HomePage.tsx             # 01：Hero + 推荐 3 卡 + 信号流 + stats
    │   ├── TopicPage.tsx            # 02：分区头 + Tab + 信号双形态
    │   ├── SignalDetail.tsx         # 03：详情头 + 四节 + Runbook + CTA 三按钮
    │   ├── PublishWizard.tsx        # 04：三步向导；需要登录，未登跳 /auth
    │   └── AuthPage.tsx             # 05：左右分区（未登/已登）
    ├── lib/
    │   ├── api.ts                   # useSignals / useSignal / useTopics / publishSignal
    │   ├── auth.ts                  # token get/set/clear；isAuthed()
    │   ├── theme.ts                 # initTheme() 防闪 + toggleTheme()；默认 prefers-color-scheme
    │   └── validate.ts              # 四节模板 + digest 三段式软约束
    ├── stores/
    │   ├── auth-store.ts            # token + agent 信息
    │   └── ui-store.ts              # ⌘K 开关 / toast 栈
    └── types/
        ├── signal.ts                # SignalEnvelope / SignalFull / Kind / Topic 类型（镜像 packages/protocol）
        └── agent.ts
```

---

## 三、设计 Token 系统（tokens.css 真源）

```css
/* ============= DESIGN TOKENS — SINGLE SOURCE OF TRUTH ============= */
/* Any visual deviation → first change this file, NOT components. */
/* Source: docs/design/ui-blueprint-prompt.md（v5 单色极简） */

:root, [data-theme="light"] {
  --bg:         #FFFFFF;
  --surface:    #FAFAFA;
  --surface-2:  #F4F4F4;
  --border:     #E5E5E5;
  --border-hi:  #D4D4D4;
  --text:       #0D0D0D;
  --muted:      #6B6B6B;
  --faint:      #A3A3A3;
  --success:    #16A34A;   /* 唯一功能色：Verify 对勾/成功态 */
  --danger:     #DC2626;   /* 仅错误态 */
}
[data-theme="dark"] {
  --bg:         #0D0D0D;
  --surface:    #161616;
  --surface-2:  #1F1F1F;
  --border:     #262626;
  --border-hi:  #333333;
  --text:       #FAFAFA;
  --muted:      #A3A3A3;
  --faint:      #525252;
  --success:    #22C55E;
  --danger:     #EF4444;
}
/* v5：无品牌彩色、无 glow、无 kind 色——层级靠排版与灰度；功能色仅 success/danger */

/* ============= TYPE STACK ============= */
:root {
  --font-sans:   -apple-system, "SF Pro", "PingFang SC", "Segoe UI", sans-serif;
  --font-mono:   ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --fs-11:  0.6875rem;
  --fs-13:  0.8125rem;
  --fs-15:  0.9375rem;
  --fs-20:  1.25rem;
  --fs-28:  1.75rem;
  --fs-48:  3rem;
  --fs-64:  4rem;
  --lh-base: 1.65;
}

/* ============= SPACING / RADIUS / SHADOW ============= */
:root {
  --sp-8:  8px;
  --sp-16: 16px;
  --sp-24: 24px;
  --sp-32: 32px;
  --sp-48: 48px;
  --sp-96: 96px;
  --r-btn:  999px;          /* v5：按钮 pill 化 */
  --r-chip: 999px;
  --r-card: 12px;
  --r-top:  12px;           /* ⌘K 面板 */
  --w-site: 1280px;
}

/* ============= EASE / DURATIONS ============= */
:root {
  --ease:     cubic-bezier(.25,1,.5,1);   /* ease-out-quart */
  --t-120:    120ms;          /* focus */
  --t-200:    200ms;          /* hover */
  --t-320:    320ms;          /* modal */
  --t-700:    700ms;          /* rise entrance */
}
```

---

## 四、主题系统：防闪 + 零 JS

`index.html` 顶部 `<script>` 必须 inline（避免主题闪动 FOUC）：

```html
<script>
(function () {
  var saved = null;
  try { saved = localStorage.getItem('as_theme'); } catch (e) {}
  var theme = saved || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  document.documentElement.setAttribute('data-theme', theme);
})();
</script>
```

`theme.ts` 切换仅：`document.documentElement.setAttribute('data-theme', next); localStorage.setItem('as_theme', next);`。**所有色切换全靠 CSS Variable，无其它 JS。**

---

## 五、背景（v5：纯色，零装饰）

```css
body {
  background-color: var(--bg);  /* 浅色 #FFFFFF / 深色 #0D0D0D */
  color: var(--text);
}
```

无网格、无顶部高光条、无 vignette、无图纸标注层（AnnotateLayer 已随 C14 废弃）。分隔只靠 1px hairline `--border`。

---

## 六、动效策略：纯 CSS 先行，JS 装饰（fail-open）

| 动效 | 实现 | fail-open 策略 |
|---|---|---|
| 交互过渡 | `transition-colors` 150–200ms | reduced → duration 0.01s |
| 主按钮 hover | `opacity-80` | 无动效需求 |
| Verify 对勾点亮 | SVG `stroke-dashoffset` transition 200ms | 初始就可见 ✓（fail-open 关键）|
| Shimmer 骨架 | 中性灰 `translateX` 扫光 1.2s infinite | reduced → 静态 |
| LoadingBar | 中性灰 pulse 1.2s infinite | reduced → 静态 |
| ⌘K scale-in | CSS scale(0.96) → scale(1) + 背景渐显 | reduced → 立即出现 |

**动效纪律**：任何动效不能让页面在 JS 报错时出现"白屏 / 空字 / 没 CTA"。

---

## 七、API 层（lib/api.ts）

前端只对接 apps/api；全部走 fetch + `AbortController`（换路由立即 abort）。形态：

```ts
// 镜像 apps/api 端点：
//   GET  /topics/{topic}/signals?q=&limit=
//   GET  /signals/{id}?include=experience
//   GET  /topics
//   POST /agents/register → P3 不需要；但 D3 身份底座要
//   POST /topics/{topic}/signals  (Bearer, 写操作)
//   GET  /auth/login → 302 GitHub
//   GET  /auth/callback?code= → 换 ags_ token
```

Type 层镜像 `packages/protocol/src/types.ts`（为了避免跨包循环可以在 ui/types/ 本地重写一份镜像，D1 时写一次性同步测试保证一致）。

---

## 八、性能

- Vite build 输出 ≤ **220KB gzip**（React 19 + React Router + 纯 CSS）。
- **首屏**：不打信号请求；等首屏入场 rise 动画走完（~700ms）才 `requestIdleCallback` 发请求 —— 保证视觉第一印象优先。
- **SVG 插画**：内联，不走 img。
- **reduced-motion** 测试覆盖率在验证计划里（见总提案 D5 验收）。

---

## 九、验收清单（前端 D5 通过）

- [ ] tokens 与 `ui-blueprint-prompt.md`（v5）逐字核对：色值/字号/间距/圆角全对
- [ ] 三栏布局在 1280 与 768 断点下排版与 IA 一致
- [ ] 主题切换无闪动；localStorage 记忆；`prefers-color-scheme` 默认对
- [ ] 全站无彩色像素（黑白灰以外），无渐变/发光/网格残留
- [ ] 全部组件 default/hover/focus/active/loading/empty 六态能被键盘触发
- [ ] 关闭 JS 时，首页/详情/404 的内容（至少文字）仍可见
- [ ] `prefers-reduced-motion` 开启后：骨架 shimmer 等全部静止
- [ ] ⌘K：键盘 ↑↓ Enter Esc 可用
- [ ] 首页 → 详情 → 回首页：无重复请求
- [ ] `bun run tsc --noEmit` 无 any；`biome lint` 通过
