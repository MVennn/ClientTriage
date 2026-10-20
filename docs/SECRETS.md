# 凭据与安全须知

> **一句话**：本仓**不存任何凭据** —— 唯一要用到口令的地方（路由器 SSH）走兄弟仓
> `AX3000TOpenwrt` 的 `askpass.sh`；本篇**只写位置，不写值**。

---

## 1. 一句话结论

**本仓不存任何凭据。**

- 没有 root 口令，没有 mihomo secret，没有订阅凭据，没有 API key；
- 三个工具脚本里**没有**写死的密码、token 或密钥；
- 文档与证据里出现的域名 / IP / MAC 属于**内部标识**，不是凭据，
  但公开前要按 §3.3 处理。

需要口令时，脚本去**兄弟仓**取 —— 取法与值的存放位置都在 `AX3000TOpenwrt` 仓，
本篇只登记「从哪儿取」「谁在读」「上传前查什么」。

> 跨仓分工的完整口径在根 [README.md](../README.md) 与根 [AGENTS.md](../AGENTS.md)：
> 路由器侧的 fake-IP 段 / nft 表 / 策略组 / 节点选择归 `AX3000TOpenwrt` 与
> `ShellcrashRules` 两个仓，本仓只做客户端侧的定位与取证。

---

## 2. 凭据位置清单

| 凭据 | 真源（值在这儿） | 本仓里**不出现值**的对应物 | 处置 |
|---|---|---|---|
| **路由器 root 口令** | 兄弟仓 `AX3000TOpenwrt` 的 `recovery/local-tools/askpass.sh`；值来自环境变量 **`ROUTER_PASSWORD`** 或 `.router-password` 文件（都在兄弟仓那侧） | `tools/verify-gemini.sh` 只把 `SSH_ASKPASS` 指向那个脚本，**自身不含口令** | **不入库**。口令变了在兄弟仓那侧生效，本仓不用改 |
| **mihomo 控制台 secret** | 路由器 `/etc/ShellCrash/configs/ShellCrash.cfg` 的 `secret=` 行 | 本仓的脚本**不直接调用控制台 API**；经 SSH 执行的 `verify-fix.sh` 在**路由器本地**读该行，**secret 不回传到 PC、不进本仓** | 不入库；需要时去 `AX3000TOpenwrt` / `ShellcrashRules` 那两个仓取 |
| **机场订阅 / 节点凭据** | 兄弟仓 `ShellcrashRules` 与路由器上的 `/etc/ShellCrash/yamls/` | **不在本仓** | 不入库 |
| **浏览器 profile 里的账号态**（cookie / SID） | Chrome 自己的 profile 目录 | 本仓只做**只读 CDP 观察**（`tools/cdp.js`）与地区种子清理（`tools/clear-chrome-region.js`），**不复制 profile** | 不入库；`.gitignore` 已排除 `Local State` / `Local State.bak*` / `*.bak-region-*` |
| **证据里的内部标识**（真实域名 / IP / MAC） | 路由器与节点的现网配置 | `evidence/agents/*.md` 里**逐字保留**了原始取值 | 见 §3.3：公开前必须替换 |

---

## 3. 这些东西从哪儿来

> **本文档只写位置，不写值；值在真源取，或在真源轮换之后再取。**
> 本仓里不存在「填进去就能用」的凭据。

### 3.1 root 口令：走兄弟仓的 askpass

`tools/verify-gemini.sh` 第 2 步要用 SSH 连路由器（`root@10.0.0.1`）跑路由器侧检查，
口令由 **`SSH_ASKPASS`** 提供 —— 但它**不自己读口令**，只指向一个脚本：

```
tools/verify-gemini.sh
  └─ SSH_ASKPASS = $HERE/../../AX3000TOpenwrt/recovery/local-tools/askpass.sh
```

`askpass.sh` **归 `AX3000TOpenwrt` 仓所有**，按顺序找三个来源，第一个非空即用：

| 顺序 | 来源 | 说明 |
|---|---|---|
| 1 | 环境变量 **`ROUTER_PASSWORD`** | 临时用：`export ROUTER_PASSWORD='...'` |
| 2 | `AX3000TOpenwrt/recovery/local-tools/.router-password` | 单行文本文件；**已被那个仓的 `.gitignore` 排除** |
| 3 | `$HOME/.router-password` | 单行文本文件；**已被那个仓的 `.gitignore` 排除** |

三个都没有 → 脚本**报错退出（exit 1）**，并提示上面三条路径 ——
**绝不吐出一个空的或错的口令**。

> **本仓不提供、不保存、不分发这个口令。** 要换口令，去设备上换；
> 本仓这边只需要知道「值在兄弟仓那侧」。

### 3.2 路由器侧检查脚本：路径可用 `VERIFY_FIX` 覆盖

