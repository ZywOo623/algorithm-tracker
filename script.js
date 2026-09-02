// ==============================
// 1. 获取保存的数据
// ==============================

let cfProblems =
    JSON.parse(localStorage.getItem("cfProblems")) || {};

let currentHandle =
    localStorage.getItem("cfHandle") || "";

let problems =
    currentHandle
        ? (cfProblems[currentHandle] || [])
        : [];

// 恢复上次使用的 CF 用户名
if (currentHandle) {
    document.getElementById("cfHandle").value =
        currentHandle;
}

// 恢复上次保存的 CF Rating
const savedCfRating =
    localStorage.getItem("cfRating");

if (savedCfRating) {
    document.getElementById("currentRating").textContent =
        savedCfRating;
}

// 兼容之前保存的旧题目数据
problems = problems.map(problem => {

    if (problem.wrongCount === undefined) {
        problem.wrongCount =
            problem.status === "Wrong" ? 1 : 0;
    }

    if (problem.reviewCount === undefined) {
        problem.reviewCount = 0;
    }

    if (problem.acceptedCount === undefined) {
        problem.acceptedCount = 0;
    }

    if (problem.errorRate === undefined) {
        problem.errorRate = 0;
    }

    if (problem.lastReview === undefined) {
        problem.lastReview = null;
    }

    return problem;
});

localStorage.setItem(
    "problems",
    JSON.stringify(problems)
);

    let currentFilter = "All";

    let currentRatingFilter = "All";

    let currentTagFilter = "All";

    let currentSearch = "";

// ==============================
// 2. 保存数据
// ==============================

function saveProblems() {

    localStorage.setItem(
        "problems",
        JSON.stringify(problems)
    );

}


// ==============================
// 3. 更新统计数据
// ==============================

function updateStats() {

    const total = problems.length;

    const solved = problems.filter(
        problem => problem.status === "Solved"
    ).length;

    const wrong = problems.filter(
        problem => problem.status === "Wrong"
    ).length;

    const solveRate =
        total === 0
            ? 0
            : Math.round(solved / total * 100);

    document.getElementById("totalProblems").textContent = total;

    document.getElementById("solvedProblems").textContent = solved;

    document.getElementById("wrongProblems").textContent = wrong;

    document.getElementById("solveRate").textContent =
        solveRate + "%";
}


// ==============================
// 4. 显示题目
// ==============================

function renderProblems() {

    const problemList =
        document.getElementById("problemList");


    problemList.innerHTML = "";


const filteredProblems = problems.filter(problem => {

    // 状态筛选
    if (
        currentFilter !== "All" &&
        problem.status !== currentFilter
    ) {
        return false;
    }

    // Rating 筛选
    if (
        currentRatingFilter !== "All" &&
        currentRatingFilter !== "1600" &&
        problem.rating !== Number(currentRatingFilter)
    ) {
        return false;
    }

    // 1600+
    if (
        currentRatingFilter === "1600" &&
        problem.rating < 1600
    ) {
        return false;
    }

    // Tag 筛选
    if (
        currentTagFilter !== "All" &&
        !problem.tags.includes(currentTagFilter)
    ) {
        return false;
    }

    // 搜索筛选
    if (
        currentSearch !== "" &&
        !problem.name.toLowerCase().includes(currentSearch.toLowerCase())
    ) {
        return false;
    }

    return true;
});

    filteredProblems.forEach(problem => {

        const div =
            document.createElement("div");


        div.className = "problem";


div.innerHTML = `
    <div class="problem-info">
        <strong>${problem.name}</strong>
        <span>Rating ${problem.rating}</span>

        <div class="tags">
            ${problem.tags.map(tag => `
                <span class="category">
                    ${tag}
                </span>
            `).join("")}
        </div>
    </div>

    <button 
        class="${
            problem.status === "Solved"
            ? "solved"
            : "wrong"
        }"
        onclick="toggleProblemStatus(${problem.id})"
    >
        ${problem.status}
    </button>

    <button class="delete-btn" onclick="deleteProblem(${problem.id})">
        删除
    </button>
`;


        problemList.appendChild(div);

    });

}


