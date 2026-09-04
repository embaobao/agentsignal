/**
 * session↔agents 桥接（user-domain-completion Phase 1.2）。
 *
 * better-auth 管认证（user/session/account），业务 agents 表通过
 * account(provider_id='github').account_id = agents.github_id 关联。
 * 本 helper 从请求 cookie 解析出「登录人类 + 其名下全部 agent」，
 * 供 claim / 用户域创建 agent / /me 双层身份使用。
 */

import type { AgentRow, IStore } from "../store/store.ts";
import type { Auth } from "./better-auth.ts";

export interface SessionContext {
  user: { id: string; name: string; email: string };
  /** GitHub 数字 id（account.account_id）；未绑 GitHub 账号时为 null */
  githubId: string | null;
  /** 该 GitHub 身份名下已绑定的全部 agent（1:N，≤ AGENTS_PER_USER_MAX） */
  agents: AgentRow[];
}

/** 从 better-auth session 取登录用户；无 session 返回 null（调用点转 401） */
async function sessionUser(
  req: { headers: Record<string, unknown>; url?: string },
  auth: Auth,
): Promise<{ id: string; name: string; email: string } | null> {
  const headers = new Headers(req.headers as Record<string, string>);
  const url = new URL(req.url ?? "http://localhost/api/auth/get-session");
  const request = new Request(url.href, { method: "GET", headers });
  const res = await auth.api.getSession({ headers: request.headers });
  if (!res?.user) return null;
  return { id: res.user.id, name: res.user.name, email: res.user.email };
}

/** 完整会话上下文：用户 + githubId + 名下 agents；未登录返回 null */
export async function getSessionContext(
  req: { headers: Record<string, unknown>; url?: string },
  auth: Auth,
  store: IStore,
): Promise<SessionContext | null> {
  const user = await sessionUser(req, auth);
  if (!user) return null;
  const githubId = (await store.githubIdForUser(user.id)) ?? null;
  const agents = githubId ? await store.agentsByGithub(githubId) : [];
  return { user, githubId, agents };
}
