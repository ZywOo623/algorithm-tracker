"use strict";

const Core = globalThis.AlgorithmCore;
const state = Core.loadState(localStorage);
const $ = id => document.getElementById(id);
const node = (tag, className = "", value = "") => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (value) element.textContent = value;
  return element;
};
const save = () => localStorage.setItem(Core.STORAGE_KEY, JSON.stringify(state));
const profile = () => Core.activeProfile(state);
const problems = () => profile().problems;
const percent = value => `${Math.round(value * 100)}%`;

function empty(container, message) {
  container.replaceChildren(node("p", "empty", message));
}

function renderProfile() {
  const current = profile();
  $("cfHandle").value = current.handle || "";
  $("currentRating").textContent = current.rating ?? "暂无";
  const container = $("cfProfile");
  container.replaceChildren();
  if (!state.activeHandle) return;
  const row = node("div", "cf-user");
  row.append(node("strong", "", current.handle), node("span", "", `当前 Rating：${current.rating ?? "暂无"}`), node("span", "", `最高 Rating：${current.maxRating ?? "暂无"}`));
  if (current.lastSynced) row.append(node("span", "", `上次同步：${new Date(current.lastSynced).toLocaleString("zh-CN")}`));
  container.append(row);
}

function renderStats() {
  const items = problems();
  const solved = items.filter(item => item.status === "Solved").length;
  $("totalProblems").textContent = items.length;
  $("solvedProblems").textContent = solved;
  $("wrongProblems").textContent = items.length - solved;
  $("solveRate").textContent = items.length ? percent(solved / items.length) : "0%";
}

function renderAnalysis() {
  const analysis = Core.analyze(problems());
  const container = $("weakTags");
  container.replaceChildren();
  if (!analysis.recentCount) empty(container, "还没有题目。先同步账号或手动记录一道题。");
  else if (!analysis.tagStats.length) empty(container, "最近的题目还没有标签，暂时无法分析知识点。");
  else {
    for (const item of analysis.tagStats.slice(0, 8)) {
      const row = node("div", "data-row");
      const left = node("div");
      left.append(node("strong", "", item.tag), node("small", "", `${item.total} 题 · ${item.wrong} 题未解决`));
      row.append(left, node("span", "badge", item.total >= 3 ? `未解决占比 ${percent(item.rate)}` : "样本不足"));
      container.append(row);
    }
  }
  const plan = $("trainingPlan");
  plan.replaceChildren();
  if (analysis.focus) {
    const card = node("div", "plan-card");
    card.append(node("strong", "", `${analysis.focus.tag} · Rating ${analysis.minRating}–${analysis.maxRating}`));
    card.append(node("p", "", `最近 ${analysis.recentCount} 题中，该标签有 ${analysis.focus.wrong}/${analysis.focus.total} 题尚未解决。本周做 5 道新题，并复盘已有错题。`));
    plan.append(card);
  } else {
    empty(plan, analysis.recentCount < 3 ? "先积累至少 3 道带标签的题目，再生成有依据的薄弱点计划。" : "目前没有足够证据判定薄弱标签。继续训练，保持复盘。");
  }
  $("recommendButton").disabled = !analysis.focus;
  return analysis;
}

function problemTitle(item) {
  const title = node("strong", "", item.name);
  if (item.source === "cf") {
    const match = item.id.match(/^cf:(\d+)([A-Za-z][A-Za-z0-9]*)$/);
    if (match) {
      const link = node("a");
      link.href = `https://codeforces.com/problemset/problem/${match[1]}/${match[2]}`;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.append(title);
      return link;
    }
  }
  return title;
}

function problemRow(item, inWrongCenter = false) {
  const row = node("div", "problem-row");
  const main = node("div", "problem-main");
  main.append(problemTitle(item));
  const meta = node("div", "problem-meta");
  meta.append(node("span", `badge ${item.status === "Solved" ? "solved" : "wrong"}`, item.status === "Solved" ? "已解决" : "待攻克"));
  meta.append(node("span", "", item.rating ? `Rating ${item.rating}` : "未评级"));
  item.tags.forEach(tag => meta.append(node("span", "tag", tag)));
  if (inWrongCenter) {
    meta.append(node("span", "", `错误提交 ${item.wrongCount} · AC ${item.acceptedCount} · 复习 ${item.reviewCount} 次`));
    if (item.lastReview) meta.append(node("span", "", `上次复习 ${item.lastReview}`));
  }
  main.append(meta);
  const actions = node("div", "actions");
  const toggle = node("button", "secondary", item.status === "Solved" ? "标记待攻克" : "标记已掌握");
  toggle.type = "button";
  toggle.addEventListener("click", () => {
    item.status = item.status === "Solved" ? "Wrong" : "Solved";
    if (item.source === "cf") item.statusOverride = item.status;
    if (item.status === "Wrong" && item.source === "manual") item.wrongCount = Math.max(1, item.wrongCount);
    save(); render();
  });
  actions.append(toggle);
  if (inWrongCenter) {
    const review = node("button", "secondary", "记录复习");
    review.type = "button";
    review.addEventListener("click", () => {
      item.reviewCount++;
      item.lastReview = new Date().toLocaleDateString("zh-CN");
      save(); render();
    });
    actions.append(review);
  }
  if (item.source === "manual" && !inWrongCenter) {
    const remove = node("button", "danger", "删除");
    remove.type = "button";
    remove.addEventListener("click", () => {
      profile().problems = problems().filter(problem => problem.id !== item.id);
      save(); render();
    });
    actions.append(remove);
  }
  row.append(main, actions);
  return row;
}

