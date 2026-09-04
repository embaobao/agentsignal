/**
 * 文案常量（设计规范 §4 文案表，编号即 i18n key）。
 *
 * 红线：任何渲染到界面的字符串不得出现「skills」一词（规范 §0 原则 5 / §8 验收）。
 * 本文件是红线集中把关点 —— 新增文案只走这里，并在 §8 清单自查。
 */

export const G = {
  wordmark: "AgentSignal",
  badge: "本地服务 · 仅此电脑",
  titleWizard: "AgentSignal · 初始化",
  titleManage: "AgentSignal · 管理",
  titleDone: "AgentSignal · 初始化完成",
} as const;

export const A = {
  stepIndicator: (n: number) => `第 ${n} 步，共 3 步`,
  step1Title: "你的 Agent 在哪些领域工作？",
  step1Desc: "选择业务域后，AgentSignal 会优先调取对应领域的经验。可多选，也可以稍后再改。",
  chipPlaceholder: "输入领域，回车添加",
  chipLimit: "自定义领域最多 10 个",
  step2Title: "启用哪些栈规则？",
  step2Desc: "启用后，Agent 在对应技术栈下会获得约定与指引。默认勾选的两项适合大多数前端项目。",
  step3Title: "连接你的宿主",
  step3Desc:
    "已在这台电脑上探测到的宿主勾选后会自动完成接线；未探测到的可以手动勾选，将按默认路径写入配置。",
  detected: "已探测",
  undetected: "未探测到",
  prev: "上一步",
  next: "下一步",
  submit: "完成并写入配置",
  footerBtn: "使用默认配置直接开始",
  footerDesc: "跳过向导，写入推荐配置",
  submitting: "正在写入配置…",
  failTitle: "写入失败",
  failDesc: (reason: string) => `${reason}。未写入任何配置，可以重试或返回修改。`,
  retry: "重试",
  backEdit: "返回修改",
  emptyHosts: "未在这台电脑上探测到已知宿主。可以手动勾选下方宿主按默认路径写入，或直接跳过。",
} as const;

export const F = {
  title: "初始化完成",
  subtitle: "已为以下宿主写入配置：",
  fileItem: (host: string, file: string) => `${host} · ${file}`,
  noHosts: "未连接任何宿主。可以稍后在 IDE 中手动配置，或重新运行向导。",
  nextTitle: "下一步",
  nextBody: "回到你的 IDE，直接向模型提问试试。Agent 会在需要时自动调取相关经验。",
  footer: "本页面由本地临时服务提供。配置已写入，服务已关闭，可以直接关闭此标签页。",
} as const;

export const B = {
  summary: "配置摘要",
  domainsLabel: "业务域",
  domainsEmpty: "通用（未指定领域）",
  stacksLabel: "栈规则",
  stacksEmpty: "未启用任何栈规则",
  wiring: "接线状态",
  wired: "已接线",
  unwired: "未接线",
  drift: "配置漂移",
  fixRow: "修复此行",
  library: "本地库",
  libraryEmpty: "本地库还没有条目。使用一段时间后，这里会显示积累的经验数量。",
  metrics: "效率指标",
  metricThroughput: "吞吐节省",
  metricThroughputDesc: "估算在进入上下文前被省掉的 token 数量",
  metricResidual: "残留占用",
  metricResidualDesc: "会话结束时仍占用上下文窗口的部分",
  metricNote: "按 bytes ÷ 4 估算 token 数，仅为量级参考，不代表账单金额。",
  actions: "操作",
  rerun: "重新运行向导",
  repair: "修复接线",
  repairDisabled: "所有宿主接线正常",
  repairOk: (n: number) => `接线已修复，共处理 ${n} 个宿主。`,
  repairPartial: (m: number, detail: string) => `${m} 个宿主修复失败：${detail}。可再次尝试。`,
  dangerTitle: "危险区",
  dangerDesc: "从所有宿主摘除 AgentSignal 配置，并停止本地服务。此操作不可撤销。",
  dangerBtn: "卸载并摘除全部宿主配置",
  entries: (n: number) => `${n} 条条目`,
  indexRebuilt: (t: string) => `索引上次重建：${t}`,
  storage: (size: string) => `存储占用：${size}`,
} as const;

export const D = {
  title: "卸载并摘除全部配置",
  desc: "以下配置文件将被删除，宿主编排恢复原状：",
  acknowledge: "我了解此操作不可撤销",
  cancel: "取消",
  confirm: "卸载并摘除配置",
  running: "正在摘除配置…",
  fail: (reason: string) => `部分文件删除失败：${reason}。已删除的部分不会恢复。`,
  doneTitle: "已卸载",
  doneBody: (dir: string) =>
    `全部宿主配置已摘除，本地库文件保留在 ${dir}，可手动删除。服务已关闭，可以直接关闭此标签页。`,
} as const;

export const C = {
  title: "配置文件无法解析",
  desc: "配置文件可能被外部修改损坏。可以尝试自动修复，或备份后重新初始化。",
  autofix: "尝试自动修复",
  reinit: "重新初始化",
  autofixFail: (reason: string) => `自动修复未成功：${reason}。建议重新初始化。`,
  backup: (path: string) => `原配置已备份至 ${path}，正在进入初始化向导。`,
} as const;

/** 错误原因枚举（填入 {原因} 占位） */
export const E = {
  E_01: "没有写入权限，请检查目标目录的权限设置",
  E_02: "磁盘写入失败，请检查磁盘空间",
  E_03: "配置文件正被其他进程占用，请关闭对应宿主后重试",
  E_04: "宿主的配置文件格式无法合并，请备份该文件后重试",
  E_05: "发生未知错误，请重试",
} as const;
