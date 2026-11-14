#!/usr/bin/env node
// tools/lib/common.js —— 三个使用者工具与体检脚本共用的单点实现
//
// 为什么要有这一层：CDP 端口探测、Chrome 进程探测、参数解析、写 JSON、
// 把页面/日志里的字符串打到终端，原先各脚本各写一份（bash 里用 curl，
// JS 里用 fetch；写文件一个 copyFile 一个 writeFileSync），改一处漏一处。
// 收敛到这里之后，「怎么算端口就绪」「怎么算 Chrome 在跑」只有一种答案。
//
// 本文件只被 require，不单独执行；不依赖任何第三方包。
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

// 状态文件 schema 版本：字段变了就 +1，读方按它决定能不能认
const STATUS_SCHEMA = 1;

// ── 输出安全 ────────────────────────────────────────────────────────────────
// 页面标题、控制台文本、响应 URL 都是**被诊断对象**给的内容，直接 print 到终端时
// 可以带 ANSI 转义（改颜色伪装成「已通过」）或回车（覆盖上一行结论）——
// 那既是日志注入，也会让人误读证据。所有外部字符串先过这里再输出。
function sanitize(value, max = 200) {
  let s = value === null || value === undefined ? "" : String(value);
  s = s.replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "");   // ANSI CSI
  s = s.replace(/\u001b[\]P^_][\s\S]*?(\u0007|\u001b\\|$)/g, ""); // OSC / DCS
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[\u0000-\u001f\u007f]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  if (max > 0 && s.length > max) s = s.slice(0, max) + "…";
  return s;
}

// ── 参数解析 ────────────────────────────────────────────────────────────────
// 只认 --flag 与 --opt value / --opt=value；未知参数一律进 unknown，
// 由调用方报用法错误 —— 打错一个字母不该被静默忽略后跑出「看起来成功」的结果。
function parseArgs(argv, spec = {}) {
  const boolFlags = new Set(spec.flags || []);
  const valueFlags = new Set(spec.options || []);
  const flags = new Set();
  const opts = Object.create(null);
  const positional = [];
  const unknown = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") {
      positional.push(...argv.slice(i + 1));
      break;
    }
    if (!a.startsWith("--")) {
      positional.push(a);
      continue;
    }
    const eq = a.indexOf("=");
    const name = eq === -1 ? a.slice(2) : a.slice(2, eq);
    if (valueFlags.has(name)) {
      const v = eq === -1 ? argv[++i] : a.slice(eq + 1);
      if (v === undefined || v === "") throw new UsageError(`--${name} 需要一个值`);
      opts[name] = v;
    } else if (boolFlags.has(name)) {
      flags.add(name);
    } else {
      unknown.push(a);
    }
  }
  return { flags, opts, positional, unknown, has: (n) => flags.has(n) };
}

class UsageError extends Error {}

function intArg(opts, name, def, min, max) {
  if (opts[name] === undefined) return def;
  const n = Number(opts[name]);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new UsageError(`--${name} 必须是 ${min}..${max} 的整数（收到 ${opts[name]}）`);
  }
  return n;
}

// ── 文件 ────────────────────────────────────────────────────────────────────
function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJsonFile(file) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (e) {
    return { ok: false, error: `读取失败: ${e.code || e.message}` };
  }
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: `解析失败: ${e.message}` };
  }
}

// 原子写：同目录临时文件 → fsync → rename 覆盖。
// 直接 writeFileSync 是先截断再写，中途被打断（Ctrl-C、断电、进程被杀）
// 就留下半截 JSON —— Chrome 读不了 Local State，等于把浏览器搞坏。
function atomicWriteFile(file, data) {
  const dir = path.dirname(file);
  const tmp = path.join(dir, `.${path.basename(file)}.tmp-${process.pid}-${Date.now()}`);
  let fd;
  try {
    fd = fs.openSync(tmp, "w");
    fs.writeFileSync(fd, data);
    try {
      fs.fsyncSync(fd);
    } catch (e) {
      /* 某些文件系统不支持 fsync，忽略 */
    }
    fs.closeSync(fd);
    fd = undefined;
    try {
      fs.renameSync(tmp, file);
    } catch (e) {
      // Windows 上被杀软 / 同步盘占住时 rename 会 EBUSY/EPERM：
      // 退化成原地写并明确告警，不让「本来能跑的工具」直接失败。
      process.stderr.write(`[!] 原子替换失败（${e.code || e.message}），回退为直接写入: ${file}\n`);
      fs.writeFileSync(file, data);
    }
  } catch (e) {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch (e2) {}
    }
    try {
      fs.unlinkSync(tmp);
    } catch (e2) {}
    throw e;
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch (e) {
      /* 已被 rename 走 */
    }
  }
}

function atomicWriteJson(file, value) {
  atomicWriteFile(file, JSON.stringify(value));
}

// ── 仓库内状态文件（联动用的机器可读出口）────────────────────────────────────
// .work/ 已被 .gitignore 排除，不进版本库；每个工具写自己那一段，互不覆盖。
function repoRoot() {
  return path.resolve(__dirname, "..", "..");
}

function statusFilePath() {
  return path.join(repoRoot(), ".work", "triage-status.json");
}

function mergeStatus(section, data) {
  const file = statusFilePath();
  ensureDir(path.dirname(file));
  const doc = { schema: STATUS_SCHEMA, updatedAt: null, tools: {} };
  const prev = readJsonFile(file);
  if (prev.ok && prev.value && typeof prev.value === "object") {
    if (prev.value.tools && typeof prev.value.tools === "object") doc.tools = prev.value.tools;
  }
  doc.schema = STATUS_SCHEMA;
  doc.updatedAt = new Date().toISOString();
  doc.tools[section] = data;
  atomicWriteJson(file, doc);
  return file;
}