function renderProblems() {
  const all = [...problems()].sort((a, b) => b.lastAttemptAt - a.lastAttemptAt);
  const tagFilter = $("tagFilter");
  const selectedTag = tagFilter.value;
  tagFilter.replaceChildren(new Option("全部", "All"));
  [...new Set(all.flatMap(item => item.tags))].sort().forEach(tag => tagFilter.add(new Option(tag, tag)));
  tagFilter.value = [...tagFilter.options].some(option => option.value === selectedTag) ? selectedTag : "All";
  const status = $("statusFilter").value;
  const rating = $("ratingFilter").value;
  const search = $("searchInput").value.trim().toLowerCase();
  const filtered = all.filter(item => {
    if (status !== "All" && item.status !== status) return false;
    if (rating !== "All") {
      const floor = Number(rating);
      if (floor === 0 ? item.rating !== 0 : floor === 1600 ? item.rating < 1600 : item.rating < floor || item.rating >= floor + 200) return false;
    }
    if (tagFilter.value !== "All" && !item.tags.includes(tagFilter.value)) return false;
    return item.name.toLowerCase().includes(search) || item.id.toLowerCase().includes(search);
  });
  const list = $("problemList");
  list.replaceChildren();
  if (!filtered.length) empty(list, "没有符合条件的题目。");
  else filtered.forEach(item => list.append(problemRow(item)));
  const wrong = $("wrongProblemList");
  wrong.replaceChildren();
  const wrongItems = all.filter(item => item.status === "Wrong" || item.wrongCount > 0);
  if (!wrongItems.length) empty(wrong, "暂无错题。提交记录中曾出错、或标记为待攻克的题目会出现在这里。");
  else wrongItems.forEach(item => wrong.append(problemRow(item, true)));
  const promptSelect = $("promptProblem");
  const promptValue = promptSelect.value;
  promptSelect.replaceChildren(new Option("请选择已记录题目", ""));
  const wrongGroup = document.createElement("optgroup");
  wrongGroup.label = "待攻克 / 曾出错";
  wrongItems.forEach(item => wrongGroup.append(new Option(item.name, item.id)));
  if (wrongItems.length) promptSelect.add(wrongGroup);
  const otherItems = all.filter(item => item.status !== "Wrong" && item.wrongCount === 0);
  const otherGroup = document.createElement("optgroup");
  otherGroup.label = "其他已记录题目";
  otherItems.forEach(item => otherGroup.append(new Option(item.name, item.id)));
  if (otherItems.length) promptSelect.add(otherGroup);
  promptSelect.add(new Option("其他题目（自己填写）", "custom"));
  promptSelect.value = promptValue === "custom" || all.some(item => item.id === promptValue) ? promptValue : "";
  updateCustomProblemFields();
}

function updateCustomProblemFields() {
  const custom = $("promptProblem").value === "custom";
  $("customProblemFields").hidden = !custom;
  $("customProblemName").required = custom;
}

$("promptProblem").addEventListener("change", updateCustomProblemFields);

function render() {
  renderProfile();
  renderStats();
  renderAnalysis();
  renderProblems();
}

async function cfApi(path) {
  const response = await fetch(`https://codeforces.com/api/${path}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  if (data.status !== "OK") throw new Error(data.comment || "Codeforces API 返回错误");
  return data.result;
}

$("accountForm").addEventListener("submit", async event => {
  event.preventDefault();
  const handle = $("cfHandle").value.trim();
  if (!handle) return;
  const button = $("syncButton");
  button.disabled = true;
  $("syncMessage").textContent = "正在同步账号与提交记录…";
  try {
    const users = await cfApi(`user.info?handles=${encodeURIComponent(handle)}`);
    const canonical = users[0].handle;
    const submissions = await cfApi(`user.status?handle=${encodeURIComponent(canonical)}&from=1&count=1000`);
    const key = Core.keyFor(canonical);
    const next = state.profiles[key] || Core.emptyProfile(canonical);
    next.handle = canonical;
    next.rating = users[0].rating ?? null;
    next.maxRating = users[0].maxRating ?? null;
    next.rank = users[0].rank || "";
    next.problems = Core.mergeSubmissions(next.problems, submissions);
    next.lastSynced = Date.now();
    state.profiles[key] = next;
    state.activeHandle = key;
    save(); render();
    $("syncMessage").textContent = `同步完成：读取最近 ${submissions.length} 条提交，当前题库 ${next.problems.length} 题。本地复习记录已保留。`;
    $("recommendations").replaceChildren();
    $("recommendMessage").textContent = "";
  } catch (error) {
    $("syncMessage").textContent = `同步失败：${error.message}。请检查用户名或网络，原有数据没有被覆盖。`;
  } finally {
    button.disabled = false;
  }
});

$("problemForm").addEventListener("submit", event => {
  event.preventDefault();
  const name = $("problemName").value.trim();
  const tags = [...new Set($("problemTags").value.split(",").map(tag => tag.trim()).filter(Boolean))];
  if (!name || !tags.length) return;
  const status = $("problemStatus").value;
  const item = Core.normalizeProblem({
    id: `manual:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    source: "manual", name, rating: Number($("problemRating").value) || 0,
    tags, status, wrongCount: status === "Wrong" ? 1 : 0,
    acceptedCount: status === "Solved" ? 1 : 0, lastAttemptAt: Date.now()
  });
  profile().problems.push(item);
  save(); event.target.reset(); render();
});

