# 排错手册

> **一句话**：按**现象**检索，每节固定三块 —— **现象 → 排查步骤 → 原因 / 解法**；
> 每一节末尾都给一句「**怎么确认是客户端问题还是路由器问题**」。

机制细节见 [LNA-FAKE-IP.md](LNA-FAKE-IP.md)；测量方法本身的坑见 [PITFALLS.md](PITFALLS.md)。

---

## 0. 先用这一条分诊

**通用判据**（三步，顺序不能换）：

```sh
# ① 客户端视角：经路由器代理口测一次（一定要走代理口，不要裸连）
curl -s -m 15 -x http://10.0.0.1:7890 -o /dev/null \
     -w 'code=%{http_code} redir=%{redirect_url}\n' https://gemini.google.com/

# ② 浏览器视角：抓一条控制台错误（前提：9223 上有开着调试端口的 Chrome）
CDP_PORT=9223 node tools/cdp.js
```

| 观察 | 结论 | 去哪 |
|---|---|---|
| ① 通、② 有明确的 LNA / CORS / 拦截错误 | **客户端侧**（浏览器拦的） | 按现象找本篇对应节 |
| ① 不通 | 先看是不是地区 / 出口问题 | 「Google 账号被判定为不支持的国家」节 |
| ① 通、② 没有任何错误但页面仍不对 | 页面渲染被懒加载的子资源影响，但子资源没报错 | 用 DOM 快照确认 UI 是否完整 |
| ① 在客户端不通、路由器上经 `127.0.0.1:7890` 通 | **客户端侧**（本机 DNS / hosts / 代理 / 浏览器） | 本节各节的「客户端侧自检」 |
| 两边都不通 | **路由器侧**（分流 / 节点 / 防火墙） | `AX3000TOpenwrt` / `ShellcrashRules` |

> **口径提醒**：路由器上 curl 必须经 `127.0.0.1:7890`；客户端上必须经 `10.0.0.1:7890`。
> 两边各用自己的口，别混（见 [PITFALLS.md](PITFALLS.md) §5）。

---

## 1. Gemini 页面只剩输入框

### 现象

打开 `https://gemini.google.com/app`，**只剩一个输入框**：页头、侧栏、推荐区全无。
无痕模式同样坏；同一个网络下别的浏览器（Electron 内置浏览器）正常。

### 排查步骤

```sh
# ① 抓控制台 —— 看有没有 LNA / CORS 拦截
CDP_PORT=9223 node tools/cdp.js
```

关注输出里这三类：

```
[ERROR] Security: Permission was denied for this request to access the `local` address space.
FAIL type=Script err=net::ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS
403 ... https://www.gstatic.com/bg3/boq-bard-web/islands/assets/islands-*.js
```

```sh
# ② 看 gstatic 解析到的是不是 fake-IP（198.18.0.0/15 / fc00::/16）
nslookup www.gstatic.com 10.0.0.1

# ③ 对照：页面主域名应当是真实 IP
nslookup gemini.google.com 10.0.0.1
```

判读：

| ② 的结果 | 结论 |
|---|---|
| `www.gstatic.com` → `198.18.x.x` 或 `fc00::…` | **命中本节**（子资源在 fake-IP 里） |
| `www.gstatic.com` → 真实公网 IP，但仍只剩输入框 | 不是 LNA，往下看「UI 完整性」 |

```sh
# ④ UI 完整性（不要只看截图）
CDP_PORT=9223 node tools/cdp.js   # 看 "=== 渲染状态 ===" 里 body.innerText 的长度与内容
```

### 原因 / 解法

**原因**：Gemini 的页头 / 侧栏 / 推荐区由 `www.gstatic.com` 上的 islands bundle **懒加载**渲染；
该域名在路由器的 `fake_ip_filter` 里缺 `+.gstatic.com` → 解析到 fake-IP →
Chrome 155 的 LNA 判成 `public → local` → 被 CORS 拒 → 只剩主 bundle 画出的输入框。

**解法**（路由器侧，`ShellcrashRules` 仓）：

```
# /etc/ShellCrash/configs/fake_ip_filter
+.gstatic.com
+.googleapis.com
```

然后热更新：`/etc/ShellCrash/task/task.sh hotupdate`，复测。

