const test = require("node:test");
const assert = require("node:assert/strict");

test("每日分析次数到达上限后拒绝，并在新的一天重新计数", async () => {
  const { reserveDaily } = await import("../worker/quota.mjs");
  const data = new Map();
  const kv = { get: key => data.get(key), put: (key, value) => data.set(key, value) };
  assert.deepEqual(reserveDaily(kv, "2026-10-13", 2), { allowed: true, used: 1 });
  assert.deepEqual(reserveDaily(kv, "2026-10-13", 2), { allowed: true, used: 2 });
  assert.deepEqual(reserveDaily(kv, "2026-10-13", 2), { allowed: false, used: 2 });
  assert.deepEqual(reserveDaily(kv, "2026-10-14", 2), { allowed: true, used: 1 });
});
