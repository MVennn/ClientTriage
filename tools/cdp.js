#!/usr/bin/env node
// 用 CDP 接管有头 Chrome，抓 Gemini 页面的控制台/网络失败
//
// 用法：
//   node tools/cdp.js                     # 抓一次（默认采集 18 秒）
//   node tools/cdp.js --status            # 只读探测：调试口与 page target 是否就绪，不起页面、不导航
//   node tools/cdp.js --json              # 结构化输出（机器可读，供联动脚本消费）
//   CDP_PORT=9223 node tools/cdp.js       # 换端口（默认 9222）
//   node tools/cdp.js --wait 30 --url https://example.com/app --port 9223
//   node tools/cdp.js --reuse-tab         # 复用现有标签页（默认新建一个，抓完自动关掉）
//   node tools/cdp.js --ws-timeout 8      # WebSocket 握手超时秒数（默认 8）
//
// 退出码：0 成功 / 1 抓取失败（没有 target、CDP 超时、连接断开）/ 2 用法或运行环境不满足。
// 端口与 target 的探测统一走 tools/lib/common.js（与 verify-gemini.sh 共用一份实现）。
"use strict";

const {
  UsageError,
  sanitize,
  parseArgs,
  intArg,
  probeCdp,
  listTargets,
  waitForCdp,
  mergeStatus,
} = require("./lib/common");

// 每个桶的保留上限：整页加载 18 秒能产生数千条事件，全存下来只为打印前 25 条，
// 既占内存又拖慢解析。按桶限长，超出的只计数（truncated），输出与旧版一致。
const CAPS = { log: 200, console: 200, exception: 100, failed: 200, resp: 400 };

// WebSocket 握手超时（毫秒）。握手阶段 open / error 都可能永远不触发 —— 对端接受 TCP 却不回
// 101 时 Promise 永挂，进程既不出结果也不退出；verify-gemini.sh 是同步调用本脚本的，会连带卡住。
// 默认 8 秒：真实 Chrome 握手远小于 1 秒，且仍小于 --connect-timeout 默认 20 秒的整体预算。
const WS_OPEN_TIMEOUT_MS = 8000;

// 收尾句柄：main 里赋值，正常结束与异常退出两条路径都走 runCleanup，保证幂等。
let cleanupHook = null;
let pageWs = null;
let pageSend = null;

async function runCleanup() {
  const hook = cleanupHook;
  cleanupHook = null; // 幂等：正常收尾后再进 catch 也不会重复关
  if (!hook) return;
  try {
    await hook();
  } catch (e) {
    process.stderr.write("[!] 收尾失败: " + sanitize(e.message, 120) + "\n");
  }
}

const USAGE = `用法：node tools/cdp.js [--status] [--json] [--wait 秒] [--port 端口] [--url 页面]
                       [--connect-timeout 秒] [--ws-timeout 秒] [--reuse-tab]

  --status            只读探测调试口（/json/version + /json/list），不导航、不改浏览器
  --json              输出机器可读 JSON（字段见 docs/TOOLS.md）
  --wait <秒>         采集窗口，默认 18
  --port <端口>       CDP 端口，默认取 CDP_PORT，再退 9222
  --url <页面>        导航目标，默认取 CDP_URL，再退 https://gemini.google.com/app
  --connect-timeout   等调试口就绪的上限秒数，默认 20
  --ws-timeout        WebSocket 握手超时秒数，默认 8（对端只接 TCP 不回 101 时靠它退出）
  --reuse-tab         复用现有标签页（默认新建标签页，抓完关闭；复用时结束会把原地址导航回去）
  --help              本帮助`;

function fail(msg, code) {
  process.stdout.write("ERR " + msg + "\n");
  process.exit(code);
}

