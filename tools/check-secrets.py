#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""公开仓敏感信息扫描：凭据 + 本机路径 + 真实邮箱（ClientTriage）。

用法：
    python tools/check-secrets.py            # 扫描已跟踪文件
    python tools/check-secrets.py --all      # 已跟踪 + 未跟踪一起扫（遵循 .gitignore）

退出码：0 通过 / 1 发现疑似敏感信息 / 2 自身故障（git 不可用或失败）。
规则与 ZcodeAIModels 的守卫完全一致，8 个仓扫同一套口径。
"""
from __future__ import annotations

import os
import re
import subprocess
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(errors="replace")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP_EXT = {".png", ".jpg", ".jpeg", ".gif", ".ico", ".pdf", ".gz", ".pyc",
            ".woff", ".woff2", ".zip", ".mrs", ".svg", ".webp", ".jar"}

# 占位符与示例行不算命中
PLACEHOLDER = re.compile(
    r"REDACTED|YOUR-|REPLACE-|<[^>]+>|example\.(com|org|net)|placeholder|<用户名>", re.I)

SKIP_DIRS = {".codegraph", ".git", ".work", "__pycache__", "app", "build", "dist", "node_modules", "third-party", "venv"}
SKIP_PREFIXES = ()


def base_skip(rel: str) -> bool:
    return False


PATTERNS = [
    ("私钥块", re.compile(r"-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----")),
    ("GitHub token", re.compile(r"\bgh[pousr]_[A-Za-z0-9]{20,}\b")),
    ("GitHub PAT", re.compile(r"\bgithub_pat_[A-Za-z0-9_]{22,}\b")),
    ("AWS access key", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("Anthropic key", re.compile(r"\bsk-ant-[A-Za-z0-9\-_]{10,}\b")),
    ("通用 sk- token", re.compile(r"\bsk-[A-Za-z0-9]{20,}\b")),
    ("OpenCode key", re.compile(r"\boc_sk_[A-Za-z0-9]{10,}\b")),
    ("Gemini key", re.compile(r"\bAIza[0-9A-Za-z\-_]{35}\b")),
    ("GitLab PAT", re.compile(r"\bglpat-[A-Za-z0-9\-_]{20,}\b")),
    ("shadow 哈希", re.compile(r"\$[1256][aby]?\$[./A-Za-z0-9]{8,}")),
    ("代理节点 URI", re.compile(
        r"\b(?:vmess|vless|trojan|hysteria2?)://[A-Za-z0-9+/=_%.:@?&~-]{20,}", re.I)),
    ("订阅 token", re.compile(
        r"https?://[^\s'\"<>]+(?:token|subscribe|subscription)=[A-Za-z0-9._~-]{8,}", re.I)),
    # 本机用户目录：Windows 正斜杠与反斜杠两种写法
    ("本机用户目录", re.compile(r"[A-Za-z]:[\\/]Users[\\/][A-Za-z0-9._-]+")),
    # 真实邮箱域名（GitHub noreply 不含这些域名，不会误伤）
    ("真实邮箱", re.compile(
        r"\b[A-Za-z0-9._%+-]+@(?:qq|163|126|gmail|outlook|hotmail|foxmail|sina|sohu)\.com\b")),
]

# 变更说明里引用泄漏原文是必要的（否则读者不知道该改什么），但真值仍要遮掉。
# 用户名位置被 `...` / `<...>` 取代，或用户名后紧跟 `\...` 截断的写法，视为已脱敏的
# 描述性引用，放行；完整路径一律不放行。只对文档类文件生效。
DOC_FILES = ("CHANGELOG.md", "PROGRESS.md", "SECURITY.md", "CONTRIBUTING.md")
DOC_PREFIXES = ("docs/", "evidence/", "memories/")


def tracked_files() -> list[str]:
    try:
        out = subprocess.run(["git", "ls-files"], cwd=ROOT, capture_output=True, text=True)
    except FileNotFoundError:
        print("[FAIL] 找不到 git 命令")
        raise SystemExit(2)
    if out.returncode != 0:
        print("[FAIL] git ls-files 失败：" + (out.stderr or "").strip())
        raise SystemExit(2)
    return [x for x in out.stdout.splitlines() if x.strip()]


def untracked_files() -> list[str]:
    # --all 的「未跟踪」遵循 .gitignore（docs/TOOLS.md 登记的口径）：
    # 忽略规则交给 git 判定，gitignore 排除的本地文件（vault/、.work/ 等）不扫。
    out = subprocess.run(
        ["git", "ls-files", "--others", "--exclude-standard"],
        cwd=ROOT, capture_output=True, text=True)
    if out.returncode != 0:
        print("[FAIL] git ls-files --others 失败：" + (out.stderr or "").strip())
        raise SystemExit(2)
    return [x for x in out.stdout.splitlines() if x.strip()]


# 「本机用户目录」的豁免按**每个命中段**判断，不做整行放行 ——
# 整行放行会让同一行里混着的完整真实路径跟着漏掉（守卫最忌讳的漏报）。
# 豁免只对文档类文件生效（docs/SECRETS.md「推送前脱敏规则」），写法正反斜杠都要认。
# （下面的示例故意用 `…` 与尖括号占位写，别换成 ASCII 路径字面量 —— 会本文件自拦。）
def local_path_allowed(seg: str, tail: str) -> bool:
    user = re.split(r"[\\/]", seg)[-1]
    if re.fullmatch(r"\.+", user):        # C:\Users\…\file —— 用户名位置就是省略号
        return True
    if re.match(r"\\\.\.\.", tail):       # C:\Users\某名\... —— 用户名后紧跟截断
        return True
    if re.match(r"You|User", user, re.I): # C:/Users/<你>/… —— 占位用户名模板
        return True
    if re.match(r"[一-鿿]", tail):         # C:/Users/<名字>中文/… —— ASCII 前缀续写中文
        return True
    return False


def is_doc_file(rel: str) -> bool:
    base = rel.replace("\\", "/")
    if base in DOC_FILES or base.startswith(DOC_PREFIXES):
        return True
    return base.split("/")[-1] in DOC_FILES


def main() -> int:
    if "--all" in sys.argv:
        files = sorted(set(tracked_files()) | set(untracked_files()))
    else:
        files = tracked_files()
    bad = []
    for rel in files:
        if os.path.splitext(rel)[1].lower() in SKIP_EXT:
            continue
        parts = rel.replace("\\", "/").split("/")
        if any(p in SKIP_DIRS for p in parts[:-1]):
            continue
        if base_skip(rel):
            continue
        # 文档类文件允许描述性引用泄漏原文，但必须是截断形式
        allow_truncated = is_doc_file(rel)
        try:
            with open(os.path.join(ROOT, rel), encoding="utf-8", errors="replace") as fh:
                for lineno, line in enumerate(fh, 1):
                    for name, pat in PATTERNS:
                        # finditer：一行里每个命中段都单独过豁免，不整行放行 ——
                        # search 只看首个命中，同一行里第二个真值路径会漏。
                        for m in pat.finditer(line):
                            # 占位符只豁免它自己所在的那一段，不再整行放行 ——
                            # 示例与真值写在同一行时，真值仍会被报出来。
                            if PLACEHOLDER.search(m.group(0)):
                                continue
                            if name == "本机用户目录":
                                # 截断/占位写法只对文档类文件放行（SECRETS.md 正本）；
                                # 同一行里其他的完整真实路径仍要报出来。
                                if allow_truncated and local_path_allowed(m.group(0), line[m.end():]):
                                    continue
                            bad.append((rel, lineno, name, line.strip()[:120]))
        except OSError:
            continue

    if bad:
        print(f"[FAIL] 发现 {len(bad)} 处疑似敏感信息：")
        for rel, lineno, name, text in bad:
            print(f"   {rel}:{lineno}  [{name}]  {text}")
        print()
        print("   处理方式：凭据换成环境变量占位符；本机路径只留文件名；邮箱改成 <账号>。")
        print("   位置索引见 docs/SECRETS.md。")
        return 1

    print(f"[OK] 已扫描 {len(files)} 个文件，未发现疑似敏感信息")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
