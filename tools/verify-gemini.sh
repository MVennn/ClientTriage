#!/bin/bash
# verify-gemini.sh — 复测 Gemini 页面（Chrome LNA 修复是否生效）+ 路由器侧检查
# 用全新临时 profile 起一个带调试端口的 Chrome（不碰用户自己的浏览器）
#
# 用法（所有本机相关参数都用环境变量覆盖，仓库里不写真实值）：
#   bash tools/verify-gemini.sh                # 完整复测（切 WiFi → SSH → 起临时 Chrome → 抓日志 → 截图 → 切回热点）
#   bash tools/verify-gemini.sh --status       # 只读体检：只查本机前置条件，不切 WiFi、不 SSH、不起 Chrome、不写文件
#   bash tools/verify-gemini.sh --help
#
#   SSID_ROUTER='我的路由器WiFi' \
#   SSID_HOTSPOT='我的手机热点' \
#   ROUTER_IP=192.168.1.1 \
#   bash tools/verify-gemini.sh
#
# 退出码：0 成功 / 1 复测失败（含 --status 有 FAIL 项）/ 2 用法错误或前置条件不满足。
# 找不到 Chrome 时会明确报错 —— 用 CHROME 环境变量指定 chrome.exe 的完整路径。
set -u

MODE=run
while [ $# -gt 0 ]; do
  case "$1" in
    --status) MODE=status ;;
    --help|-h) MODE=help ;;
    *)
      echo "!! 未知参数: $1" >&2
      echo "   用法: bash tools/verify-gemini.sh [--status|--help]" >&2
      exit 2 ;;
  esac
  shift
done

# ── 路径转换小工具（Git Bash 里 POSIX 路径与 Windows 路径互转）──────────────
to_win() {  # POSIX/混合路径 → Windows 路径
  if command -v cygpath >/dev/null 2>&1; then cygpath -w "$1"; else printf '%s\n' "$1"; fi
}
to_posix() {  # Windows 路径 → POSIX 路径
  if command -v cygpath >/dev/null 2>&1; then cygpath -u "$1"; else printf '%s\n' "$1"; fi
}

HERE="$(cd "$(dirname "$0")" && pwd)"

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
# 截图保留张数上限：evidence/gemini-after-*.png 只留最近这么多张（见 docs/MAINTENANCE.md §3.2）
KEEP_SHOTS="${KEEP_SHOTS:-10}"

# ── 临时目录：宁可拒绝运行，也不把 rm -rf 拼在根目录上 ──────────────────────
# 下面每一步清理都用 "$TMPPROF"/"$TMP_SHOT"，它们直接拼在 TMP_BASE 后面。
# TMPDIR/TEMP 一旦为空、为 / 或为盘根（Git Bash 的 /c），rm -rf 就会打到系统根上。
tmp_base_ok() {
  [ -n "${1:-}" ] || return 1
  case "$1" in
    /|//) return 1 ;;
    /[A-Za-z]|/[A-Za-z]/) return 1 ;;          # /c 就是 C:\
    /mnt/[A-Za-z]|/mnt/[A-Za-z]/) return 1 ;;
    [A-Za-z]:|[A-Za-z]:/|[A-Za-z]:\\*) return 1 ;;
  esac
  return 0
}

TMP_BASE_RAW="${TMPDIR:-${TEMP:-/tmp}}"
TMP_BASE="$(to_posix "$TMP_BASE_RAW")"
if ! tmp_base_ok "$TMP_BASE"; then
  echo "!! 临时目录不可用：TMPDIR/TEMP = '$TMP_BASE_RAW'（归一后 '$TMP_BASE'）。" >&2
  echo "   本脚本会在这个目录下建临时 profile 并在结束时删除，为空或是根目录时拒绝继续。" >&2
  echo "   请设置 TMPDIR 到真实临时目录（例如 TMPDIR=/tmp）后重试。" >&2
  exit 2
fi
TMP_BASE="${TMP_BASE%/}"
# 带 PID：两个并发复测会话不会互相 rm -rf 对方的 profile，也不会互杀对方的临时 Chrome。
TMPPROF="$TMP_BASE/verify-prof-$$"
TMP_SHOT="$TMP_BASE/verify-shot-$$"

