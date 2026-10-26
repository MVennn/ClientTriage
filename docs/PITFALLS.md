# 踩坑总汇

> **一句话**：本仓踩过的坑，每条都写清「**为什么错**」和「**下次怎么避**」——
> 大部分是**测量方法本身**的坑，不是配置的坑。

排某个具体现象怎么查，看 [TROUBLESHOOTING.md](TROUBLESHOOTING.md)；
根因机制看 [LNA-FAKE-IP.md](LNA-FAKE-IP.md)。

> **地址约定**：本篇命令里的 `10.0.0.1` / `10.0.0.1:7890` 是**示例**的路由器 LAN 地址与代理 mixed 口，
> **换成你自己网络里的地址**再跑；命令原文保持可直接复制执行。

---

## 1. Chrome 完全退出前改地区种子会被覆盖

**现象**：脚本报告「已清除 `variations_country`」，重开 Chrome 又是 `cn`。

**为什么**：Chrome 退出时会**重写** `Local State`（把内存里的 variations 状态落盘）。
运行中改文件，等于改完又被退出时的那次写回抹掉。

**怎么避**：

1. 完全退出 Chrome（**含后台进程**，托盘图标也要退）；
2. 再跑 `node tools/clear-chrome-region.js`；
3. 重新启动 Chrome，让它重新抓取 seed。

脚本每次写前留 `.bak-region-<时间戳>` 备份，出问题就把它改回去。

> 种子**长期有效不了**：Chrome 更新会重写 `permanent_consistency_country`
> （它按 Chrome 版本号绑定）。升级后要再清一次 —— 这是**常态**，不是故障。

## 2. CDP 端口占用

**现象**：`curl http://127.0.0.1:9223/json/version` 永远不通；
`tools/cdp.js` 打印「没有可用的 page target」。

**为什么**：9223 已被别的 Chrome 占了，新实例起不来；
或者实例起来了但 `--remote-debugging-port` 没生效（日常那个 Chrome 没带这个参数）。

**怎么避**：

- **永远用临时端口 + 独立 profile 起实例**，别去接管日常那个 Chrome：

  ```bash
  "C:/Program Files/Google/Chrome/Application/chrome.exe" \
    --remote-debugging-port=9223 \
    --user-data-dir="$TEMP/verify-prof" \
    --no-first-run --no-default-browser-check \
    --window-size=1280,800 "https://gemini.google.com/app"
  ```

- 起之前先确认端口空着：`netstat -ano | findstr :9223`；
- `tools/cdp.js` 的默认端口是 **9222**，用 `CDP_PORT=9223` 覆盖；
- 端口不通时先看是不是 profile 目录被上一个实例占着 —— 换一个 `--user-data-dir` 即可。

## 3. headless 截图与真实浏览器的差异

**现象**：headless 截出来是**全黑图**，或者复制 profile 后**登录态没了**。

**为什么**（两件独立的事）：

| 现象 | 原因 |
|---|---|
| 截图全黑 | 无 GPU 绘制环境下 headless 不一定出图；实测评测机 headless 输出全黑 |
| 登录态没了 | 复制真实 profile 时，Chrome 会丢弃 **app-bound 加密（v20）的 SID cookie** —— 实测 1368 行 cookie 复制后只剩 13 行，`SID` 消失 |

**怎么避**：

- 截图只当**辅助**，判据用 DOM 快照 + 控制台（见 [LNA-FAKE-IP.md](LNA-FAKE-IP.md) §5.1）；
- 要复现**登录态**场景就别复制 profile，用真实 profile 起实例（不 headless），
  并注意别写脏它的缓存；
- 需要完全隔离的对照实验时，明确写清「**本结论不覆盖登录态**」。

> 另有一个 Windows 特有的坑：跑 `chrome.exe --version` 时，Windows 版 Chrome **忽略该参数并启动默认 profile 的 Chrome**。
> 排查期间要恢复「任务开始前 Chrome 未运行」的状态。