// ==============================
// 5. 显示算法分类
// ==============================

function renderCategories() {

    const categoryList =
        document.getElementById("categoryList");


    const categories = {};


    problems.forEach(problem => {

        problem.tags.forEach(tag => {

            if (!categories[tag]) {

                categories[tag] = 0;

            }

            categories[tag]++;

        });

    });


    categoryList.innerHTML = "";


    for (const tag in categories) {

        const div =
            document.createElement("div");


        div.className = "category-item";


        div.innerHTML = `

            <span>
                ${tag}
            </span>

            <strong>
                ${categories[tag]} 题
            </strong>

        `;


        categoryList.appendChild(div);

    }

}

function renderTagFilters() {
    const tagFilter = document.getElementById("tagFilter");

    const tags = new Set();

    problems.forEach(problem => {
        problem.tags.forEach(tag => {
            tags.add(tag);
        });
    });

    tagFilter.innerHTML = `
        <button onclick="setTagFilter('All')">
            全部
        </button>
    `;

    tags.forEach(tag => {
        const button = document.createElement("button");

        button.textContent = tag;

        button.onclick = function() {
            setTagFilter(tag);
        };

        tagFilter.appendChild(button);
    });
}

// ==============================
// 6. 添加题目
// ==============================

const problemForm =
    document.getElementById("problemForm");


problemForm.addEventListener(
    "submit",
    function(event) {

        // 防止网页刷新
        event.preventDefault();


        // 获取输入框内容

        const name =
            document.getElementById(
                "problemName"
            ).value;


        const rating =
            Number(
                document.getElementById(
                    "problemRating"
                ).value
            );


        const tags =
            document.getElementById(
                "problemTags"
            ).value
            .split(",")
            .map(tag => tag.trim())
            .filter(tag => tag !== "");


        const status =
            document.getElementById(
                "problemStatus"
            ).value;


        // 创建一个新的题目对象

        const newProblem = {
            id: Date.now(),
            name: name,
            rating: rating,
            tags: tags,
            status: status,
            wrongCount: status === "Wrong" ? 1 : 0,
            reviewCount: 0,
            lastReview: null
        };


        // 加入数组

        problems.push(newProblem);

        // 保存到浏览器

        saveProblems();


        // 更新页面

        updateStats();

        renderProblems();

        renderCategories();

        renderRatingStats();

        renderWeakTags();

        renderWrongProblems();

        renderRatingAnalysis();

        renderTrainingFocus();

        // 清空表单

        problemForm.reset();

    }
);

// ==============================
// 7. 删除题目
// ==============================

function deleteProblem(id) {
    problems = problems.filter(problem => problem.id !== id);

    saveProblems();
    updateStats();
    renderProblems();
    renderCategories();
    renderRatingStats();
    renderWeakTags();
    renderWrongProblems();
    renderRatingAnalysis();
    renderTrainingFocus();
}
function toggleProblemStatus(id) {
    const problem = problems.find(problem => problem.id === id);

    if (problem.status === "Solved") {

    problem.status = "Wrong";
    problem.wrongCount++;

    } else {

        problem.status = "Solved";
    }

    saveProblems();
    updateStats();
    renderProblems();
    renderRatingStats();
    renderWeakTags();
    renderWrongProblems();
    renderRatingAnalysis();
    renderTrainingFocus();
}

// ==============================
// 8. 筛选函数
// ==============================

function setFilter(filter) {
    currentFilter = filter;

    renderProblems();
}

function setRatingFilter(rating) {
    currentRatingFilter = rating;

    renderProblems();
}

function setTagFilter(tag) {
    currentTagFilter = tag;

    renderProblems();
}

function setSearch(search) {
    currentSearch = search.trim();

    renderProblems();
}

