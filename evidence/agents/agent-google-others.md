结论：这 12 个 Google 服务同命中 `DOMAIN-SUFFIX,google.com` → `🤖 人工智能`，彼此不打架；病灶是该组指向 `🚀 手动切换`（🇯🇵日本-优化，判 CN），10 采样 8 次 CN；Play 币种 USD 属账号侧，与出口判定天然不一致。

## 证据

**1) 规则归属**（config.yaml md5 `c3592f76`，L=文件行号）

```
accounts.google.com -> DOMAIN accounts.google.com (L723) -> 🤖 人工智能
drive/photos/one/docs/mail/chromewebstore/play/payments/myaccount/meet/chat.google.com
                    -> DOMAIN-SUFFIX google.com (L731) -> 🤖 人工智能
gstatic.com (L712) / googleusercontent.com (L730) / googleapis.com (L732) -> 🤖 人工智能
gmail.com       -> DOMAIN-KEYWORD gmail (L734)       -> 🤖 干净出口
google.com.hk   -> DOMAIN-SUFFIX google.com.hk (L749) -> 🤖 干净出口
googlevideo.com -> DOMAIN-SUFFIX googlevideo.com (L754) -> 🤖 干净出口
google.cn       -> RULE-SET,cn (L3210) -> 🎯 全球直连 -> DIRECT
```

**2) 实时 chains**（`/connections`）

```
gmail.com       "chains":["🇮🇳 印度-优化","🤖 干净出口"]     "rule":"DomainKeyword" "rulePayload":"gmail"
google.com.hk   "chains":["🇮🇳 印度-优化","🤖 干净出口"]     "rule":"DomainSuffix" "rulePayload":"google.com.hk"
play.google.com "chains":["🇮🇳 印度-优化","🤖 AI网页","🤖 人工智能"] "rule":"DomainSuffix" "rulePayload":"google.com"
google.cn       "chains":["DIRECT","🎯 全球直连"]             "rule":"RuleSet"       "rulePayload":"cn"
```

**3) 出口漂移=判定漂移**

```
[0] 人工智能=🚀 手动切换 手动切换=🇯🇵 日本-优化2      support=var cc='CN'  www.google.com->google.com.hk hl=zh-CN pref=hkredirect
[1] 人工智能=🤖 AI网页    手动切换=🇯🇵 日本-优化       support=var cc='IN'  www.google.com->no-redirect
[2] 人工智能=🚀 手动切换 手动切换=🇯🇵 日本-优化3      support=var cc='CN'
[5] 人工智能=🚀 手动切换 手动切换=🇸🇬 新加坡-优化-GPT support=var cc='CN'
[9] 人工智能=🤖 AI网页                                support=var cc='IN'
```
8/10 为 CN；`🤖 AI网页` 全程=🇮🇳印度-优化（干净），却被 `🤖 人工智能` 绕开。

**4) 通用池压 CN 节点**

```
"♻️ 自动选择" "now":"🇯🇵 日本-优化"   "🚀 节点选择" "now":"🚀 手动切换"
/tmp/ShellCrash/guardian.log: 10:10:04 INFO: 通用出口 IP=<REDACTED-EXIT-IP>
```

**5) Play 币种属账号侧**

```
人工智能=🤖 AI网页 | support cc=var cc='IN'  ->  priceCurrency":"USD"
```

**6) 账号侧线索（不随 IP）**

```
accounts.google.com  -> hl=en-US
myaccount.google.com -> https://www.google.com/account/about/?hl=en-US
payments.google.com  -> 无国家标记（需登录）
```

**7) 一致性**：12 服务同组同出口，互不打架；但 `gmail.com`/`google.com.hk` 已锁 `🤖 干净出口`(IN)，`drive/docs/meet/chat/myaccount` 随 `🤖 人工智能` 在 IN↔CN 摆动 → 同账号两国家；Play 币种任何出口都改不动。

## 建议（可直接执行的完整命令，标明风险等级；不要执行）