## 4. 判 Google 的 302 必须用 GET，不能用 HEAD

**现象**：`curl -I` 测出来是 200 / 无跳转，浏览器却一直被重定向到 `google.com.hk`。

**为什么**：HEAD 请求的响应处理路径与 GET 不同，**测不出服务方的地区重定向**。

**怎么避**：一律用 GET，并显式取 `redirect_url`：

```sh
curl -s -m 15 -x http://127.0.0.1:7890 -o /dev/null -w '%{redirect_url}\n' https://www.google.com/
```

判 CN 的形态是 `302` → `https://www.google.com.hk/url?...&hl=zh-CN&pref=hkredirect`。

## 5. 测 API 必须走路由器代理 `10.0.0.1:7890`，不能用路由器自身的 curl

**现象**：在路由器上直接 `curl` 某个 CDN 主机报 `CN does not match`；
或者在路由器上解析域名得到一堆 Meta / Facebook 的 IP（明显是污染）。

**为什么**：

- 路由器自身 curl 走的是**直连解析路径**（`direct-nameserver`），不经过 mihomo 的 fake-IP；
  证书里的 CN 与实际解析结果对不上 → 严格证书校验报错；
- 那条直连解析路径本身就是被污染的。

**怎么避**：

- 严格证书校验报错只是**证书链对不上**，不是网络不通 —— 加 `-k` 再看能不能连通，
  能连上就说明网络没问题，别把它当成故障；
- **要测「客户端视角」，就在客户端侧经 `10.0.0.1:7890` 测**：

  ```sh
  curl -s -m 15 -x http://10.0.0.1:7890 -o /dev/null -w '%{http_code} %{redirect_url}\n' https://www.google.com/
  ```

- 路由器的 `127.0.0.1:7890` 只在路由器本机上有意义。

## 6. 出口 IP 的地理标签不可信

**现象**：同一个节点，第三方 GeoIP 说日本，Google 说中国；换节点查 Google 判定却全是中国。

**为什么**：**服务方看的是 IP 的注册地，不是机房位置。**
实测某个机场的 28 个出口里，**27 个被 Google 判为 `cc=CN`** ——
包括美国机房段、德国机房段、英国机房段的出口（机房看着在境外，注册地却被判为中国）；
只有一个注册地在印度的出口判 `IN`。
而第三方库（ip-api / ip.sb / ip.guide）**全部**把它们标成 JP/SG/HK/CA/UK/TW。

> 出口 IP 与节点名属 P2 级内部标识，正文用占位符；原始逐条数据在
> `evidence/agents/agent-ip-reputation.md`（历史审计分片，原文保留）。

**怎么避**：

1. **只用服务方自己的国家标记判定**，不要用第三方 GeoIP：
   - Google：`support.google.com/gemini/answer/13575153` 页面里的 `var cc='XX'`；
   - OpenAI：`api.openai.com/v1/models` 的 HTTP 码（401 = 放行，
     403 + `unsupported_country_region_territory` = 被地区拦）；
   - Meta：页面内 `["PolarisSiteData",[],{"country_code":"CN"`；
   - YouTube：`"gl":"US"` / `set-cookie: countryCode=XX` / `steamCountry=XX`。
2. **判据优先级**：服务页内的国家标记 ＞ 服务自身的地区重定向 ＞ 第三方 GeoIP。
3. **注意 `sorry/index` 不是可复现的信号**：实测**任何**出口请求
   `https://www.google.com/sorry/index` 都返回 429 + 同一张 "unusual traffic" 页，
   连干净出口也一样 —— 不要用它当封禁判据。
4. `ipinfo.io/json` 对这类出口**恒返回 429**；要用就换 `ipwho.is`。

## 7. 节点健康探测必须用大页面

**现象**：某个节点测 API 端点一直是 0.9 秒，页面却要 22 秒甚至 25 秒超时。

