const test = require("node:test");
const assert = require("node:assert/strict");
const Core = require("../core.js");

function memoryStorage(seed = {}) {
  const data = new Map(Object.entries(seed));
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), data };
}

test("迁移旧版数据，保留不同账号与当前账号的复习记录", () => {
  const storage = memoryStorage({
    cfHandle: "Alice",
    cfProblems: JSON.stringify({ Alice: [{ id: "123A", name: "CF 123A", tags: ["greedy"], status: "Wrong", wrongCount: 1 }], Bob: [{ id: "456B", name: "CF 456B", tags: ["math"], status: "Solved" }] }),
    problems: JSON.stringify([{ id: "123A", name: "CF 123A", tags: ["greedy"], status: "Wrong", wrongCount: 1, reviewCount: 2, lastReview: "2026/10/1" }]),
    cfRating: "1200"
  });
  const state = Core.loadState(storage);
  assert.equal(state.activeHandle, "alice");
  assert.equal(state.profiles.alice.problems.length, 1);
  assert.equal(state.profiles.alice.problems[0].reviewCount, 2);
  assert.equal(state.profiles.alice.rating, 1200);
  assert.equal(state.profiles.bob.problems.length, 1);
  assert.equal(Core.loadState(storage).profiles.alice.problems.length, 1);
  assert.ok(storage.getItem("cfProblems"), "旧版数据不应被删除");
});

test("重复同步按题目合并，同时保留本地状态与复习", () => {
  const old = [{ id: "cf:123A", source: "cf", name: "CF 123A", tags: ["greedy"], status: "Wrong", statusOverride: "Wrong", reviewCount: 3, lastReview: "2026/10/1" }];
  const submissions = [
    { problem: { contestId: 123, index: "A", name: "A", rating: 1200, tags: ["greedy"] }, verdict: "WRONG_ANSWER", creationTimeSeconds: 100 },
    { problem: { contestId: 123, index: "A", name: "A", rating: 1200, tags: ["greedy"] }, verdict: "OK", creationTimeSeconds: 200 }
  ];
  const first = Core.mergeSubmissions(old, submissions);
  const second = Core.mergeSubmissions(first, submissions);
  assert.equal(second.length, 1);
  assert.equal(second[0].wrongCount, 1);
  assert.equal(second[0].acceptedCount, 1);
  assert.equal(second[0].reviewCount, 3);
  assert.equal(second[0].status, "Wrong");
  assert.equal(second[0].lastAttemptAt, 200000);
});

test("薄弱点需要足够样本，推荐排除已做题", () => {
  const items = [
    { id: "cf:1A", tags: ["greedy"], status: "Wrong", rating: 1200, lastAttemptAt: 3 },
    { id: "cf:2A", tags: ["greedy"], status: "Wrong", rating: 1300, lastAttemptAt: 2 },
    { id: "cf:3A", tags: ["greedy"], status: "Solved", rating: 1400, lastAttemptAt: 1 }
  ];
  assert.equal(Core.analyze(items.slice(0, 2)).focus, null);
  const analysis = Core.analyze(items);
  assert.equal(analysis.focus.tag, "greedy");
  assert.equal(analysis.focus.wrong, 2);
  const catalog = [
    { contestId: 1, index: "A", name: "done", rating: 1200, tags: ["greedy"] },
    { contestId: 4, index: "B", name: "new", rating: 1300, tags: ["greedy"] },
    { contestId: 5, index: "C", name: "other tag", rating: 1300, tags: ["math"] }
  ];
  assert.deepEqual(Core.recommend(catalog, items, "greedy", 1200, 1400).map(item => item.name), ["new"]);
});

test("提示词结合已有 CF 记录和本次填写内容", () => {
  const item = Core.normalizeProblem({ id: "cf:123A", source: "cf", name: "CF 123A", rating: 1200, tags: ["binary search"], status: "Solved", wrongCount: 2, acceptedCount: 1, reviewCount: 3, lastReview: "2026/10/13" });
  const prompt = Core.buildStudyPrompt(item, { statement: "求第一个不小于 x 的位置", code: "while (l < r) {}", notes: "边界处理不确定" });
  for (const detail of ["https://codeforces.com/problemset/problem/123/A", "已解决，曾有错误提交", "错误提交 2 次", "已复习 3 次", "求第一个不小于 x 的位置", "while (l < r) {}", "边界处理不确定"]) {
    assert.ok(prompt.includes(detail), detail);
  }
});

test("无错误记录和自定义题目不虚构错误或代码", () => {
  const solved = Core.buildStudyPrompt(Core.normalizeProblem({ id: "cf:456B", source: "cf", name: "CF 456B", status: "Solved", acceptedCount: 1 }));
  assert.ok(solved.includes("当前状态：已解决\n"));
  assert.ok(!solved.includes("曾有错误提交"));
  const custom = Core.buildStudyPrompt({ name: "自选练习题", source: "custom", status: "Wrong", tags: [] }, { notes: "想练习动态规划" });
  assert.ok(custom.includes("【本次填写的题目】"));
  assert.ok(custom.includes("想练习动态规划"));
  assert.ok(custom.includes("题目描述：本次未提供"));
  assert.ok(!custom.includes("手动添加的题目记录"));
  assert.ok(!custom.includes("我的代码："));
  assert.throws(() => Core.buildStudyPrompt(null), /请先选择/);
});