**客户端侧自检**（如果 ② 显示 gstatic 已经是真实 IP 仍不行）：清 Chrome 的地区种子与磁盘缓存
（见下一节），并用无痕窗口排除扩展干扰。

### 怎么确认是客户端问题还是路由器问题

**看 `www.gstatic.com` 的解析结果**：

- 解析到 `198.18.0.0/15` / `fc00::/16` → **路由器侧**（fake-IP 过滤缺条目）。
- 解析到真实 IP 仍复现 → **客户端侧**（Chrome 缓存 / 扩展 / 账号态），先清种子与缓存再测。

⚠️ **「页面能打开」不是修好的判据** —— 主 bundle 照样画出输入框。
必须看 UI 完整加载（控制台无 LNA/CORS 错误 + DOM 里有侧栏/推荐区），
理由见 [LNA-FAKE-IP.md](LNA-FAKE-IP.md) §5。

---

## 2. Chrome Web Store 扩展装不上

### 现象

在 Chrome 应用商店点「添加至 Chrome」，页面报 **`下载时出错: Image decode failed`**，
安装确认框不弹。CRX 实际已经下载成功（文件头 `Cr24`，9.1 MB / 77.9 MB 两个包）。

### 排查步骤

```sh
# ① 抓浏览器进程的网络日志（Chrome 必须完全退出后再起）
"C:/Program Files/Google/Chrome/Application/chrome.exe" \
  --log-net-log=chrome-netlog.json --net-log-capture-mode=Everything \
  --user-data-dir="C:/Users/<你>/AppData/Local/Temp/netlog-prof" \
  "https://chromewebstore.google.com/detail/<扩展 id>"

# 在 netlog 里搜这两个关键字
grep -i "BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS" chrome-netlog.json
grep -i "insecure-local-network" chrome-netlog.json
```

```sh
# ② 看图标域名解析到哪
nslookup lh3.googleusercontent.com 10.0.0.1
```

### 原因 / 解法

**原因**：安装弹窗拉扩展图标属于**浏览器进程请求**（没有 initiator，client 地址空间被当作 public），
而 `lh3.googleusercontent.com` 解析到 mihomo 的 fake-IP（local）→
LNA 判 `public → local` → 拒绝（net_error `-385`）→ Chromium 侧 `icon_error` →
页面显示 `Image decode failed`。

**解法**（路由器侧）：把图标域名移出 fake-IP：

```
# /etc/ShellCrash/configs/fake_ip_filter
+.googleusercontent.com
```

（连同 `+.gstatic.com`、`+.googleapis.com`、`+.gvt1.com`、`dl.google.com`、
`accounts.google.com`、Play / update / safebrowsing / fcm 相关的 Google 域，共 21 条。）

**反证已做**：用 `--host-resolver-rules="MAP lh3.googleusercontent.com 28.0.0.5"` 把它指到公网地址后，
同样的点击操作 `result = null`，安装确认框正常弹出 —— 证明**只要拿到公网 IP 就放行**。

### 怎么确认是客户端问题还是路由器问题

**看 `lh3.googleusercontent.com` 的解析结果**：

- fake-IP → **路由器侧**；
- 真实 IP 仍报错 → **客户端侧**：查扩展商店页面的缓存、查是否有扩展/策略拦截
  （实测本机 8 个扩展对 `gemini` / `accounts` / `dl` / `safebrowsing` / `play` / `gstatic`
  的 DNR 命中数均为 0，可排除）。

---

## 3. Play 更新一直转圈

### 现象

手机 / 平板上的 Google Play 商店：**下载页能进，下载不动，一直转圈**；
或应用更新永远停在「等待中」。

### 排查步骤

```sh
# ① 看是不是 QUIC 黑洞：在路由器上查 conntrack
grep "udp.*dport=443" /proc/net/nf_conntrack | head
#   出现 udp src=10.0.0.x dst=198.18.0.x dport=443 ... [UNREPLIED]  → 命中
```

```sh
# ② 客户端侧实测：Play 的 CDN 主机
curl -s -m 15 -x http://10.0.0.1:7890 -o /dev/null \
     -w 'code=%{http_code} size=%{size_download} time=%{time_total}\n' \
     'https://dl.google.com/'

# ③ Play 的 API 端点
curl -s -m 15 -x http://10.0.0.1:7890 -o /dev/null -w '%{http_code}\n' \
     'https://play.googleapis.com/'
```