function renderRatingStats() {

    const ratingStats =
        document.getElementById("ratingStats");

    const ratings = {};

    problems.forEach(problem => {

        if (!ratings[problem.rating]) {
            ratings[problem.rating] = 0;
        }

        ratings[problem.rating]++;
    });

    ratingStats.innerHTML = "";

    const sortedRatings =
        Object.keys(ratings).sort(
            (a, b) => Number(a) - Number(b)
        );

    sortedRatings.forEach(rating => {

        const div = document.createElement("div");

        div.className = "rating-item";

        div.innerHTML = `
            <span>Rating ${rating}</span>
            <strong>${ratings[rating]} 题</strong>
        `;

        ratingStats.appendChild(div);
    });
}

function renderWeakTags() {

    const weakTags =
        document.getElementById("weakTags");

    const tagStats = {};

    problems.forEach(problem => {

        problem.tags.forEach(tag => {

            if (!tagStats[tag]) {
                tagStats[tag] = {
                    total: 0,
                    wrong: 0
                };
            }

            tagStats[tag].total++;

            if (problem.status === "Wrong") {
                tagStats[tag].wrong++;
            }
        });
    });

    weakTags.innerHTML = "";

    const sortedTags =
        Object.entries(tagStats).sort(
            (a, b) => {

                const rateA =
                    a[1].wrong / a[1].total;

                const rateB =
                    b[1].wrong / b[1].total;

                return rateB - rateA;
            }
        );

    sortedTags.forEach(([tag, data]) => {

        const div = document.createElement("div");

        div.className = "weak-tag-item";

        const wrongRate =
            Math.round(
                data.wrong / data.total * 100
            );

        div.innerHTML = `
            <span>${tag}</span>

            <span>
                ${data.wrong} 错 / ${data.total} 题
                （${wrongRate}%）
            </span>
        `;

        weakTags.appendChild(div);
    });
}

function renderRatingAnalysis() {

    const ratingAnalysis =
        document.getElementById("ratingAnalysis");

    const ratingStats = {};

    problems.forEach(problem => {

        if (!ratingStats[problem.rating]) {
            ratingStats[problem.rating] = {
                total: 0,
                solved: 0,
                wrong: 0
            };
        }

        ratingStats[problem.rating].total++;

        if (problem.status === "Solved") {
            ratingStats[problem.rating].solved++;
        }

        if (problem.status === "Wrong") {
            ratingStats[problem.rating].wrong++;
        }
    });

    ratingAnalysis.innerHTML = "";

    const sortedRatings =
        Object.keys(ratingStats).sort(
            (a, b) => Number(a) - Number(b)
        );

    sortedRatings.forEach(rating => {

        const data = ratingStats[rating];

        const wrongRate =
            Math.round(
                data.wrong / data.total * 100
            );

        let advice = "比较稳定";

        if (wrongRate >= 60) {
            advice = "重点训练";
        } else if (wrongRate >= 30) {
            advice = "建议加强";
        }

        const div = document.createElement("div");

        div.className = "rating-analysis-item";

        div.innerHTML = `
            <div>
                <strong>Rating ${rating}</strong>
                <span>
                    ${data.solved} 解 / ${data.total} 题
                </span>
            </div>

            <div>
                <span>
                    错题率 ${wrongRate}%
                </span>

                <strong>
                    ${advice}
                </strong>
            </div>
        `;

        ratingAnalysis.appendChild(div);
    });
}

