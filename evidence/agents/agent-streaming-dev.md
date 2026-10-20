结论：16 个域名实测完毕——**只有 `api.github.com` 真正受损**（共享出口 IP 未认证配额被耗尽→403）；**没有任何流媒体/工具站点因「Google 判为 CN」受损**，同一出口 <REDACTED-EXIT-IP> 上 HBO Max、Steam、PrimeVideo 全部自判 **JP**。

## 证据

**A. 命中规则 / 实际出口 / 服务方自判地区**（mihomo `/connections` 实测，路由器经 7890 发起）

| 域名 | 规则→组 | 出口链末环 | 服务方自判 |
|---|---|---|---|
| netflix.com / www.netflix.com | DomainSuffix `netflix.com` → 🎥 NETFLIX | 🇸🇬 新加坡-优化3 | **SG**：`location: https://www.netflix.com/sg/`、body `"country":"SG"` |
| disneyplus.com | DomainSuffix `disneyplus.com` → 🎥 DisneyP | 🇸🇬 新加坡-优化2-GPT | **SG**：`"location":"SG"`、`"hasContent":true` |
| hbomax.com | DomainSuffix `hbomax.com` → 🌍 国外媒体 | 🇯🇵 日本-优化 | **JP**：`set-cookie: countryCode=JP` |
| www.primevideo.com | **rule=Match**（无专属规则）→ 🐟 漏网之鱼 | 🇯🇵 日本-优化2 | **JP**：`currentTerritory":"JP"` |
| spotify.com / open.spotify.com | DomainKeyword `spotify.com` → 🌍 国外媒体 | 🇯🇵 日本-优化 | 无服务方标记；仅 CDN `x-served-by: cache-nrt-rjtf7700099-NRT` |
| github.com / api.github.com / raw.githubusercontent.com | DomainKeyword `github` → 🚀 节点选择 | 🇭🇰 香港WAP-优化 | 无地区概念；见 C |
| gitlab.com | DomainSuffix `gitlab.com` → 🚀 节点选择 | 🇯🇵 日本-优化 | 仅 CDN `cf-ray: a4d470178bc87558-HKG` |
| bitbucket.org | **rule=Match** → 🐟 漏网之鱼 | 🇯🇵 日本-优化 | 仅 CDN `x-amz-cf-pop: SIN3-P3` |
| huggingface.co | DomainSuffix `huggingface.co` → 🤖 人工智能 | 🇮🇳 印度-优化 | 无地区标记；仅 CDN `x-amz-cf-pop: NRT12-P2` |
| pypi.org / crates.io | **rule=Match** → 🐟 漏网之鱼 | 🇯🇵 日本-优化 | 仅 CDN `cache-iad-…-IAD` / `cache-lax-…-LAX` |
| steamcommunity.com | DomainSuffix `steamcommunity.com` → 🚀 节点选择 | 🇯🇵 日本-优化 | **JP**：`set-cookie: steamCountry=JP` |

**B. 同一个「Google 判 CN」的出口，其余服务自判全是 JP**（连续 10 次采样一致）
```
IP=<REDACTED-EXIT-IP> | PV=currentTerritory":"JP | HB=countryCode=JP | ST=steamCountry=JP | SP=cache-nrt-rjtf7700099-NRT | gh=200 x-ratelimit-remaining: 0
```
（<REDACTED-EXIT-IP> / <REDACTED-EXIT-IP> / <REDACTED-EXIT-IP> / <REDACTED-EXIT-IP> / <REDACTED-EXIT-IP> / <REDACTED-EXIT-IP> 上 HBO Max=DE、Steam=FR，同样自判真实国家）

**C. 唯一受损项：api.github.com 403（共享 IP 配额，非地区判定）**
```
HTTP/2 403
x-ratelimit-limit: 60
x-ratelimit-remaining: 0
x-ratelimit-used: 60
{"message":"API rate limit exceeded for <REDACTED-EXIT-IP>. ..."}
```
对照：印度 <REDACTED-EXIT-IP> → `remaining: 59`；德国 <REDACTED-EXIT-IP> → `remaining: 55~57`。

**D. 其余全正常（JP 出口 <REDACTED-EXIT-IP> 同步实测）**
```
hf=200 pypi=200 crates=200 gitlab=301 bitbucket=200 github.com=200
HF: x-powered-by: huggingface-moon / x-cache: Hit from cloudfront
```

