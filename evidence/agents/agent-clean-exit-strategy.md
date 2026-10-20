结论：通用池（818 条规则）与 🤖 人工智能 此刻**全部出口到被 Google 判为 CN 的节点**，根因是 guardian 复原判据仍写「出口=香港」；推荐方案 (b)：新建 `🤖 干净出口` 固定印度 + 29 条 Google/YouTube 域族改指它 + 守护判据换成 cc 探针。

## 证据

### 1. 规则族统计（`GET /rules`，13070 条）

| 目标组 | 条数 | 构成 |
|---|---|---|
| 🚀 节点选择 | **445** | DomainSuffix 326 / IPCIDR 84 / DomainKeyword 26 / Domain 9 |
| 🌍 国外媒体 | **372** | DomainSuffix 255 / Domain 71 / DomainKeyword 25 / IPCIDR 18 / ProcessName 3 |
| 🐟 漏网之鱼 | **1** | Match 全兜底（index #13069，hit=10）|
| ♻️ 自动选择 | 0 | 仅作成员被引用 |
| **通用池合计** | **818** | 其余 9665→全球直连、1609→广告拦截、371→专用组 |

`rules.yaml`（268 行）落在 API index **0..259**，模板规则自 260 起，自定义块永远在最前。

### 2. 最重要的 30 条通用池规则

| # | 规则 | 目标 | 覆盖服务 | 风险 |
|---|---|---|---|---|
|3085|DOMAIN-KEYWORD,google|🚀节点选择|googleapis.cn/gstatic.cn/gvt0/goo.gl/g.co/gcr.io/google.com.hk 等残留域 (hit=2)|高|
|3068|DOMAIN-SUFFIX,hk|🚀节点选择|全部 .hk，含 google.com.hk|高|
|3304|IP-CIDR,74.125.0.0/16|🚀节点选择|Google GFE 段|高|
|3305|IP-CIDR,173.194.0.0/16|🚀节点选择|Google GFE 段|高|
|3084|DOMAIN-KEYWORD,gmail|🚀节点选择|Gmail/Google 账号（通用池最热 hit=11）|高|
|3074|DOMAIN-KEYWORD,1e100|🚀节点选择|Google 1e100.net|高|
|3079|DOMAIN-KEYWORD,blogspot|🚀节点选择|blogspot.com/.hk/.jp、blogger.com|高|
|3283|DOMAIN-SUFFIX,1e100.net|🚀节点选择|同上|高|
|3290|DOMAIN-SUFFIX,googleapis.cn|🚀节点选择|Google CN 端点|高|
|3292|DOMAIN-SUFFIX,gstatic.cn|🚀节点选择|Google CN 端点|高|
|3294|DOMAIN-SUFFIX,gvt0.com|🚀节点选择|Google 静态资源|高|
|3287|DOMAIN-SUFFIX,g.co|🚀节点选择|Google 短链|高|
|3288|DOMAIN-SUFFIX,ggpht.com|🚀节点选择|Google 图片（YouTube 头像）|高|
|3289|DOMAIN-SUFFIX,goo.gl|🚀节点选择|Google 短链|高|
|3231|DOMAIN-SUFFIX,gcr.io|🚀节点选择|Google Container Registry|高|
|3286|DOMAIN-SUFFIX,c.gle|🚀节点选择|Google 短链|高|
|3103|DOMAIN-SUFFIX,appspot.com|🚀节点选择|Google App Engine|高|
|3140|DOMAIN-SUFFIX,firebaseio.com|🚀节点选择|Firebase（Google）|高|
|3098|DOMAIN-SUFFIX,android.com|🚀节点选择|Google Play/安卓|高|
|3114/3116|DOMAIN-SUFFIX,blogger.com / blogspot.com|🚀节点选择|Google Blogger|高|
|3031|DOMAIN-KEYWORD,youtube|🌍国外媒体|YouTube 全族 (hit=3)|中高|
|3034|DOMAIN-SUFFIX,googlevideo.com|🌍国外媒体|YouTube 视频 CDN|中高|
|3039|DOMAIN-SUFFIX,youtube.com|🌍国外媒体|YouTube 主站|中高|
|3044|DOMAIN-SUFFIX,ytimg.com|🌍国外媒体|YouTube 图片|中高|
|3032/3033|DOMAIN,youtubei.googleapis.com / yt3.ggpht.com|🌍国外媒体|YouTube API/头像（Google）|中高|
|2677/2678/2679|DOMAIN-KEYWORD,anthropic/claude/openai|🌍国外媒体|AI 兜底（现被遮蔽，**地雷**）|中高|
|3081/3082|DOMAIN-KEYWORD,facebook/fbcdn|🚀节点选择|Meta（31.13/157.240/173.252 段同在池内）|中|
|3254|DOMAIN-SUFFIX,discord.com|🚀节点选择|Discord 反滥用|中|
|3061|DOMAIN-SUFFIX,reddit.com|🚀节点选择|Reddit (hit=4)|中|
|13069|MATCH|🐟漏网之鱼|全部未命中域名 (hit=10)|中|