function renderTrainingFocus() {

    const trainingFocus =
        document.getElementById("trainingFocus");

    if (problems.length === 0) {
        trainingFocus.innerHTML = `
            <p>还没有刷题数据，先开始刷题吧！</p>
        `;
        return;
    }

    // =========================
    // 统计 Rating
    // =========================

    const ratingStats = {};

    problems.forEach(problem => {

        if (!ratingStats[problem.rating]) {
            ratingStats[problem.rating] = {
                total: 0,
                wrong: 0
            };
        }

        ratingStats[problem.rating].total++;

        if (problem.status === "Wrong") {
            ratingStats[problem.rating].wrong++;
        }
    });

    // 找出错题率最高的 Rating
    let worstRating = null;
    let worstRatingScore = -1;

    for (const rating in ratingStats) {

        const data = ratingStats[rating];

        // 至少做过 3 道题，才进入训练重点判断
        if (data.total < 3) {
            continue;
        }

        const wrongRate =
            data.wrong / data.total;

        // 错题数量 × 错题率
        const score =
            data.wrong * wrongRate;

        if (score > worstRatingScore) {
            worstRatingScore = score;
            worstRating = rating;
        }
    }

    // =========================
    // 统计 Tag
    // =========================

    const tagStats = {};

    problems.forEach(problem => {

        problem.tags.forEach(tag => {

            if (!tagStats[tag]) {
                tagStats[tag] = {
                    total: 0,
                    wrong: 0
                };
            }

            tagStats[tag].total++;

            if (problem.status === "Wrong") {
                tagStats[tag].wrong++;
            }
        });
    });

    // 找出错题率最高的 Tag
    let worstTag = null;
    let worstTagScore = -1;

    for (const tag in tagStats) {

        const data = tagStats[tag];

        // 至少做过 3 道题
        if (data.total < 3) {
            continue;
        }

        const wrongRate =
            data.wrong / data.total;

        const score =
            data.wrong * wrongRate;

        if (score > worstTagScore) {
            worstTagScore = score;
            worstTag = tag;
        }
    }

    // =========================
    // 显示训练建议
    // =========================

    trainingFocus.innerHTML = `
        <div class="focus-item">
            <strong>Rating 重点</strong>
            <span>Rating ${worstRating}</span>
        </div>

        <div class="focus-item">
            <strong>Tag 重点</strong>
            <span>${worstTag}</span>
        </div>

        <p class="focus-reason">
            你的 ${worstRating} Rating 题目错题率较高，
            ${worstTag} 也是目前错误率较高的 Tag。
            建议优先针对这两个方向进行训练。
        </p>
    `;
}

function renderWrongProblems() {

    const wrongProblemList =
        document.getElementById("wrongProblemList");

    wrongProblemList.innerHTML = "";

    const wrongProblems =
        problems.filter(
            problem =>
                problem.status === "Wrong" ||
                problem.wrongCount > 0
        );

    wrongProblems.forEach(problem => {

        const div = document.createElement("div");

        div.className = "problem";

        div.innerHTML = `
            <div class="problem-info">
                <strong>${problem.name}</strong>

                <span>Rating ${problem.rating}</span>

                <div class="tags">
                    ${problem.tags.map(tag => `
                        <span class="category">
                            ${tag}
                        </span>
                    `).join("")}
                </div>

                <span>
                    错误次数：${problem.wrongCount}
                </span>

                <span>
                    AC 次数：${problem.acceptedCount || 0}
                </span>
                
                <span>
                    错误率：${((problem.errorRate || 0) * 100).toFixed(1)}%
                </span>
                
                <span>
                    复习次数：${problem.reviewCount}
                </span>
            </div>

            <div>
                <button
                    class="review-btn"
                    onclick="reviewProblem(${problem.id})"
                >
                    再次复习
                </button>

                <button
                    class="solved"
                    onclick="toggleProblemStatus(${problem.id})"
                >
                    已解决
                </button>
            </div>
        `;

        wrongProblemList.appendChild(div);
    });
}

function reviewProblem(id) {

    const problem =
        problems.find(problem => problem.id === id);

    if (!problem) {
        return;
    }

    problem.reviewCount++;

    problem.lastReview =
        new Date().toLocaleDateString("zh-CN");

    saveProblems();

    renderWrongProblems();
}

// ==============================
// 9. 页面启动
// ==============================

updateStats();

renderProblems();

renderCategories();

renderTagFilters();

renderRatingStats();

renderWeakTags();

renderWrongProblems();

renderRatingAnalysis();

renderTrainingFocus();

