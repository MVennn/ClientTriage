# third-party —— vendored 上游项目索引

> **一句话**：本目录是「本仓引用了哪些上游开源项目」的索引 —— 每个项目一条，
> 说清来源 URL、用途、许可证、vendor 的 commit SHA，以及**为什么 vendor 它**。

本仓把上游开源项目**原样 vendor 进仓**，用来保证「参照物不会漂走」：
`tools/cdp.js` 按 CDP 协议发消息，就把它的一份固定快照放在这里，
以后核对字段名不必联网。

## 目录

| 项目 | 上游 URL | 用途 | License | vendored commit SHA | 为什么 vendor |
|---|---|---|---|---|---|
| [devtools-protocol](devtools-protocol/) | https://github.com/ChromeDevTools/devtools-protocol | **CDP 协议定义原文** —— `tools/cdp.js` 用的方法与字段的权威参照 | BSD-3-Clause | `95b1af69d6a20161dc3558f8e38366b7fa7a27d1` | **代码级关系**（脚本直接按协议发消息）+ **体积 1,603 KB < 5 MB** + **BSD-3-Clause 允许再分发** |

每个项目的详细来源凭证（clone 时间、commit 日期、**取了哪些文件、为什么只取这些**、
逐文件核对方法、怎么更新、本仓怎么用它）写在它自己的
[`UPSTREAM.md`](devtools-protocol/UPSTREAM.md) 里。

## 约定

1. **不改上游一个字节。** vendor 时走 `git clone --depth 1` → 记下 commit SHA →
   删掉 `.git` → 复制入仓。落库前逐文件 sha256 与 clone 比对，必须全部一致。
2. **保留上游 LICENSE / NOTICE / 版权头。** 本目录里每个项目自己的许可文件都在。
3. **上游的 README 一并保留**，那是上游的东西，不是我们的。
4. **只取需要的部分，但要写清楚没取什么、为什么。** 上游仓库里与本仓无关的大件
   （生成物、撰写格式、构建脚本）可以不取 —— 但必须在该项目的 `UPSTREAM.md` 里
   逐项列出「没取什么 + 为什么」，不能悄悄少一块。
5. **本目录不参与构建。** `tools/` 里的脚本不 `require` 这里任何东西；
   本仓也没有构建步骤。
6. **更新必须同步两处**：项目自己的 `UPSTREAM.md` 和本文件的索引行。

## 本仓自带的校验脚本

[`verify-cdp-fields.js`](verify-cdp-fields.js) —— 把 `tools/cdp.js` 里用到的
每一个 CDP 方法与事件字段，对着 `devtools-protocol/json/` 里的协议定义逐个查。

```bash
node third-party/verify-cdp-fields.js
```

2026-10-20 实测：**全部命中**（明细见
[`devtools-protocol/UPSTREAM.md`](devtools-protocol/UPSTREAM.md) §3.1）。
改了 `tools/cdp.js` 之后把新用到的字段加进脚本的清单里再跑一遍。

## 明确不 vendor 的上游

| 上游 | 为什么只引用、不 vendor |
|---|---|
| [Chrome / Chromium](https://www.chromium.org/Chromium/Chromium/) | 被诊断的浏览器本体。本仓通过 `--remote-debugging-port` 接入它，**不**分发浏览器；体积远超门槛 |
| [Node.js](https://nodejs.org/) | 运行时。本仓只用内置的 `fetch` / `WebSocket` / `fs` / `path`，不声明任何第三方 npm 依赖 |
