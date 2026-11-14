#!/usr/bin/env node
// tools/lib/region.js —— Chrome 地区种子（variations_*_country）的单点实现
//
// 为什么单独一层：同样的「这 5 个键在哪、怎么判存在、怎么删」原先只写在
// clear-chrome-region.js 里，只读体检（tools/doctor.js）要判同一件事时
// 只能再抄一份 —— 抄出来的第二份迟早和第一份不一致（漏一个键、判法不同），
// 于是「体检说干净、清理说脏」这种自相矛盾的输出就会出现。
//
// 本文件只被 require，不单独执行；不依赖任何第三方包。
"use strict";

const path = require("path");
const { readJsonFile } = require("./common");

// Chrome 写地区判定的 5 个键。顺序固定，便于 diff 与按名对账。
const KEYS = [
  "variations_country",
  "variations_permanent_consistency_country",
  "variations_session_consistency_country",
  "variations_safe_seed_permanent_consistency_country",
  "variations_safe_seed_session_consistency_country",
];

const VARIATIONS_PREFIX = "variations.";

// 两个承载文件的固定相对位置：Local State（全局）与 Default/Preferences（单 profile）。
function regionFiles(userDataDir) {
  return [path.join(userDataDir, "Local State"), path.join(userDataDir, "Default", "Preferences")];
}

// 只读地算出「这个文件里有哪些地区键」，一个字节都不写。
// 返回 { file, exists, keys, error, json }：keys 的键名顶层不带前缀，
// 落在 variations 对象里的加 "variations." 前缀，两种位置在报告里能区分开。
function inspectRegionFile(file) {
  const fs = require("fs");
  if (!fs.existsSync(file)) return { file, exists: false, keys: {}, error: null };
  const r = readJsonFile(file);
  if (!r.ok) return { file, exists: true, keys: {}, error: r.error };
  const j = r.value;
  if (!j || typeof j !== "object" || Array.isArray(j)) {
    return { file, exists: true, keys: {}, error: "不是 JSON 对象" };
  }
  const keys = {};
  for (const k of KEYS) if (k in j) keys[k] = j[k];
  if (j.variations && typeof j.variations === "object") {
    for (const k of KEYS) if (k in j.variations) keys[VARIATIONS_PREFIX + k] = j.variations[k];
  }
  return { file, exists: true, keys, error: null, json: j };
}

// 删除已登记的地区键；variations 对象空了就一并删掉（与旧版行为一致）。
function stripRegionKeys(j, names) {
  for (const k of names) {
    if (k.startsWith(VARIATIONS_PREFIX)) {
      delete j.variations[k.slice(VARIATIONS_PREFIX.length)];
    } else {
      delete j[k];
    }
  }
  if (j.variations && typeof j.variations === "object" && Object.keys(j.variations).length === 0) {
    delete j.variations;
  }
}

// 体检用的汇总：两个文件一次读完，dirty 表示「至少有一个地区键还在」。
function regionReport(userDataDir) {
  const files = regionFiles(userDataDir).map(inspectRegionFile);
  const dirty = files.some((f) => Object.keys(f.keys).length > 0);
  return { files, dirty };
}

module.exports = { KEYS, VARIATIONS_PREFIX, regionFiles, inspectRegionFile, stripRegionKeys, regionReport };