["statusFilter", "ratingFilter", "tagFilter", "searchInput"].forEach(id => {
  $(id).addEventListener(id === "searchInput" ? "input" : "change", renderProblems);
});

$("recommendButton").addEventListener("click", async () => {
  const analysis = Core.analyze(problems());
  if (!analysis.focus) return;
  const button = $("recommendButton");
  button.disabled = true;
  $("recommendMessage").textContent = "正在从 Codeforces 题库筛选未做过的题目…";
  try {
    const result = await cfApi("problemset.problems");
    const picks = Core.recommend(result.problems, problems(), analysis.focus.tag, analysis.minRating, analysis.maxRating);
    const list = $("recommendations");
    list.replaceChildren();
    for (const item of picks) {
      const row = node("div", "data-row");
      const link = node("a", "", `${item.contestId}${item.index} · ${item.name}`);
      link.href = `https://codeforces.com/problemset/problem/${item.contestId}/${item.index}`;
      link.target = "_blank"; link.rel = "noopener noreferrer";
      row.append(link, node("span", "badge", `Rating ${item.rating}`));
      list.append(row);
    }
    $("recommendMessage").textContent = picks.length ? `根据标签 ${analysis.focus.tag} 与 Rating ${analysis.minRating}–${analysis.maxRating} 推荐 ${picks.length} 题；已排除当前记录中做过的题。` : "当前条件下没有找到未做过的题目，可继续复盘错题。";
  } catch (error) {
    $("recommendMessage").textContent = `题库暂时无法加载：${error.message}`;
  } finally {
    button.disabled = false;
  }
});

function buildPrompt() {
  const selected = $("promptProblem").value;
  const item = selected === "custom"
    ? { name: $("customProblemName").value.trim(), source: "custom", rating: 0, tags: [], status: "Wrong", wrongCount: 0 }
    : problems().find(problem => problem.id === selected);
  return Core.buildStudyPrompt(item, {
    statement: $("promptStatement").value,
    code: $("promptCode").value,
    notes: $("promptNotes").value
  });
}

$("promptForm").addEventListener("submit", event => {
  event.preventDefault();
  try {
    $("promptOutput").value = buildPrompt();
    $("copyPrompt").disabled = false;
    $("promptMessage").textContent = "提示词已生成；内容仍只在当前页面中。";
  } catch (error) {
    $("promptMessage").textContent = error.message;
  }
});

const aiEndpoint = String(globalThis.ALGORITHM_TRACKER_AI_ENDPOINT || "").trim();
$("aiSettings").hidden = !aiEndpoint;
$("analyzeButton").addEventListener("click", async () => {
  if (!aiEndpoint) {
    $("promptMessage").textContent = "AI 服务尚未部署。现在可先生成提示词并复制到其他 AI 工具。";
    return;
  }
  let prompt;
  try { prompt = buildPrompt(); }
  catch (error) { $("promptMessage").textContent = error.message; return; }
  const accessCode = $("aiAccessCode").value;
  if (!accessCode.trim()) {
    $("promptMessage").textContent = "请填写 AI 访问口令。";
    $("aiAccessCode").focus();
    return;
  }
  const button = $("analyzeButton");
  button.disabled = true;
  button.textContent = "正在分析…";
  $("aiOutput").textContent = "正在分析…";
  $("promptMessage").textContent = "只有这次点击才会发送题目、代码和思路。";
  try {
    const response = await fetch(aiEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessCode}` },
      body: JSON.stringify({ prompt })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `AI 服务返回 ${response.status}`);
    $("aiOutput").textContent = result.analysis || "AI 未返回内容，请稍后重试。";
    $("promptMessage").textContent = `分析完成。今日服务请求数：${result.used}/${result.limit}。AI 建议可能有误，请结合题目与提交结果核对。`;
    $("aiOutput").scrollIntoView({ block: "nearest" });
  } catch (error) {
    $("aiOutput").textContent = "分析未完成。";
    $("promptMessage").textContent = `AI 分析失败：${error.message}`;
  } finally {
    button.disabled = false;
    button.textContent = "AI 分析";
  }
});

$("copyPrompt").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("promptOutput").value);
    $("promptMessage").textContent = "已复制，可以粘贴到你使用的 AI 工具。";
  } catch {
    $("promptOutput").select();
    $("promptMessage").textContent = "自动复制不可用，已选中文本，请手动复制。";
  }
});

render();

