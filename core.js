(function (root) {
  "use strict";

  const STORAGE_KEY = "algorithmTracker.v2";
  const emptyProfile = (handle = "") => ({ handle, rating: null, maxRating: null, rank: "", problems: [], lastSynced: null });
  const keyFor = handle => String(handle || "").trim().toLowerCase();
  const numberOrZero = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
  const safeParse = (value, fallback) => {
    try { return JSON.parse(value) ?? fallback; } catch { return fallback; }
  };

  function normalizeProblem(raw) {
    if (!raw || typeof raw !== "object") return null;
    const legacyId = String(raw.id ?? "");
    const isCf = raw.source === "cf" || /^\d+[A-Za-z][A-Za-z0-9]*$/.test(legacyId);
    const source = isCf ? "cf" : "manual";
    const id = String(raw.id || (source === "manual" ? `manual:${Date.now()}` : ""));
    if (!id || !String(raw.name || "").trim()) return null;
    const wrongCount = numberOrZero(raw.wrongCount);
    const acceptedCount = numberOrZero(raw.acceptedCount);
    return {
      id: source === "cf" && !id.startsWith("cf:") ? `cf:${id}` : id,
      source,
      name: String(raw.name).trim(),
      rating: numberOrZero(raw.rating),
      tags: [...new Set((Array.isArray(raw.tags) ? raw.tags : []).map(tag => String(tag).trim()).filter(Boolean))],
      status: raw.status === "Wrong" ? "Wrong" : "Solved",
      statusOverride: raw.statusOverride === "Wrong" || raw.statusOverride === "Solved" ? raw.statusOverride : null,
      wrongCount,
      acceptedCount,
      reviewCount: numberOrZero(raw.reviewCount),
      lastReview: raw.lastReview || null,
      lastAttemptAt: numberOrZero(raw.lastAttemptAt || raw.createdAt),
      errorRate: wrongCount + acceptedCount ? wrongCount / (wrongCount + acceptedCount) : 0
    };
  }

  function uniqueProblems(items) {
    const map = new Map();
    (Array.isArray(items) ? items : []).forEach(item => {
      const problem = normalizeProblem(item);
      if (problem) map.set(problem.id, { ...map.get(problem.id), ...problem });
    });
    return [...map.values()];
  }

  function loadState(storage) {
    const existing = safeParse(storage.getItem(STORAGE_KEY), null);
    if (existing && existing.version === 2 && existing.profiles && typeof existing.profiles === "object") {
      for (const profile of Object.values(existing.profiles)) profile.problems = uniqueProblems(profile.problems);
      existing.activeHandle = keyFor(existing.activeHandle);
      return existing;
    }
    const state = { version: 2, activeHandle: keyFor(storage.getItem("cfHandle")), profiles: {} };
    state.profiles[""] = emptyProfile();
    const oldProfiles = safeParse(storage.getItem("cfProblems"), {});
    if (oldProfiles && typeof oldProfiles === "object") {
      for (const [handle, items] of Object.entries(oldProfiles)) {
        const key = keyFor(handle);
        state.profiles[key] = { ...emptyProfile(handle), problems: uniqueProblems(items) };
      }
    }
    const active = state.activeHandle;
    if (!state.profiles[active]) state.profiles[active] = emptyProfile(storage.getItem("cfHandle") || "");
    const oldCurrent = safeParse(storage.getItem("problems"), []);
    state.profiles[active].problems = uniqueProblems([...state.profiles[active].problems, ...(Array.isArray(oldCurrent) ? oldCurrent : [])]);
    const oldRating = Number(storage.getItem("cfRating"));
    if (active && oldRating > 0) state.profiles[active].rating = oldRating;
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return state;
  }

  function activeProfile(state) {
    const key = keyFor(state.activeHandle);
    if (!state.profiles[key]) state.profiles[key] = emptyProfile(key);
    return state.profiles[key];
  }

  function mergeSubmissions(previous, submissions) {
    const records = new Map(uniqueProblems(previous).map(problem => [problem.id, problem]));
    const batch = new Map();
    for (const submission of Array.isArray(submissions) ? submissions : []) {
      const problem = submission?.problem;
      if (!problem || problem.contestId == null || !problem.index) continue;
      const id = `cf:${problem.contestId}${problem.index}`;
      if (!batch.has(id)) batch.set(id, { id, source: "cf", name: `CF ${problem.contestId}${problem.index} ${problem.name || ""}`.trim(), rating: numberOrZero(problem.rating), tags: problem.tags || [], wrongCount: 0, acceptedCount: 0, lastAttemptAt: 0 });
      const entry = batch.get(id);
      if (submission.verdict === "OK") entry.acceptedCount++;
      else if (submission.verdict && submission.verdict !== "TESTING") entry.wrongCount++;
      entry.lastAttemptAt = Math.max(entry.lastAttemptAt, numberOrZero(submission.creationTimeSeconds) * 1000);
    }
    for (const entry of batch.values()) {
      const old = records.get(entry.id);
      const inferred = entry.acceptedCount > 0 ? "Solved" : "Wrong";
      const merged = normalizeProblem({
        ...old, ...entry, status: old?.statusOverride || inferred,
        statusOverride: old?.statusOverride || null,
        reviewCount: old?.reviewCount || 0,
        lastReview: old?.lastReview || null,
        lastAttemptAt: Math.max(entry.lastAttemptAt, old?.lastAttemptAt || 0)
      });
      records.set(entry.id, merged);
    }
    return [...records.values()];
  }

  function analyze(problems) {
    const recent = [...problems].sort((a, b) => b.lastAttemptAt - a.lastAttemptAt).slice(0, 50);
    const tags = new Map();
    for (const problem of recent) {
      for (const tag of problem.tags) {
        if (!tags.has(tag)) tags.set(tag, { tag, total: 0, wrong: 0, ratings: [] });
        const item = tags.get(tag);
        item.total++;
        if (problem.status === "Wrong") item.wrong++;
        if (problem.rating > 0) item.ratings.push(problem.rating);
      }
    }
    const tagStats = [...tags.values()].map(item => ({ ...item, rate: item.wrong / item.total }))
      .sort((a, b) => (b.total >= 3 ? 1 : 0) - (a.total >= 3 ? 1 : 0) || b.rate - a.rate || b.total - a.total || a.tag.localeCompare(b.tag));
    const focus = tagStats.find(item => item.total >= 3 && item.wrong > 0) || null;
    const ratings = focus?.ratings.sort((a, b) => a - b) || [];
    const center = ratings.length ? Math.round(ratings[Math.floor(ratings.length / 2)] / 100) * 100 : 1000;
    return { recentCount: recent.length, tagStats, focus, minRating: Math.max(800, center - 100), maxRating: Math.max(1000, center + 100) };
  }

  function recommend(catalog, attempted, focus, minRating, maxRating) {
    const seen = new Set(attempted.map(problem => problem.id));
    return (Array.isArray(catalog) ? catalog : [])
      .filter(problem => problem.contestId != null && problem.index && Number.isFinite(problem.rating)
        && problem.rating >= minRating && problem.rating <= maxRating
        && Array.isArray(problem.tags) && problem.tags.includes(focus)
        && !seen.has(`cf:${problem.contestId}${problem.index}`))
      .sort((a, b) => a.rating - b.rating || a.contestId - b.contestId || a.index.localeCompare(b.index))
      .slice(0, 5);
  }

  function buildProblemContext(problem, input = {}) {
    if (!problem?.name?.trim()) throw new Error("请先选择已记录题目，或填写自定义题目名称。");
    const statement = String(input.statement || "").trim();
    const code = String(input.code || "").trim();
    const notes = String(input.notes || "").trim();
    const cfMatch = String(problem.id || "").match(/^cf:(\d+)([A-Za-z][A-Za-z0-9]*)$/);
    const status = problem.status === "Wrong" ? "待攻克" : problem.wrongCount > 0 ? "已解决，曾有错误提交" : "已解决";
    const recorded = [
      `题目：${problem.name.trim()}`,
      cfMatch ? `Codeforces 链接：https://codeforces.com/problemset/problem/${cfMatch[1]}/${cfMatch[2]}` : "",
      `难度：${problem.rating || "未知"}；标签：${problem.tags?.join("、") || "未知"}`,
      `当前状态：${status}`,
      problem.source === "manual" ? "这是一条手动添加的题目记录，提交次数可能没有同步。" : problem.source === "custom" ? "" : `错误提交 ${problem.wrongCount || 0} 次；通过提交 ${problem.acceptedCount || 0} 次。`,
      problem.reviewCount ? `已复习 ${problem.reviewCount} 次${problem.lastReview ? `；最近复习：${problem.lastReview}` : ""}。` : ""
    ].filter(Boolean);
    const supplied = [
      statement ? `题目描述、输入输出或关键条件：\n${statement}` : "题目描述：本次未提供。",
      notes ? `我的思路或卡点：\n${notes}` : "",
      code ? `我的代码：\n${code}` : ""
    ].filter(Boolean);
    return [
      `【${problem.source === "custom" ? "本次填写的题目" : "已有题目记录"}】\n${recorded.join("\n")}`,
      `【本次补充】\n${supplied.join("\n\n")}`
    ].join("\n\n");
  }

  function buildStudyPrompt(problem, input = {}) {
    return [
      "我在复盘下面这道算法题，想请你帮我找出思路或代码可能错在哪里。请根据我提供的记录、题面、代码和卡点来回答；先核对题意，再引导我自己修正，不要直接给完整代码或最终答案。",
      buildProblemContext(problem, input),
      "如果缺少完整题面，且你无法访问题目链接，请先问我要题面，不要凭题名猜题意。如果我没有提供代码，请分析思路中的风险，不要说你已经检查过代码。",
      "信息足够时，请指出可确认的错误及依据，并将尚待验证的疑点分开说明；给一个能暴露问题的小样例，再给最多三个逐级提示。"
    ].join("\n\n");
  }

  function buildErrorAnalysisPrompt(problem, input = {}) {
    return [
      "请直接分析这道算法题哪里可能做错了。根据题面、我的代码和思路定位具体问题；不要只给通用解题提示，也不要直接给完整正确代码。",
      buildProblemContext(problem, input),
      "先检查题意是否足够。如果缺少完整题面，且无法访问题目链接，请先索取题面，不能凭题名猜测。没有代码时，只能分析思路中可能的风险，不能声称已定位代码错误。",
      "信息足够时请按顺序回答：1. 已确认的错误：指出对应代码、条件或推理步骤及理由；2. 尚待验证的风险：明确标注为猜测；3. 一个尽可能小的反例、预期结果和错误表现（无法运行代码时不要编造实际运行结果）；4. 修正方向和我应该重新检查的边界条件。"
    ].join("\n\n");
  }

  const api = { STORAGE_KEY, keyFor, emptyProfile, normalizeProblem, loadState, activeProfile, mergeSubmissions, analyze, recommend, buildStudyPrompt, buildErrorAnalysisPrompt };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.AlgorithmCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this);

