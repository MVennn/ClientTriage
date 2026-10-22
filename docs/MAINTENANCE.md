# 维护流程

> **一句话**：本仓的「日常维护」只做三件事 —— **让地区种子能重复执行**、
> **管住证据文件的去留**、**把工具脚本的副作用登记在 [TOOLS.md](TOOLS.md)**。

文档规则（新增 / 删除文档要连带改哪些）在 [DOC-RULES.md](DOC-RULES.md)；
排障步骤在 [TROUBLESHOOTING.md](TROUBLESHOOTING.md)。

---

## 1. 触发语与术语

| 说法 | 对应动作 |
|---|---|
| 做一次大扫除 / 收尾清理 | §3 证据整理 → §4 副作用复核 → §5 文档对账 → §6 收尾清单 |
| 清一次地区种子 | §2 |
| 巡检 / 体检 | 只跑 §3 的清单核对，不删东西 |

本仓没有编译产物、没有依赖锁、没有测试套件 —— 「大扫除」的重心在**证据与文档**，
不在代码。

## 2. 地区种子必须能重复执行

**为什么**：Chrome 的地区种子不是一次清完就永久生效的。

- `variations_permanent_consistency_country` / `variations_safe_seed_permanent_consistency_country`
  **按 Chrome 版本号绑定** —— 浏览器升级后会被重新写入；
- `variations_country` 会随会话与服务端重新协商。

所以「清种子」是**周期性动作**，不是一次性修复。工具必须满足：

| 要求 | 现状 |
|---|---|
| **幂等** —— 没有种子时不报错 | `tools/clear-chrome-region.js` 打印「（本来就没有地区键）」并正常退出 |
| **先备份后写** | 每次写前复制 `Local State` / `Preferences` 为 `.bak-region-<时间戳>` |
| **可重复** —— 跑第二遍不会把别的配置弄坏 | 只删 5 个 `variations_*_country` 键（含 `variations.` 嵌套），其余键原样保留 |
| **前置条件显式** | 脚本头注释写明「必须在 Chrome 完全退出时运行」；[PITFALLS.md](PITFALLS.md) 有对应坑位 |

**每次清完必须复验**，别只信脚本输出：

```sh
# 清完、Chrome 重启后再读一次，确认真的没了
node -e "const j=require(process.env.LOCALAPPDATA+'/Google/Chrome/User Data/Local State'); \
  console.log(j.variations_country, j.variations_permanent_consistency_country)"
```

**Chrome 升级后的例行动作**：

1. 清一次种子（脚本）；
2. 清一次 Chrome 磁盘缓存（旧地区页面）；
3. 复测 Gemini 与 Web Store（[TROUBLESHOOTING.md](TROUBLESHOOTING.md) §1、§2）。

## 3. 证据文件的命名与保留期限

### 3.1 命名

| 类型 | 命名 | 放哪 | 谁写 |
|---|---|---|---|
| 子代理只读审计分片 | `agent-<name>.md`（小写、连字符、名字唯一） | `evidence/agents/` | **只有子代理**，一个代理一个文件 |
| 主会话的阶段性结论 | 落到 `docs/` 的正文档里 | `docs/` | 主会话 |
| 截图 | `evidence/<主题>-<序号>.png`（例：`gemini-after.png`） | `evidence/` | 主会话 |
| 临时日志 | `evidence/<主题>.log` | `evidence/` | 主会话 / 子代理 |

**分片文件的开头统一写三行**：`状态:`（进行中 / 已完成）、`范围:`、以及结尾的 `TASK_RESULT:` 一行结论。

### 3.2 保留期限

