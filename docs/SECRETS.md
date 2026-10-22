# 凭据与安全须知

> **一句话**：本仓**不存任何凭据** —— 唯一要用到口令的地方（路由器 SSH）走**兄弟仓**的
> `askpass.sh`；本篇**只写位置，不写值**，并说明哪些设备标识需要脱敏、怎么脱敏。

---

## 1. 一句话结论

**本仓不存任何凭据。**

- 没有 root 口令，没有 mihomo secret，没有订阅凭据，没有 API key；
- 三个工具脚本里**没有**写死的密码、token 或密钥；
- 文档与证据里出现的域名 / IP / MAC 属于**内部标识**，不是凭据，
  但公开前要按 §3.3 处理。

需要口令时，脚本去**兄弟仓**取 —— 取法与值的存放位置都在兄弟仓那边，
本篇只登记「从哪儿取」「谁在读」「上传前查什么」。

> **兄弟仓的叫法**：本仓正文把两个配套仓分别叫「**路由器系统仓**」与「**分流规则仓**」——
> 路由器系统仓管设备本体（OpenWrt、askpass 等），分流规则仓管代理分流规则（nft、策略组、节点）。
> 跨仓分工的完整口径见根 [AGENTS.md](../AGENTS.md) §2 与 [TROUBLESHOOTING.md](TROUBLESHOOTING.md) §0：
> 路由器侧的 fake-IP 段 / nft 表 / 策略组 / 节点选择归那两个仓，本仓只做客户端侧的定位与取证。

---

## 2. 凭据位置清单

| 凭据 | 真源（值在这儿） | 本仓里**不出现值**的对应物 | 处置 |
|---|---|---|---|
| **路由器 root 口令** | 兄弟仓（路由器系统仓）的 `recovery/local-tools/askpass.sh`；值来自环境变量 **`ROUTER_PASSWORD`** 或 `.router-password` 文件（都在兄弟仓那侧） | `tools/verify-gemini.sh` 只把 `SSH_ASKPASS` 指向那个脚本，**自身不含口令** | **不入库**。口令变了在兄弟仓那侧生效，本仓不用改 |
| **mihomo 控制台 secret** | 路由器 `/etc/ShellCrash/configs/ShellCrash.cfg` 的 `secret=` 行 | 本仓的脚本**不直接调用控制台 API**；经 SSH 执行的 `verify-fix.sh` 在**路由器本地**读该行，**secret 不回传到 PC、不进本仓** | 不入库；需要时去兄弟仓（分流规则仓）那边取 |
| **订阅 / 节点凭据** | 兄弟仓（分流规则仓）与路由器上的 `/etc/ShellCrash/yamls/` | **不在本仓** | 不入库 |
| **浏览器 profile 里的账号态**（cookie / SID） | Chrome 自己的 profile 目录 | 本仓只做**只读 CDP 观察**（`tools/cdp.js`）与地区种子清理（`tools/clear-chrome-region.js`），**不复制 profile** | 不入库；`.gitignore` 已排除 `Local State` / `Local State.bak*` / `*.bak-region-*` |
| **证据里的内部标识**（真实域名 / IP / MAC / WiFi 名） | 路由器与节点的现网配置 | `evidence/agents/*.md` 里**逐字保留**了原始输出 | 见 §3.3：公开前必须替换 |

---

## 3. 这些东西从哪儿来

> **本文档只写位置，不写值；值在真源取，或在真源轮换之后再取。**
> 本仓里不存在「填进去就能用」的凭据。

### 3.1 root 口令：走兄弟仓的 askpass

`tools/verify-gemini.sh` 第 2 步要用 SSH 连路由器（`root@<路由器 IP>`）跑路由器侧检查，
口令由 **`SSH_ASKPASS`** 提供 —— 但它**不自己读口令**，只指向一个脚本：

```
tools/verify-gemini.sh
  └─ SSH_ASKPASS = $HERE/../../<兄弟仓>/recovery/local-tools/askpass.sh
```

那个 `askpass.sh` **归兄弟仓（路由器系统仓）所有**，按顺序找三个来源，第一个非空即用：