**E. 环境事实**：① 09:55 路由器重启过（/tmp 清空、组选择复位），以上均为重启后重测；② `guardian.sh`（crontab `*/5`）每 5 分钟把 `🚀 节点选择` 复位为 `♻️ 自动选择`；③ 通用路径出口是**轮换 IP 池**（<REDACTED-EXIT-IP> / <REDACTED-EXIT-IP> / <REDACTED-EXIT-IP> / <REDACTED-EXIT-IP> / <REDACTED-EXIT-IP> / <REDACTED-EXIT-IP> / <REDACTED-EXIT-IP> / <REDACTED-EXIT-IP>），同国 3 个「优化/优化2/优化3」是**同一落地 IP、不同入口**（端口 16617/16618/16632… 一致）。

## 建议（不要执行）

**1)【低】把 `api.github.com`（连同 `raw.githubusercontent.com`、`codeload.github.com`）加进 `🤖 人工智能` 规则组**（＝`🤖 AI网页`＝`🇮🇳 印度-优化`，实测 GitHub 配额 59/60 全新）。只读验证：
```sh
sh /tmp/owrt/rsh.sh 'curl -s -m 8 -x http://127.0.0.1:7890 -D- -o/dev/null https://api.github.com/rate_limit | grep -i x-ratelimit'
```

**2)【低·临时】把 `🚀 节点选择` 切到印度**（5 分钟后 guardian.sh 会复位，长期生效须走第 1 条）：
```sh
sh /tmp/owrt/rsh.sh 'S=$(sed -n "s/^secret=//p" /etc/ShellCrash/configs/ShellCrash.cfg|head -1); curl -s -X PUT -H "Authorization: Bearer $S" -H "Content-Type: application/json" -d "{\"name\":\"🇮🇳 印度-优化\"}" "http://127.0.0.1:9999/proxies/%F0%9F%9A%80%20%E8%8A%82%E7%82%B9%E9%80%89%E6%8B%A9"'
```

**3)【中】给 `www.primevideo.com` 建专属组 `🎬 PrimeVideo` → `🇯🇵 日本-优化`**：它现在落 `rule=Match`，出口轮换使 `currentTerritory` 在 JP/CA/DE 间跳、片库跟着翻。需改 `/etc/ShellCrash/config.yaml` 并同步写进 `ai-rules-update.sh`（`auto-update.sh` 每周日 04:30 会重写规则）。

**4)【低·保持现状】别把 `🎥 NETFLIX`/`🎥 DisneyP` 搬到印度**：Disney+ 与 HBO Max 在印度不提供服务，用「Google 判为 CN 的干净节点」修它们反而制造新故障；实测新加坡出口 `location=SG`、`hasContent=true`、Netflix `/sg/` 正常。

**5)【低·可复用】通用「服务方地区判定 + 出口」一条命令**
```sh
DOM=www.netflix.com
sh /tmp/owrt/rsh.sh "S=\$(sed -n 's/^secret=//p' /etc/ShellCrash/configs/ShellCrash.cfg|head -1); T=/tmp/g_\$\$; (curl -s -m 12 -o \$T.html -D \$T.hdr -w 'HTTP=%{http_code} LOC=%{redirect_url}\n' -x http://127.0.0.1:7890 -A 'Mozilla/5.0' https://$DOM/ &); sleep 4; echo '-- 出口链:'; curl -s -m 5 -H \"Authorization: Bearer \$S\" http://127.0.0.1:9999/connections | tr '{' '\n' | grep -F '\"host\":\"$DOM\"' | head -1 | grep -oE '\"(rule|rulePayload)\":\"[^\"]*\"|\"chains\":\[[^]]*\]'; echo '-- 地区标记:'; grep -aioE '^location: .*|countryCode=[A-Z]{2}|steamCountry=[A-Z]{2}|currentTerritory.{0,12}|\"country\":\"[A-Z]{2}\"|\"location\":\"[A-Z]{2}\"' \$T.hdr \$T.html | head -5; echo '-- 通用路径出口IP:'; curl -s -m 10 -x http://127.0.0.1:7890 https://api.ipify.org"
```
要点：`chains` 末环＝真实出口；**必须 GET**（`-w '%{redirect_url}'`，HEAD 测不出 302）；地区标记只取服务自己发的（`Location` / `set-cookie: countryCode=XX` / `steamCountry=XX` / 页面内 `currentTerritory` / `"location":"XX"`），`x-served-by`、`cf-ray`、`x-amz-cf-pop` **只算 CDN 判定**；同刻抓 `api.ipify.org` 对照出口 IP；同一 IP 换 2~3 家互测，即可判断「CN」是全局判定还是某一家独有。

TASK_RESULT: PASS 流媒体与开发者/工具类 16 个域名实测完毕——除 api.github.com 因共享出口 IP 未认证配额耗尽而 403 外，无一因「Google 判 CN」受损（同一 <REDACTED-EXIT-IP> 上 HBO Max/Steam/PrimeVideo 均自判 JP），建议仅把 api.github.com 挪到印度出口，并保持 Netflix/Disney+ 走新加坡。
