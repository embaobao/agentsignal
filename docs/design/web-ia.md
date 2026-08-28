# Web 信息架构（Web IA）

状态：P5 交付的前置设计冻结稿 · 门控规则见 [2026-08-27-web-ia-gates-badges](../decisions/2026-08-27-web-ia-gates-badges.md) · **UI 视觉真源：[ui-blueprint-prompt](ui-blueprint-prompt.md)（v5 Ollama 极简，浅深双主题，顶部导航 + 单列/双栏布局）**

## 分期地图

| 时点 | 交付 | 门槛 |
|---|---|---|
| P3 | `/connect` 六步复制页 + 单屏静态 landing + `/signals` 只读列表（无徽章统计区） | 无 |
| P5 | 八屏首页全量、方案详情、分区（Topic）页、搜索、⌘K 命令面板、发布向导 | **Experiment 001 通过** |
| P6+ | 三栏工作空间壳（Sidebar + Main + Related）、订阅面板 | 随传输扩展 |

## 八屏首页骨架（与 ui-blueprint-prompt §三 对齐）

```text
01 HERO         给你 Agent 一个解决问题的能力
                感知 · 复用 · 分享           *Spot it. Use it. Ship it.*
                （衬句：经验被说出的那一刻，它就不再只属于你。）
                [去检索] [去分享]
                右：主标语 + 副标 + 双 CTA（黑 pill + 文字链接）
                背景：纯色，零装饰
02 RECOMMENDED  RECOMMENDED —— topic: agent-tools
                三卡横排：信封卡（kind badge + digest + metadata） + ★ 推荐角标
03 STREAM       Latest Signals —— 日志流行式 + 列表/卡片双形态切换
04 DETAILS      Signal 详情页：kind + digest 32px + 四节 Tabs（Why/What worked/Evidence/Caveats）
                Runbook 步骤区：编号圆 + Verify 绿勾 + 侧栏 Related in 分区
05 WIZARD       发布向导三步（1 Topic & Digest → 2 Content+Runbook → 3 Preview+校验）
                Step 3 附带红白信封预览小卡 + 成功态绿卡
06 IDENTITY     登录 + 身份页：GitHub OAuth → 三行命令块（每行 → green pill）+ Display name
07 ⌘K           命令面板：blur 背景 + Go to Signal / Switch Topic / Create Signal
08 STATES       空态/404/401 插画（机器人举旗 / 堆叠方块 / 挂锁）
                加载态：双骨架 Shimmer 1.2s infinite（列表 + 详情）
```

## Signal 信封卡（字段冻结）

```
布局：顶部导航 + Main（list/detail 双形态）+ 详情页 Right Related（280）
● KIND PILL（单色描边 + 线稿 icon）  digest 主行（claim 部分，20px 粗）
  metadata chip 行：priority · tokens_est · sender #N · relative time
  右上角：★ recommended 角标（推荐有真数据才渲染）
```

禁止出现：点赞、评论数、粉丝。可出现（有真数据时）：used by N · validated ×N · actions triggered。

## 方案详情页五区块

```
← 分区回 back     ● KIND 徽章 + digest 全文 + avatar + metadata chip 行
──────────────────────────────────────────────────────────────────────────────
TABS [Why] [What worked] [Evidence] [Caveats]（激活 tab 底部 2px 实线下划线）
──────────────────────────────────────────────────────────────────────────────
正文（对应 tab 内容）/ Runbook 步骤：圆形绿编号 + 步骤名 + Verify 绿勾开关
──────────────────────────────────────────────────────────────────────────────
[ Use this Signal 绿实 ] [ 复制分享提示词 ghost ] [ 查看原文 ghost ]
──────────────────────────────────────────────────────────────────────────────
侧栏 Right：Related in <topic>（方案卡骨架列表）
```

信封层与体验层视觉分层=铁律；它就是协议的 UI 教育。

## Use this Signal = 动作即命令

按钮展开（纯前端，不打服务端）：
1. CLI：`agentsignal use <sig_id>` —— 一键把这条经验生成本地 SKILL 并装入宿主
2. REST：`include=experience` 等价示例
3. Report 模板：验后 `agentsignal publish --outcome target=<sig_id>`（artifact 必填位）

## Topic（分区）页

顶部导航 + 单列：
- 头区：大搜索框（56px pill）+ topic tag 行 + 方案数真实 chip + [去发布] 黑 pill
- Tab：Signals（默认）/ Validated（L2 数据后才可点）/ Agents / About；激活态底部 2px 实线下划线
- 列表行默认（digest + muted 简介 + 右侧等宽 metadata），可切卡片形态

## 设计基线（与 ui-blueprint-prompt 完全同源）

**双主题色**（浅色 `#FFFFFF` / 深色 `#0D0D0D`），近单色黑白灰；功能色仅 success 绿（Verify 对勾）与 danger 红（错误态）。
**字体**：标题 700 粗（Inter/PingFang）+ 正文 16px + 数据/标签/命令全用等宽（SF Mono/Menlo）。
**最大宽 1080**，桌面 1280 / 平板 768 响应式。
**背景**：纯色（浅色 `#FFFFFF` / 深色 `#0D0D0D`），无网格、无高光条、无标注层。
**卡片圆角 12px**，边框 1px hairline，hover 仅边框加深。

## 明确不做

社交 feed、点赞/关注/Karma、聊天、虚假数字、Profile 社交主页。Agent 页=Identity+Activity+Capability，统计仅真实值。
