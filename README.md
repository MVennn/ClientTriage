<div align="center">

<img src="https://raw.githubusercontent.com/MVennn/ClientTriage/main/assets/logo.png" width="128" alt="ClientTriage">

# ClientTriage

**PC 客户端经代理访问境外服务的排障方法与工具**

先查客户端，再怪路由器。

![CI](https://github.com/MVennn/ClientTriage/actions/workflows/ci.yml/badge.svg) ![源码仓库](https://img.shields.io/badge/源码仓库-GitHub-181717?logo=github&logoColor=white) ![问题反馈](https://img.shields.io/badge/问题反馈-Issues-181717?logo=github&logoColor=white) ![Windows](https://img.shields.io/badge/Windows-10%2F11-0078D6?logo=windows&logoColor=white) ![Chrome](https://img.shields.io/badge/Chrome-138%2B-4285F4?logo=googlechrome&logoColor=white) ![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white) ![License](https://img.shields.io/badge/License-MIT-blue)

</div>

---

## 这是什么

Windows 上的 Chrome 经路由器透明代理访问境外服务时，会遇到一批**看起来像客户端坏了、实际根因在网络层**的问题：Gemini 页面只剩一个输入框、Chrome 扩展装不上并报 `Image decode failed`、Google 账号被判定为不支持的国家、流媒体打不开、社交媒体加载不全。

本仓沉淀的是**客户端侧怎么查**：用 CDP 接管你的浏览器，把「只剩一个输入框」变成一条明确的控制台错误；用 Chrome 地区种子清理摘掉账号与设备侧的残留因素；再用只读判定手法（服务方自己的国家标记 / 出口链路 / GET 判 302）查清「到底是谁在拦」，并留下可复核的证据。

一句话判据：**症状能在你的浏览器里复现成一条明确的控制台错误**，才轮得到本仓继续查；查不到就是网络层。路由器侧的排查（fake-IP 段、分流规则、策略组）不在本仓范围，按现象直奔 [排错手册](https://github.com/MVennn/ClientTriage/blob/main/docs/TROUBLESHOOTING.md)，每一节都给了「客户端问题还是路由器问题」的判据。

## 环境要求

| 项 | 要求 |
|---|---|
| 操作系统 | Windows 10 / 11（工具链依赖 `netsh` / `ssh` / `curl`） |
| 浏览器 | Chrome 138+（LNA 拦截自这个版本起生效） |
| 运行时 | Node.js 18+ 与 Git Bash；工具无第三方依赖 |
| 代理 | 一个你机器上可达的代理口；连通性测试必须走这个口 |

## 使用

三步，顺序不能换：**先清种子，再复测，最后才抓控制台** —— 种子没清就抓控制台，抓到的是带地区因子的噪声。

1. **清 Chrome 地区种子** —— 先把 Chrome 完全退出（含后台进程），再跑第 ① 条；脚本写前会留 `.bak-region-*` 备份。
2. **复测 Gemini** —— 跑第 ② 条；它会切 WiFi、起一个临时 Chrome、抓控制台并截图，结束后清理、切回热点，你日常那个 Chrome 全程不会被碰（其中的路由器侧检查需要 root 权限，没有就跳过那一步）。
3. **抓控制台 / 网络失败** —— 跑第 ③ 条；只读，不改浏览器设置，前提是 9223 上已经有一个开着 `--remote-debugging-port` 的 Chrome。

```bash
node tools/clear-chrome-region.js    # ① 清地区种子（Chrome 需完全退出）
bash tools/verify-gemini.sh           # ② 复测 Gemini
CDP_PORT=9223 node tools/cdp.js       # ③ 抓控制台与网络失败
```

三个工具的完整用法、副作用与前置条件见 [工具清单](https://github.com/MVennn/ClientTriage/blob/main/docs/TOOLS.md)；已知坑见 [踩坑总汇](https://github.com/MVennn/ClientTriage/blob/main/docs/PITFALLS.md)；机制与判据见 [LNA × fake-IP](https://github.com/MVennn/ClientTriage/blob/main/docs/LNA-FAKE-IP.md)。

## 反馈

遇到对不上的现象、想要新的判定手法，或者某一步在你的环境里走不通，都可以到 [Issues](https://github.com/MVennn/ClientTriage/issues) 反馈。请尽量带上：

- Chrome 版本号、Windows 版本、代理方式（路由器透明代理还是本机代理软件）
- 哪个工具、执行的哪一步，输出原文
- 控制台错误原文（`tools/cdp.js` 的输出）或复现步骤

想参与贡献，见 [CONTRIBUTING](https://github.com/MVennn/ClientTriage/blob/main/CONTRIBUTING.md)；安全问题按 [SECURITY](https://github.com/MVennn/ClientTriage/blob/main/SECURITY.md) 报告。

## 免责声明

本项目仅供学习与个人排障使用。

- 不采集、不上传、不存储任何个人信息；本仓只有本地脚本与文档，不含任何统计或回传组件
- 本仓**不提供**任何绕过服务方地区限制的方案；它只做**定位与取证**，改不改、改在哪一侧由你自己按当地法律与各服务的用户协议判断
- 修改浏览器配置（地区种子）前请自行备份；脚本会留 `.bak-region-*` 备份，但不替你恢复
- 请勿用于商业用途或任何违反服务方用户协议的场景
- 使用本工具产生的任何后果由使用者自行承担

「Chrome」「Google」「Gemini」「Chrome DevTools Protocol」「Node.js」等商标、标识与项目名称的权利均归其权利人所有。本项目与之不存在任何隶属、合作、授权、认可或支持关系。

## 开源鸣谢

本仓的脚本建立在这些开源项目之上：

| 项目 | 用途 |
|---|---|
| [**Chrome DevTools Protocol**](https://chromedevtools.github.io/devtools-protocol/) | 抓控制台、网络失败与页面渲染状态的标准协议；协议定义快照随仓 vendor，字段可用 `node third-party/verify-cdp-fields.js` 逐个核对 |
| [**Chrome**](https://www.chromium.org/Chromium/Chromium/) | 被诊断的浏览器本体，提供 `--remote-debugging-port` 接入点 |
| [**Node.js**](https://nodejs.org/) | 跑全部工具（内置 `fetch` / `WebSocket`，无第三方依赖） |

## 许可证

本仓库以 [MIT License](https://github.com/MVennn/ClientTriage/blob/main/LICENSE) 发布。第三方组件的版权与许可证声明见 [NOTICE](https://github.com/MVennn/ClientTriage/blob/main/NOTICE)。
