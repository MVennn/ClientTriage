// clear-chrome-region.js — 清掉 Chrome 的地区（country）种子
// 必须在 Chrome 完全退出时运行：退出时 Chrome 会重写 Local State，在线改会被覆盖。
//
// Chrome 用户数据目录：默认按 Windows 标准位置自动探测，
// 也可用环境变量 CHROME_USER_DATA 或第一个命令行参数覆盖：
//   CHROME_USER_DATA='C:/Users/<你>/AppData/Local/Google/Chrome/User Data' node tools/clear-chrome-region.js
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

// 文件头第 2 行是硬前提：Chrome 退出时会把 Local State 整体写回，
// 在线改等于白改。这里先确认没有 chrome.exe 在跑，不做静默覆盖。
function chromeRunning() {
  try {
    const out = execFileSync(
      "tasklist",
      ["/FI", "IMAGENAME eq chrome.exe", "/NH", "/FO", "CSV"],
      { encoding: "utf8" }
    );
    return /"chrome\.exe"/i.test(out);
  } catch (e) {
    if (e.status === 1) return false;
    throw e;
  }
}

function defaultUserDataDir() {
  const candidates = [];
  if (process.env.LOCALAPPDATA) {
    candidates.push(path.join(process.env.LOCALAPPDATA, "Google", "Chrome", "User Data"));
  }
  if (process.env.USERPROFILE) {
    candidates.push(
      path.join(process.env.USERPROFILE, "AppData", "Local", "Google", "Chrome", "User Data")
    );
  }
  candidates.push(
    path.join(os.homedir(), "AppData", "Local", "Google", "Chrome", "User Data")
  );
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

const UD = process.argv[2] || process.env.CHROME_USER_DATA || defaultUserDataDir();
const files = [path.join(UD, "Local State"), path.join(UD, "Default", "Preferences")];
const keys = [
  "variations_country",
  "variations_permanent_consistency_country",
  "variations_session_consistency_country",
  "variations_safe_seed_permanent_consistency_country",
  "variations_safe_seed_session_consistency_country",
];

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
if (chromeRunning()) {
  console.error("Chrome 正在运行：请先从托盘完全退出 Chrome（不是只关窗口），再重新执行。");
  console.error("在线改 Local State 会被 Chrome 退出时整体写回，等于没改。");
  process.exit(1);
}
for (const f of files) {
  if (!fs.existsSync(f)) {
    console.log("跳过(不存在):", f);
    continue;
  }
  const bak = f + ".bak-region-" + stamp;
  fs.copyFileSync(f, bak);
  let j;
  try {
    j = JSON.parse(fs.readFileSync(f, "utf8"));
  } catch (e) {
    console.log("解析失败，未改动:", f, e.message);
    continue;
  }
  const removed = [];
  for (const k of keys) {
    if (k in j) {
      console.log(`  ${k} = ${JSON.stringify(j[k])}`);
      delete j[k];
      removed.push(k);
    }
  }
  if (j.variations && typeof j.variations === "object") {
    for (const k of keys) {
      if (k in j.variations) {
        console.log(`  variations.${k} = ${JSON.stringify(j.variations[k])}`);
        delete j.variations[k];
        removed.push("variations." + k);
      }
    }
    if (Object.keys(j.variations).length === 0) delete j.variations;
  }
  fs.writeFileSync(f, JSON.stringify(j));
  console.log((removed.length ? "已清除: " + removed.join(", ") : "（本来就没有地区键）"), "->", f);
  console.log("   备份:", bak);
}
console.log("完成");
