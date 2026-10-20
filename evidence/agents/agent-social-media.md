结论：社媒/通讯 13 个域名实测全部走同一条链路 `🚀 节点选择 → ♻️ 自动选择 → 🇯🇵 日本-优化(<REDACTED-EXIT-IP>)`，即 Google 同款「被判 CN」的出口；**踩坑的是 Instagram/Facebook（Meta 自己判 `country_code:CN`）与 Reddit（该 IP 被 Reddit 403「You've been blocked by network security.」）**，X/Twitter、Slack、Discord、Telegram、LinkedIn、Mastodon 不敏感。

## 证据

### 1. 路由：13/13 落在同一出口
运行态规则（`GET /rules`，13105 条，过滤社交域名）：

```
2700 DomainSuffix telegram.org    -> 📲 电报消息
3092 DomainSuffix linkedin.com   -> 🚀 节点选择
3096 DomainSuffix reddit.com     -> 🚀 节点选择
3116 DomainKeyword facebook      -> 🚀 节点选择
3121 DomainKeyword instagram     -> 🚀 节点选择
3126 DomainKeyword twitter       -> 🚀 节点选择
3289 DomainSuffix discord.com    -> 🚀 节点选择
3292 DomainSuffix discordapp.com -> 🚀 节点选择
3461 DomainSuffix x.com          -> 🚀 节点选择
slack.com / mastodon.social      -> 无规则 → index 13104 Match → 🐟 漏网之鱼
```

实测出口链（`sh /tmp/owrt/rsh.sh 'curl -s -m 6 http://127.0.0.1:9999/connections | tr "{" "\n" | grep -i "<域名>"'`，每域先 curl 一次再取该 host 最新连接）：

```
x.com            chains=["🇯🇵 日本-优化","♻️ 自动选择","🚀 节点选择"]  rule=DomainSuffix:x.com
api.x.com        chains=[同上]  rule=DomainSuffix:x.com
twitter.com      chains=[同上]  rule=DomainKeyword:twitter
instagram.com    chains=[同上]  rule=DomainKeyword:instagram
facebook.com     chains=[同上]  rule=DomainKeyword:facebook
reddit.com       chains=[同上]  rule=DomainSuffix:reddit.com
www.linkedin.com chains=[同上]  rule=DomainSuffix:linkedin.com
discord.com      chains=[同上]  rule=DomainSuffix:discord.com
discordapp.com   chains=[同上]  rule=DomainSuffix:discordapp.com
telegram.org     chains=[...,"📲 电报消息"]  rule=DomainSuffix:telegram.org
web.telegram.org chains=[...,"📲 电报消息"]  rule=DomainSuffix:telegram.org
slack.com        chains=[...,"🐟 漏网之鱼"]  rule=Match
mastodon.social  chains=[...,"🐟 漏网之鱼"]  rule=Match
```

出口 IP 同步确认：`curl -s -m 10 -x http://127.0.0.1:7890 https://api.ipify.org` → `<REDACTED-EXIT-IP>`（= Google 判 CN 的那个日本节点）。`📲 电报消息 → 🚀 节点选择 → ♻️ 自动选择`，故电报与其它社媒同出口。

### 2. 服务方自己的地区判定（同一路径 curl，出口 IP 由 ipify 前后夹测锁定）

| 服务 | 服务方标记 | 实测出口 IP → 判定 |
|---|---|---|
| **instagram** | 页面内 `["PolarisSiteData",[],{"country_code":"CN"` | <REDACTED-EXIT-IP>→**CN**；<REDACTED-EXIT-IP>→CN；<REDACTED-EXIT-IP>→CN；<REDACTED-EXIT-IP>→SG；<REDACTED-EXIT-IP>→HK |
| **reddit** | HTTP 码 + 正文 | <REDACTED-EXIT-IP>→**403**「You've been blocked by network security.」；<REDACTED-EXIT-IP>→200 且 `country_code:CN`；CA/SG/DE/GB/HK/TW/IN 出口→200 |
| **x.com** | 页面内 `"country":"XX"` | <REDACTED-EXIT-IP>→**JP**；<REDACTED-EXIT-IP>→IN；<REDACTED-EXIT-IP>5→TW；<REDACTED-EXIT-IP>→HK；<REDACTED-EXIT-IP>→CA；<REDACTED-EXIT-IP>→SG；<REDACTED-EXIT-IP>→DE；<REDACTED-EXIT-IP>→GB |
| **slack.com** | 自身地区重定向 `Location` + `GA.boot_data.geo` | <REDACTED-EXIT-IP>→`Location: https://slack.com/intl/ja-jp/`（JP）；<REDACTED-EXIT-IP>→`geo={"ip":...,"country":"TW","region":"TPE","city":"Taipei"}`；<REDACTED-EXIT-IP>→`country:CA,city:Montreal` |
| **twitter.com** | `Location` | 301 → `https://x.com/`（并入 X，无独立判定） |
| **api.x.com** | — | 404（根路径），无国家标记 |
| **discordapp.com** | `Location` | 301 → `https://discord.com/` |
| **facebook** | 无 | 登出页无 country 字段；`m.facebook.com`→301→www.facebook.com；Meta 判定以 IG 的 `country_code` 为准 |
| **discord** | 无 | `/api/v9/experiments`、`/api/v9/gateway`、`/discover`、`/api/v9/oauth2/authorize` 均无 country 字段；`cf-ray` 仅 CDN 判定 |
| **telegram.org / web.telegram.org** | 无 | 200，`x-served-by: meta4240xxx`（Meta CDN），无国家标记 |
| **www.linkedin.com** | 无 | 200，`<meta name="locale" content="en_US">`，无国家标记 |
| **mastodon.social** | 无 | 200，`x-served-by: cache-fra-etou8220077-FRA, cache-hkg17932-HKG`（Fastly CDN），`/api/v2/instance` 无 country 字段 |

