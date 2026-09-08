/**
 * 订阅同步器（dynamic-skill-management P2.1 · 决议 2026-09-08 裁决 1/5）。
 *
 * pull 式按需同步，无常驻进程；Zero-LLM。单订阅一次调用：
 *   游标分页拉信封（cursor = sig_<ulid>）→ 过滤（kind=solution · min_validation 阈值）
 *   → 逐条 include=experience 拉全文 → transcode upsert 落库 → 游标推进并持久化
 *   （进 config.json5 subscriptions 段，原子写）。
 * watch 纪律：at-least-once + sig_id 幂等（installSignal 同 id 覆盖）；429 按 retry_after
 * 退避重试同页；结构化日志（JSON 行，log 注入）。
 */
import type { ValidationLevel } from "@agentssignal/protocol";
import { loadConfig, writeConfigAtomic } from "./config.ts";
import { installSignal } from "./install.ts";
import type { AgentSignalPaths } from "./paths.ts";
import { parseDigest } from "./transcoder.ts";

export const SYNC_CODES = ["CONFIG_MISSING", "RATE_LIMITED", "HTTP_ERROR"] as const;
export type SyncCode = (typeof SYNC_CODES)[number];

export class SyncError extends Error {
  readonly code: SyncCode;
  readonly status?: number;
  constructor(code: SyncCode, message: string, status?: number) {
    super(message);
    this.name = "SyncError";
    this.code = code;
    this.status = status;
  }
}

/** 信封列表项的结构子集（服务端游标列表响应） */
interface ListEnvelope {
  id: string;
  kind: string;
  digest: string;
  topic?: string;
  created_at?: string;
}

interface ListPage {
  signals: ListEnvelope[];
  next_cursor: string | null;
}

export interface SyncOptions {
  baseUrl: string;
  /** 注入 fetch（测试 fake / 未来代理）；缺省全局 fetch */
  fetchImpl?: typeof fetch;
  paths?: AgentSignalPaths;
  /** 单页大小（默认 20） */
  pageSize?: number;
  /** 429 同页重试上限（默认 2 次） */
  maxRetries?: number;
  /** 退避睡眠注入（测试零等待）；参数为毫秒 */
  sleepImpl?: (ms: number) => Promise<void>;
  /** 结构化日志（JSON 行）；缺省 console.error */
  log?: (line: string) => void;
}

export interface SyncReport {
  topic: string;
  /** 扫过的信封数（含跳过） */
  scanned: number;
  /** 落库数（含同 id 幂等覆盖） */
  installed: number;
  /** 跳过数：非 solution / 低于阈值 / 详情不可达 */
  skipped: number;
  /** 同步后游标（= 最后处理到的 sig id） */
  cursor: string | null;
  /** 是否已追上（next_cursor = null） */
  done: boolean;
}

const RANK: Record<ValidationLevel, number> = { none: 0, "self-tested": 1, "battle-tested": 2 };

const defaultSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(
  url: string,
  init: RequestInit | undefined,
  opts: Required<Pick<SyncOptions, "fetchImpl" | "sleepImpl" | "maxRetries">>,
  log: (line: string) => void,
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await opts.fetchImpl(url, init);
    if (res.status !== 429) return res;
    if (attempt >= opts.maxRetries) {
      throw new SyncError("RATE_LIMITED", `429 超出重试上限（${opts.maxRetries}）：${url}`, 429);
    }
    let delayMs = 1000;
    try {
      const retryAfter = res.headers.get("retry-after");
      if (retryAfter) delayMs = Number(retryAfter) * 1000;
      else {
        const body = (await res.json()) as { error?: { retry_after?: number } };
        if (typeof body.error?.retry_after === "number") delayMs = body.error.retry_after * 1000;
      }
    } catch {
      // 解析不出就用默认 1s
    }
    if (!Number.isFinite(delayMs) || delayMs < 0) delayMs = 1000;
    log(
      JSON.stringify({
        event: "rate_limited",
        url: url.replace(/^https?:\/\/[^/]+/, ""),
        retry_after_ms: delayMs,
      }),
    );
    await opts.sleepImpl(delayMs);
  }
}

