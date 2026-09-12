/**
 * 本地能力面类型真源（local-capability-plane P1 · 1.1，照 design §四接口契约）。
 *
 * 两段接口：
 *   A 段 PackageSource —— 包从哪来（git/npm/apm/local）；
 *   B 段 CapabilityAdapter —— 装到哪、装得对不对（native/apm/pi/dsh/社区）。
 *
 * 三条规则（决议 D5）在类型层的落点：
 *   规则一 能力门控 —— capabilities() 未声明 = 不得调用（UnsupportedCapability 结构化错）；
 *   规则二 归属锁 —— 一宿主×一能力=一适配器（HostLockConflict，锁实现归 1.4）；
 *   规则三 归属记账 —— reconcile() 是硬要求（接口必选方法）。
 *
 * 降级阶梯（决议 D10）：DeployResult.ladder 记实际落档；skipped[]/warnings 必须
 * 带原因——降级可见、不静默丢弃。
 */
import type { HostId } from "../skills/wiring/hosts.ts";

/* ------------------------------- A 段：包从哪来 ------------------------------- */

/** 探测结果：适配器/包源是否可用（缺席不是错误，走降级阶梯） */
export interface Availability {
  available: boolean;
  version?: string;
  /** 不可用时的原因（status 呈现用，降级可见） */
  reason?: string;
}

/** 包引用：三源统一寻址（git: owner/repo@sha · npm: name@version · local: 相对/绝对路径） */
export interface PackageRef {
  source: "git" | "npm" | "local";
  /** 源内地址（repo 路径 / 包名 / 路径） */
  name: string;
  /** 版本锚（git sha / npm version）；local 可缺省 */
  ref?: string;
}

/** 包元数据（resolve 产物，fetch 前的轻量信息） */
export interface PackageMetadata {
  id: string;
  name: string;
  version: string;
  /** 包内容概要计数（skills/mcp/prompts/rules） */
  contents: { skills: number; mcp: number; prompts: number; rules: number };
}

/** 包实体（fetch 产物）：清单 + 内容条目 */
export interface Package {
  meta: PackageMetadata;
  /** 包自带清单（agents.json，D4：对齐 apm.yml 语义）——结构定义归 P4 互操作，此处留位 */
  manifest: Record<string, unknown>;
  items: PackageItem[];
}

/** 包内容条目：可装运的最小单元 */
export interface PackageItem {
  /** 条目 id（skill id / mcp name / prompt 路径…） */
  id: string;
  cap: Cap;
  /** 条目在包内的相对路径 */
  path: string;
}

/* ------------------------------- B 段：装到哪、装得对不对 ------------------------------- */

/** 能力枚举（P1 冻结 · O10）：deploy/remove 分开声明（APM 有 deploy 无 remove） */
export type Cap =
  | "skill"
  | "mcp"
  | "prompt"
  | "rule"
  | "deploy"
  | "remove"
  | "audit"
  | "runtime"
  | "switch";

/** 降级阶梯（决议 D10）：L1 原生 → L2 按需（MCP）→ L3 兜底（rules 一行） */
export type Ladder = "L1" | "L2" | "L3";

export interface DeployResult {
  host: HostId;
  /** ★ 实际落档（不是期望档） */
  ladder: Ladder;
  /** 实际写入的文件/位置清单 */
  written: string[];
  /** 降级/跳过必须带原因（D10 硬约束 2/4：可见、不静默） */
  skipped?: { target: HostId; reason: string }[];
  /** 丢弃字段等一律告警 */
  warnings?: string[];
}

export interface RemoveResult {
  host: HostId;
  removed: string[];
  skipped?: { target: HostId; reason: string }[];
}

/** 对账五态（P2 2.3）：active/outdated/revoked/missing/foreign——foreign 外来条目只读 */
export type ReconcileState = "active" | "outdated" | "revoked" | "missing" | "foreign";

export interface ReconcileEntry {
  item: string;
  host: HostId;
  state: ReconcileState;
  /** 状态解释（outdated 的上游版本、foreign 的疑似来源…） */
  detail?: string;
}

export interface ReconcileReport {
  entries: ReconcileEntry[];
  /** 对账时间（ISO 8601） */
  at: string;
}

/** A 段：包源接口 */
export interface PackageSource {
  /** "git" | "npm" | "local"（apm 经 CapabilityAdapter 走，不作包源） */
  id: string;
  probe(): Promise<Availability>;
  resolve(ref: PackageRef): Promise<PackageMetadata>;
  fetch(ref: PackageRef): Promise<Package>;
}

/** B 段：能力适配器接口（reconcile 硬要求——否则账本失效） */
export interface CapabilityAdapter {
  /** "native" | "apm" | "pi" | "dsh" | <社区> */
  id: string;
  probe(): Promise<Availability>;
  /** ★ 未声明 = 不得调用（规则一：能力门控） */
  capabilities(): ReadonlySet<Cap>;
  hosts(): readonly HostId[];
  deploy(items: PackageItem[], host: HostId): Promise<DeployResult>;
  remove(items: PackageItem[], host: HostId): Promise<RemoveResult>;
  /** ★ 硬要求（规则三）：不实现 reconcile 的适配器过不了契约套件 */
  reconcile(): Promise<ReconcileReport>;
}

/* ------------------------------- 结构化错误 ------------------------------- */

/** 规则一违规：调用了未声明的能力（结构化错，模型可读可自纠） */
export class UnsupportedCapability extends Error {
  readonly code = "UNSUPPORTED_CAPABILITY";
  readonly adapter: string;
  readonly cap: Cap;
  constructor(params: { adapter: string; cap: Cap }) {
    super(
      `适配器 ${params.adapter} 未声明能力 "${params.cap}"——按规则一（能力门控）拒绝调用；` +
        `可用能力见 adapter.capabilities()`,
    );
    this.name = "UnsupportedCapability";
    this.adapter = params.adapter;
    this.cap = params.cap;
  }
}

/** 规则二违规：宿主×能力已被其他适配器持有（含持锁方与建议） */
export class HostLockConflict extends Error {
  readonly code = "HOST_LOCK_CONFLICT";
  readonly host: HostId;
  readonly cap: Cap;
  readonly holder: string;
  constructor(params: { host: HostId; cap: Cap; holder: string }) {
    super(
      `${params.host} × ${params.cap} 已由适配器 "${params.holder}" 持锁（规则二：归属锁）——` +
        `先 unwire 该适配器，或改用其名下适配器操作`,
    );
    this.name = "HostLockConflict";
    this.host = params.host;
    this.cap = params.cap;
    this.holder = params.holder;
  }
}
