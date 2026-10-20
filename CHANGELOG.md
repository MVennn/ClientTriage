# 更新日志

> **一句话**：本仓的开发者记录 —— 每个版本改了什么、为什么、怎么验；
> 顶部的版本命名规则是**摘要**，**正本见 [docs/VERSIONING.md](docs/VERSIONING.md) §1–§2**。

版本号形如 `vX.Y.Z`。**版本命名规则（摘要，正本见 VERSIONING.md）**：

| 这次发布包含…… | 动哪位 | 写法 | 例子 |
|---|---|---|---|
| **有功能更新** —— 新增工具 / 新增文档章节 / 现有工具的行为变了 | **次版本 +0.1.0**，补丁归零 | `vX.Y.Z` → `vX.Y+1.0` | `v0.1.0` → `v0.2.0` |
| **没有功能更新** —— 只修 bug、只补文档、只改措辞 | **补丁版本 +0.0.1** | `vX.Y.Z` → `vX.Y.Z+1` | `v0.1.0` → `v0.1.1` |
| 重大重构、不兼容变更（工具的入参 / 输出格式变了、目录结构变了） | **主版本 +1.0.0**，后两段归零 | `vX.Y.Z` → `vX+1.0.0` | `v0.9.3` → `v1.0.0` |

判断口诀：**「文件清单里是不是多了一个以前没有的东西？」** 是 → `+0.1.0`；否 → `+0.0.1`。
只改文档措辞、只补错别字 → 补丁版本。删掉一个工具或一篇文档 → 按「有功能更新」处理。

> 仓库尚无 `docs/VERSIONING.md`；将来建了，把规则搬过去并把本段改成一句指向它的链接。

---

## [未发布] — 2026-10-20

**本仓是首次建仓** —— 从 `F:\Project\Openwrt` 拆出。拆分前它是一个把
「AX3000T 路由器运维 / ShellCrash 分流 / 现代控制台 / AI 模型接入 / PC 客户端排障」
五个互不相关的逻辑任务混在同一个物理目录下的工作区；本次把其中**第 ⑤ 个逻辑任务
（PC 客户端经代理访问境外服务的排障）**独立成一个可单独上传 GitLab 的仓库。

本段只记录**建仓动作**与**建仓时就已经知道的欠账**，不重复既有诊断结论
（结论见 [docs/CHROME-GOOGLE-诊断.md](docs/CHROME-GOOGLE-诊断.md) 与 `evidence/agents/`）。

### 调整

