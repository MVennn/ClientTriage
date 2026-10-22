# LNA × fake-IP：Chrome 155 与 mihomo fake-IP 的冲突

> **一句话**：mihomo 的 fake-IP 段（`198.18.0.0/15`、`fc00::/16`）被 Chrome 155 的
> **Local Network Access（LNA）**判为「本地地址空间」，从公网页面发起的子资源请求会被
> LNA 拦掉（`ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS`）—— 这就是 Gemini 只剩输入框、
> 扩展安装报 `Image decode failed` 的共同根因。

> **本文是长期正本**。2026-10-19 的阶段性诊断见
> [CHROME-GOOGLE-DIAGNOSIS.md](CHROME-GOOGLE-DIAGNOSIS.md)，其中「方案 A/C/D 已落地并端到端验证」
> 的结论**已被本文修正** —— 同一机制在 10-19 之后仍导致 Gemini 故障。

---

## 1. 结论

1. **根因**：mihomo 的 fake-IP 地址段落在 Chrome 眼里的「本地地址空间」里；
   LNA 只放行 `local → local`，不放行 `public → local`。
2. **后果分两种**：
   - 浏览器进程发起的请求（没有 initiator）被拦 → 扩展安装图标拉不到 →
     `Image decode failed`；
   - 公网页面发起的**子资源**被拦 → Gemini 的 islands bundle 被 CORS 拒 →
     页头/侧栏/推荐区全无，**只剩输入框**。
3. **解法**：把相关域名移出 fake-IP（在 `fake_ip_filter` 里加 `+.gstatic.com`、
   `+.googleapis.com` 等），让客户端拿到**真实公网 IP**，LNA 就不再拦。
4. **判据**：**UI 完整加载**才算修好。「网页外壳能打开」不算 —— 见 §5。

> 修法落在路由器侧（`ShellcrashRules` 仓）；本仓只沉淀**机制、证据与判据**。

## 2. 机制

### 2.1 fake-IP 是什么

mihomo 开启 fake-IP 模式后，不在 `fake_ip_filter` 里的域名会被解析到一段**保留地址**：

| 协议 | fake-IP 段 |
|---|---|
| IPv4 | `198.18.0.0/15` |
| IPv6 | `fc00::/16` |

这两段**不是本机可达的地址**，但它解决了「同一域名按规则分流到不同出口」的 DNS 问题：
规则在连接阶段按真实域名匹配，DNS 阶段只负责给一个占位地址。

### 2.2 Chrome 155 的 LNA 判据

Chrome 138 起引入、155 上仍在的 Local Network Access 检查，判据是**目标地址空间**：

| 发起方地址空间 | 目标地址空间 | 结果 |
|---|---|---|
| local | local | 放行（`allowed-no-less-public`） |
| public | local | **拒绝**（`ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS`，net_error `-385`） |

`198.18.0.0/15` 与 `fc00::/16` 被 Chrome 归进 local address space ——
因为它们是 RFC 保留段，浏览器按「私有/链路本地/保留」的常识分类处理。

**关键在于「谁是发起方」**：

- **普通页面里的图片**：initiator 是页面自己，页面也被解析到 fake-IP →
  client 也是 local → `local → local` → **放行**。
  这就是「网页图片都好好的，扩展图标却加载不出来」的原因。
- **浏览器进程发起的请求**（扩展安装时拉图标）：没有 initiator，
  client 地址空间被当作 public → `public → local` → **拒绝**。
- **公网页面的子资源脚本**：发起页面是真实公网 IP（该域名在 `fake_ip_filter` 里），
  子资源域名不在 → 子资源是 fake-IP → `public → local` → **拒绝**。

### 2.3 抓到的原始证据

Chrome netlog（`chrome.exe --log-net-log=... --net-log-capture-mode=Everything`）里的关键事件：

```
POST /webstorePrivate.beginInstallWithManifest3
  iconUrl = https://lh3.googleusercontent.com/lsanoOfx5N_t-...
  result  = "icon_error"

URL_REQUEST (iconUrl)
  DNS: A=198.18.0.105, AAAA=fc00::69        # mihomo fake-IP
  socket connect: [fc00::69]:443
  LNA check: client_address_space=public, resource_address_space=local,
             result=insecure-local-network
  net_error = -385   # ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS
```

