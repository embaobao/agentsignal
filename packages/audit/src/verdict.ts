/**
 * Verdict Store（audit-restore 1B-2 · 2.4 · 设计 MUST #4）。
 *
 * Signal 生命周期状态机：published/kept/amended/frozen/tombstoned 固定转移表；
 * 非法转移抛 VerdictError（不静默）。verdicts.json 文件持久化（tmp+rename 原子写），
 * 只存状态与转移历史，不复制实体内容。
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

export const verdictStates = ["published", "kept", "amended", "frozen", "tombstoned"] as const;
export type VerdictState = (typeof verdictStates)[number];

/** 固定转移表：键 = from，值 = 允许的 to 列表（不在表内 = 非法，抛错不静默） */
const TRANSITIONS: Record<VerdictState, readonly VerdictState[]> = {
  published: ["kept", "amended", "frozen", "tombstoned"],
  kept: ["amended", "frozen", "tombstoned"],
  amended: ["kept", "frozen", "tombstoned"],
  frozen: ["kept", "amended", "tombstoned"],
  // tombstoned 只能走向 frozen（还原两步的第一步，2.6）；直接回 published 禁止
  tombstoned: ["frozen"],
};

export const VERDICT_CODES = ["ILLEGAL_TRANSITION"] as const;
export type VerdictCode = (typeof VERDICT_CODES)[number];

export class VerdictError extends Error {
  readonly code: VerdictCode;
  readonly from?: string;
  readonly to?: string;
  constructor(code: VerdictCode, message: string, from?: string, to?: string) {
    super(message);
    this.name = "VerdictError";
    this.code = code;
    this.from = from;
    this.to = to;
  }
}

/** 转移合法性断言：非法（含词表外状态）抛 VerdictError，不静默 */
export function assertTransition(from: VerdictState, to: VerdictState): void {
  const allowed = (TRANSITIONS as Record<string, readonly VerdictState[]>)[from];
  if (!allowed) {
    throw new VerdictError("ILLEGAL_TRANSITION", `未知状态：${from}`, from, to);
  }
  if (!allowed.includes(to)) {
    throw new VerdictError(
      "ILLEGAL_TRANSITION",
      `非法转移：${from} → ${to}（允许：${allowed.join("/")}）`,
      from,
      to,
    );
  }
}

export interface VerdictTransition {
  from: VerdictState;
  to: VerdictState;
  at: string;
  actor: string;
}

export interface VerdictRecord {
  state: VerdictState;
  history: VerdictTransition[];
}

interface VerdictFile {
  [entityId: string]: VerdictRecord;
}

export interface VerdictTransitionInput {
  actor: string;
  at: string;
}

/** verdicts.json 文件存储（tmp+rename 原子写；调用方决定落盘位置） */
export class VerdictStore {
  private readonly file: string;
  constructor(file: string) {
    this.file = file;
  }

  private cache: VerdictFile | undefined;

  private load(): VerdictFile {
    if (this.cache) return this.cache;
    try {
      this.cache = JSON.parse(readFileSync(this.file, "utf8")) as VerdictFile;
    } catch {
      this.cache = {};
    }
    return this.cache;
  }

  private save(data: VerdictFile): void {
    mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp-${process.pid}`;
    writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
    renameSync(tmp, this.file);
    this.cache = data;
  }

  get(entityId: string): VerdictRecord | undefined {
    return this.load()[entityId];
  }

  /** 状态转移：assertTransition 把关（非法抛错不落盘），成功后持久化并追加 history */
  transition(entityId: string, to: VerdictState, input: VerdictTransitionInput): VerdictRecord {
    const data = this.load();
    const rec: VerdictRecord = data[entityId] ?? { state: "published", history: [] };
    assertTransition(rec.state, to);
    const next: VerdictRecord = {
      state: to,
      history: [...rec.history, { from: rec.state, to, at: input.at, actor: input.actor }],
    };
    data[entityId] = next;
    this.save(data);
    return next;
  }
}