// ── Chrome ──────────────────────────────────────────────────────────────────
// tasklist 只认 Windows；失败时返回 ok:false 让调用方决定怎么退化。
function chromeProcesses() {
  try {
    const out = execFileSync(
      "tasklist",
      ["/FI", "IMAGENAME eq chrome.exe", "/NH", "/FO", "CSV"],
      { encoding: "utf8", windowsHide: true }
    );
    const pids = [];
    for (const line of out.split(/\r?\n/)) {
      const m = /^"chrome\.exe","(\d+)"/i.exec(line.trim());
      if (m) pids.push(Number(m[1]));
    }
    return { ok: true, pids };
  } catch (e) {
    if (e.status === 1) return { ok: true, pids: [] }; // 没有匹配进程时 tasklist 退出码 1
    if (e.status == null && (e.code === "ENOENT" || e.code === "EACCES")) {
      return { ok: false, error: "tasklist 不可用（本工具仅支持 Windows）" };
    }
    return { ok: false, error: e.message };
  }
}

// 写配置前的「Chrome 是否在跑」必须现查，不能缓存：
// 检查通过到写入之间用户可能又开了 Chrome，那一次写会被 Chrome 退出时整体覆盖。
function chromeRunning() {
  const r = chromeProcesses();
  if (!r.ok) return { running: false, ok: false, error: r.error, pids: [] };
  return { running: r.pids.length > 0, ok: true, pids: r.pids };
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
  candidates.push(path.join(os.homedir(), "AppData", "Local", "Google", "Chrome", "User Data"));
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

// chrome.exe 的定位：与 verify-gemini.sh 的常见安装路径判断保持一致
// （bash 侧另有 where / 注册表兜底，JS 侧只查这几条固定路径）。
function findChromeExe() {
  const candidates = [];
  if (process.env.PROGRAMFILES) {
    candidates.push(path.join(process.env.PROGRAMFILES, "Google", "Chrome", "Application", "chrome.exe"));
  }
  if (process.env["PROGRAMFILES(X86)"]) {
    candidates.push(
      path.join(process.env["PROGRAMFILES(X86)"], "Google", "Chrome", "Application", "chrome.exe")
    );
  }
  if (process.env.LOCALAPPDATA) {
    candidates.push(
      path.join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe")
    );
  }
  for (const c of candidates) {
    try {
      if (fs.statSync(c).isFile()) return c;
    } catch (e) {
      /* 继续下一个 */
    }
  }
  return null;
}

// ── CDP 探测 ────────────────────────────────────────────────────────────────
// 原先两处各写一份：cdp.js 用 fetch 轮询 40 次、verify-gemini.sh 用 curl 轮询 20 次。
// 收敛成一次带超时的 fetch —— 端口关着时立刻失败，不会占满一整轮轮询。
function cdpBase(port) {
  return `http://127.0.0.1:${port}`;
}

async function probeCdp(port, timeoutMs = 1500) {
  const url = cdpBase(port) + "/json/version";
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const body = await res.json();
    return { ok: true, browser: sanitize(body.Browser, 120), ws: body.webSocketDebuggerUrl || null };
  } catch (e) {
    const name = e && e.name ? e.name : "";
    // fetch 在 Node 里把真实原因藏在 cause 里（ECONNREFUSED / ENOTFOUND / 证书错误），
    // 只报 "fetch failed" 等于让人去猜 —— 端口关着和 Chrome 崩了是两件事。
    const cause = e && e.cause ? e.cause.code || e.cause.message : "";
    const msg =
      name === "TimeoutError" || name === "AbortError"
        ? `${timeoutMs}ms 内无响应`
        : e.message + (cause ? " (" + cause + ")" : "");
    return { ok: false, error: msg };
  }
}

async function listTargets(port, timeoutMs = 3000) {
  try {
    const res = await fetch(cdpBase(port) + "/json/list", { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const list = await res.json();
    return { ok: true, targets: Array.isArray(list) ? list : [] };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// 等到「端口就绪且有 page target」或超时；轮询间隔固定，不靠 sleep 猜。
async function waitForCdp(port, timeoutMs, intervalMs = 500) {
  const deadline = Date.now() + timeoutMs;
  let last = { ok: false, error: "未开始" };
  while (Date.now() < deadline) {
    const v = await probeCdp(port, Math.min(1500, Math.max(300, deadline - Date.now())));
    if (v.ok) {
      const t = await listTargets(port);
      const page = t.ok ? t.targets.find((x) => x.type === "page") : null;
      if (page) return { ok: true, version: v, page, targets: t.targets.length };
      last = { ok: false, error: t.ok ? "没有 page target" : t.error };
    } else {
      last = v;
    }
    const left = deadline - Date.now();
    if (left <= 0) break;
    await new Promise((r) => setTimeout(r, Math.min(intervalMs, left)));
  }
  return last;
}

module.exports = {
  STATUS_SCHEMA,
  UsageError,
  sanitize,
  parseArgs,
  intArg,
  ensureDir,
  readJsonFile,
  atomicWriteFile,
  atomicWriteJson,
  repoRoot,
  statusFilePath,
  mergeStatus,
  chromeProcesses,
  chromeRunning,
  defaultUserDataDir,
  findChromeExe,
  cdpBase,
  probeCdp,
  listTargets,
  waitForCdp,
};