### 原因 / 解法

**原因**（两个独立问题叠在一起）：

1. **QUIC 黑洞**：ShellCrash 处于 Redir 模式，只代理 TCP；
   UDP 443 不代理，而目标又是 fake-IP → 包发出去没人应答（`[UNREPLIED]`）。
   `quic_rj=ON` 只是 `udp dport {443,8443} return`，等于放行到一个不可路由地址，
   客户端拿不到快速失败信号，只能等超时回落 TCP。
2. **出口分裂**：`*.googleapis.com` 被整段路由到 AI 组，Play 的 checkin / FCM 走另一组，
   下载 API 又走第三组 → 出口不一致，失败时更难看。

**解法**（路由器侧，`ShellcrashRules` 仓）：

- 在 prerouting（早于 ShellCrash 的 `dstnat`）加一张快速拒绝表，让客户端立刻收到 ICMP、
  马上回落 TCP：

  ```
  table inet quicguard {
    chain pre {
      type filter hook prerouting priority -150; policy accept;
      ip  daddr 198.18.0.0/15 udp dport { 443, 8443 } reject with icmp port-unreachable
      ip6 daddr fc00::/16     udp dport { 443, 8443 } reject with icmpv6 port-unreachable
    }
  }
  ```

- Play 的 CDN 改为**按目标 IP 分流**（`IP-CIDR,203.208.32.0/19` +
  `IP-CIDR6,2401:3800::/32` → 直连）。**不要**按整段域名直连 ——
  那会把海外 CDN 也逼上直连。
- `play.googleapis.com` / `android.clients.google.com` / `update.googleapis.com` /
  `safebrowsing.googleapis.com` / `fcm.googleapis.com` 统一走节点选择组。
- 全部文件进 `sysupgrade` 保留清单，避免升级后丢。

**处置顺序**：手机上「强制停止 Play 商店 → 重新打开 → 下载列表点重试」（或开关一次飞行模式）。
**先别重启路由器** —— 修复已经在运行态生效，重启解决不了手机端队列卡死。

### 怎么确认是客户端问题还是路由器问题

**看 conntrack 里有没有 `[UNREPLIED]` 的 UDP 443**：

- 有 → **路由器侧**（QUIC 未代理 + fake-IP 黑洞）；
- 没有，但 ② ③ 也超时 → 仍是路由器侧，但要看分流命中了哪个组；
- ①②③ 全通、只有手机上转圈 → **客户端侧**（Play 商店自身队列 / 设备侧网络栈），
  处置是强制停止重开，不是改路由器。

---

## 4. Google 账号被判定为不支持的国家

### 现象

- `gemini.google.com` 提示不支持所在国家 / 地区；
- `www.google.com` 被 302 到 `https://www.google.com.hk/url?...&hl=zh-CN&pref=hkredirect`；
- `www.google.com/ncr` 最终域名是 `www.google.com.hk`；
- 账号侧还有次要条件：**账号本身没有设置国家 / 地区**。

### 排查步骤

```sh
# ① 用服务方自己的国家标记判定（不要用第三方 GeoIP）
curl -s -m 20 -x http://10.0.0.1:7890 \
  'https://support.google.com/gemini/answer/13575153' \
  | grep -aoE "var cc='[A-Z]{2}'" | head -1

# ② 看 Google 的重定向（必须 GET，不能 HEAD）
curl -s -m 15 -x http://10.0.0.1:7890 -o /dev/null \
     -w 'code=%{http_code} redir=%{redirect_url}\n' https://www.google.com/

# ③ 看当前出口 IP 与它实际走的节点（只读）
curl -s -m 10 -x http://10.0.0.1:7890 https://api.ipify.org
```

```sh
# ④ 客户端侧自检：Chrome 的地区种子与旧地区页面缓存
node -e "const j=require('C:/Users/<你>/AppData/Local/Google/Chrome/User Data/Local State'); \
  console.log(j.variations_country, j.variations_permanent_consistency_country)"
```

### 原因 / 解法

**原因有两层，要分开处理**：

1. **网络层（主因）**：**服务方看的是出口 IP 的注册地**。
   实测 28 个出口里 **27 个被 Google 判 `cc=CN`**（含美国 / 德国 / 英国机房段），
   只有 `<REDACTED-EXIT-IP>`（注册地印度）判 `IN`。
   第三方 GeoIP 对每一个节点都与服务方分歧（JP/SG/HK/CA/UK/TW ↔ CN）—— **不可信**。