| 对象 | 期限 | 理由 |
|---|---|---|
| `evidence/agents/*.md` | **永久** | 原始证据。结论被正文档吸收后**也不删** —— 那时的结论也是当时的事实（见 [DOC-RULES.md](DOC-RULES.md) §3） |
| `evidence/*.png` | 本地长期留存，**不入版本库**（`.gitignore` 已排除 `/evidence/*.png`） | 单张 170 KB 起、体积大、且截图不能证明修复完成 |
| `evidence/*.log` | 7 天 | 排障过程记录；结论提炼进文档后就没必要留全文 |
| Chrome 配置备份 `*.bak-region-*` | 保留最近 3 份 | 回滚用；多了分不清哪份对 |
| 临时 Chrome profile（`%TEMP%\verify-prof`、`verify-shot`） | **每次跑完即删** | `tools/verify-gemini.sh` 的第 5 步负责删；删不掉就是脚本没跑完 |

**红线**：`evidence/agents/` 下的分片**不许删、不许改写内容**。
要修正内容就在新的分片里写，并让主会话更新正文档 —— 原文保留是证据链的一部分。

> **例外（只换值，不改结构）**：分片里的 **P2 级设备标识**（出口 IP、内网地址、真实域名、
> MAC / IPv6 PD、WiFi 名、本机绝对路径、账号标识）**可以替换成占位符或示例值** ——
> 口径与写法见 [SECRETS.md](SECRETS.md) §3.3 / §3.4，边界见 [DOC-RULES.md](DOC-RULES.md) §3.1。
> 换的只有值：**报错原文、错误码、命令与参数、判定数值、结论一个字都不动**。
> 证据里若出现能用来连上某个服务的凭据（订阅链接、节点 uuid、口令），**必须脱敏**。

## 4. 工具脚本的副作用必须登记在 docs/TOOLS.md

**规则**：任何脚本只要会**改用户机器上的状态**，它的副作用必须登记在
[TOOLS.md](TOOLS.md) 的工具表**副作用**列，并在 [PITFALLS.md](PITFALLS.md) 有对应坑位。

**当前三个使用者工具的副作用登记**：

| 脚本 | 副作用 | 登记位置 |
|---|---|---|
| `tools/clear-chrome-region.js` | 改写 Chrome 的 `Local State` 与 `Default/Preferences`（写前留 `.bak-region-<ts>` 备份） | [TOOLS.md](TOOLS.md) 工具表 + [PITFALLS.md](PITFALLS.md) |
| `tools/verify-gemini.sh` | **切换本机 WiFi**（切到路由器 → 切回热点）；起一个临时 Chrome 进程；删临时 profile；截图写到本仓 `evidence/gemini-after.png` | [TOOLS.md](TOOLS.md) 工具表 + [PITFALLS.md](PITFALLS.md) |
| `tools/cdp.js` | 无（只读；连的是已经起好的 Chrome） | [TOOLS.md](TOOLS.md) 工具表 |

**新增或改动副作用时**，按 [DOC-RULES.md](DOC-RULES.md) §5 的触发矩阵同步四处：
[TOOLS.md](TOOLS.md) 工具表、[PITFALLS.md](PITFALLS.md)、本篇 §4 的表。

**特别提醒**：`verify-gemini.sh` 会**把本机 WiFi 切走**。
在别人正在用这台机器、或机器上跑着依赖网络的任务时，**不要跑它**。

## 5. 文档对账清单

每次「做一次大扫除」都要过一遍：

- [ ] `docs/README.md` 的索引与 `docs/` 实际文件一一对应（**无孤儿、无死链**）；
- [ ] 每篇文档开头都有 `> **一句话**：…` 引言块；
- [ ] [TOOLS.md](TOOLS.md) 工具表与 `tools/` 实际文件一一对应；
- [ ] `tools/` 脚本头注释的用法与 [TOOLS.md](TOOLS.md) 描述一致；
- [ ] 根 [CHANGELOG.md](../CHANGELOG.md) 的「未发布」段记录了本轮所有改动；
- [ ] 根 [PROGRESS.md](../PROGRESS.md) 追加了本轮批次（一节，含状态与待解决）；
- [ ] 事实与命令原文没有被改写（见 [DOC-RULES.md](DOC-RULES.md) §3）；
- [ ] 指向其它仓的引用写的是**仓库名**（路由器系统仓 / 分流规则仓），
      不是物理路径；
