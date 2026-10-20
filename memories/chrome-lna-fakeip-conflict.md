---
name: chrome-lna-fakeip-conflict
description: 已修复：Chrome 155 LNA 把 mihomo fake-IP(198.18/15、fc00::/16)判成本地网络，导致
  Web Store 安装报 Image decode failed；手机 Play 卡住有两因：QUIC 未代理被黑洞、Play 下载
  CDN 经机场节点超时（必须改直连）
metadata:
  node_type: memory
  type: project
  originSessionId: sess_8a5d2dac-14e8-4ce6-ac70-a28d352735db
---

## 状态：已于 2026-10-19 修复并验收

### 根因 1：Chrome 扩展安装 "Image decode failed"

Chrome 155 的 Local Network Access（LNA）把 mihomo fake-IP
`198.18.0.0/15` + `fc00::/16` 判为**本地网络**。Web Store 安装弹窗拉扩展图标是
浏览器进程请求（无 initiator，client address space=public），`public → local` 被
`ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS (-385)` 拦截 →
`extensions/browser/webstore_install_helper.cc` 的 `kIconError` → 显示
`Image decode failed`。不是广告拦截（`clients2.google.com` 规则 0 条，CRX 下载正常）。

### 根因 2：手机 Play 更新转圈

Redir 模式只代理 TCP；`quic_rj=ON` 的实现只是 `udp dport {443,8443} return`，
对 fake-IP 目标等于放行到不可路由地址。conntrack 实测 `udp dst=198.18.x.x:443 [UNREPLIED]`，
客户端 HTTP/3 只能等超时。

### 已落地修复

- `/etc/ShellCrash/configs/fake_ip_filter` 增加 16 条 Google 域：
  `+.googleusercontent.com`、`clients2/4.google.com`、`dl.google.com`、`+.gvt1.com`、
  `update/safebrowsing/optimizationguide-pa/www/play/android/android.clients/fcm/
  fcmregistrations/firebaseinstallations.googleapis.com`、`accounts.google.com`。
  **必须让这些域解析真实 IP**，否则 Chrome LNA 继续拦截浏览器进程请求。
- `/etc/quicguard.nft`（`table inet quicguard`，prerouting priority -150）对
  `198.18.0.0/15`、`fc00::/16` 的 UDP 443/8443 `reject`（ICMP port-unreachable），
  强制 QUIC 快速回落 TCP；`/etc/rc.local` 开机加载，带 counter。
- `/etc/ShellCrash/yamls/rules.yaml` + `ai-rules-update.sh`：9 条 Google 出口规则
  （play/android.clients/update/safebrowsing/fcm/fcmregistrations/firebaseinstallations/
  www.googleapis.com）统一指向 `🚀 节点选择`；AI 端点仍走 `🤖 人工智能`。
  每周 `ai-rules-update.sh` 会重新生成并校验这些覆盖行。
- **hotupdate 的重大隐藏 bug**：`task/task.sh` 原来 PUT
  `{"path":"/tmp/ShellCrash/config.yaml"}`，被 mihomo SAFE_PATHS 拒绝
  （allowed paths: `[/etc/ShellCrash]`），但 `put_save` 丢弃 HTTP 状态所以静默失败——
  热更新只改文件、不重载运行配置。已改为 `/etc/ShellCrash/config.yaml`，并用探针规则
  (`hotupdate-probe.invalid`) 验证 `/rules` API 立即更新。
- `ai-api-check.sh` 新增第 6/7 节，ShellCrash 更新覆盖脚本后会自动检测/修复
  hotupdate 路径，并检查 fake_ip_filter / quicguard / Google 规则。
- 持久化：以上文件（含 `/etc/ShellCrash/task/task.sh`、`/etc/rc.local`）均已在
  `/etc/sysupgrade.conf` / `sysupgrade -l` 清单内。

### 验收

- 真实 Chrome 临时实例：安装确认框弹出 → 点“添加扩展程序” → 扩展目录生成，
  无 `Image decode failed`。
- `lh3.googleusercontent.com` 从 LAN 解析到真实公网 IP（不再 198.18/fc00）。
- `play.googleapis.com → 🚀 节点选择 → 🇭🇰 香港WAP`；
  `generativelanguage.googleapis.com → 🤖 人工智能 → 🤖 AI网页 → 🇯🇵`。
- `ai-api-check.sh` 全部通过（三协议 200）。
- 备份：路由器 `/root/backup/pre-chrome-lna-fix/`；项目记录
  `F:\Project\ClientTriage\docs\CHROME-GOOGLE-诊断.md` 与 `PROGRESS.md` 第四轮。

## 2026-10-19 21:46 追加：Play「全员等待中」的第二根因 — 下载 CDN 必须直连

症状：手机上 Play 商店所有更新停在“等待中”。控制面完全正常
（`play.googleapis.com` 204、`android.clients.google.com` 可达、`services.googleapis.com` 有数据），
只有 APK 下载 CDN `rr*---sn-*.xn--ngstr-lra8j.com`（punycode 解码为 `ångströ.com`）卡死。

证据链：
- mihomo `/connections` 里手机（10.0.0.x，IPv6 ULA `<REDACTED-ula>...:3491:b76a:18cb:1596`，MAC <REDACTED-mac>）
  的 CDN 连接是 `upload≈1.8–2.7KB, download=0`，即 TLS ClientHello 发出、永远没有响应。
- 该域名全球解析（Cloudflare/Google DoH 经代理查询）都返回 `203.208.33.80`，不是 DNS 污染。
- **经香港/日本节点访问该 IP 全部超时；路由器直连 IPv4/IPv6 均 0.17s 完成 TLS**。
  即机场节点到 Google Play 下载边缘不可达，直连反而正常。`dl.google.com` 本来就是模板 DIRECT，也一直正常。
- 手机 IPv6 ULA 与 IPv4 的对应关系要用 `ip -6 neigh` 按 MAC 核对，不能按 IPv4 猜。

修复（2026-10-19 已生效）：
- `/etc/ShellCrash/yamls/rules.yaml` 顶部新增（在模板规则之前）：
  `DOMAIN-SUFFIX,xn--ngstr-lra8j.com,🎯 全球直连`、`DOMAIN-SUFFIX,gvt1.com,🎯 全球直连`。
- `ai-rules-update.sh` 的 Google 覆盖块同步加入这两行，每周日自动更新不会冲掉。
- `sh /etc/ShellCrash/task/task.sh hotupdate` 热加载即生效；备份 `/root/backup/pre-play-direct-20261019-214655/`。
- 验证：限速请求的 `/connections` 显示 `[DIRECT,🎯 全球直连] rule=DomainSuffix(xn--ngstr-lra8j.com)`；
  `dl.google.com` 直连 Range 下载 3.3MB/s。