**为什么**：小响应端点只测握手，不测大文件下载。
实测订阅给的印度入口 `p6`：`gemini.google.com`（784 KB）实测 **22.3 秒 / 25 秒超时 / 1.5 秒 / 1.8 秒**，
**长尾极重**；但同一节点的小响应 API 端点始终 0.9 秒 —— 用 API 端点做的健康探测**根本抓不到它**。

**怎么避**：

- 健康探测换成**大页面**并截断下载，只测总量与耗时：

  ```sh
  curl -s -m 20 -x http://10.0.0.1:7890 -o /dev/null \
       --max-filesize 131072 -w '%{size_download} %{time_total}\n' https://gemini.google.com/
  ```

- 探测目标要和用户真正在用的服务**是同一个**（Google 就用 Google 的页面，
  不要拿一个通用探针 URL 代替）。

## 8. mihomo 连接复用导致测到旧出口

**现象**：切了节点再测，出口 IP 还是上一个节点的。

**为什么**：mihomo 会**复用**到同一 host 的旧连接；`GET /connections` 能看到当时实际走的链。

**怎么避**：

- 取出口以 **`/connections` 的 `chains` 末环**为准，不要用 ipify 反推；
- 要用 ipify 反推，就在请求**前后各测一次**，两次相同才认这个样本；
- 换节点后等旧连接老化，或用不同 host 采样。

## 9. 守护进程每 5 分钟复原策略组

**现象**：手动切组做扫描，几分钟后组自己跳回去了；用户的 Gemini 被打断。

**为什么**：路由器的 `guardian.sh`（cron `*/5`）按自己的判据把 `🚀 节点选择` 复位到
`♻️ 自动选择`，把 `🤖 人工智能` 复位到 `🤖 AI网页`。
它当时写的判据是「出口名含香港」—— 而日本 / 新加坡 / 加拿大 / 德国 / 英国**同样被 Google 判 CN**，
于是它把这些坏出口也当成合法选择留下。

**怎么避**：

- **不要用「切组 + 轮询」的方式做全量扫描**；用只读接口：
  `GET /proxies/<节点>/delay` 或 `GET /connections` 看链路；
- 扫描前先确认守护的判据与当前现实一致（判据的正本在 `ShellcrashRules` 仓）。

## 10. `GET /proxies/<节点>/delay` 不返回 HTTP 状态码

**现象**：想用它判某个节点上 GitHub 是不是 403，测出来是「成功」。

**为什么**：该接口**只返回延迟**，不返回被测站点的 HTTP 状态码；
被测站点返回 403 也算「连得上」，一样计延迟。

**怎么避**：只拿它测**连通性与延迟**；判封锁 / 地区必须用真实的 GET 请求去打服务方。

## 11. 判 Google 地区要整页取，`--max-filesize` 会截掉

**现象**：抓 `support.google.com` 页面搜不到 `var cc='XX'`，变量像是「不存在」。

**为什么**：`cc` 变量在 **1 MB 之后**（整页 1.6 MB），
`--max-filesize` 一截就抓不到。

**怎么避**：整页取下来再 grep：

```sh
curl -s -m 20 -x http://10.0.0.1:7890 'https://support.google.com/gemini/answer/13575153' \
  | grep -aoE "var cc='[A-Z]{2}'" | head -1
```

## 12. busybox 的 `sleep` 不支持小数

**现象**：在路由器上 `sleep 0.3` 报 `sleep: invalid number '0.3'`。

**为什么**：路由器是 busybox，`sleep` 只认整数。

**怎么避**：路由器侧一律用整数秒；需要短间隔就在客户端侧等。

## 13. 规则顺序：先匹配的先生效

**现象**：明明写了一条 `DOMAIN,youtubei.googleapis.com,<干净出口>`，却仍然走通用池。

