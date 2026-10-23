#!/bin/bash
# verify-gemini.sh — 复测 Gemini 页面（Chrome LNA 修复是否生效）+ 路由器侧检查
# 用全新临时 profile 起一个带调试端口的 Chrome（不碰用户自己的浏览器）
#
# 通用用法（所有本机相关参数都用环境变量覆盖，仓库里不写真实值）：
#   SSID_ROUTER='我的路由器WiFi' \
#   SSID_HOTSPOT='我的手机热点' \
#   ROUTER_IP=192.168.1.1 \
#   bash tools/verify-gemini.sh
#
# 找不到 Chrome 时会明确报错 —— 用 CHROME 环境变量指定 chrome.exe 的完整路径。
set -u

# ── 路径转换小工具（Git Bash 里 POSIX 路径与 Windows 路径互转）──────────────
to_win() {  # POSIX/混合路径 → Windows 路径
  if command -v cygpath >/dev/null 2>&1; then cygpath -w "$1"; else printf '%s\n' "$1"; fi
}
to_posix() {  # Windows 路径 → POSIX 路径
  if command -v cygpath >/dev/null 2>&1; then cygpath -u "$1"; else printf '%s\n' "$1"; fi
}

# ── 本机参数（默认值是占位符/示例，公开仓里不写真实值）────────────────────
# 路由器 WiFi 名 / 手机热点名：真实 SSID 属于设备标识，公开仓不写。
SSID_ROUTER="${SSID_ROUTER:-YOUR_ROUTER_SSID}"
SSID_HOTSPOT="${SSID_HOTSPOT:-YOUR_HOTSPOT_SSID}"
# 路由器 LAN 地址：默认给的是最常见的示例网关，按你的网络改。
ROUTER_IP="${ROUTER_IP:-192.168.1.1}"
# CDP 调试端口：临时实例专用，避免和你日常 Chrome 的端口冲突。
CDP_PORT="${CDP_PORT:-9223}"
# Chrome 可执行文件：留空 = 自动探测（常见安装路径 → where → 注册表）。
CHROME="${CHROME:-}"

# 临时 profile 目录：放系统临时目录下，跑完即删。
# TMPDIR/TEMP 可能是 POSIX 路径（Git Bash 的 /tmp）或 Windows 路径，先归一到 POSIX。
# 带 PID：两个并发复测会话不会互相 rm -rf 对方的 profile。
TMP_BASE="$(to_posix "${TMPDIR:-${TEMP:-/tmp}}")"
TMPPROF="$TMP_BASE/verify-prof-$$"
TMP_SHOT="$TMP_BASE/verify-shot-$$"

die() {
  echo "!! $*" >&2
  echo "   临时 profile 保留在：$TMPPROF" >&2
  echo "   临时截图目录保留在：$TMP_SHOT" >&2
  netsh wlan connect name="$SSID_HOTSPOT" >/dev/null 2>&1 || true
  exit 1
}

HERE="$(cd "$(dirname "$0")" && pwd)"
# 兄弟仓（路由器系统仓）目录名：默认与本仓同级摆放，可用 SIBLING_REPO 覆盖
SIBLING_REPO="${SIBLING_REPO:-AX3000TOpenwrt}"
# askpass.sh 归兄弟仓所有，可用 ASKPASS 覆盖到具体文件
export SSH_ASKPASS="${ASKPASS:-$HERE/../../$SIBLING_REPO/recovery/local-tools/askpass.sh}" \
       SSH_ASKPASS_REQUIRE=force DISPLAY=:0
# 路由器侧检查脚本（已被 ai-api-check.sh 取代，归档保留），可用 VERIFY_FIX 覆盖
VERIFY_FIX="${VERIFY_FIX:-$HERE/../../$SIBLING_REPO/recovery/archive/verify-fix.sh}"

# ── 定位 Chrome：常见安装路径 → where → 注册表 App Paths ────────────────────
detect_chrome_win() {
  local c reg_keys="HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe
HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe
HKEY_CURRENT_USER\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe"

  for c in "/c/Program Files/Google/Chrome/Application/chrome.exe" \
           "/c/Program Files (x86)/Google/Chrome/Application/chrome.exe" \
           "$(to_posix "${LOCALAPPDATA:-/nonexistent}")/Google/Chrome/Application/chrome.exe" \
           "$HOME/AppData/Local/Google/Chrome/Application/chrome.exe"; do
    [ -f "$c" ] && { to_win "$c"; return 0; }
  done

  c="$(where chrome 2>/dev/null | head -1 | tr -d '\r')"
  [ -n "$c" ] && { to_win "$c"; return 0; }

  while IFS= read -r key; do
    c="$(MSYS_NO_PATHCONV=1 reg query "$key" /ve 2>/dev/null \
         | sed -n 's/.*REG_SZ *//p' | tr -d '\r')"
    [ -n "$c" ] && { printf '%s\n' "$c"; return 0; }
  done <<EOF
$reg_keys
EOF
  return 1
}

