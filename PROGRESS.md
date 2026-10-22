# PROGRESS — 客户端网络排障

> **一句话**：PC 客户端（Chrome / Google / Gemini）经代理访问境外服务的排障台账。
>
> 本文件是本仓库**唯一**的进度台账（追加式批次日志）。
> 规则正本见 [docs/DOC-RULES.md](docs/DOC-RULES.md) 与 [docs/MAINTENANCE.md](docs/MAINTENANCE.md)。
> 拆分自原单文件 `PROGRESS.md`（2026-10-20 之前的路由器联合调优记录）。

---

# 2026-10-19 第四轮：Chrome 扩展安装 / Google 下载修复

## 根因
- Chrome 155 的 LNA 把 mihomo fake-IP（198.18.0.0/15、fc00::/16）判为**本地网络** →
  Web Store 安装弹窗拉扩展图标被 `ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS` 拦截 →
  显示 `Image decode failed`。
- 手机 Play 更新转圈：Redir 只代理 TCP，QUIC 直连逃逸 + 下载 CDN 经节点超时。

## 已完成变更
- [x] `fake_ip_filter` 增加 16 条 Google 域（让这些域解析真实 IP，规避 LNA）。
- [x] `/etc/quicguard.nft`（`table inet quicguard`，prerouting priority -150）阻断 fake-IP 段 UDP 443/8443。
- [x] Play CDN 改为**按目标 IP 分流**：`IP-CIDR,203.208.32.0/19` + `IP-CIDR6,2401:3800::/32` → 直连；
      撤销早期"整段域名直连"（会把海外 CDN 也逼上直连）。
- [x] `/etc/googlecn.nft`（priority -105）把 LAN→Google 国内边缘段 TCP 80/443 提前重定向到 :7892，
      让域名规则生效（Gemini 地区限制的另一半原因）。
- [x] 全部文件进 sysupgrade 保留清单。

## 状态: 已完成

---


---

# 2026-10-20 第八轮-B：Play/Gemini 修复态复核（只读，结论=不需要重启）

## 复核结果（全部只读验证，无写操作）
- `nft list table inet googlecn` → **已加载**（priority dstnat -5 = -105，早于 ShellCrash -100）；
  `quicguard` 已加载（priority mangle，含 203.208.32.0/19 与 2401:3800::/32 的 UDP reject）。
- `/etc/rc.local` 已含两条 `nft list table ... || nft -f ...` 开机加载语句。
- `/etc/sysupgrade.conf` 含 `/etc/googlecn.nft`、`/etc/quicguard.nft`、`fake_ip_filter`、
  `yamls`、`ai-rules-update.sh`、`ai-api-check.sh`、`reorder-groups.sh`、`auto-update.sh`、
  `rules-mid.sh` → 全部文件可跨升级/重启保留。
- 运行配置 `/tmp/ShellCrash/config.yaml` 的 `fake-ip-filter` 实含 19 条 Google 域，
  末两条为 `+.xn--ngstr-lra8j.com`、`+.googlevideo.com`（**运行态已生效**，非仅文件）。
- `rules.yaml` 与 `ai-rules-update.sh` 均为 `IP-CIDR,203.208.32.0/19,🎯 全球直连` /
  `IP-CIDR6,2401:3800::/32,🎯 全球直连`（**不带 no-resolve**，与最终方案一致）。
- DNS 验证：`rr3.sn-ni57rn76.xn--ngstr-lra8j.com` → `2401:3800:4002:2::12`（真实 IP，非 fake-IP）。

## 实时连通性（经 127.0.0.1:7890）
| 目标 | 结果 |
|---|---|
| `rr3.sn-…xn--ngstr-lra8j.com`（Play CDN） | 404 / 0.19s ✅ |
| `dl.google.com` Range 3MB | 206 / 3,000,001B / 7.0MB/s ✅ |
| `play.googleapis.com` | 404 / 0.51s（根路径正常） ✅ |
| `gemini.google.com` 强制 `--resolve` 到 203.208.33.21 | 200 / 0.99s ✅（googlecn 路径生效） |

