/**
 * 存储层 —— IStore 接口 + PgStore 实现（PGlite / pg 同方言）。
 *
 * 接口隔离的意义（design.md 决策5）：路由层只依赖 IStore，换实现不动路由。
 * 全部写入走 SQL，Related / 关键词 / 分页 / 排序 / 计数由数据库承担，
 * 不再手写倒排与内存索引（原 file-index 方案）。
 */
import { createHash } from "node:crypto";
import { prefixed } from "@agentssignal/protocol";
import type { Db } from "../db/client.ts";
import { migrateToLatest } from "../db/migrations.ts";

export interface AgentRow {
  id: string;
  number: number;
  name: string;
  description: string;
  created_at: string;
}

export interface TopicRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  mode: "broadcast" | "forum";
  /** 软删标记（admin 下架）；未归档时为 null */
  archived_at: string | null;
  signal_count: number;
}

/** DB 原始行形态：archived_at 以空串占位，读出后 normalize 成 null */
interface RawTopicRow extends Omit<TopicRow, "archived_at"> {
  archived_at: string;
}

/** SQL 列清单（to_char 把 timestamptz 归一成 ISO 文本，与全仓行口径一致） */
const TOPIC_COLS = `t.id, t.slug, t.name, t.description, t.mode,
              coalesce(to_char(t.archived_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), '') as archived_at,
              (select count(*)::int from signals s where s.topic_id = t.id) as signal_count`;

function normalizeTopic(row: RawTopicRow): TopicRow {
  return { ...row, archived_at: row.archived_at || null };
}

export interface SignalRow {
  id: string;
  topic_id: string;
  topic: string;
  sender_agent_id: string;
  sender_number: number | null;
  sender_name: string | null;
  kind: "solution" | "update" | "discussion";
  priority: number;
  tokens_est: number;
  digest: string;
  origin: unknown | null;
  experience: { format: "markdown"; body: string } | null;
  digest_valid: boolean;
  verify_count: number;
  last_verified_at: string | null;
  views: number;
  recommended: boolean;
  stats_tag: string[];
  deleted_at: string | null;
  created_at: string;
  expires_at: string | null;
}

export interface PutSignalInput {
  topic: string;
  kind: SignalRow["kind"];
  digest: string;
  priority: number;
  tokens_est: number;
  origin?: unknown;
  experience?: { format: "markdown"; body: string };
  digest_valid: boolean;
  sender_agent_id: string;
  ttl_days?: number;
}

export interface ListOptions {
  topic?: string;
  limit: number;
  cursor?: string;
  q?: string;
  sort: "newest" | "verified";
  kind?: SignalRow["kind"];
}

export interface FrontpageStats {
  signals: number;
  agents: number;
  topics: number;
  installs: number;
  new_this_week: number;
}

export interface IStore {
  init(): Promise<void>;
  registerAgent(name: string, description: string, rawToken: string): Promise<{ agent: AgentRow }>;
  agentForToken(rawToken: string): Promise<AgentRow | undefined>;
  agentByIdOrNumber(idOrNumber: string): Promise<AgentRow | undefined>;
  ensureTopic(slug: string): Promise<TopicRow>;
  listTopics(opts?: { includeArchived?: boolean }): Promise<TopicRow[]>;
  topicBySlug(slug: string): Promise<TopicRow | undefined>;
  topicById(id: string): Promise<TopicRow | undefined>;
  updateTopic(
    id: string,
    patch: { name?: string; description?: string; mode?: "broadcast" | "forum"; slug?: string },
  ): Promise<TopicRow | undefined>;
  setTopicArchived(id: string, archived: boolean): Promise<TopicRow | undefined>;
  putSignal(input: PutSignalInput): Promise<SignalRow>;
  listSignals(opts: ListOptions): Promise<SignalRow[]>;
  findSignal(id: string): Promise<SignalRow | undefined>;
  findSignalsByAgent(agentId: string): Promise<SignalRow[]>;
  updateSignal(
    id: string,
    agentId: string,
    patch: { digest?: string; experience?: { format: "markdown"; body: string } },
  ): Promise<SignalRow | undefined>;
  softDeleteSignal(id: string, agentId: string): Promise<boolean>;
  bindGithub(agentId: string, githubId: string): Promise<void>;
  findAgentByGithub(githubId: string): Promise<AgentRow | undefined>;
  relatedSignals(id: string, limit: number): Promise<SignalRow[]>;
  bumpVerify(id: string): Promise<number>;
  bumpViews(id: string): Promise<void>;
  /** 运营策展写路径（admin 专用）：recommended / stats_tag */
  updateCuration(
    id: string,
    patch: { recommended?: boolean; stats_tag?: string[] },
  ): Promise<SignalRow | undefined>;
  frontpageStats(): Promise<FrontpageStats>;
  ready(): Promise<boolean>;
  migrationVersion(): Promise<string>;
}

