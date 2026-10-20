<div align="center">

<img src="https://gitlab.com/M.Venn/ClientTriage/-/raw/main/assets/logo.png" width="128" alt="ClientTriage">

# ClientTriage

**PC 客户端经代理访问境外服务的排障方法与工具**（Chrome / Google / Gemini）

先查客户端，再怪路由器。

![流水线](https://gitlab.com/M.Venn/ClientTriage/badges/main/pipeline.svg) ![源码仓库](https://img.shields.io/badge/源码仓库-GitLab-FC6D26?logo=gitlab&logoColor=white) ![问题反馈](https://img.shields.io/badge/问题反馈-Issues-FC6D26?logo=gitlab&logoColor=white) ![Windows](https://img.shields.io/badge/Windows-10%2F11-0078D6?logo=windows&logoColor=white) ![Chrome](https://img.shields.io/badge/Chrome-138%2B-4285F4?logo=googlechrome&logoColor=white) ![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white) ![License](https://img.shields.io/badge/License-MIT-blue)

</div>

---

> **一句话**：把「症状出在客户端还是路由器」这件事查清楚 —— 用 CDP 接管浏览器、清掉地区种子、只读取证，并留下能复核的证据。

## 这是什么

Windows + Chrome 经路由器透明代理访问境外服务时，会遇到一批**看起来像客户端坏了、实际根因在网络层**的问题：
Gemini 页面只剩一个输入框、Chrome 扩展装不上并报 `Image decode failed`、手机 Play 商店更新一直转圈、
Google 账号被判定为不支持的国家、流媒体打不开、社交媒体加载不全。

本仓沉淀的是**客户端侧怎么查**：

1. 用 **CDP（Chrome DevTools Protocol）** 接管浏览器，把「页面只剩输入框」这种描述性症状
   变成一条明确的控制台错误；
2. 用 **Chrome 地区种子清理** 把「Google 判定我的国家」这类账号/设备侧的残留因素摘掉，
   让剩下的现象能归因到网络层；
3. 用 **一批只读判定手法**（服务方自己的国家标记 / 出口链路 / GET 判 302）
   把「到底是谁在拦」这件事查清楚，并留下可复核的证据。

一句话判据：**症状在浏览器里能被复现成一条控制台错误**，才轮得到本仓继续查；
查不到就是网络层 —— 路由器侧的排查（fake-IP 段、分流规则、策略组）不在本仓范围，
按现象直奔 [排错手册](https://gitlab.com/M.Venn/ClientTriage/-/blob/main/docs/TROUBLESHOOTING.md)，
每一节都给了「客户端问题还是路由器问题」的判据。

## 适用环境

| 项 | 要求 | 备注 |
|---|---|---|
| 操作系统 | Windows 10 / 11 | 工具链依赖 `netsh` / `ssh` / `curl`，**仅 Windows 可用** |
| 浏览器 | Chrome 138+ | LNA 机制自 Chrome 138+ 起生效，更早版本不会复现本仓针对的冲突 |
| Node.js | 18+ | 工具用内置 `fetch` 与 `WebSocket`，无第三方依赖 |
| Shell | Git Bash | 编排脚本是 `sh` 脚本 |
| 代理 | 一个**客户端可达**的代理口 | 路由器上的 mixed 口，或本机代理软件均可；API/连通性测试**必须走这个口** |
| 路由器 | 可选，需 root 权限 | 只有路由器侧检查脚本需要；没有的话跳过那一步，不影响客户端侧判定 |

> 文中出现的 `10.0.0.1` / `192.168.1.x` 一律是**示例网段**（典型的家用路由器默认网关），
> 不是某个具体网络的真值，用你自己的网关地址替换即可。
> 这套方法已在「OpenWrt + ShellCrash/mihomo 路由器 + Windows 11 + Chrome 155」上实测；
> 换环境不影响方法本身，只影响具体取值。

## 使用

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

| 工具 | 作用 |
|---|---|
| `tools/clear-chrome-region.js` | 清掉 Chrome 配置里的地区种子键；写前自动留 `.bak-region-*` 备份，**需要 Chrome 已完全退出** |
| `tools/verify-gemini.sh` | Gemini 复测编排：切 WiFi → 路由器侧检查 → 起临时 Chrome（9223）→ CDP 抓日志 → 截图 → 清理并切回热点。你日常那个 Chrome **全程不会被碰** |
| `tools/cdp.js` | 通过 CDP 接管已在运行的 Chrome，抓渲染状态、控制台错误、网络失败（只读） |

已知坑与解法（Chrome 不退出改不上种子、CDP 要用临时实例、截图绿 ≠ 修好了等）见
[踩坑总汇](https://gitlab.com/M.Venn/ClientTriage/-/blob/main/docs/PITFALLS.md)；
机制与判据的来龙去脉见
[LNA × fake-IP](https://gitlab.com/M.Venn/ClientTriage/-/blob/main/docs/LNA-FAKE-IP.md)。

## 反馈

遇到对不上的现象、想要新的判定手法，或某一步在你的环境里走不通，
都可以到 [Issues](https://gitlab.com/M.Venn/ClientTriage/-/issues) 反馈。请尽量带上：

- Chrome 版本号、Windows 版本、代理方式（路由器透明代理还是本机代理软件）
- 哪个工具、执行的哪一步，输出原文
- 控制台错误原文（`tools/cdp.js` 的输出）或复现步骤

想参与贡献，见 [CONTRIBUTING](https://gitlab.com/M.Venn/ClientTriage/-/blob/main/CONTRIBUTING.md)；
安全问题按 [SECURITY](https://gitlab.com/M.Venn/ClientTriage/-/blob/main/SECURITY.md) 报告。

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

本仓的脚本建立在这些开源项目之上：

| 项目 | 用途 |
|---|---|
| [**Chrome DevTools Protocol**](https://chromedevtools.github.io/devtools-protocol/) | 抓控制台、网络失败与页面渲染状态的标准协议；协议定义原文已随仓 vendor 在 [third-party/devtools-protocol/](https://gitlab.com/M.Venn/ClientTriage/-/tree/main/third-party/devtools-protocol)，`tools/cdp.js` 用到的每个方法与字段都可用 `node third-party/verify-cdp-fields.js` 逐个核对 |
| [**Chrome**](https://www.chromium.org/Chromium/Chromium/) | 被诊断的浏览器本体，提供 `--remote-debugging-port` 接入点 |
| [**Node.js**](https://nodejs.org/) | 跑全部工具（内置 `fetch` / `WebSocket`，无第三方依赖） |

## 许可证

本仓库以 [MIT License](https://gitlab.com/M.Venn/ClientTriage/-/blob/main/LICENSE) 发布。
第三方组件的版权与许可证声明见 [NOTICE](https://gitlab.com/M.Venn/ClientTriage/-/blob/main/NOTICE)。
