# PROGRESS — 客户端网络排障

> **一句话**：PC 客户端（Chrome / Google / Gemini）经代理访问境外服务的排障台账。
>
> 本文件是本仓库**唯一**的进度台账（追加式批次日志）。
> 规则正本见 [docs/DOC-RULES.md](docs/DOC-RULES.md) 与 [docs/MAINTENANCE.md](docs/MAINTENANCE.md)。
> 拆分自原单文件 `PROGRESS.md`（2026-10-20 之前的 AX3000T 联合调优记录）。

---

# 2026-10-19 第四轮：Chrome 扩展安装 / Google 下载修复

## 根因
- Chrome 155 的 LNA 把 mihomo fake-IP（198.18.0.0/15、fc00::/16）判为**本地网络** →
  Web Store 安装弹窗拉扩展图标被 `ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS` 拦截 →
  显示 `Image decode failed`。
- 手机 Play 更新转圈：Redir 只代理 TCP，QUIC 直连逃逸 + 下载 CDN 经节点超时。

## 已完成变更
- [x] `fake_ip_filter` 增加 16 条 Google 域（让这些域解析真实 IP，规避 LNA）。
- [x] `/etc/quicguard.nft`（`table inet quicguard`，prerouting priority -150）阻断 fake-IP 段 UDP 443/8443。
- [x] Play CDN 改为**按目标 IP 分流**：`IP-CIDR,203.208.32.0/19` + `IP-CIDR6,2401:3800::/32` → 直连；
      撤销早期"整段域名直连"（会把海外 CDN 也逼上直连）。
- [x] `/etc/googlecn.nft`（priority -105）把 LAN→Google 国内边缘段 TCP 80/443 提前重定向到 :7892，
      让域名规则生效（Gemini 地区限制的另一半原因）。
- [x] 全部文件进 sysupgrade 保留清单。

## 状态: 已完成

---


---

# 2026-10-20 第八轮-B：Play/Gemini 修复态复核（只读，结论=不需要重启）

## 复核结果（全部只读验证，无写操作）
- `nft list table inet googlecn` → **已加载**（priority dstnat -5 = -105，早于 ShellCrash -100）；
  `quicguard` 已加载（priority mangle，含 203.208.32.0/19 与 2401:3800::/32 的 UDP reject）。
- `/etc/rc.local` 已含两条 `nft list table ... || nft -f ...` 开机加载语句。
- `/etc/sysupgrade.conf` 含 `/etc/googlecn.nft`、`/etc/quicguard.nft`、`fake_ip_filter`、
  `yamls`、`ai-rules-update.sh`、`ai-api-check.sh`、`reorder-groups.sh`、`auto-update.sh`、
  `rules-mid.sh` → 全部文件可跨升级/重启保留。
- 运行配置 `/tmp/ShellCrash/config.yaml` 的 `fake-ip-filter` 实含 19 条 Google 域，
  末两条为 `+.xn--ngstr-lra8j.com`、`+.googlevideo.com`（**运行态已生效**，非仅文件）。
- `rules.yaml` 与 `ai-rules-update.sh` 均为 `IP-CIDR,203.208.32.0/19,🎯 全球直连` /
  `IP-CIDR6,2401:3800::/32,🎯 全球直连`（**不带 no-resolve**，与最终方案一致）。
- DNS 验证：`rr3.sn-ni57rn76.xn--ngstr-lra8j.com` → `2401:3800:4002:2::12`（真实 IP，非 fake-IP）。

## 实时连通性（经 127.0.0.1:7890）
| 目标 | 结果 |
|---|---|
| `rr3.sn-…xn--ngstr-lra8j.com`（Play CDN） | 404 / 0.19s ✅ |
| `dl.google.com` Range 3MB | 206 / 3,000,001B / 7.0MB/s ✅ |
| `play.googleapis.com` | 404 / 0.51s（根路径正常） ✅ |
| `gemini.google.com` 强制 `--resolve` 到 203.208.33.21 | 200 / 0.99s ✅（googlecn 路径生效） |

注：路由自身 curl 对 CDN 主机报 `CN does not match` 属严格证书校验，与网络无关，加 `-k` 即通。

## 结论
**不需要重启路由器。** 所有修复（nft 表 + fake_ip_filter + 规则）均已在运行态生效并通过
端到端连通性验证。若 Play 仍显示"等待中"，是手机端队列卡死，处置为：强制停止 Play 商店
→ 重新打开 → 下载列表点"重试"（或开关一次飞行模式），不是重启路由器。

## 状态: 已完成

---


---

