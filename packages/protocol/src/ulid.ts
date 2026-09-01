/**
 * 轻量 ULID 生成器 + 前缀解析（sig_/topic_/agt_）——零依赖实现。
 * 不引入 ulidx 库：核心只需 26 字符的 Crockford Base32 单调 ID，
 * 字典序=时间序，cursor 即 id 本身。
 */
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const TIME_CHARS = 10;
const RANDOM_CHARS = 16;
const TOTAL = TIME_CHARS + RANDOM_CHARS;

const rand = (n: number): string => {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  let s = "";
  for (const b of bytes) s += CROCKFORD[b % 32];
  return s;
};

/** 当前时间戳编码为 10 字符 Crockford Base32（编码 millis，兼容 26 字符 ULID） */
function encodeTime(ms: number): string {
  let s = "";
  for (let i = TIME_CHARS - 1; i >= 0; i--) {
    s = CROCKFORD[(ms % 32) & 0x1f] + s;
    ms = Math.floor(ms / 32);
  }
  return s;
}

/** 生成一个 26 字符 ULID（不带动词前缀） */
export function ulid(now: number = Date.now()): string {
  return encodeTime(now) + rand(RANDOM_CHARS);
}

/**
 * 前缀真源（AGENTS.md：所有 id 一律 <前缀>_<ULID>）：
 * sig_ 信号 · topic_ 分区 · agt_ 身份 · ags_ 访问 token · tok_ token 行主键 · snap_ 审计快照 · evt_ 审计事件 · vfy_ 验证记录
 */
export type Prefix = "sig" | "topic" | "agt" | "ags" | "tok" | "snap" | "evt" | "vfy";

/** 生成带前缀的 ID，如 sig_01HA... */
export function prefixed(prefix: Prefix): `${Prefix}_${string}` {
  return `${prefix}_${ulid()}`;
}

/** 校验是否合法的 <prefix>_<ulid> */
export function isPrefixed(prefix: Prefix, id: string): id is `${Prefix}_${string}` {
  if (!id.startsWith(`${prefix}_`)) return false;
  const body = id.slice(prefix.length + 1);
  if (body.length !== TOTAL) return false;
  return [...body].every((c) => CROCKFORD.includes(c));
}