2. **客户端层（次要）**：Chrome 自己缓存的 `variations_country` 种子仍是 `cn`
   （实测 `variations_country = "cn"`，`variations_permanent_consistency_country` 绑定当前 Chrome 版本）；
   磁盘缓存里还留着旧的 `www.google.com.hk` 页面。

**解法**：

- 网络层：把 Google 系流量统一指向**经 cc 实测判为非 CN 的出口**，
  并把守护进程的复原判据从「出口名含香港」换成 **cc 探针**（正本在 `ShellcrashRules` 仓）。
  实测里印度节点是唯一可用出口，且自建了同 IP 的另两个入口做冗余。
- 客户端层：完全退出 Chrome 后清地区种子（`node tools/clear-chrome-region.js`），
  再清 Chrome 的「缓存的图片和文件」（时间范围选「不限时间」），
  保持「安全 DNS = 关闭」（DoH 与路由器的 fake-IP 会冲突）；
  账号侧到 myaccount 把国家 / 地区补上。

### 怎么确认是客户端问题还是路由器问题

**看 ① 的 `var cc`**：

- `cc='CN'` → **网络层**（出口 IP 的注册地被判中国），客户端怎么清都没用；
- `cc='IN'` 但浏览器仍报错 → **客户端侧**（种子 / 缓存 / 账号地区 / 扩展）。

**一个必须记住的坑**：出口 IP 的国家标签**不可信** ——
第三方库说日本，Google 判中国。判定只能用服务方自己的标记。

---

## 5. YouTube 等流媒体打不开

### 现象

- YouTube 主站能开，但 **YouTube Music 报「not available in your area」**；
- Netflix / Disney+ / Prime Video / HBO Max 加载不全或片库不对；
- 视频播不了 / 转圈。

### 排查步骤

```sh
# ① YouTube 主站自己的地区标记（页面里的 gl）
curl -s -m 15 -x http://10.0.0.1:7890 -A 'Mozilla/5.0' https://www.youtube.com/ \
  | grep -aoE '"(gl|countryCode)":"[A-Z]{2}"' | head -3

# ② YouTube Music 的服务端闸门
curl -s -m 15 -x http://10.0.0.1:7890 -A 'Mozilla/5.0' https://music.youtube.com/ \
  | grep -aioE '<title>[^<]*</title>' | head -1

# ③ 其它服务：只看服务方自己发的标记
curl -s -m 15 -x http://10.0.0.1:7890 -D- -o /dev/null https://www.netflix.com/ \
  | grep -aiE '^location:'
```

### 原因 / 解法

**原因**：**不是所有流媒体都吃「Google 判 CN」这一套** —— 各服务方的 IP 库不同：

| 服务 | 敏感吗 | 实测 |
|---|---|---|
| YouTube 主站 | 否 | 恒 `"gl":"US"` / `"gl":"IN"`，无 CN/HK 跳转 —— 主站判定与 Google 的 CN 判定**解耦** |
| YouTube Music | **是** | 服务端地区闸门，CN 判定下返回 `not available in your area` |
| HBO Max / Steam / PrimeVideo | 否 | 同一出口上分别自判 `countryCode=JP` / `steamCountry=JP` / `"currentTerritory":"JP"` |
| Netflix / Disney+ | 否（但有区域片库） | 自判 `SG`，`location: https://www.netflix.com/sg/`、`"location":"SG"` |

**解法**：

- YouTube Music 必须与 Google 系**同出口**（否则报地区不可用）；
- Netflix / Disney+ **不要**搬到「Google 判为 CN 的干净节点」——
  实测这两家在印度不提供服务，搬过去等于制造新故障；
- 想要片库稳定，给它们各自的专属组，别让出口跟着 URLTest 漂。

### 怎么确认是客户端问题还是路由器问题

**看服务方自己的地区标记**：

- 标记随出口变（同一服务在不同出口上判定不同）→ **路由器侧**（出口 / 分流）；
- 标记在所有出口上都一样、且与服务方支持列表一致 → **客户端侧**
  （扩展、DRM、播放器、账号地区）。

---

## 6. 社交媒体站点加载不全

### 现象

