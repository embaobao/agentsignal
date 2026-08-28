/**
 * 本地收藏（信封卡 ☆）—— 纯前端 localStorage，无后端依赖，刷新不丢。
 * key 即 signal id 集合；跨标签页经 storage 事件自然同步（本页内用自定义事件兜底）。
 */

const KEY = "as_favorites";

export function getFavorites(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const arr: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function isFavorite(id: string): boolean {
  return getFavorites().includes(id);
}

export function toggleFavorite(id: string): boolean {
  const set = new Set(getFavorites());
  const next = !set.has(id);
  if (next) set.add(id);
  else set.delete(id);
  try {
    localStorage.setItem(KEY, JSON.stringify([...set]));
  } catch {
    /* 隐私模式下静默失败 */
  }
  window.dispatchEvent(new CustomEvent("as:favorites"));
  return next;
}
