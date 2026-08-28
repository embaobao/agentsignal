/**
 * 消息存储：data/messages/<seq>.json + 内存索引（启动时扫描重建）
 * 无数据库依赖；seq 即简单游标。损坏文件跳过，不阻塞启动。
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import type { ExperienceMessage } from "./schema.ts";

export type Stored = {
  _meta: { seq: number; id: string; storedAt: string };
  message: ExperienceMessage;
};
type Entry = { seq: number; id: string; messageId: string };

const DATA_DIR = () => process.env.DATA_DIR ?? path.resolve(process.cwd(), "data/messages");

let index: Entry[] = [];
let boot: Promise<void> | null = null;

/** 惰性初始化：首次访问时建目录并重建索引（幂等） */
export async function ensureBoot(): Promise<void> {
  boot ??= (async () => {
    await fs.mkdir(DATA_DIR(), { recursive: true });
    index = [];
    for (const f of (await fs.readdir(DATA_DIR())).filter((f) => f.endsWith(".json")).sort()) {
      try {
        const s = JSON.parse(await fs.readFile(path.join(DATA_DIR(), f), "utf8")) as Stored;
        index.push({ seq: s._meta.seq, id: s._meta.id, messageId: s.message.messageId });
      } catch {
        /* 跳过损坏文件 */
      }
    }
  })();
  return boot;
}

/** 追加一条消息（不可变；seq 单调递增） */
export async function store(message: ExperienceMessage): Promise<Stored> {
  await ensureBoot();
  const seq = index.length === 0 ? 1 : Math.max(...index.map((e) => e.seq)) + 1;
  const id = String(seq).padStart(5, "0");
  const stored: Stored = { _meta: { seq, id, storedAt: new Date().toISOString() }, message };
  await fs.writeFile(path.join(DATA_DIR(), `${id}.json`), JSON.stringify(stored, null, 2));
  index.push({ seq, id, messageId: message.messageId });
  return stored;
}

/** 按 seq id 读取（文件名即 id） */
export function readFileById(id: string): Promise<Stored> {
  return fs
    .readFile(path.join(DATA_DIR(), `${id}.json`), "utf8")
    .then(JSON.parse) as Promise<Stored>;
}

/** 按 id 或 messageId 定位索引条目 */
export function findEntry(key: string): Entry | undefined {
  return index.find((e) => e.id === key || e.messageId === key);
}

/** 最新在前取 N 条（供列表接口逐条读全文） */
export function newestEntries(limit: number): Entry[] {
  return [...index].sort((a, b) => b.seq - a.seq).slice(0, limit);
}