// 浏览器级 CDP 连接：只为 Target.createTarget / Target.closeTarget 存在，不采集事件。
// 单独实现、不复用下面的页面采集逻辑 —— 主抓取路径一行不动，风险最小。
// 握手与每条命令都带超时，否则一个假调试口就能把进程挂死（T1 的同类问题）。
async function wsRpc(wsUrl, openTimeoutMs, tag) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const failAll = (why) => {
    for (const [, p] of pending) {
      clearTimeout(p.timer);
      p.rej(new Error(why));
    }
    pending.clear();
  };
  ws.addEventListener("close", () => failAll(tag + " WebSocket closed"));
  ws.addEventListener("error", () => failAll(tag + " WebSocket error"));
  ws.addEventListener("message", (e) => {
    let m;
    try {
      m = JSON.parse(e.data);
    } catch (err) {
      return;
    }
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      clearTimeout(p.timer);
      if (m.error) p.rej(new Error(tag + " CDP 错误: " + (m.error.message || "unknown")));
      else p.res(m);
    }
  });

  const started = Date.now();
  await new Promise((res, rej) => {
    const timer = setTimeout(() => {
      // 同上：先 settle 再 close，避免 close() 同步派发的 error 覆盖掉「握手超时」这句。
      rej(new Error(tag + " WebSocket 握手超时（" + openTimeoutMs + "ms）：" + wsUrl));
      try {
        ws.close();
      } catch (e) {
        /* 已经坏了 */
      }
    }, openTimeoutMs);
    ws.addEventListener("open", () => {
      clearTimeout(timer);
      res();
    });
    ws.addEventListener("error", () => {
      clearTimeout(timer);
      rej(new Error(tag + " WebSocket 连接失败（" + (Date.now() - started) + "ms）：" + wsUrl));
    });
  });

  const send = (method, params = {}, timeoutMs = 20000) =>
    new Promise((res, rej) => {
      const i = ++id;
      const timer = setTimeout(() => {
        pending.delete(i);
        rej(new Error("CDP timeout: " + method));
      }, timeoutMs);
      pending.set(i, { res, rej, timer });
      try {
        ws.send(JSON.stringify({ id: i, method, params }));
      } catch (e) {
        clearTimeout(timer);
        pending.delete(i);
        rej(e);
      }
    });
  const close = async () => {
    try {
      ws.close();
    } catch (e) {
      /* 已经坏了 */
    }
  };
  return { ws, send, close };
}