- 调整 仓库 —— 新建 `F:\Project\ClientTriage\`，作为 5 个拆分目标之一独立成仓；本仓只保留客户端侧的定位与取证能力
- 调整 边界 —— 明确职责切分：本仓只做客户端侧定位与取证；路由器的 fake-IP 段 / nft 表 / 策略组 / 节点选择归 `AX3000TOpenwrt` 与 `ShellcrashRules` 两个仓
- 调整 工具 —— `tools/clear-chrome-region.js`（清 Chrome 地区种子）从原 `tools/` 迁入
- 调整 工具 —— `tools/verify-gemini.sh`（Gemini 复测编排）从原 `tools/` 迁入
- 调整 工具 —— `tools/cdp.js` 从原 `audit/cdp.js` 迁入 `tools/`，定位从「一次性审计产物」提升为「长期工具」
- 调整 文档 —— `CHROME-GOOGLE-诊断-20261019.md` 更名 `docs/CHROME-GOOGLE-诊断.md` 并迁入 `docs/`
- 调整 证据 —— 9 份子代理只读审计分片迁入 `evidence/agents/`：`agent-browser-client` / `agent-clean-exit-strategy` / `agent-google-others` / `agent-ip-reputation` / `agent-openai` / `agent-pc-side` / `agent-social-media` / `agent-streaming-dev` / `agent-youtube`
- 调整 证据 —— `gemini-after.png`、`shot-cf-fresh.png` 迁入 `evidence/`；大截图按 `.gitignore` 排除，只本地留存
- 调整 进度 —— 建立本仓根 `PROGRESS.md` 作为唯一进度台账（追加式），承接拆分前原根 `PROGRESS.md` 里与客户端排障相关的批次
- 调整 文档 —— 新增根 `README.md`：门面 —— 这是什么 / 适用环境 / 快速开始 / 目录结构 / 文件清单 / 已知坑 / 免责声明 / 开源鸣谢 / 许可证
- 调整 文档 —— 新增根 `AGENTS.md`：机器协议 —— PROGRESS 路径由逻辑任务决定、子代理只写 `evidence/agents/agent-<name>.md` 分片、客户端与路由器的边界、CodeGraph 跳过条件
- 调整 文档 —— 新增 `docs/README.md`：docs 唯一索引，四类分区、两列表格、标注正本归属
- 调整 文档 —— 新增 `docs/DOC-RULES.md`：文档规则正本（分类与定位 / 单一正本 / 红线内容保护 / 链接纪律 / 变更触发矩阵 / 体量预算 / 索引维护与孤儿零容忍）
- 调整 文档 —— 新增 `docs/LNA-FAKE-IP.md`：Chrome 155 LNA 与 mihomo fake-IP 冲突的长期正本 —— 机制、证据、解法，以及「外壳能打开 ≠ 修好了」的判据
- 调整 文档 —— 新增 `docs/PITFALLS.md`：踩坑总汇（改种子被覆盖 / CDP 端口占用 / headless 截图与真实浏览器差异 / 判 302 要用 GET / API 必须走路由器代理 / 出口 IP 地理标签不可信 / 节点健康探测要用大页面）
- 调整 文档 —— 新增 `docs/TROUBLESHOOTING.md`：按现象检索的排错手册，每节给可执行命令与「客户端问题还是路由器问题」的判据
- 调整 文档 —— 新增 `docs/MAINTENANCE.md`：维护流程 —— 地区种子要能重复执行、截图与日志的保留期限、证据文件命名、工具脚本副作用必须在 README 显著位置声明
- 调整 文档 —— 新增 `docs/release-notes/README.md`：Release 说明格式正本
- 调整 文档 —— 新增 `docs/release-notes/v0.1.0.md`：首版 Release 说明
- 调整 文档 —— 新增根 `CHANGELOG.md`（本文件）、`NOTICE`、`.gitignore`

### 待补

以下欠账**建仓时已知但未做**，逐条写明缺什么：

- **`tools/verify-gemini.sh` 的兄弟仓依赖** —— 脚本用 `../../AX3000TOpenwrt/recovery/local-tools/askpass.sh`
  与 `../../AX3000TOpenwrt/recovery/archive/verify-fix.sh` 找兄弟仓的文件，
  本仓的 `tools/cdp.js` 与截图输出已经是仓内相对路径。
  **缺的是**一份「三个仓必须同级摆放」的说明 —— 已在根 README 的「已知坑」第 4 条写清，
  并给出 `ASKPASS` / `VERIFY_FIX` 环境变量覆盖方式。
- **`tools/clear-chrome-region.js` 的 Chrome profile 路径硬编码** —— 写死 `C:/Users/SansK/AppData/Local/Google/Chrome/User Data`。
  **缺的是**「改成从环境变量 / 参数读取」的改动本身（本次不改既有脚本）；待改时按脚本约定补一行参数说明。
- **`docs/CHROME-GOOGLE-诊断.md` 的过期声明** —— 该文写于 2026-10-19，结论是「方案 A/C/D 已落地并端到端验证」；
  2026-10-20 晚发现**同一 LNA 机制仍导致 Gemini「只剩输入框」**，最终修法是
  `fake_ip_filter` 补 `+.gstatic.com` / `+.googleapis.com`。
  **缺的是**在那篇文档头部加一行「本文结论已被 `docs/LNA-FAKE-IP.md` 修正」的声明 ——
  本次不改既有文件，改为在 [docs/README.md](docs/README.md) 索引里标注该状态。
- **`LICENSE` 文件待定** —— 本仓尚未选定开源许可证，在落地前默认保留全部权利（见 README「许可证」段）。
- **Play 更新转圈的客户端侧复测** —— 现有证据只有 2026-10-19 的路由器侧记录
  （`quicguard` 拦截 fake-IP 段 UDP 443/8443 + Play CDN 按目标 IP 分流）；
  **缺的是**一次 PC 端侧的端到端复测与留证。
- **`docs/archive/` 为空** —— 一次性归档目录已建但暂无内容；不是孤儿文档，故不在索引里列条目。

状态：已完成（首版建仓）
