# Chrome 扩展安装失败 / 手机 Play 更新卡住 —— 诊断报告（2026-10-19）

> **一句话**：Chrome 155 的 Local Network Access 与 mihomo fake-IP 冲突的诊断与当时的处置（2026-10-19 阶段性记录；**最终结论以 [LNA-FAKE-IP.md](LNA-FAKE-IP.md) 为准**，本文的「已修复」结论并不完整）。

## 结论（先说结果）

**不是 ShellCrash 的广告拦截或 Google 规则把服务封了。** 实测：

- 生成后的 `/tmp/ShellCrash/config.yaml` 里，`clients2.google.com` 的匹配规则 **0 条**；
  `googleusercontent.com` 只有限定 initiator 的精确规则；`🛑 广告拦截` 里没有任何 Google 下载域。
- 商店页面 31 张 `lh3.googleusercontent.com` 图片全部正常解码。
- 扩展 CRX 实际下载成功：9.1MB 与 77.9MB 两个包，文件头均为 `Cr24`。

真正的原因是两个独立的问题：

1. **Chrome 扩展安装 "Image decode failed"** = mihomo 的 fake-IP 地址段与 Chrome 155 的
   **Local Network Access（LNA）保护**冲突（已完整复现）。
2. **手机 Play 更新转圈** = Redir 模式只代理 TCP，**QUIC（UDP 443）不代理且目标还是 fake-IP**，
   流量被静默黑洞（已抓到 conntrack `[UNREPLIED]`）。

另有一个次要问题：`googleapis.com` 被整段路由到新加坡 AI 组，导致 Play / Chrome 更新 /
FCM 的出口不一致，会放大上面的现象。

---

## 根因 1：Chrome LNA 拦截 fake-IP（插件安装报错）

### 复现与证据

用临时 Chrome 配置（不影响日常配置）打开 uBlock Origin Lite 商店页并点击"添加至 Chrome"：

```
PROBE  {"url":"https://chromewebstore.google.com/detail/ublock-origin-lite/...","hasBtn":true,"disabled":false}
CLICK_ERR null
TEXT_HITS ["下载时出错: Image decode failed"]
```

抓到的浏览器进程网络日志（netlog）关键事件：

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

结论链：
`fake-IP 198.18/15 + fc00::/16` → Chrome 判为本地网络 → 安装弹窗拉图标属于
**浏览器进程请求（无 initiator，client 地址空间=public）** → `public → local` 被 LNA 拒绝
→ `icon_error` → 页面显示 `Image decode failed`。

普通页面图片为什么没事：页面图片的请求 initiator 是 `chromewebstore.google.com`，
它自己也被解析到 fake-IP，client 也被判为 `local`，`local → local` 被允许
（netlog 中对应 `allowed-no-less-public`）。

### 验证修复方向

用 `--host-resolver-rules="MAP lh3.googleusercontent.com 28.0.0.5"` 把图标域名强制解析到
**公网地址**后，同样的点击操作：

```
result = null        # 不再 icon_error，安装确认框正常弹出
```

即：**只要图标域名拿到公网 IP，LNA 就放行**。

---

## 根因 2：QUIC 被黑洞（手机 Play 更新转圈）

ShellCrash 当前是 `redir_mod=Redir`：只做 TCP 重定向，UDP 不代理。
`quic_rj=ON` 的实现只是 `udp dport {443,8443} return`，对 fake-IP 目标等于放行到一个
不可路由地址，并不会给客户端任何快速失败信号。

实测 conntrack（平板 10.0.0.x，以及 PC 10.0.0.37 点击安装时）：

```
udp src=10.0.0.x dst=198.18.0.140 dport=443 ... [UNREPLIED]   # 无任何回包
udp src=10.0.0.37 dst=198.18.0.105 dport=443 ... [UNREPLIED]   # 正是 lh3 的 fake-IP
```

`198.18.0.0/15`、`fc00::/16` 都不是本机路由可达地址，包发出去后无人应答。
Android / Chrome 的 HTTP/3 会等到超时才回落 TCP；Play 商店的下载流程更容易卡在
"一直转圈、下载页能进但下不动"的状态。

