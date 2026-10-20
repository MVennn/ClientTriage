# ChromeDevTools/devtools-protocol —— 来源凭证

> **一句话**：本目录是 Chrome DevTools 协议定义的**最小子集**（4 个文件），
> 用来校验本仓 `tools/cdp.js` 用的命令名、事件名与字段名**与协议一致**。

---

## 1. 上游

| 项 | 值 |
| --- | --- |
| 仓库 | `ChromeDevTools/devtools-protocol` |
| URL | <https://github.com/ChromeDevTools/devtools-protocol> |
| 许可 | **BSD-3-Clause**（原文见本目录 `LICENSE`） |
| 钉住的 commit | `95b1af69d6a20161dc3558f8e38366b7fa7a27d1`（`main`） |
| 上游路径 | `json/` `LICENSE` `README.md` |

## 2. 包含哪些文件

| 本地文件 | 上游路径 | 体积 | 用途 |
| --- | --- | --- | --- |
| `json/browser_protocol.json` | `json/browser_protocol.json` | 1.42 MB | **浏览器域**协议定义：命令、事件、参数、返回值 |
| `json/js_protocol.json` | `json/js_protocol.json` | 183 KB | **JS 运行时域**协议定义（`Runtime.evaluate` 等） |
| `LICENSE` | `LICENSE` | 1.6 KB | BSD-3-Clause 全文 |
| `README.md` | `README.md` | 2.3 KB | 上游说明 |

**逐字节一致性：4 / 4 ✅**（md5 与上游 `raw.githubusercontent.com` 逐一比对通过）。

## 3. 刻意**没有** vendor 的部分

| 上游内容 | 体积 | 不取的理由 |
| --- | --- | --- |
| `changelog.md` | 1.6 MB | 纯变更流水，本仓用不到 |
| `types/` | 1.5 MB | 生成的 TypeScript 类型定义；本仓用 JS，不需要 |
| `pdl/` | 738 KB | PyChrome 用的 PDL 格式，本仓不用 Python 驱动 |
| `scripts/` | 36 KB | 上游自己的生成与校验脚本 |

> 取子集而不是整仓，是为了**只 vendor 本仓真正用来核对的那两份定义**，
> 避免为了一个字段名校验把 4 MB 无关内容塞进仓库。

## 4. 与本仓的关系（为什么值得 vendor）

本仓的 `tools/cdp.js` 直接讲 CDP 协议（用来抓 Chrome 控制台报错、复现「Gemini 只剩输入框」）。
协议是**会变的**（Chrome 每次升级都可能改命令名或字段名），
存一份**权威定义**在仓内，就能把「脚本里的字段名对不对」变成**可自动验证**的事。

配套的校验脚本在 **vendor 目录之外**：

```bash
node third-party/verify-cdp-fields.js
```

它把 `tools/cdp.js` 用的 **6 个命令 + 5 个事件 + 全部字段**逐个对协议定义查 ——
**当前全部命中**（2026-10-20 实测）。

## 5. 怎么更新

```bash
SHA=$(git ls-remote https://github.com/ChromeDevTools/devtools-protocol.git refs/heads/main | cut -f1)
BASE="https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/$SHA"
curl -sSL "$BASE/json/browser_protocol.json" -o json/browser_protocol.json
curl -sSL "$BASE/json/js_protocol.json"       -o json/js_protocol.json
curl -sSL "$BASE/LICENSE"                     -o LICENSE
curl -sSL "$BASE/README.md"                   -o README.md
```

**更新后必须跑一遍** `node third-party/verify-cdp-fields.js` ——
协议若改了字段名，脚本会报出来；顺手把 `tools/cdp.js` 跟上游对齐。

## 6. 许可

BSD-3-Clause —— 可自由再分发，只需保留版权声明与许可全文。本目录保留了上游 `LICENSE`。
本仓整体是 MIT（见仓库根 [LICENSE](../../LICENSE)），两者兼容。
BSD-3-Clause 还要求**不得用项目名 endorsement** —— 本仓没有用它的名字做宣传。
