# 工具清单

> **一句话**：`tools/` 下四个使用者工具的作用、副作用与前置条件正本，另附三个维护脚本与一个共享层 —— 根 README 只留「使用」速览，细节以本篇为准。

| 工具 | 作用 | 副作用 | 前置条件 |
|---|---|---|---|
| `tools/clear-chrome-region.js` | 清掉 Chrome 的地区种子：`Local State` 与 `Default/Preferences` 里 5 个 `variations_*_country` 键（含 `variations.` 嵌套）；`--status` 只读列出、`--dry-run` 只打印计划、`--json` 机器可读 | **改写 Chrome 配置文件**；写前先留 `.bak-region-<时间戳>` 备份 | **Chrome 已完全退出**（退出时会重写 Local State，在线改会被覆盖）；Node.js；Chrome 目录自动探测，`CHROME_USER_DATA` 或第一个命令行参数可覆盖 |
| `tools/verify-gemini.sh` | 复测 Gemini：切 WiFi → SSH 跑路由器侧检查 → 起临时 Chrome（9223）→ CDP 抓日志 → 截图 → 清理并切回热点 | **会切换本机 WiFi**；会起一个临时 Chrome 进程；结束后删临时 profile；截图写到本仓 `evidence/gemini-after.png` | Git Bash；路由器可达（`ROUTER_IP`，默认 `192.168.1.1`）；**必须先给 `SSID_ROUTER` / `SSID_HOTSPOT`** —— 两个 WiFi 名还是占位符（`YOUR_ROUTER_SSID` / `YOUR_HOTSPOT_SSID`）时脚本提示后 `exit 2`；兄弟仓与本仓同级，默认按目录名 `AX3000TOpenwrt` 从 `../../AX3000TOpenwrt/recovery/` 取 `local-tools/askpass.sh` 与 `archive/verify-fix.sh`（`SIBLING_REPO` / `ASKPASS` / `VERIFY_FIX` 可覆盖）；路由器侧检查是 `ssh root@$ROUTER_IP` 执行该脚本，**ssh 不通即中止，没有跳过分支**；`--status` 只读体检（不切网、不起 Chrome）；截图按 `KEEP_SHOTS`（默认 10）轮转 |
| `tools/cdp.js` | 通过 CDP 接管**已在运行**的 Chrome，抓渲染状态、`Log.entryAdded`、`Runtime.consoleAPICalled`、`Runtime.exceptionThrown`、`Network.loadingFailed`、非 2xx 响应 | 无（只读；不碰浏览器设置、不改 profile） | Node.js ≥ 22（脚本硬校验全局 `WebSocket`）；一个开着 `--remote-debugging-port` 的 Chrome；`CDP_PORT` / `CDP_URL` 可选覆盖；`--status` 只判端口与 page target 是否就绪 |
| `tools/doctor.js` | 只读体检：Node 版本 / `fetch` / 全局 `WebSocket`、Chrome 是否在跑、用户数据目录、地区种子、CDP 端口、Git Bash、兄弟仓脚本、`evidence/`、统一状态文件，共 13 项 | 无；**只有 `--write-status` 会写** `.work/triage-status.json` | Node.js ≥ 22；其余项缺失只报 `[WARN]` / `[FAIL]`，不中断 |

## 维护脚本

| 脚本 | 作用 | 副作用 | 前置条件 |
|---|---|---|---|
| `tools/check-docs.py` | 文档自检：相对链接 / 锚点 / 孤儿文档 / 「一句话」引言块（[DOC-RULES.md](DOC-RULES.md) 规则的可执行版本） | 无（只读） | Python 3 |
| `tools/check-secrets.py` | 敏感信息守卫：扫描已跟踪文件（`--all` 连工作树里的未跟踪文件一起扫，忽略规则由 git 判定，遵循 `.gitignore`）里的可用凭据 / 本机用户目录 / 真实邮箱；规则正本是 [SECRETS.md](SECRETS.md)「推送前脱敏规则」 | 无（只读；不写任何文件） | Python 3；`--all` 模式需 git；已接入 [CI](../.github/workflows/ci.yml)「敏感信息扫描」步骤 |
| `tools/make_social_preview.py` | 从 `assets/icon.svg` 渲染 `assets/logo.png`（512×512）与 `assets/social-preview.png`（1280×640）；`--ico` 另写 `assets/icon.ico`，`--preview-only` 只写社交预览 | **覆盖写入**上面两个（或三个）`assets/` 文件 | Python 3 + `numpy` + `Pillow` |

环境变量清单（含脱敏口径）见 [SECRETS.md](SECRETS.md) §3.5；
每个工具对应的已知坑见 [PITFALLS.md](PITFALLS.md)，副作用变更时的同步义务见 [MAINTENANCE.md](MAINTENANCE.md) §4。

## 只读入口与退出码

每个工具都有**不产生副作用**的入口，可以放进巡检、CI 或别的脚本里调用；
输出标记一律 ASCII（`[OK]` / `[WARN]` / `[FAIL]`），中文控制台（cp936）不会因编码判失败。

| 命令 | 判什么 | 副作用 | 退出码 |
|---|---|---|---|
| `node tools/doctor.js` | 13 项体检，见上表 | 无 | 0 通过或有告警 / 1 有失败项 / 2 用法错误 |
| `node tools/doctor.js --json` | 同上，机器可读（`schema` / `counts` / `checks`） | 无 | 同上 |
| `node tools/doctor.js --write-status` | 同上，并把结果并进 `.work/triage-status.json` | **写一个状态文件** | 同上 |
| `node tools/clear-chrome-region.js --status` | 两个配置文件里有没有地区键 | 无 | 0（有没有键都算成功，看输出） |
| `node tools/clear-chrome-region.js --dry-run` | 将删哪些键、备份写到哪 | 无 | 0 |
| `node tools/cdp.js --status` | CDP 端口 + page target 是否就绪 | 无 | 0 就绪 / 1 未就绪 |
| `bash tools/verify-gemini.sh --status` | 复测前置：SSID / `ROUTER_IP` 形状 / 临时目录 / 兄弟仓脚本 / Chrome / Node / 端口 / `evidence/` | 无（不切 WiFi、不起 Chrome） | 0 / 1 有 `[FAIL]` / 2 用法错误 |

## 共享层

`tools/lib/` 放被多个工具复用的实现，避免同一判据抄两份（抄出来的迟早不一致）。

| 模块 | 内容 | 谁在用 |
|---|---|---|
| `tools/lib/common.js` | 参数解析（`parseArgs` / `intArg`）、`atomicWriteFile`、`sanitize`、Chrome 进程与用户数据目录探测、`probeCdp` / `waitForCdp`、`mergeStatus`（统一状态文件） | 三个 `.js` 工具 |
| `tools/lib/region.js` | 地区键单点实现：`KEYS`（5 个 `variations_*_country`）、`regionFiles()`、`inspectRegionFile()`、`stripRegionKeys()`、`regionReport()` | `clear-chrome-region.js`、`doctor.js` |

`tools/cdp.js` 用到的每个 CDP 方法与事件字段，都对着**随仓 vendor 的协议定义快照**
（`third-party/devtools-protocol/json/`）逐个核对过：核对脚本是
[`third-party/verify-cdp-fields.js`](../third-party/verify-cdp-fields.js)，
上游来源、vendored commit 与更新办法见 [third-party/README.md](../third-party/README.md)。