- **客户端注意**：队列卡死在“等待中”后 Play 商店不会自动重试，需要在下载列表点“重试”，
  或强制停止 Play 商店再打开（必要时开关一次飞行模式）。

### 2026-10-19 22:15 补充（同症状复查）

- `203.208.32.0/19` 在 `cn_ip`、`2401:3800::/32` 在 `cn_ip6`——Play CDN 的 IP 本来就被
  判为国内直连。为彻底绕开 mihomo 中转和 quicguard，已把 `+.xn--ngstr-lra8j.com` 加入
  `/etc/ShellCrash/configs/fake_ip_filter`（备份 `/root/backup/fake_ip_filter.pre-ngstr`），
  hotupdate 后生效。手机现在会拿到真实 IP，直接走 nft 的 `return`。
- 诊断技巧：mihomo `/connections` 里 `up≈1.8KB / down≈4.48KB` 且 1 秒内消失的连接是
  **TLS 握手 + 预连接（preconnect）**，不是下载失败。用
  `openssl s_client -proxy 127.0.0.1:7890 -connect <host>:443` 只握手可复现同样字节数。
  googlevideo 上也会出现同样的预连接，属正常 Cronet 行为。
- 若 CDN 路径已确认正常（直连 404/0.13s）但手机仍“全员等待中”，且 `/connections`
  里没有真正的下载请求，则问题在手机端 Play 队列，按上面客户端步骤处理（重启手机最有效）。

### 2026-10-19 22:40 追加：用 <REDACTED-DEVICE> 实测发现 CDN 分两类，改为按 IP 分流

用 GoldSunEnhance 项目的 adb 工具（`tools/adbw.sh`，<REDACTED-DEVICE> / 10.0.0.x / Android 16）
做对照，拿到决定性事实：Play 返回的下载 CDN 主机分两类，路由要求完全相反：

- **国内边缘**：`ni57rn76`、`2x3een7k` 等，解析到 `203.208.32.0/19` / `2401:3800::/32`，
  **只能直连**（机场节点全部不可达）。
- **海外节点**：`oji3b5-5u`、`i3belnls`、`oji3bc-5j` 等，解析到 `142.251.x` / `173.194.x` /
  `74.125.x` / `2404:6800::`，**直连必超时，代理可达**（HK 79–287ms、JP 123–153ms）。

所以之前的 `DOMAIN-SUFFIX,xn--ngstr-lra8j.com,🎯 全球直连` 是错的：它把海外节点也逼上直连。
已改为**按目标 IP 分流**（`yamls/rules.yaml` 顶部，生成脚本同步）：

```
- IP-CIDR,203.208.32.0/19,🎯 全球直连
- IP-CIDR6,2401:3800::/32,🎯 全球直连
```

其余 CDN 请求落到模板的 `DOMAIN-SUFFIX,...,🚀 节点选择` 走代理。PC 端验证：
海外 CDN `404 / TLS 0.87s`（代理），国内 CDN `404 / TLS 0.10s`（直连）。
备份 `/root/backup/pre-play-split-20261019-223946/`。

**Meizu 侧仍未真正下载**：点“全部更新”后 Play 进入“正在进行 3 项更新”，持续向
`203.208.x` 发起连接，但每个连接只有约 6KB（握手+小响应）就结束，没有 APK 流量；
Finsky 日志有 `ItemStore: getItems RPC failed`。小米则完全没发出 CDN 请求。
下一步需要 Meizu 的 **verbose Finsky 日志**确认 CDN 返回的是 403/404 还是 302。

**Meizu adb 的坑**：为了触发重试连续两次 `ubus call hostapd.<ap> del_client` 踢 Wi-Fi 后，
它的无线调试服务掉线（端口 40167/51692 可连但不完成 adb 握手，mDNS 不再广播），
`adb reconnect offline` 也无效，需要手机上重开“开发者选项 → 无线调试”（可能要确认授权弹窗）。
此外手机从 5G 掉到 2.4G，再踢一次才回到 5G。不要频繁踢它。

### 2026-10-19 23:26 最终根因（已修复并验证）

用 Meizu 的 logcat 抓到真凶：

```
E/Finsky: CronetDownloader: onFailed
org.chromium.net.impl.NetworkExceptionImpl: net::ERR_EMPTY_RESPONSE, ErrorCode=11
Download Service Error: CANNOT_CONNECT (8)
bytes_downloaded=0
```

`NetdEventListenerService: onDnsEvent` 显示 Play 先连 `rr*---sn-ni57rn76.xn--ngstr-lra8j.com`
（203.208.33.x，返回 **302**），重定向目标是 `rr*---sn-*.googlevideo.com`；
该域名解析到**中国电信 GGC**（`58.254.149.x` / `58.254.137.x`），直连 0.066s 正常。

但 `googlevideo.com` 不在 fake_ip_filter 里 → 手机拿 fake-IP → 命中
`DOMAIN-SUFFIX,googlevideo.com,🌍 国外媒体` → 代理 → **机场节点到不了国内 GGC**
→ 空响应/超时 → Play 重试 3 次后放弃并报“无法安装”。

**修复**：`/etc/ShellCrash/configs/fake_ip_filter` 增加 `+.googlevideo.com`
（备份 `/root/backup/fake_ip_filter.pre-googlevideo`），hotupdate 后：
- 国内 GGC 真实 IP → `cn_ip return` → 直连；
- 海外 googlevideo IP → 仍走 `🌍 国外媒体` 代理。
实测 Meizu 立即出现 `58.254.149.130` 等 GGC 流量（944KB/204KB/162KB…），
ChatGPT `lastUpdateTime=2026-10-19 23:26:01` 更新成功，Play 显示“上次更新时间：刚刚”。

注意：`♻️ 自动选择` 里的占位节点 `过滤掉14条线路` 与 `🇯🇵 日本-优化` 定义完全相同，
不是本次根因；排查时一度怀疑它，实测切到日本节点后 googlevideo 依旧超时，才定位到 GGC。

## 2026-10-20 00:20 Gemini 地区限制的最终修复（已落地并验证）

现象：PC 正常 Chrome、Xiaomi 等客户端打开 Gemini 提示“不支持你所在的地区”，
而 Meizu（fake-IP）正常。根因不是账号、不是扩展：这些客户端把 `gemini.google.com`
解析到了**真实国内边缘 IP**（`203.208.32.0/19` 等），nft 的 `ip daddr @cn_ip return`
让连接**绕过 mihomo 直连 Google 中国边缘** → Google 按中国区拒绝。
证据：强制 `--resolve gemini.google.com:443:203.208.33.21` 时 mihomo 里**没有**该连接；
且 `IP-CIDR ...,no-resolve` 对这类连接不匹配（no-resolve 在 redir/代理入站上不生效）。

