# 工具清单

> **一句话**：`tools/` 下三个工具的作用、副作用与前置条件正本 —— 根 README 只留「使用」速览，细节以本篇为准。

| 工具 | 作用 | 副作用 | 前置条件 |
|---|---|---|---|
| `tools/clear-chrome-region.js` | 清掉 Chrome 的地区种子：`Local State` 与 `Default/Preferences` 里 5 个 `variations_*_country` 键（含 `variations.` 嵌套） | **改写 Chrome 配置文件**；写前先留 `.bak-region-<时间戳>` 备份 | **Chrome 已完全退出**（退出时会重写 Local State，在线改会被覆盖）；Node.js；Chrome 目录自动探测，`CHROME_USER_DATA` 或第一个命令行参数可覆盖 |
| `tools/verify-gemini.sh` | 复测 Gemini：切 WiFi → SSH 跑路由器侧检查 → 起临时 Chrome（9223）→ CDP 抓日志 → 截图 → 清理并切回热点 | **会切换本机 WiFi**；会起一个临时 Chrome 进程；结束后删临时 profile；截图写到本仓 `evidence/gemini-after.png` | Git Bash；路由器可达（`ROUTER_IP`，默认 `192.168.1.1`）；兄弟仓要与本仓同级（脚本默认从 `../../<路由器系统仓>/recovery/...` 找 `askpass.sh` 与 `verify-fix.sh`，可用 `SIBLING_REPO` / `ASKPASS` / `VERIFY_FIX` 覆盖） |
| `tools/cdp.js` | 通过 CDP 接管**已在运行**的 Chrome，抓渲染状态、`Log.entryAdded`、`Runtime.consoleAPICalled`、`Runtime.exceptionThrown`、`Network.loadingFailed`、非 2xx 响应 | 无（只读；不碰浏览器设置、不改 profile） | Node.js ≥ 18；一个开着 `--remote-debugging-port` 的 Chrome；`CDP_PORT` / `CDP_URL` 可选覆盖 |

环境变量清单（含脱敏口径）见 [SECRETS.md](SECRETS.md) §3.5；
每个工具对应的已知坑见 [PITFALLS.md](PITFALLS.md)，副作用变更时的同步义务见 [MAINTENANCE.md](MAINTENANCE.md) §4。
