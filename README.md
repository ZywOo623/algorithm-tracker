# Algorithm Tracker

把一道做错的算法题，变成几天后能独立重做的题：**记下思路和错因 → 安排重做 → 区分独立完成与看提示后完成**。

**[打开在线版](https://zywoo623.github.io/algorithm-tracker/)** · [查看代码](https://github.com/ZywOo623/algorithm-tracker)

## 30 秒上手

1. 打开在线版，输入 Codeforces 用户名并同步提交；没有账号也能在“手动添加题目”里加一道待攻克的题。
2. 在“错题中心 · 安排重做”展开题目，写下当时的思路、错误原因和下次重做日期，保存计划。
3. 到日期后自己重新做题，记录“独立完成”“看提示后完成”或“仍未做出”。后两种结果会自动安排下一次重做。

当前界面中的错题会优先显示“该重做了”的题目，并展示最近一次重做结果。浏览器不会主动发送提醒；再次打开页面时可查看到期情况。

题目、复盘内容与重做历史保存在当前浏览器的 `localStorage`。换浏览器或清理站点数据不会自动恢复。AI 功能是可选的：点击“AI 优化提问”会生成可复制给其他 AI 的提示词；点击“AI 分析”会直接分析可能的错因。两项操作都会把选中题目的记录与本次填写内容发送到配置的 Cloudflare Worker，共用每日请求额度。

## 已实现

- 同步 Codeforces 用户资料及最近 **1000 条提交**，按题目合并 AC 和错误次数。
- 按账号分别保存记录；再次同步保留本地思路、错因、重做计划、重做历史和手动状态。
- 查看最近 50 道不同题目的标签统计。只对样本至少 3 题且存在未解决题目的标签生成训练重点。
- 从 Codeforces 题库筛选匹配标签和 Rating、且当前记录中未做过的 5 道题。
- 手动添加题目、筛选和搜索；为错题记录思路与错因、安排重做，并区分独立完成与看提示后完成。
- 在错题选择框选“其他题目”后，可填写未同步的题名和描述，无需先加入题目记录。
- 从已记录题目或自定义题目调用 Cloudflare Workers AI 优化提问，生成可复制给其他 AI 的提示词；也可以直接分析思路和代码中的错误。两种操作由用户分别触发，都会结合本地记录与本次填写的题面、代码和思路，并共用每日额度。
- Worker 使用免费计划可用的 `@cf/zai-org/glm-4.7-flash`，有服务端访问口令和默认每天 20 次的全站上限；提问优化和错题分析都会计入次数，每次响应也有输出长度限制。
- 首次打开新版时读取旧版 `cfProblems`、`problems`、`cfHandle`、`cfRating` 数据，并存为 `algorithmTracker.v2`。旧数据键不会被删除。

## 统计口径

- “题目解决率” = 当前题库已解决题目数 / 当前题库题目数。
- “未解决占比” = 最近 50 道不同题目中，某标签下仍标为待攻克的题目数 / 该标签题目数。它不是提交错误率。
- 旧版数据没有提交时间时，会排在有时间记录的题目之后；这部分无法严格还原“最近”顺序。
- “错误提交”与“AC”来自最近 1000 条提交的同步窗口；更早的提交不在本次 API 结果中。之前同步过、但已超出窗口的题目会保留在本地。
- “已掌握/待攻克”是本地学习状态；可与 Codeforces 的 AC 状态不同。手动修改后再次同步仍保留。
- 推荐题只排除当前账号题库中的已记录题目，无法保证 Codeforces 历史上从未做过。

## 文件

| 文件 | 用途 |
| --- | --- |
| `index.html` | 页面结构 |
| `style.css` | 页面样式 |
| `core.js` | 数据迁移、提交合并、薄弱点与推荐逻辑 |
| `script.js` | 浏览器交互与 Codeforces API |
| `ai-config.js` | AI Worker 的公开地址；不得填写密钥 |
| `worker/ai.js`、`worker/quota.mjs`、`wrangler.toml` | AI 分析服务与服务端每日次数限制 |
| `assets/avatar-cat-ears-web.png` | 用户选择的猫耳头像网页压缩版；用于页面头像和标签页图标 |
| `assets/training-mark.svg` | 独立的训练图表标记 |
| `tests/core.test.js` | 核心逻辑验证 |

当前界面以[在线版](https://zywoo623.github.io/algorithm-tracker/)为准；仓库暂未放入新版截图。截图会在真实使用案例核对后补上，避免把示例数据当成使用成果。

运行验证：`node --test tests/*.test.js`。

## 启用免费 AI 分析

需要一个 Cloudflare 免费账号。GitHub Pages 无法保管模型权限，因此 AI 分析在独立 Worker 中运行；网页中**不要填写或保存任何模型厂商 API Key**。

1. 在 Cloudflare 控制台进入 **Workers & Pages → Create application → Import a repository**，连接 GitHub 仓库 `ZywOo623/algorithm-tracker`，选择 `main` 分支并部署。项目根目录已有 `wrangler.toml`，Worker 名称为 `algorithm-tracker-ai`，默认部署命令为 `npx wrangler deploy`。`wrangler.toml` 已配置 Workers AI 和 SQLite Durable Object。
2. 部署后进入该 Worker 的 **Settings → Variables and Secrets → Add**，新增类型为 **Secret**、名称为 `ACCESS_CODE` 的长随机访问口令，再点击 **Deploy**。该值只存于 Cloudflare，不写进仓库。网页上使用 AI 时，输入的是这个**访问口令**，不是 API Key。
3. 本项目的 Worker 地址是 `https://algorithm-tracker-ai.2804684803.workers.dev/analyze`，已填入 `ai-config.js` 并发布到网页。该地址是公开接口地址，不含口令。
4. 在 Cloudflare 控制台确认仍处于 Workers Free 计划。若以后升级为付费计划，请同时设置平台预算提醒；当前 `DAILY_REQUEST_LIMIT = "20"` 是独立于平台免费用量的每日请求数限制，按 UTC 日期重置，可在 `wrangler.toml` 调整。请求失败也会占用一次，以避免重复请求绕过限额。

也可以用命令行完成前两步：`npx wrangler login` → `npx wrangler deploy` → `npx wrangler secret put ACCESS_CODE`。

网页不会持久保存访问口令；刷新页面后需要重填。口令若泄露，在 Cloudflare 中更新 `ACCESS_CODE`。公开网页的来源检查不能替代口令，后端必须保留口令校验。

Cloudflare 的免费额度、模型列表和政策可能调整，部署前请核对其 [Workers AI 定价](https://developers.cloudflare.com/workers-ai/platform/pricing/)与[模型目录](https://developers.cloudflare.com/workers-ai/models/)。

## 下一阶段路线

1. **真实使用验证**：自己连续使用一周，再请 3 位同学试用；记录他们能否完成一次复盘、下周是否回来重做、哪里卡住。补真实新版截图与一个可核对的复盘案例。
2. **训练闭环完善**：根据真实反馈增加错因标签、每周完成情况和复习提醒；比较训练前后的解决率变化。
3. **AI 错题助手完善**：用已知答案的真实题目验证输出，再增加分析结果保存、追问和质量反馈。模型输出需结合题目与提交结果核对。
4. **作品与经历**：发布项目和技术文档；以实际贡献、真实竞赛成绩和实际申报结果更新简历。开源贡献、导师课题和大创申请是独立的后续行动，不能提前写成已完成经历。

项目对应的升学/竞赛方向，是持续积累可验证的训练成果和工程过程。计划目标（如 CF Rating、比赛奖项）只是目标，只有取得后才能写为成绩。

## 作者与初衷

由 [ZywOo623](https://github.com/ZywOo623) 开始开发，用实际项目整理个人算法训练数据。项目会随真实训练和使用反馈继续迭代。

