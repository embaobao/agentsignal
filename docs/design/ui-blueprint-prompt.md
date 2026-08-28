# AgentSignal — 设计稿生成提示词（v5 · Ollama 极简工程美学）

设计基准：ollama.com 的设计语言 —— 近单色极简、超大留白、Inter 字体、单线 SVG 吉祥物、搜索优先、终端命令块、「两分钟跑起来」的工程师语气。
本方案替代 v4 的「蓝绿科技网格 + 工程图纸标注」风格，全部界面按 Ollama 式克制美学重绘。
双主题：浅色 #FFFFFF 纯白基 + 深色 #0D0D0D 近黑基。每屏双主题并排输出。

## 一、设计转向说明（v4 → v5）

| 维度 | v4 工程图纸风 | v5 Ollama 极简风 |
|---|---|---|
| 背景 | 蓝绿网格 + 顶部渐变高光条 | 纯色留白，无网格无高光 |
| 色彩 | 绿/工程蓝/紫三语义色 + 发光 | 近单色（黑白灰），功能色仅 1 个绿勾 |
| 外框 | 工程尺寸标注、色值 token 刻度 | 全部去除，画面零装饰 |
| 吉祥物 | 3D 渲染小机器人 | 单线 SVG 线稿机器人（对标 llama 线稿） |
| 卡片 | 1px 描边 + hover 蓝绿发光 | 极浅灰底或 1px #E5E5E5 描边，hover 仅边框加深 |
| CTA | 绿色实心 + 渐变 sheen | 黑色实心 pill，hover 微提亮 |
| 气质 | CAD 图纸、参数感 | 「一行命令跑起来」的自信与安静 |

## 二、Ollama 设计语言拆解（提炼自 ollama.com）

- 近单色：页面 95% 是黑、白、灰。没有任何渐变、发光、网格。视觉重量全部来自排版与留白。
- 排版即设计：大标题粗黑 Inter（40–56px），短句，一句话说清价值（"Run open models."）。正文 16px、行高 1.7、灰黑色。
- 黑色 pill 按钮：主 CTA 一律纯黑实心圆角（999px 或 8px），白字，无阴影无渐变。
- 单线 SVG 吉祥物：llama 是黑白单线插画，只有 2–3px 线宽、零填充。它是全站唯一「装饰」，因此辨识度极高。
- 搜索优先：模型库 = 一个大搜索框 + tag 筛选 + 列表。列表行信息密度高但极安静：名称、简介、参数 tag、下载量、更新时间。
- 终端命令块：深色圆角块 + 等宽字体 + 右上角复制按钮，如 ollama run deepseek。是全站最核心的转化组件。
- 真实数据说话：tokens/sec 对比条形图、下载量、star 数——数字用等宽字体，图表灰阶 + 一个黑色高亮条。
- 语气：短、直接、工程师口吻，零营销词（"Get up and running in less than two minutes"）。

## 三、AgentSignal 新设计语言（精确到色值与像素）

### 1. 色彩体系（双主题，近单色）

| Token | 浅色 (Light) | 深色 (Dark) | 用途 |
|---|---|---|---|
| `--bg` | `#FFFFFF` | `#0D0D0D` | 页面底 |
| `--surface` | `#FAFAFA` | `#161616` | 卡片/面板底 |
| `--surface-2` | `#F4F4F4` | `#1F1F1F` | 输入框、tag、骨架屏 |
| `--border` | `#E5E5E5` | `#262626` | 1px 分隔线/卡片描边 |
| `--text` | `#0D0D0D` | `#FAFAFA` | 标题与正文 |
| `--muted` | `#6B6B6B` | `#A3A3A3` | 次要文字、metadata |
| `--faint` | `#A3A3A3` | `#525252` | 极淡辅助 |
| `--accent` | `#0D0D0D` | `#FAFAFA` | 主 CTA 实心（黑/白反转） |
| `--success` | `#16A34A` | `#22C55E` | 唯一功能色：Verify 对勾、发布成功态，面积 < 2% |
| `--danger` | `#DC2626` | `#EF4444` | 仅错误态图标/文字 |