修复（三层）：
- `/etc/googlecn.nft` 新表，`priority -105`（早于 ShellCrash 的 dstnat -100）：
  LAN 发往 `203.208.32.0/19`、`2401:3800::/32` 的 TCP 80/443 `redirect to :7892`，
  让连接进入 mihomo 按域名分流。
- `/etc/quicguard.nft` 对这两段 UDP 443/8443 也 reject，强制 QUIC 回落 TCP。
- `yamls/rules.yaml` 末尾（AI 域名规则之后、模板规则之前）：
  `IP-CIDR,203.208.32.0/19,🎯 全球直连`、`IP-CIDR6,2401:3800::/32,🎯 全球直连`。
  **不能加 `no-resolve`**，否则不匹配；AI 域名规则在前，所以 Gemini 仍走代理。
- `ai-rules-update.sh` 同步；`/etc/rc.local` + `/etc/sysupgrade.conf` 持久化。

验证：
- 强制国内 IP 的 `gemini.google.com` → **200 / 784KB**，链 `[日本-优化, AI网页, 人工智能]`。
- 强制国内 IP 的 Play CDN → **404**（命中 IP-CIDR 直连），Play 链路不受影响。
- Meizu 的 Gemini App 正常。
- PC 正常 Chrome 仍可能黑屏/提示旧地区页，属扩展或站点缓存（无痕窗口正常）；
  需硬刷新/清站点数据/关扩展，与网络无关。

### 2026-10-20 运行态复核（全部只读）：不需要重启路由器

- `nft list table inet googlecn` 与 `quicguard` **均已加载**（googlecn priority dstnat -5
  = -105，早于 ShellCrash dstnat -100）；`/etc/rc.local` 已含两条开机加载语句。
- 运行配置 `/tmp/ShellCrash/config.yaml` 的 `fake-ip-filter` 实含 19 条 Google 域，
  末两条 `+.xn--ngstr-lra8j.com`、`+.googlevideo.com` → 运行态生效，不只是文件写了。
- `rules.yaml` + `ai-rules-update.sh` 均为 `IP-CIDR,203.208.32.0/19,🎯 全球直连` /
  `IP-CIDR6,2401:3800::/32,🎯 全球直连`（**不带 no-resolve**）。`owrt-remove-broad-ipcidr.sh`
  的历史状态存疑，但**当前态即预期终态**，不必再动。
- DNS：`rr3.sn-ni57rn76.xn--ngstr-lra8j.com` → `2401:3800:4002:2::12`（真实 IP，非 fake-IP）。
- 实测：Play CDN 404/0.19s、`dl.google.com` Range 3MB 206 @7MB/s、`play.googleapis.com`
  404/0.51s、`gemini.google.com` 强制指向 203.208.33.21 → **200**/0.99s。
- 路由器自身 curl 报 `CN does not match` 是严格证书校验，加 `-k` 即通，**与网络无关**。
- 结论：修复全部在运行态生效，**重启既没必要也无收益**。Play 仍"等待中"就是手机端队列
  卡死 → 强制停止 Play 商店 → 重开 → 点"重试"（或开关一次飞行模式）。

### 2026-10-20 00:45 Gemini「不支持此国家」的真正根因（已修复并验证）

前面所有修复都只解决了"规则匹配"，**没解决"出口"**。两个剩余根因：

1. **境外 QUIC 直连逃逸**：`fw_nftables.sh` 里 `quic_rj=ON` 的实现只有
   `nft add rule inet shellcrash prerouting udp dport {443, 8443} return`
   ——是**放行**不是阻断。Redir 模式不代理 UDP，所有境外 HTTP/3 直接出 WAN，
   Google 看到的出口 IP 是国内运营商 → 按中国区拒绝。
   链上 `ip daddr @cn_ip return` / `ip6 daddr @cn_ip6 return` 在 QUIC 规则**之前**，
   所以到达 QUIC 规则的目标必然非国内 → 改成 `counter reject with icmpx type port-unreachable`
   正好等于"阻断境外 QUIC、保留国内 QUIC"，且只加在 prerouting 链（路由器自身不受影响）。
2. **TLS 嗅探缺 `override-destination`**：mihomo 的 sniffer 段里只有 http 带
   `override-destination: true`。客户端解析到国内边缘 IP（203.208.32.0/19）时，
   mihomo 只用 SNI 做**规则匹配**，连接目标仍是原来的国内边缘 IP →
   即使走日本节点，Google 仍按"中国的边缘"返回限制页。给 tls 加上
   `override-destination: true` 后 mihomo 会重新解析到全球边缘（142.251.x / 2001:4860::），
   走日本节点 → 真实页面。
3. 附带：`configs/fake_ip_filter` 加 `+.google.com` → 客户端直接拿全球边缘真实 IP。

**验收**：PC 透明代理路径 + `--resolve gemini.google.com:443:203.208.33.21`
→ 200 / 784,525 B 真实页面（修复前同场景 404 / 1,561 B）。
mihomo 连接显示 `dnsMode=normal`（已重解析）、`rule=DomainSuffix`、
`chains=[日本-优化, AI网页, 人工智能]`。QUIC reject 计数器实测有包命中。

**防回归**：`ai-api-check.sh` 新增第 9 节，检查并自动修复 fw_nftables.sh 的 QUIC 钩子、
live nft 规则、clash_modify.sh 的 tls override-destination、fake_ip_filter 的 `+.google.com`
（ShellCrash 更新会覆盖前两个脚本）。备份 `/root/backup/pre-quic-sniff-20261020-004439/`。

**排查中确认的坑**：
- `dhcp.@dnsmasq[0].domain='lan'` 会让客户端把查询拼成 `xxx.lan`，
  导致 fake-ip-filter 的精确/后缀匹配**全部失配**（`dl.google.com` 裸名返回真实 IP，
  带 `.lan` 返回 fake-IP）。但 SNI 嗅探会用真实域名覆盖 `.lan` 名字，
  所以**规则匹配和实际连接仍然正确**，只是 Chrome LNA / Play CDN"拿真实 IP 直连"这条路受影响。
- fake-ip-filter 里的 `'*'` 和 `'*.lan'` 是**无效条目**，实测不匹配任何真实域。
- 路由器本机 `nslookup` 走 dnsmasq→WAN DNS，拿到的是**污染结果**（如 gemini.google.com
  → 69.63.184.142），不能代表 LAN 客户端；判断客户端行为要用 `nslookup x 10.0.0.1`。
- 路由器自身流量走 OUTPUT 不走 PREROUTING，所以 `googlecn.nft` 这类 prerouting 规则
  **对路由器自己无效**；验证 LAN 路径必须从客户端发起。

