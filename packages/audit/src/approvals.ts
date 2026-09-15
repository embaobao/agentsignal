/**
 * 双签审批存储（audit-restore 1B-2 · 2.5 · 设计：approvals.json 登记执行人 sha）。
 *
 * 每个「还原操作」以 operationSha（实体+目标选择的 sha256）为键；不同管理员各登记一条
 * 审批（同管理员去重）；登记数 ≥ 配额（默认 2，单管理员环境豁免为 1）方可执行 apply。
 * approvals.json 文件持久化（tmp+rename 原子写）。
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { sha256 } from "./ledger.ts";

export interface ApprovalEntry {
  admin: string;
  sha: string;
  at: string;
}

export class ApprovalsStore {
  private readonly file: string;
  constructor(file: string) {
    this.file = file;
  }

  private load(): Record<string, ApprovalEntry[]> {
    try {
      return JSON.parse(readFileSync(this.file, "utf8")) as Record<string, ApprovalEntry[]>;
    } catch {
      return {};
    }
  }

  private save(data: Record<string, ApprovalEntry[]>): void {
    mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp-${process.pid}`;
    writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
    renameSync(tmp, this.file);
  }

  /** 登记 admin 审批（同管理员去重）；返回去重后的审批人数 */
  register(opSha: string, admin: string, at: string): { distinct: number } {
    const data = this.load();
    const list = data[opSha] ?? [];
    if (!list.some((e) => e.admin === admin)) {
      list.push({ admin, sha: sha256(`${opSha}|${admin}|${at}`), at });
    }
    data[opSha] = list;
    this.save(data);
    return { distinct: list.length };
  }

  distinctAdmins(opSha: string): number {
    return (this.load()[opSha] ?? []).length;
  }

  isSatisfied(opSha: string, min: number): boolean {
    return this.distinctAdmins(opSha) >= min;
  }
}

/** 操作指纹：绑定实体与目标选择，审批不可挪用 */
export function operationSha(...parts: (string | number | undefined)[]): string {
  return sha256(parts.map((p) => String(p ?? "")).join("|"));
}