规则：kind 不再用彩色区分（solution/update/discussion 改为「线稿小图标 + 等宽大写文字」的单色 pill，见组件节）。全屏除 success 绿勾外无彩色。

### 2. 字体

- 全站一族：`Inter, -apple-system, PingFang SC, sans-serif`
- hero 48–56px / 700，h2 28–32px / 650，h3 20px / 600，正文 16px / 1.7
- 等宽：`ui-monospace, SF Mono, Menlo, monospace` 12–13px
  用于：命令、digest metadata、kind 文字、编号 #42、下载/验证计数
- 所有数字、编号、token 计数一律等宽（对齐即美感）

### 3. 布局

- 内容最大宽 1080，单列叙事流为主（对标 ollama.com 首页）；应用内页（列表/详情）可用双栏：主内容 720 + 右侧 Related 280，取消左侧导航栏，导航收进顶部
- 顶部导航（全站唯一 chrome，高 64px，底部 1px --border）：
  左：线稿机器人 logo + AgentSignal（600 字重）｜中：搜索框（宽 320，pill，Search signals, topics, commands…）｜右：Topics 文字链接 + Sign in ghost + 黑色 pill Publish
- 间距 8 倍数，区块间垂直留白 96–128px（Ollama 式大留白是风格本体）
- 圆角：卡片 12px，按钮/搜索框 8px 或 999px pill，输入 8px
- 无阴影。hover 只改边框色或底色（--surface ↔ --surface-2）

### 4. 组件（Ollama 化后的原子）

- **Logo / 吉祥物**：单线 SVG 机器人（2.5px 线宽、当前文字色描边、零填充、胸口圆圈内 A 字）。与 llama 同级克制。深色模式下描边反白。
- **Kind Pill（单色版）**：solution / update / discussion = 1px --border 描边 pill + 等宽大写 12px 文字 + 左侧 14px 线稿图标（对勾 / 上箭头 / 气泡）。选中态：黑底白字（浅色）/ 白底黑字（深色）。无绿蓝紫。
- **Signal 列表行**（核心组件，对标 ollama 模型列表）：
  左：digest（18px/600，可点击）+ 一行 muted 简介；右：等宽 metadata（verified ×128 · 2.1k tokens · #42 · 2024-08-16）；行底 1px --border 分隔。hover：底色变 --surface。
- **Signal 卡片**（首页推荐用）：--surface 底 + 12px 圆角 + 无边框或 1px --border；内：kind pill + digest + 三行 metadata；无发光、无渐变。第一张推荐卡仅加左上角等宽小字 RECOMMENDED。
- **终端命令块**（转化核心，对标 ollama run）：深色块（浅色主题下也用 #0D0D0D 底白字，全站唯一「常驻深色」组件）+ 等宽三行命令 + 每行右侧复制 icon；命令示例：
  ```
  ags login
  ags topic select ai-research
  ags use signal/042
  ```
- **主 CTA**：黑色实心 pill，白字，如 Use this Signal、Publish、Get started；次 CTA 为 ghost（1px 边框 + 黑字）。
- **Verify 开关**：圆角 pill 开关 + 对勾；仅「已验证」态出现 --success 绿勾，全页唯一彩色像素。
- **四节 Tabs**（Why / What worked / Evidence / Caveats）：等宽小写文字 tab，激活态底部 2px 黑条（非绿渐变）。
- **⌘K 命令面板**：居中 560 宽面板，1px 边框 + --surface 底（不用毛玻璃），顶搜索行 + 三行命令 + 每行右侧等宽 #1 #2 #3 + 底部 ↑↓ navigate · enter select · esc close hint（等宽 12px muted）。
- **空态/错误态**：线稿机器人 SVG 单图 + 一行短句 + 一个黑色 CTA。空态：机器人举空白旗，No signals yet；404：机器人头顶问号，Page not found；401：机器人抱锁，Sign in required。零填充、单色描边。
- **加载态**：--surface-2 骨架条，1.2s 横向微亮扫过（灰阶，无彩色 shimmer）。
- **数据展示**（首页 stats / 详情验证数）：灰阶条形 + 黑色高亮条 + 等宽数字，如 verified 128 / views 4.2k。无数据则整块隐藏。

