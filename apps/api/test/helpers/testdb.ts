/**
 * 测试库夹具 —— 决议 2026-08-28-standardize-node-postgres：
 * - 设了 TEST_DATABASE_URL（真 Postgres）：建临时库，跑完 DROP，测试产物零残留；
 * - 未设：回退内嵌真 Postgres（PGlite WASM，仅 devDependency，不出现在运行时/部署面）。
 * 两者实现同一 `Db` 接口，业务 SQL 与生产完全同方言。
 */
import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import { createPgDb, type Db } from "../../src/db/client.ts";

export interface TestDb {
  db: Db;
  dispose(): Promise<void>;
}

/** adminUrl 形如 postgres://user:pass@host:5432/postgres，临时库建在同一实例上 */
async function createRealPgDb(adminUrl: string): Promise<TestDb> {
  const name = `agentsignal_test_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const admin = new pg.Pool({ connectionString: adminUrl });
  await admin.query(`create database "${name}"`);
  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  const db = createPgDb(url.toString());
  return {
    db,
    dispose: async () => {
      await db.close();
      await admin.query(`drop database "${name}" with (force)`);
      await admin.end();
    },
  };
}

class PgliteFixture implements Db {
  readonly driver = "pg" as const;
  private readonly inner: PGlite;

  constructor(dir: string) {
    this.inner = new PGlite(dir);
  }

  async query<T>(sql: string, params: readonly unknown[] = []): Promise<{ rows: T[] }> {
    const res = await this.inner.query<T>(sql, params as unknown[]);
    return { rows: res.rows };
  }

  async exec(sql: string): Promise<void> {
    await this.inner.exec(sql);
  }

  async close(): Promise<void> {
    await this.inner.close();
  }
}

async function createEmbeddedPgDb(): Promise<TestDb> {
  const dir = mkdtempSync(path.join(tmpdir(), "agentsignal-testdb-"));
  const db: Db = new PgliteFixture(dir);
  return { db, dispose: () => db.close() };
}

/** 真 PG 优先（TEST_DATABASE_URL），否则内嵌夹具；测试结束必须 dispose() */
export function createTestDb(): Promise<TestDb> {
  return process.env.TEST_DATABASE_URL
    ? createRealPgDb(process.env.TEST_DATABASE_URL)
    : createEmbeddedPgDb();
}
