// clear-chrome-region.js — 清掉 Chrome 的地区（country）种子
// 必须在 Chrome 完全退出时运行：退出时 Chrome 会重写 Local State，在线改会被覆盖。
const fs = require("fs");
const path = require("path");

const UD = "C:/Users/SansK/AppData/Local/Google/Chrome/User Data";
const files = [path.join(UD, "Local State"), path.join(UD, "Default", "Preferences")];
const keys = [
  "variations_country",
  "variations_permanent_consistency_country",
  "variations_session_consistency_country",
  "variations_safe_seed_permanent_consistency_country",
  "variations_safe_seed_session_consistency_country",
];

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
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
