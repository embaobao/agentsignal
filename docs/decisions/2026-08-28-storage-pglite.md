# 决议：P3/P5 存储改用 PGlite（WASM PostgreSQL），放弃 SQLite/better-sqlite3

日期：2026-08-28
状态：**已生效（代码已落地）**
背景决议：[lean-stack-adoption](2026-08-28-lean-stack-adoption.md)（原定 Kysely + better-sqlite3）· [container-deployment](2026-08-28-container-deployment.md)

---

## 背景

瘦栈方案 §5.1 与部署决议原定「Kysely + better-sqlite3」，理由是用 SQL 替代手写文件索引、SQLite 零基础设施。实施时做了实机验证，结论推翻该选型。

## 实测证据（2026-08-28）

| 项 | 结果 |
|---|---|
| `better-sqlite3@13.0.3` @ Node 22.22 | ✅ 正常 |
| `better-sqlite3@13.0.3` @ Bun 1.4.0 | ❌ **NAPI FATAL ERROR，进程 panic 崩溃**（`Error::New napi_get_last_error_info`），退出码 134 |
| `@electric-sql/pglite@0.5.8` @ Bun 1.4.0 | ✅ 建表 / jsonb / timestamptz / `$1` 参数 / 文件持久化 / 重开续读 全通过 |
| `@electric-sql/pglite@0.5.8` @ Node 22.22 | ✅ 同上 |

Bun-first 是 `AGENTS.md` 的硬约束（bun run dev / bun run test 为主命令），Bun 下直接崩 = 不可用，故 better-sqlite3 出局。

## 决定

**1. 存储用 PGlite**（内嵌 WASM 版 PostgreSQL），数据落在 `DATA_DIR` 目录。
**2. 不使用 Kysely 抽象层**，直接写 PostgreSQL SQL。理由：PGlite 就是 PG，SQL 与生产 PG **100% 同方言**；再加一层 ORM/查询构造器只增加适配风险（Kysely 需要为 PGlite 单独适配 dialect）。数据访问收敛在极小接口 `Db`（`query` / `exec` / `close`）。
**3. Phase 2 换生产 PG 只改 driver**：实现同一个 `Db` 接口即可，业务 SQL 一行不改。
**4. 移除依赖**：`better-sqlite3`、`kysely`。
**5. 不使用 `bun:sqlite`**：违反 Node-safe 约束（Node 下不存在）。

## 连带收益

- **镜像变小**：WASM 无原生模块，`Dockerfile` 的 deps 阶段砍掉 `python3 make g++` 编译工具链。
- **DDL 直接对齐** `architecture.md` 冻结 schema：jsonb、timestamptz、复合索引全部原生可用，不需要 SQLite 的 codec 兼容层。
- **方言零差异**：不再有 SQLite/PG 的类型与函数分歧（原方案需要 `db/codec.ts` 收敛）。

## 影响

- `apps/api/src/db/client.ts`：Db 接口 + PgliteDb 实现（进程内单例，测试可注入临时目录）
- `apps/api/src/db/migrations.ts`：幂等 SQL，`schema_meta` 记录版本（`/readyz` 上报）
- `apps/api/src/store/store.ts`：`IStore` 接口 + `PgStore` 实现（原 `store.ts` 文件存储已替换）
- `scripts/backup.sh`：PGlite 为目录型数据，备份 = 停 API → tar 打包 → 起 API（**禁止 cp/tar 活库**）
- 部署文档 §3/§6、瘦栈方案 §5.1 同步更新

## 不做

- 不做 PG 连接池 / 读写分离 / 分库分表（PGlite 是单进程内嵌，能力边界明确）。
- 不引 ORM。