### 2026-10-20 01:00-01:30 Gemini 地区限制的完整根因链（13 个子代理并行排查后定案）

前面几轮只修了"规则匹配"，**没修"出口"**。最终是 4 条根因叠加：

1. **境外 QUIC 直连逃逸**：`fw_nftables.sh` 里 `quic_rj=ON` 的实现只有
   `nft add rule inet shellcrash $1 udp dport {443, 8443} return` —— 是**放行**不是阻断。
   Redir 不代理 UDP，境外 HTTP/3 直接出 WAN。链上 `ip daddr @cn_ip return` 排在 QUIC 规则之前，
   所以到达 QUIC 规则的目标必然非国内 → 改成 `counter reject with icmpx type port-unreachable`。
2. **TLS 嗅探缺 `override-destination`**：mihomo 的 sniffer 里只有 http 带该选项。
   客户端解析到国内边缘 IP 时，mihomo 只用 SNI 做规则匹配，连接目标仍是国内边缘 IP →
   走日本节点也照样被判"你在中国的边缘"。给 tls 加上后 mihomo 会重新解析到全球边缘。
3. **`IP-CIDR,203.208.32.0/19` 缺 `no-resolve`**（最隐蔽）：无 no-resolve 的 IP-CIDR 会在
   规则匹配时**触发真实 DNS 解析**，实测 `connectivitycheck.gstatic.com → dst=203.208.41.2
   → rule=IPCIDR → chains=DIRECT`，导致 gstatic/gvt1/googletagmanager/app-measurement/
   tools.google.com 等 13 个 Google 端点**全部以中国出口 IP（58.254.x）直连**，与 API 的日本出口割裂。
   修法：加 `,no-resolve`（规则本体改在生成器 `ai-rules-update.sh` 里，否则每周 cron 冲掉）；
   同时新增 **E 段**（19 条 Gemini/Google 端点 → `🤖 人工智能`）插在 IP-CIDR 与
   模板 `DOMAIN-KEYWORD,google` 之前。
4. **非白名单端口 + 出口国漂移**：
   - ShellCrash 只代理 TCP `{22,80,443,8080,8443}` → FCM 5228 / DoQ 19302 / 5226 / 8081 / 8883
     真实 IP 目标直连（实测小米平板 10.0.0.x → Google 全球 DoQ 2001:4860:... 直连）。
     修法：端口集加 5228/19302（改 `fw_nftables.sh` 的 PORTS）+ 独立表 `googleroute.nft`
     （priority dstnat-4，TCP {5222,5223,5224,5226,5228,8081,8883} → :7892）+ quicguard 阻断其 UDP。
   - `🤖 人工智能` 曾指向 `🚀 手动切换`（含 6 个香港节点）→ **Google Gemini 在香港是未支持地区**，
     实测出口 `<REDACTED-EXIT-IP> = HK`。必须保证 `🤖 人工智能 = 🤖 AI网页`（日/新/台/美，无港）。

**最终验收**：PC 透明路径 + 强制 `--resolve gemini.google.com:443:203.208.33.21` → **200 / 784,645 B**
真实页面（修复前 404 / 1,561 B）；`www.gstatic.com` → `rule=DomainSuffix gstatic.com` → 日本节点
（修复前 58.254.137.x 中国 CDN）；`dl.google.com` Range 3MB 206 @10.87MB/s（Play 无回归）；
出口 `ip=<REDACTED-EXIT-IP> loc=JP colo=NRT`。

**`ai-api-check.sh` 第 9/10 节**已把以上全部修复纳入自检+自动修复（ShellCrash 更新会覆盖
`fw_nftables.sh` 与 `clash_modify.sh`）。

**`.lan` 清理的定论**：
- 路由器 `dhcp.@dnsmasq[0].domain='lan'` 让客户端把查询拼成 `xxx.lan`，
  fake-ip-filter 的精确/后缀匹配**全部失配**（mihomo 的 `*.X` 是**单标签**通配，`+.X`/`rule-set:`
  才是任意深度；裸 `*` 条目完全失效）。
- 修法 A（**已验证不可用**）：用空值 DHCP option 119/15 覆盖 → **Windows DHCP 客户端会丢弃整个
  DHCPOFFER**，PC 拿不到租约（IP 变 APIPA 169.254.x，SSH 全断）。
- 修法 B（**已采用**）：服务端把 `*.lan` 改成 `+.lan` → `.lan` 变体返回 **NXDOMAIN**，
  客户端自动回落绝对名；再清空 `dhcp.@dnsmasq[0].domain` 停止下发搜索域。

**其它坑**：
- **ShellCrash 每次重启重写 `inet shellcrash` 整表** → 直接 `nft add rule` 会被抹除，
  必须改 `fw_nftables.sh` 或用独立表 + rc.local。
- **硬件 offload 的存量连接不会重新走链** → 改端口/规则后要清 conntrack。
- 路由器本机 nslookup 走 dnsmasq→WAN DNS，**结果是污染的**（gemini.google.com → 69.63.184.142
  这个 Meta 段），不能代表 LAN 客户端；判断客户端要用 `nslookup x 10.0.0.1` 或 `127.0.0.1:1053`。
