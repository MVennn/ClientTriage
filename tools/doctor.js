#!/usr/bin/env node
// tools/doctor.js —— 只读体检：一次讲清「这套工具现在能不能用」
//
// 为什么要有它：三个使用者工具各自会在不同环节失败（cdp.js 卡在 WebSocket、
// clear-chrome-region.js 卡在 Chrome 没退、verify-gemini.sh 卡在兄弟仓脚本缺失），
// 每次都要人肉逐条试一遍才知道缺什么。这里把前置条件集中成一张体检表，
// 一个字节都不写（除显式 --write-status）。
//
// 用法：
//   node tools/doctor.js                 # 人读的体检表
//   node tools/doctor.js --json          # 机器可读
//   node tools/doctor.js --write-status  # 顺带把结论写进 .work/triage-status.json
//   node tools/doctor.js --port 9223 --user-data "<Chrome 用户数据目录>"
//
// 退出码：0 全部通过或有告警 / 1 有失败项 / 2 用法错误。
"use strict";

const fs = require("fs");
const path = require("path");
const {
  UsageError,
  sanitize,
  parseArgs,
  intArg,
  nodeVersionOk,
  repoRoot,
  statusFilePath,
  readJsonFile,
  mergeStatus,
  chromeRunning,
  defaultUserDataDir,
  probeCdp,
} = require("./lib/common");
const { regionReport } = require("./lib/region");

const USAGE = [
  "用法：node tools/doctor.js [--json] [--write-status] [--port 端口] [--user-data 目录]",
  "",
  "  --json          输出机器可读 JSON",
  "  --write-status  把结论写进 .work/triage-status.json（唯一会写文件的开关）",
  "  --port          CDP 端口，默认 9222",
  "  --user-data     Chrome 用户数据目录（默认自动探测，也认 CHROME_USER_DATA）",
  "  --help          本帮助",
  "",
  "退出码：0 全部通过或有告警 / 1 有失败项 / 2 用法错误",
].join("\n");

// 体检项按「节点 → 浏览器 → 联动」的顺序排，读起来就是一次排障的路径。
function check(id, label, level, detail, hint) {
  return { id, label, level, detail: sanitize(detail, 200), hint: hint ? sanitize(hint, 240) : null };
}

function bashExe() {
  const roots = [process.env.ProgramFiles, process.env["ProgramFiles(x86)"]].filter(Boolean);
  for (const root of roots) {
    const p = path.join(root, "Git", "bin", "bash.exe");
    try {
      if (fs.statSync(p).isFile()) return p;
    } catch (e) {
      /* 继续下一个 */
    }
  }
  return null;
}

// 兄弟仓的两个脚本：verify-gemini.sh 少任何一个都会在跑到一半时死掉。
// 路径与 verify-gemini.sh 的默认值同源（tools/ 往上两级即各机器自己的项目根，不写死盘符）。
function siblingScripts() {
  const base = path.resolve(repoRoot(), "..", "AX3000TOpenwrt", "recovery");
  return {
    verifyFix: path.join(base, "archive", "verify-fix.sh"),
    askpass: path.join(base, "local-tools", "askpass.sh"),
  };
}

// 终端里中文占两列，padEnd 按字符数算会错位 —— 体检表要能扫读，按显示宽度补空格。
function dispWidth(s) {
  let w = 0;
  for (const ch of s) w += /[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]/.test(ch) ? 2 : 1;
  return w;
}

function padDisp(s, width) {
  return s + " ".repeat(Math.max(0, width - dispWidth(s)));
}