Chromium 源码 `extensions/browser/webstore_install_helper.cc`：

```cpp
constexpr char kImageDecodeError[] = "Image decode failed";
// 图标 fetch 失败 / 解码为空 → kIconError + "Image decode failed"
```

**反向验证**（决定性）：用 `--host-resolver-rules="MAP lh3.googleusercontent.com 28.0.0.5"`
把图标域名强制解析到**公网地址**后，同样的点击操作：

```
result = null        # 不再 icon_error，安装确认框正常弹出
```

即：**只要图标域名拿到公网 IP，LNA 就放行。**

## 3. 为什么 Gemini 只剩输入框

Gemini 页面是**两段式渲染**的：

| 部分 | 来源 | 渲染时机 |
|---|---|---|
| 主框架（输入框） | `gemini.google.com` 主 bundle | 首屏同步 |
| 页头 / 侧栏 / 推荐区 | `www.gstatic.com/bg3/boq-bard-web/islands/assets/islands-*.js`（islands bundle） | **懒加载** |

`gemini.google.com` 本身在 `fake_ip_filter` 的 `+.google.com` 里 → 拿到**真实 IP** → 页面壳正常加载。
但 islands bundle 所在的 `www.gstatic.com` **不在** `fake_ip_filter` 里 → 解析到 fake-IP →
LNA 判定 `public → local` → 被 CORS 拒。

**控制台原文**（决定性证据）：

```
Access to script at 'https://www.gstatic.com/bg3/boq-bard-web/islands/assets/islands-B2LPY9h5.js'
from origin 'https://gemini.google.com' has been blocked by CORS policy:
Permission was denied for this request to access the `local` address space.
```

→ islands bundle 挂了 → 页头/侧栏/推荐区永远不渲染 → **只剩主 bundle 画出的那个输入框**。

**这就是「Gemini 只剩输入框」的完整解释**：不是账号问题，不是扩展问题，不是 QUIC，
是**一个静态资源子域名还在 fake-IP 里**。

### 3.1 排除掉的其它可能

这一轮排查逐层排除掉的（证据在 `evidence/agents/agent-browser-client.md`）：

| 排除项 | 怎么排除的 |
|---|---|
| 出口 / 地区 | Google 侧 `var cc='IN'`、`gemini.google.com` 200 / 784 KB、各 RPC 200 |
| QUIC | Chrome 带 `--disable-quic`，nft 的 QUIC 计数器为 0 |
| 扩展 / 策略 / 代理 / DoH / hosts | Default profile 无扩展、无策略、系统 `ProxyEnable=0`、无 hosts 条目 |
| profile / cookie / ServiceWorker / 磁盘缓存 | headless 用**真实 profile 副本**（含 cookies / SW / cache）仍全黑 |

## 4. 解法

**把静态资源域名移出 fake-IP** —— 在路由器的
`/etc/ShellCrash/configs/fake_ip_filter` 里加：

```
+.gstatic.com
+.googleapis.com
```

连同此前为扩展安装 / Play 更新 / FCM / Chrome 更新加的 Google 域，**共 21 条**。
加完后热更新：

```sh
/etc/ShellCrash/task/task.sh hotupdate
```

（`fake_ip_filter` 是 ShellCrash 的官方扩展点，会并入 `dns.fake-ip-filter`；
该目录已在 `sysupgrade` 保留清单里，升级不丢。）

**验证结果**：Chrome 页面恢复正常（用户确认「gemini 修好了」）。

**为什么这样就对了**：客户端拿到真实公网 IP → LNA 看到的是 `public → public` → 放行；
同时按真实 IP 做的分流规则照常命中，没有改变任何分流语义。

**取舍**：这是**针对性**修复，不是把 fake-IP 段整体换掉。
换段（方案 B）需要同步改 `clash_modify.sh` / `fw_nftables.sh` / `fw_iptables.sh` /
`singbox_modify.sh`，且 ShellCrash 升级会覆盖 `clash_modify.sh`，维护成本高；
切 `redir_host`（不发 fake-IP）则改变现有分流依赖 SNI 的行为，要重新实测。
所以选针对性方案。