async function syncCodeforcesUser() {

    const handle =
        document.getElementById("cfHandle").value.trim();

    localStorage.setItem("cfHandle", handle);

    const cfProfile =
        document.getElementById("cfProfile");

    if (handle === "") {
        cfProfile.innerHTML = `
            <p>请输入 Codeforces 用户名。</p>
        `;
        return;
    }

    cfProfile.innerHTML = `
        <p>正在同步 Codeforces 数据...</p>
    `;

    try {

        const response = await fetch(
            `https://codeforces.com/api/user.info?handles=${encodeURIComponent(handle)}`
        );

        const data = await response.json();

        if (data.status !== "OK") {
            throw new Error("用户不存在");
        }

        const user = data.result[0];

        const currentRating =
            document.getElementById("currentRating");

        currentRating.textContent =
            user.rating ?? "暂无";

            localStorage.setItem(
                "cfRating",
                user.rating ?? ""
            );

        cfProfile.innerHTML = `
            <div class="cf-user-info">

                <h3>${user.handle}</h3>

                <p>
                    Rating：
                    <strong>${user.rating ?? "暂无"}</strong>
                </p>

                <p>
                    Max Rating：
                    <strong>${user.maxRating ?? "暂无"}</strong>
                </p>

                <p>
                    Rank：
                    <strong>${user.rank ?? "暂无"}</strong>
                </p>

                <p>
                    Max Rank：
                    <strong>${user.maxRank ?? "暂无"}</strong>
                </p>

            </div>
        `;

    } catch (error) {

        cfProfile.innerHTML = `
            <p>
                获取失败：${error.message}
            </p>
        `;
    }
}