首匹配实测：`google.com.hk / googleapis.cn / gstatic.cn / gvt0.com / appspot.com / 1e100.net / c.gle / android.com / firebaseio.com / gmail / blogspot.com` → **全落通用池**；`www.googleapis.com(#9) / www.gstatic.com(#206) / gemini.google.com(#181) / accounts.google.com(#217)` → 已在 AI 组。

### 3. 实时出口链（`GET /proxies` 快照）

```
🚀 节点选择    now=🚀 手动切换    实际出口=🇨🇦 加拿大-优化2   ← Google 判 CN
♻️ 自动选择    now=🇯🇵 日本-优化    实际出口=🇯🇵 日本-优化       ← Google 判 CN
🌍 国外媒体    now=🚀 节点选择     实际出口=🇨🇦 加拿大-优化2   ← Google 判 CN
🐟 漏网之鱼    now=🚀 节点选择     实际出口=🇨🇦 加拿大-优化2   ← Google 判 CN
🤖 人工智能    now=🚀 手动切换     实际出口=🇨🇦 加拿大-优化2   ← Google 判 CN（AI 组自身失守）
🤖 AI网页      now=🇮🇳 印度-优化    实际出口=🇮🇳 印度-优化       ← 唯一干净
🤖 AI接口      now=🇯🇵 日本-优化    实际出口=🇯🇵 日本-优化       ← Google 判 CN
📢 谷歌FCM     now=🚀 节点选择     实际出口=🇨🇦 加拿大-优化2   ← Google 判 CN
🎥 NETFLIX     now=🇸🇬 新加坡节点    实际出口=🇸🇬 新加坡-优化3   ← Google 判 CN
```

出口 IP 实测（走通用池路径的域名）：
```
$ curl -x http://127.0.0.1:7890 https://challenges.cloudflare.com/cdn-cgi/trace
ip=<REDACTED-EXIT-IP> loc=HK     ← 命中 #2962 → 🌍国外媒体 → 🚀节点选择
```

### 4. 根因（`/etc/ShellCrash/guardian.sh`）

```sh
# L83 / L105  复原判据 = 出口名含「香港」
case "$AI_EFF" in  *香港*|*HK*)  put "🤖 人工智能" "🤖 AI网页" ;;  *)  ;; esac
```
```
2026-10-20 10:00:00 FIX: 🤖 人工智能 从「🚀 手动切换」(实际出口「🇭🇰 香港-优化2」) 复原为「🤖 AI网页」
2026-10-20 10:00:00 FIX: 🚀 节点选择 从「🚀 手动切换」(实际出口「🇭🇰 香港-优化2」) 复原为「♻️ 自动选择」
```
日本/新加坡/加拿大/德国/英国同样被判 CN，守护却判为「合法选择」不动。

### 5. 为什么 url-test 必然漂到 CN 节点（`♻️ 自动选择` 延迟排序）

```
过滤掉14条线路=79ms  🇯🇵 日本-优化=81ms  🇭🇰 香港-优化2=89ms  🇭🇰 香港WAP-优化2=93ms
🇭🇰 香港-优化3=94ms  🇹🇼 台湾-优化=116ms ...  🇮🇳 印度-优化=216ms（第 17/28 位）
```
最快的 6 个里 5 个被判 CN，印度第 17 → 含 CN 节点的 url-test 必然漂到 CN。

### 6. 持久化边界

```
cron 30 4 * * 0 → auto-update.sh → ai-rules-update.sh → 整文件重写 yamls/rules.yaml
yamls/proxy-groups.yaml 仅被 clash_modify.sh 读取合并（用户自维护，不被重写）
```
→ 追加 rules.yaml 会被周日清空，规则须改生成器；组定义放 proxy-groups.yaml 则持久。