注：路由自身 curl 对 CDN 主机报 `CN does not match` 属严格证书校验，与网络无关，加 `-k` 即通。

## 结论
**不需要重启路由器。** 所有修复（nft 表 + fake_ip_filter + 规则）均已在运行态生效并通过
端到端连通性验证。若 Play 仍显示"等待中"，是手机端队列卡死，处置为：强制停止 Play 商店
→ 重新打开 → 下载列表点"重试"（或开关一次飞行模式），不是重启路由器。

## 状态: 已完成

---


---

# 2026-10-20 通用化批次：方法与复现环境分离

## 目标
把本仓从「某台设备（小米 AX3000T）的客户端排障笔记」改写为**通用方法仓** ——
正文只讲**方法**，具体实测值集中到根 README 的「已验证环境」。

## 已完成变更
- [x] `tools/verify-gemini.sh`：`CHROME` 改为环境变量 + Windows 自动探测
      （常见安装路径 → `where chrome` → 注册表 App Paths），探测不到时明确报错；
      临时 profile 改用 `$TMPDIR`/`$TEMP`；新增 `ROUTER_IP` / `CDP_PORT` / `SIBLING_REPO`；
      `SSID_ROUTER` / `SSID_HOTSPOT` 未设置时明确报错退出。
- [x] `tools/clear-chrome-region.js`：Chrome 用户数据目录改为自动探测
      （`%LOCALAPPDATA%\Google\Chrome\User Data`），支持 `CHROME_USER_DATA` 与首个命令行参数。
- [x] 根 README：一句话改为通用定位；「适用环境」改为通用前提；新增「已验证环境」
      与「兄弟仓对照」（角色名 ↔ 实际仓名）。
- [x] `docs/SECRETS.md` 重写：P2 类别表（MAC / IPv6 PD / ULA / WiFi 名 / 本机路径 / 账号标识）
      + 占位符写法表 + 环境变量表；新增 §3.4 与 §3.5。
- [x] 兄弟仓统一用角色名「路由器系统仓」/「分流规则仓」，实际仓名只出现在「已验证环境」。
- [x] 删掉仓内本机绝对路径（`C:\Users\<用户名>\...`、`F:\...`）、账号标识、公开出口 IP。
- [x] `docs/DOC-RULES.md` 新增 §3.1（只换值不改结构）与 §6（方法与复现环境分离），
      原 §6/§7 顺延为 §7/§8；跨文件引用同步更新。
- [x] `docs/MAINTENANCE.md`：分片红线补「只换值」的例外；对账清单补两条；
      收尾清单的临时目录改用 `$TEMP`。
- [x] `docs/TROUBLESHOOTING.md` / `docs/PITFALLS.md`：加「地址约定」引言，
      地址统一按**示例**标注；命令原文保持可直接复制执行。
- [x] `CHANGELOG.md`「未发布」段补「通用化批次」小节。

## 刻意没改
- `evidence/agents/*.md` 的**描述性内容**（结论、原始输出、节点名、机场出口表）——
  按仓内红线「证据原文逐字保留」，只做了 P2 级的**值替换**：
  账号标识 → `<REDACTED-account>`、本机用户名路径 → `%LOCALAPPDATA%\...`、
  一处网关地址 → 标注为示例。**没有**任何能用来连上某个服务的凭据留在仓内。
- `third-party/` —— vendored 上游，原样不动。
- `memories/` 的历史事实（IP、机型、日期）—— 记忆快照的职责是「当时的结论」。

## 自检
- `bash -n tools/verify-gemini.sh` 通过；`node --check` 两个 `.js` 通过。
- 28 个 md 的相对链接与锚点全部可达（无死链、无孤儿）。
- 仓内已无 `C:\Users\<用户名>` / `F:\...` / 真实邮箱 / 公开出口 IP。

## 待解决
- `evidence/agents/agent-ip-reputation.md` 等分片里仍有节点出口 IP 与机场名（P2 级）。
  按仓内规则它们是「历史证据原文」，**上传公开远端前**需按 `docs/SECRETS.md` §3.3 替换 ——
  这一步本轮刻意没做，避免破坏证据链。

