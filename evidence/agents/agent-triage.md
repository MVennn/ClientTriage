# agent-triage —— ClientTriage 工具层加固

状态: 完成（门禁全绿；完整复测与真写入路径未端到端执行，见「没做的事」）
TASK_RESULT: 新增只读体检 `tools/doctor.js` 与共享层 `tools/lib/{common,region}.js`；重写 `verify-gemini.sh`（--status/--help/trap 兜底/临时根目录守卫/ROUTER_IP 形状校验/截图轮转）；`clear-chrome-region.js` 与 `cdp.js` 收敛到共享层并修掉 --dry-run 落账；docs 五处同步。

## 改动文件清单

| 路径:行号 | 一句话 |
|---|---|
| `tools/lib/common.js:24` | `sanitize()`：剥 ANSI CSI/OSC/DCS 与控制字符再输出 —— 被诊断页面给的是不可信文本，原样 print 就是日志注入面 |
| `tools/lib/common.js:103` | `atomicWriteFile()`：同目录临时文件 → fsync → rename，替代「截断再写」，断电不再留下半截 JSON |
| `tools/lib/common.js:158` | `mergeStatus()`：统一状态文件 `.work/triage-status.json` 的唯一写入口（带 schema 版本） |
| `tools/lib/common.js:175-252` | `chromeProcesses/chromeRunning/defaultUserDataDir/findChromeExe/cdpBase/probeCdp/listTargets/waitForCdp`：原先 cdp.js 与 bash 各写一份，收敛到单点 |
| `tools/lib/region.js:1` | 地区键判据单点实现（`KEYS`/`regionFiles`/`inspectRegionFile`/`stripRegionKeys`/`regionReport`），供清理与体检共用 |
| `tools/doctor.js:94` | 新增只读体检主流程：13 项按「节点 → 浏览器 → 联动」排序 |
| `tools/doctor.js:76-82` | `dispWidth()/padDisp()`：按显示宽度对齐（中文占两列，`padEnd` 会错位） |
| `tools/doctor.js:311` | `--write-status` 才 `mergeStatus("doctor", …)`；其余路径一字节不写 |
| `tools/cdp.js:23` | 改接 `./lib/common`，删掉本地 sanitize/探针/状态写入的重复实现 |
| `tools/cdp.js:27` | `CAPS` 逐类封顶（log/console/exception/failed/resp），超出只记 `seen` 与 `truncated` |
| `tools/cdp.js:72-83` | `--status`：`probeCdp` + `waitForCdp(2000)` 判「端口 + page target 都就绪」，给 bash 与 CI 一个只读判据 |
| `tools/clear-chrome-region.js:75` | `--status` 分支早退，只读报告地区键，不写文件 |
| `tools/clear-chrome-region.js:154` | 写入改走 `atomicWriteFile` |
| `tools/clear-chrome-region.js:173-185` | `--dry-run` 不再写统一状态文件 —— 头注释承诺「不写任何文件」必须字面成立 |
| `tools/verify-gemini.sh:58` | `tmp_base_ok()`：`TMPDIR` 归一后拒绝空、`/`、`//`、单字母盘符根、`/mnt/<盘>`，否则 `rm -rf` 会对着根目录跑 |
| `tools/verify-gemini.sh:87-106` | `kill_temp_chrome`（只杀本 PID）/ `kill_stale_temp_chrome`（起新实例前清残留）/ `cleanup` + `trap … EXIT INT TERM`：失败与 Ctrl-C 也杀临时 Chrome、删临时目录、切回热点 |
| `tools/verify-gemini.sh:150` | `resolve_chrome()` 拆出，`--status` 与完整流程共用同一套定位逻辑；含单引号时明确 `exit 2` |
| `tools/verify-gemini.sh:162` | `valid_router_addr()`：IPv4 或简单主机名，拒绝空格/引号/分号（该值会进 `ssh` 参数与 `netsh`） |
| `tools/verify-gemini.sh:185` | `cdp_probe()` 改用 `node tools/cdp.js --status`，删掉两处 `curl` 轮询 |
| `tools/verify-gemini.sh:191` | `run_status()`：`--status` 只读体检（不切 WiFi、不起 Chrome），退出码 0/1/2 |
| `tools/verify-gemini.sh:343-346` | 截图轮转：`ls -1t … | tail -n +$((KEEP_SHOTS+1))` 逐个删，`evidence/` 不再无限长 |
| `docs/TOOLS.md:3,8,10,23-45` | 工具表补 `doctor.js` 与三个工具的只读子命令；新增「只读入口与退出码」「共享层」两节 |
| `docs/PITFALLS.md:301,313,325` | 新增 #20 原子写 / #21 事件上限与日志注入 / #22 临时根目录守卫 |
| `docs/SECRETS.md:128-129` | `CHROME_USER_DATA` 补 `doctor.js`；新增 `KEEP_SHOTS` 行 |
| `docs/MAINTENANCE.md:71,97,168` | §3.2 补截图轮转上限；§4 副作用表补 `doctor.js`；§8 补本轮维护记录 |
| `CHANGELOG.md:12-31` | 新增 `[未发布]` 段（版本号进位留给发版时按 VERSIONING 判定） |
| `README.md:29,37,44,50` | 使用段补「动手前先体检」与 ⓪ 条目；工具数 3→4；依赖清单去掉已不再使用的 `curl` |

## 为什么改