## 建议

### 方案对比

| 方案 | 利 | 弊 | 判定 |
|---|---|---|---|
|(a) `♻️ 自动选择` 加 filter/exclude-filter|改动最小|①该组是**显式 `proxies:` 列表**，mihomo 的 filter 只对 `include-all-proxies/use` 生效，**当前写了无效**，须先改 include-all；②过滤按**节点名**，而「日本-优化」恰是被判 CN 的节点，台/美是轮换池（<REDACTED-EXIT-IP>/.105，CN/TW 跳变）→名字不可信；③排除后只剩印度，等价 (c)|✗|
|(b) 新建 `🤖 干净出口`（select，固定印度）+ 地区敏感域族改指它|①只搬 29 条规则和 2 个 IP 段，其余 790 条保持 81ms 而非 216ms；②保留机场冗余；③与既有 `🤖 AI网页` 模式一致，可被 guardian 接管|需建组+改生成器；印度单点（DEAD_EXIT_FAILOVER 可兜底）|**✓ 推荐**|
|(c) 通用池整体固定印度|最简单、无漂移|①818 条规则含 YouTube 4K 全走 216ms 单节点，延迟 +135ms、带宽单点；②27/28 节点闲置，冗余作废；③印度挂则代理全断|✗|

### 推荐方案 (b) 的具体改动（**以下命令不要执行**）

**步骤 1 — 新建干净出口组（持久，低风险）**

```sh
cat >> /etc/ShellCrash/yamls/proxy-groups.yaml <<'EOF'

# CLEAN_EXIT_GROUP 2026-10-20：唯一经 Google cc 实测判为非 CN 的稳定出口
# 用 select 不用 url-test：url-test 会按延迟漂到被判 CN 的日本/香港节点
- name: 🤖 干净出口#🤖 人工智能
  type: select
  include-all-proxies: true
  filter: "(印度|India|IN)"
  exclude-filter: "过滤|流量|到期|剩余|套餐"
EOF
```

**步骤 2 — 改生成器（持久，中风险；**改 ai-rules-update.sh**，勿直接改 rules.yaml）**

在 `# ===== 分类修正层` 段内、`# C. 服务一致性` **之前**插入：

```sh
echo "# CLEAN_EXIT_BLOCK：地区敏感域族统一走干净出口"
echo "- DOMAIN-KEYWORD,google,🤖 干净出口"
echo "- DOMAIN-KEYWORD,gmail,🤖 干净出口"
echo "- DOMAIN-KEYWORD,1e100,🤖 干净出口"
echo "- DOMAIN-KEYWORD,blogspot,🤖 干净出口"
echo "- DOMAIN-SUFFIX,googleapis.cn,🤖 干净出口"
echo "- DOMAIN-SUFFIX,gstatic.cn,🤖 干净出口"
echo "- DOMAIN-SUFFIX,gvt0.com,🤖 干净出口"
echo "- DOMAIN-SUFFIX,g.co,🤖 干净出口"
echo "- DOMAIN-SUFFIX,goo.gl,🤖 干净出口"
echo "- DOMAIN-SUFFIX,gcr.io,🤖 干净出口"
echo "- DOMAIN-SUFFIX,ggpht.com,🤖 干净出口"
echo "- DOMAIN-SUFFIX,c.gle,🤖 干净出口"
echo "- DOMAIN-SUFFIX,appspot.com,🤖 干净出口"
echo "- DOMAIN-SUFFIX,blogger.com,🤖 干净出口"
echo "- DOMAIN-SUFFIX,android.com,🤖 干净出口"
echo "- DOMAIN-SUFFIX,firebaseio.com,🤖 干净出口"
echo "- DOMAIN-SUFFIX,google.com.hk,🤖 干净出口"
echo "- IP-CIDR,74.125.0.0/16,🤖 干净出口"
echo "- IP-CIDR,173.194.0.0/16,🤖 干净出口"
echo "- DOMAIN-SUFFIX,youtube.com,🤖 干净出口"
echo "- DOMAIN-SUFFIX,googlevideo.com,🤖 干净出口"
echo "- DOMAIN-SUFFIX,ytimg.com,🤖 干净出口"
echo "- DOMAIN-SUFFIX,youtu.be,🤖 干净出口"
echo "- DOMAIN-SUFFIX,youtube-nocookie.com,🤖 干净出口"
echo "- DOMAIN,youtubei.googleapis.com,🤖 干净出口"
echo "- DOMAIN,yt3.ggpht.com,🤖 干净出口"
echo "- DOMAIN-KEYWORD,claude,🤖 人工智能"
echo "- DOMAIN-KEYWORD,anthropic,🤖 人工智能"
echo "- DOMAIN-KEYWORD,openai,🤖 人工智能"
```
同时删除该脚本里原 `- DOMAIN,youtubei.googleapis.com,🌍 国外媒体` 一行（旧行在前会先行命中）。

