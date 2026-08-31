/**
 * 审计包装 —— 用户写路径（registerAgent / putSignal）落账本，不改 PgStore 内部。
 * Object.create 原型委托：未包装方法沿用原实现；admin 策展路径的审计在路由层（actor=admin:*）。
 */
import { appendEvent } from "@agentsignal/audit";
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

  return audited;
}
