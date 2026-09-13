/**
 * 归属账本（local-capability-plane P1 · 1.3，决议 D5 规则三：只记委托 + 委托快照）。
 *
 * ledger.json5（design §3.2，schema v1）：entries 只追加不重写；
 * 委托快照（snapshot[].sha256）让账本自足——适配器缺席/被卸载后仍能回答"当时装了什么"，
 * 实际状态归适配器 reconcile() 自报（硬要求）。
 *
 * 写安全：tmp+rename 原子写 + 进程内文件级互斥（promise 链串行化，并发 append 零丢写）；
 * 跨进程互斥留 P2 装载接线时按需升级（当前单 CLI 进程序）。
 * 账本位置：~/.agentsignal/ledger.json5（root 单一真源）。
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import JSON5 from "json5";
import { type AgentSignalPaths, resolvePaths } from "../skills/paths.ts";

export const LEDGER_SCHEMA = "agentsignal.ledger/v1";

/** 对账五态（P2 2.3 消费；账本只存委托记录，实际状态归适配器自报） */
export type ReconcileState = "active" | "outdated" | "revoked" | "missing" | "foreign";

export interface LedgerSnapshot {
  /** 相对宿主根的条目路径（.claude/skills/x/SKILL.md 形态） */
  path: string;
  sha256: string;
}

export interface LedgerEntry {
  pkg_id: string;
  /** "native" | "apm" | "pi" | "dsh" | <社区> */
  adapter: string;
  host: string;
  /** ★ 决定对账口径：link（更新自动跟随）/ copy（重写） */
  mode: "link" | "copy";
  /** ★ 实际落档（D10：L1 原生 / L2 按需 / L3 兜底） */
  ladder: "L1" | "L2" | "L3";
  /** 委托内容清单（skills/<name> …） */
  items: string[];
  snapshot: LedgerSnapshot[];
  /** 委托时间（ISO 8601，append 自动盖） */
  at: string;
}

export interface Ledger {
  schema: typeof LEDGER_SCHEMA;
  entries: LedgerEntry[];
}

function ledgerFile(paths: AgentSignalPaths): string {
  return path.join(paths.root, "ledger.json5");
}

/** 读账本：文件缺失/损坏 → v1 空账本（账本是记录不是门禁，损坏不阻断功能） */
export async function loadLedger(paths?: AgentSignalPaths): Promise<Ledger> {
  const p = paths ?? resolvePaths();
  try {
    const raw = JSON5.parse(await readFile(ledgerFile(p), "utf8")) as Ledger;
    if (raw.schema === LEDGER_SCHEMA && Array.isArray(raw.entries)) return raw;
    return { schema: LEDGER_SCHEMA, entries: [] };
  } catch {
    return { schema: LEDGER_SCHEMA, entries: [] };
  }
}

/** 委托快照：对落装后的文件逐个取 sha256（自足性——账本不依赖适配器存活） */
export async function snapshotOf(
  hostRoot: string,
  relPaths: readonly string[],
): Promise<LedgerSnapshot[]> {
  const out: LedgerSnapshot[] = [];
  for (const rel of relPaths) {
    try {
      const content = await readFile(path.join(hostRoot, rel), "utf8");
      out.push({ path: rel, sha256: createHash("sha256").update(content, "utf8").digest("hex") });
    } catch {
      // 快照时文件已不在——记空 hash 占位（对账时归 missing）
      out.push({ path: rel, sha256: "" });
    }
  }
  return out;
}

// 进程内文件级互斥：append 串行化（并发零丢写）；跨进程由 rename 原子性保文件不损
let writeQueue: Promise<unknown> = Promise.resolve();

/** 追加一条委托记录（entries 只追加；自动盖 at 时间戳；tmp+rename 原子写） */
export function appendLedger(
  entry: Omit<LedgerEntry, "at">,
  paths?: AgentSignalPaths,
): Promise<void> {
  const p = paths ?? resolvePaths();
  const run = async (): Promise<void> => {
    const ledger = await loadLedger(p);
    ledger.entries.push({ ...entry, at: new Date().toISOString() });
    await mkdir(p.root, { recursive: true });
    const file = ledgerFile(p);
    const tmp = `${file}.tmp-${process.pid}`;
    await writeFile(tmp, JSON5.stringify(ledger, null, 2), "utf8");
    await rename(tmp, file);
  };
  const done = writeQueue.then(run, run);
  writeQueue = done.catch(() => {});
  return done;
}

/** 账本是否已存在（首次 init 判断用） */
export async function ledgerExists(paths?: AgentSignalPaths): Promise<boolean> {
  try {
    await stat(ledgerFile(paths ?? resolvePaths()));
    return true;
  } catch {
    return false;
  }
}
