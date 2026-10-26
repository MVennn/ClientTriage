# 更新日志

> **一句话**：本仓的开发者记录 —— 每个版本改了什么、为什么、怎么验；
> 版本段标题是**版本号的唯一正本**，进位规则**正本见 [docs/VERSIONING.md](docs/VERSIONING.md)**。

版本标题形如 `## [0.1.0] — <日期>`（**版本号本身，不带 `v`**；发版 tag 才带 `v`，如 `v0.1.0`）。
进位规则一句话：**有功能更新进次版本（+0.1.0），没有就进补丁版本（+0.0.1）** ——
判据与边界见 [docs/VERSIONING.md](docs/VERSIONING.md)。

---

## [0.2.1] — 2026-10-26

### 全仓审查修复（2026-10-26）

- 修复 `tools/verify-gemini.sh` —— `die` 只切回热点、不杀已启动的临时 Chrome，
  残留实例继续占着 CDP 端口；下次复测的 `/json/version` 打在旧实例上直接「就绪」，
  抓到的全是过期状态。`die` 现在按 `verify-prof|verify-shot` 清理临时实例，
  启动前也先清残留并检查端口占用；超时提示从「40 秒」改为实际约 100 秒（PITFALLS 17）
- 修复 `tools/cdp.js` —— `send()` 没有超时、也不监听 `close`，调试口断开后脚本永久挂起；
  每条请求加 20 秒超时，`close`/`error` 时 reject 所有挂起请求；启动时检测
  Node 22+ 的全局 `WebSocket`（PITFALLS 18）
- 修复 `tools/check-secrets.py` —— `git ls-files` 失败时按 0 文件「通过」；
  改为报错退出
- 修复 `tools/clear-chrome-region.js` —— 非 Windows 上 `tasklist` 的 ENOENT 变成
  未捕获异常；改为提示「仅支持 Windows」退出。写入前再查一次 Chrome，
  缩小「检查后用户又启动 Chrome」的窗口
- 文档 —— README 运行时要求从 Node 18+ 改为 22+（全局 `WebSocket` 的实际要求）
- 验证 —— `node --check` ✓、`python -m py_compile` ✓、`sh -n` ✓；
  未做真机复测（需要 Chrome + 路由器 WiFi）

### 文档正本与守卫规则（2026-10-24）

- 新增 `docs/DOC-RULES.md` 变更触发矩阵一条 —— **修一个缺陷必须给对应正本补一条**
  （只改代码不改正本，下次还会踩同一个坑）
- 新增 `docs/PITFALLS.md` 14–16 三条 —— 失败传播（关键步骤失败即退出）、
  用户数据前置检查（清地区种子前先确认 Chrome 没在跑）、占位符
- 新增 `docs/SECRETS.md`「推送前脱敏规则」通用章节 —— 凭据 / 本机用户目录 / 真实邮箱
  三类拦截面与三条放行口径；`tools/check-secrets.py` 相应加占位用户名放行
- 新增 `tools/check-secrets.py` —— 敏感信息守卫，并接入 `.github/workflows/ci.yml`

### 复测脚本失败传播（2026-10-24）

- 修复 `tools/verify-gemini.sh` —— SSH 推路由器侧检查、起 Chrome、截图三步失败都只打印
  不退出，最后照样打印「结束」，用户会把「路由器侧没修 + 截图没生成」误读成「复测通过」。
  现在五个关键点失败即 `die`（找不到 Chrome / 检查脚本缺失 / SSH 失败 / CDP 40 秒未就绪 /
  截图 0 字节），失败时保留临时 profile 并打印路径
- 修复 `tools/verify-gemini.sh` —— 临时 profile 与截图目录带 PID，两个并发会话不再互相
  `rm -rf`；截图按时间戳命名并同步一份 `gemini-after.png`，不再覆盖上一轮证据
- 验证 —— `bash -n` ✓；未设置 SSID 时占位符守卫 exit 2 且不碰网络

## [0.2.0] — 2026-10-23

面向用户的说明见 [docs/release-notes/0.2.0.md](docs/release-notes/0.2.0.md)。

### 工具前置检查（2026-10-23）

- 修复 `tools/clear-chrome-region.js` —— 文件头第 2 行要求「必须在 Chrome 完全
  退出时运行」，代码却从不检查。Chrome 开着时改动会在退出时被整体写回，
  等于白改（还白留一份完整配置备份）。现在检测到 `chrome.exe` 直接退出并提示
  从托盘完全退出
