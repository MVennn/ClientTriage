#!/bin/bash
# verify-gemini.sh — 复测 Gemini 页面（Chrome LNA 修复是否生效）+ 路由器侧检查
# 用全新临时 profile 起一个带调试端口的 Chrome（不碰用户自己的浏览器）
set -u
SSID_ROUTER="MVenn"
SSID_HOTSPOT="Xiaomi 17 Pro"
ROUTER_IP="10.0.0.1"
CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"
TMPPROF="C:/Users/SansK/AppData/Local/Temp/verify-prof"
HERE="$(cd "$(dirname "$0")" && pwd)"
# askpass.sh 归 AX3000TOpenwrt 仓所有（同级的兄弟仓），可用 ASKPASS 覆盖
export SSH_ASKPASS="${ASKPASS:-$HERE/../../AX3000TOpenwrt/recovery/local-tools/askpass.sh}" \
       SSH_ASKPASS_REQUIRE=force DISPLAY=:0
# 路由器侧检查脚本（已被 ai-api-check.sh 取代，归档保留）
VERIFY_FIX="${VERIFY_FIX:-$HERE/../../AX3000TOpenwrt/recovery/archive/verify-fix.sh}"

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
/usr/bin/ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=12 \
      root@"$ROUTER_IP" "sh -s" < "$VERIFY_FIX"

echo "=== [3/5] 启动临时 Chrome（带调试端口，全新 profile）==="
rm -rf "$TMPPROF"; mkdir -p "$TMPPROF"
sleep 1
powershell -NoProfile -Command "Start-Process 'C:\Program Files\Google\Chrome\Application\chrome.exe' -ArgumentList '--remote-debugging-port=9223','--user-data-dir=C:\Users\SansK\AppData\Local\Temp\verify-prof','--no-first-run','--no-default-browser-check','--window-size=1280,800','https://gemini.google.com/app'" 2>/dev/null
for i in $(seq 1 20); do
  sleep 2
  curl -s -m 3 http://127.0.0.1:9223/json/version >/dev/null 2>&1 && break
done
echo "    CDP 端口就绪"

echo "=== [4/5] 抓控制台/网络（判断 islands bundle 是否还被拦）==="
CDP_PORT=9223 node "$HERE/cdp.js" 2>&1 | head -60
echo "=== [4b] 截图 ==="
sleep 2
SHOT="$HERE/../evidence/gemini-after.png"
"$CHROME" --headless=new --disable-gpu --no-first-run --no-default-browser-check \
  --user-data-dir="C:/Users/SansK/AppData/Local/Temp/verify-shot" \
  --window-size=1280,800 --screenshot="$SHOT" \
  "https://gemini.google.com/app" >/dev/null 2>&1
ls -la "$SHOT" 2>/dev/null | awk '{print "    截图字节:", $5}'

echo "=== [5/5] 清理临时 Chrome 并切回热点 ==="
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | Where-Object { \$_.CommandLine -match 'verify-prof|verify-shot' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }" 2>/dev/null
rm -rf "$TMPPROF" "C:/Users/SansK/AppData/Local/Temp/verify-shot" 2>/dev/null
netsh wlan connect name="$SSID_HOTSPOT" 2>&1 | tr -d '\r'
echo "=== 结束（你自己的 Chrome 没有被动过）==="