// 新建的 target 不一定立刻出现在 /json/list 里；短轮询等它带出 webSocketDebuggerUrl。
async function waitForTarget(port, targetId, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const t = await listTargets(port, 1500);
    if (t.ok) {
      const hit = t.targets.find((x) => x.id === targetId);
      if (hit && hit.webSocketDebuggerUrl) return hit;
    }
    const left = deadline - Date.now();
    if (left <= 0) break;
    await new Promise((r) => setTimeout(r, Math.min(200, left)));
  }
  return null;
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2), {
      flags: ["status", "json", "help", "reuse-tab"],
      options: ["wait", "port", "url", "connect-timeout", "ws-timeout"],
    });
  } catch (e) {
    fail(e.message, 2);
  }
  if (args.unknown.length) fail("未知参数: " + args.unknown.join(" ") + "\n" + USAGE, 2);
  if (args.has("help")) {
    process.stdout.write(USAGE + "\n");
    return 0;
  }
  const port = args.opts.port || process.env.CDP_PORT || "9222";
  if (!/^\d{1,5}$/.test(String(port))) fail("CDP 端口不合法: " + sanitize(port, 20), 2);
  const url = args.opts.url || process.env.CDP_URL || "https://gemini.google.com/app";
  const waitSec = intArg(args.opts, "wait", 18, 1, 300);
  const connectSec = intArg(args.opts, "connect-timeout", 20, 1, 300);
  const wsTimeoutMs = intArg(args.opts, "ws-timeout", WS_OPEN_TIMEOUT_MS / 1000, 1, 120) * 1000;
  const asJson = args.has("json");

  if (typeof fetch === "undefined" || !AbortSignal || !AbortSignal.timeout) {
    fail("Node 18+ is required (fetch / AbortSignal.timeout is missing)", 2);
  }

  // ── 只读探测：体检与编排脚本用这一条判断「能不能抓」，不会去动浏览器 ──────
  if (args.has("status")) {
    const v = await probeCdp(Number(port));
    const out = {
      schema: 1,
      tool: "cdp",
      mode: "status",
      ok: v.ok,
      port: Number(port),
      browser: v.ok ? v.browser : null,
      error: v.ok ? null : sanitize(v.error, 160),
    };
    if (v.ok) {
      const w = await waitForCdp(Number(port), 2000, 300);
      out.page = w.ok ? sanitize(w.page.url, 160) : null;
      out.ok = w.ok;
      if (!w.ok) out.error = sanitize(w.error, 160);
    }
    if (asJson) process.stdout.write(JSON.stringify(out) + "\n");
    else {
      process.stdout.write(
        (out.ok ? "[OK] " : "[FAIL] ") +
          "CDP " + port + (out.ok ? " 就绪: " + out.browser + " | page: " + out.page : " 不可用: " + out.error) +
          "\n"
      );
    }
    return out.ok ? 0 : 1;
  }

  if (typeof WebSocket === "undefined") {
    fail("Node 22+ is required (global WebSocket is missing)", 2);
  }

  // ── 就绪等待：一次带超时的 fetch 轮询，替代原先 40 次 × 1 秒的盲等 ──────────
  const ready = await waitForCdp(Number(port), connectSec * 1000);
  if (!ready.ok) fail("CDP 调试口 " + port + " 未就绪（" + sanitize(ready.error, 120) + "）", 1);

  // ── 目标页：默认新建标签页，绝不顶掉用户正在用的那个 ──────────────────────
  // 旧行为对 /json/list 里第一个 page target 直接 Page.navigate，等于把用户任意一个标签页
  // （可能是填了一半的表单）换成目标页且不恢复。现在默认 Target.createTarget 新建、抓完
  // Target.closeTarget 关掉；只有显式 --reuse-tab 才复用，并在收尾时导航回原地址。
  const reuseTab = args.has("reuse-tab");
  const restoreUrl = reuseTab ? String(ready.page.url || "") : "";
  let page = ready.page;
  let createdTargetId = null;
  let browser = null; // 浏览器级连接只在新建标签页时打开

  if (!reuseTab) {
    if (!ready.version || !ready.version.ws) {
      fail("拿不到浏览器级 webSocketDebuggerUrl（Chrome 版本过旧？）", 1);
    }
    browser = await wsRpc(ready.version.ws, wsTimeoutMs, "浏览器级");
    // 这一小段失败时下面的完整收尾还没挂上，先用最小钩子把浏览器级连接关掉。
    cleanupHook = async () => {
      await browser.close();
    };
    // background:true 不抢焦点；个别老版本 Chrome 不认这个参数会报错，退化重试一次。
    let created;
    try {
      created = await browser.send("Target.createTarget", { url: "about:blank", background: true });
    } catch (e) {
      created = await browser.send("Target.createTarget", { url: "about:blank" });
    }
    createdTargetId = created && created.result ? created.result.targetId : null;
    if (!createdTargetId) {
      await browser.close();
      fail("Target.createTarget 没有返回 targetId", 1);
    }
    page = await waitForTarget(Number(port), createdTargetId, wsTimeoutMs);
    if (!page) {
      try {
        await browser.send("Target.closeTarget", { targetId: createdTargetId }, 3000);
      } catch (e) {
        /* 尽力而为：下面照常报错退出 */
      }
      await browser.close();
      fail("新建的 target 没有出现在 /json/list（" + sanitize(createdTargetId, 40) + "）", 1);
    }
  }

  // 出错也要收尾：任何一步抛错都不能把新建的标签页丢在浏览器里、或把复用的标签页留在目标页。
  // 用模块级 pageWs / pageSend，赋值前调用也不会撞 TDZ。
  cleanupHook = async () => {
    if (pageSend && pageWs && pageWs.readyState === 1 && restoreUrl && restoreUrl !== url) {
      try {
        await pageSend("Page.navigate", { url: restoreUrl });
      } catch (e) {
        process.stderr.write("[!] 原地址恢复失败: " + sanitize(e.message, 120) + "\n");
      }
    }
    if (pageWs) {
      try {
        pageWs.close();
      } catch (e) {
        /* 已经坏了 */
      }
    }
    if (browser) {
      if (createdTargetId) {
        try {
          await browser.send("Target.closeTarget", { targetId: createdTargetId }, 3000);
        } catch (e) {
          process.stderr.write("[!] 新标签页关闭失败: " + sanitize(e.message, 120) + "\n");
        }
      }
      await browser.close();
    }
  };

  process.stdout.write(
    "target: " +
      sanitize(page.url, 80) +
      " | " +
      sanitize(page.title, 40) +
      (reuseTab ? " | 复用现有标签页" : " | 新建标签页") +
      "\n"
  );
  if (!page.webSocketDebuggerUrl) {
    await runCleanup();
    fail("page target 没有 webSocketDebuggerUrl（Chrome 版本过旧？）", 1);
  }

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  pageWs = ws;
  let id = 0;
  const pending = new Map();
  // 到达即格式化：只留打印需要的短字符串，不再把整条事件对象留在数组里。
  const bucket = { log: [], console: [], exception: [], failed: [], resp: [] };
  const seen = { log: 0, console: 0, exception: 0, failed: 0, resp: 0 };
  // 非 2xx 的真实条数：resp 数组按 CAPS 截断，长度不能当总数用。
  let respNon2xx = 0;
  const keep = (name, line) => {
    seen[name]++;
    if (bucket[name].length < CAPS[name]) bucket[name].push(line);
  };

  ws.addEventListener("message", (e) => {
    let m;
    try {
      m = JSON.parse(e.data);
    } catch (err) {
      return; // 非 JSON 帧（极少数扩展会发）直接丢弃，不能让一条坏帧炸掉整轮抓取
    }
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      clearTimeout(p.timer);
      p.res(m);
      return;
    }
    const p = m.params || {};
    switch (m.method) {
      case "Log.entryAdded": {
        const en = p.entry || {};
        keep("log", "[" + sanitize(en.level, 12) + "] " + sanitize(en.source, 20) + ": " + sanitize(en.text, 300) + " " + sanitize(en.url, 110));
        break;
      }
      case "Runtime.consoleAPICalled": {
        const text = (p.args || [])
          .map((a) => (a.value !== undefined ? a.value : a.description !== undefined ? a.description : JSON.stringify(a.preview || {})))
          .join(" ");
        keep("console", "[" + sanitize(p.type, 12) + "] " + sanitize(text, 260));
        break;
      }
      case "Runtime.exceptionThrown": {
        const d = p.exceptionDetails || {};
        keep("exception", "EXC " + sanitize(d.text, 200) + " " + sanitize((d.exception || {}).description, 200));
        break;
      }
      case "Network.loadingFailed": {
        keep("failed", "FAIL type=" + sanitize(p.type, 20) + " err=" + sanitize(p.errorText, 80) + " blocked=" + sanitize(p.blockedReason || "-", 40));
        break;
      }
      case "Network.responseReceived": {
        const r = p.response || {};
        if (!/^2/.test(String(r.status))) respNon2xx++;
        keep("resp", sanitize(r.status, 8) + " " + sanitize(p.type, 20) + " " + sanitize(r.url, 130));
        break;
      }
      default:
        break;
    }
  });

  // 握手必须有超时：对端接受 TCP 却不回 101 时 open / error 都不触发，Promise 永挂。
  // 超时先 close 掉半开的 socket（否则它继续占着事件循环），再抛带 URL 与耗时的错误。
  const wsStarted = Date.now();
  await new Promise((res, rej) => {
    const timer = setTimeout(() => {
      // 先 settle 再 close：close() 会同步派发 error，先 close 会把措辞抢成「连接失败」。
      rej(new Error("CDP websocket 握手超时（" + wsTimeoutMs + "ms）：" + page.webSocketDebuggerUrl));
      try {
        ws.close();
      } catch (e) {
        /* 已经坏了 */
      }
    }, wsTimeoutMs);
    ws.addEventListener("open", () => {
      clearTimeout(timer);
      res();
    });
    ws.addEventListener("error", () => {
      clearTimeout(timer);
      rej(
        new Error(
          "CDP websocket 连接失败（" + (Date.now() - wsStarted) + "ms）：" + page.webSocketDebuggerUrl
        )
      );
    });
  });
  // 每条请求都带超时；连接断开时把所有挂起的请求 reject，
  // 否则脚本会在调试口消失后永久挂起。
  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const i = ++id;
      const timer = setTimeout(() => {
        pending.delete(i);
        rej(new Error("CDP timeout: " + method));
      }, 20000);
      pending.set(i, { res, rej, timer });
      try {
        ws.send(JSON.stringify({ id: i, method, params }));
      } catch (e) {
        clearTimeout(timer);
        pending.delete(i);
        rej(e);
      }
    });
  pageSend = send;
  const failAll = (why) => {
    for (const [, p] of pending) {
      clearTimeout(p.timer);
      p.rej(new Error(why));
    }
    pending.clear();
  };
  ws.addEventListener("close", () => failAll("CDP websocket closed"));
  ws.addEventListener("error", () => failAll("CDP websocket error"));

  await send("Log.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Page.enable");
  await send("Page.navigate", { url });
  await new Promise((r) => setTimeout(r, waitSec * 1000));

  let render = null;
  let renderError = null;
  try {
    const evals = await send("Runtime.evaluate", {
      expression:
        "JSON.stringify({text: document.body.innerText.slice(0,500), ce: document.querySelectorAll('contenteditable').length, html: document.body.innerHTML.length, url: location.href, title: document.title})",
      returnByValue: true,
    });
    const raw = evals && evals.result && evals.result.result ? evals.result.result.value : undefined;
    if (typeof raw === "string") {
      try {
        render = JSON.parse(raw);
      } catch (e) {
        render = { text: raw };
      }
    } else {
      renderError = "Runtime.evaluate 没有返回值";
    }
  } catch (e) {
    renderError = e.message;
  }

  const logs = bucket.log;
  const cons = bucket.console;
  const exc = bucket.exception;
  const failed = bucket.failed;
  const resp = bucket.resp;
  const non2xx = resp.filter((r) => !/^2/.test(r));
  const google2xx = resp.filter((r) => /^2/.test(r) && /google|gstatic/.test(r));

  if (asJson) {
    process.stdout.write(
      JSON.stringify({
        schema: 1,
        tool: "cdp",
        mode: "capture",
        ok: true,
        port: Number(port),
        url,
        target: { url: page.url || null, title: page.title || null },
        render,
        renderError,
        log: logs,
        console: cons,
        exception: exc,
        loadingFailed: failed,
        non2xx,
        non2xxCount: respNon2xx,
        google2xx,
        counts: seen,
        truncated: Object.fromEntries(Object.keys(CAPS).map((k) => [k, seen[k] > CAPS[k]])),
      }) + "\n"
    );
  } else {
    process.stdout.write("=== 渲染状态 ===\n");
    process.stdout.write((render ? JSON.stringify(render) : "ERR " + renderError) + "\n");
    const section = (title, arr, cap, total) => {
      process.stdout.write("=== " + title + " (" + total + ") ===\n");
      arr.slice(0, cap).forEach((l) => process.stdout.write("  " + l + "\n"));
      if (total > arr.length) {
        process.stdout.write("  [!] 共 " + total + " 条，仅保留前 " + arr.length + " 条（见 --json 的 counts）\n");
      }
    };
    section("Log", logs, 30, seen.log);
    section("console", cons, 25, seen.console);
    section("exception", exc, 15, seen.exception);
    section("loadingFailed", failed, 25, seen.failed);
    section("非 2xx 响应", non2xx, 25, respNon2xx);
    process.stdout.write("=== 2xx 响应里 google 系（后 15 条）===\n");
    google2xx.slice(-15).forEach((l) => process.stdout.write("  " + l + "\n"));
  }
  // 收尾：新建的标签页关掉 / 复用的标签页导航回原地址，再断开页面连接。
  await runCleanup();

  // 联动出口：把本轮结论写进统一状态文件（.work/ 已被 .gitignore 排除）。
  // 写失败不影响抓取结果，只在 stderr 提示 —— 取证不能因为「记状态」失败而失败。
  try {
    mergeStatus("cdp", {
      ok: true,
      port: Number(port),
      target: sanitize(page.url, 160),
      counts: seen,
      render: render ? { ce: render.ce, html: render.html, title: sanitize(render.title, 80) } : null,
    });
  } catch (e) {
    process.stderr.write("[!] 状态文件写入失败: " + sanitize(e.message, 120) + "\n");
  }
  return 0;
}

main()
  .then((code) => process.exit(code || 0))
  .catch(async (e) => {
    process.stdout.write("ERR " + sanitize(e && e.message ? e.message : String(e), 300) + "\n");
    // 失败路径同样要收尾：不能把新建的标签页或半开连接留给下一次运行。
    await runCleanup();
    process.exit(1);
  });