| 顺序 | 来源 | 说明 |
|---|---|---|
| 1 | 环境变量 **`ROUTER_PASSWORD`** | 临时用：`export ROUTER_PASSWORD='...'` |
| 2 | 兄弟仓内的 `recovery/local-tools/.router-password` | 单行文本文件；**已被那个仓的 `.gitignore` 排除** |
| 3 | `$HOME/.router-password` | 单行文本文件；**已被那个仓的 `.gitignore` 排除** |

三个都没有 → 脚本**报错退出（exit 1）**，并提示上面三条路径 ——
**绝不吐出一个空的或错的口令**。

> **本仓不提供、不保存、不分发这个口令。** 要换口令，去设备上换；
> 本仓这边只需要知道「值在兄弟仓那侧」。

### 3.2 路由器侧检查脚本：路径可用 `VERIFY_FIX` 覆盖

| 项 | 值 |
|---|---|
| 默认路径 | `$HERE/../../<兄弟仓>/recovery/archive/verify-fix.sh` |
| 覆盖方式 | 环境变量 **`VERIFY_FIX`**（或 `SIBLING_REPO` 指定仓目录名） |
| 干什么 | 在路由器上补 crontab 行、查 fake-IP 过滤是否生效、读策略组当前节点、查上次重启原因、连通性复测 |
| 凭据相关 | 脚本在**路由器本地**读 `/etc/ShellCrash/configs/ShellCrash.cfg` 的 `secret=` 行去问 mihomo 控制台 —— **值不出路由器** |

> `VERIFY_FIX` 覆盖的是**脚本路径**，不是凭据 —— 它指向的那份脚本本身也不含口令。

### 3.3 需要脱敏的设备标识：P2 级，公开前要替换

排障过程天然会碰到一批**能认出「哪台设备、哪条线路、哪套内网」**的标识。
它们**不是凭据**（拿到也连不上任何服务），但**公开前必须替换**。

| 类别 | 典型样子 | 会出现在哪 | 级别 |
|---|---|---|---|
| 真实**出口 IP**（节点地址） | 各线路的服务器地址 | `evidence/agents/` 的测量表、`docs/PITFALLS.md` 的举例 | **P2** |
| 真实**内网地址 / 端口** | 路由器网关 `10.0.0.1`、本机 `10.0.0.x`、控制台 `127.0.0.1:9999` | 排错手册的命令、证据分片的原始输出 | **P2** |
| 真实**域名** | 被测服务的具体域名 | 证据分片的原始输出 | **P2** |
| **MAC / IPv6 PD / ULA** | 网卡硬件地址、运营商下发的 IPv6 前缀、设备的 ULA | 抓包与 `ip neigh` 的输出 | **P2** |
| **WiFi 名（SSID）** | 家用路由器的无线网络名 | 脚本参数、复现步骤 | **P2** |
| **本机绝对路径** | `C:\Users\<用户名>\...`、`/Users/<用户名>/...` | 脚本默认值、文档里的命令 | **P2** |
| **登录账号标识** | 邮箱、账号名 | 证据分片里「已登录某账号」的描述 | **P2** |

**P2 的含义**：不是凭据，**不构成直接的安全敞口**，
但它们会暴露「哪台设备、哪条线路、哪套内网」——
**上传到公开远端前必须替换**（换成占位符或网段化的写法）。

替换时注意两条纪律：

- **只换值，不改结构** —— 这些文件是「当时是什么样」的原始证据，改结构就失去了证据价值；
- **命令原文与判定数值不动** —— 数字与报错原文是判定方法的一部分。

### 3.4 怎么脱敏：本仓用的占位符写法

| 场景 | 写法 | 例子 |
|---|---|---|
| 设备标识 | `<REDACTED-…>` | `<REDACTED-mac>`、`<REDACTED-ipv6-pd>`、`<REDACTED-ula>` |
| 内网地址 | 示例网段 + `x` | `10.0.0.x`、`192.168.1.x` |
| 路由器网关 | 写成变量名或示例值 | `<路由器 IP>`、`10.0.0.1`（示例） |
| 本机路径 | 用户名占位 / 环境变量 | `C:/Users/<你>/AppData/Local/...`、`%LOCALAPPDATA%\Google\Chrome\User Data` |
| 脚本里的本机值 | 环境变量 + 占位符默认值 | `SSID_ROUTER="${SSID_ROUTER:-YOUR_ROUTER_SSID}"` |
| 账号标识 | `<REDACTED-account>` | `<REDACTED-account>` |

