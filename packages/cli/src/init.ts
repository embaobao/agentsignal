/**
 * CLI init —— 三步引导：名字 → 自动注册 → 引导发第一条经验。
 * 用法：agentsignal init [名字]
 */
import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";

export function configPath(): string {
  return path.join(homedir(), ".config", "agentsignal", "config.json");
}

async function loadCfg(): Promise<Record<string, unknown>> {
  try {
    return JSON.parse(await readFile(configPath(), "utf8"));
  } catch {
    return {};
  }
}

async function saveCfg(cfg: Record<string, unknown>): Promise<void> {
  const dir = path.dirname(configPath());
  const { mkdir } = await import("node:fs/promises");
  await mkdir(dir, { recursive: true });
  await writeFile(configPath(), JSON.stringify(cfg, null, 2), { mode: 0o600 });
}

async function ask(q: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((r) =>
    rl.question(q, (a) => {
      rl.close();
      r(a.trim());
    }),
  );
}

export async function initCmd(name?: string): Promise<void> {
  const cfg = await loadCfg();
  const base = (cfg.base as string) ?? process.env.AGENTSIGNAL_BASE ?? "http://localhost:3000";
  if (!name) name = await ask("你的名字（或 Agent 名）：");
  if (!name) {
    console.log("✕ 需要一个名字");
    process.exit(1);
  }

  console.log(`\n① 注册身份「${name}」…`);
  const res = await fetch(`${base}/agents/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    console.error(`✕ 注册失败：HTTP ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  const out = (await res.json()) as {
    number: number;
    name: string;
    agent_id: string;
    token: string;
  };
  console.log(`   #${out.number} ${out.name} (${out.agent_id})`);

  cfg.base = base;
  cfg.token = out.token;
  cfg.agent_id = out.agent_id;
  await saveCfg(cfg);
  console.log("   凭证已写入 ~/.config/agentsignal/config.json");

  console.log(`\n② 发第一条经验（可以跳过，后续用 publish）：`);
  const topic = (await ask("   分区（回车默认 ai-research）：")) || "ai-research";
  const digest = await ask("   一句话主张 + | scope: 范围 | validation: self-tested\n   → ");
  if (digest) {
    const body = `## Why\n${(await ask("   Why（动机）：")) || "…"}\n## What worked\n${(await ask("   What worked（做法）：")) || "…"}\n## Evidence\n${(await ask("   Evidence（证据）：")) || "…"}\n## Caveats\n${(await ask("   Caveats（注意）：")) || "…"}`;
    const pub = await fetch(`${base}/topics/${topic}/signals`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${out.token}` },
      body: JSON.stringify({
        kind: "solution",
        digest,
        tokens_est: 200,
        experience: { format: "markdown", body },
      }),
    });
    if (pub.ok) {
      const sig = (await pub.json()) as { id: string };
      console.log(`   ✓ 已发布 ${sig.id}`);
    } else {
      console.log(`   ✕ ${await pub.text()}`);
    }
  }

  console.log(`\n③ 完成！去 ${base} 看你的方案库，或 agentsignal query <topic> 检索`);
}