- 修复 `tools/check-secrets.py` —— 占位符整行短路改为只豁免匹配片段
- 验证 —— `node --check` ✓、`sh -n` ✓、`check-docs.py` ✓（19 篇）、
  `check-secrets.py` ✓（58 个文件）


### 文档骨架对齐 GSAuxiliary（2026-10-22）

按基准仓 `docs/DOC-RULES.md` / `docs/README.md` / `docs/VERSIONING.md` / `docs/release-notes/README.md` 的口径同步本仓文档骨架。**只改文档，未动代码 / 脚本 / CI 逻辑。**

- 调整 文档 —— `docs/CHROME-GOOGLE-诊断.md` → `docs/CHROME-GOOGLE-DIAGNOSIS.md`（`git mv`）：`docs/` 文件名统一「全大写 + 连字符」；全仓引用（docs/README、docs/DOC-RULES、docs/LNA-FAKE-IP、docs/MAINTENANCE、CHANGELOG、AGENTS）同步
- 调整 文档 —— `docs/release-notes/v0.1.0.md` → `docs/release-notes/0.1.0.md`（`git mv`）：文件名 = `versionName`，**不带 `v`**；`v` 前缀只属于发版 tag（tag `v0.1.0` 未动）
- 调整 文档 —— `docs/release-notes/README.md`「文件名 = 版本号」改为「文件名 = `versionName`（不带 `v`）」，并写明 `v` 的归属
- 调整 文档 —— `docs/README.md` 索引重写：引言块与结尾提醒对齐基准仓措辞（结尾去掉 `§8` 锚点后缀），保留「（正本）」说明，一句话定位压到一行可读，补 `release-notes/` 条目
- 调整 文档 —— `docs/DOC-RULES.md` 新增 §7「文件命名：全大写 + 连字符」（`git mv` + 全仓 grep 的改名纪律）；原 §7 / §8 顺延为 §8 / §9，变更触发矩阵补「文件名不合规范」一行
- 调整 文档 —— `docs/VERSIONING.md`：§2 标题改为「怎么判断『有没有功能更新』」并补「打开工具表与索引找答案」的口诀与「改判据 / 删能力 / 改分区」边界行；§5 改为「不发版的时候：不要动版本号」
- 调整 文档 —— 本篇顶部的进位规则表收敛为一句话 + 指向 `docs/VERSIONING.md` 的链接（单一正本）；版本标题口径改为「版本号不带 `v`」
- 修复 文档 —— `docs/VERSIONING.md` §6「两处待同步（尚未改动）」改为「口径衔接（已收敛）」

### 收尾大扫除（2026-10-22）

- 清理 磁盘 —— 复核 `%TEMP%\verify-prof` / `%TEMP%\verify-shot` 与残留的临时 Chrome 进程：均为 0；
  仓内无 `__pycache__`、过期日志与多余备份，本轮未删文件（体积 3.2M 不变）
- 调整 文档 —— `docs/TOOLS.md` 补 `tools/check-docs.py` 与 `tools/make_social_preview.py` 的维护脚本表
  （作用 / 副作用 / 前置条件）；`docs/README.md` 索引与 `docs/DOC-RULES.md` §1 的脚本清单同步
- 调整 文档 —— `docs/release-notes/README.md` 补「反馈入口」规则（加粗总结后一行、绝对链接
  `issues/new/choose`），版本规则正本改指 [docs/VERSIONING.md](docs/VERSIONING.md)
- 修复 文档 —— 删掉本篇顶部「仓库尚无 `docs/VERSIONING.md`」的过期说明（该文件已存在）
- 调整 文档 —— `docs/MAINTENANCE.md` §8 追加本轮维护记录

### Issue 表单（2026-10-22）

- 新增 `.github/ISSUE_TEMPLATE/` —— 问题反馈（Bug）与功能建议两套表单，外加 `config.yml`：
  Bug 表单要求选工具、贴完整命令与输出原文，并确认已退出自己的 Chrome；
  功能建议要求先写场景，并确认只涉及客户端侧诊断与取证

### 门面统一批次（2026-10-21）

在「README 收敛批次」之后再收一轮：门面压到与 GSAuxiliary 同款的七节，
开发者内容继续下沉 `docs/`，门面资源（logo / 社交预览）统一由 `assets/icon.svg` 渲染。

- 调整 文档 —— 根 README 收敛为七节（这是什么 / 环境要求 / 使用 / 反馈 / 免责声明 / 开源鸣谢 / 许可证）；
  顶部不写「一句话」引言块，定位由副标题承担（对齐 GSAuxiliary）
