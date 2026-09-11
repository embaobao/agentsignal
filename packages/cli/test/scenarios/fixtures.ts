/**
 * S1–S16 场景测试 fixture 库（轨道 C · C1）。
 *
 * 场景壳的可复用构造器：临时根 / 宿主目录 / 外来漂移 / 双宿主隔离。
 * 纪律：不碰真实宿主配置；一切落 os.tmpdir()；AGENTSIGNAL_CONFIG/AGENTSIGNAL_HOME
 * 由各场景文件自行 set/restore（node:test 并发下避免跨文件串扰）。
 * 适配器级 fake（双适配器冲突 S8）待 P1 capability/types.ts 落地后补——见 s08 壳注记。
 */
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

/** 建场景临时根（调用方负责 rm(root, {recursive:true, force:true})） */
export async function makeScenarioRoot(tag: string): Promise<string> {
  return mkdtemp(path.join(tmpdir(), `as-sc-${tag}-`));
}

/** 宿主探测目录（.claude / .cursor / …），detect() 命中用 */
export async function seedHostHome(root: string, hostId: string): Promise<string> {
  const dir = path.join(root, `.${hostId}`);
  await mkdir(dir, { recursive: true });
  return dir;
}

/** 宿主技能目录（L1 落装位；native 适配器 P2 起消费） */
export async function seedHostSkillsDir(root: string, hostId: string): Promise<string> {
  const dir = path.join(root, `.${hostId}`, "skills");
  await mkdir(dir, { recursive: true });
  return dir;
}

/** 外来漂移：别的工具/人手写入的技能目录（S7 对账的 foreign 态输入） */
export async function seedForeignSkill(
  hostSkillsDir: string,
  name: string,
  body = "# 外来技能\n",
): Promise<string> {
  const dir = path.join(hostSkillsDir, name);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "SKILL.md"), body, "utf8");
  return dir;
}

/** 双宿主场景（S4/S16）：一台机器两个独立宿主家目录 */
export async function seedTwoHosts(root: string, a: string, b: string): Promise<[string, string]> {
  return Promise.all([seedHostHome(root, a), seedHostHome(root, b)]) as Promise<[string, string]>;
}

/** 场景收尾：删临时根（幂等） */
export async function cleanupScenarioRoot(root: string | undefined): Promise<void> {
  if (root) await rm(root, { recursive: true, force: true });
}
