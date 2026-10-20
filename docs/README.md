# docs/ 索引

> **一句话**：这里只有索引与定位，不放正文 —— 每篇文档一句话说明「它管什么」，
> 规则本身按 [DOC-RULES.md](DOC-RULES.md) 的单一正本原则只在对应文档里定义。

文档分四类。每篇开头都有一个「一句话」引言块，先看它再决定要不要往下读。
带 **（正本）** 标记的文档是该主题的**唯一权威定义处**；别处只留一句话概述 + 指向它的链接。

---

## 一、机制与根因

| 文档 | 一句话定位 |
|---|---|
| [LNA-FAKE-IP.md](LNA-FAKE-IP.md) | Chrome 155 的 LNA 与 mihomo fake-IP 冲突（**正本**）：机制、证据、解法，以及「外壳能打开 ≠ 修好了」的判据 |

## 二、排错与维护

| 文档 | 一句话定位 |
|---|---|
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | 排错手册（**正本**）：按现象检索，每节「现象 → 排查步骤 → 原因/解法」，并给「客户端问题还是路由器问题」的判据 |
| [PITFALLS.md](PITFALLS.md) | 踩坑总汇（**正本**）：每条写清「为什么错」与「下次怎么避」，含判定方法本身的坑 |
| [MAINTENANCE.md](MAINTENANCE.md) | 维护流程（**正本**）：种子要能重复执行、证据命名与保留期限、工具副作用的声明位置 |

## 三、规范

| 文档 | 一句话定位 |
|---|---|
| [DOC-RULES.md](DOC-RULES.md) | 文档规则（**正本**）：分类定位、单一正本映射表、**方法与复现环境怎么分开写**、红线内容保护（只换值不改结构）、链接纪律、变更触发矩阵、孤儿零容忍 |
| [VERSIONING.md](VERSIONING.md) | 版本晋升规则（**正本**）：三段式进位（有功能更新 +0.1.0 / 没有 +0.0.1）、版本号**只在 CHANGELOG 的版本标题**维护、什么时候不动版本号；本仓**无构建产物**，「版本」= 这套排障方法与工具的版本 |
| [SECRETS.md](SECRETS.md) | 凭据位置（**正本**，只写位置不写值）：本仓**不存任何凭据**、root 口令走兄弟仓的 `askpass.sh`、哪些设备标识需要脱敏与怎么脱敏（MAC / IPv6 PD / WiFi 名 / 本机路径 / 账号标识） |
| [release-notes/README.md](release-notes/README.md) | Release 说明格式（**正本**）：面向用户还是面向开发者、四动词、一行一条、固定尾巴 |

## 四、参考资料与证据

| 位置 | 一句话定位 |
|---|---|
| [CHROME-GOOGLE-诊断.md](CHROME-GOOGLE-诊断.md) | 2026-10-19 的阶段性诊断报告：Chrome LNA 拦截 fake-IP 导致扩展安装 `Image decode failed`、Play 更新转圈的证据链；⚠️ 其「已修复」结论已被 [LNA-FAKE-IP.md](LNA-FAKE-IP.md) 修正，读时以 LNA-FAKE-IP 为准 |
| [archive/](archive/) | 一次性归档目录（**当前为空**）：阶段性结论的原文留档处，不进索引条目 |
| `../evidence/agents/` | 9 份子代理只读审计分片：浏览器层、干净出口方案、IP 声誉、Google 其余服务、OpenAI、流媒体与开发者站点、社交媒体、YouTube、PC 侧 —— 原始证据，**结论已被上面的正本吸收，但原文逐字保留** |
| `../tools/` | 三个工具脚本（清地区种子 / Gemini 复测编排 / CDP 抓控制台）：用法与副作用见根 [README.md](../README.md) 的「文件清单」 |
| 仓库根 [CHANGELOG.md](../CHANGELOG.md) | 开发者记录：建仓动作、结论修正、待补欠账（**版本号本身**在这里维护，规则见 [VERSIONING.md](VERSIONING.md)） |
| 仓库根 [PROGRESS.md](../PROGRESS.md) | 本仓唯一进度台账（追加式批次日志）：目标 / 步骤勾选 / 状态 / 待解决 |
| 仓库根 [LICENSE](../LICENSE) | 许可证全文（**MIT**）—— 与根 [NOTICE](../NOTICE) 的第三方声明配套（本仓**不含**任何 GPL-3.0 派生件） |
| 仓库根 [third-party/](../third-party/README.md) | **随仓分发的上游文件**：Chrome DevTools Protocol 的协议定义子集（BSD-3-Clause），用于校验 `tools/cdp.js` 的命令 / 事件 / 字段名；每个子目录一份 `UPSTREAM.md`（来源 URL / 钉住的 commit / 许可 / 怎么用 / 怎么更新） |

---

> 新增 / 删除文档后**必须同步更新本索引**（规则见 [DOC-RULES.md](DOC-RULES.md) §8）；
> 新文档至少要被一处既有文档引用，不允许孤儿。
