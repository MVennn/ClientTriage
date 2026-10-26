// 用 CDP 接管有头 Chrome，抓 Gemini 页面的控制台/网络失败
const CDP = "http://127.0.0.1:" + (process.env.CDP_PORT || "9222");
const URL_TARGET = process.env.CDP_URL || "https://gemini.google.com/app";

if (typeof WebSocket === "undefined") {
  console.log("ERR Node 22+ is required (global WebSocket is missing)");
  process.exit(2);
}

async function main() {
  let targets = [];
  for (let i = 0; i < 40; i++) {
    try {
      targets = await (await fetch(CDP + "/json/list")).json();
      if (targets.length) break;
    } catch (e) {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  const page = targets.find((t) => t.type === "page");
  if (!page) {
    console.log("没有可用的 page target");
    process.exit(1);
  }
  console.log("target:", (page.url || "").slice(0, 80), "|", (page.title || "").slice(0, 40));

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const ev = [];
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      clearTimeout(p.timer);
      p.res(m);
    } else if (m.method) ev.push(m);
  });
  await new Promise((res, rej) => {
    ws.addEventListener("open", res);
    ws.addEventListener("error", rej);
  });
  // 每条请求都带超时；连接断开时把所有挂起的请求 reject，
  // 否则脚本会在调试口消失后永久挂起。
  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const i = ++id;
      const timer = setTimeout(() => {
        pending.delete(i);
        rej(new Error(`CDP timeout: ${method}`));
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
  await send("Page.navigate", { url: URL_TARGET });
  await new Promise((r) => setTimeout(r, 18000));

  const evals = await send("Runtime.evaluate", {
    expression:
      "JSON.stringify({text: document.body.innerText.slice(0,500), ce: document.querySelectorAll('contenteditable').length, html: document.body.innerHTML.length, url: location.href, title: document.title})",
    returnByValue: true,
  });
  const logs = ev
    .filter((e) => e.method === "Log.entryAdded")
    .map((e) => `[${e.params.entry.level}] ${e.params.entry.source}: ${e.params.entry.text} ${(e.params.entry.url || "").slice(0, 110)}`);
  const cons = ev
    .filter((e) => e.method === "Runtime.consoleAPICalled")
    .map(
      (e) =>
        `[${e.params.type}] ` +
        (e.params.args || [])
          .map((a) => a.value ?? a.description ?? JSON.stringify(a.preview || {}))
          .join(" ")
          .slice(0, 260)
    );
  const exc = ev
    .filter((e) => e.method === "Runtime.exceptionThrown")
    .map((e) => `EXC ${e.params.exceptionDetails.text} ${(e.params.exceptionDetails.exception || {}).description || ""}`.slice(0, 400));
  const failed = ev
    .filter((e) => e.method === "Network.loadingFailed")
    .map((e) => `FAIL type=${e.params.type} err=${e.params.errorText} blocked=${e.params.blockedReason || "-"}`);
  const resp = ev
    .filter((e) => e.method === "Network.responseReceived")
    .map((e) => `${e.params.response.status} ${e.params.type} ${e.params.response.url.slice(0, 130)}`);

  console.log("=== 渲染状态 ===");
  console.log(evals?.result?.result?.value);
  console.log("=== Log (" + logs.length + ") ===");
  logs.slice(0, 30).forEach((l) => console.log("  " + l));
  console.log("=== console (" + cons.length + ") ===");
  cons.slice(0, 25).forEach((l) => console.log("  " + l));
  console.log("=== exception (" + exc.length + ") ===");
  exc.slice(0, 15).forEach((l) => console.log("  " + l));
  console.log("=== loadingFailed (" + failed.length + ") ===");
  failed.slice(0, 25).forEach((l) => console.log("  " + l));
  console.log("=== 非 2xx 响应 ===");
  resp.filter((r) => !/^2/.test(r)).slice(0, 25).forEach((l) => console.log("  " + l));
  console.log("=== 2xx 响应里 google 系（后 15 条）===");
  resp.filter((r) => /^2/.test(r) && /google|gstatic/.test(r)).slice(-15).forEach((l) => console.log("  " + l));
  ws.close();
}
main().catch((e) => {
  console.log("ERR", e.message);
  process.exit(1);
});
