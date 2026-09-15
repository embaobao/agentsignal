/**
 * 审计包装 —— 用户写路径（registerAgent / putSignal / updateSignal）落账本+全行快照，不改 PgStore 内部。
 * Object.create 原型委托：未包装方法沿用原实现；admin 策展路径的审计在路由层（actor=admin:*）。
 * 快照接线（audit-restore 1B-2）：putSignal 后存 rev1，updateSignal 前存 pre-update 快照——还原修订史来源。
 */
import { appendEvent, snapshotBefore } from "@agentssignal/audit";
import type { Db } from "../db/client.ts";
import type { IStore, SignalRow } from "./store.ts";

export function withAudit(store: IStore, db: Db): IStore {
  const audited = Object.create(store) as IStore;

  audited.registerAgent = async (name: string, description: string, rawToken: string) => {
    const { agent } = await store.registerAgent(name, description, rawToken);
    await appendEvent(db, {
      actor: agent.id,
      entityType: "agent",
      entityId: agent.id,
      action: "create",
      after: { number: agent.number, name: agent.name, id: agent.id },
    });
    return { agent };
  };

  audited.putSignal = async (input) => {
    const row: SignalRow = await store.putSignal(input);
    await snapshotBefore(db, "signal", row.id, row); // 全行快照（rev1，还原起点）
    await appendEvent(db, {
      actor: input.sender_agent_id,
      entityType: "signal",
      entityId: row.id,
      action: "create",
      after: {
        kind: row.kind,
        digest: row.digest,
        tokens_est: row.tokens_est,
        topic: row.topic,
      },
    });
    return row;
  };

  audited.updateSignal = async (id, agentId, patch) => {
    const before = await store.findSignal(id, true);
    if (before) await snapshotBefore(db, "signal", id, before); // pre-update 快照（还原目标来源）
    const row = await store.updateSignal(id, agentId, patch);
    if (row && before) {
      await appendEvent(db, {
        actor: agentId,
        entityType: "signal",
        entityId: id,
        action: "update",
        before: { digest: before.digest, experience: before.experience },
        after: { digest: row.digest, experience: row.experience },
      });
    }
    return row;
  };

  return audited;
}