if [ -z "$CHROME" ]; then
  CHROME_WIN="$(detect_chrome_win || true)"
  if [ -z "$CHROME_WIN" ]; then
    echo "!! 找不到 Chrome（chrome.exe）。" >&2
    echo "   请用 CHROME 环境变量指定完整路径，例如：" >&2
    echo "   CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe' bash tools/verify-gemini.sh" >&2
    exit 2
  fi
else
  CHROME_WIN="$(to_win "$CHROME")"
fi
CHROME_POSIX="$(to_posix "$CHROME_WIN")"
TMPPROF_WIN="$(to_win "$TMPPROF")"
TMP_SHOT_WIN="$(to_win "$TMP_SHOT")"

if [ "$SSID_ROUTER" = "YOUR_ROUTER_SSID" ] || [ "$SSID_HOTSPOT" = "YOUR_HOTSPOT_SSID" ]; then
  echo "!! 请先设置 SSID_ROUTER / SSID_HOTSPOT（本仓不写真实 WiFi 名）。" >&2
  echo "   例：SSID_ROUTER='MyRouter' SSID_HOTSPOT='MyHotspot' bash tools/verify-gemini.sh" >&2
  exit 2
fi

echo "    Chrome      : $CHROME_WIN"
echo "    路由器      : $ROUTER_IP"
echo "    CDP 端口    : $CDP_PORT"

echo "=== [1/5] 切到路由器 WiFi ($SSID_ROUTER) ==="
netsh wlan connect name="$SSID_ROUTER" 2>&1 | tr -d '\r'
for i in $(seq 1 20); do
  sleep 2
  ping -n 1 -w 800 "$ROUTER_IP" >/dev/null 2>&1 && break
done
if ! ping -n 1 -w 1000 "$ROUTER_IP" >/dev/null 2>&1; then
  echo "!! 路由器不可达，终止"; netsh wlan connect name="$SSID_HOTSPOT" >/dev/null 2>&1; exit 1
fi
echo "    路由器可达"

echo "=== [2/5] 路由器侧检查 + 修补 ==="
[ -f "$VERIFY_FIX" ] || die "路由器侧检查脚本不存在：$VERIFY_FIX（用 VERIFY_FIX 指定）"
/usr/bin/ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=12 \
      root@"$ROUTER_IP" "sh -s" < "$VERIFY_FIX" || die "路由器侧检查失败（ssh 退出码 $?）"

echo "=== [3/5] 启动临时 Chrome（带调试端口，全新 profile）==="
rm -rf "$TMPPROF"; mkdir -p "$TMPPROF"
sleep 1
powershell -NoProfile -Command "Start-Process '$CHROME_WIN' -ArgumentList '--remote-debugging-port=$CDP_PORT','--user-data-dir=$TMPPROF_WIN','--no-first-run','--no-default-browser-check','--window-size=1280,800','https://gemini.google.com/app'" 2>/dev/null
CDP_READY=0
for i in $(seq 1 20); do
  sleep 2
  if curl -s -m 3 "http://127.0.0.1:$CDP_PORT/json/version" >/dev/null 2>&1; then CDP_READY=1; break; fi
done
[ "$CDP_READY" = "1" ] || die "CDP 端口 $CDP_PORT 在 40 秒内没有就绪（Chrome 可能没起来）"
echo "    CDP 端口就绪"

echo "=== [4/5] 抓控制台/网络（判断 islands bundle 是否还被拦）==="
CDP_PORT="$CDP_PORT" node "$HERE/cdp.js" 2>&1 | head -60
echo "=== [4b] 截图 ==="
sleep 2
STAMP="$(date +%Y%m%d-%H%M%S)"
SHOT="$HERE/../evidence/gemini-after-$STAMP.png"
SHOT_LATEST="$HERE/../evidence/gemini-after.png"
SHOT_WIN="$(to_win "$SHOT")"
"$CHROME_POSIX" --headless=new --disable-gpu --no-first-run --no-default-browser-check \
  --user-data-dir="$TMP_SHOT_WIN" \
  --window-size=1280,800 --screenshot="$SHOT_WIN" \
  "https://gemini.google.com/app" >/dev/null 2>&1
SHOT_BYTES=0
[ -f "$SHOT" ] && SHOT_BYTES="$(wc -c < "$SHOT" 2>/dev/null | tr -d ' ')"
[ "${SHOT_BYTES:-0}" -gt 0 ] || die "截图没有生成或为 0 字节：$SHOT"
echo "    截图字节: $SHOT_BYTES -> $SHOT"
cp -f "$SHOT" "$SHOT_LATEST" 2>/dev/null || true

echo "=== [5/5] 清理临时 Chrome 并切回热点 ==="
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | Where-Object { \$_.CommandLine -match 'verify-prof|verify-shot' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }" 2>/dev/null
rm -rf "$TMPPROF" "$TMP_SHOT" 2>/dev/null
netsh wlan connect name="$SSID_HOTSPOT" 2>&1 | tr -d '\r'
echo "=== 结束（你自己的 Chrome 没有被动过）==="
