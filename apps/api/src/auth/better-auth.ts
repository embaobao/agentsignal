/**
 * better-auth 实例 —— 认证层基础设施（与业务 agents 表解耦）。
 *
 * better-auth 自建 user/session/account 表管理认证；
 * 业务层 agents 表通过 user_id 一对一映射（bridge 列）。
 * OAuth providers 在此处配置（GitHub 等），业务代码只调 auth.handler。
 */
import { betterAuth } from "better-auth";
import pg from "pg";
import type { Env } from "../env.ts";

let pool: pg.Pool | null = null;

function getPool(databaseUrl: string): pg.Pool {
  pool ??= new pg.Pool({ connectionString: databaseUrl, max: 5 });
  return pool;
}

export function createAuth(env: Env) {
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL 必填（better-auth 需要）");
  const db = getPool(env.DATABASE_URL);

  return betterAuth({
    database: db,
    emailAndPassword: { enabled: false }, // 无密码，仅 OAuth
    socialProviders: {
      github: env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
        ? { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET }
        : undefined,
    },
    advanced: { database: { generateId: () => crypto.randomUUID() } },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 }, // 7 天
  });
}

export type Auth = ReturnType<typeof createAuth>;