- **PC 断网时的兜底通道**：dropbear 只监听 IPv4（IPv6 22 端口 Connection refused），
  但 mihomo API 9999 在 IPv6 可用 → 用 mihomo 代理口做 HTTP CONNECT 隧道回 SSH：
  `ssh -o "ProxyCommand=python connect_proxy.py <router-ipv6> 7890 %h %p" root@10.0.0.1`
  （connect_proxy.py 在 `C:\Users\SansK\AppData\Local\Temp\owrt\`）。
- **并行子代理会互相踩踏**：AGENTS.md 要求每个任务都写根目录 PROGRESS.md → 13 个代理并发写
  同一文件，后写覆盖前写（本次把 PROGRESS.md 覆盖过一次，已按记忆库重建）。
  派子代理时要明确让它们写各自独立文件。

### 2026-10-20 夜间（第十轮）：加固 + 认知修正

**认知修正 1：Gemini 支持区包含香港。**
`support.google.com/gemini/answer/13575153`（网页版 248 国）与 `.../14579026`（移动版 203 国）
**都包含香港/台湾/印度/越南**，唯一排除的是**中国大陆（Workspace only）与俄罗斯**。
只有 **AI API**（`ai.google.dev/gemini-api/docs/available-regions`，230 条）才排除港澳。
→ 「躲开香港」只对 AI API 成立；消费版 Gemini 的**真正不变式是「Google 流量不得从中国 IP 出口」**。
（另外 CA / GB / HK-WAP 三个出口被 Google 判为机器人 → 302 `google.com/sorry/index`
（`GOOGLE_ABUSE_EXEMPTION`），那是**反滥用**不是地区限制。）

**认知修正 2：Gemini 的地区判定在前端 JS 里**（`QueryRegionBoundary-messages-*.js` 才渲染
"不支持此国家"）→ **curl 拿到 200/784KB 是假阴性**，不能证明页面正常，要用真实浏览器复核。

**认知修正 3：`override-destination: true` 会让 IP 规则对被嗅探的 TLS 连接失效。**
mihomo 按**重解析后的域名**匹配规则，于是 `IP-CIDR` 直连规则被跳过 → Play CDN 被按域名送去
日本节点 → CN 边缘从海外不可达 → 下载超时（本次真实踩到）。
修法：把需要"按目标 IP 分流"的域名加进 sniffer 的 `skip-domain`
（`+.xn--ngstr-lra8j.com`、`+.googlevideo.com`），它们不进嗅探 → 保持按 IP 分流。

**夜间加固（已落地）**
- `/etc/ShellCrash/guardian.sh` + cron `*/5`：mihomo 存活（**仅当 pid 文件存在才拉起**，
  否则会妨碍 `start.sh stop` 维护）、出口组复原、nft 表幂等重载、探活只记录。
- logd 落盘 `/overlay/log/messages`（2MB）；此前全在 tmpfs，重启即丢。
- `ai-rules-update.sh` 改原子写（tmp→校验→mv）。
- `/tmp` 诊断残留清理 29MB→4MB（tmpfs 直接吃 RAM）：MemAvailable 40.5→62MB。
- 路由器 `/root/backup` 复制到 PC 后删掉 8MB 的 `sysupgrade-backup.tar.gz`
  （内含**明文订阅 token 与 opencode.key**）→ overlay 64%→49%。
- sysctl：`netdev_max_backlog 1000→2048`（5G RX 曾溢出 9960 次）、
  `tcp_slow_start_after_idle 1→0`（mihomo 上游长连接复用）。写在
  `/etc/sysctl.d/99-router-tune.conf`。
- SQM 死配置修正（`interface eth1→wan`、download→190000），**enabled 仍为 0**。
- `ai-api-check.sh` 扩到 **11 节**（含 no-resolve / E段 / cn_ip 剔除 / skip-domain / 出口组）。

**第八轮复审结论（都是「别动」）**
- 硬件 offload（MT7981 PPE）**只覆盖境内直连**，被 Redir 重定向的代理流 0 例被 offload → **不要关**。
- 中断亲和性是 GICv3 Level 触发，运行时改写有断网风险 → **不要动**。
- 内核参数全是上游默认值；conntrack 用量 5.7–8.8%；mihomo RSS 47–75MB 震荡是 Go GC 非泄漏。
- MTU 1500 全程、PMTUD 无黑洞、MSS 已钳制、cubic+fq_codel 无需动。
- 升级保留清单完整（`sysupgrade -l` 363 项）。
- **本机已发生过一次 OOM**（`Out of memory: Killed process 17628 (CrashCore)`），
  杀的是 `start_old=ON` 拉起的僵尸实例；无 swap/zram，Committed_AS 曾达 CommitLimit 的 152%。
  → 清 /tmp 与避免僵尸实例是关键防线。
- **ttyd 常驻**（`-i br-lan -W /bin/login`，LAN 上一个 root 网页终端）——未擅自删除，待用户决定。

### 2026-10-20 凌晨：真实浏览器复核 + 三个自踩坑 + 夜间加固

**真实浏览器复核（决定性）**：ZCode 内置浏览器打开 `https://gemini.google.com/app` →
渲染出完整聊天界面，页面文本对「不支持此国家 / not available in your country / unsupported /
sorry/index / unusual traffic / 地区」的命中数为 **0**。
→ **curl 的 200/784KB 是假阴性**（Gemini 地区判定在前端 JS `QueryRegionBoundary-messages-*.js` 里渲染）。
→ 浏览器验证法：`agent.browsers.getForUrl(url)` → `tabs.new()` → `goto` → `waitForLoadState` →
`playwright.domSnapshot()`；再 `playwright.evaluate(() => document.body.innerText)` 扫关键词。

**自踩坑 1：改生成器忘定义变量** → `AI_GROUP` 未定义 → 生成出
`- DOMAIN-SUFFIX,play.googleapis.com,`（组名为空）→ mihomo 下次热加载**直接拒载**。
教训：改 `ai-rules-update.sh` 后必须 `sh -n` + 实跑 + 扫空组名 + `CrashCore.raw -t` 校验。

**自踩坑 2：原子写改造后校验段读的是旧文件** → `grep ... "$OUT"` 应为 `"$OUT.tmp"`，
否则每次都在 `mv` 之前 `exit 1`，新规则永远不生效（且报错信息指向旧文件）。

**自踩坑 3：`override-destination: true` 让 IP 规则对被嗅探的 TLS 连接失效** →
mihomo 按重解析后的域名匹配规则 → Play CDN 被按域名送去日本节点 → CN 边缘从海外不可达 → 超时。
修法：需要"按目标 IP 分流"的域名加进 sniffer `skip-domain`
（`+.xn--ngstr-lra8j.com`、`+.googlevideo.com`）。

**夜间加固**：`guardian.sh`（cron `*/5`，只检测+最小化修复，**仅当 pid 文件存在才拉起 mihomo**，
否则会妨碍 `start.sh stop` 维护）；logd 落盘 `/overlay/log/messages`；`/tmp` 残留清理
（29MB→4MB，tmpfs 直接吃 RAM，MemAvailable 40.5→62MB）；删除路由器上含明文 token 的 8MB 旧升级包
（已复制到 PC `backup/backup/`）；sysctl `netdev_max_backlog=2048`、`tcp_slow_start_after_idle=0`。
`ai-api-check.sh` 扩到 **12 节**。

**未采纳的建议（附理由）**：
- 不加 mihomo `fallback`/`fallback-filter`：三个 DoH 上游只能经节点访问（节点全挂则解析全断，
  是真实单点故障），但 fallback 会用国内解析器兜底 → 可能把「Google 不得从中国 IP 出口」重新引入。
- 不动硬件 offload（只覆盖境内直连，代理流 0 例被 offload）、不装 conntrack-tools、不装 zram、
  不改 IRQ 亲和性（GICv3 Level 触发，改写有断网风险）、不改 SQM（无 bufferbloat 可治）。
- `vm.overcommit_memory=1` **不建议**：默认 0 时分配失败是优雅报错，改成 1 会让 OOM killer
  随机杀进程，对路由器更危险。

### 2026-10-20 02:10：IPv6 fake-IP 旁路（会让站点间歇性超时的隐藏坑）