### 5. 动效（克制版）

- 按钮 hover：黑 → #333（200ms）
- 卡片/列表行 hover：底色或边框 150ms 过渡，无位移、无发光
- Verify 对勾：灰 → 绿 200ms 点亮
- ⌘K：面板 fade + 98%→100% scale（150ms），背景 rgba(0,0,0,.4) 遮罩（无 blur）
- 骨架 shimmer：1.2s 灰阶扫过
- 禁止：呼吸高光、渐变扫光、浮起动画、弹簧动效

## 四、功能规划与界面清单（8 屏，每屏双主题并排）

信息架构沿用 v4 功能，视觉全部按第三节重绘。每屏提示词可直接喂给出图模型。

### 01 首页（落地页 · 单列叙事流）

- 顶导航（64px）：线稿机器人 logo + AgentSignal + 中央搜索框 + Topics + Sign in + 黑色 pill Publish
- Hero（居中单列，上下留白 128px）：
  - 线稿机器人 SVG 居上（高 120px，单色描边）
  - 主标语 52px/700：Give your agent the ability to solve problems.（中文稿：给 Agent 一个解决问题的能力）
  - 三词动作链（等宽 muted）：感知 · 复用 · 分享；英文伴标语（faint）：Spot it. Use it. Ship it.（i18n 双语互换）
  - 副标 16px muted 一行：社区验证过的 solution，一条命令装进你的 agent
  - 终端命令块（深色、宽 520 居中）：仅一条安装命令 `npm install agentsignal`，控制台打字动效（逐字打出 + 输出行逐行浮现，ready 行 success 绿）+ 复制按钮
  - 双 CTA：[Get started] 黑实 + [Browse signals →] 纯文字链接
- 「How it works」三步横排（纯文字 + 等宽序号 01/02/03）：检索 → 验证 → 复用
- 「Featured signals」三卡横排（kind pill + digest + 等宽 metadata），首卡左上角 RECOMMENDED 等宽小字
- 灰阶数据条：signals 1,204 · verified 8.6k · agents using 3,912（等宽，单行，无数据则隐藏）
- 页脚：单列链接 + 线稿机器人小标

出图提示词：极简白色落地页，ollama.com 风格，居中单列布局，超大留白，Inter 粗黑大标题，单线 SVG 机器人吉祥物（黑白线稿、2.5px 描边、零填充、胸口 A 字徽章），深色终端命令块带复制按钮，黑色 pill 主按钮，无任何渐变/阴影/网格/彩色。

### 02 分区 / 浏览页（搜索优先）

- 顶部大搜索框（56px 高 pill，对标 ollama 模型库搜索）+ 下方 topic tag 行（ai-research agent-tools coding 单色 pill，选中黑底白字）
- tab：Latest / Most verified（等宽，激活底 2px 黑条）
- 信号列表行形态（默认）：digest + muted 简介 + 右侧等宽 metadata + 行底 1px 分隔
- 可切换卡片形态：3 列 --surface 卡片
- 每行右侧 verified ×N 为唯一强调（等宽黑字 + 绿勾小 icon）

### 03 方案详情页（双栏）

- 主栏 720：kind pill + digest 32px/700 + 等宽 metadata 行 + 四节 tabs（Why/What worked/Evidence/Caveats，激活 2px 黑条）+ Runbook 步骤（等宽序号 1. 2. 3. + 步骤名 + 右侧 Verify pill 开关，已验证显绿勾）
- 三 CTA 横排：[Use this Signal] 黑实 + [Copy prompt] ghost + [Source →] 文字链接
- 右栏 280：Related in ai-research + 相关信号行（仅 digest + verified 数）
- 全页仅 Verify 绿勾一处彩色

### 04 发布向导（三步 · 单列 720）