- 调整 文档 —— 三个工具的作用 / 副作用 / 前置条件下沉 [docs/TOOLS.md](docs/TOOLS.md)；示例网段口径下沉 [docs/VERIFIED-ENV.md](docs/VERIFIED-ENV.md)；
  「分诊判据」全文下沉 [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) §0
- 新增 工具 —— `tools/make_social_preview.py`：自带 SVG 渲染器，从 `assets/icon.svg` 生成
  `assets/logo.png`（512×512）与 `assets/social-preview.png`（1280×640），不依赖 cairosvg 等外部程序
- 调整 资源 —— `assets/logo.png` 改为由 `assets/icon.svg` 渲染，图形不再有两份正本
- 调整 文档 —— `docs/DOC-RULES.md` 正本映射表与 `docs/README.md` 索引同步；
  各仓 docs 里指向根 README 章节的文字引用改指新正本
- 调整 仓库 —— GitHub 仓库描述与话题改成面向使用者的口径（与 README 副标题同调）

---

## [0.1.0] — 2026-10-21

**本仓是首次建仓** —— 从原多仓工作区拆出。拆分前它是一个把
「路由器系统运维 / ShellCrash 分流 / 现代控制台 / AI 模型接入 / PC 客户端排障」
五个互不相关的逻辑任务混在同一个物理目录下的工作区；本次把其中**第 ⑤ 个逻辑任务
（PC 客户端经代理访问境外服务的排障）**独立成一个可单独上传 GitHub 的仓库。

本段只记录**建仓动作**与**建仓时就已经知道的欠账**，不重复既有诊断结论
（结论见 [docs/CHROME-GOOGLE-DIAGNOSIS.md](docs/CHROME-GOOGLE-DIAGNOSIS.md) 与 `evidence/agents/`）。

### 调整

- 调整 仓库 —— 新建独立仓，作为 5 个拆分目标之一独立成仓；本仓只保留客户端侧的定位与取证能力
- 调整 边界 —— 明确职责切分：本仓只做客户端侧定位与取证；路由器的 fake-IP 段 / nft 表 / 策略组 / 节点选择归**路由器系统仓**与**分流规则仓**两个仓
- 调整 工具 —— `tools/clear-chrome-region.js`（清 Chrome 地区种子）从原 `tools/` 迁入
- 调整 工具 —— `tools/verify-gemini.sh`（Gemini 复测编排）从原 `tools/` 迁入
- 调整 工具 —— `tools/cdp.js` 从原 `audit/cdp.js` 迁入 `tools/`，定位从「一次性审计产物」提升为「长期工具」
- 调整 文档 —— `CHROME-GOOGLE-诊断-20261019.md` 更名 `docs/CHROME-GOOGLE-诊断.md` 并迁入 `docs/`（2026-10-22 起按 [docs/DOC-RULES.md](docs/DOC-RULES.md) §7 的全大写命名再改名 `docs/CHROME-GOOGLE-DIAGNOSIS.md`）
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
- 调整 文档 —— 新增 `docs/release-notes/0.1.0.md`：首版 Release 说明（建仓时名 `v0.1.0.md`，2026-10-22 按「文件名 = `versionName`、不带 `v`」改名）
- 调整 文档 —— 新增根 `CHANGELOG.md`（本文件）、`NOTICE`、`.gitignore`

### 调整（通用化批次）

本仓从「某台设备（小米 AX3000T）的客户端排障笔记」改写为**通用方法仓** ——
**方法**（怎么判断客户端问题还是路由器问题、怎么抓 CDP 控制台、怎么清地区种子、
Chrome LNA 与 fake-IP 为什么冲突）与**复现环境**（当时那台设备的具体取值）分开写。

- 调整 定位 —— 根 `README.md` 的一句话改为「PC 客户端经代理访问境外服务的排障方法与工具（Chrome / Google / Gemini）」；
  「适用环境」改为通用前提（Windows + Chrome + 一个可达的代理 + 路由器 root 权限）；
  新增「**已验证环境**」一节，集中记录实测机型与「兄弟仓对照」（角色名 ↔ 实际仓名）。
- 调整 工具 —— `tools/verify-gemini.sh`：`CHROME` 改为环境变量 + **Windows 自动探测**
  （常见安装路径 → `where chrome` → 注册表 App Paths），探测不到时明确报错并提示用 `CHROME` 指定；
  临时 profile 目录改用系统临时目录（`$TMPDIR`/`$TEMP`）而不是写死用户路径；
  新增 `ROUTER_IP` / `CDP_PORT` / `SIBLING_REPO` 环境变量；`SSID_ROUTER` / `SSID_HOTSPOT`
  未设置时明确报错退出。