| 项 | 值 |
|---|---|
| 默认路径 | `$HERE/../../AX3000TOpenwrt/recovery/archive/verify-fix.sh` |
| 覆盖方式 | 环境变量 **`VERIFY_FIX`** |
| 干什么 | 在路由器上补 crontab 行、查 fake-IP 过滤是否生效、读策略组当前节点、查上次重启原因、连通性复测 |
| 凭据相关 | 脚本在**路由器本地**读 `/etc/ShellCrash/configs/ShellCrash.cfg` 的 `secret=` 行去问 mihomo 控制台 —— **值不出路由器** |

> `VERIFY_FIX` 覆盖的是**脚本路径**，不是凭据 —— 它指向的那份脚本本身也不含口令。

### 3.3 证据文件里的内部标识：P2 级，公开前要替换

`evidence/agents/` 下的 9 份只读审计分片按 [docs/DOC-RULES.md](DOC-RULES.md) §3
「实测证据逐字保留」的要求，**逐字保留了当时的原始输出**。其中含三类**内部标识**：

| 类别 | 例子 | 级别 |
|---|---|---|
| 真实**出口 IP**（节点地址） | 各线路的服务器地址 | **P2** |
| 真实**内网地址 / 端口** | `10.0.0.1`、`127.0.0.1:9999`、`127.0.0.1:7890` | **P2** |
| 真实**域名与 MAC** | 被测服务域名、终端标识 | **P2** |

**P2 的含义**：不是凭据，**不构成直接的安全敞口**，
但它们会暴露「哪台设备、哪条线路、哪套内网」——
**上传到公开远端前必须替换**（换成占位符或网段化的写法）。

替换时注意两条纪律：

- **只换值，不改结构** —— 这些文件是「当时是什么样」的原始证据，改结构就失去了证据价值；
- **命令原文与判定数值不动** —— 数字与报错原文是判定方法的一部分。

大体积截图（`evidence/*.png`）已由 `.gitignore` 排除，只本地留存，
**不会随仓库分发**。

### 3.4 环境变量 → 谁在读

| 环境变量 | 谁在读 | 默认值 | 缺失时 |
|---|---|---|---|
| **`ASKPASS`** | `tools/verify-gemini.sh` —— 覆盖 `SSH_ASKPASS` 指向的口令来源脚本 | `$HERE/../../AX3000TOpenwrt/recovery/local-tools/askpass.sh` | 用默认值（要求兄弟仓与本仓**同级摆放**） |
| **`VERIFY_FIX`** | `tools/verify-gemini.sh` —— 覆盖路由器侧检查脚本的路径 | `$HERE/../../AX3000TOpenwrt/recovery/archive/verify-fix.sh` | 用默认值（同上） |
| **`ROUTER_PASSWORD`** | **不在本仓** —— 由兄弟仓 `AX3000TOpenwrt` 的 `recovery/local-tools/askpass.sh` 读 | 无 | 那个脚本报错退出（exit 1），不静默 |

> `tools/cdp.js` 的 `CDP_PORT` / `CDP_URL` 与凭据**无关**（只是 Chrome 调试端口），
> 不列进本表；用法见根 [README.md](../README.md) 的「文件清单」。
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
```

**逐条确认清单**：

- [ ] `tools/verify-gemini.sh` 源码里**没有**明文口令（应只有 `SSH_ASKPASS="${ASKPASS:-...}"`）；
- [ ] 没有任何 `.router-password` / `askpass.sh` 进库 —— 那两个文件**归兄弟仓所有**；
- [ ] `evidence/agents/*.md` 里的 **P2 级内部标识**已按 §3.3 替换；
- [ ] `evidence/*.png` 不在库里（`.gitignore` 已排除 `/evidence/*.png`）；
- [ ] `Local State` / `*.bak-region-*` 不在库里（`.gitignore` 已排除）；
- [ ] 路由器 root 口令**已轮换** —— 本仓从没存过它，但**设备上的值仍然有效**。

> **本仓当前的实情（2026-10-20）**：本仓**不存任何凭据**；
> 口令链路全部走兄弟仓 `AX3000TOpenwrt` 的 `askpass.sh`（读 `ROUTER_PASSWORD` /
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
6. **P2 级内部标识公开前要替换** —— 出口 IP、内网地址、真实域名与 MAC。

---

## 6. 相关文档

| 要查什么 | 去哪 |
|---|---|
| 兄弟仓的凭据位置与轮换（**设备侧真源**） | `AX3000TOpenwrt` 仓的 `docs/SECRETS.md` |
| mihomo secret 与节点凭据的存放位置 | `ShellcrashRules` 仓的 `docs/SECRETS.md` |
| 工具的用法、副作用、前置条件 | 根 [README.md](../README.md) 的「文件清单」 |
| 证据逐字保留的红线、内部标识怎么处理 | [DOC-RULES.md](DOC-RULES.md) §3、§6 |
| 版本号与发版 | [VERSIONING.md](VERSIONING.md) |
| 忽略规则 | 仓库根 `.gitignore` |
| 许可证（本仓**不含**任何 GPL-3.0 派生件） | 仓库根 [LICENSE](../LICENSE) |
