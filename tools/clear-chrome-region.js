#!/usr/bin/env node
// clear-chrome-region.js — 清掉 Chrome 的地区（country）种子
// 必须在 Chrome 完全退出时运行：退出时 Chrome 会重写 Local State，在线改会被覆盖。
//
// Chrome 用户数据目录：默认按 Windows 标准位置自动探测，
// 也可用环境变量 CHROME_USER_DATA、--user-data 或第一个命令行参数覆盖：
//   CHROME_USER_DATA='C:/Users/<你>/AppData/Local/Google/Chrome/User Data' node tools/clear-chrome-region.js
//
// 用法：
//   node tools/clear-chrome-region.js              # 清理（写前留 .bak-region-<时间戳> 备份）
//   node tools/clear-chrome-region.js --status     # 只读：报告还有没有地区键，不写任何文件
//   node tools/clear-chrome-region.js --dry-run    # 演练：打印会删哪些键，不写任何文件
//   node tools/clear-chrome-region.js --json       # 结构化输出（机器可读）
//
// 退出码：0 成功（或本来就干净）/ 1 Chrome 正在运行、拒绝写入 / 2 用法错误或目录不存在。
"use strict";

const fs = require("fs");
const {
  UsageError,
  sanitize,
  parseArgs,
  chromeRunning,
  defaultUserDataDir,
  atomicWriteFile,
  mergeStatus,
} = require("./lib/common");
// 地区键「在哪、怎么判、怎么删」只在 tools/lib/region.js 定义一次；
// 清理工具与只读体检（tools/doctor.js）共用，不会各判一套自相矛盾。
const { regionFiles, inspectRegionFile, stripRegionKeys } = require("./lib/region");

const USAGE = `用法：node tools/clear-chrome-region.js [--status] [--dry-run] [--json] [--user-data 目录]

  --status        只读体检：报告地区键是否存在、Chrome 是否在跑（不写文件）
  --dry-run       演练：打印将要删除的键与备份路径（不写文件）
  --json          输出机器可读 JSON
  --user-data     指定 Chrome 用户数据目录（默认自动探测，也认 CHROME_USER_DATA）
  --help          本帮助`;

