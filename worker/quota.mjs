export function reserveDaily(kv, day, limit) {
  const key = `day:${day}`;
  // SQLite 同步 KV 操作在同一个事件内执行，避免并发请求越过限额。
  const used = kv.get(key) || 0;
  if (used >= limit) return { allowed: false, used };
  kv.put(key, used + 1);
  return { allowed: true, used: used + 1 };
}