原始片段：
```
# Instagram（出口 <REDACTED-EXIT-IP>）
["PolarisSiteData",[],{"country_code":"CN","device_id":"A958AE5E-6054-4EE4-89B4-0852763438EB"
# X（出口 <REDACTED-EXIT-IP>）
"appVersion":"0a94029241edd14821cd090cbdf24f385a030058","country":"JP","hasMultiAccountSession":false
# Slack（出口 <REDACTED-EXIT-IP>）
location: https://slack.com/intl/ja-jp/
# Slack（出口 <REDACTED-EXIT-IP>）
GA.boot_data.geo = {"ip":"<REDACTED-EXIT-IP>","country":"TW","is_in_european_union":false,"region":"TPE","city":"Taipei"
# Reddit（出口 <REDACTED-EXIT-IP>，低频 20s 间隔 15/15 次）
http=403  ...<div class="font-bold text-24 text-neutral-content-strong">You've been blocked by network security.</div>
```

Reddit 的 403 不是限流：低频（20s 间隔）、高频（连续 8 次）、静置 45s 后三种节奏在 <REDACTED-EXIT-IP> 上均 403（15/15），而同窗口其它出口均为 200。

### 3. 出口本身还会漂移
```
$ curl .../proxies/%F0%9F%9A%80%20%E6%89%8B%E5%8A%A8%E5%88%87%E6%8D%A2   # 🚀 手动切换
09:59:15 🇸🇬 新加坡-优化2-GPT   09:59:51 🇭🇰 香港-优化   10:00:03 🇭🇰 香港-优化2
10:22:09 🇭🇰 香港-优化3  10:22:16 🇭🇰 香港WAP-优化  10:22:23 🇯🇵 日本-优化
10:31:14 🇬🇧 英国-优化-GPT → 10:31:55 🇬🇧 英国-优化2 → 10:32:19 🇬🇧 英国-优化3
```
每 15–30s 换一次节点，本地无任何脚本 PUT 它（`grep -rn "手动切换" /etc/ShellCrash/*.sh` 只读不写）；guardian.sh（cron `*/5`）随后又把 `🚀 节点选择` 复位成 `♻️ 自动选择`(URLTest=`🇯🇵 日本-优化`)。故社媒出口长期=<REDACTED-EXIT-IP>，偶发漂到印度/台湾/美国。

### 4. 敏感性判定
| 服务 | 是否敏感 | 依据 |
|---|---|---|
| Instagram / Facebook | **是** | Meta 判 `CN`，与 Google 同判；Meta 对 CN IP 有区域策略（IG 在中国大陆不可用） |
| Reddit | **是** | 该 IP 为 IP 级网络封锁 403（非限流），换哪个节点都不稳 |
| X / Twitter | 否 | 判 JP/IN/TW/HK…，按真实 IP 地理，不因 Google 判 CN 降级；但出口漂移会让国家标记在 JP/TW/HK/IN 间跳变 |
| Slack | 否 | 判 JP 并自身重定向 `/intl/ja-jp/` |
| Discord / Telegram / LinkedIn / Mastodon | 否 | 无服务方国家标记、全部 200、无限制措辞 |

### 5. 可复用的通用判定手法
① `curl -s http://127.0.0.1:9999/connections` 取该 host **start 最新**的一条 → `chains` 给真实出口节点、`rule/rulePayload` 给命中规则；
② 用**同一路径** `curl -x http://127.0.0.1:7890 https://api.ipify.org` 在请求**前后各测一次**，两次相同才认样本（出口会漂）；
③ 服务方判定优先级：a) 页面内嵌国家标记（X `"country"`、Slack `GA.boot_data.geo`、Meta `PolarisSiteData.country_code`、Reddit `country_code`）→ b) 服务自身地区重定向（Slack `Location: /intl/ja-jp/`）→ c) API 错误码（Reddit 403 正文）；
④ 同一服务在**多个出口 IP** 上重复采样：标记随出口变＝IP-geo 敏感；无标记/不变＝不敏感；
⑤ 严格区分 **CDN 判定**（`cf-ray` 后缀、`x-served-by`、`x-cache`）与**服务方判定**；
⑥ 坑：`GET /proxies/{节点}/delay` **不返回 HTTP 状态码**（403 也算成功，只能测连通性），不能用来判封锁；测重定向必须 GET，`-I`(HEAD) 测不出 302。