> ⚠️ 同样的机制还会命中**其他由浏览器进程发起、且解析到 fake-IP 的 Google 请求**
> （组件更新、部分后台服务）。加进 `fake_ip_filter` 的域越多，这类请求越不容易踩到。

## 5. 为什么网页外壳能打开不能作为修复完成的判据

**因为外壳和 UI 是两段渲染的，失败只发生在后半段。**

islands bundle 被拒时，主 bundle 已经把输入框画出来了 ——
页面**看起来是加载成功**的，只是少了页头、侧栏、推荐区。
于是下面这些「看起来像成功」的信号**全是假阴性**：

| 假信号 | 为什么假 |
|---|---|
| `curl gemini.google.com` 返回 200 / 784 KB | 拿到的是主 bundle，islands bundle 是另一次请求 |
| HTML 里搜不到「不支持你的国家 / unsupported / 国家 / 地区 / 不可用」 | 地区报错是**前端渲染**的，HTML 里根本没有这句话 |
| 截图看起来正常 | 只截到主 bundle 画出的部分 |
| 页面标题正常 | 标题由主 bundle 提供 |

**这已经造成过一次误判**：2026-10-19 按「方案 A/C/D 已落地并端到端验证」结案，
依据是扩展安装恢复 + 页面能打开；
**同一机制在 10-20 仍然让 Gemini 只剩输入框** —— 因为那天的判据就是「外壳能打开」。

### 5.1 正确的判据

**UI 完整加载**，具体三条同时成立：

1. **控制台没有 LNA / CORS 拦截**：`tools/cdp.js` 抓到的
   `Log.entryAdded` / `Runtime.exceptionThrown` / `Network.loadingFailed` 里
   没有 `ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS`、
   没有 `blocked by CORS policy`、没有 `Permission was denied for this request to access the local address space`。
2. **非 2xx 响应里没有 gstatic / googleapis 的 bundle 请求**。
3. **DOM 里 UI 结构在**：`tools/cdp.js` 的 `Runtime.evaluate` 取 `document.body.innerText`，
   能看到输入框**以外**的内容（侧栏 / 推荐区标题 / 页头），
   而不是只有输入框那段文本。

> 一句话：**截图绿了不算数，看 UI 有没有真的长出来。**

## 6. 这条机制解释不了什么

同一批症状里，有几件**不是** LNA，别混在一起查：

| 现象 | 真正的机制 | 去哪 |
|---|---|---|
| 手机 Play 商店更新一直转圈 | Redir 模式只代理 TCP，QUIC（UDP 443）不代理且目标是 fake-IP → 静默黑洞（conntrack `[UNREPLIED]`） | [TROUBLESHOOTING.md](TROUBLESHOOTING.md) |
| Google 账号被判「不支持的国家」 | 出口 IP 的**注册地**被判 CN（服务方自己的 IP 库），与 LNA 无关 | [TROUBLESHOOTING.md](TROUBLESHOOTING.md) |
| 社媒 / 流媒体加载不全 | 各服务方自己的地区闸门（Meta 判 `country_code:CN`、Reddit 403） | [TROUBLESHOOTING.md](TROUBLESHOOTING.md) |
| Chrome 地区种子把用户判成境外 | Chrome 自己缓存的 `variations_country` 种子 | [TROUBLESHOOTING.md](TROUBLESHOOTING.md) |

## 7. 证据清单

| 证据 | 在哪 |
|---|---|
| 2026-10-19 完整诊断（含 netlog 片段、Chromium 源码引用、方案 A/C/D） | [CHROME-GOOGLE-DIAGNOSIS.md](CHROME-GOOGLE-DIAGNOSIS.md) |
| 浏览器层逐项排除（扩展 / 策略 / 代理 / DoH / hosts / DNS 缓存 / profile） | `../evidence/agents/agent-browser-client.md` |
| Chrome 地区种子与旧 HK 页面缓存的定位 | `../evidence/agents/agent-pc-side.md` |
| 2026-10-20 晚「Gemini 只剩输入框」的根因与 islands bundle 报错原文 | 根 [PROGRESS.md](../PROGRESS.md) 批次记录 |
| 复测截图（本地留存，`.gitignore` 已排除） | `../evidence/gemini-after.png` |
| 抓控制台的脚本 | `../tools/cdp.js` |