大体积截图（`evidence/*.png`）已由 `.gitignore` 排除，只本地留存，
**不会随仓库分发**。

### 3.5 环境变量 → 谁在读

| 环境变量 | 谁在读 | 默认值 | 缺失时 |
|---|---|---|---|
| **`ASKPASS`** | `tools/verify-gemini.sh` —— 覆盖 `SSH_ASKPASS` 指向的口令来源脚本 | `$HERE/../../<兄弟仓>/recovery/local-tools/askpass.sh` | 用默认值（要求兄弟仓与本仓**同级摆放**） |
| **`VERIFY_FIX`** | `tools/verify-gemini.sh` —— 覆盖路由器侧检查脚本的路径 | `$HERE/../../<兄弟仓>/recovery/archive/verify-fix.sh` | 用默认值（同上） |
| **`SIBLING_REPO`** | `tools/verify-gemini.sh` —— 兄弟仓的**目录名**（仓名含设备型号，按自己的实际目录改） | 兄弟仓的仓名 | 用默认值 |
| **`SSID_ROUTER` / `SSID_HOTSPOT`** | `tools/verify-gemini.sh` —— 要切换的无线网络名 | 占位符 `YOUR_ROUTER_SSID` / `YOUR_HOTSPOT_SSID` | **报错退出**，提示用环境变量指定 |
| **`ROUTER_IP`** | `tools/verify-gemini.sh` —— 路由器的 LAN 地址 | 示例值 `192.168.1.1` | 用默认值 |
| **`CDP_PORT`** | `tools/verify-gemini.sh` / `tools/cdp.js` —— Chrome 调试端口 | `9223`（脚本）/ `9222`（`cdp.js`） | 用默认值 |
| **`CHROME`** | `tools/verify-gemini.sh` —— chrome.exe 完整路径 | **自动探测**（常见安装路径 → `where chrome` → 注册表 App Paths） | 探测不到时**报错退出**，并提示用 `CHROME` 指定 |
| **`CHROME_USER_DATA`** | `tools/clear-chrome-region.js` —— Chrome 用户数据目录 | **自动探测**（`%LOCALAPPDATA%\Google\Chrome\User Data`） | 用自动探测结果 |
| **`ROUTER_PASSWORD`** | **不在本仓** —— 由兄弟仓的 `recovery/local-tools/askpass.sh` 读 | 无 | 那个脚本报错退出（exit 1），不静默 |

> `tools/cdp.js` 的 `CDP_PORT` / `CDP_URL` 与凭据**无关**（只是 Chrome 调试端口），
> 不列进本表；用法见 [TOOLS.md](TOOLS.md)。
>
> `verify-gemini.sh` 另外会自己设 `SSH_ASKPASS_REQUIRE=force` 与 `DISPLAY=:0` ——
> 这两个是 ssh 的行为开关，**不含口令**。

---

## 4. 上传公开仓库前的检查清单

```sh
# 1) 确认没有把凭据文件带进去
git ls-files | grep -E '\.(key|crt|pem|p12|pfx)$|\.env$|askpass\.sh|\.router-password'

# 2) 确认忽略规则生效
git status --ignored --short | grep -E '^!!' | head -20

# 3) 扫一遍将要提交的内容里有没有裸密钥特征
git diff --cached | grep -nE 'password=|secret=|Bearer |PrivateKey'

# 4) 扫一遍 P2 级设备标识（本机绝对路径 / 账号标识）
git diff --cached | grep -nE 'C:[/\\]Users[/\\]|/Users/[A-Za-z0-9._-]+/|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
```

**逐条确认清单**：

- [ ] `tools/verify-gemini.sh` 源码里**没有**明文口令（应只有 `SSH_ASKPASS="${ASKPASS:-...}"`）；
- [ ] 没有任何 `.router-password` / `askpass.sh` 进库 —— 那两个文件**归兄弟仓所有**；
- [ ] `evidence/agents/*.md` 里的 **P2 级内部标识**已按 §3.3 替换；
- [ ] `evidence/*.png` 不在库里（`.gitignore` 已排除 `/evidence/*.png`）；
- [ ] `Local State` / `*.bak-region-*` 不在库里（`.gitignore` 已排除）；
- [ ] 路由器 root 口令**已轮换** —— 本仓从没存过它，但**设备上的值仍然有效**。

