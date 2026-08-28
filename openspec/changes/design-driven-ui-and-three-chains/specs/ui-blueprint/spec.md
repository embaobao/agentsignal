# Spec：UI 视觉蓝图与组件契约（八屏冻结）

> 视觉真源：`docs/design/ui-blueprint-prompt.md`（v4 · 必须 1:1 对齐）
> 信息架构：`docs/design/web-ia.md`（八屏骨架 · 三栏布局 · 字段）
> 代码侧文件：`apps/ui/src/tokens.css`（single source of truth，不得在别处再写硬编码色/字号/圆角）

---

## 1. 八屏骨架与路由

| 屏 | 路由 | 主要模块 | 状态行（必有的非内容区） |
|---|---|---|---|
| 01 首页 | `/` | Hero · 推荐 3 卡 · 4 数字 stats · 最新信号流 · Related 侧栏（首页侧栏放 Top Signalers 排行）| Topbar（搜索/主题/登录）+ Sidebar（分区列表）|
| 02 分区 | `/t/:slug` | 分区头（banner + 名称 + desc + 信号数）· Tabs 最新/最多验证 · 双形态切换 | 同上 + Related 侧栏（同分区热门 8 条） |
| 03 详情 | `/s/:id` | 详情头（kind badge + digest 大标题 + metadata chips）· SectionTabs（Why / What worked / Evidence / Caveats 或 Exec 见下）· RunbookSteps · Related 侧栏（8 条）· CTA 三按钮（Install / Share / Publish Feedback） | 同上；Runbook Verify 点击后右侧 `✓ 17 次验证` +1 |
| 04 向导 | `/publish` | StepProgress 三步 · TopicChips · DigestInput（实时预览）· FourSectionEditor · RunbookEditor · Step 3：Checklist ✓/✗ · EnvelopePreview（红白蓝信封小卡）· SuccessCard（成功绿卡 sig_ id）| 需登录；未登跳 /auth?from=/publish |
| 05 身份 | `/auth` | 未登：GitHub 大按钮 + 命令块三行；已登：Welcome #N + Update 显示名 + 命令块三行（真实 token）+ Revoke 会话 | 无 Sidebar；独立登录布局；双主题但无图纸标注层 |
| 06 ⌘K | 全局（`⌘+K` / `Ctrl+K`）| blur 半屏玻璃 · 搜索框（focus 光标）· 三选项（Go to Signal#42 / 浏览分区 / 快速发布）· 底栏：↑↓选 · Enter确认 · Esc 关闭 | |
| 07 空态 / 404 / 401 | `/404` · `/401` · 嵌入列表空态 | 举旗机器人 / 堆叠方块（404，蓝紫光晕）/ 挂锁（401，绿发光芯）；空态 CTA "发布方案" | 空态嵌入 Topbar 存在；404/401 独立页，Sidebar 简化为仅 Logo |
| 08 加载态 | 所有屏内（路由级 + 组件级）| Shimmer 骨架：列表 4 条 / 卡片 3×2 / 详情头 + 四节灰条 | 无内容；骨架 1.2s shimmer；reduced-motion 静态灰 |

---

## 2. 三栏布局（1280 宽 · 768 折叠）

```
[sidebar 240]  ├────── main 760 ──────┤  [related 280]
+--------------+----------------------+-----------------+
| Logo 多彩 A  |  Topbar (搜索/分区↓/  | Related header  |
| 菜单激活条 2px|  主题切换/登录按钮)  | [8 卡]          |
| 分区列表+badge|                      | Stats 汇总      |
|              |  主体内容             |                 |
|              |                      |                 |
| min-width 240|  （flex:1，min 0）    | min-width 280   |
+--------------+----------------------+-----------------+
1280px 总体：侧栏留白 = (屏幕宽 - 1280) / 2（左右各空）
```

**768 断点（平板/手机）**：
- Sidebar + Related → 收起；Main 全宽。
- Sidebar 变顶部汉堡菜单；Related 折叠为详情页下方 "相关方案" 水平滚动卡。
- 图纸标注层在 768 断点自动隐藏（D 键打开也显示截断的 768 刻度）。

---

## 3. 组件原子化命名（类名 / 组件名锁定）

所有组件在代码中必须使用下列名字（UI 库被拒后，自己定义的命名约定）：

