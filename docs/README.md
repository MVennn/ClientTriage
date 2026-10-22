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
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | 排错手册（**正本**）：按现象检索，「现象 → 排查步骤 → 原因/解法」，附客户端 / 路由器的分诊判据 |
| [PITFALLS.md](PITFALLS.md) | 踩坑总汇（**正本**）：每条写清「为什么错」与「下次怎么避」，多是测量方法本身的坑 |
| [MAINTENANCE.md](MAINTENANCE.md) | 维护流程（**正本**）：种子要能重复执行、证据命名与保留期限、工具副作用的登记义务 |
| [TOOLS.md](TOOLS.md) | 工具清单（**正本**）：三个使用者工具的作用 / 副作用 / 前置条件，另附两个维护脚本 |

## 三、规范

| 文档 | 一句话定位 |
|---|---|
| [DOC-RULES.md](DOC-RULES.md) | 文档规则（**正本**）：分类定位、单一正本映射表、方法与复现环境分开写、红线内容保护、链接纪律、变更触发矩阵 |
| [VERSIONING.md](VERSIONING.md) | 版本晋升（**正本**）：三段式进位判据、版本号只在 CHANGELOG 标题维护、什么时候不动版本号；本仓无构建产物 |
| [SECRETS.md](SECRETS.md) | 凭据位置（**正本**，只写位置不写值）：本仓不存凭据、哪些设备标识要脱敏、怎么脱敏 |
| [release-notes/README.md](release-notes/README.md) | Release 说明格式（**正本**）：受众区分、反馈入口位置、四动词、一行一条、固定尾巴 |

## 四、参考资料与证据

| 位置 | 一句话定位 |
|---|---|
| [VERIFIED-ENV.md](VERIFIED-ENV.md) | 已验证环境：方法被实测过的设备、网段、出口快照与兄弟仓名对照 |
| [CHROME-GOOGLE-DIAGNOSIS.md](CHROME-GOOGLE-DIAGNOSIS.md) | 2026-10-19 阶段性诊断原文：扩展安装 `Image decode failed`、Play 更新转圈的证据链；⚠️ 结论已被 [LNA-FAKE-IP.md](LNA-FAKE-IP.md) 修正 |
| [release-notes/](release-notes/README.md) | 面向使用者的 Release 说明，一版一份，文件名 = `versionName`（不带 `v`） |
| [archive/](archive/) | 一次性归档目录（**当前为空**）：阶段性结论的原文留档处，不进索引条目 |
| `../evidence/agents/` | 9 份子代理只读审计分片：浏览器层、干净出口、IP 声誉、Google 其余服务、OpenAI、流媒体、社交媒体、YouTube、PC 侧 —— 原始证据逐字保留 |
| `../tools/` | 三个使用者工具（清地区种子 / Gemini 复测 / CDP 抓控制台）+ 两个维护脚本（文档自检 / 门面图）；用法见 [TOOLS.md](TOOLS.md) |
| 仓库根 [CHANGELOG.md](../CHANGELOG.md) | 开发者记录：建仓动作、结论修正、待补欠账（**版本号本身**在这里维护，规则见 [VERSIONING.md](VERSIONING.md)） |
| 仓库根 [PROGRESS.md](../PROGRESS.md) | 本仓唯一进度台账（追加式批次日志）：目标 / 步骤勾选 / 状态 / 待解决 |
| 仓库根 [LICENSE](../LICENSE) | 许可证全文（**MIT**）—— 与根 [NOTICE](../NOTICE) 的第三方声明配套（本仓**不含**任何 GPL-3.0 派生件） |
| 仓库根 [third-party/](../third-party/README.md) | **随仓分发的上游文件**：Chrome DevTools Protocol 协议定义子集（BSD-3-Clause），用于校验 `tools/cdp.js` 的字段 |

---

> 新增 / 删除文档后**必须同步更新本索引**（规则见 [DOC-RULES.md](DOC-RULES.md)）；
> 新文档至少要被一处既有文档引用，不允许孤儿。
