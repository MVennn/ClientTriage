结论：客户端层无残留会直接导致「不支持此国家」的项；唯一需用户动手的是 Chrome 自身缓存的国家判定仍为 cn（Local State 旧值）+ 磁盘缓存里残留的 www.google.com.hk 页面，扩展层与系统层均不构成阻断。

## 证据

### 1. 扩展层（8 个全部核对 manifest）
| 扩展 | ID | manifest 关键项 | 对 Google/Gemini 影响 |
|---|---|---|---|
| 青柠起始页 | aajmeahnoefldipnjgodkobfdcpmapno | CS matches 仅 `https://www.limestart.cn/*` | 无 |
| AdGuard 广告拦截器 | bgnkhhnnamicmpeenaelnjfhikgbkllg | MV3, host_permissions `<all_urls>`, perms: webRequest/cookies/declarativeNetRequest/scripting/userScripts, CS `http://*/*`+`https://*/*` @document_start | 有拦截能力但**未命中 Google**（见下） |
| Adobe Acrobat | efaidnbmnnnibpcajpcglclefindmkaj | CS 显式匹配 `https://gemini.google.com/*`（document_start + document_idle, `sanitize-html-styles.js`）；perms 含 webRequest/cookies/identity, `<all_urls>`；无 DNR | **唯一直接挂在 gemini.google.com 上的扩展**，但仅改 DOM，不改请求 |
| Dark Reader | eimadpbcbfnmbkopoojfekhnkhdbieeh | CS `<all_urls>` @document_start 注入 proxy.js/fallback.js/index.js, all_frames=true | 改 CSS/DOM，不改请求 |
| 篡改猴测试版 | gcalenpjmijncebpfijmoaglllgpjagf | perms 含 userScripts | **无 google/gemini 脚本**（见下） |
| ACG 助手 | kpbnombpnpcffllnianjibmpadjolanh | host_permissions 仅 bilibili 系 | 无（唯一有 modifyHeaders，Origin/Referer/Cookie 全指向 bilibili） |
| 陪读蛙 Read Frog | modkelfkcfjpgbfmnbnllalkiogfofhb | host_permissions `*://*/*`, perms 含 cookies/identity/scripting, CS `*://*/*` @document_start input-injector.js | `siteControl.mode=blacklist` 且黑白名单皆空 → **对所有页面(含 Gemini)注入翻译侧栏**；当前 translate provider = microsoft-translate-default |
| Google Hangouts | nmmhkkegccagdldgiimedpiccmgmieda | MV2, host `https://www.google.com/`, `https://www.googleapis.com/*`, payments | 仅应用内 |

```
# AdGuard DNR ruleset_2 (77019 rules) 命中 Google 主机的规则数
== gemini.google.com -> 0 rule(s)
== accounts.google.com -> 0 rule(s)
== dl.google.com -> 0 rule(s)
== safebrowsing.googleapis.com -> 0 rule(s)
== play.google.com -> 0 rule(s)
== google.gstatic.com -> 0 rule(s)
== www.google.com -> 1 rule(s)   allow | ||www.google.com/ads/preferences/
regexFilter total: 154 | google-mentioning: 0
broad "google*" filters: 0

# 全扩展 DNR modifyHeaders 扫描（唯一命中者是 ACG 助手，且只针对 bilibili）
kpbnombpnpcffllnianjibmpadjolanh add_origin_referer.json -> modifyHeaders requestHeaders Origin/Referer = https://www.bilibili.com
kpbnombpnpcffllnianjibmpadjolanh bind_bilibili_account.json -> modifyHeaders responseHeaders Cookie remove

# Tampermonkey 已装脚本存储扫描（000142.log / 000145.ldb / 000146.ldb）
000142.log | google.com hits: 0 | gemini hits: 0
000145.ldb | google.com hits: 0 | gemini hits: 0
000146.ldb | google.com hits: 2 | gemini hits: 1
  >> ...retrying...gemini gateway, hot right no...Free usage exceeds...   <- Tampermonkey 自身 i18n 通知文案，非脚本
  所有 @match 实测仅 opencode.ai / youtube / ted.com / xiaohongshu / snapchat / spotify / nexusmods / sillytavern
```
结论：无任何扩展改写 User-Agent、无代理类扩展、无针对 google/gemini 的拦截或头改写。