function fail(msg, code) {
  process.stderr.write("!! " + msg + "\n");
  process.exit(code);
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2), {
      flags: ["status", "dry-run", "json", "help"],
      options: ["user-data"],
    });
  } catch (e) {
    fail(e.message, 2);
  }
  if (args.unknown.length) fail("未知参数: " + args.unknown.join(" ") + "\n" + USAGE, 2);
  if (args.has("help")) {
    process.stdout.write(USAGE + "\n");
    return 0;
  }
  const statusOnly = args.has("status");
  const dryRun = args.has("dry-run");
  const asJson = args.has("json");

  const UD = args.opts["user-data"] || args.positional[0] || process.env.CHROME_USER_DATA || defaultUserDataDir();
  if (!UD) fail("找不到 Chrome 用户数据目录，请用 --user-data 指定", 2);
  if (!fs.existsSync(UD) || !fs.statSync(UD).isDirectory()) {
    fail("用户数据目录不存在或不是目录: " + sanitize(UD, 200), 2);
  }

  const files = regionFiles(UD);
  const chrome = chromeRunning();
  if (!chrome.ok) fail(chrome.error + "\n   （Chrome 进程探测依赖 Windows 的 tasklist）", 2);

  // ── 只读模式：报告现状，一个字节都不写 ────────────────────────────────────
  if (statusOnly) {
    const report = { schema: 1, tool: "clear-chrome-region", mode: "status", userDataDir: UD, chrome: { running: chrome.running }, files: [] };
    let dirty = false;
    for (const f of files) {
      const i = inspectRegionFile(f);
      const names = Object.keys(i.keys);
      if (names.length) dirty = true;
      report.files.push({ file: f, exists: i.exists, keys: i.keys, error: i.error });
      if (!asJson) {
        process.stdout.write((i.exists ? "" : "跳过(不存在): ") + f + "\n");
        if (i.error) process.stdout.write("  !! " + i.error + "\n");
        for (const k of names) process.stdout.write("  " + k + " = " + JSON.stringify(i.keys[k]) + "\n");
      }
    }
    report.dirty = dirty;
    if (asJson) process.stdout.write(JSON.stringify(report) + "\n");
    else {
      process.stdout.write("Chrome 运行中: " + (chrome.running ? "是（清理会被退出时的写回覆盖）" : "否") + "\n");
      process.stdout.write("结论: " + (dirty ? "存在地区键，需要清理（Chrome 退出后跑本脚本）" : "没有地区键，无需清理") + "\n");
    }
    return 0;
  }

  // 退出时 Chrome 会把 Local State 整体写回，在线改等于白改 —— 不做静默覆盖。
  if (chrome.running) {
    process.stderr.write("Chrome 正在运行：请先从托盘完全退出 Chrome（不是只关窗口），再重新执行。\n");
    process.stderr.write("在线改 Local State 会被 Chrome 退出时整体写回，等于没改。\n");
    return 1;
  }

  // ── 先规划、后写入：所有读取与解析都在动文件之前完成 ──────────────────────
  const plan = [];
  for (const f of files) {
    const i = inspectRegionFile(f);
    if (!i.exists) {
      if (!asJson) process.stdout.write("跳过(不存在): " + f + "\n");
      plan.push({ file: f, exists: false, write: false });
      continue;
    }
    if (i.error) {
      if (!asJson) process.stdout.write("解析失败，未改动: " + f + " " + i.error + "\n");
      plan.push({ file: f, exists: true, write: false, error: i.error });
      continue;
    }
    const names = Object.keys(i.keys);
    plan.push({ file: f, exists: true, names, write: names.length > 0, json: i.json });
  }
  const toWrite = plan.filter((p) => p.write);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const summary = { schema: 1, tool: "clear-chrome-region", mode: dryRun ? "dry-run" : "apply", userDataDir: UD, files: [] };
  let wrote = 0;

  for (const p of toWrite) {
    const bak = p.file + ".bak-region-" + stamp;
    for (const k of p.names) {
      const shown = k.startsWith("variations.")
        ? p.json.variations[k.slice("variations.".length)]
        : p.json[k];
      if (!asJson) process.stdout.write("  " + k + " = " + JSON.stringify(shown) + "\n");
    }
    if (dryRun) {
      if (!asJson) {
        process.stdout.write("将清除: " + p.names.join(", ") + " -> " + p.file + "\n");
        process.stdout.write("   备份将写到: " + bak + "\n");
      }
      summary.files.push({ file: p.file, removed: p.names, backup: null, written: false });
      continue;
    }
    // 写入前现查一次：从上面的检查到这里用户可能又启动了 Chrome。
    // 放在所有写动作之前，保证要么一个文件都没动，要么都动完。
    const again = chromeRunning();
    if (!again.ok || again.running) {
      process.stderr.write("检测到 Chrome 又开始运行，停止写入: " + p.file + "\n");
      process.stderr.write("已处理的文件保持已写入状态，请退出 Chrome 后重跑。\n");
      return 1;
    }
    fs.copyFileSync(p.file, bak);
    stripRegionKeys(p.json, p.names);
    atomicWriteFile(p.file, JSON.stringify(p.json));
    wrote++;
    if (!asJson) {
      process.stdout.write("已清除: " + p.names.join(", ") + " -> " + p.file + "\n");
      process.stdout.write("   备份: " + bak + "\n");
    }
    summary.files.push({ file: p.file, removed: p.names, backup: bak, written: true });
  }

  for (const p of plan.filter((x) => !x.write && x.exists && !x.error)) {
    summary.files.push({ file: p.file, removed: [], backup: null, written: false });
    if (!asJson) process.stdout.write("（本来就没有地区键）-> " + p.file + "\n");
  }

  summary.written = wrote;
  if (asJson) process.stdout.write(JSON.stringify(summary) + "\n");
  else if (dryRun) process.stdout.write("完成（--dry-run：未写入任何文件）\n");
  else process.stdout.write("完成\n");

  // 联动出口：本轮结论进统一状态文件（只记录、不参与判断）。
  // --dry-run 承诺「不写任何文件」，状态文件也算 —— 演练不落账。
  if (!dryRun) {
    try {
      mergeStatus("clear-chrome-region", {
        mode: summary.mode,
        userDataDir: sanitize(UD, 200),
        written: wrote,
        files: summary.files.map((f) => ({ file: sanitize(f.file, 200), removed: f.removed })),
      });
    } catch (e) {
      process.stderr.write("[!] 状态文件写入失败: " + sanitize(e.message, 120) + "\n");
    }
  }
  return 0;
}

main()
  .then((code) => process.exit(code || 0))
  .catch((e) => {
    process.stderr.write("!! " + sanitize(e && e.message ? e.message : String(e), 300) + "\n");
    process.exit(2);
  });