Instagram / Facebook / X / Reddit / Discord / Telegram / LinkedIn / Mastodon
有的能开、有的加载一半或直接报错（典型是 Reddit 返回 403）。

### 排查步骤

```sh
# ① Meta 自己的国家标记
curl -s -m 20 -x http://10.0.0.1:7890 https://www.instagram.com/ \
  | grep -aoE '"country_code":"[A-Z]{2}"' | head -1

# ② Reddit 的封锁（403 是 IP 级封锁，不是限流）
curl -s -m 20 -x http://10.0.0.1:7890 -o /dev/null -w '%{http_code}\n' https://www.reddit.com/

# ③ X / Slack 的标记
curl -s -m 15 -x http://10.0.0.1:7890 https://x.com/ | grep -aoE '"country":"[A-Z]{2}"' | head -1
curl -s -m 15 -x http://10.0.0.1:7890 -D- -o /dev/null https://slack.com/ | grep -aiE '^location:'
```

> 取样纪律：**请求前后各测一次出口 IP**，两次相同才认这个样本（出口会漂，见
> [PITFALLS.md](PITFALLS.md) §8）。

### 原因 / 解法

**原因**：各服务方用自己的 IP 库判定，**敏感集合与 Google 不一样**：

| 服务 | 敏感吗 | 实测 |
|---|---|---|
| Instagram / Facebook | **是** | Meta 判 `country_code":"CN"` —— 与 Google 同判 |
| Reddit | **是** | 该 IP 返回 403 `You've been blocked by network security.`（**IP 级网络封锁，不是限流**；低频 15/15 次全 403） |
| X / Twitter | 否 | 自判 JP/IN/TW/HK…，但出口漂移会让国家标记跟着跳 |
| Slack | 否 | 自判 JP 并自己重定向 `/intl/ja-jp/` |
| Discord / Telegram / LinkedIn / Mastodon | 否 | 无国家标记、全部 200 |

**解法**：把 Meta 系与 Reddit 单独钉到**已实测干净**的出口组；
其余保持现状（它们不敏感）。
⚠️ **`DOMAIN-KEYWORD,facebook` 早于 `DOMAIN-SUFFIX,facebook.com` 匹配** ——
改规则时要两条一起改，否则前一条会先命中。

### 怎么确认是客户端问题还是路由器问题

**看服务方自己的国家标记 / 错误码**：

- 标记随出口变 → **路由器侧**；
- 标记恒定且服务正常、只有你的浏览器加载不全 → **客户端侧**
  （扩展：实测 Read Frog 对所有页面注入翻译侧栏、Dark Reader 改 CSS、
  Adobe Acrobat 在 gemini.google.com 上挂了 content script —— 这些都只改 DOM 不会改请求，
  但会明显干扰页面观感；用无痕窗口排除）。

---

## 附：客户端侧自检清单

任何「是不是客户端问题」的疑问，先把这张表过一遍（实测本机全绿，
即本机没有残留阻断项）：

| 检查项 | 怎么看 | 正常值 |
|---|---|---|
| Secure DNS | `Local State` 的 `dns_over_https.mode` / `Preferences` 的 `dns_over_https` | `off` / `null`（DoH 与 fake-IP 冲突） |
| 浏览器代理 | `Local State.proxy` / `Preferences.proxy` | `null` |
| 系统代理 | `HKCU\...\Internet Settings` 的 `ProxyEnable` / `netsh winhttp show proxy` | `0` / 直接访问 |
| 启动参数 | 进程命令行、Chrome 快捷方式 | 无 `--proxy-server` |
| 企业策略 | `HKLM` / `HKCU` 的 `SOFTWARE\Policies\Google\Chrome` | 无有效值（未被锁定） |
| hosts | `C:\Windows\System32\drivers\etc\hosts` | 无 google / gemini 条目 |
| DNS 客户端缓存 | `Get-DnsClientCache` / `ipconfig /displaydns` | 空（不需要 flushdns） |
| 扩展 | 逐个看 manifest：有没有改 UA、改头、代理、`modifyHeaders` | 只改 DOM 的可以留 |
| Chrome 地区种子 | `Local State` 的 `variations_*_country` | 无（清过） |
| 旧地区页面缓存 | Chrome 设置 → 清除「缓存的图片和文件」→ 不限时间 | 清掉 |