### 2. Chrome 网络层
```
# Local State
dns_over_https = {"mode": "off"}
proxy = null
variations_country = "cn"                      <-- Chrome 自身国家判定仍是 CN
variations_last_fetch_time = 2026-10-19 18:04:41   <-- 修复前的旧值
variations_permanent_consistency_country = ['155.0.8059.82', 'cn']  <-- 绑定当前 Chrome 版本

# 策略（无任何有效值 -> 未被策略锁定）
HKLM\SOFTWARE\Policies\Google\Chrome : 错误: 系统找不到指定的注册表项或值
HKCU\SOFTWARE\Policies\Google\Chrome : 只有空键，无子项/值

# 启动参数 / 系统代理
C:\ProgramData\...\Google Chrome.lnk || ARGS:            <- 无 --proxy-server
进程命令行: "chrome.exe" --version                        <- 无代理参数
netsh winhttp show proxy: 直接访问(没有代理服务器)
HKCU\...\Internet Settings: ProxyEnable : 0   ProxyServer : 127.0.0.1:7890(未启用)

# 磁盘缓存残留
Cache/Cache_Data/f_000cab (362961 B) 内含：
  <a href="https://www.google.com.hk/webhp?hl=zh-CN" ...>
  https://www.google.com.hk/search?q=muse-spark-1.3-contributor
  (已登录账号 <REDACTED-account>)      <-- 修复前的旧 HK 区页面仍在缓存
Code Cache/js/*: lightweight-web.composer.unsupported-image 等 = Gemini 自身 i18n 键，非报错页
全 Default 目录 grep "not available in your country|unsupported country" = 0 命中
Default/Network/ 无独立 host cache 文件(TransportSecurity 是 HSTS)
```

### 3. 系统层
```
Get-Culture / Get-WinSystemLocale : zh-CN  LCID 2052
[RegionInfo]::new('zh-CN').GeoId    : 45   (中国)
Get-WinHomeLocation GeoId           : 244  (美国)   <- 区域已是美国
HKCU\Control Panel\International    : LocaleName=zh-CN, sLanguage=CHS, iCountry=86, 无 Geo 键
Get-TimeZone                        : China Standard Time (UTC+08:00)
Chrome Local State intl.app_locale  : zh-CN ; Preferences intl.accept_languages = "zh-CN,en"
Preferences.account_info             : 只有 email/full_name，无 country（账号地区未设置）
Preferences countryid_at_install     : 21843（安装时快照，已过时）
geolocation 例外                     : 仅 creator.douyin.com / plugin.speedtest.cn
                                       google.com 与 gemini.google.com 未授权定位
```
判断：Gemini 可用性是服务端按出口 IP 判定，系统区域不参与，因此「中国区域设置 + 印度出口」不会让 Gemini 弹地区不支持；但它会让账号地区推断/YouTube/支付仍偏 CN，属独立议题。Google 也拿不到精确位置（未授权定位），仅拿到 IP + zh-CN 语言头 + UTC+8 时区。

### 4. DNS 缓存层
```
Get-DnsClientCache).Count      : 0
ipconfig /displaydns           : 空输出
=> 本机 DNS 客户端缓存完全为空，无任何 Google 解析残留，无需 flushdns

# 实时解析（Windows 侧 -> 路由器 DNS（示例网关地址 10.0.0.1） -> ShellCrash/mihomo DNS）
gemini.google.com  -> 142.251.150.2, 2001:4860:4826:200:: ...   真实 Google IP
www.google.com     -> 142.251.156.119, 2001:4860:4826:7700::   真实 Google IP
clientservices.googleapis.com -> 198.18.0.71, fc00::46          mihomo fake-ip(正常)
accounts.google.com -> 2404:6800:400b:c019::54, 192.178.226.84   非 Google 地址
dl.google.com       -> 2404:6800:400b:c019::88..., 192.178.226.x  非 Google 地址

# 原因（路由器 mihomo 配置，只读）
fake-ip-filter: dl.google.com, safebrowsing.googleapis.com, www.googleapis.com, clients2/4.google.com ...
direct-nameserver: [https://dns.alidns.com/dns-query, https://doh.pub/dns-query]   <-- 国内解析器
# 路由器本机 nslookup（直连解析路径）= 典型污染
www.google.com     -> 69.171.235.22(Meta) + 2001::1(GFW 黑洞)
gemini.google.com  -> 174.37.243.85 + 2a03:2880:f10c:83:face:b00c:0:25de(Meta)
```
即 `2001::67c8:1e8f` 一类污染仍存在于**路由器直连解析路径**，客户端侧无残留；这是网络层（mihomo fake-ip-filter / direct-nameserver）的问题，不是浏览器层。

