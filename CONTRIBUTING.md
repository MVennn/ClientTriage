# 参与贡献

> **一句话**：怎么跑工具、加证据守什么规矩、提交前跑什么。

## 跑工具

```bash
# 清 Chrome 的地区种子（必须先完全退出 Chrome）
node tools/clear-chrome-region.js

# 复测 Gemini 页面 + 路由器侧检查
SSID_ROUTER=你的WiFi名 SSID_HOTSPOT=你的热点名 bash tools/verify-gemini.sh
```

两个脚本都**有副作用**，跑之前看清楚 `docs/SECRETS.md` 与本仓 README 的「已知坑」。

## 加证据

- 证据放 `evidence/`，**按来源分目录**（如 `evidence/agents/`）。
- 证据里出现真实域名 / IP / MAC / 账号 → 按 [docs/SECRETS.md](docs/SECRETS.md) 的 P2 一节脱敏。
- 描述性内容（"某出口被 Google 判为 CN"）**逐字保留** —— 那是当时的事实。

## 方法与复现环境分离（写文档时守住这条）

- **方法**用通用措辞：怎么判断是客户端问题还是路由器问题、怎么抓 CDP 控制台。
- **复现环境**（哪台设备、哪个 IP 布局）单列一节，不要散落在方法描述里。
  详见 `docs/DOC-RULES.md` §6。

## 硬规矩

- **不要**改 `third-party/`（vendored 上游）。
- 改 `.sh` 必须**保持 LF 换行** —— CRLF 在 bash 下会直接报错。
- 改完跑：

```bash
sh -n tools/*.sh
node --check tools/*.js
python3 tools/check-docs.py
```

## 提交信息

Conventional Commits；**按对象拆行**。