## 建议（可直接执行；风险等级；本次均未执行）

1. 【低｜规则】把 Meta 与 Reddit 单独钉到**已存在**的干净出口组 `🤖 干净出口`（= `🇮🇳 印度-优化`，Selector 只有这一个成员）。规则须写进会被 ShellCrash 插到 `rules:` 最前面的 `/etc/ShellCrash/yamls/rules.yaml`；该文件每周日 04:30 被 `ai-rules-update.sh` 重写，**必须同时改生成器**（下面这条已在文件副本上验证 `sh -n` 通过）：
   ```sh
   sh /tmp/owrt/rsh.sh 'cp /etc/ShellCrash/ai-rules-update.sh /etc/ShellCrash/ai-rules-update.sh.bak && \
     sed -i "s|^} > \"\$OUT.tmp\"|  echo \"- DOMAIN-SUFFIX,instagram.com,\$CL\"\n  echo \"- DOMAIN-SUFFIX,facebook.com,\$CL\"\n  echo \"- DOMAIN-SUFFIX,reddit.com,\$CL\"\n  echo \"- DOMAIN-SUFFIX,redd.it,\$CL\"\n} > \"\$OUT.tmp\"|" /etc/ShellCrash/ai-rules-update.sh && \
     sh /etc/ShellCrash/ai-rules-update.sh && \
     grep -nE "instagram|reddit" /etc/ShellCrash/yamls/rules.yaml'
   ```
   风险：该脚本正被其它进程并发改动（10:19/10:23 两次重写），必须先备份；生成后需 `sh /etc/ShellCrash/start.sh start` 才生效（重载全部分流）。另注意 `DOMAIN-KEYWORD,facebook`（index 3116）早于 `DOMAIN-SUFFIX,facebook.com` 匹配，需确认 keyword 规则也被一并覆盖。
2. 【中｜路由】X/Twitter/Slack/Discord/Telegram/LinkedIn/Mastodon 不敏感，**保持现状即可**；若要消除会话 IP 抖动，可把 `🚀 节点选择` 指向 `🤖 干净出口`（`♻️ 自动选择` 是 URLTest，长期漂到被判 CN 的日本节点）：
   ```sh
   sh /tmp/owrt/rsh.sh 'S=$(sed -n "s/^secret=//p" /etc/ShellCrash/configs/ShellCrash.cfg|head -1); \
     curl -s -m 8 -X PUT -H "Authorization: Bearer $S" -H "Content-Type: application/json" \
     -d "{\"name\":\"🤖 干净出口\"}" \
     "http://127.0.0.1:9999/proxies/%F0%9F%9A%80%20%E8%8A%82%E7%82%B9%E9%80%89%E6%8B%A9"'
   ```
   风险：改变**全站**默认出口，影响面最大；guardian.sh 每 5 分钟可能把它复位回 `♻️ 自动选择`，需同步改 guardian 判据。
3. 【低｜溯源】`🚀 手动切换` 的轮换没有任何本地脚本在写（疑似外部面板/其它 agent 操作）；建议查 `crontab -l` 之外的 `/etc/ShellCrash/task/task.sh` 与面板 API 日志，确认无人操作再考虑固定。
4. 【低｜只读巡检】每日采一次出口 IP + 国家标记，IG/Reddit 变 CN 或 403 即告警（复用第 5 节手法）：
   ```sh
   sh /tmp/owrt/rsh.sh 'ip=$(curl -s -m 10 -x http://127.0.0.1:7890 https://api.ipify.org); \
     ig=$(curl -s -m 20 -x http://127.0.0.1:7890 https://www.instagram.com/ | tr -d "\r\n" | grep -o -E "\"country_code\":\"[A-Z]{2}\"" | head -1); \
     rd=$(curl -s -m 20 -x http://127.0.0.1:7890 -o /dev/null -w "%{http_code}" https://www.reddit.com/); \
     echo "ip=$ip ig=$ig reddit=$rd"'
   ```
   风险：无（只读）。

TASK_RESULT: PASS 社媒/通讯 13 域名全走被判 CN 的 <REDACTED-EXIT-IP>；踩坑仅 Instagram/Facebook（Meta 判 CN）与 Reddit（403 网络封锁），建议二者改指已有的 🤖 干净出口组；X/Twitter(Slack 判 JP)、Discord、Telegram、LinkedIn、Mastodon 不敏感。