### 5. 独立临时 profile 无头实测（未触碰默认 profile）
```
chrome.exe --headless=new --user-data-dir=$(mktemp -d) --dump-dom https://gemini.google.com/app
RAW HTML len: 804329
visible text: "‎Google Gemini 登录 Google 应用"
hit[not available in your country]=0  hit[unsupported]=0  hit[unusual traffic]=0
hit[sorry]=0  hit[country]=0  hit[无法使用]=0  hit[不支持]=0
google.com.hk -> 0   /sorry/ -> 0   consent.google -> 0   accounts.google.com -> 1
bundle: boq-gemini-web-uiserver.BardChatUi.zh_CN...  (Gemini 官方简体中文界面，无阻断)
```
说明：全新无扩展 profile 已能正常取到 Gemini 页面；默认 profile 的完整聊天界面由前序实测确认。

## 建议（给用户可操作的步骤，不要代替用户执行）
**需要用户动手**
1. 清掉旧区域页面缓存：Chrome → `chrome://settings/clearBrowserData` → 选「缓存的图片和文件」→ 时间范围「不限时间」→ 清除。（消掉缓存里的 www.google.com.hk 页面；Code Cache 一并清掉更干净。）
2. 修正 Chrome 自身的国家缓存（它现在仍写 cn）：完全退出 Chrome 后，由用户编辑 `%LOCALAPPDATA%\Google\Chrome\User Data\Local State`（即 `C:\Users\<你>\AppData\Local\Google\Chrome\User Data\Local State`），删除 `variations_country`、`variations_permanent_consistency_country`、`variations_safe_seed_permanent_consistency_country`、`variations_safe_seed_session_consistency_country` 四个键后重启 Chrome；或等 Chrome 自动升级到新版本号（permanent consistency 按版本绑定，升级即重置）。同时重启 Chrome 即可让它重新抓取 seed（当前 Chrome 版本 155.0.8059.82，seed 上次抓取是修复前的 2026-10-19 18:04）。
3. 保持「安全 DNS = 关闭」：Chrome → 设置 → 隐私和安全 → 安全 → 使用安全 DNS → 关闭（当前已是 off，且未被策略锁定，勿改成「使用当前服务提供商」以免 DoH 与路由器的 fake-ip 冲突）。
4. 可选：把 Windows 区域格式改为「英语（美国）」以避免账号地区推断/YouTube 仍偏中国 —— Windows 设置 → 时间和语言 → 语言和区域 → 区域格式。此项**不影响** Gemini 可用性，仅影响账号地区推断。
5. 若想彻底排除扩展干扰而不用卸载：用 Chrome 无痕窗口或访客模式打开 `https://gemini.google.com/app` 验证。

**不影响（无需处理）**
- 8 个扩展：无一改写 UA / 无代理 / 无 DNR 头改写；Tampermonkey 无 google/gemini 脚本；AdGuard 对 gemini/accounts/dl/safebrowsing/play/gstatic 命中 0；Read Frog、Dark Reader、Adobe Acrobat 仅改 DOM；青柠/ACG/Hangouts 与 Google 判定无关。
- Secure DNS 关闭、无策略锁定、无 `--proxy-server`、WinINET `ProxyEnable=0`、`Local State.proxy=null`。
- 本机 DNS 缓存为 0 条，无污染残留，无需 `ipconfig /flushdns`。
- Google 未获授定位权限，账号地区未设置，二者不构成地区阻断。

---
说明（过程透明）：排查中执行 `chrome.exe --version` 时，Windows 版 Chrome 忽略该参数并**启动了默认 profile 的 Chrome**（随后已关闭，恢复到任务开始前「Chrome 未运行」状态），临时无头 profile 与临时文件已全部删除。未修改任何 Chrome 设置、策略、扩展或站点数据，未卸载扩展，未执行 `ipconfig /flushdns`，未改路由器配置。

TASK_RESULT: PASS 浏览器/客户端层无残留阻断项；仅需用户清理 Chrome 的 cn 国家缓存与磁盘中的旧 google.com.hk 页面。
