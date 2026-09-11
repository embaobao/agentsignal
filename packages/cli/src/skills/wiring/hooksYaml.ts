/**
 * Hermes hook 双写（host-matrix-alignment 1.4）。
 *
 * Hermes 只执行 shell-hooks-allowlist.json 内的 hook——只写 config.yaml 不生效，
 * 所以 `config.yaml` 的 `hooks.<event>[]` **和** allowlist 必须同时写（同 {event,command} 去重）。
 * config.yaml 为行级最小操作：只碰 agentsignal 自己的 hooks 条目（规范 E-10），
 * 用户已有内容逐字保留；解析异常的兜底（跳过 hooks 只发 skill）归接线层 1.7。
 * json 写盘 tmp+rename 原子写。
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

interface Allowlist {
  hooks: { event: string; command: string }[];
}

async function readAllowlist(file: string): Promise<Allowlist> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as Allowlist;
  } catch {
    return { hooks: [] };
  }
}

async function writeAllowlist(file: string, value: Allowlist): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tmp, file);
}

/** config.yaml 注入 `hooks.<event>: [- command: "<cmd>"]`（行级最小操作，按 (event, command) 幂等） */
function injectYamlHook(text: string, event: string, command: string): string {
  const cmdLine = `    - command: "${command}"`;
  const lines = text.split("\n");
  const hooksIdx = lines.findIndex((l) => l.trimEnd() === "hooks:");
  if (hooksIdx === -1) {
    // 无 hooks 段：文件尾追加（保底一个空行分隔）
    const prefix = text.length ? `${text.replace(/\n+$/, "")}\n\n` : "";
    return `${prefix}hooks:\n  ${event}:\n${cmdLine}\n`;
  }
  // 有 hooks 段：找该 event 键（两空格缩进）
  let eventIdx = -1;
  for (let i = hooksIdx + 1; i < lines.length; i++) {
    const l = lines[i] ?? "";
    if (l.length > 0 && !l.startsWith(" ") && l.trimEnd() !== "") break; // 离开 hooks 段
    if (l.trimEnd() === `  ${event}:`) {
      eventIdx = i;
      break;
    }
  }
  if (eventIdx === -1) {
    lines.splice(hooksIdx + 1, 0, `  ${event}:`, cmdLine);
    return lines.join("\n");
  }
  // event 块存在：块内已含该 command → 幂等跳过（同 command 可注册到不同 event）
  let insertAt = eventIdx + 1;
  while (insertAt < lines.length && (lines[insertAt]?.startsWith("    ") ?? false)) {
    if (lines[insertAt]?.includes(`command: "${command}"`)) return text;
    insertAt++;
  }
  lines.splice(insertAt, 0, cmdLine);
  return lines.join("\n");
}

/** config.yaml 摘除该 event 块（或块内该 command 行），用户其余内容原样 */
function removeYamlHook(text: string, event: string, command: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let skippingBlock = false;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i] ?? "";
    if (l.trimEnd() === `  ${event}:`) {
      // 向看一块：是否包含目标 command（含则整块删——块只服务该 command 的最小现实）
      let j = i + 1;
      let hasCmd = false;
      while (j < lines.length && (lines[j]?.startsWith("    ") ?? false)) {
        if (lines[j]?.includes(`command: "${command}"`)) hasCmd = true;
        j++;
      }
      if (hasCmd) {
        i = j - 1; // 跳过整块
        skippingBlock = true;
        continue;
      }
    }
    out.push(l);
  }
  void skippingBlock;
  return out.join("\n").replace(/\n{3,}/g, "\n\n");
}

/** 双写注入：config.yaml hooks.<event>[] + allowlist（同 {event,command} 去重） */
export async function injectHermesHook(
  hooksYamlPath: string,
  allowlistPath: string,
  event: string,
  command: string,
): Promise<void> {
  let text = "";
  try {
    text = await readFile(hooksYamlPath, "utf8");
  } catch {
    text = "";
  }
  const next = injectYamlHook(text, event, command);
  await mkdir(path.dirname(hooksYamlPath), { recursive: true });
  const tmp = `${hooksYamlPath}.tmp-${process.pid}`;
  await writeFile(tmp, next, "utf8");
  await rename(tmp, hooksYamlPath);

  const allow = await readAllowlist(allowlistPath);
  if (!allow.hooks.some((h) => h.event === event && h.command === command)) {
    allow.hooks.push({ event, command });
    await writeAllowlist(allowlistPath, allow);
  }
}

/** 双写摘除：两文件各删该条；文件不存在为无操作 */
export async function removeHermesHook(
  hooksYamlPath: string,
  allowlistPath: string,
  event: string,
  command: string,
): Promise<void> {
  try {
    const text = await readFile(hooksYamlPath, "utf8");
    const next = removeYamlHook(text, event, command);
    if (next !== text) {
      const tmp = `${hooksYamlPath}.tmp-${process.pid}`;
      await writeFile(tmp, next, "utf8");
      await rename(tmp, hooksYamlPath);
    }
  } catch {
    /* 无文件为无操作 */
  }
  const allow = await readAllowlist(allowlistPath);
  const kept = allow.hooks.filter((h) => !(h.event === event && h.command === command));
  if (kept.length !== allow.hooks.length) {
    await writeAllowlist(allowlistPath, { hooks: kept });
  }
}