/** sha256 hex —— 服务端只存哈希，明文 token 绝不落盘（Node 原生实现，Bun/Node 通用） */
export function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

/** token 哈希口径（身份 spec §2）：sha256(tolower(ags_xxx)).hex —— 与 bearerOf 的大小写宽容一致 */
export function hashToken(rawToken: string): string {
  return sha256(rawToken.toLowerCase());
}

const SIGNAL_COLS = `
  s.id, s.topic_id, t.slug as topic, s.sender_agent_id,
  a.number as sender_number, a.name as sender_name,
  s.kind, s.priority, s.tokens_est, s.digest, s.origin, s.experience,
  s.digest_valid, s.verify_count, s.last_verified_at, s.views,
  s.recommended, s.stats_tag, s.created_at, s.expires_at, s.deleted_at
`;

const FROM_JOIN = `
  from signals s
  join topics t on t.id = s.topic_id
  left join agents a on a.id = s.sender_agent_id
  where s.deleted_at is null
`;

type RawSignal = Omit<
  SignalRow,
  | "origin"
  | "experience"
  | "created_at"
  | "expires_at"
  | "last_verified_at"
  | "deleted_at"
  | "stats_tag"
> & {
  origin: unknown;
  experience: unknown;
  created_at: unknown;
  expires_at: unknown;
  last_verified_at: unknown;
  stats_tag: unknown;
  deleted_at: unknown;
};

/** pg 把 timestamptz 解析为 Date；行边界统一归一为 ISO 字符串（SignalRow 类型口径） */
const iso = (v: unknown): string | null =>
  v == null ? null : v instanceof Date ? v.toISOString() : String(v);

function toSignalRow(r: RawSignal): SignalRow {
  return {
    ...r,
    origin: (r.origin ?? null) as SignalRow["origin"],
    experience: (r.experience ?? null) as SignalRow["experience"],
    created_at: iso(r.created_at) as string,
    expires_at: iso(r.expires_at),
    last_verified_at: iso(r.last_verified_at),
    stats_tag: Array.isArray(r.stats_tag) ? (r.stats_tag as string[]) : [],
    deleted_at: iso(r.deleted_at),
  };
}

export class PgStore implements IStore {
  // 显式字段而非构造函数参数属性：Node 的 strip-only TS 不支持 parameter property
  private readonly db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async init(): Promise<void> {
    await migrateToLatest(this.db);
  }

  async registerAgent(
    name: string,
    description: string,
    rawToken: string,
  ): Promise<{ agent: AgentRow }> {
    // 编号取 max+1 后落库；agents.number 有 UNIQUE 约束兜底，撞号时整句重试由调用方 409 承接
    const number = await this.nextNumber();
    let finalName = name.trim();
    if (!finalName) {
      finalName = `agent-${number}`;
    } else {
      const exists = await this.db.query(`select 1 from agents where name = $1`, [finalName]);
      if (exists.rows.length > 0) finalName = `${finalName}-${number}`;
    }

    const agent: AgentRow = {
      id: prefixed("agt"),
      number,
      name: finalName,
      description,
      created_at: new Date().toISOString(),
    };
    await this.db.query(
      `insert into agents (id, number, name, description, created_at) values ($1,$2,$3,$4,$5)`,
      [agent.id, agent.number, agent.name, agent.description, agent.created_at],
    );
    const ttlDays = Number(process.env.TOKEN_TTL_DAYS ?? 90);
    await this.db.query(
      `insert into agent_tokens (id, agent_id, token_hash, created_at, expires_at)
       values ($1,$2,$3,$4,$5)`,
      [
        prefixed("tok"),
        agent.id,
        hashToken(rawToken),
        new Date().toISOString(),
        new Date(Date.now() + ttlDays * 86_400_000).toISOString(),
      ],
    );
    return { agent };
  }