ShellCrash 的 shellcrash 链里有这条：
```
ip6 daddr { ::/127, ::ffff:0.0.0.0/96, 64:ff9b::/96, 100::/64, 2001::/32, 2001:20::/28,
            2001:db8::/32, 2002::/16, <REDACTED-ipv6-pd>/64, fd00::/8, fe80::/10, ff00::/8 } return
```
它排在 `meta l4proto tcp redirect to :7892` **之前**，而 mihomo 的 fake-IPv6 段
`fc00::/16` 正好落在 `fd00::/8` 内 → **IPv6 优先的客户端连假 IPv6 时被放行直连**。
路由器没有 `fc00::/16` 路由 → 包进 WAN 黑洞 → 客户端 8~20s 均匀超时（curl 的 Happy Eyeballs
不会回退，因为 SYN 被静默丢弃），表现为「同一站点时通时不通、curl 有时 200 有时 000」。
**IPv4 假 IP 段 198.18.0.0/15 不在该 return 列表里，所以 IPv4 路径正常** —— 这也是它难查的原因。

修法：在**独立表**（`/etc/googleroute.nft`，priority dstnat-4，早于 shellcrash 的 dstnat-100）加
```nft
ip6 saddr { <REDACTED-ipv6-pd>/64, fd00::/8, fe80::/10 } ip6 daddr fc00::/16 \
    tcp dport { 22, 80, 443, 8080, 8443 } counter redirect to :7892
```
验证：修复前强制 fake-IPv6 目标 15s 超时；修复后 200/0.83s，计数器 `packets 1`；
连续 8 次 YouTube 全 200。`ai-api-check.sh` 第 13 节已纳入自检。

**排查这类"时通时不通"的顺序**：先看 mihomo `/connections` 里**有没有**这条连接——
没有 = 包根本没进 mihomo（查 nft 的 return 规则），有 = 规则匹配或出口问题。
再对比 `curl -4` / `curl -6` / 默认路径，通常一眼就能定位到族。

### 2026-10-20 02:35 终局：机场节点的地理标签不可信，Google 把出口判成 CN

**这是「Gemini 不支持此国家」的真正终局原因**，前面所有路由修复都只是必要条件。

实测 28 个节点（用 **Google 自己的判定**，不是第三方 GeoIP）：
- `support.google.com` 页里有 `var cc='CN'`；`www.google.com` 302 到
  `www.google.com.hk/url?...&hl=zh-CN&pref=hkredirect`；Play 自动币种给 USD 而非 JPY。
- 第三方 GeoIP（ipinfo/ip-api/Cloudflare）**全说"东京/新加坡"**，只有 Google 自己说 CN ——
  所以只看出口 IP 永远看不出问题。
- **被判 CN 的**：日本×3(<REDACTED-EXIT-IP>)、新加坡×3(<REDACTED-EXIT-IP>)、香港×3(<REDACTED-EXIT-IP>)、
  香港WAP(<REDACTED-EXIT-IP>)、德国×2(<REDACTED-EXIT-IP>)、加拿大×3(<REDACTED-EXIT-IP>)、英国×3(<REDACTED-EXIT-IP>)。
- **干净且稳定的只有 🇮🇳 印度-优化 = <REDACTED-EXIT-IP>**（5/5 稳定、3/3 判定 IN）。
  台湾/美国那批是轮换 IP 池（<REDACTED-EXIT-IP>/.105），Google 的判定在 CN/TW 间跳变，不可靠。
- **机场的节点名与真实地理完全无关**：「日本-优化」的出口被 Google 判为中国。

**Gemini 三份官方清单都含印度和台湾**，只排除中国大陆（Web 版是 "Mainland China (Workspace only)"）
与俄罗斯；API 清单额外排除港澳。

**落地**：`🤖 AI网页` 由 `url-test` 改成 **`select`**（url-test 按延迟必然漂到被判 CN 的节点），
出口钉到 `🇮🇳 印度-优化`；E 段补 `DOMAIN-SUFFIX,google.com` 与 `googleapis.com` →
所有 Google 家族走同一出口；`guardian.sh` 的 **CLEAN_EXIT_GUARD** 每 5 分钟探测
`support.google.com` 的 `var cc=`，判为 CN 就把 AI 出口切回印度。
验收：`var cc=IN`、`www.google.com` 不再跳 .com.hk、四类 Google 域链路统一
`[🇮🇳 印度-优化, 🤖 AI网页, 🤖 人工智能]`、浏览器渲染正常。

**关键手法（务必记住）**：
1. 判断 Google 侧地理归属必须用 **GET**（`curl -o /dev/null -w '%{redirect_url}'`），
   **`-I`(HEAD) 测不出 302** —— 我前面被这个骗过好一阵。
2. 精确判定：抓 `https://support.google.com/gemini/answer/13575153` 里的 `var cc='XX'`。
3. 切节点后必须校验「组的 now 是否真的变了」+ **连测两次出口 IP**，否则测的是上一个节点。
4. mihomo API 的 **URL 要完整 percent-encoding**（含 emoji），但 **PUT 的 JSON body 用原始名**，
   两者不一致会返回 `Resource not found` / `proxy not exist`。

### 2026-10-20 09:00-09:30：差点归零的「静默回退」+ 控制器 secret

**事故链**：项目旧版 `reorder-groups.sh` 会把 `mixed-port` 改写成 `127.0.0.1:7890`，
而 **mihomo v1.19 的 mixed-port 只接受纯数字** → 生成阶段 `CrashCore -t` 校验失败 →
**ShellCrash 静默改用基础配置**（日志只有一行「自定义配置文件校验失败！将使用基础配置文件启动！」）
→ 自定义代理组（🤖 AI网页）与 E 段规则**全部消失** → 🤖 人工智能 回落模板默认的 🇺🇲美国节点
→ Google 侧判定又变 CN → **整晚的 Gemini 修复被一次订阅更新清零**（09:17-09:19 连续三次生成失败）。

**修法与防复发**：
- `reorder-groups.sh` 里加 `MIXED_PORT_NORMALIZE`：把 mixed-port 归一成纯数字
  （端口号用 `grep -oE "[0-9]+$"` 提取，**别用 `sed "s|.*:([0-9]+)|..."`** —— busybox 上
  实测提取失败，会生成 `mixed-port: 127.0.0.1:mixed-port: 7890` 这种垃圾）。
- `ai-api-check.sh` 新增**第 14 节**：检测「静默回退」（mixed-port 是否合法、🤖 AI网页 组是否存在、
  E 段规则数、no-resolve、skip-domain）。
- `guardian.sh` 新增 **FALLBACK_SELFHEAL**：运行配置缺 🤖 AI网页 组时按 **30 分钟限频**重跑 hotupdate。

