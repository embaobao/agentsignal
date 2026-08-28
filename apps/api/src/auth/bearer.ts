/**
 * Bearer 鉴权 —— 五动作四通道共用同一 `Authorization: Bearer ags_…`（身份 spec §6）。
 * 从 routes/agents.ts 抽出：鉴权是横切关注点，不隶属身份路由（backend-architecture §二）。
 */
import { AppError } from "@agentsignal/protocol";
import type { IStore } from "../store/store.ts";

/** Bearer 解析：返回 ags_ 明文或 undefined（不抛异常，交由调用点决定 401；大小写宽容） */
export function bearerOf(req: {
  headers: { authorization?: string | string[] };
}): string | undefined {
  const h = req.headers.authorization ?? "";
  const raw = Array.isArray(h) ? (h[0] ?? "") : h;
  const m = /^Bearer\s+(ags_\S+)$/i.exec(raw.trim());
  return m?.[1];
}

/** 需鉴权的守卫：抛 AppError(401)，由统一 errorHandler 出口 */
export async function requireAgent(
  req: { headers: { authorization?: string | string[] } },
  store: IStore,
) {
  const token = bearerOf(req);
  if (!token) throw new AppError("unauthorized", "missing Bearer token");
  const agent = await store.agentForToken(token);
  if (!agent) throw new AppError("unauthorized", "invalid or expired token");
  return agent;
}