# ── 临时 Chrome 的清理 ──────────────────────────────────────────────────────
# 按命令行里的临时目录名匹配：只动本脚本起的实例，不碰用户自己的 Chrome。
kill_matching_temp_chrome() {
  powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | Where-Object { \$_.CommandLine -match '$1' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }" 2>/dev/null
}
kill_temp_chrome() {        # 只清本进程的（die / 退出钩子用）
  kill_matching_temp_chrome "verify-prof-$$|verify-shot-$$"
}
kill_stale_temp_chrome() {  # 起新实例前清掉所有残留（含上次崩溃留下的），否则会连到旧实例
  kill_matching_temp_chrome "verify-prof-|verify-shot-"
}

WIFI_SWITCHED=0
cleanup() {
  kill_temp_chrome
  rm -rf "$TMPPROF" "$TMP_SHOT" 2>/dev/null
  # 中途异常退出（set -u 撞到未定义变量、Ctrl-C）也要把网切回热点：
  # 否则用户的机器会一直停在路由器 WiFi 上。
  if [ "$WIFI_SWITCHED" = "1" ]; then
    netsh wlan connect name="$SSID_HOTSPOT" >/dev/null 2>&1 || true
    WIFI_SWITCHED=0
  fi
  return 0
}
# INT/TERM 必须 cleanup 后真正退出：bash 收到信号执行完 trap 会从中断处继续，
# 只挂 cleanup 会让 Ctrl-C 停不下来、跑完整段复测误报「通过」。
# EXIT 仍保留兜底（正常退出/意外退出都清理）；INT=130、TERM=143 是 shell 约定退出码。
trap cleanup EXIT
trap 'cleanup; exit 130' INT
trap 'cleanup; exit 143' TERM

die() {
  echo "!! $*" >&2
  echo "   临时 profile: $TMPPROF（退出时自动清理）" >&2
  echo "   临时截图目录: $TMP_SHOT（退出时自动清理）" >&2
  # 残留的临时 Chrome 会占着 CDP 端口，让下一次复测连到旧实例 —— 清理与切网交给 EXIT 钩子。
  exit 1
}

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

resolve_chrome() {  # 设置 CHROME_WIN / CHROME_POSIX；失败返回 1
  if [ -z "$CHROME" ]; then
    CHROME_WIN="$(detect_chrome_win || true)"
    [ -n "$CHROME_WIN" ] || return 1
  else
    CHROME_WIN="$(to_win "$CHROME")"
  fi
  CHROME_POSIX="$(to_posix "$CHROME_WIN")"
  return 0
}

# ── 参数校验 ────────────────────────────────────────────────────────────────
valid_router_addr() {  # IPv4 或简单主机名；空、带空格/引号/分号一律拒绝（会进 ssh 参数与 netsh）
  case "$1" in
    '') return 1 ;;
    *[!A-Za-z0-9.-]*) return 1 ;;
  esac
  case "$1" in
    *[!0-9.]*) return 0 ;;  # 含字母 → 当主机名，字符集已校验
  esac
  local IFS=. o
  set -- $1
  [ $# -eq 4 ] || return 1
  for o in "$@"; do
    case "$o" in ''|*[!0-9]*) return 1 ;; esac
    [ "$o" -le 255 ] || return 1
  done
  return 0
}

node_major() {
  command -v node >/dev/null 2>&1 || { echo 0; return 0; }
  # 判据收敛到 common.js：Node<22 统一回 0，与 doctor.js 一致。
  node -e 'const c=require(process.argv[1]);process.stdout.write(String(c.nodeVersionOk()?c.nodeMajor():0))' "$HERE/lib/common.js" 2>/dev/null || echo 0
}

cdp_probe() {  # 0 = 调试口已就绪（且已有 page target）；非 0 = 不可用
  command -v node >/dev/null 2>&1 || return 3
  node "$HERE/cdp.js" --status --port "$CDP_PORT" >/dev/null 2>&1
}

cdp_listening() {  # 0 = CDP 端口有人在监听（含无 page target 的残留实例）；与「就绪」判据分开
  command -v node >/dev/null 2>&1 || return 3
  node -e 'const c=require(process.argv[1]);c.cdpListening(Number(process.argv[2])).then(v=>process.exit(v.ok?0:1)).catch(()=>process.exit(1))' "$HERE/lib/common.js" "$CDP_PORT" >/dev/null 2>&1
}