**步骤 3 — 改守护判据（低风险，最高优先）**

`guardian.sh` L83/L105 的 `case` 由「香港」改为 cc 判定（复用 L144 已有的 CC 探测）：`CC=CN` 时把 `🤖 人工智能`、`🤖 AI网页`、`🤖 干净出口` 一律 `put` 回 `🇮🇳 印度-优化`；`🌍 国外媒体`/`🐟 漏网之鱼` 由「仅记录」改「记录+提示」。并把 `🤖 AI网页` 的 `filter` 收窄为 `"(印度|India)"`。

**步骤 4 — 应用与校验（中风险）**

```sh
sh /etc/ShellCrash/ai-rules-update.sh          # 重新生成 rules.yaml
sh /etc/ShellCrash/task/task.sh hotupdate        # 合并组+规则并热更
```
只读校验：
```sh
curl -s -H "Authorization: Bearer $(sed -n 's/^secret=//p' /etc/ShellCrash/configs/ShellCrash.cfg|head -1)" \
  http://127.0.0.1:9999/proxies/%F0%9F%A4%96%20%E5%AE%89%E5%87%80%E5%87%BA%E5%8F%A3 | grep -oE '"now":"[^"]*"'
```

### 风险与注意

- **组与规则必须同批生效**：只加规则不建组会让 mihomo 拒载整份配置并**静默回退基础配置**，自定义分流全丢（`reorder-groups.sh` 注释 2026-10-20 02:33 实测）。
- 两个 Google /16 段会**遮蔽** `📢 谷歌FCM` 的 44 条 /32（#1901-1944），但它们本就指通用池（CN 出口），净效果是变干净；要保留 FCM 语义则改指 `📢 谷歌FCM` 并把该组选到 `🤖 干净出口`。
- YouTube 全族搬印度 = 4K 视频 216ms 且与 Gemini 共用出口；带宽敏感可只搬 `youtubei.googleapis.com`/`yt3.ggpht.com`，`googlevideo.com` 留国外媒体组。
- `🐟 漏网之鱼` 是唯一 Match 兜底（hit=10），**不建议**整体搬印度（未识别服务全压单点），靠上述规则捞出 Google 系即可。
- `🎥 NETFLIX`/`🎥 DisneyP` = `🇸🇬 新加坡节点`（被判 CN），区域锁敏感，可一并切 `🤖 干净出口`；`🤖 AI接口` = 日本-优化（opencode.ai 走 Anthropic，JP 在其支持列表内，风险低）；`Ⓜ️ 微软服务`/`🍎 苹果服务`/`🎯 全球直连` = DIRECT，无关干净度。

### 风险分级

- **高**：Google 系残留域（16 后缀/关键字）+ GFE 两个 /16 + Gmail + `DOMAIN-SUFFIX,hk`（含 google.com.hk）+ YouTube 族 + `🤖 人工智能` 当前出口 + `🤖 AI接口`。
- **中**：Meta/FB 段、Discord、Reddit、Twitch、Stripe、`🐟 漏网之鱼` 兜底、`🎥 NETFLIX`/`🎥 DisneyP`、AI 关键字兜底（#2677-2679 一旦 rules.yaml 变短即生效）。
- **低**：Telegram（本就禁 CN）、GitHub、Docker、Steam、OneDrive/SharePoint、sentry/opendns、CDN（akamai/cloudfront/fbcdn）。

TASK_RESULT: PASS 通用池 818 条规则与 AI 组当前全部落在被 Google 判为 CN 的出口上，根因是 guardian 判据过时；推荐方案 (b)：新建 `🤖 干净出口` 固定印度 + 29 条 Google/YouTube 域族与 2 个 Google IP 段改指它 + 守护判据换成 cc 探针。
