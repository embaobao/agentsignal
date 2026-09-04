/**
 * CLI init —— 一条命令全链路（skill-engine 裁决 3/8/12）。
 *
 *   agentsignal init                 首次无配置 → 本地 web 向导问答 → 接线宿主 → 完成报告
 *   agentsignal init --yes           非 TTY/CI 缺省直通（等价于向导 FooterBar 直通）
 *   agentsignal init --agent cursor  覆盖探测结果，只接指定宿主（可重复/逗号分隔）
 *   agentsignal init --no-open       不起浏览器，只打印 URL
 *
 * 已完成初始化的机器再跑一次 = 拉起管理/状态视图（与 MCP open_setup 同入口同 UI）。
 */

import { ensureLayout, loadConfig, writeConfigAtomic } from "./skills/config.ts";
import { bootstrapWithDefaults } from "./skills/engine.ts";
import { resolvePaths } from "./skills/paths.ts";
import { writeSamples } from "./skills/samples.ts";
import { detectHosts, type HostId, hostById } from "./skills/wiring/hosts.ts";
import { wireMcp } from "./skills/wiring/snippets.ts";
import { startWizard } from "./skills/wizard/server.ts";

export interface InitOptions {
  yes?: boolean;
  agents?: string[];
  open?: boolean;
}

function parseAgents(args: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--agent" && args[i + 1]) {
      out.push(
        ...String(args[i + 1])
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      );
      i++;
    }
  }
  return out;
}

const isTTY = (): boolean => Boolean(process.stdin.isTTY && process.stdout.isTTY);

export async function initCmd(args: string[] = []): Promise<void> {
  const paths = resolvePaths();
  const yes = args.includes("--yes") || !isTTY();
  const agentOverride = parseAgents(args);
  const open = !args.includes("--no-open");

  await ensureLayout(paths);
  const samples = await writeSamples(paths);
  if (samples.length > 0) {
    console.log(`✓ 已内置 ${samples.length} 条本地经验（${samples.join(" · ")}）`);
  }

  const existing = await loadConfig(paths);

  // 已有配置：拉管理/状态视图（与 MCP open_setup 共用同一 UI）
  if (existing && !yes) {
    const w = await startWizard({ open });
    console.log(`▶ 管理界面：${w.url}`);
    await w.wait;
    await w.close().catch(() => undefined);
    return;
  }

  // CI / --yes：缺省直通，不拉界面
  if (yes) {
    if (!existing) {
      const { configFile } = await bootstrapWithDefaults();
      console.log(`✓ 默认配置已写入 ${configFile}`);
    }
  } else {
    const w = await startWizard({ open });
    console.log(`▶ 打开 ${w.url} 完成初始化（页面提交后自动继续）`);
    const outcome = await w.wait;
    if (outcome.action === "closed") {
      console.log(
        "未提交配置，未写入任何内容。可重跑 agentsignal init，或用 agentsignal init --yes 走缺省直通。",
      );
      await w.close().catch(() => undefined);
      return;
    }
    await w.close().catch(() => undefined);
    if (outcome.action === "submit" && outcome.written?.length) {
      for (const item of outcome.written) console.log(`✓ ${item.host} · ${item.path}`);
      console.log("\n下一步：回到你的 IDE，直接向模型提问试试。");
      return;
    }
  }

  // 接线：--agent 覆盖 > config.hosts > 探测结果（config.hosts 为空数组时回退探测）
  const config = (await loadConfig(paths))?.config;
  const configured = (config?.hosts ?? []).filter((h) => h.wired).map((h) => h.host);
  const targets: HostId[] =
    agentOverride.length > 0
      ? (agentOverride as HostId[])
      : configured.length > 0
        ? configured
        : detectHosts()
            .filter((h) => h.detected)
            .map((h) => h.id);

  if (targets.length === 0) {
    console.log("未探测到已知宿主，也未指定 --agent；已只写入本地配置。");
    console.log("后续可在 IDE 中手动添加 MCP 服务：命令 agentsignal，参数 mcp。");
    return;
  }

  const wired: { host: string; path: string }[] = [];
  const failed: { host: string; reason: string }[] = [];
  for (const id of targets) {
    try {
      const r = await wireMcp(hostById(id));
      wired.push({ host: r.name, path: r.path });
    } catch (err) {
      failed.push({ host: id, reason: err instanceof Error ? err.message : String(err) });
    }
  }
  if (config) {
    config.hosts = targets.map((h) => ({ host: h, wired: true }));
    await writeConfigAtomic(config, paths);
  }

  console.log("");
  for (const w of wired) console.log(`✓ ${w.host} · ${w.path}`);
  for (const f of failed) console.log(`✕ ${f.host}：${f.reason}`);
  console.log(`\n✓ 初始化完成：${wired.length} 个宿主已接线。`);
  console.log("下一步：回到你的 IDE，直接向模型提问试试。");
}