# ── --status：只读体检（不切 WiFi、不 SSH、不起 Chrome、不写文件）───────────
run_status() {
  local fails=0 warns=0
  ok()   { printf '[OK]   %s\n' "$*"; }
  warn() { printf '[WARN] %s\n' "$*"; warns=$((warns + 1)); }
  bad()  { printf '[FAIL] %s\n' "$*"; fails=$((fails + 1)); }

  if [ "$SSID_ROUTER" = "YOUR_ROUTER_SSID" ] || [ "$SSID_HOTSPOT" = "YOUR_HOTSPOT_SSID" ]; then
    warn "SSID_ROUTER / SSID_HOTSPOT 还是占位符（只影响完整复测；本仓不写真实 WiFi 名）"
  else
    ok "SSID_ROUTER / SSID_HOTSPOT 已设置"
  fi

  if valid_router_addr "$ROUTER_IP"; then
    ok "ROUTER_IP 形状合法: $ROUTER_IP"
  else
    bad "ROUTER_IP 不合法: '$ROUTER_IP'（只接受 IPv4 或简单主机名）"
  fi

  ok "临时目录可用: $TMP_BASE"

  if [ -f "$VERIFY_FIX" ]; then ok "路由器侧脚本存在: $VERIFY_FIX"; else warn "路由器侧脚本缺失: $VERIFY_FIX（可用 VERIFY_FIX 覆盖）"; fi
  if [ -f "$SSH_ASKPASS" ]; then ok "askpass 存在: $SSH_ASKPASS"; else warn "askpass 缺失: $SSH_ASKPASS（可用 ASKPASS 覆盖）"; fi

  if resolve_chrome; then
    ok "Chrome: $CHROME_WIN"
    case "$CHROME_WIN" in
      *"'"*) bad "Chrome 路径含单引号，无法安全传给 powershell -Command：$CHROME_WIN" ;;
    esac
  else
    bad "找不到 Chrome（用 CHROME 环境变量指定 chrome.exe 完整路径）"
  fi

  local major
  major="$(node_major)"
  if [ "${major:-0}" -ge 22 ] 2>/dev/null; then
    ok "Node 版本: $(node -v 2>/dev/null)"
  else
    bad "Node 缺失或版本过低（需要 22+，cdp.js 依赖全局 WebSocket）"
  fi

  cdp_probe; _probe=$?
  case $_probe in
    0) warn "CDP 端口 $CDP_PORT 已有实例在监听（复测前会先清残留，或换 CDP_PORT）" ;;
    3) warn "无法探测 CDP 端口 $CDP_PORT（Node 缺失或不可用，见上一条）" ;;
    *) ok "CDP 端口 $CDP_PORT 空闲" ;;
  esac

  if [ -d "$HERE/../evidence" ]; then ok "evidence/ 存在"; else warn "evidence/ 不存在（复测时会自动创建）"; fi

  printf '\n结论: %s 项告警 / %s 项失败\n' "$warns" "$fails"
  [ "$fails" -eq 0 ] || return 1
  return 0
}

if [ "$MODE" = "help" ]; then
  sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
fi

if [ "$MODE" = "status" ]; then
  run_status
  exit $?
fi

# ── 完整复测 ────────────────────────────────────────────────────────────────
if ! resolve_chrome; then
  echo "!! 找不到 Chrome（chrome.exe）。" >&2
  echo "   请用 CHROME 环境变量指定完整路径，例如：" >&2
  echo "   CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe' bash tools/verify-gemini.sh" >&2
  exit 2
fi
# powershell -Command 里路径用单引号包着传：路径自带单引号会把它拆断，宁可早失败。
case "$CHROME_WIN" in
  *"'"*) echo "!! Chrome 路径含单引号，无法安全传给 powershell -Command：$CHROME_WIN" >&2; exit 2 ;;
esac
TMPPROF_WIN="$(to_win "$TMPPROF")"
TMP_SHOT_WIN="$(to_win "$TMP_SHOT")"

if [ "$SSID_ROUTER" = "YOUR_ROUTER_SSID" ] || [ "$SSID_HOTSPOT" = "YOUR_HOTSPOT_SSID" ]; then
  echo "!! 请先设置 SSID_ROUTER / SSID_HOTSPOT（本仓不写真实 WiFi 名）。" >&2
  echo "   例：SSID_ROUTER='MyRouter' SSID_HOTSPOT='MyHotspot' bash tools/verify-gemini.sh" >&2
  exit 2
fi
if ! valid_router_addr "$ROUTER_IP"; then
  echo "!! ROUTER_IP 不合法: '$ROUTER_IP'（只接受 IPv4 或简单主机名，不允许空格/引号/分号）" >&2
  exit 2
