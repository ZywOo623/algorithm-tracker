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

  const api = { STORAGE_KEY, keyFor, emptyProfile, normalizeProblem, loadState, activeProfile, mergeSubmissions, analyze, recommend };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.AlgorithmCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this);

