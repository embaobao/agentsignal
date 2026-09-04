/**
 * 双指标口径（裁决 9）：吞吐节省 vs 残留占用，token 估算 bytes/4。
 *
 *   throughput_saved —— 进上下文之前被省掉的（简表代替全文/未注入）
 *   residual         —— 本轮会话末仍占用窗口的部分（实际注入字数）
 *
 * 只做累计计数，不审计不回传；metrics.json 追加写（多宿主并发口径）。
 */
import { readFile, rename, writeFile } from "node:fs/promises";
import { type AgentSignalPaths, resolvePaths } from "./paths.ts";

export interface Metrics {
  throughput_saved: number;
  residual: number;
  updated_at?: string;
}

const EMPTY: Metrics = { throughput_saved: 0, residual: 0 };

export async function readMetrics(paths?: AgentSignalPaths): Promise<Metrics> {
  const p = paths ?? resolvePaths();
  try {
    return { ...EMPTY, ...(JSON.parse(await readFile(p.metricsFile, "utf8")) as Metrics) };
  } catch {
    return { ...EMPTY };
  }
}

/** 追加写：saved/residual 为本次调用产生的 token 估算增量 */
export async function recordMetrics(
  delta: { saved: number; residual: number },
  paths?: AgentSignalPaths,
): Promise<Metrics> {
  const p = paths ?? resolvePaths();
  const cur = await readMetrics(p);
  const next: Metrics = {
    throughput_saved: cur.throughput_saved + Math.max(0, Math.round(delta.saved)),
    residual: cur.residual + Math.max(0, Math.round(delta.residual)),
    updated_at: new Date().toISOString(),
  };
  const tmp = `${p.metricsFile}.tmp-${process.pid}`;
  await writeFile(tmp, JSON.stringify(next, null, 2), "utf8");
  await rename(tmp, p.metricsFile);
  return next;
}
