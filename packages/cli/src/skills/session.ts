/**
 * Trace 持久化（skill-engine 2.3）：~/.agentsignal/sessions/<id>.json
 *
 * 口径：**只记录不审计** —— 记录调用链、懒加载与 verify，供事后排查；不做 LLM 审计、不回传。
 * TTL 30min · 50 轮上限 · graceful shutdown 刷盘 · 异常时 tee 全量落盘并把路径写进 stdout。
 */
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { ulid } from "@agentssignal/protocol";
import { type AgentSignalPaths, resolvePaths } from "./paths.ts";

export const SESSION_TTL_MS = 30 * 60_000;
export const SESSION_MAX_ROUNDS = 50;

export interface TraceEntry {
  ts: string;
  tool: string;
  ok: boolean;
  ms: number;
  code?: string;
  note?: string;
}

export interface SessionFile {
  id: string;
  started_at: string;
  entries: TraceEntry[];
}

export class Trace {
  private readonly paths: AgentSignalPaths;
  private readonly entries: TraceEntry[] = [];
  private closed = false;
  private tmpSeq = 0;
  readonly id: string;
  readonly startedAt: string;

  constructor(paths: AgentSignalPaths, id?: string, startedAt?: string) {
    this.paths = paths;
    this.id = id ?? ulid().toLowerCase();
    this.startedAt = startedAt ?? new Date().toISOString();
  }

  get file(): string {
    return path.join(this.paths.sessionsDir, `${this.id}.json`);
  }

  get length(): number {
    return this.entries.length;
  }

  record(entry: TraceEntry): void {
    if (this.closed) return;
    this.entries.push(entry);
    if (this.entries.length >= SESSION_MAX_ROUNDS) {
      const snapshot = this.entries.splice(0);
      void this.write(snapshot).catch(() => undefined);
    }
  }

  /** 刷盘全部存量（graceful shutdown / 手动收尾用） */
  async flush(): Promise<string> {
    const snapshot = this.entries.splice(0);
    return this.write(snapshot);
  }

  private async write(snapshot: TraceEntry[]): Promise<string> {
    const payload: SessionFile = {
      id: this.id,
      started_at: this.startedAt,
      entries: snapshot,
    };
    await mkdir(this.paths.sessionsDir, { recursive: true });
    const tmp = `${this.file}.tmp-${process.pid}-${++this.tmpSeq}`;
    await writeFile(tmp, JSON.stringify(payload, null, 2), "utf8");
    await rename(tmp, this.file);
    return this.file;
  }

  close(): void {
    this.closed = true;
  }
}

export function createTrace(paths?: AgentSignalPaths): Trace {
  return new Trace(paths ?? resolvePaths());
}

/** graceful shutdown：SIGTERM/SIGINT 刷盘后退出；异常路径 tee 全量落盘并打印路径 */
export function registerShutdown(trace: Trace): void {
  const onSignal = (signal: string) => {
    void (async () => {
      trace.close();
      const file = await trace.flush().catch(() => trace.file);
      process.stderr.write(`[agentsignal] ${signal} 收到，Trace 已落盘：${file}\n`);
      process.exit(0);
    })();
  };
  process.once("SIGTERM", () => onSignal("SIGTERM"));
  process.once("SIGINT", () => onSignal("SIGINT"));
  process.once("uncaughtException", (err) => {
    void (async () => {
      trace.close();
      const file = await trace.flush().catch(() => trace.file);
      process.stderr.write(`[agentsignal] 未捕获异常：${String(err)}\nTrace 全量落盘：${file}\n`);
      process.exit(1);
    })();
  });
}

/** TTL 清理：删除过期会话文件（只读记录，不做审计） */
export async function pruneSessions(paths?: AgentSignalPaths): Promise<number> {
  const p = paths ?? resolvePaths();
  const { readdir, stat, rm } = await import("node:fs/promises");
  let removed = 0;
  let files: string[] = [];
  try {
    files = await readdir(p.sessionsDir);
  } catch {
    return 0;
  }
  const now = Date.now();
  for (const f of files) {
    const full = path.join(p.sessionsDir, f);
    try {
      const st = await stat(full);
      if (now - st.mtimeMs > SESSION_TTL_MS) {
        await rm(full, { force: true });
        removed++;
      }
    } catch {
      /* 忽略 */
    }
  }
  return removed;
}
