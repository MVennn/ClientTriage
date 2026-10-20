结论：YouTube 主站（www/m/music.youtube.com）**不踩 Google 判 CN 的坑**（自身地区标记恒为 gl=US/IN，无 google.com.hk / cn.youtube.com / gl=CN|HK 跳转），但 **YouTube Music 会因同一 CN 判定被服务端拒**（"not available in your area"）；当前 rules.yaml 已把 YouTube 全族改指 🤖 干净出口(印度)且实测生效，唯一残留缺口是 youtubei.googleapis.com 的干净出口规则被 googleapis.com 遮蔽。

## 证据

**1) 实际分流（客户端 10.0.0.x，/connections 实测，非规则表推断）**
```
www.youtube.com          DomainSuffix youtube.com          → 🤖干净出口 → 🇮🇳印度-优化
m.youtube.com            DomainSuffix youtube.com          → 🤖干净出口 → 🇮🇳印度-优化
music.youtube.com        IPCIDR 74.125.0.0/16              → 🤖干净出口 → 🇮🇳印度-优化
googlevideo.com          DomainSuffix googlevideo.com      → 🤖干净出口 → 🇮🇳印度-优化
i.ytimg.com              DomainSuffix ytimg.com            → 🤖干净出口 → 🇮🇳印度-优化
www.youtube-nocookie.com DomainSuffix youtube-nocookie.com → 🤖干净出口 → 🇮🇳印度-优化
youtubei.googleapis.com  DomainSuffix googleapis.com(226)  → 🤖人工智能→🚀手动切换→🇭🇰香港-优化 ← 非干净
```
出口 IP=<REDACTED-EXIT-IP>（由 www.youtube.com 回 `"gl":"IN"` 反证）。

**2) YouTube 自己的地区判定**
```
干净出口(印度) : www.youtube.com → "gl":"IN","countryCode":"IN"
                 music.youtube.com → <title>YouTube Music</title>（Chrome UA，7/7）
Google 判 CN 的出口（UA=Mozilla/5.0，出口 IP 前后夹测锁定未变）:
  <REDACTED-EXIT-IP> → <title>YouTube Music is not available in your area</title> ×5
  <REDACTED-EXIT-IP> ×3 | <REDACTED-EXIT-IP> ×1 | <REDACTED-EXIT-IP> ×6/9
  同批出口的 www.youtube.com 恒 "gl":"US"，无 CN/HK 跳转
```
→ 主站判定与 Google 的 CN 判定**解耦**；仅 YouTube Music 的服务端地区闸门会因 CN 判定关闭。

**3) 第三方 GeoIP 对比**
```
<REDACTED-EXIT-IP>    ip-api=JP  Google=CN  YouTube gl=US  YT-Music=BLOCKED
<REDACTED-EXIT-IP>   ip-api=HK  Google=CN                 YT-Music=BLOCKED(多数)
<REDACTED-EXIT-IP> ip-api=IN  Google=IN  YouTube gl=IN  YT-Music=OK
```

**4) 规则遮蔽：youtubei 的干净出口规则是死规则**
```
/etc/ShellCrash/yamls/rules.yaml
 235: - DOMAIN-SUFFIX,googleapis.com,🤖 人工智能     ← 先匹配先生效
 265: - DOMAIN,youtubei.googleapis.com,🤖 干净出口   ← 排在其后，永不生效
运行态 rules index：226 googleapis.com→🤖人工智能，252 youtubei→🤖干净出口
（🌍国外媒体 的 youtube 块 index 3059-3073、🚀节点选择 的 3327+ 亦已成死规则）
```

**5) 附带运行态告警（本专项外，但当前代理已中断）**
```
10:43:16 error msg="rules[16] [DOMAIN-SUFFIX,i.google.dev,] error: format invalid" → 自定义配置校验失败
dmesg: oom-kill: task=CrashCore (anon-rss 77240kB)
现状: /tmp/ShellCrash/CrashCore 符号链接缺失 + /etc/ShellCrash/.start_error 存在
      → mihomo 未运行（7890/9999/1053 均未监听）
```

## 建议（风险等级；均未执行）

1. 【高｜恢复服务】代理已停，先补链接与清标记再启动：
   `ln -sf /etc/ShellCrash/CrashCore.raw /tmp/ShellCrash/CrashCore && rm -f /etc/ShellCrash/.start_error && sh /etc/ShellCrash/start.sh start`
   风险：重载全部分流并可能重拉订阅；先确认 rules.yaml 无空目标规则（当前 295 条、无空目标）。
2. 【中｜修规则脚本】把 youtubei 提到 googleapis.com 之前（只写 rules.yaml，不动运行态）：
   `sed -i 's|^\(echo "- DOMAIN-SUFFIX,googleapis\.com,\${AI_GROUP}"\)$|echo "- DOMAIN,youtubei.googleapis.com,$CL"\n\1|' /etc/ShellCrash/ai-rules-update.sh && sh /etc/ShellCrash/ai-rules-update.sh`
   风险：该脚本正被并发改动（10:23→10:44 两次重写），先备份；生成后需重启才生效。
3. 【低｜YouTube 保持现状】主站不受影响无需改；music.youtube.com 必须与 Google 系同出口（现 E 段已覆盖），否则 YT Music 报地区不可用。
4. 【中｜视频 CDN】googlevideo.com 现也被 DomainSuffix 改指印度、绕远；sniffer 的 skip-domain 只挡 SNI 嗅探，fake-ip 仍能还原域名，故规则照样命中。若要「CDN 按 IP 分流」原设计，需给 googlevideo.com 单独规则指 DIRECT/专用组。
5. 【可复用手法】判断服务方自身地理判定：①同一域名用「出口 IP 前后夹测」锁定出口再下结论；②带 SNI 走域名规则、无 SNI 的纯 IP 走 IP 规则 → 可对同一后端做单变量 A/B；③优先级：服务自有页面里的国家标记（gl/countryCode/title/错误码）> 服务自身地区重定向 > 第三方 GeoIP。

TASK_RESULT: PASS YouTube 主站不踩 CN 坑、YouTube Music 会踩；全族已实测走干净出口(印度)，仅 youtubei.googleapis.com 规则被遮蔽待修；另发现 mihomo 已被 OOM 杀掉且当前代理中断。