**另一个坑**：ShellCrash 在 04:30 的每周更新里给 mihomo 控制器加了 `secret`
（`/etc/ShellCrash/configs/ShellCrash.cfg` 的 `secret=`）→ **所有无 Authorization 头的 API 调用
返回 `{"message":"Unauthorized"}` → 守护/自检的组管理静默失效**（守护日志当时还在报"出口国家 IN"，
因为那个探针走代理口、不需要鉴权 —— 很有欺骗性）。
修法：API 调用统一加 `-H "Authorization: Bearer $(sed -n 's/^secret=//p' /etc/ShellCrash/configs/ShellCrash.cfg)"`。
**教训**：守护进程的关键动作失败时必须**显式报错**，不能被"另一个探针正常"掩盖。

**排查口诀**：看到「自定义配置校验失败 → 使用基础配置」这行日志，先查
`/tmp/ShellCrash/error.yaml` 的**第 1 行**（报错总在行 1，因为 base 配置从 mixed-port 开始），
用 `CrashCore.raw -t -f /tmp/ShellCrash/error.yaml` 复现。

### 2026-10-20 10:00-10:50：全服务复盘（10 个子代理）与「干净出口」体系

**核心方法论：同一个出口 IP，各家服务方判定完全不同，第三方 GeoIP 一律不可信。**
实测出口 <REDACTED-EXIT-IP>：Google 判 **CN**（`support.google.com` 页 `var cc='CN'`、
`www.google.com` 跳 `google.com.hk?hl=zh-CN&pref=hkredirect`）；而 HBO Max 说 JP、
Steam 说 JP、PrimeVideo 说 JP、Netflix 说 SG、OpenAI 放行、GitHub 只看 IP 配额。
→ **「CN」是 Google 一家的 GeoIP 数据问题，不是共性问题。**

**逐服务判定口径（以后直接用）**
- Google：抓 `https://support.google.com/gemini/answer/13575153` 的 `var cc='XX'`；
  或 GET `https://www.google.com/` 看是否跳 `google.com.hk`（**必须用 GET，HEAD 测不出 302**）。
- OpenAI/Anthropic：`api.openai.com/v1/models` 不带 key → **401=放行**、
  **403 `unsupported_country_region_territory`=真地区封锁**、`cf-mitigated: challenge`=仅机器人挑战。
- 流媒体：`set-cookie: countryCode=XX`（HBO Max / Steam）/ body `currentTerritory`（PrimeVideo）。
- 开发者平台：无地区判定，只有 IP 信誉（GitHub `x-ratelimit-remaining`）。

**节点名与真实地理完全不可信**：🇯🇵 日本-优化 的出口被 Google 判成 CN；🇺🇲 美国LA-优化 实为
墨西哥 IP（<REDACTED-EXIT-IP>, Oracle Querétaro）；台湾/美国是**轮换 IP 池**（<REDACTED-EXIT-IP>/.105），
判定在 CN/TW 间跳变。只有 **🇮🇳 印度-优化 = <REDACTED-EXIT-IP>** 稳定且被 Google 判 IN。

**「干净出口」体系（2026-10-20 落地）**
- 新组 `🤖 干净出口`（select，**只含印度**）挂进 `🤖 人工智能`；`🤖 AI网页` 的 filter 也收窄到印度
  → 两个组都是**单成员 select，出口确定不会漂**。
- **所有 Google 家族域名规则指向 `🤖 干净出口`**（60+ 条：gstatic/googleusercontent/googleapis/
  google.com/clients*/accounts/oauth2/tools/mtalk/generativelanguage/gemini*/gvt*/g.co/goo.gl/gcr.io/
  ggpht/c.gle/appspot/blogger/android/firebaseio/1e100/blogspot/gmail + GFE 两段
  74.125.0.0/16、173.194.0.0/16 + YouTube 全族 + api.github.com）→ **一次 Google 会话只有一个出口 IP**。
- 规则改**生成器** `ai-rules-update.sh`（rules.yaml 每周日 04:30 被整文件重写，直接改 yaml 会被清空）。
- `🎥 NETFLIX`/`🎥 DISNEY` **保持新加坡**（印度区不提供该服务，挪过去会制造新故障）。
- `🐟 漏网之鱼`（唯一 Match 兜底）保持通用池。
- 生成器改造的坑：**POSIX awk 没有 `\1` 反向引用**；跨多层 heredoc 传 `\\+`/`\\1` 会被吃掉 →
  改用 `index()` 判前缀、或在生成后用一条简单 sed 处理，别在 awk 里做复杂替换。

**⚠️ 批量审计会搞垮这台路由器（两次事故）**
1. 09:55：10 个子代理同时密集探测 → 负载 2.6 → **mtk-wdt 看门狗复位**（31s 超时）。
   恢复零人工干预（配置/nft/分组/cron 全自动回来）→ 反而验证了持久化工作 ✓。
2. 10:43：**OOM 杀掉 mihomo**（`Killed process CrashCore anon-rss:77240kB`）→ 代理整体下线；
   死锁链路：hotupdate 关服务 → 进程被 OOM 杀 → 重启要拉订阅、而拉订阅又需要代理。
   修法：守护进程加「最近 30 分钟存活记录」状态文件（不依赖 pid 文件）能自动拉起；
   清掉子代理在 tmpfs 留下的 48MB（/tmp 51MB→3MB，可用内存 51→77MB）。
   **教训：批量审计必须限速、串行化；子代理的密集探测本身就是 OOM/看门狗元凶。**

**其它结论**
- Play 商店币种（USD）是**账号侧**属性，Google 搜索侧 IN / 商店侧 USD 的不一致**换 IP 修不了**。
- `accounts.google.com` 的 `hl=en-US` 非 IP 派生。
- 浏览器/客户端层无残留阻断项：8 个扩展全查 manifest，AdGuard 的 77019 条 DNR 对 Google 域命中 0、
  无 UA 改写、无代理类扩展；只需用户自己清 Chrome 的 `variations_country="cn"` 种子与磁盘里
  旧的 `google.com.hk` 缓存页（`ipconfig /displaydns` 实测本机缓存为空，无需 flushdns）。
- 复盘报告在 `F:\Project\AX3000TOpenwrt\evidence\agent-*.md`（11 份）。

### 2026-10-20 11:45：通用池节点劣化 → 全站超时（第三种故障模式）

**现象**：PC 侧大部分站点 15s 超时（Gemini/Google/Play/YouTube/GitHub），Cloudflare 与百度正常，
而**路由器自身的显式代理探测全部正常**（Google cc=IN）→ 极易误判为「规则没生效」。