async function syncCodeforcesProblems() {

    console.log("===== syncCodeforcesProblems 开始执行 =====");

    const handle =
        document.getElementById("cfHandle").value.trim();

    if (handle === "") {
        console.log("请先输入 Codeforces 用户名");
        return;
    }

    console.log("正在获取提交记录……");

    try {

        const response = await fetch(
            `https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}&from=1&count=1000`
        );

        const data = await response.json();

        if (data.status !== "OK") {
            throw new Error("获取提交记录失败");
        }
        
        const wrongSubmissions =
            data.result.filter(
                submission => submission.verdict !== "OK"
            );

        console.log("===== 开始统计错误提交 =====");
        console.log("错误提交：");
        console.table(wrongSubmissions);

        console.log(
            "错误提交共有 " +
            wrongSubmissions.length +
            " 条"
        );

        const wrongProblemInfo = wrongSubmissions.map(
            submission => {

                const problem = submission.problem;

                return {
                    id: problem.contestId + problem.index,
                    name: problem.name,
                    verdict: submission.verdict
                };
            }
        );

        console.log("错误提交对应的题目：");
        console.table(wrongProblemInfo);

        const wrongCountMap = {};

        wrongProblemInfo.forEach(problem => {

            if (wrongCountMap[problem.id] === undefined) {
                wrongCountMap[problem.id] = 1;
            } else {
                wrongCountMap[problem.id]++;
            }

        });

        console.log("每道题的错误次数：");
        console.log(wrongCountMap);

        problems.forEach(problem => {

            if (wrongCountMap[problem.id] !== undefined) {
                problem.wrongCount =
                    wrongCountMap[problem.id];
            }

        });

        saveProblems();

        console.log("已更新本地题库的错误次数：");
        console.log(problems);
        
        const acceptedProblems =
            data.result.filter(
                submission => submission.verdict === "OK"
            );

            const attemptedProblems =
                data.result.filter(
                    submission =>
                        submission.problem &&
                        submission.problem.contestId &&
                        submission.problem.index
                );

            console.log("所有做过的题：");
            console.log(attemptedProblems);

            const attemptedProblemMap = {};

            attemptedProblems.forEach(submission => {

                const problem = submission.problem;

                const id =
                    problem.contestId + problem.index;

                if (attemptedProblemMap[id] === undefined) {
                    attemptedProblemMap[id] = problem;
                }

            });

            console.log("所有做过的不同题目：");
            console.log(attemptedProblemMap);

            const acceptedCountMap = {};

            acceptedProblems.forEach(submission => {

                const problem = submission.problem;

                const id =
                    problem.contestId + problem.index;

                if (acceptedCountMap[id] === undefined) {
                    acceptedCountMap[id] = 1;
                } else {
                    acceptedCountMap[id]++;
                }

            });

            console.log("每道题的 AC 次数：");
            console.log(acceptedCountMap);
            
            const convertedAttemptedProblems =
                Object.values(attemptedProblemMap).map(problem => {

                    const id =
                        problem.contestId + problem.index;

                    const wrong =
                        wrongCountMap[id] || 0;

                    const accepted =
                        acceptedCountMap[id] || 0;

                    const totalAttempts =
                        wrong + accepted;

                    const errorRate =
                        totalAttempts > 0
                            ? wrong / totalAttempts
                            : 0;

                    return {
                        id: id,

                        name:
                            "CF " +
                            problem.contestId +
                            problem.index +
                            " " +
                            problem.name,

                        rating: problem.rating || 0,

                        tags: problem.tags || [],

                        status:
                            accepted > 0
                                ? "Solved"
                                : "Wrong",

                        wrongCount: wrong,

                        acceptedCount: accepted,

                        errorRate: errorRate,

                        reviewCount: 0,

                        lastReview: null
                    };
                });

            console.log("转换后的所有做过的题目：");
            console.log(convertedAttemptedProblems);

            problems.forEach(problem => {

                if (acceptedCountMap[problem.id] !== undefined) {
                    problem.acceptedCount =
                        acceptedCountMap[problem.id];
                }

            });

            saveProblems();

            console.log("已更新本地题库的 AC 次数：");
            console.log(problems);

            problems.forEach(problem => {

                const wrong =
                    problem.wrongCount || 0;

                const accepted =
                    problem.acceptedCount || 0;

                const totalAttempts =
                    wrong + accepted;

                if (totalAttempts > 0) {
                    problem.errorRate =
                        wrong / totalAttempts;
                } else {
                    problem.errorRate = 0;
                }

            });

            saveProblems();

            console.log("已计算题目错误率：");
            console.log(problems);

        console.log("AC 题目：");
        console.log(acceptedProblems);

        const convertedProblems = acceptedProblems.map(
            submission => {

                const problem = submission.problem;

                const id =
                    problem.contestId + problem.index;

                const wrong =
                    wrongCountMap[id] || 0;

                const accepted =
                    acceptedCountMap[id] || 0;

                const totalAttempts =
                    wrong + accepted;

                const errorRate =
                    totalAttempts > 0
                        ? wrong / totalAttempts
                        : 0;

                return {
                    id: id,

                    name:
                        "CF " +
                        problem.contestId +
                        problem.index +
                        " " +
                        problem.name,

                    rating: problem.rating || 0,

                    tags: problem.tags || [],

                    status: "Solved",

                    wrongCount: wrong,

                    acceptedCount: accepted,

                    errorRate: errorRate,

                    reviewCount: 0,

                    lastReview: null
                };
            }
        );

        console.log("批量转换后的题目：");
        console.log(convertedProblems);

        const uniqueAcceptedProblems = [];

        convertedProblems.forEach(problem => {

            const exists = uniqueAcceptedProblems.some(
                item => item.id === problem.id
            );

            if (!exists) {
                uniqueAcceptedProblems.push(problem);
            }
        });

        console.log("去重后的 AC 题目：");
        console.log(uniqueAcceptedProblems);
        console.log(
            "去重后共有 " +
            uniqueAcceptedProblems.length +
            " 道不同的 AC 题目"
        ); 
        


        const addedProblems = convertedAttemptedProblems;

        // 当前 CF 用户建立自己的独立题库
        problems = convertedAttemptedProblems;

        // 保存到当前 CF ID 对应的题库
        cfProblems[currentHandle] = problems;

        localStorage.setItem(
            "cfProblems",
            JSON.stringify(cfProblems)
        );

        // 同时保存当前题库
        saveProblems();

        console.log("本次新增题目：");
        console.log(addedProblems);

        console.log(
            "本次新增了 " +
            addedProblems.length +
            " 道题"
        );

        updateStats();
        renderProblems();
        renderCategories();
        renderTagFilters();
        renderRatingStats();
        renderWeakTags();
        renderWrongProblems();
        renderRatingAnalysis();
        renderTrainingFocus();

    } catch (error) {

        console.error("错误：", error);

    }
}