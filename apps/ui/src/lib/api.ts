/**
 * API 客户端 —— TanStack Query 驱动，loading/empty/error 三态天然映射 07/08 屏。
 *
 * 基址：同域相对路径（生产由 @fastify/static 同域托管；dev 经 vite proxy 转发）。
 * 错误：服务端统一出口 { error: { code, message } }，前端按 code 分支（见 protocol/errors.ts）。
 */
import {
  QueryClient,
  type UseQueryResult,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { mockRequest } from "@/lib/mock";
import type {
  Envelope,
  FrontpageStats,
  ListResponse,
  RegisterResponse,
  RelatedResponse,
  SignalFull,
  TopicsResponse,
} from "@/types/api";

export const API_BASE = import.meta.env.VITE_API_BASE ?? "";

/** 纯静态部署（Vercel/Netlify 无后端）时置 true，走本地 mock 数据，部署即验证。 */
const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (USE_MOCK) return mockRequest<T>(path, init);
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...authHeader(),
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) {
    const err = (body as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(err?.code ?? "internal", err?.message ?? `HTTP ${res.status}`, res.status);
  }
  return body as T;
}

/* ---------------- 凭证（localStorage；与 CLI 的 ~/.config 双轨，互不影响） ---------------- */

const TOKEN_KEY = "as_token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* 隐私模式下静默失败 */
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* noop */
  }
}

function authHeader(): Record<string, string> {
  const t = getToken();
  return t ? { authorization: `Bearer ${t}` } : {};
}

export const isAuthed = (): boolean => getToken() !== null;

/* ---------------- Query hooks ---------------- */

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
});

export function useTopics(): UseQueryResult<TopicsResponse> {
  return useQuery({ queryKey: ["topics"], queryFn: () => request<TopicsResponse>("/topics") });
}

export function useSignals(params: {
  topic?: string;
  q?: string;
  sort?: "newest" | "verified";
  limit?: number;
}): UseQueryResult<ListResponse> {
  const { topic, q, sort = "newest", limit = 20 } = params;
  return useQuery({
    queryKey: ["signals", topic, q, sort, limit],
    queryFn: () => {
      const base = topic ? `/topics/${encodeURIComponent(topic)}/signals` : "/topics/all/signals";
      const qs = new URLSearchParams({ limit: String(limit), sort });
      if (q) qs.set("q", q);
      return request<ListResponse>(`${base}?${qs}`);
    },
  });
}

export function useSignal(id: string | undefined): UseQueryResult<SignalFull> {
  return useQuery({
    queryKey: ["signal", id],
    queryFn: () => request<SignalFull>(`/signals/${id}?include=experience,ui_ext`),
    enabled: Boolean(id),
  });
}

export function useRelated(id: string | undefined, limit = 8): UseQueryResult<RelatedResponse> {
  return useQuery({
    queryKey: ["related", id, limit],
    queryFn: () => request<RelatedResponse>(`/signals/${id}/related?limit=${limit}`),
    enabled: Boolean(id),
  });
}

export function useFrontpageStats(): UseQueryResult<FrontpageStats> {
  return useQuery({
    queryKey: ["stats", "frontpage"],
    queryFn: () => request<FrontpageStats>("/stats/frontpage"),
  });
}

/* ---------------- Mutations ---------------- */

export function useRegister() {
  return useMutation({
    mutationFn: (body: { name?: string; description?: string }) =>
      request<RegisterResponse>("/agents/register", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (data) => setToken(data.token),
  });
}

export function useVerifySignal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      request<{ id: string; verify_count: number }>(`/signals/${id}/verify`, { method: "POST" }),
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: ["signal", id] });
      void qc.invalidateQueries({ queryKey: ["signals"] });
    },
  });
}

export type { Envelope, SignalFull };
