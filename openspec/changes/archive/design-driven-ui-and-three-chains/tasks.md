# 任务拆分清单 — design-driven-ui-and-three-chains

> 执行顺序：**先后端 D1 端点 → 再前端 D1 首页 → 校准对稿 → 继续推进**。每一项完成后打勾。

---

## M0 基础设施（0.5 天）

- [ ] M0.1 脚手架：`apps/ui/` Vite + React + TS strict；workspace 登记；根 package.json 加 `dev:ui / build:ui / verify` 链
- [ ] M0.2 tokens.css 单一真源完整写入（与 ui-blueprint-prompt §二 逐值核对）
- [ ] M0.3 global.css：蓝绿科技网格背景 + 顶部高光条 + 暗角 vignette
- [ ] M0.4 主题初始化 inline script：`index.html` 顶部防闪
- [ ] M0.5 AnnotateLayer 组件：图纸标注层（色值/刻度/1280 768/组件状态条）；D 键 toggle
- [ ] M0.6 Biome + tsc 配置：noImplicitAny；strict；无 `console.log(token 明文)` lint 自定义

## M1 后端：三链路端点（1.5 天 · 可与 M0 并行）

- [ ] M1.1 packages/protocol：types.ts 追加 UI 扩展镜像 `SignalEnvelopeExt`（packages/protocol/src/ui-ext.ts）
- [ ] M1.2 apps/api storage：`IStore` 接口 + FileStore 实现（list/get/put/related/frontpageStats/bumpVerify）
- [ ] M1.3 apps/api routes：topics · signals · related · stats/frontpage（读免登）
- [ ] M1.4 apps/api auth：bearer 解析 preHandler + rate-limit
- [ ] M1.5 apps/api agents：register 自注册 + token 签发（ags_ ULID；sha256 存；一次性显示）
- [ ] M1.6 apps/api auth-github：login/callback 端点（state 防 CSRF；data/sessions/state_*.json）
- [ ] M1.7 apps/api validate：`POST /validate/envelope`（digest 三段式软告警 + 四节标题率）
- [ ] M1.8 apps/api publish：`POST /topics/:t/signals` + zod 校验 + validate 流水线 + digest_valid 写入
- [ ] M1.9 bun test：关键路径单测（存储读/写、rate limit、token sha 不落日志、zod 非法参数拦截）
- [ ] M1.10 e2e：three-chains.test.sh 三链路 curl 全通过（见 backend-architecture §十一）

## D1 设计校准（2 天 · 最重要裁决点）

> **不通过则不推进后续编码**（见总提案 D1）。

- [ ] D1.1 HomePage：Hero（主标语 + 英文打字机 + 衬句 + 三词 chips + 双 CTA + 吉祥物右）
- [ ] D1.2 Hero 下方 4 数字条：信号/安装/本周新增/Agent；`GET /stats/frontpage`
- [ ] D1.3 推荐 3 卡：蓝绿渐变底变体 + 推荐标签
- [ ] D1.4 最新信号流：Kind Badge（三色几何 icon）+ digest 粗体 + metadata chip 行
- [ ] D1.5 Sidebar + Topbar：导航激活条 / 搜索框 / 主题切换按钮（无登录态，P5 补）
- [ ] D1.6 主题切换：light/dark 全部 token 生效；`prefers-color-scheme` 默认跟随
- [ ] **D1.7 对稿：并排截图（设计图 vs 实现），站长勾选 ui-blueprint-prompt §六 前 4 项 ≥ 85% 一致** —— 放行裁决

## M2 P3 前端（5 屏，3 天）

- [ ] M2.1 02 分区页：TopicPage；Tabs（最新/最多验证）；信号列表态/卡片态切换
- [ ] M2.2 03 详情页：SignalDetail；SectionTabs（Why/What worked/Evidence/Caveats/Exec 五节？四节？按 web-ia §四节冻结）
- [ ] M2.3 03 Runbook：绿圆编号 + VerifyMark（✓ 点亮 transition 200ms；fail-open 初始可见）
- [ ] M2.4 03 RelatedSidebar：8 卡 Related；`GET /signals/:id/related`
- [ ] M2.5 03 CTA 三按钮：Install/Share/Publish Feedback（未登不禁用，hover 提示跳 /auth）
- [ ] M2.6 07 空态插画：机器人举旗 SVG 三色；在列表为 0 时展示
- [ ] M2.7 08 加载态：Skeleton 三种（列表/卡片/详情）；shimmer 1.2s infinite；reduced-motion 静态

## D2 最小闭环裁决（1 天）

> 走通：首页 → 搜索 → 点进详情 → 点击 Related → 回首页。无空白/无报错/无障碍断链。

- [ ] D2.1 三态（加载/空/内容）每屏都有状态展示图
- [ ] D2.2 reduced-motion + 无 JS：页面内容仍可读
- [ ] D2.3 1280 + 768 断点都过；biome lint 通过；tsc noEmit 0 any

## M3 身份底座（1.5 天 · P5 前置）

- [ ] M3.1 apps/ui AuthPage：左右分区；未登态 GitHub 按钮 + GitHub OAuth 跳转
- [ ] M3.2 apps/ui 登录回调：URL 拿 token → localStorage 写 → auth-store → 跳回来源页
- [ ] M3.3 apps/ui 已登：IdentityPanel（#编号 + 显示名输入 + 三行命令块 CmdBlock，每行右 Green pill →）
- [ ] M3.4 Topbar 头像区：未登→"GitHub 登录"绿按钮；已登→#编号 chip + 菜单（身份页/退出登录）
- [ ] M3.5 lib/api：Bearer ags_ 注入 + 401 自动跳 /auth + token 过期提示

## M4 P5 全量（4 天）

- [ ] M4.1 04 发布向导：三步 StepProgress + 红白蓝信封预览卡 + 主题/模板 chips + 四节编辑器
- [ ] M4.2 04 向导 Step 3 Checklist：validate 响应逐项 ✓/✗；成功态绿卡 sig_ id 块
- [ ] M4.3 06 ⌘K 命令面板：window ⌘K / Ctrl+K 全局监听；三行选项（Go to signal#42/浏览分区/快速发布）；键盘 ↑↓ Enter Esc
- [ ] M4.4 07 404：堆叠方块 SVG 插画；CTA 回首页
- [ ] M4.5 07 401：挂锁 SVG 插画（绿发光芯）；CTA 登录 GitHub
- [ ] M4.6 推荐卡蓝绿渐变 hover：sheen 扫光；卡片 16px 圆角 hover 外发光 + 浮起
- [ ] M4.7 打字机 hero 标语：7s 周期；初始 DOM 有完整文本（fail-open）
- [ ] M4.8 toast stack：成功/失败/提示三色；右上滑入 300ms；Verify ✓ draw-on 动画

## D5 总验收（1 天）

- [ ] D5.1 逐屏对稿：ui-blueprint-prompt §六 9 项设计确认清单全通过
- [ ] D5.2 完整链：GitHub OAuth 登录 → 发向导 → 提交 → 首页可见 → 点详情 → Runbook Verify +1 → 计数正确
- [ ] D5.3 无障碍：Tab/Focus 圈；⌘K 键盘全链路；reduced-motion 不卡；空态可读
- [ ] D5.4 bun verify（check + lint + test + test:node）全绿
- [ ] D5.5 文档同步：所有 hero 文案/设计语言/交叉链接一致（含 AGENTS.md）
