# agent-pc-side — Windows PC 侧 Gemini「不支持此国家/地区」排查（只读）

状态: 已完成
范围: 只读排查本机 Chrome / 网络 / 账号层，区分「网络层故障」还是「客户端·账号问题」。

## 结论
PC 端 Chrome 配置本身干净（Secure DNS 关、无代理、无 hosts、无 VPN 扩展）→ 不是客户端设置问题。
报错来自**网络层的出口 IP 地理归属**：Google 官方把「Mainland China (Workspace only)」列在
Gemini 支持国家列表里（个人账号不可用），而 Google 把本机这条连接的出口（<REDACTED-EXIT-IP>，
AS30058 FDCservers，第三方库均标 Tokyo/JP）判成 HK/CN —— 证据：`www.google.com` 10/10 次
302 到 `https://www.google.com.hk/url?...&hl=zh-CN&pref=hkredirect&pval=yes`，
`www.google.com/ncr` 最终域名为 `https://www.google.com.hk/`。
且排查期间 Google 流量出口在 JP/HK/DE/GB 之间漂移，Google 已开始对该 IP 弹
`www.google.com/sorry/index`（异常流量 CAPTCHA）。账号侧另有次要条件：账号未设置国家/地区。

## 关键证据
| 结论 | 命令输出 |
|---|---|
| Secure DNS 关闭 | Local State: `"dns_over_https": {"mode": "off"}`; Preferences: `dns_over_https=null` |
| Chrome 无代理 | Preferences `proxy=null`; Local State `proxy=null`; HKLM/HKCU 无 Chrome 策略; 系统 `ProxyEnable=0x0`; 无 http_proxy 环境变量 |
| hosts 干净 | 仅 Docker 三行，无 google/gemini |
| 无 VPN 类扩展 | 8 个扩展: Lime新标签页 / AdGuard / Adobe / DarkReader / Tampermonkey / ACG Helper / Read Frog(沉浸式翻译) / Google Hangouts |
| 地区报错是**前端渲染** | gemini.google.com 返回 784655 字节 HTML，其中 "not available in your country"/"unsupported"/"国家"/"地区"/"不可用" 命中数 **全为 0** → curl 拿到 200 属假阴性 |
| Google 判定本机为 HK/CN | `www.google.com` → 302 `https://www.google.com.hk/url?sa=p&hl=zh-CN&pref=hkredirect&pval=yes`（10/10）；`ncr` → final `https://www.google.com.hk/`；v4/v6 均同 |
| 第三方库却标日本 | ip-api / ip.sb / ip.guide 均报 <REDACTED-EXIT-IP> = Japan/Tokyo (AS30058 FDCservers, ARIN/US) |
| 出口国家漂移 | 同一 URL(api.ipify.org) 先后返回 <REDACTED-EXIT-IP>(JP) / <REDACTED-EXIT-IP>(HK) / <REDACTED-EXIT-IP>(DE) / <REDACTED-EXIT-IP>(GB) |
| mihomo 实时链路不一致 | /connections 同时刻: gemini/accounts→`🇯🇵 日本-优化\|🤖 AI网页\|🤖 人工智能`; mtalk→`🇭🇰 香港-优化\|🚀 手动切换\|🤖 人工智能`; dns.google→`🇩🇪 德国-优化\|🚀 手动切换\|🚀 节点选择`; 另一次 gemini→`🇭🇰 香港WAP-优化\|🚀 手动切换\|🤖 人工智能` |
| 分组选择会变 | 01:2x `🤖 人工智能=🚀 手动切换`(→`🇬🇧 英国-优化-GPT`)；01:29 固定为 `🤖 AI网页`→`🇯🇵 日本-优化` |
| Google 已风控 | `gemini.google.com` → 302 `https://www.google.com/sorry/index?continue=...` |
| 账号未设国家 | myaccount 个人资料: `语言 简体中文 / 住址 未设置 / 工作地址 未设置 / 其他地址`；账号 2021-02-03 创建 |
| Google 官方名单 | Gemini 支持国家列表含 `Mainland China (Workspace only)`，含 Hong Kong / Japan |

## 限制（如实说明）
- 无法在独立临时 profile 复现**已登录**的 Gemini 应用：复制 profile 后 Chrome 会丢弃
  v20（app-bound 加密）SID cookie（1368 → 13 行，SID 消失），因此拿不到用户看到的报错原文。
- 已登录场景 headless 截图输出全黑（无 GPU 绘制），真实 profile 的 DOM 快照（831KB）只到
  账号芯片（ssanskritt@gmail.com / Venn M），**未出现**任何国家报错文案。
- 对默认 profile 的影响：曾用 `--user-data-dir=<真实 User Data>` 跑过 3 次 headless
  Chrome（dump-dom×2 + screenshot×1）。仅产生缓存/历史写入，未改设置/Cookie/扩展/站点数据。
  之后所有渲染均改用独立临时 profile。

## 给用户的可操作步骤（不代替用户执行）
见最终报告；要点：路由器侧固定单一日本节点（把 URLTest 改为固定节点）、换掉 AS30058
廉价 VPS 出口、补齐 googleapis/gstatic/googleusercontent 规则、用户侧清 Gemini 站点数据
+ 无痕测试 + 临时停用 AdGuard/Tampermonkey/Read Frog + 查 myaccount/payments 国家。