  private async nextNumber(): Promise<number> {
    const r = await this.db.query<{ n: number | null }>(`select max(number)::int as n from agents`);
    return (r.rows[0]?.n ?? 0) + 1;
  }

  async agentForToken(rawToken: string): Promise<AgentRow | undefined> {
    const hash = hashToken(rawToken);
    const ttlDays = Number(process.env.TOKEN_TTL_DAYS ?? 90);
    const r = await this.db.query<Omit<AgentRow, "created_at"> & { created_at: unknown }>(
      `select a.id, a.number, a.name, a.description, a.created_at
         from agent_tokens t
         join agents a on a.id = t.agent_id
        where t.token_hash = $1
          and t.revoked_at is null
          and (t.expires_at is null or t.expires_at > now())`,
      [hash],
    );
    const agent = r.rows[0];
    if (!agent) return undefined;
    // 软 TTL 滑动（身份 spec §2：last_used + 90d）—— 每次成功鉴权即续期
    if (ttlDays > 0) {
      await this.db.query(
        `update agent_tokens set expires_at = now() + make_interval(days => $1)
          where token_hash = $2 and revoked_at is null`,
        [ttlDays, hash],
      );
    }
    return { ...agent, created_at: iso(agent.created_at) as string };
  }

  async agentByIdOrNumber(idOrNumber: string): Promise<AgentRow | undefined> {
    const isNum = /^\d+$/.test(idOrNumber);
    const r = await this.db.query<Omit<AgentRow, "created_at"> & { created_at: unknown }>(
      isNum
        ? `select id, number, name, description, created_at from agents where number = $1`
        : `select id, number, name, description, created_at from agents where id = $1`,
      [isNum ? Number(idOrNumber) : idOrNumber],
    );
    const agent = r.rows[0];
    return agent ? { ...agent, created_at: iso(agent.created_at) as string } : undefined;
  }

  async ensureTopic(slug: string): Promise<TopicRow> {
    const existing = await this.topicBySlug(slug);
    if (existing) return existing;
    const id = prefixed("topic");
    await this.db.query(
      `insert into topics (id, slug, name, description, mode) values ($1,$2,$3,$4,$5)
       on conflict (slug) do nothing`,
      [id, slug, slug, "", "broadcast"],
    );
    return (await this.topicBySlug(slug)) as TopicRow;
  }

  async topicBySlug(slug: string): Promise<TopicRow | undefined> {
    const r = await this.db.query<RawTopicRow>(
      `select ${TOPIC_COLS}
         from topics t where t.slug = $1`,
      [slug],
    );
    return r.rows[0] ? normalizeTopic(r.rows[0]) : undefined;
  }

  /** admin 专用：按 id 取行（含已下架） */
  async topicById(id: string): Promise<TopicRow | undefined> {
    const r = await this.db.query<RawTopicRow>(
      `select ${TOPIC_COLS} from topics t where t.id = $1`,
      [id],
    );
    return r.rows[0] ? normalizeTopic(r.rows[0]) : undefined;
  }

  async listTopics(opts: { includeArchived?: boolean } = {}): Promise<TopicRow[]> {
    const r = await this.db.query<RawTopicRow>(
      `select ${TOPIC_COLS}
         from topics t
        ${opts.includeArchived ? "" : "where t.archived_at is null"}
        order by signal_count desc, t.slug asc`,
    );
    return r.rows.map(normalizeTopic);
  }

  /** 治理写路径（admin 专用）：改名 / 描述 / mode / slug；带 slug 唯一性由调用方先查 */
  async updateTopic(
    id: string,
    patch: { name?: string; description?: string; mode?: "broadcast" | "forum"; slug?: string },
  ): Promise<TopicRow | undefined> {
    const r = await this.db.query(
      `update topics
          set name        = coalesce($2, name),
              description = coalesce($3, description),
              mode        = coalesce($4, mode),
              slug        = coalesce($5, slug)
        where id = $1
        returning id`,
      [id, patch.name ?? null, patch.description ?? null, patch.mode ?? null, patch.slug ?? null],
    );
    if (r.rows.length === 0) return undefined;
    return this.topicById(id);
  }

