<div align="center">

<img src="assets/logo.png" width="128" alt="客户端网络排障方法与工具">

</div>

# ClientTriage

> **可见性**：公开 —— 本机网络名、本机绝对路径、账号标识一律改为占位符 + 环境变量；
> 仓内**零凭据**；vendored 只有 Chrome DevTools 协议定义（BSD-3-Clause）。
> 证据分片里残留的 P2 级内部标识（出口 IP、内网地址等）按
> [docs/SECRETS.md](docs/SECRETS.md) §3.3 处理。

> **一句话**：**PC 客户端经代理访问境外服务的排障方法与工具（Chrome / Google / Gemini）** ——
> 把「症状出在客户端还是路由器」这件事查清楚，并留下能复核的证据。

**客户端侧排障方法** —— Windows + Chrome 经代理访问境外服务时，定位「症状出在客户端还是路由器」的方法与工具。

本仓只做**客户端侧的定位与取证**：拿到能复现的命令、能对照的现象、能留存的证据。
路由器的 fake-IP 段、nft 规则、策略组与节点选择属于**另外两个仓**（本仓称之为「路由器系统仓」
与「分流规则仓」，见 [已验证环境](#已验证环境)），本仓不复制它们的配置细节，
只在这里说明「哪一类症状要往那边走」。

> **读法**：正文讲的是**方法**（通用，对任何「PC + 代理 + Chrome」的用户都成立）；
> 具体到某台设备、某个网络、某个出口的实测值集中在 [已验证环境](#已验证环境) 一节。
> 两者的分工是本仓的写作纪律，详见 [docs/DOC-RULES.md](docs/DOC-RULES.md)。

---

## 这是什么

PC 端通过路由器上的透明代理（ShellCrash / mihomo）访问境外服务时，会遇到一批**看起来像客户端坏了、
实际根因在网络层**的问题：Gemini 页面只剩一个输入框、Chrome 扩展装不上并报 `Image decode failed`、
手机 Play 商店更新一直转圈、Google 账号被判定为不支持的国家、流媒体打不开、社交媒体加载不全。

本仓沉淀的是**客户端侧怎么查**：

1. 用 **CDP（Chrome DevTools Protocol）** 接管浏览器，把「页面只剩输入框」这种描述性症状
   变成一条明确的控制台错误；
2. 用 **Chrome 地区种子清理** 把「Google 判定我的国家」这类账号/设备侧的残留因素摘掉，
   让剩下的现象能归因到网络层；
3. 用 **一批只读判定手法**（服务方自己的国家标记 / 出口链路 / GET 判 302）
   把「到底是谁在拦」这件事查清楚，并留下可复核的证据。

> 一句话判据：**症状在浏览器里能被复现成一条控制台错误**，才轮得到本仓继续查；
> 查不到就是网络层，去「分流规则仓」（见 [已验证环境](#已验证环境)）。

## 适用环境

以下是**通用前提** —— 满足这几条，这套方法就能用；具体机型见下一节。

| 项 | 要求 | 备注 |
|---|---|---|
| 操作系统 | Windows 10 / 11 | 工具链依赖 `netsh` / `ssh` / `curl`，**仅 Windows 可用** |
| 浏览器 | Chrome 138+ | LNA 机制自 Chrome 138+ 起生效；更早版本不会复现本仓的假-IP 冲突 |
| Node.js | ≥ 18 | `tools/cdp.js` 用内置 `fetch` 与 `WebSocket`，无第三方依赖 |
| Shell | Git Bash | `tools/verify-gemini.sh` 是 `sh` 脚本，依赖 `netsh` / `ssh` / `curl` |
| 代理 | 一个**客户端可达**的代理口（路由器上的 mixed 口，或本机代理软件） | 本仓的 API/连通性测试**必须走这个口**，不能用路由器自身的 curl（见 [docs/PITFALLS.md](docs/PITFALLS.md)） |
| 路由器 | 需 root 权限（要跑路由器侧检查脚本） | 路由器侧排查**不在本仓**，本仓只负责判据与证据 |
| CDP 调试端口 | 9223（临时实例） | `tools/cdp.js` 默认 9222，用环境变量 `CDP_PORT` 覆盖 |

> 文中出现的 `10.0.0.1` / `192.168.1.x` 一律是**示例网段**（典型的家用路由器默认网关），
> 不是某个具体网络的真值。用你自己的网关地址替换即可。

## 已验证环境

以下是**方法被实测过的环境** —— 记录「当时是在什么环境上抓到的」，供复核与对照。
换环境不影响方法本身，只影响下面这些具体取值。

| 项 | 实测值 |
|---|---|
| 路由器 | 小米 AX3000T（刷 OpenWrt，跑 ShellCrash / mihomo） |
| 路由器 LAN 地址 | `10.0.0.1`；代理 mixed 口 `10.0.0.1:7890`（家用路由器的常见默认段，换环境时按实际改） |
| 客户端 | Windows 11 + Chrome 155.0.8059.82；Node.js v24.13.1；Git Bash |
| 手机 / 平板 | 小米平板（Android），用于复现 Play 更新卡住 |
| 出口 | 某机场订阅的多国出口节点池（28 个出口） |
| 取证日期 | 2026-10-19 ~ 2026-10-20 |

**兄弟仓对照**（正文一律用左列的角色名，右列是当时的实际仓名 —— 仓名里带设备型号，
你自己的仓叫什么由你定）：

| 本仓正文用的角色名 | 当时的实际仓名 | 管什么 |
|---|---|---|
| **路由器系统仓** | `AX3000TOpenwrt` | 设备本体：OpenWrt、sysupgrade 保留清单、SSH 口令脚本 |
| **分流规则仓** | `ShellcrashRules` | 代理分流：fake-IP 段、nft 规则、策略组、节点选择 |

> 本仓不记录具体 WiFi 名、MAC、IPv6 PD、出口 IP 等设备标识 ——
> 哪些标识会出现在哪、为什么要脱敏、怎么脱敏，见 [docs/SECRETS.md](docs/SECRETS.md)。

## 快速开始

三步，顺序不能换：**先清种子，再复测，最后才抓控制台** —— 种子没清就抓控制台，
抓到的是带地区因子的噪声。

```bash
# ① 清 Chrome 地区种子 —— 必须先把 Chrome 完全退出（含后台进程）
node tools/clear-chrome-region.js

# ② 复测 Gemini —— 会切 WiFi、起临时 Chrome、抓控制台、截图、清理、切回热点
bash tools/verify-gemini.sh

# ③ 只抓控制台/网络失败（假设 9223 上已经有一个开着调试端口的 Chrome）
CDP_PORT=9223 node tools/cdp.js
```

`verify-gemini.sh` 的五步依次是：切到路由器 WiFi → SSH 跑路由器侧检查脚本 →
用**全新临时 profile** 起一个带 9223 调试端口的 Chrome → 跑 CDP 抓日志并截图 →
删临时 profile、切回热点。你日常那个 Chrome **全程不会被碰**。

按现象直奔对应章节：[docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)。

## 目录结构

```
ClientTriage/
├─ README.md                  ← 本文件：门面
├─ AGENTS.md                  ← 机器协议（子代理怎么写文件、边界在哪）
├─ CHANGELOG.md               ← 开发者记录（做了什么 / 为什么 / 怎么验）
├─ NOTICE                     ← 第三方声明
├─ .gitignore
├─ PROGRESS.md                ← 本仓唯一进度台账（追加式）
├─ third-party/               ← 随仓分发的上游开源项目
│  ├─ README.md               ← 索引：来源 / 许可证 / vendored SHA / 为什么 vendor
│  ├─ verify-cdp-fields.js    ← 用协议定义核对 tools/cdp.js 的方法与字段名
│  └─ devtools-protocol/
│     ├─ UPSTREAM.md          ← 来源凭证：上游 URL / SHA / 取了哪些文件 / 怎么更新
│     ├─ LICENSE              ← 上游 BSD-3-Clause 原文
│     ├─ README.md            ← 上游自己的说明
│     └─ json/                ← CDP 协议定义原文（browser_protocol / js_protocol）
├─ docs/
│  ├─ README.md               ← docs 唯一索引
│  ├─ DOC-RULES.md            ← 文档规则正本
│  ├─ LNA-FAKE-IP.md          ← LNA × fake-IP 机制与解法（长期正本）
│  ├─ PITFALLS.md             ← 踩坑总汇
│  ├─ TROUBLESHOOTING.md      ← 排错手册（现象 → 步骤 → 原因/解法）
│  ├─ MAINTENANCE.md          ← 维护流程与保留期限
│  ├─ CHROME-GOOGLE-诊断.md   ← 2026-10-19 阶段性诊断报告（结论已部分过期）
│  ├─ archive/                ← 一次性归档（当前为空）
│  └─ release-notes/
│     ├─ README.md            ← Release 说明格式正本
│     └─ v0.1.0.md            ← 首版说明
├─ tools/
│  ├─ clear-chrome-region.js  ← 清地区种子
│  ├─ verify-gemini.sh        ← Gemini 复测编排
│  └─ cdp.js                  ← CDP 抓控制台 / 网络失败
└─ evidence/
   ├─ agents/                 ← 9 份子代理只读审计分片
   ├─ gemini-after.png        ← 复测截图（本地留存，.gitignore 已排除）
   └─ shot-cf-fresh.png       ← 出口判定截图（本地留存，.gitignore 已排除）
```

## 文件清单

### 工具

| 工具 | 作用 | 副作用 | 前置条件 |
|---|---|---|---|
| `tools/clear-chrome-region.js` | 清掉 Chrome 的地区种子：`Local State` 与 `Default/Preferences` 里 5 个 `variations_*_country` 键（含 `variations.` 嵌套） | **改写 Chrome 配置文件**；写前先留 `.bak-region-<时间戳>` 备份 | **Chrome 已完全退出**（退出时会重写 Local State，在线改会被覆盖）；Node.js；Chrome 目录自动探测，`CHROME_USER_DATA` 可覆盖 |
| `tools/verify-gemini.sh` | 复测 Gemini：切 WiFi → SSH 跑路由器侧检查 → 起临时 Chrome（9223）→ CDP 抓日志 → 截图 → 清理并切回热点 | **会切换本机 WiFi**；会起一个临时 Chrome 进程；结束后删临时 profile；截图写到本仓 `evidence/gemini-after.png` | Git Bash；路由器可达（`ROUTER_IP`，默认 `192.168.1.1`）；**兄弟仓要与本仓同级**（脚本默认从 `../../<路由器系统仓>/recovery/...` 找 `askpass.sh` 与 `verify-fix.sh`，可用 `SIBLING_REPO` / `ASKPASS` / `VERIFY_FIX` 覆盖） |
| `tools/cdp.js` | 通过 CDP 接管**已在运行**的 Chrome，抓渲染状态、`Log.entryAdded`、`Runtime.consoleAPICalled`、`Runtime.exceptionThrown`、`Network.loadingFailed`、非 2xx 响应 | 无（只读；不碰浏览器设置、不改 profile） | Node.js ≥ 18；一个开着 `--remote-debugging-port` 的 Chrome；`CDP_PORT` / `CDP_URL` 可选覆盖 |

### 文档与证据

| 文件 | 作用 |
|---|---|
| [docs/README.md](docs/README.md) | docs 唯一索引：每篇一句话定位 + 正本归属 |
| [docs/DOC-RULES.md](docs/DOC-RULES.md) | 文档规则正本：分类、单一正本、链接纪律、变更触发矩阵 |
| [docs/LNA-FAKE-IP.md](docs/LNA-FAKE-IP.md) | LNA × fake-IP 的机制、证据、解法，以及「外壳能打开 ≠ 修好了」 |
| [docs/PITFALLS.md](docs/PITFALLS.md) | 踩坑总汇：每条都带「为什么错」与「下次怎么避」 |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | 排错手册：按现象检索，每节给可执行命令与「客户端问题还是路由器问题」的判据 |
| [docs/MAINTENANCE.md](docs/MAINTENANCE.md) | 维护流程：种子可重复执行、证据命名与保留期限、工具副作用的声明位置 |
| [docs/CHROME-GOOGLE-诊断.md](docs/CHROME-GOOGLE-诊断.md) | 2026-10-19 的阶段性诊断报告；**其中「已修复」结论已被后续结论修正**，读时以 [LNA-FAKE-IP.md](docs/LNA-FAKE-IP.md) 为准 |
| [docs/release-notes/README.md](docs/release-notes/README.md) | Release 说明格式正本 |
| [docs/release-notes/v0.1.0.md](docs/release-notes/v0.1.0.md) | 首版 Release 说明 |
| `evidence/agents/*.md` | 9 份子代理只读审计分片：浏览器层、干净出口、IP 声誉、Google 其余服务、OpenAI、流媒体、社交媒体、YouTube、PC 侧 |
| [CHANGELOG.md](CHANGELOG.md) | 开发者记录：拆仓动作、结论修正、证据补齐 |
| [PROGRESS.md](PROGRESS.md) | 本仓唯一进度台账（追加式批次日志） |

## 已知坑

1. **Chrome 必须在完全退出时才能改地区种子。**
   Chrome 退出时会重写 `Local State`，运行中改的内容会被覆盖回去 —— 表现是「脚本说清掉了，
   重开又变回 cn」。必须先把 Chrome 及其后台进程全部退出再跑脚本，然后重新启动。
   见 [docs/PITFALLS.md](docs/PITFALLS.md) 与 [tools/clear-chrome-region.js](tools/clear-chrome-region.js)。

2. **CDP 要用临时端口起的独立 Chrome 实例。**
   不要去接管你日常那个 Chrome（profile 被占用、端口多半也没有）。用
   `--remote-debugging-port=9223 --user-data-dir=<临时目录>` 起一个干净的实例；
   端口被占用时实例起不来，表现是 `curl http://127.0.0.1:9223/json/version` 永远不通。

3. **截图只能证明外壳能打开，不能证明 UI 加载完整。**
   Gemini 的页头/侧栏/推荐区由 `www.gstatic.com` 上的 islands bundle 懒加载渲染，
   bundle 被拦时页面**照样渲染出主输入框**。截图绿了不等于修好了 ——
   判据是「UI 完整加载」，判据怎么取见 [docs/LNA-FAKE-IP.md](docs/LNA-FAKE-IP.md)。
   附带两个已知的截图陷阱：复制真实 profile 会丢掉 app-bound 加密的 SID cookie（复现不出登录态），
   headless 在无 GPU 的机器上可能截出一张全黑图。

4. **兄弟仓必须与本仓同级，否则 `verify-gemini.sh` 跑不完。**
   脚本默认从 `../../<兄弟仓>/recovery/local-tools/askpass.sh`（SSH 口令）与
   `../../<兄弟仓>/recovery/archive/verify-fix.sh`（路由器侧检查）找这两个文件 ——
   它们**归路由器系统仓所有**。只把本仓 clone 到别处时，
   第 2 步（路由器侧检查）会因找不到文件而中断。
   三种解法：把本仓与路由器系统仓放在同一父目录下；用 `SIBLING_REPO` 指定仓目录名；
   或直接用环境变量覆盖到具体文件：
   `ASKPASS=/path/to/askpass.sh VERIFY_FIX=/path/to/verify-fix.sh bash tools/verify-gemini.sh`。
   另外 `tools/clear-chrome-region.js` 现在会**自动探测** Chrome 的用户数据目录
   （`%LOCALAPPDATA%\Google\Chrome\User Data`）；非标准安装位置用环境变量
   `CHROME_USER_DATA` 或第一个命令行参数覆盖。

## 记忆文档

`memories/` —— **只靠读代码和文档读不出来的事实**：踩过的坑、根因、实测结论、
已确认但未修的缺陷。同样的内容也存在于 ZCode 的记忆库（按项目 id 分目录），
那里是活的，这里是**随 git 版本化的快照**。

索引见 [memories/MEMORY.md](memories/MEMORY.md)，约定见
[memories/README.md](memories/README.md)。

## 免责声明

本项目仅供学习与个人排障使用。

- 不采集、不上传、不存储任何个人信息；本仓只有本地脚本与文档，不含任何统计或回传组件
- 本仓**不提供**任何绕过服务方地区限制的方案；它只做**定位与取证**，
  改不改、改在哪一侧，由你自己按当地法律与各服务的用户协议自行判断
- 修改浏览器配置（地区种子）前请自行备份；本仓脚本会留 `.bak-region-*` 备份，但不替你恢复
- 请勿用于商业用途或任何违反服务方用户协议的场景
- 使用本工具产生的任何后果由使用者自行承担

「Chrome」「Google」「Gemini」「Chrome DevTools Protocol」「Node.js」等商标、标识与项目名称
的权利均归其权利人所有。本项目与之不存在任何隶属、合作、授权、认可或支持关系。

## 开源鸣谢

本仓的脚本建立在这些开源项目之上（详见 [NOTICE](NOTICE)）：

| 项目 | 用途 | 是否随仓分发 |
|---|---|---|
| [**Chrome DevTools Protocol**](https://chromedevtools.github.io/devtools-protocol/) | 抓控制台、网络失败与页面渲染状态的标准协议 | **是** —— 协议定义原文原样 vendor 在 [third-party/devtools-protocol/](third-party/devtools-protocol/)，commit `95b1af69`，BSD-3-Clause，上游 LICENSE 一并保留 |
| [**Chrome**](https://www.chromium.org/Chromium/Chromium/) | 被诊断的浏览器本体，提供 `--remote-debugging-port` 接入点 | 否 |
| [**Node.js**](https://nodejs.org/) | 跑 `tools/cdp.js` 与 `tools/clear-chrome-region.js`（内置 `fetch` / `WebSocket`，无第三方依赖） | 否 |

**随仓分发的上游项目**索引见 [third-party/README.md](third-party/README.md) —— 每个项目的
来源 URL、许可证、vendor 的 commit SHA 与「为什么 vendor」都在那里；
单个项目的来源凭证在它自己的 `UPSTREAM.md` 里。

`tools/cdp.js` 用到的每一个 CDP 方法与事件字段，都可以用协议定义原文逐个核对：

```bash
node third-party/verify-cdp-fields.js
```

2026-10-20 实测全部命中（明细见
[third-party/devtools-protocol/UPSTREAM.md](third-party/devtools-protocol/UPSTREAM.md) §3.1）。

## 参与与治理

- [CONTRIBUTING.md](CONTRIBUTING.md) —— 工具怎么用、证据怎么加、**方法与复现环境分离**这条规矩
- [SECURITY.md](SECURITY.md) —— 安全问题怎么报、脚本对浏览器与本机数据的影响
- [tools/check-docs.py](tools/check-docs.py) —— 文档自检（链接 / 锚点 / 引言块 / 孤儿），CI 里跑的就是它
- CI：`.gitlab-ci.yml`（shell / node 语法 + 文档自检）

---

## 许可证

本仓库按 **MIT License** 发布 —— 许可证全文见 [LICENSE](LICENSE)。

第三方组件的版权与许可证声明见 [NOTICE](NOTICE)。