export async function syncSubscription(
  sub: { topic: string; cursor?: string; min_validation?: ValidationLevel },
  opts: SyncOptions,
): Promise<SyncReport> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const sleepImpl = opts.sleepImpl ?? defaultSleep;
  const maxRetries = opts.maxRetries ?? 2;
  const pageSize = opts.pageSize ?? 20;
  // 结构化日志缺省出口 = stderr JSON 行（调用方可注入 log 收集；用户命令面再决定是否透出）
  // biome-ignore lint/suspicious/noConsole: 库层缺省 stderr 行日志
  const log = opts.log ?? ((line: string) => console.error(line));
  const attemptOpts = { fetchImpl, sleepImpl, maxRetries };

  const loaded = await loadConfig(opts.paths);
  if (!loaded)
    throw new SyncError(
      "CONFIG_MISSING",
      "config.json5 不存在：先 agentsignal init（订阅段随 config 持久化）",
    );

  const threshold = sub.min_validation ?? "none";
  const thresholdRank = RANK[threshold];
  // 游标解析：显式入参优先，否则取持久化订阅段的断点（config 即订阅状态源，断点续传）
  const persisted = loaded.config.sync.subscriptions.find((s) => s.topic === sub.topic);
  let cursor = sub.cursor ?? persisted?.cursor ?? null;
  let scanned = 0;
  let installed = 0;
  let skipped = 0;
  let done = false;
  const syncedAt = new Date().toISOString();

  while (!done) {
    const url = `${opts.baseUrl}/topics/${encodeURIComponent(sub.topic)}/signals?limit=${pageSize}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
    const res = await fetchWithRetry(url, undefined, attemptOpts, log);
    if (!res.ok) {
      throw new SyncError("HTTP_ERROR", `列表拉取失败 ${res.status}：${url}`, res.status);
    }
    const page = (await res.json()) as ListPage;
    for (const sig of page.signals ?? []) {
      scanned++;
      if (sig.kind !== "solution") {
        skipped++;
        continue;
      }
      const { validation } = parseDigest(sig.digest);
      if (RANK[validation] < thresholdRank) {
        skipped++;
        continue;
      }
      const detailRes = await fetchWithRetry(
        `${opts.baseUrl}/signals/${encodeURIComponent(sig.id)}?include=experience`,
        undefined,
        attemptOpts,
        log,
      );
      if (!detailRes.ok) {
        skipped++;
        log(
          JSON.stringify({ event: "detail_unavailable", sig_id: sig.id, status: detailRes.status }),
        );
        continue;
      }
      const detail = (await detailRes.json()) as ListEnvelope & {
        experience?: { format: string; body: string };
      };
      if (!detail.experience?.body) {
        skipped++;
        continue;
      }
      await installSignal(
        {
          id: detail.id,
          topic: detail.topic ?? sub.topic,
          kind: "solution",
          digest: detail.digest,
          created_at: detail.created_at,
          experience: detail.experience,
        },
        { base_url: opts.baseUrl, synced_at: syncedAt },
        opts.paths,
      );
      installed++;
    }
    // 游标推进：next_cursor 优先；末页（null）退回本页最后一条 sig id（cursor 即 ULID，字典序=时间序）
    const lastId = (page.signals ?? []).at(-1)?.id ?? null;
    cursor = page.next_cursor ?? lastId ?? cursor;
    done = page.next_cursor === null;

    // 游标持久化（断点续传；每页落一次，原子写由 config 加载器保证）
    const entry = loaded.config.sync.subscriptions.find((s) => s.topic === sub.topic);
    if (entry) entry.cursor = cursor ?? undefined;
    else
      loaded.config.sync.subscriptions.push({
        topic: sub.topic,
        cursor: cursor ?? undefined,
        min_validation: threshold,
      });
    await writeConfigAtomic(loaded.config, opts.paths);
    log(
      JSON.stringify({
        event: "page",
        topic: sub.topic,
        page_scanned: page.signals?.length ?? 0,
        installed,
        skipped,
        cursor,
        done,
      }),
    );
  }

  return { topic: sub.topic, scanned, installed, skipped, cursor, done };
}