> **本仓当前的实情（2026-10-20）**：本仓**不存任何凭据**；
> 口令链路全部走兄弟仓的 `askpass.sh`（读 `ROUTER_PASSWORD` /
> `.router-password`，缺失即报错退出）；证据里的 P2 级内部标识**仍在**，
> 上传公开远端前须替换。

---

## 5. 几条硬规矩

1. **新脚本不许把口令写死在文件里** —— 用 `SSH_ASKPASS` 指向一个读环境变量
   或受控文件的脚本；缺值时**明确报错退出**，绝不用空口令去连。
2. **文档里出现值只允许出现在历史记录里** —— 新的说明一律指向真源；
   需要在正文里举例时用 `<REDACTED-…>` 这类占位符。
3. **凭据一律不入本仓** —— 口令、secret、订阅 token、节点 uuid 统统不进来；
   需要它们的地方一律**跨仓引用**（写仓库名，不写物理路径）。
4. **日志里不要打印凭据** —— `Authorization` 头、订阅 URL 的 token 段，打印前先打码。
5. **证据文件只换值、不改结构** —— 原始输出、报错原文、命令与判定数值逐字保留。
6. **P2 级内部标识公开前要替换** —— 出口 IP、内网地址、真实域名、MAC / IPv6 PD、
   WiFi 名、本机绝对路径、账号标识。
7. **脚本里的本机值一律走环境变量 + 占位符默认值** —— 并在探测不到时**明确报错**，
   告诉用户用哪个环境变量指定。

---

## 6. 相关文档

| 要查什么 | 去哪 |
|---|---|
| 兄弟仓的凭据位置与轮换（**设备侧真源**） | 路由器系统仓的 `docs/SECRETS.md` |
| mihomo secret 与节点凭据的存放位置 | 分流规则仓的 `docs/SECRETS.md` |
| 工具的用法、副作用、前置条件 | [TOOLS.md](TOOLS.md) |
| 证据逐字保留的红线、内部标识怎么处理 | [DOC-RULES.md](DOC-RULES.md) §3、§3.1 |
| 方法与复现环境怎么分开写 | [DOC-RULES.md](DOC-RULES.md) §6 |
| 版本号与发版 | [VERSIONING.md](VERSIONING.md) |
| 忽略规则 | 仓库根 `.gitignore` |
| 许可证（本仓**不含**任何 GPL-3.0 派生件） | 仓库根 [LICENSE](../LICENSE) |

---

# 推送前脱敏规则（通用）

> **一句话**：推送前跑一次 `python tools/check-secrets.py`；它拦的是三类东西 ——
> 可用凭据、本机用户目录、真实邮箱。规则对 8 个仓完全一致，一处改全局同步。

---

## 1. 为什么需要这一条

历史教训：本系列仓的脱敏一度靠人记，结果漏过两次 ——

1. **同步脚本把 `--config` 的绝对路径回显进报告**，报告又作为 evidence 提交，
   本机用户目录就这样进了版本库。脚本默认值是按主目录推导的，本身没问题，
   问题出在那两行 `log("已写入 %s" % args.config)`。
2. **没有守卫的仓全靠自觉**。8 个仓里原本只有 2 个有 `tools/check-secrets.py`，
   规则里还不含本机路径。

所以规则固化成本篇 + 一个脚本 + 一个 CI 步骤。脚本是规则的**可执行版本**。

---

## 2. 三类拦截面

| 类别 | 例子 | 为什么拦 |
|---|---|---|
| **P0 可用凭据** | `gh[pousr]_…`、`sk-…`、`oc_sk_…`、`AIza…`、`glpat-…`、`-----BEGIN … PRIVATE KEY`、`AKIA…`、shadow 哈希、订阅 URL 的 token 段、代理节点 URI | 任何人拿到就能直接用 |
| **P1 本机用户目录** | `C:\Users\<名字>\…`（正反斜杠都拦） | 暴露用户名与软件安装布局，是社工的素材 |
| **P1 真实邮箱** | `…@qq.com` / `@163.com` / `@gmail.com` 等 | 暴露个人身份；GitHub noreply 邮箱不含这些域名，不会误伤 |

