// 校验脚本：把 tools/cdp.js 用到的 CDP 方法 / 事件字段
// 逐个对 third-party/devtools-protocol/json/ 里的协议定义核对。
// 用法： node third-party/verify-cdp-fields.js
const path = require("path");
const base = path.join(__dirname, "devtools-protocol", "json");
const files = {
  browser: require(path.join(base, "browser_protocol.json")),
  js: require(path.join(base, "js_protocol.json")),
};
const doms = {};
for (const f of Object.values(files)) for (const d of f.domains) doms[d.domain] = d;

function deref(dom, node) {
  let g = 0;
  while (node && node.$ref && g++ < 10) {
    const ref = node.$ref;
    const t = (dom.types || []).find((x) => x.id === ref || x.name === ref);
    if (!t) return null;
    node = t;
  }
  return node;
}
function propOf(dom, typeNode, name) {
  const n = deref(dom, typeNode);
  if (!n || !Array.isArray(n.properties)) return undefined;
  return n.properties.find((x) => x.name === name);
}
function typeFields(dom, typeNode) {
  const n = deref(dom, typeNode);
  if (!n || !Array.isArray(n.properties)) return null;
  return n.properties.map((x) => x.name + (x.optional ? "?" : ""));
}

const COMMANDS = [
  ["Log.enable", []],
  ["Runtime.enable", []],
  ["Network.enable", []],
  ["Page.enable", []],
  ["Page.navigate", ["url"]],
  ["Runtime.evaluate", ["expression", "returnByValue"]],
];
const EVENTS = [
  ["Log", "entryAdded", [["entry", "level"], ["entry", "source"], ["entry", "text"], ["entry", "url"]]],
  ["Runtime", "consoleAPICalled", [["type"], ["args"]]],
  ["Runtime", "exceptionThrown", [["exceptionDetails", "text"], ["exceptionDetails", "exception", "description"]]],
  ["Network", "loadingFailed", [["type"], ["errorText"], ["blockedReason"]]],
  ["Network", "responseReceived", [["response", "status"], ["response", "url"], ["type"]]],
];

let bad = 0;
console.log("=== commands (tools/cdp.js 用到的) ===");
for (const [c, used] of COMMANDS) {
  const [d, m] = c.split(".");
  const dom = doms[d];
  const cmd = dom && (dom.commands || []).find((x) => x.name === m);
  if (!cmd) { console.log(`  MISSING ${c}`); bad++; continue; }
  const params = (cmd.parameters || []).map((x) => x.name + (x.optional ? "?" : ""));
  const missing = used.filter((p) => !params.some((x) => x.replace("?", "") === p));
  console.log(`  ${c}  params=[${params.join(", ")}]` + (missing.length ? `  MISSING USED PARAM: ${missing}` : "  OK"));
  if (missing.length) bad++;
}

console.log("");
console.log("=== events + fields (tools/cdp.js 用到的) ===");
for (const [d, m, paths] of EVENTS) {
  const dom = doms[d];
  const ev = dom && (dom.events || []).find((x) => x.name === m);
  if (!ev) { console.log(`  MISSING ${d}.${m}`); bad++; continue; }
  console.log(`  ${d}.${m}`);
  for (const p of paths) {
    const p0 = (ev.parameters || []).find((x) => x.name === p[0]);
    if (!p0) { console.log(`    ${p.join(".")} -> PARAM NOT FOUND`); bad++; continue; }
    let node = p0;
    let ok = true;
    for (let i = 1; i < p.length; i++) {
      node = propOf(dom, node, p[i]);
      if (!node) { ok = false; break; }
    }
    if (!ok) { console.log(`    ${p.join(".")} -> NOT FOUND`); bad++; continue; }
    let extra = "";
    const dn = deref(dom, node);
    if (dn && dn.type === "object" && Array.isArray(dn.properties)) {
      extra = `  {${dn.id || dn.name}: ${dn.properties.map((x) => x.name + (x.optional ? "?" : "")).join(", ")}}`;
    } else if (dn && dn.type === "array" && dn.items && dn.items.$ref) {
      const it = deref(dom, { $ref: dn.items.$ref });
      if (it && Array.isArray(it.properties)) {
        extra = `  array of {${it.id}: ${it.properties.map((x) => x.name + (x.optional ? "?" : "")).join(", ")}}`;
      }
    }
    console.log(`    ${p.join(".")} -> ${dn ? dn.type : "?"}${node.optional ? " (optional)" : ""}${extra}`);
  }
}

console.log("");
console.log(bad === 0
  ? "RESULT: 全部命中 —— tools/cdp.js 用到的 CDP 方法与字段都存在于本目录的协议定义中。"
  : `RESULT: ${bad} 处问题`);