  /** 下架 = 软删标记（append-only 铁律，绝不删行） */
  async setTopicArchived(id: string, archived: boolean): Promise<TopicRow | undefined> {
    const r = await this.db.query(
      `update topics set archived_at = case when $2 then now() else null end
        where id = $1 returning id`,
      [id, archived],
    );
    if (r.rows.length === 0) return undefined;
    return this.topicById(id);
  }

  async putSignal(input: PutSignalInput): Promise<SignalRow> {
    const topic = await this.ensureTopic(input.topic);
    const id = prefixed("sig");
    const ttlDays = Number(process.env.SIGNAL_DEFAULT_TTL_DAYS ?? 7);
    await this.db.query(
      `insert into signals
         (id, topic_id, sender_agent_id, kind, priority, tokens_est, digest,
          origin, experience, digest_valid, stats_tag, created_at, expires_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        id,
        topic.id,
        input.sender_agent_id,
        input.kind,
        input.priority,
        input.tokens_est,
        input.digest,
        input.origin ? JSON.stringify(input.origin) : null,
        input.experience ? JSON.stringify(input.experience) : null,
        input.digest_valid,
        JSON.stringify([]),
        new Date().toISOString(),
        ttlDays > 0 ? new Date(Date.now() + ttlDays * 86_400_000).toISOString() : null,
      ],
    );
    return (await this.findSignal(id)) as SignalRow;
  }

  async listSignals(opts: ListOptions): Promise<SignalRow[]> {
    const params: unknown[] = [];
    const where: string[] = []; // FROM_JOIN 已有 where deleted_at is null，这里追加 AND 条件

    // "all" 是前端约定的「全部分区」伪 slug：不过滤分区，也不建同名分区
    if (opts.topic && opts.topic !== "all") {
      params.push(opts.topic);
      where.push(`t.slug = $${params.length}`);
    }
    if (opts.kind) {
      params.push(opts.kind);
      where.push(`s.kind = $${params.length}`);
    }
    if (opts.q) {
      params.push(`%${opts.q.toLowerCase()}%`);
      where.push(`(lower(s.digest) like $${params.length} or lower(s.id) like $${params.length})`);
    }
    if (opts.cursor) {
      if (opts.sort === "verified") {
        // verified 按排序键翻页：cursor 形如 "<verify_count>:<sig_ id>"，元组比较防跳号/重复
        const m = /^(\d+):(sig_.+)$/.exec(opts.cursor);
        if (!m) throw new Error("invalid cursor for sort=verified");
        params.push(Number(m[1]), m[2]);
        const vc = `$${params.length - 1}`;
        const cid = `$${params.length}`;
        where.push(`(s.verify_count < ${vc} or (s.verify_count = ${vc} and s.id < ${cid}))`);
      } else {
        params.push(opts.cursor);
        where.push(`s.id < $${params.length}`); // ULID 字典序=时间序，向前翻页
      }
    }
    const whereSql = where.length ? `and ${where.join(" and ")}` : "";

    const orderSql =
      opts.sort === "verified" ? `order by s.verify_count desc, s.id desc` : `order by s.id desc`;

    params.push(opts.limit);
    const sql = `select ${SIGNAL_COLS} ${FROM_JOIN} ${whereSql} ${orderSql} limit $${params.length}`;
    const r = await this.db.query<RawSignal>(sql, params);
    return r.rows.map(toSignalRow);
  }

  async findSignal(id: string, includeDeleted = false): Promise<SignalRow | undefined> {
    const filter = includeDeleted ? "s.id = $1" : "s.id = $1";
    const r = await this.db.query<RawSignal>(`select ${SIGNAL_COLS} ${FROM_JOIN} and ${filter}`, [
      id,
    ]);
    return r.rows[0] ? toSignalRow(r.rows[0]) : undefined;
  }

  /** 同 topic 的其他信号，按验证数与时间排（SQL 承担，不手写相似度） */
  async relatedSignals(id: string, limit: number): Promise<SignalRow[]> {
    const r = await this.db.query<RawSignal>(
      `select ${SIGNAL_COLS} ${FROM_JOIN}
        and s.topic_id = (select topic_id from signals where id = $1)
          and s.id <> $1
        order by s.verify_count desc, s.id desc
        limit $2`,
      [id, limit],
    );
    return r.rows.map(toSignalRow);
  }

  async bumpVerify(id: string): Promise<number> {
    const r = await this.db.query<{ verify_count: number }>(
      `update signals
          set verify_count = verify_count + 1,
              last_verified_at = now()
        where id = $1
        returning verify_count`,
      [id],
    );
    return r.rows[0]?.verify_count ?? 0;
  }

  async bumpViews(id: string): Promise<void> {
    await this.db.query(`update signals set views = views + 1 where id = $1`, [id]);
  }

  async updateCuration(
    id: string,
    patch: { recommended?: boolean; stats_tag?: string[] },
  ): Promise<SignalRow | undefined> {
    const r = await this.db.query<RawSignal>(
      `update signals
          set recommended = coalesce($2, recommended),
              stats_tag   = coalesce($3, stats_tag)
        where id = $1
        returning id`,
      [id, patch.recommended ?? null, patch.stats_tag ? JSON.stringify(patch.stats_tag) : null],
    );
    if (r.rows.length === 0) return undefined;
    return this.findSignal(id);
  }

  async frontpageStats(): Promise<FrontpageStats> {
    const r = await this.db.query<{
      signals: number;
      agents: number;
      topics: number;
      new_this_week: number;
    }>(
      `select
         (select count(*)::int from signals) as signals,
         (select count(*)::int from agents)  as agents,
         (select count(*)::int from topics)  as topics,
         (select count(*)::int from signals where created_at > now() - interval '7 days') as new_this_week`,
    );
    const row = r.rows[0] ?? { signals: 0, agents: 0, topics: 0, new_this_week: 0 };
    return {
      signals: row.signals,
      agents: row.agents,
      topics: row.topics,
      // 安装数 = 持有 token 的 agent 数（真实口径；不造数字，web-ia 零假数据纪律）
      installs: row.agents,
      new_this_week: row.new_this_week,
    };
  }

  async findSignalsByAgent(agentId: string): Promise<SignalRow[]> {
    const r = await this.db.query<RawSignal>(
      `select ${SIGNAL_COLS} ${FROM_JOIN} and s.sender_agent_id = $1 order by s.id desc limit 200`,
      [agentId],
    );
    return r.rows.map(toSignalRow);
  }

  async updateSignal(
    id: string,
    agentId: string,
    patch: { digest?: string; experience?: { format: "markdown"; body: string } },
  ): Promise<SignalRow | undefined> {
    await this.db.query(
      `update signals set digest = coalesce($2, digest), experience = coalesce($3, experience)
        where id = $1 and sender_agent_id = $4 and deleted_at is null`,
      [
        id,
        patch.digest ?? null,
        patch.experience ? JSON.stringify(patch.experience) : null,
        agentId,
      ],
    );
    return this.findSignal(id, true);
  }

  async softDeleteSignal(id: string, agentId: string): Promise<boolean> {
    const r = await this.db.query(
      `update signals set deleted_at = now() where id = $1 and sender_agent_id = $2 and deleted_at is null returning id`,
      [id, agentId],
    );
    return r.rows.length > 0;
  }

  async bindGithub(agentId: string, githubId: string): Promise<void> {
    await this.db.query(`update agents set github_id = $1 where id = $2`, [githubId, agentId]);
  }

  async findAgentByGithub(githubId: string): Promise<AgentRow | undefined> {
    const r = await this.db.query<AgentRow>(
      `select id, number, name, description, created_at from agents where github_id = $1`,
      [githubId],
    );
    return r.rows[0];
  }

  async ready(): Promise<boolean> {
    try {
      const r = await this.db.query<{ ok: number }>(`select 1 as ok`);
      return r.rows[0]?.ok === 1;
    } catch {
      return false;
    }
  }

  /** 当前 schema 版本（供 /readyz 上报；未迁移返回 "none"） */
  async migrationVersion(): Promise<string> {
    const r = await this.db.query<{ value: string }>(
      `select value from schema_meta where key = 'schema_version'`,
    );
    return r.rows[0]?.value ?? "none";
  }
}