fi
command -v node >/dev/null 2>&1 || { echo "!! 找不到 node：cdp.js 与端口探测都依赖它（见 docs/TOOLS.md）" >&2; exit 2; }

echo "    Chrome      : $CHROME_WIN"
echo "    路由器      : $ROUTER_IP"
echo "    CDP 端口    : $CDP_PORT"
echo "    临时目录    : $TMP_BASE"

echo "=== [1/5] 切到路由器 WiFi ($SSID_ROUTER) ==="
WIFI_SWITCHED=1
netsh wlan connect name="$SSID_ROUTER" 2>&1 | tr -d '\r'
for i in $(seq 1 20); do
  sleep 2
  ping -n 1 -w 800 "$ROUTER_IP" >/dev/null 2>&1 && break
done
if ! ping -n 1 -w 1000 "$ROUTER_IP" >/dev/null 2>&1; then
  die "路由器不可达，终止"
fi
echo "    路由器可达"

echo "=== [2/5] 路由器侧检查 + 修补 ==="
[ -f "$VERIFY_FIX" ] || die "路由器侧检查脚本不存在：$VERIFY_FIX（用 VERIFY_FIX 指定）"
/usr/bin/ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=12 \
      root@"$ROUTER_IP" "sh -s" < "$VERIFY_FIX" || die "路由器侧检查失败（ssh 退出码 $?）"

echo "=== [3/5] 启动临时 Chrome（带调试端口，全新 profile）==="
# 先清掉所有残留的临时实例，再确认端口没有被别的 Chrome 占着：
# 否则下面的就绪检查会打在旧实例上，抓到的全是过期状态。
kill_stale_temp_chrome
sleep 2
if cdp_listening; then
  die "CDP 端口 $CDP_PORT 已被占用（含无 page target 的残留 Chrome）；本判据=端口在监听，与就绪判据分开。请关闭它或换 CDP_PORT"
fi
rm -rf "$TMPPROF"; mkdir -p "$TMPPROF"
powershell -NoProfile -Command "Start-Process '$CHROME_WIN' -ArgumentList '--remote-debugging-port=$CDP_PORT','--user-data-dir=$TMPPROF_WIN','--no-first-run','--no-default-browser-check','--window-size=1280,800','https://gemini.google.com/app'" 2>/dev/null
CDP_READY=0
for i in $(seq 1 20); do
  sleep 2
  # 就绪判据与 cdp.js 同源（端口 + page target），不再用 curl 另判一套。
  if cdp_probe; then CDP_READY=1; break; fi
done
[ "$CDP_READY" = "1" ] || die "CDP 端口 $CDP_PORT 约 100 秒内没有就绪（Chrome 可能没起来）"
echo "    CDP 端口就绪"

echo "=== [4/5] 抓控制台/网络（判断 islands bundle 是否还被拦）==="
CDP_OUT="$(CDP_PORT="$CDP_PORT" node "$HERE/cdp.js" 2>&1)"
CDP_RC=$?
printf '%s\n' "$CDP_OUT" | head -60
[ "$CDP_RC" -eq 0 ] || die "cdp.js 抓取失败（exit $CDP_RC）—— 先确认 Node.js 22+（见 docs/TOOLS.md）且 CDP 端口 $CDP_PORT 可用"
echo "=== [4b] 截图 ==="
sleep 2
STAMP="$(date +%Y%m%d-%H%M%S)"
EVID="$HERE/../evidence"
mkdir -p "$EVID" || die "无法创建 evidence 目录：$EVID"
SHOT="$EVID/gemini-after-$STAMP.png"
SHOT_LATEST="$EVID/gemini-after.png"
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
# 轮转：带时间戳的截图只留最近 KEEP_SHOTS 张，避免 evidence/ 无限长（见 docs/MAINTENANCE.md §3.2）
if [ "${KEEP_SHOTS:-0}" -gt 0 ] 2>/dev/null; then
  ls -1t "$EVID"/gemini-after-*.png 2>/dev/null | tail -n +"$((KEEP_SHOTS + 1))" | while IFS= read -r old; do
    rm -f "$old" 2>/dev/null || true
  done
fi

echo "=== [5/5] 清理临时 Chrome 并切回热点 ==="
cleanup
echo "=== 结束（你自己的 Chrome 没有被动过）==="
