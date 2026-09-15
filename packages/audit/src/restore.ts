/**
 * 还原基建（audit-restore 1B-2 · 2.1/2.3）。
 *
 * 修订史 = snapshots 全行快照（写路径在 audit-wrap 接线：create 后 / update 前）；
 * rev = 该实体快照按 (created_at, id) 升序的 1 基序号；to_event_id = 取该事件时刻
 * 之前的最近快照。unifiedDiff 为纯函数（手写 LCS，零新依赖）。
 */
import type { SqlDb } from "./ledger.ts";

export interface SnapshotRevision {
  rev: number;
  id: string;
  created_at: string;
  data: Record<string, unknown>;
}

export async function listRevisions(
  db: SqlDb,
  entityType: string,
  entityId: string,
): Promise<SnapshotRevision[]> {
  const r = await db.query<{ id: string; created_at: string; data: string }>(
    `select id, created_at::text as created_at, data from snapshots
      where entity_type = $1 and entity_id = $2
      order by created_at asc, id asc`,
    [entityType, entityId],
  );
  return r.rows.map((row, i) => ({
    rev: i + 1,
    id: row.id,
    created_at: row.created_at,
    // 驱动差异防御：text 列可能返回字符串，也可能被驱动反序列化为对象
    data: (typeof row.data === "string" ? JSON.parse(row.data) : row.data) as Record<
      string,
      unknown
    >,
  }));
}

export interface RestoreTargetSelector {
  to_rev?: number;
  to_event_id?: string;
}

/** 解析还原目标：to_rev 直取；to_event_id = 该事件时刻之前的最近快照 */
export async function resolveTarget(
  db: SqlDb,
  entityType: string,
  entityId: string,
  sel: RestoreTargetSelector,
): Promise<SnapshotRevision | null> {
  const revs = await listRevisions(db, entityType, entityId);
  if (revs.length === 0) return null;
  if (sel.to_rev != null) {
    return revs.find((r) => r.rev === sel.to_rev) ?? null;
  }
  if (sel.to_event_id) {
    const ev = await db.query<{ created_at: string }>(
      `select created_at::text as created_at from audit_events where event_id = $1`,
      [sel.to_event_id],
    );
    if (!ev.rows[0]) return null;
    const at = ev.rows[0].created_at;
    let hit: SnapshotRevision | null = null;
    for (const r of revs) {
      if (r.created_at <= at) hit = r;
      else break;
    }
    return hit;
  }
  return revs[revs.length - 1] ?? null;
}

/* ── unified diff（手写 LCS，零依赖）────────────────────────────── */

function lcsTable(a: string[], b: string[]): number[][] {
  const t: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      t[i]![j] = a[i] === b[j] ? t[i + 1]![j + 1]! + 1 : Math.max(t[i + 1]![j]!, t[i]![j + 1]!);
    }
  }
  return t;
}

/** unified diff（@@ 头 + -/+ 行），纯函数；diff 行数 = 删除行 + 新增行 */
export function unifiedDiff(
  aText: string,
  bText: string,
  aLabel = "current",
  bLabel = "target",
): {
  diff: string;
  diff_lines: number;
} {
  const a = aText.split("\n");
  const b = bText.split("\n");
  const t = lcsTable(a, b);
  const out: string[] = [`--- ${aLabel}`, `+++ ${bLabel}`, "@@ -1 +1 @@"];
  let del = 0;
  let add = 0;
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      out.push(`  ${a[i]}`);
      i++;
      j++;
    } else if (j < b.length && (i >= a.length || t[i]![j + 1]! >= t[i + 1]![j]!)) {
      out.push(`+${b[j]}`);
      add++;
      j++;
    } else {
      out.push(`-${a[i]}`);
      del++;
      i++;
    }
  }
  out.push(`@@ 统计：-${del} +${add}`);
  return { diff: out.join("\n"), diff_lines: del + add };
}