## 状态: 已完成

---

# 2026-10-21 README 收敛 + 流水线修复

## 背景
- 参照系列仓 gsauxiliary 的门面格式，根 `README.md` 收敛为面向用户的说明；
  开发者向内容（文件清单 / 已验证环境 / 已知坑摘要 / 目录结构 / 记忆文档）下沉 `docs/` 或删除。
- 当时的流水线配置只定义了隐藏模板 `.python`（无可见作业），流水线零作业、创建即失败。

## 已完成变更
- [x] 重写根 `README.md`：logo 头 + 徽章 / 这是什么 / 适用环境 / 使用 / 反馈 / 免责声明 / 开源鸣谢 / 许可证
- [x] 新增 `docs/TOOLS.md`（工具清单正本）与 `docs/VERIFIED-ENV.md`（已验证环境快照），进索引
- [x] DOC-RULES / MAINTENANCE / SECRETS / TROUBLESHOOTING / VERSIONING / docs/README / CONTRIBUTING 引用同步改指新位置
- [x] 重写流水线配置：shell/JS 语法 + 文档两组真实作业
- [x] CHANGELOG 增补「README 收敛批次」

## 自检
- `python tools/check-docs.py` ✓（19 篇：链接 / 锚点 / 引言块 / 孤儿）
- `node --check` 两个工具脚本、`sh -n verify-gemini.sh` ✓

## 状态: 已完成

---

---

# 2026-10-21 README 门面重写（对齐 gsauxiliary）

## 目标
用户反馈「readme 还是和 goldsunenhance 差很多，太乱七八糟」——
按系列仓 GSAuxiliary 的门面格式重写根 `README.md`，
开发者向内容（三个工具的详细说明表 / 示例网段说明 / 一句话判据长解释）下沉 `docs/`。

## 已完成变更
- [x] 根 `README.md` 重写为 84 行门面：`这是什么` / `环境要求` / `使用` / `反馈` / `免责声明` /
      `开源鸣谢` / `许可证`；顶部 logo + 徽章，无目录树、无文件清单、无工具详情表。
- [x] 三个工具的作用 / 副作用 / 前置条件：README 只留速览 + 链接，正本留在 `docs/TOOLS.md`。
- [x] CDP 的 vendored 协议快照与 `verify-cdp-fields.js` 说明下沉到 `docs/TOOLS.md`，
      README「开源鸣谢」表里压成一句话。
- [x] 示例网段（`10.0.0.1` / `192.168.1.x`）说明下沉到 `docs/VERIFIED-ENV.md`（新增「地址口径」节）。
- [x] 「一句话判据」全文下沉到 `docs/TROUBLESHOOTING.md` §0，README 只留一句概述 + 链接。
- [x] `docs/DOC-RULES.md` 正本映射表补两行（分诊判据 / 示例地址约定），变更触发矩阵补一行。
- [x] `docs/SECRETS.md`、`docs/release-notes/README.md` 里指向根 README 章节的引用改指正本。

## 自检
- `python tools/check-docs.py` ✓（19 篇：链接 / 锚点 / 引言块 / 孤儿），退出码 0。
- 根 README 84 行（要求区间 80–110）；README 里所有仓库内链接目标均存在；未链 `docs/README.md` 索引。

## 状态: 已完成

---

# 2026-10-22 仓库门面：Issue 表单

## 目标
对齐 GSAuxiliary 的仓库门面：补上 Issue 表单，让反馈自带定位所需的环境与输出。

## 已完成变更
- [x] 新增 `.github/ISSUE_TEMPLATE/bug_report.yml` —— 工具选择、完整命令、Windows / Chrome / 代理环境、
      输出或控制台错误原文；确认已退出自己的 Chrome、本仓只做定位与取证。
