/**
 * 统一错误码 —— 全栈共用（服务端 setErrorHandler 出口 + 前端按 code 分支）。
 *
 * 纪律：新增错误码先改这里，再进 docs/protocols/api.md 的错误模型小节。
 * 响应体恒为 { error: { code, message, details? } }。
 */
import { z } from "zod";

export const errorCodes = [
  "bad_request",
  "unauthorized",
  "forbidden",
  "not_found",
  "conflict",
  "payload_too_large",
  "rate_limited",
  "unsupported_media_type",
  "internal",
] as const;

export type ErrorCode = (typeof errorCodes)[number];

export const DEFAULT_STATUS: Record<ErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  payload_too_large: 413,
  rate_limited: 429,
  unsupported_media_type: 415,
  internal: 500,
};

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.enum(errorCodes),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

/** 构造错误响应体（保持形状稳定，便于前端 switch(code)） */
export function apiError(code: ErrorCode, message: string, details?: unknown): ApiError {
  return { error: details === undefined ? { code, message } : { code, message, details } };
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = DEFAULT_STATUS[code];
    this.details = details;
  }
}