1. **同一判据不许有两份**：地区键的判定原本只写在 `clear-chrome-region.js` 里，只读体检要判同一件事只能抄第二份 —— 抄出来的迟早不一致（体检说干净、清理说脏）。故抽 `tools/lib/region.js`。
2. **写用户配置必须原子**：`writeFileSync` 先截断再写，中断即留下半截 `Local State`，Chrome 会重置整个配置，比不清种子严重得多。故 `atomicWriteFile`。
3. **不可信文本不许原样上终端**：页面标题/控制台文本里的 ANSI 转义与回车能覆盖上一行结论，既是日志注入也让人误读证据。故 `sanitize()`。
4. **清理必须有兜底**：原先 `die()` 只切回热点、不杀临时 Chrome，失败一次就会让下一次复测连到旧实例（PITFALLS #17 的老坑）。故 `trap` + 本 PID 精确匹配。
5. **临时目录不能只靠信任**：`TMPDIR=/` 时 `rm -rf` 直接对根目录跑。故 `tmp_base_ok()`。
6. **失败要可诊断、状态要机器可读**：`--status` / `--json` / 统一状态文件让「哪里不满足」不必靠人读长日志。

## 验证命令与退出码

| 命令 | 退出码 | 关键输出 |
|---|---|---|
| `python -I tools/check-docs.py` | 0 | `[OK] 24 篇文档全部通过（链接 / 锚点 / 测试块 / 引言块）` |
| `python -I tools/check-secrets.py` | 0 | 已跟踪文件 0 命中 |
| `python -I tools/check-secrets.py --all` | 0 | 75 个文件 0 命中（含工作树未跟踪文件） |
| `node --check tools/doctor.js` | 0 | — |
| `node --check tools/clear-chrome-region.js` | 0 | — |
| `node --check tools/lib/common.js` / `lib/region.js` | 0 | — |
| `node --check tools/cdp.js` | 0 | — |
| `bash -n tools/verify-gemini.sh` | 0 | — |
| `node tools/doctor.js` | 0 | 11 项通过 / 2 项告警 / 0 项失败（告警=地区种子 2 个键、CDP 9222 未监听） |
| `node tools/doctor.js --json` | 0 | 含 `schema`/`counts`/`checks` |
| `node tools/doctor.js --bogus` | 2 | 打用法 |
| `node tools/clear-chrome-region.js --status` | 0 | 列出两个 `variations_*` 键，结论「需要清理」 |
| `node tools/clear-chrome-region.js --status --json` | 0 | `dirty:true` |
| `node tools/clear-chrome-region.js --dry-run` | 0 | 「完成（--dry-run：未写入任何文件）」；状态文件 mtime 前后一致（unchanged=True） |
| `bash tools/verify-gemini.sh --status` | 0 | 1 项告警（SSID 占位符）/ 0 项失败 |
| `bash tools/verify-gemini.sh --help` | 0 | 头注释 15 行，不含 `set -u` |
| `bash tools/verify-gemini.sh --bogus` | 2 | 打用法 |
| `TMPDIR=/ bash tools/verify-gemini.sh --status` | 2 | `!! 临时目录不可用…`（`C:/`、`/c` 同） |
| `ROUTER_IP='1.2.3.4; rm -rf /' bash tools/verify-gemini.sh --status` | 1 | `[FAIL] ROUTER_IP 不合法` |
| CR 计数（三个 shell 文件） | — | `CR count = 0` |

## 最值得主线复核的 3 条风险

1. **`verify-gemini.sh` 的完整流程本轮没有端到端跑过**（需要真实 `SSID_ROUTER`/`SSID_HOTSPOT` 与可达路由器）：只验证了 `--status`、`--help`、用法错误与临时目录/地址守卫。`trap` 重构后如果 `netsh` 切回热点失败，脚本只会打警告而**停在路由器 WiFi 上** —— 这是唯一会改变本机网络状态的分支，值得先手动跑一次完整复测。
2. **`cdp.js` 的抓取路径（非 `--status`）本轮未复跑**：diff 达 315 行（改接共享层 + `CAPS` + `sanitize`）。只读判据走的是 `--status`。建议在真 Chrome 上跑一次 `CDP_PORT=9223 node tools/cdp.js`，确认 `truncated` 与各 section 输出与改前一致。
3. **`clear-chrome-region.js` 的 apply 路径本轮未执行**（只跑了 `--status`/`--dry-run`）：原子写与 `.bak-region-*` 备份只在代码层与 `--dry-run` 计划里验证。真跑一次会改写本机 `Local State` 并生成备份 —— 是否在本机执行由主线决定（改前 Chrome 必须完全退出）。

## 没做的事与原因

- **没跑完整复测**：会切本机 WiFi 并 ssh 进路由器，属于改变运行环境与外设状态的动作，留给主线在合适时机执行（`bash tools/verify-gemini.sh`）。
- **没改版本号**：按任务硬约束不动版本号，只在 CHANGELOG 加 `[未发布]` 段；进位（功能更新 → 次版本）由发版时按 `docs/VERSIONING.md` 判定。
- **`doctor.js` 未读 `SIBLING_REPO`**：兄弟仓检查目前按目录名 `AX3000TOpenwrt` 推导（与 `verify-gemini.sh` 默认值一致），但没像后者那样支持环境变量覆盖 —— 需要与 `verify-gemini.sh` 的解析逻辑再抽一层，本轮为控制改动面没做。
- **没碰 `third-party/`、没改 `package.json`/`vite.config.ts`/`tsconfig.json`、没 git add/commit**：按硬约束。
- **没新增外部网络依赖**：所有新代码只用 Node 内置模块与既有 `fetch`。