---

## 次要问题：Google 出口被拆成三条

当前实际匹配：

| 域名 / 模式 | 规则位置 | 出口 |
|---|---|---|
| `*.google.com`（含 `clients2`、`android.clients`、`accounts`） | `DOMAIN-KEYWORD,google` | 🚀 节点选择 → ♻️ 自动选择（实测香港 WAP） |
| `*.googleapis.com`（含 `play`、`update`、`safebrowsing`、`fcm`） | 模板第 2954 行 | 🤖 人工智能 → 🇸🇬 新加坡节点 |
| `dl.google.com`、`googletagmanager.com` | GoogleCN 直连列表 | 🎯 全球直连 = DIRECT |
| `mtalk.google.com`（FCM 长连接） | `📢 谷歌FCM` | 🚀 节点选择（香港） |

`dl.google.com` 直连在本机 ISP 下是通的（实测 302 → `ChromeSetup.exe`，MZ 头正常），
不是问题。真正不合理的是第二行：一条为 AI 端点准备的
`DOMAIN-SUFFIX,googleapis.com,🤖 人工智能` 把 **整个 googleapis 域**都带去了新加坡，
而 Play 的 checkin/FCM 走香港，下载 API 走新加坡，出口不一致。

---

## 修复方案（已于 2026-10-19 实施）

### 方案 A（最小改动，先解决插件安装）

在 `/etc/ShellCrash/configs/fake_ip_filter`（ShellCrash 官方扩展点，会并入
`dns.fake-ip-filter`）里加入：

```
#Chrome Web Store 安装图标：避免 fake-IP 被 Chrome LNA 判为本地网络
+.googleusercontent.com
```

然后热更新：`/etc/ShellCrash/task/task.sh hotupdate`（或 `start.sh restart`）。
`/etc/ShellCrash/configs` 已在 `/etc/sysupgrade.conf` 保留清单里，升级不丢。

> 注意：这是**针对性**修复。其他由浏览器进程发起、且解析到 fake-IP 的 Google 请求
> （组件更新、部分后台服务）仍可能遇到同样的 LNA 拦截。

### 方案 B（彻底，但改动大）

把 fake-IP 段换成公网段（例如 IPv4 `28.0.0.0/8`，IPv6 关闭或换公网段）。
需要同步修改：

- `/etc/ShellCrash/starts/clash_modify.sh`：`fake-ip-range` / `fake-ip-range6`
- `/etc/ShellCrash/starts/fw_nftables.sh`：`198.18.0.0/15`
- `/etc/ShellCrash/starts/fw_iptables.sh`、`fw_stop.sh`、`singbox_modify.sh`

ShellCrash 升级会覆盖 `clash_modify.sh`，维护成本高，不如先做方案 A。
另一个选项是面板把 DNS 模式切到 `redir_host`（完全不发 fake-IP），但会改变现有
分流依赖 SNI 的行为，需要实测。

### 方案 C（解决手机 QUIC 卡顿）

在 nft 的 prerouting（优先级早于 ShellCrash 的 `dstnat`）加一条**快速拒绝**：

```
table inet quicguard {
  chain pre {
    type filter hook prerouting priority -150; policy accept;
    ip  daddr 198.18.0.0/15 udp dport { 443, 8443 } reject with icmp port-unreachable
    ip6 daddr fc00::/16     udp dport { 443, 8443 } reject with icmpv6 port-unreachable
  }
}
```

让客户端立刻收到 ICMP，Chrome/Android 会马上回落 TCP，而不是等 QUIC 超时。
如果将来切到 TProxy/Mix 真正代理 UDP，则不需要这条规则（但需关闭 flow offloading）。

### 方案 D（整理 Google 出口）

在 `/etc/ShellCrash/yamls/rules.yaml` 顶部（AI 规则之前）加：

