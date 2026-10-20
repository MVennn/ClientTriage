# 文档规则

> **一句话**：docs/ 下的文档怎么分类、怎么互相引用、改动时连带改哪些 ——
> 本篇只管「怎么写、怎么保持一致」，不承载任何具体技术规则。

---

## 1. 分类与定位

docs/ 分四类（索引见 [README.md](README.md)）：

| 类别 | 收什么 | 现有成员 |
|---|---|---|
| 机制与根因 | 为什么会坏、为什么会好 | LNA-FAKE-IP |
| 排错与维护 | 遇到现象怎么查、日常怎么维持 | TROUBLESHOOTING、PITFALLS、MAINTENANCE |
| 规范 | 文档怎么写、Release 说明怎么写 | DOC-RULES、release-notes/ |
| 参考资料与证据 | 阶段性结论原文、原始审计分片、进度台账 | CHROME-GOOGLE-诊断、archive/、evidence/agents/、根 CHANGELOG.md、根 PROGRESS.md |

每篇文档开头必须有一个 **「一句话」引言块**（`> **一句话**：…` 或一行定位语），
让读者不用往下翻就知道这篇管什么。新文档没有它不算写完。

**根目录的 [README.md](../README.md) 与 [AGENTS.md](../AGENTS.md) 不属于 docs/**：
前者是门面（读者入口），后者是机器协议（自动化代理的行为约束），两者都不进本索引的分区。

## 2. 单一正本原则

**每条规则只在一篇文档里定义；其余位置只允许一句话概述 + 指向正本的链接。**
两处都写全文，迟早各改各的。

权威正本映射表：

| 规则 | 正本 |
|---|---|
| LNA × fake-IP 的机制、解法与判据 | [LNA-FAKE-IP.md](LNA-FAKE-IP.md) |
| 排错步骤（现象 → 排查 → 原因/解法） | [TROUBLESHOOTING.md](TROUBLESHOOTING.md) |
| 踩坑清单与「下次怎么避」 | [PITFALLS.md](PITFALLS.md) |
| 维护流程、保留期限、证据命名 | [MAINTENANCE.md](MAINTENANCE.md) |
| 文档规则（分类 / 正本 / 链接 / 触发矩阵） | [DOC-RULES.md](DOC-RULES.md)（本篇） |
| Release 说明格式与固定尾巴 | [release-notes/README.md](release-notes/README.md) |
| 版本命名规则 | [VERSIONING.md](VERSIONING.md) §1–§2 |
| 工具的用法、副作用、前置条件 | 根 [README.md](../README.md)「文件清单」 |
| 子代理写文件的规则、客户端与路由器的边界 | 根 [AGENTS.md](../AGENTS.md) |
| 建仓动作与欠账 | 根 [CHANGELOG.md](../CHANGELOG.md)「未发布」段 |

### 禁止重复清单（建仓时定下的反例，勿重蹈）

1. **LNA-FAKE-IP ↔ CHROME-GOOGLE-诊断**：
   `docs/CHROME-GOOGLE-诊断.md` 写于 2026-10-19，结论是「方案 A/C/D 已落地并端到端验证」；
   2026-10-20 晚发现**同一 LNA 机制仍导致 Gemini「只剩输入框」**，最终修法是
   `fake_ip_filter` 补 `+.gstatic.com` / `+.googleapis.com`。
   处理方式：LNA-FAKE-IP.md 是**长期正本**，诊断报告降级为**历史证据原文**，
   其过期的「已修复」结论由索引与 LNA-FAKE-IP.md 各标注一次，不再另写第三份修正说明。
2. **PITFALLS ↔ TROUBLESHOOTING**：
   PITFALLS 收「**方法本身**的坑」（怎么测会测错、哪个结论不可信）；
   TROUBLESHOOTING 收「**某个现象**怎么查」。
   一条内容只放一处：能写成「下次怎么避」的方法学坑 → PITFALLS；
   能写成「现象 → 步骤 → 解法」的 → TROUBLESHOOTING。
3. **路由器侧配置不复制进本仓**：
   fake-IP 段、nft 表、策略组名、节点名会随路由器配置变化。
   本仓只写**结论与判据**，具体配置归**路由器系统仓**与**分流规则仓**
   （角色名与实际仓名的对照见根 [README.md](../README.md) 的「已验证环境」）。

## 3. 红线内容保护：实测证据逐字保留

`evidence/agents/*.md` 里的**原始输出、错误码、报错原文、命令与参数、IP 地址、节点名、
判定数值**（例如 `ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS`、`net_error = -385`、
`var cc='CN'`、`Image decode failed`、`Permission was denied for this request to access the
`local` address space`、各域名的 fake_ip_filter 条目），在文档合并或修订时
**必须逐字保留，一个不删** —— 哪怕结论已被后续修正（那时的结论也是当时的事实）。
重复叙述可以压缩，事实与原文不行。

同理，`docs/LNA-FAKE-IP.md` 与 `docs/TROUBLESHOOTING.md` 里的**命令原文**要能直接复制执行，
不要改成伪代码或占位符。

### 3.1 与「脱敏」的关系：只换值，不改结构

红线保护的是**事实与判定**，不是**真值本身**。
[SECRETS.md](SECRETS.md) §3.3 列出的 P2 级标识（出口 IP、内网地址、真实域名、MAC / IPv6 PD、
WiFi 名、本机绝对路径、账号标识）**可以换值** —— 用占位符或示例值替换，
**但结构、命令、判定数值、结论一个字都不能动**。

| 可以换（值） | 不能换（结构与结论） |
|---|---|
| 出口 IP / 内网地址 / 真实域名 / MAC / WiFi 名 / 本机路径 / 账号标识 | 报错原文、错误码、命令与参数、判定数值、结论 |

> 例：`udp src=<平板LAN-IP> dst=198.18.0.140 dport=443 ... [UNREPLIED]` ——
> 换的是内网 IP，`[UNREPLIED]` 与整行结构不变。

## 4. 链接纪律

- 统一用**相对链接 + 锚点**（形如「`[标题]`」→「`文档名.md#锚点`」，写时用半角括号），不用绝对路径。
- **改动 / 删除 / 合并文档后必须双向点验**：
  - 出链：新文档里指向别处的链接目标还存在、锚点没变；
  - 入链：全仓搜旧文件名（Grep），把指向它的链接改成新位置 ——
    **禁止只删文档不改引用方**。
- 判断某段「重复」是否该收敛时，先看它被谁引用；收敛后引用方必须同步改。
- 历史记录里的旧文件名（如 CHANGELOG 历史条目、`docs/CHROME-GOOGLE-诊断.md` 里的旧路径）
  可保留原样 —— 那是当时的事实；但**正文中指向现役文档的链接**必须始终指向现役文档。
- 指向**其它仓**（路由器系统仓 / 分流规则仓）时写**仓库名**，
  不写物理路径 —— 物理路径会随重组变。

## 5. 变更触发矩阵

改了什么，就必须连带改什么：

| 变更 | 必须同步 |
|---|---|
| 新增 / 删除 / 改名一篇文档 | [README.md](README.md) 索引（见 §7） |
| LNA 机制、fake-IP 段、解法、判据有变 | [LNA-FAKE-IP.md](LNA-FAKE-IP.md) 正文 + [TROUBLESHOOTING.md](TROUBLESHOOTING.md) 对应现象节 |
| 新增一个工具脚本 | 根 [README.md](../README.md)「文件清单」表（作用 / 副作用 / 前置条件三列都要补） |
| 工具的副作用变了（会切 WiFi、会写配置、会起进程） | 根 [README.md](../README.md)「已知坑」+ [MAINTENANCE.md](MAINTENANCE.md) 副作用声明段 |
| 新增一条踩坑 | [PITFALLS.md](PITFALLS.md)；若它同时是某现象的成因，补一条 [TROUBLESHOOTING.md](TROUBLESHOOTING.md) 的指向 |
| 结论被推翻 / 修正 | 正本文档正文 + 根 [CHANGELOG.md](../CHANGELOG.md) 的「未发布」段；**旧结论保留在原文里**并标注被谁修正 |
| 发版 | 根 [CHANGELOG.md](../CHANGELOG.md) + `docs/release-notes/<版本>.md`（格式正本：[release-notes/README.md](release-notes/README.md)） |
| 证据文件新增 / 删除 | [MAINTENANCE.md](MAINTENANCE.md) 的命名与保留期限段（保持口径一致） |
| 子代理新增分片 | 根 [AGENTS.md](../AGENTS.md) §1 只在**规则**变了时才动；分片清单在 [README.md](../README.md) 与索引里 |
| 脚本新增 / 改名环境变量 | 根 [README.md](../README.md)「文件清单」表 + [SECRETS.md](SECRETS.md) §3.5 的环境变量表 |
| 出现新的设备标识类别 | [SECRETS.md](SECRETS.md) §3.3 的 P2 类别表 + §3.4 的占位符写法表 |

## 6. 方法与复现环境必须分开

本仓是**方法仓** —— 记录的是「怎么查」，不是「某台设备上查到了什么」。
因此写作时必须把两类内容分开：

| 类别 | 写在哪 | 怎么写 |
|---|---|---|
| **方法**（怎么判断客户端问题还是路由器问题、命令、判据） | 各篇正本正文 | 通用措辞；地址用**示例值**并标注「示例」；命令原文可直接复制执行 |
| **复现环境**（当时那台设备、那个网络、那个出口的实测值） | 根 [README.md](../README.md) 的「**已验证环境**」 | 集中一处，不散落在正文里 |

判断标准：**换一个环境，这段话还成立吗？**

- 成立 → 属于**方法**，留在正文；
- 不成立（绑定了具体机型 / 网段 / 出口 / 仓名） → 属于**复现环境**，
  移到「已验证环境」，正文改写成通用措辞。

具体的设备标识（WiFi 名、MAC、IPv6 PD、内网地址、账号）**哪都不写** ——
按 [SECRETS.md](SECRETS.md) §3.3 脱敏。

## 7. 体量预算与样例时效

- **单篇 ≤ 800 行。** 超了就按「正文档 + 踩坑史」拆：正文档留结论与约束，
  历史 / 根因分析移到踩坑篇或 `archive/`。
  本仓现成的一对：[LNA-FAKE-IP.md](LNA-FAKE-IP.md)（正文档）
  与 [docs/CHROME-GOOGLE-诊断.md](CHROME-GOOGLE-诊断.md)（阶段性证据原文）。
- **样例时效**：带日期标注的样例（如「2026-10-19 实测」「Chrome 155.0.8059.82 下」）
  可容忍过时 —— 它们是历史记录；但**能力清单类内容**
  （「本仓有哪些工具」「有哪些文档」「覆盖哪些现象」）必须随变更同步，不允许停留在旧状态。
- **命令原文不因「旧了」而改写**：命令过时就在旁边写「此命令对应当时的版本」，
  不要直接改成看起来更新的样子 —— 那会毁掉证据链。

## 8. 索引维护与孤儿零容忍

- [README.md](README.md) 是 docs/ 的唯一索引，**新增 / 删除 / 改名文档必须同步更新**。
- **孤儿文档零容忍**：任何新文档必须至少被一处既有文档引用（或进索引并有明确入口），
  否则等于没写。
- 空目录（如 `archive/`）**不进索引条目**；它一旦有了第一份内容，就要在索引里补一行。
