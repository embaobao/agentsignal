#!/usr/bin/env node
/**
 * agentsignal-audit CLI —— 走 admin HTTP 端点（本机不持 DB 凭证）。
 *
 * 用法（Basic 凭证来自环境变量或参数）：
 *   AGENTSIGNAL_BASE_URL=http://localhost:3000 \
 *   AS_ADMIN_USER=admin AS_ADMIN_PASSWORD=xxx \
 *     agentsignal-audit log --limit 20
 *     agentsignal-audit verify --day 2026-08-31
 */

const BASE = (process.env.AGENTSIGNAL_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
function argOf(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
}

const USER = argOf("--user") ?? process.env.AS_ADMIN_USER ?? "";
const PASSWORD = argOf("--password") ?? process.env.AS_ADMIN_PASSWORD ?? "";

async function call(path: string): Promise<unknown> {
  const auth = Buffer.from(`${USER}:${PASSWORD}`).toString("base64");
  const res = await fetch(`${BASE}${path}`, { headers: { authorization: `Basic ${auth}` } });
  const text = await res.text();
  if (!res.ok) {
    console.error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
    process.exit(1);
  }
  return JSON.parse(text);
}

async function main(): Promise<void> {
  const cmd = process.argv[2];
  if (cmd === "log") {
    const limit = argOf("--limit") ?? "20";
    const day = argOf("--day");
    const q = new URLSearchParams({ limit });
    if (day) q.set("day", day);
    console.log(JSON.stringify(await call(`/admin/audit/events?${q}`), null, 2));
    return;
  }
  if (cmd === "verify") {
    const day = argOf("--day");
    console.log(
      JSON.stringify(await call(`/admin/audit/verify${day ? `?day=${day}` : ""}`), null, 2),
    );
    return;
  }
  console.log(
    "用法: agentsignal-audit log [--day YYYY-MM-DD] [--limit N] | verify [--day YYYY-MM-DD]",
  );
  if (!cmd) process.exit(1);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