- 调整 工具 —— `tools/clear-chrome-region.js`：Chrome 用户数据目录改为**自动探测**
  （`%LOCALAPPDATA%\Google\Chrome\User Data`），支持 `CHROME_USER_DATA` 环境变量与首个命令行参数覆盖，
  不再写死某台机器的用户目录。
- 调整 文档 —— `docs/SECRETS.md` 重写：讲清**哪些设备标识会出现在哪、为什么要脱敏、怎么脱敏**
  （MAC / IPv6 PD / ULA / WiFi 名 / 本机绝对路径 / 账号标识），并给出本仓统一的占位符写法；
  凭据仍只写位置不写值。
- 调整 文档 —— 各篇正本里的具体网段、机型、仓名改为通用措辞或占位符，
  实测值集中到「已验证环境」；命令原文保持可直接复制执行（地址按示例标注）。
- 调整 文档 —— 兄弟仓统一用角色名「**路由器系统仓**」/「**分流规则仓**」，
  实际仓名只出现在「已验证环境」的对照表里。
- 调整 文档 —— 删掉仓内的本机绝对路径（`C:\Users\<用户名>\...`、`F:\...`），
  改成仓内相对路径或「原多仓工作区」这类不带机器信息的说法。

### 调整（README 收敛批次，2026-10-21）

参照系列仓 gsauxiliary 的门面格式，把根 `README.md` 收敛为**面向用户**的说明
（这是什么 / 适用环境 / 使用 / 反馈 / 免责声明 / 开源鸣谢 / 许可证），
开发者向的内容下沉到 `docs/`：

- 调整 文档 —— 根 README 顶部去掉「一句话」引言块，门面定位由副标题承担（对齐 gsauxiliary）；`tools/check-docs.py` 同步豁免根 README 的引言块检查

- 调整 文档 —— 新增 `docs/TOOLS.md`：工具清单**正本**（作用 / 副作用 / 前置条件三列），
  取代原根 README 的「文件清单」表；「已知坑」不再在 README 重复，统一看 `docs/PITFALLS.md`
- 调整 文档 —— 新增 `docs/VERIFIED-ENV.md`：已验证环境快照与兄弟仓名对照，
  取代原根 README 的「已验证环境」一节
- 调整 文档 —— `docs/DOC-RULES.md` / `MAINTENANCE.md` / `SECRETS.md` / `TROUBLESHOOTING.md` /
  `VERSIONING.md` / `docs/README.md` / `CONTRIBUTING.md` 里指向根 README
  「文件清单 / 已知坑 / 已验证环境」的引用，同步改指新位置
- 修复 CI —— 当时的流水线配置只定义了隐藏模板 `.python`、没有任何可见作业，
  流水线一创建就失败（零作业）；改为 shell/JS 语法与文档两组真实作业

### 整理批次（2026-10-21）

- 调整 工具 —— `tools/check-docs.py` 跳过 `.work/` 与 `.codegraph/`：本地工作区草稿与本机索引
  不属于版本库文档，此前会把 `.work/` 里的临时文档算进来，造成本地检查假阳性。
- 清理 配置 —— `.gitignore` 删除指向已不存在的 `PRIVACY-INVENTORY.md` 的空段注释。

### 待补

以下欠账**建仓时已知但未做**，逐条写明缺什么：

- **`tools/verify-gemini.sh` 的兄弟仓依赖** —— 脚本用 `../../<兄弟仓>/recovery/local-tools/askpass.sh`
  与 `../../<兄弟仓>/recovery/archive/verify-fix.sh` 找兄弟仓的文件，
  本仓的 `tools/cdp.js` 与截图输出已经是仓内相对路径。
  **缺的是**一份「三个仓必须同级摆放」的说明 —— 已在 `docs/TOOLS.md` 工具表的
  前置条件列写清，并给出 `SIBLING_REPO` / `ASKPASS` / `VERIFY_FIX` 环境变量覆盖方式。
- **`tools/clear-chrome-region.js` 的 Chrome profile 路径硬编码** —— 原先写死本机用户的 Chrome 用户数据目录。
  **缺的是**「改成从环境变量 / 参数读取」的改动本身；通用化批次已改为**自动探测**
  （`%LOCALAPPDATA%\Google\Chrome\User Data`），并支持 `CHROME_USER_DATA` 环境变量与首个命令行参数覆盖。
- **`docs/CHROME-GOOGLE-DIAGNOSIS.md` 的过期声明** —— 该文写于 2026-10-19，结论是「方案 A/C/D 已落地并端到端验证」；
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