> **域名清单**：qq / 163 / 126 / gmail / outlook / hotmail / foxmail / sina / sohu。
> 只列国内常用与 Google / Microsoft 系 —— 加更多域名只会增加误报。

---

## 3. 三条放行规则（避免误报）

守卫不是越严越好，误报多了人就学会跳过它。所以明确放行三种情形：

### 3.1 占位符与示例值不算命中

行内含 `REDACTED` / `YOUR-` / `REPLACE-` / `<…>` / `example.com` / `placeholder`
/ `<用户名>` 等字样时，整行跳过。所以写文档时**优先用占位符**，能省掉很多例外。

### 3.2 文档类文件允许「截断形式」的描述性引用

变更说明里需要引用泄漏原文，否则读者不知道该改什么。形如下面的写法放行：

- 用户名位置就是省略号：`C:\Users\...\provider_config.json`
- 用户名用尖括号占位：`C:\Users\<名字>\...`
- 用户名后紧跟 `\...` 截断：`C:\Users\SansK\...`

**完整路径一律不放行。** 这条只对文档类文件生效
（`CHANGELOG.md` / `PROGRESS.md` / `SECURITY.md` / `CONTRIBUTING.md` / `docs/` /
`evidence/` / `memories/`）。

### 3.3 占位用户名不算命中

示例文件里的 `C:/Users/You/...`、`C:/Users/User/...`、`C:/Users/你的用户名/...`
是给用户照着改的模板，不是本机路径。

---

## 4. 白名单：只放「有意为之」

逐行白名单（`LINE_ALLOWLIST`）只放两类情形，**每条必须写清理由**：

- **机制上就该出现** —— 如 `.mailmap` 里的邮箱映射，那是 git 官方的作者身份
  归属机制，邮箱本来就该在里面。
- **确定不是敏感信息** —— 如 Kotlin 协程符号 `$scaleDone$1` 被 shadow 哈希
  正则误判。

加白名单前先问：能不能改用占位符绕开？能的话优先改内容，不要加白名单。

---

## 5. 推送前怎么做

```sh
# 1) 扫已跟踪文件（CI 跑的就是这个，退出码 0 才能推）
python tools/check-secrets.py

# 2) 扫工作树，含未跟踪文件（提交前自查用）
python tools/check-secrets.py --all
```

`--all` 模式**遵循 `.gitignore`** —— 本机配置（如 `config.local.json`）设计上
就不入库，报出来只是噪音。但它仍会扫**未跟踪且未被忽略**的新文件，所以能抓住
「新建了个文件忘了加 .gitignore」这种情况。

**CI 里有「敏感信息扫描」步骤**，推上去会自动跑。本地先跑一遍，别等 CI 报错。

---

## 6. 踩过的坑（写规则/脚本时注意）

1. **Python 单元素元组**：`SKIP_PREFIXES = ("tools/preview/")` 少了尾逗号，
   它不是元组而是字符串，`any(base.startswith(p) for p in "…")` 会逐字符迭代，
   导致所有以首字符开头的路径都被跳过 —— 守卫静默失效，扫描显示"通过"但实际
   什么都没查。必须写 `("tools/preview/",)`。
2. **`printf` 吞转义**：Git Bash 里 `printf 'C:\Users\...'` 把 `\U` 当 unicode
   转义，写出的测试文件内容是坏的，注入测试假通过。写含反斜杠的测试内容要用
   Python 的 `chr(92)`。
3. **replace-text 只匹配字面量**：重写历史时，文档里引用泄漏原文的写法
   （如 `git grep Users.SansK`，没有 `C:\` 前缀）匹配不到，要单独列规则。
4. **模板多行块替换**：按单行字符串替换跨多行的配置块会留下孤儿行导致
   IndentationError；先在源里 `assert` 锚点存在再替换，失败即中止。
5. **守卫脚本自己的注释会被自己的规则拦到** —— 注释里别出现完整路径字面量。

---

## 7. 相关文档

| 要查什么 | 去哪 |
|---|---|
| 凭据从哪读、怎么轮换 | 本篇其余章节 |
| 上报安全问题 | [../SECURITY.md](../SECURITY.md) |
| 提交前自检 | [../CONTRIBUTING.md](../CONTRIBUTING.md) |
| 文档怎么写 | [DOC-RULES.md](DOC-RULES.md) |
