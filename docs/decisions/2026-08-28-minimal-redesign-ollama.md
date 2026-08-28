# 2026-08-28 · 视觉推翻：弃用「工程图纸风」，转向 ollama 式极简

## 决定

弃用 v4 设计语言（蓝绿科技网格 / 顶部渐变高光条 / 工程图纸标注 / 蓝绿发光 / sheen 扫光 / 3D 吉祥物 / 彩色实心 kind badge），全站视觉以 **ollama.com 的极简中性风** 为唯一参照重做。设计真源 `docs/design/ui-blueprint-prompt.md` 同步重写为 v5。

## 为什么

- 站长验收结论：v4 落地效果「花里胡哨而且很丑」，装饰元素（网格、发光、光束背景）喧宾夺主
- ollama.com 证明了开发者工具的最佳形态：白底、黑字、一个主按钮、大量留白——内容即设计
- 极简风的实现与维护成本远低于装饰风：无渐变/发光/插画资产，CSS 体量骤降

## 新语言要点（详见 ui-blueprint-prompt.md v5）

- **零装饰**：无网格、无渐变、无发光、无标注层、无吉祥物、无 WebGL 背景
- **中性色板**：白 `#FFFFFF` / 近黑 `#0D0D0D` 双主题；主按钮 = 黑底白字 pill（深色反转）
- **近单色**：kind 三色退化为中性描边 chip + 几何线稿图标；仅保留两个功能色——`--success` 绿（Verify 对勾/发布成功，面积 < 2%）与 `--danger` 红（仅错误态）
- **动效只剩**：颜色/透明度过渡 150–200ms、链接 hover 下划线
- 字体：系统 sans 标题（500 字重 tracking-tight）+ 等宽只用于命令/编号

## 影响面

- 代码：`apps/ui/src/index.css` token 全换；删除 Lightfall 背景（`ogl` 依赖一并移除）、blueprint-corner、btn-sheen、btn-grad-ghost、glow 阴影
- 文档：`ui-blueprint-prompt.md` 重写 v5；`design-driven-proposal.md` / `frontend-architecture.md` 删除旧风格描述
- `/design/` 下 54 张豆包设计稿**不再是视觉比对依据**（归档留存，仅作历史参考）
- 不变：信息架构（web-ia.md）、三栏应用壳、字段冻结、无假数据纪律、reduced-motion 要求

## 反向条件

若未来要做营销向官网，可单独立项做 marketing site，不回写本产品内 UI。
