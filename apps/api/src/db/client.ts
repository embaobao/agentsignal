/**
 * 数据库客户端 —— 标准 node-postgres（pg Pool），实现极小 `Db` 接口。
 *
 * 【为什么是标准 Postgres】见决议 2026-08-28-standardize-node-postgres：
 * 运行时标准化（Node + pnpm）后，PGlite 的存在动机（绕开 Bun NAPI 问题）消失；
 * 生产用标准 PG（compose 起 postgres:16），业务 SQL 与方言 100% 对等，无迁移成本。
 *
 * 【统一接口】Db 接口刻意做得极小（query / exec / close），
 * 测试夹具（apps/api/test/helpers/testdb.ts）用内嵌真 Postgres 实现同一接口。
 */
import pg from "pg";

export interface QueryResult<T> {
  rows: T[];
  affectedRows?: number;
}

/** 极小数据访问接口：pg Pool 与测试夹具均可实现 */
export interface Db {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<QueryResult<T>>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
  readonly driver: "pg";
}

class PgDb implements Db {
  readonly driver = "pg" as const;
  private readonly pool: pg.Pool;

  constructor(url: string) {
    this.pool = new pg.Pool({ connectionString: url, max: 10 });
  }

  async query<T>(sql: string, params: readonly unknown[] = []): Promise<QueryResult<T>> {
    const res = (await this.pool.query(sql, params as unknown[])) as unknown as QueryResult<T>;
    return { rows: res.rows, affectedRows: res.affectedRows };
  }

  /** 多语句 DDL（迁移脚本）：走 simple query protocol */
  async exec(sql: string): Promise<void> {
    await this.pool.query(sql);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

/** 创建独立 Db 实例（测试夹具用：连临时库，不经进程单例） */
export function createPgDb(url: string): Db {
  return new PgDb(url);
}

let instance: Db | null = null;

/** 进程内单例；缺 DATABASE_URL 直接抛错（fail-fast，不做半套配置启动） */
export function getDb(url = process.env.DATABASE_URL): Db {
  if (!url) {
    throw new Error("DATABASE_URL 未设置：形如 postgres://user:pass@host:5432/agentsignal");
  }
  instance ??= createPgDb(url);
  return instance;
}

/** 测试用：强制重置单例 */
export function resetDb(): void {
  instance = null;
}