```
原子级
  btn             →  Button（solid/ghost/link，都有 sheen 扫光 hover）
  chip            →  Chip（999px 圆角；等宽字；6 色变体：绿/蓝/紫/灰/红/米）
  input / textarea → Input / Textarea（1px border；focus 蓝绿外发光 + 无 outline 改 box-shadow）
  badge           →  KindBadge（solution 绿 / update 蓝 / discussion 紫 + 左几何六角 icon 内联 SVG）

布局级
  topbar / sidebar / main / related  → AppLayout 子容器
  card            →  SignalCard（16px 大圆角 + 1px border + hover 浮 -2px + 外发光）
  list-row        →  SignalList 行（ListView）

详情
  section-tabs    →  SectionTabs（激活项底 4px 渐变绿条）
  runbook-step    →  RunbookSteps 行：绿圆编号（border 2px）+ 内容 + VerifyMark 右
  verify-mark     →  VerifyMark（SVG ✓；default 灰，hover 绿环，active 绿勾 stroke-dashoffset draw-on）
  metadata-chip-row → 8 个 chip 一行，两端对齐

向导
  step-progress   → 三步：圆 1→2→3 连接线；当前 step 圈蓝绿渐变发光；已过灰 ✓
  topic-chips     → 分区 chips（选中态：蓝绿渐变底 + 白字）
  digest-preview  → DigestInput 右的实时预览（等宽 13px，muted 灰）
  four-section-editor → 四节大文本域（标签等宽 11px 大写 muted）
  runbook-editor  → 可增删步骤 + Verify 开关 + 拖拽把手（drag handle）
  envelope-preview→ 红白蓝信封实物小卡（SVG 绘制 + digest 填到信封窗口）
  checklist       → Step 3 Checklist：标题 + 每行左 ✓ 绿 / ✗ 红
  success-card    → 成功态绿卡：渐变底 0 → bright 绿 + sig_ id + copy pill

命令 & 状态
  cmd-palette     → ⌘K 面板：blur 20px bg + 顶搜索框 + 三行命令项 + 底栏 hint
  cmd-item        → 行：左 command-k 图标 · 中 标题+sub · 右 → green pill 说明
  skeleton        → Shimmer 三形态（card/list/detail）：`linear-gradient(90deg,surface,surface-2,surface)` 平移
  empty-state     → 举旗机器人 SVG（空信号列表）
  not-found / unauthorized → 404 堆叠方块 / 401 挂锁 SVG
  toast           → 右上 stack：300ms 滑入；✓ draw-on；auto 3500ms 关
  mascot-robot    → 3D 感分层 SVG（白身A徽章 + 左右蓝/绿 speech bubble）
  annotate-layer  → 图纸标注层：外框虚线 + 刻度 + 色值 tokens + 1280 768（D 键开关）
```

---

## 4. 设计稿签名视觉（GLOBAL CSS）

```
- 背景：蓝绿科技网格 32px 细线 + 顶部 3px 渐变高光条（蓝→绿）+ 柔光 box-shadow
- 暗角 vignette：radial-gradient 中心透明到暗，聚焦视线（MVP 0.35 opacity）
- 圆角签名：card=16px / btn=8px / chip=999px / palette=12px
- 外发光 hover：box-shadow `0 0 0 1px var(--glow-g)` 加 transform -2px
- 色值顺序：绿(#22C55E / 主CTA/kind-solution/校验成功) ；蓝(#3B82F6 / update / ⌘K)；紫(#7C5CE0 / discussion)；工程蓝(#0D9898 / 网格+高光条)
- 中性色：不直接用 #777/999 死灰；所有 muted/faint 色值带微量绿调 chroma≈0.01（OKLCH 思维）
- 字体：黑体标题（加粗 600） · 等宽数据（chip/badge/code/id） · 系统正文常规
- 图纸标注层（dev / ?drawing=1 才显）：色值 token 列表 · 间距刻度 · 尺寸 1280 768 · 组件状态色条（default/hover/focus/active/loading）
```

---

## 5. 动效契约（纯 CSS 优先 + fail-open）

| 位置 | 动效 | reduced-motion 降级 |
|---|---|---|
| 入场 rise | 700ms ease-out-quart；CSS var `--i` 做 stagger（每个 +80ms）| duration 0.01s |
| 顶 logo 光标 blink | CSS steps(1) 500ms | 停（光标静态）|
| hero 英文标语打字机 | JS 7s 周期重填 textContent；**初始 DOM 文本完整** | 跳过 JS 显示完整文本 |
| CTA 按钮 sheen 扫光 | `::before` 渐变条 2s 周期 translateX；hover 才启 | 不扫 |
| card hover | `translateY(-2px)` + 外发光 150ms | 去掉 translateY，保留微 hover 色 |
| Verify 勾点亮 | SVG `stroke-dashoffset` 200ms | 初始就显示 ✓，不做"先空后画"（fail-open 关键）|
| toast 滑入 | `translateX(16px)→0` + fade 300ms | 立即出现 |
| ⌘K 面板 | `scale(.96)→1` + 背景 blur fade | 立即出现，无 blur 动画 |
| Shimmer 骨架 | background-position 平移 1.2s infinite | 静态（无 shimmer 条）|

**Fail-Open 铁律**：所有 JS 动效初始值=最终可见内容。关闭 JS 时用户仍能看到、读到、点到全部功能。

---

## 6. 设计确认清单（D5 → D1 → D2 → D5 每个里程碑都要勾选）

来自 ui-blueprint-prompt §六。代码对照验收时每一项过。

- [ ] 6.1 色彩：浅色/深色 bg+text+border+绿/蓝/紫 token 与 CSS vars 完全一致
- [ ] 6.2 字体：标题黑体粗/正文系统/数据等宽 三体系齐全；8 个级别字号 11/13/15/20/28/48/64/72
- [ ] 6.3 布局：1280 三栏（sidebar 240/main flex/related 280）+ 768 断点正确
- [ ] 6.4 卡片：16px 大圆角 + 1px border + hover 浮 -2px + 外发光
- [ ] 6.5 组件：Kind Badge（三）、Section Tab（激活底 4px 绿渐变条）、Runbook 绿圆+Verify、StepProgress 三步、⌘K panel、empty/404/401 三张插画、toast stack、16px 吉祥物机器人、sheen CTA
- [ ] 6.6 动效：rise/typing/sheen/hook/blink 全部存在；reduced-motion 时内容 100% 可读
- [ ] 6.7 图纸标注层（dev）：D 键 toggle，色值 token 列表、刻度、1280/768、状态条都有
- [ ] 6.8 无障碍：键盘 Tab 可导航、Focus 有圈（1px 绿环 + 2px 偏移）、⌘K 纯键盘可用
- [ ] 6.9 视觉签名：蓝绿网格背景 + 顶部 3px 高光蓝→绿 + 暗角 vignette + 四角图纸小刻度（dev）都存在