- 进度：等宽 Step 1 of 3 + 1px 进度线（黑色填充当前段），不用圆点连接线图形
- Step 1：topic 单色 pill 选择 + digest 输入框（1px 边框，focus 边框变黑）+ 右侧/下方实时预览卡
- Step 2：四节大文本域（等宽 label + 无边框 --surface 底 textarea）+ Runbook 编辑器（行 = 序号 + 输入 + Verify 开关 + 拖拽把手）+ 底部校验清单（等宽，通过项绿勾）
- Step 3：预览卡（即详情页主栏缩略）+ 校验清单 + [Publish] 黑实；成功态 = 白底卡 + 绿勾 + Published as signal/128 等宽 + 终端块 ags use signal/128

### 05 登录 / 身份

- 左：登录页居中 400 宽：线稿机器人 + Sign in to AgentSignal（28px）+ [Continue with GitHub] 黑实（GitHub icon） + 一行 muted 条款
- 右：身份页：欢迎 Welcome, #42（等宽编号）+ Display name 输入 + [Update profile] 黑实 + 终端块三行命令（ags login / ags topic select … / ags publish）

### 06 ⌘K 命令面板

- 遮罩 rgba(0,0,0,.4) + 居中 560 面板（1px 边框、无 blur）
- 搜索行：放大镜 + Search commands, signals, topics… + 右侧等宽 esc
- 三行：Go to Signal / Switch Topic / Create Signal，左侧线稿 icon + 文字 + 右侧等宽 #1 #2 #3
- 底部 hint：↑↓ navigate · enter select · esc close（等宽 12px muted）

### 07 空态 / 错误态（三联）

- 空态：线稿机器人举空白旗 + No signals yet + [Publish first signal] 黑实
- 404：线稿机器人头顶 ? + Page not found + [Back home →] 文字链接
- 401：线稿机器人抱锁 + Sign in required + [Sign in] 黑实
- 全部单色线稿、零填充、居中、大留白

### 08 加载态（双骨架）

- 左：列表骨架（8 行：标题条 + metadata 短条，--surface-2 灰块）
- 右：详情骨架（digest 长条 + tab 条 + 步骤行 ×4 + 侧栏短条 ×3）
- 1.2s 灰阶 shimmer，无彩色

## 五、通用出图提示词模板（每屏前置）

```
UI design, ollama.com aesthetic, ultra-minimal developer tool interface,
near-monochrome (pure white #FFFFFF background, near-black #0D0D0D text,
single green #16A34A only for verified checkmarks), Inter typeface,
huge whitespace, single-column narrative layout, black solid pill CTA buttons,
single-line SVG robot mascot (2.5px stroke, no fill, letter A badge on chest),
dark terminal command block with monospace font and copy button,
monospace metadata (#042, verified ×128, 2.1k tokens),
no gradients, no shadows, no glow, no grid, no glassmorphism, no emoji,
side-by-side light + dark theme, 2880×1620 canvas
```

每屏在此模板后追加该屏内容描述（第四节各屏条目翻译为英文短语即可）。

## 六、禁止出现

- 任何渐变、发光、网格背景、顶部高光条、工程尺寸标注、色值 token 外框（v4 元素全部移除）
- kind 三色 badge（绿/蓝/紫 pill）——改单色线稿 icon + 等宽文字
- 彩色插画、3D 渲染吉祥物、毛玻璃 blur
- 营销 banner、emoji、感叹号轰炸、假数据（无数据整块隐藏）
- 小于 12px 正文、宋体/衬线标题
- 除 Verify 绿勾与错误红外的一切彩色

## 七、设计确认清单

- [ ] 画面 95% 黑白灰，仅 Verify 绿勾一处功能色？
- [ ] 吉祥物是单线 SVG 线稿（对标 llama 的克制）？
- [ ] 主 CTA 是纯黑实心 pill，无渐变无阴影？
- [ ] 有深色终端命令块 + 复制按钮？
- [ ] 所有数字/编号/metadata 为等宽字体？
- [ ] 导航收进顶部 64px 栏，无左侧 sidebar？
- [ ] hover 仅底色/边框变化，无发光无位移？
- [ ] 双主题并排，深色版为 #0D0D0D 底？
- [ ] 文案短句工程师口吻，无营销词无假数据？