**定位**：mihomo `/connections` 显示连接**确实进了 mihomo**，链路 `[🇩🇪德国-优化, 德国节点, 节点选择]`，
出口 `<REDACTED-EXIT-IP>`；conntrack 有 10 条 SYN_SENT（出站无应答）。
逐节点实测 GitHub 耗时：日本-优化 **0.82s**、日本-优化2 0.96s、香港 1.15s、台湾 4.36s、
新加坡 4.79s、**德国 5.01s（随后恶化到 15s）**、美国LA 6.44s。
→ **节点劣化**，不是规则问题；根因是 `🚀 节点选择` 被钉在 `🇩🇪 德国节点`，url-test 自动择优被绕过。

**修复**：`🚀 节点选择` → `♻️ 自动选择`（自动择优 → 日本 0.82s）；`guardian.sh` 新增 **EXIT_HEALTH**：
按**真实出口耗时**判定（两次 `api.ipify.org` 取均值），>3s 即复位到自动选择。
（原先按「节点名在坏清单里」判定，只能挡**已知**坏节点，挡不住**劣化**节点。）

**教训：代理的"通"要按出口耗时判定，不能只看规则命中。** 三种故障模式各有判据：
- 规则错 → 看 mihomo `/rules` 首匹配
- 旁路漏 → 看 nft 计数器
- **节点劣化 → 看真实出口耗时**

**另一条**：Windows 批处理若含中文必须是 **ASCII**（UTF-8 无 BOM 的 .bat 会被 cmd 按 GBK 解析，
双击秒退）；Chrome 的 `variations_country`/`variations_permanent_consistency_country` 要在
**Chrome 完全关闭**时改（退出时会被重写）。

### 2026-10-20 11:55：用户看到的「Gemini 只有输入框、没有推荐区」= 后端 API 挂住（节点劣化）

**用户反馈**：Chrome 里 Gemini（登录态，账号国家=美国 ✓）只显示输入框，
**缺「看看你可以用 Gemini 4 做些什么」推荐区**。

**定位**：
- 账号国家是美国 ✓ → 排除账号被判中国大陆。
- PC 侧 `geminiweb-pa.clients6.google.com` / `generativelanguage.googleapis.com` /
  `alkalicore-pa.clients6.google.com` **三个后端 API 端点全部 000/12s 超时**，
  而 `gemini.google.com` 页面 200 ✓ → **壳加载了、后端 API 挂住** = 截图症状 ✓。
- mihomo `/connections` 显示连接**确实进了 mihomo**、链路 `[🇮🇳印度-优化, 🤖干净出口]`，
  但 `destinationIP` 为空 → 卡在出口侧无响应。
- 同一时刻路由器**显式代理**下这些端点 0.9–1.2s 全通 → 是节点侧劣化，不是规则问题。
- **根因：节点间歇性劣化**（本次是干净出口的印度节点；前一小时是通用池的德国节点 5s→15s）。

**修复**：守护新增 **CLEAN_EXIT_HEALTH**（用 Gemini 自己的 API 端点测耗时，>3s 判劣化 →
切备用出口 🇺🇲美国LA-优化-GPT，<REDACTED-EXIT-IP> 判 TW）；通用池已有 **EXIT_HEALTH**。
**两条出口路径都要有健康守卫** ✓。

**教训（核心）**：**代理的"通"必须按真实出口耗时判定，且要覆盖两条出口路径**；
只看规则命中会误判成"规则没生效"。判别口诀：
- 规则错 → 看 mihomo `/rules` 首匹配
- 旁路漏 → 看 nft 计数器
- **节点劣化 → 看真实出口耗时 + mihomo 连接里 destinationIP 是否为空**






### 2026-10-20 15:20-15:55：Gemini「只有输入框」的真正根因 = LNA 拦掉 gstatic 的 islands bundle

**症状**：Chrome（登录态）打开 `gemini.google.com` **只剩输入框**，页头/侧栏/「看看你可以用
Gemini 4 做些什么」推荐区全没有；**无痕模式同样坏**；ZCode 内置浏览器（Electron）**完全正常**。

**抓到的决定性报错**（Chrome 控制台）：
```
Access to script at 'https://www.gstatic.com/bg3/boq-bard-web/islands/assets/islands-B2LPY9h5.js'
from origin 'https://gemini.google.com' has been blocked by CORS policy:
Permission was denied for this request to access the `local` address space.
[error] network: Failed to load resource: net::ERR_FAILED
```
**根因**：Chrome 138+/155 的 Local Network Access 把 mihomo 的 **fake-IP 198.18/15** 判为
「本地地址」，于是**从公网页面加载的子资源**被拒。Gemini 的页头/侧栏/推荐区由
`www.gstatic.com/.../boq-bard-web/islands/*.js` 懒加载渲染 → 那个 bundle 被拒 → 只剩主
bundle 画出来的输入框。`gemini.google.com` 本身在 `+.google.com`（早就在 fake_ip_filter 里）→
真实 IP → 页面壳正常。

**修法**：`/etc/ShellCrash/configs/fake_ip_filter` 再加 **`+.gstatic.com` 与 `+.googleapis.com`**
（现共 21 条）→ 这些静态资源域名给客户端真实 IP，Chrome 的 LNA 就不拦了。

**为什么内置浏览器没事**：Electron 不启用 LNA；**headless Chrome 启用** → headless 截图同样全黑。
**Chrome 已带 `--disable-quic`**（本机实测），所以这次与 QUIC 无关。

**诊断手法（务必记住）**
- 用 **CDP** 抓控制台才是正道：起一个带 `--remote-debugging-port=<port>` + 临时
  `--user-data-dir` 的 Chrome，Node 用内置 `WebSocket` 连 `webSocketDebuggerUrl`，
  启用 `Log/Runtime/Network` → 读 `Log.entryAdded`、`Runtime.exceptionThrown`、
  `Network.loadingFailed`。脚本在 `F:\Project\AX3000TOpenwrt\evidence\cdp.js`（`CDP_PORT`/`CDP_URL` 可覆盖）。
- **别用 `--dump-dom` + grep 判断页面是否渲染**：DOM 里含 JS bundle 源码，
  grep 到的「认识 Gemini」可能只是脚本里的字符串 → **必须看截图或 `document.body.innerText`**。
- 排除法顺序（本轮走过的弯路，别重复）：内置浏览器正常 ⇒ 链路 OK；headless 用**真实 profile 副本**
  （含 cookies/SW/cache）仍坏 ⇒ 不是 profile/缓存/扩展；`--dump-dom` 判读有误 ⇒ 回到 CDP。
- 用户 Chrome 若在**手机热点**上，任何经路由器的验证都不成立（出口变成国内 IP）。

相关：[[router-offline-recovery]]、[[redir-mode-udp-quic-leak]]、[[airport-cn-registered-ips]]


相关：[[ax3000t-router-environment]]、[[shellcrash-ai-routing-fix]]、[[ax3000t-audit-artifacts]]