- [ ] 正文里没有绑定具体环境的取值（机型、网段、出口、仓名）——
      这些只应出现在 [VERIFIED-ENV.md](VERIFIED-ENV.md)（见 [DOC-RULES.md](DOC-RULES.md) §6）；
- [ ] 仓内没有本机绝对路径、账号标识等 P2 级设备标识
      （见 [SECRETS.md](SECRETS.md) §3.3）；
- [ ] 脚本新增/改名的环境变量已登记在 [SECRETS.md](SECRETS.md) §3.5；
- [ ] `.gitignore` 覆盖了新出现的产物类型，且**没有误伤源码与文档**。

## 6. 收尾清单

按顺序做，每步都要真的执行：

1. 确认没有并行的子代理还在跑（否则它会往 `evidence/agents/` 写，你也正在写 —— 各写各的，不冲突，
   但主会话的汇总要等它们都结束）；
2. 跑一遍 §5 的文档对账清单；
3. 清理过期日志（保留 7 天内）与多余备份（保留最近 3 份）；
4. 确认临时 Chrome profile 已删干净（目录在系统临时目录下，`%TEMP%`）：

   ```bash
   ls -d "$TEMP/verify-prof" "$TEMP/verify-shot" 2>/dev/null
   # 有输出就删掉：rm -rf 上面两个目录
   ```

5. 确认没有残留的临时 Chrome 进程：

   ```powershell
   Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" |
     Where-Object { $_.CommandLine -match 'verify-prof|verify-shot' } |
     ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
   ```

6. **不要**动你日常 Chrome 的 profile —— 只清种子，不删 profile。

## 7. 红线（一律不动）

- **证据原文**：`evidence/agents/*.md` 的全部内容（含原始输出、报错原文、命令）；
- **`docs/CHROME-GOOGLE-DIAGNOSIS.md`**：阶段性结论原文，即使结论已过期 —— 过期由索引与
  [LNA-FAKE-IP.md](LNA-FAKE-IP.md) 标注，**不删不改**；
- **`tools/` 三个使用者脚本的逻辑**（`clear-chrome-region.js` / `verify-gemini.sh` / `cdp.js`）：它们是别人正在用的入口，改行为前先改 [TOOLS.md](TOOLS.md) 的副作用列；
- **你日常 Chrome 的 profile**：只允许清 5 个 `variations_*_country` 键；
- **任何凭据**：本仓不应出现明文口令、订阅链接、节点 UUID。

## 8. 上一次维护记录

| 时间 | 做了什么 | 结果 |
|---|---|---|
| 2026-10-19 | Chrome LNA 拦截 fake-IP 的诊断与路由器侧修复（`fake_ip_filter` 加 Google 域、`quicguard.nft`、Play CDN 按 IP 分流） | 扩展安装恢复；**但「已修复」结论不完整** —— 同一机制仍导致 Gemini 只剩输入框 |
| 2026-10-20 | Google 地区判定全量实测（28 个出口逐个测 cc）；Gemini「只剩输入框」的真根因定位（islands bundle 被 LNA/CORS 拦）；`fake_ip_filter` 补 `+.gstatic.com` / `+.googleapis.com`（共 21 条） | Gemini 恢复（用户确认「gemini 修好了」）；**但判据当时仍有缺陷**（靠「外壳能打开」结案），补在 [LNA-FAKE-IP.md](LNA-FAKE-IP.md) §5 |
| 2026-10-20 | **本仓建仓**：从原多仓工作区拆出，补齐 README / AGENTS / CHANGELOG / NOTICE / `.gitignore` / `docs/**` 全套文档 | 仓库可独立上传 GitHub、独立看懂 |
| 2026-10-22 | 收尾大扫除：复核临时 Chrome profile / 残留进程 / `__pycache__` / 过期日志与备份；对齐 `docs/README.md` 索引与 [TOOLS.md](TOOLS.md) 的脚本清单（补两个维护脚本）；Release 说明补「反馈入口」规则 | 临时 profile 与残留进程均为 0，仓库无 L1 垃圾；`python tools/check-docs.py` 退出码 0 |