function exists(p) {
  try {
    return fs.existsSync(p);
  } catch (e) {
    return false;
  }
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2), {
      flags: ["json", "write-status", "help"],
      options: ["port", "user-data"],
    });
    if (args.has("help")) {
      process.stdout.write(USAGE + "\n");
      return 0;
    }
    if (args.unknown.length) throw new UsageError("未知参数: " + args.unknown.join(" "));
    args.portNum = intArg(args.opts, "port", 9222, 1, 65535);
  } catch (e) {
    process.stderr.write("!! " + e.message + "\n" + USAGE + "\n");
    return 2;
  }

  const asJson = args.has("json");
  const checks = [];

  // ── Node 运行时 ──────────────────────────────────────────────────────────
  const nodeOk = nodeVersionOk();
  checks.push(
    check(
      "node.version",
      "Node 版本",
      nodeOk ? "ok" : "fail",
      "v" + process.versions.node,
      nodeOk ? null : "cdp.js 需要 Node >= 22（全局 WebSocket）"
    )
  );
  const hasFetch =
    typeof fetch === "function" &&
    typeof AbortSignal === "function" &&
    typeof AbortSignal.timeout === "function";
  checks.push(
    check(
      "node.fetch",
      "fetch/AbortSignal.timeout",
      hasFetch ? "ok" : "fail",
      hasFetch ? "可用" : "缺失",
      hasFetch ? null : "端口探测依赖带超时的 fetch，Node 版本过低请升级"
    )
  );
  const hasWs = typeof WebSocket === "function";
  checks.push(
    check(
      "node.websocket",
      "全局 WebSocket",
      hasWs ? "ok" : "fail",
      hasWs ? "可用" : "缺失",
      hasWs ? null : "cdp.js 抓取需要它；Node < 22 会直接 ERR Node 22+ is required"
    )
  );

  // ── Chrome ──────────────────────────────────────────────────────────────
  const chrome = chromeRunning();
  checks.push(
    check(
      "chrome.tasklist",
      "进程探测 (tasklist)",
      chrome.ok ? "ok" : "fail",
      chrome.ok ? "可用" : chrome.error,
      chrome.ok ? null : "本工具链只在 Windows 上跑，tasklist 必须可用"
    )
  );
  checks.push(
    check(
      "chrome.running",
      "Chrome 是否在跑",
      chrome.ok ? (chrome.running ? "warn" : "ok") : "warn",
      chrome.ok ? (chrome.running ? "运行中（" + chrome.pids.length + " 个进程）" : "未运行") : "未知",
      chrome.running ? "清理地区种子前必须完全退出 Chrome，否则退出时会被整体写回" : null
    )
  );

  const UD = args.opts["user-data"] || process.env.CHROME_USER_DATA || defaultUserDataDir();
  const udOk = Boolean(UD) && exists(UD);
  checks.push(
    check(
      "chrome.user-data",
      "用户数据目录",
      udOk ? "ok" : "fail",
      UD ? UD : "未找到",
      udOk ? null : "用 --user-data 或环境变量 CHROME_USER_DATA 指定"
    )
  );

  if (udOk) {
    const rep = regionReport(UD);
    const bad = rep.files.filter((f) => f.error);
    const names = rep.files.reduce((acc, f) => acc.concat(Object.keys(f.keys)), []);
    checks.push(
      check(
        "chrome.region",
        "地区种子",
        bad.length || rep.dirty ? "warn" : "ok",
        bad.length
          ? "有文件读不了: " + bad.map((f) => f.error).join("; ")
          : rep.dirty
            ? "存在 " + names.length + " 个地区键（" + names.join(", ") + "）"
            : "没有地区键",
        rep.dirty ? "Chrome 退出后跑 node tools/clear-chrome-region.js 清理" : null
      )
    );
  }

  // ── CDP ─────────────────────────────────────────────────────────────────
  const cdp = await probeCdp(args.portNum, 1500);
  checks.push(
    check(
      "cdp.port",
      "CDP " + args.portNum,
      cdp.ok ? "ok" : "warn",
      cdp.ok ? cdp.browser : cdp.error,
      cdp.ok ? null : "抓取时由 verify-gemini.sh 起临时 Chrome；也可手动加 --remote-debugging-port 启动"
    )
  );

  // ── 外部前置 ────────────────────────────────────────────────────────────
  const bash = bashExe();
  checks.push(
    check(
      "env.git-bash",
      "Git Bash",
      bash ? "ok" : "warn",
      bash || "未找到",
      bash ? null : "verify-gemini.sh 要在 Git Bash 里跑；System32 下的 bash.exe 是 WSL，不能用"
    )
  );

  const sib = siblingScripts();
  checks.push(
    check(
      "env.verify-fix",
      "兄弟仓 verify-fix.sh",
      exists(sib.verifyFix) ? "ok" : "warn",
      sib.verifyFix,
      exists(sib.verifyFix) ? null : "verify-gemini.sh 的 [2/5] 要用它；可用 VERIFY_FIX 覆盖"
    )
  );
  checks.push(
    check(
      "env.askpass",
      "兄弟仓 askpass.sh",
      exists(sib.askpass) ? "ok" : "warn",
      sib.askpass,
      exists(sib.askpass) ? null : "ssh 免交互要用它；可用 ASKPASS 覆盖"
    )
  );

  const evidenceDir = path.join(repoRoot(), "evidence");
  checks.push(
    check(
      "repo.evidence",
      "evidence/ 目录",
      exists(evidenceDir) ? "ok" : "warn",
      evidenceDir,
      exists(evidenceDir) ? null : "verify-gemini.sh 会把截图写到这里（脚本会自己创建）"
    )
  );

  // 统一状态文件：别的工具写过什么，这里只读地摊开。
  const stFile = statusFilePath();
  const st = readJsonFile(stFile);
  // 文件能解析但不是对象（例如被写成 null 或一个标量）时，直接取 st.value.updatedAt 会抛
  // TypeError，把后面所有检查一起带走 —— 这种情况按「内容异常」提示，其余检查照跑。
  const stObj = st.ok && st.value && typeof st.value === "object" ? st.value : null;
  const sections = stObj && stObj.tools ? Object.keys(stObj.tools) : [];
  let stDetail;
  let stLevel;
  if (stObj) {
    stLevel = "ok";
    stDetail =
      sections.length + " 个工具写过（" + (sections.join(", ") || "无") + "），更新于 " + sanitize(stObj.updatedAt, 40);
  } else if (st.ok) {
    stLevel = "warn";
    stDetail =
      "内容异常（" + sanitize(String(st.value).slice(0, 60), 60) + "），不是 JSON 对象；删掉它或跑一次 tools/cdp.js 重建";
  } else {
    stLevel = "warn";
    stDetail = "还没有（跑过任一工具后生成）";
  }
  checks.push(
    check(
      "repo.status-file",
      "统一状态文件",
      stLevel,
      stDetail,
      stObj ? null : ".work/triage-status.json 由各工具运行时写入；内容异常时删掉重跑任一工具即可"
    )
  );

  // ── 输出 ────────────────────────────────────────────────────────────────
  const fails = checks.filter((c) => c.level === "fail").length;
  const warns = checks.filter((c) => c.level === "warn").length;
  const summary = {
    schema: 1,
    tool: "doctor",
    mode: "status",
    ok: fails === 0,
    port: args.portNum,
    counts: { ok: checks.length - fails - warns, warn: warns, fail: fails },
    checks,
  };

  if (asJson) {
    process.stdout.write(JSON.stringify(summary) + "\n");
  } else {
    // 标记一律 ASCII：GBK 控制台下 ✓/✗ 会自毁（见 docs/PITFALLS.md #19）
    const tag = { ok: "[OK]  ", warn: "[WARN]", fail: "[FAIL]" };
    const width = checks.reduce((m, c) => Math.max(m, dispWidth(c.label)), 0);
    for (const c of checks) {
      process.stdout.write(tag[c.level] + " " + padDisp(c.label, width) + "  " + c.detail + "\n");
      if (c.hint) process.stdout.write("       " + " ".repeat(width) + "  -> " + c.hint + "\n");
    }
    process.stdout.write(
      "\n结论: " +
        (checks.length - fails - warns) +
        " 项通过 / " +
        warns +
        " 项告警 / " +
        fails +
        " 项失败" +
        (fails ? "（先处理 FAIL 项）" : warns ? "（告警不影响只读抓取，写入类操作前先看）" : "") +
        "\n"
    );
  }

  if (args.has("write-status")) {
    try {
      const file = mergeStatus("doctor", {
        ok: summary.ok,
        counts: summary.counts,
        port: args.portNum,
        failing: checks.filter((c) => c.level === "fail").map((c) => c.id),
      });
      if (!asJson) process.stdout.write("已写入状态文件: " + file + "\n");
    } catch (e) {
      process.stderr.write("[!] 状态文件写入失败: " + sanitize(e.message, 120) + "\n");
    }
  }

  return fails === 0 ? 0 : 1;
}

main()
  .then((code) => process.exit(code || 0))
  .catch((e) => {
    process.stderr.write("!! " + sanitize(e && e.message ? e.message : String(e), 300) + "\n");
    process.exit(2);
  });