**为什么**：mihomo **先匹配先生效**。更宽的 `DOMAIN-SUFFIX,googleapis.com` 排在前面，
后面那条**永远不会生效**（实测运行态里 `googleapis.com` 在 index 226、
`youtubei` 在 index 252，252 是死规则）。

**怎么避**：

- 写完规则**在运行态验证**，不要只看文件里的行序：
  `GET /rules` 看实际的 index；
- 精确域名（`DOMAIN`）必须排在对应的 `DOMAIN-SUFFIX` **前面**；
- 这类规则是**生成器产出的**（每周会被自动更新脚本重写），
  要改就改生成器，别直接改产物 —— 否则下次更新就被冲掉。

## 14. 没有 `set -e` 的脚本要逐点检查退出码

**现象**：`verify-gemini.sh` 在路由器侧检查失败、Chrome 没起来、截图没生成时，
仍然打印「结束」，用户把「什么都没做成」当成「复测通过」。

**根因**：脚本只有 `set -u`，关键步骤的失败被忽略。不能直接加 `set -e` ——
脚本里大量 `grep` / 探测是故意允许失败的。

**解法**：加 `die()`，只给关键点加 `|| die`：找不到 Chrome、检查脚本缺失、SSH 失败、
CDP 端口 40 秒未就绪、截图 0 字节。失败时保留临时 profile 并打印路径。

**下次怎么避**：凡是「跑完打印结束」的编排脚本，先问一句「哪一步失败会让结论变假」，
把那几步显式检查。

## 15. 改用户数据前先检查宿主，临时目录带 PID，证据不要覆盖

**现象**：`clear-chrome-region.js` 在 Chrome 运行时照改不误（退出时被整体写回）；
截图固定文件名覆盖上一轮证据；两个并发会话互相 `rm -rf` 对方的临时 profile。

**解法**：改浏览器数据前先查 `chrome.exe`；临时目录带 `$$`；
截图按时间戳命名并同步一份稳定名（文档引用仍然有效）。

**下次怎么避**：凡是写用户目录或截图取证的工具，三件事缺一不可 ——
宿主状态检查、可并发的临时路径、不覆盖的证据命名。

## 16. 凭据扫描的占位符不能整行放行

**现象**：`tools/check-secrets.py` 对「示例与真值同一行」完全失明。

**根因**：`PLACEHOLDER` 命中后整行 `continue`。行内出现 `example.com` / `<...>` /
`YOUR-` 时，同一行的真 token 不会被报。

**解法**：只豁免匹配片段本身（`m.group(0)`），示例 URL 仍放行。

## 17. 复测脚本失败时留下的临时 Chrome，会让下一次复测「连到旧实例」

- **现象**：第一次复测失败后，第二次的控制台/网络抓取全部来自上一次的旧页面，结论完全错。
- **根因**：`die()` 只切回热点、不杀临时 Chrome；残留实例继续占着 CDP 端口，
  下次的 `/json/version` 打在它身上直接返回就绪，`cdp.js` 连的也是它。
- **解法**：失败路径和正常路径共用同一个清理函数（按临时 profile 目录名匹配进程）；
  启动前先清残留，并显式检查端口是否被**非本脚本**的实例占用。
- **验证**：故意让截图步骤失败，确认临时 Chrome 被清掉、端口释放，再跑一次能连到新实例。

## 18. CDP 客户端不给每条请求加超时，调试口一断就永久挂起

- **现象**：Chrome 被杀或崩溃后，`cdp.js` 一直不退出，只能手动结束进程。
- **根因**：`send()` 返回的 Promise 只由 message 回调 settle；连接断开时既没有
  `close` 监听也没有超时。
- **解法**：每条请求带超时（`Promise.race` 或定时器 + reject），监听 `close`/`error`
  并把所有挂起请求 reject；启动时检测运行环境（Node 22+ 才有全局 `WebSocket`）。
- **验证**：抓取过程中手动杀掉 Chrome，确认脚本以非零退出而不是挂起。