**[A] 低风险·推荐** — `🤖 人工智能` 固定指向 `🤖 AI网页`（13 候选+自愈），别指 `🚀 手动切换`（仅改运行时，重启失效）：

```sh
curl -s -X PUT -H "Authorization: Bearer $(sed -n 's/^secret=//p' /etc/ShellCrash/configs/ShellCrash.cfg|head -1)" \
  -H 'Content-Type: application/json' -d '{"name":"🤖 AI网页"}' \
  "http://127.0.0.1:9999/proxies/%F0%9F%A4%96%20%E4%BA%BA%E5%B7%A5%E6%99%BA%E8%83%BD"
```

**[B] 低风险·推荐** — guardian.sh §3 只把 `🚀 节点选择` 复位到 `♻️ 自动选择`，不校验它实际选中的节点（`is_bad_node` 只看组名），通用池因此停在 CN 节点。追加到 `guardian.sh` §3 后：

```sh
AUTO_EFF=$(grp "♻️ 自动选择")
if is_bad_node "$AUTO_EFF"; then
  if [ "$(put "🚀 节点选择" "🤖 干净出口")" = "204" ]; then
    log "FIX: ♻️ 自动选择 落在坏节点「$AUTO_EFF」，🚀 节点选择 改指 🤖 干净出口"
  fi
fi
```

**[C] 中风险·可选·[A] 不足时** — 硬锁 `🤖 干净出口`（该组仅 1 个 `🇮🇳印度-优化`，单点）：

```sh
sed -i 's#^- DOMAIN-SUFFIX,google.com,🤖 人工智能$#- DOMAIN-SUFFIX,google.com,🤖 干净出口#;
        s#^- DOMAIN,accounts.google.com,🤖 人工智能$#- DOMAIN,accounts.google.com,🤖 干净出口#' \
    /etc/ShellCrash/yamls/rules.yaml
/etc/ShellCrash/task/task.sh hotupdate
```
建议连 `gstatic.com`/`googleusercontent.com`/`googleapis.com` 一并迁（否则静态资源与页面出口分裂）。

**[D] 保持现状** — `google.cn`→DIRECT 属 cn geosite 正常行为；`googleapis.cn`/`gstatic.cn` 已迁 `🤖 干净出口`，不一致但无害。

**[E] 出口改不动** — Play 币种 USD 由账号国家决定，只能在 Play 商店改国家。

**通用判定手法（可复用）**
1. 判「服务方自己」的地理：优先 ①服务页/错误页内的国家标记 ②`Location` 里的国家域名/参数；免鉴权端点（`cdn-cgi/trace`）只证 CDN 归属。
2. 把「同一时刻的出口节点」与判定绑定采样，否则漂移会让结论串台；出口取 `/connections` 的 `chains`，勿用 ipify。
3. 测 302 必须 GET，勿用 `-I`：`curl -s -m 15 -x http://127.0.0.1:7890 -o /dev/null -w '%{redirect_url}' URL`。
4. 模板

```sh
S=$(sed -n 's/^secret=//p' /etc/ShellCrash/configs/ShellCrash.cfg|head -1)
for i in $(seq 1 10); do
  N=$(curl -s -H "Authorization: Bearer $S" "http://127.0.0.1:9999/proxies/<组名>" | grep -oE '"now":"[^"]*"')
  CC=$(curl -s -m 20 -x http://127.0.0.1:7890 '<服务方国家标记URL>' | grep -aoE "var cc='[A-Z]{2}'" | head -1)
  R=$(curl -s -m 15 -x http://127.0.0.1:7890 -o /dev/null -w '%{redirect_url}' '<被测URL>')
  echo "$i $N $CC $R"; sleep 8
done
```

TASK_RESULT: PASS 12 服务同属 `🤖 人工智能`、彼此不打架，但该组指向 CN 节点致 IN/CN 摆动；Play 币种 USD 属账号侧。