```yaml
- DOMAIN-SUFFIX,play.googleapis.com,🚀 节点选择
- DOMAIN-SUFFIX,android.clients.google.com,🚀 节点选择
- DOMAIN-SUFFIX,update.googleapis.com,🚀 节点选择
- DOMAIN-SUFFIX,safebrowsing.googleapis.com,🚀 节点选择
- DOMAIN-SUFFIX,fcm.googleapis.com,🚀 节点选择
```

Gemini/AI 端点继续走 `🤖 人工智能`。改完要同步 `ai-rules-update.sh`，
否则每周自动更新会把这些覆盖行冲掉（脚本已有 opencode.ai 覆盖行的同类处理）。

---

## 复现方法（供以后复查）

- 诊断用的临时 Chrome 已清理，没有改动日常 Chrome 配置。
- 关键命令：
  - 看 fake-IP：`nslookup lh3.googleusercontent.com 10.0.0.1`
  - 看 QUIC 黑洞：`grep "udp.*dport=443" /proc/net/nf_conntrack`
  - 看分组：`curl -s 127.0.0.1:9999/proxies | jsonfilter -e '@.proxies["🤖 人工智能"].now'`
  - Chrome netlog：`chrome.exe --log-net-log=... --net-log-capture-mode=Everything`，
    搜 `BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS` / `insecure-local-network`

---

## 实施记录（2026-10-19）

已按方案 A + C + D 落地，并完成端到端验证：

| 项目 | 落地内容 |
|---|---|
| fake-ip 过滤 | `/etc/ShellCrash/configs/fake_ip_filter` 增加 16 条 Google 域（`+.googleusercontent.com`、`clients2/4`、`+.gvt1.com`、`play/update/safebrowsing/fcm`、`dl.google.com`、`accounts.google.com` 等） |
| QUIC | 新增 `/etc/quicguard.nft`，prerouting priority -150 对 `198.18.0.0/15` / `fc00::/16` 的 UDP 443/8443 返回 ICMP port-unreachable；`/etc/rc.local` 开机加载 |
| 分流 | `rules.yaml` 顶部 9 条 Google 出口规则 → `🚀 节点选择`；`ai-rules-update.sh` 同步生成并校验 |
| 热更新 | 修复 `task/task.sh`：重载路径从 `/tmp/...`（被 mihomo SAFE_PATHS 拒绝）改为 `/etc/ShellCrash/config.yaml`，并用探针规则验证运行配置确实更新 |
| 防回退 | `ai-api-check.sh` 第 6/7 节检查 hotupdate 路径、fake-ip 过滤、quicguard、Google 规则 |
| 持久化 | `/etc/quicguard.nft`、`/etc/ShellCrash/configs/fake_ip_filter`、`/etc/ShellCrash/task/task.sh`、`/etc/rc.local` 均在 `sysupgrade -l` 清单内 |

验收结果：

- 真实 Chrome 临时实例点击“添加至 Chrome” → 安装确认框正常弹出 → 点击“添加扩展程序” →
  `profile/Default/Extensions/ddkjiahejlhfcafbddmgiahcphecmpfh/2026.1018.2229_0` 生成，
  全流程无 `Image decode failed`。
- `lh3.googleusercontent.com` 从 LAN 解析为真实公网 IP（`2404:6800:...` / `142.250.198.129`）。
- UDP 443 探测到 fake-IP：`quicguard` counter 命中（IPv4/IPv6 均计数）。
- 运行时分流：`play.googleapis.com → 🇭🇰 香港WAP-优化2 → ♻️ 自动选择 → 🚀 节点选择`；
  `generativelanguage.googleapis.com → 🇯🇵 日本-优化 → 🤖 AI网页 → 🤖 人工智能`。
- `ai-api-check.sh`：策略组、延迟、三种协议（chat/messages/responses）全部 200，结果“全部通过”。
- 备份在路由器 `/root/backup/pre-chrome-lna-fix/`。

> 注意：本次修复的核心是“让 Chrome 不再把 fake-IP 当作图标/下载目标”，
> 并不是放宽广告拦截。`🛑 广告拦截` 仍是 REJECT，Google 下载域本来就不在其中。