- [x] 新增 `.github/ISSUE_TEMPLATE/feature_request.yml` —— 场景、期望效果、范围确认。
- [x] 新增 `.github/ISSUE_TEMPLATE/config.yml` —— 关掉空白 Issue，挂排错手册与工具清单。

## 自检
- `python tools/check-docs.py` ✓，退出码 0。
- 三份 YAML 均可被 `yaml.safe_load` 解析。

## 状态: 已完成

---

# 2026-10-22 收尾大扫除

## 目标
按系列仓共用作业书做一次只减不加的大扫除：清可再生产物、对齐文档漂移、补记账。

## 已完成变更
- [x] L1 磁盘垃圾复核：`%TEMP%\verify-prof`、`%TEMP%\verify-shot` 与匹配
      `verify-prof|verify-shot` 的 Chrome 进程均为 0；仓内无 `__pycache__` / 过期日志 /
      多余备份，本轮未删文件（3.2M 不变）
- [x] `docs/TOOLS.md` 补两个维护脚本（`tools/check-docs.py` / `tools/make_social_preview.py`）
      的作用 / 副作用 / 前置条件
- [x] `docs/README.md` 索引、`docs/DOC-RULES.md` §1 分类成员与实际文件对齐
- [x] `docs/release-notes/README.md` 补「反馈入口」规则；版本规则正本改指 `docs/VERSIONING.md`
- [x] `docs/MAINTENANCE.md` §8 追加本轮维护记录
- [x] 删掉 CHANGELOG 顶部「仓库尚无 docs/VERSIONING.md」的过期说明

## 自检
- `python tools/check-docs.py` ✓，退出码 0（19 篇：链接 / 锚点 / 引言块 / 孤儿）
- `bash -n tools/verify-gemini.sh`、`node --check` 两个工具 JS、两个 Python 脚本 `ast.parse` 均通过
- 临时 Chrome profile / 残留进程：0

## 状态: 已完成

---

# 2026-10-22 文档骨架对齐 GSAuxiliary

## 目标
把基准仓 GSAuxiliary 的文档骨架（命名 / 索引 / 版本口径 / release-notes 命名）同步到本仓。

## 已完成变更
- [x] `git mv docs/CHROME-GOOGLE-诊断.md docs/CHROME-GOOGLE-DIAGNOSIS.md`；全仓引用同步
      （docs/README、docs/DOC-RULES、docs/LNA-FAKE-IP、docs/MAINTENANCE、CHANGELOG、AGENTS）
- [x] `git mv docs/release-notes/v0.1.0.md docs/release-notes/0.1.0.md`（文件名 = `versionName`，
      不带 `v`）；git tag `v0.1.0` 未动；`docs/release-notes/README.md` 的命名口径同步
- [x] `docs/README.md` 索引重写：引言块 / 结尾提醒对齐基准仓（结尾去掉 `§8` 后缀），
      保留「（正本）」说明，一句话定位压到一行，补 `release-notes/` 条目
- [x] `docs/DOC-RULES.md` 新增 §7「文件命名：全大写 + 连字符」（`git mv` + 全仓 grep 纪律）；
      原 §7 / §8 顺延为 §8 / §9；变更触发矩阵补「文件名不合规范」一行；跨文件 `§7` 引用同步
- [x] `docs/VERSIONING.md`：§2 补「打开工具表与索引找答案」口诀与边界行，§5 改为「不发版的时候：不要动版本号」；
      CHANGELOG 顶部的进位规则表收敛为一句话 + 链接；§6 「两处待同步」改为「口径衔接（已收敛）」
- [x] 全仓 `python tools/check-docs.py` ✓（19 篇：链接 / 锚点 / 引言块 / 孤儿）

## 自检
- `python tools/check-docs.py` ✓，退出码 0
- 全仓 grep 旧名 `CHROME-GOOGLE-诊断` / `release-notes/v0.1.0.md`：仅剩 CHANGELOG 历史条目里的旧名记述（当时的事实，保留）
- 未动代码 / 脚本 / CI 逻辑；未动 `evidence/` / `memories/` / `third-party/`；未 commit / push / 打 tag

## 状态: 已完成
