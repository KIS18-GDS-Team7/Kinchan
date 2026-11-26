#!/usr/bin/env python3
"""ADR の番号の重複を検出する (ADR-0045)。

main と open な PR (draft を含む) が docs/ADR/ に追加する ADR を集め、PR ごとに判定する。

- failure: ファイル名が NNNN-<slug>.md でない / main の別のファイルと番号が重複 / PR 内で番号が重複
- success (注記あり): 他の open な PR の別のファイルと番号が重複。先に merge した方が番号を使う

PR の ADR は、PR が docs/ADR/ 直下に追加 (rename を含む) する .md ファイル (README.md を除く)。
次の番号は、main と全 open PR の ADR の最大の番号 + 1。

使い方 (gh の認証が必要):
  python3 .github/scripts/adr_numbers.py                 全 open PR を判定し、次の番号を表示する
  python3 .github/scripts/adr_numbers.py --pr 120        PR #120 を判定する
  python3 .github/scripts/adr_numbers.py --post-status   判定結果を各 PR の head commit に status で付ける (CI 用)
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from collections import defaultdict
from dataclasses import dataclass, field

ADR_DIR = "docs/ADR/"
NAME_RE = re.compile(r"^(\d{4})-[^/]+\.md$")
CONTEXT = "adr-number"
DESCRIPTION_MAX = 140  # commit status の description の上限


class GhError(Exception):
    pass


def gh_api(path: str, method: str = "GET", fields: dict[str, str] | None = None):
    cmd = ["gh", "api", "-X", method, path]
    for key, value in (fields or {}).items():
        cmd += ["-f", f"{key}={value}"]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise GhError(f"gh api {method} {path}: {proc.stderr.strip()}")
    return json.loads(proc.stdout) if proc.stdout.strip() else None


def gh_paginate(path: str) -> list:
    # gh api --paginate は配列を連結して出力するため、page を自前で進める
    sep = "&" if "?" in path else "?"
    items: list = []
    page = 1
    while True:
        batch = gh_api(f"{path}{sep}per_page=100&page={page}")
        items += batch
        if len(batch) < 100:
            return items
        page += 1


def is_adr_file(name: str) -> bool:
    return name.endswith(".md") and name != "README.md"


@dataclass
class Pr:
    number: int
    title: str
    head_sha: str
    draft: bool
    adrs: list[str]  # docs/ADR/ 直下のファイル名


@dataclass
class Finding:
    short: str  # status の description 用
    detail: str  # job summary 用


@dataclass
class Verdict:
    pr: Pr
    errors: list[Finding] = field(default_factory=list)
    notes: list[Finding] = field(default_factory=list)

    @property
    def state(self) -> str:
        return "failure" if self.errors else "success"


def number_of(name: str) -> str | None:
    m = NAME_RE.match(name)
    return m.group(1) if m else None


def fetch_main(repo: str, branch: str) -> list[str]:
    entries = gh_api(f"repos/{repo}/contents/{ADR_DIR.rstrip('/')}?ref={branch}")
    return sorted(e["name"] for e in entries if e["type"] == "file" and is_adr_file(e["name"]))


def fetch_pr_adrs(repo: str, number: int) -> list[str]:
    adrs = []
    for f in gh_paginate(f"repos/{repo}/pulls/{number}/files"):
        path = f["filename"]
        if f["status"] not in ("added", "renamed", "copied") or not path.startswith(ADR_DIR):
            continue
        name = path[len(ADR_DIR):]
        if "/" not in name and is_adr_file(name):
            adrs.append(name)
    return sorted(adrs)


def fetch_open_prs(repo: str) -> list[Pr]:
    return [
        Pr(
            number=p["number"],
            title=p["title"],
            head_sha=p["head"]["sha"],
            draft=p["draft"],
            adrs=fetch_pr_adrs(repo, p["number"]),
        )
        for p in gh_paginate(f"repos/{repo}/pulls?state=open")
    ]


def check_main(main: list[str]) -> list[str]:
    problems = []
    by_num: dict[str, list[str]] = defaultdict(list)
    for name in main:
        num = number_of(name)
        if num is None:
            problems.append(f"{name}: ファイル名が NNNN-<slug>.md の形式でない")
        else:
            by_num[num].append(name)
    for num, names in sorted(by_num.items()):
        if len(names) > 1:
            problems.append(f"{num}: main で重複 ({', '.join(names)})")
    return problems


def next_number(main: list[str], prs: list[Pr]) -> str:
    nums = [number_of(n) for n in main + [a for p in prs for a in p.adrs]]
    return f"{max((int(n) for n in nums if n), default=0) + 1:04d}"


def evaluate(pr: Pr, main: list[str], prs: list[Pr]) -> Verdict:
    v = Verdict(pr)
    main_by_num: dict[str, list[str]] = defaultdict(list)
    for name in main:
        if num := number_of(name):
            main_by_num[num].append(name)

    own: dict[str, list[str]] = defaultdict(list)
    for name in pr.adrs:
        num = number_of(name)
        if num is None:
            v.errors.append(Finding(f"{name} の名前が NNNN-<slug>.md でない",
                                    f"`{name}`: ファイル名が `NNNN-<slug>.md` の形式でない"))
        else:
            own[num].append(name)

    for num, names in sorted(own.items()):
        if len(names) > 1:
            v.errors.append(Finding(f"{num} が PR 内で重複",
                                    f"`{num}`: PR 内で重複 ({', '.join(f'`{n}`' for n in names)})"))
        for name in names:
            # 同じファイル名は同じ ADR として扱う (stacked PR の親子など)
            for other in main_by_num.get(num, []):
                if other != name:
                    v.errors.append(Finding(f"{num} が main と重複",
                                            f"`{name}`: main の `{other}` と番号が重複"))
            for q in prs:
                if q.number == pr.number:
                    continue
                for other in q.adrs:
                    if other != name and number_of(other) == num:
                        v.notes.append(Finding(f"{num} が #{q.number} と重複",
                                               f"`{name}`: #{q.number} の `{other}` と番号が重複"))
    return v


def describe(v: Verdict, next_num: str) -> str:
    def head(findings: list[Finding]) -> str:
        more = f" 他 {len(findings) - 1} 件" if len(findings) > 1 else ""
        return findings[0].short + more

    if v.errors:
        text = f"{head(v.errors)}。番号を {next_num} 以降に変える"
    elif v.notes:
        text = f"OK。{head(v.notes)} (先に merge した方が番号を使う)"
    elif v.pr.adrs:
        text = "重複なし (" + ", ".join(number_of(n) or n for n in v.pr.adrs) + ")"
    else:
        text = "ADR の追加なし"
    return text if len(text) <= DESCRIPTION_MAX else text[: DESCRIPTION_MAX - 1] + "…"


def report(v: Verdict, next_num: str) -> str:
    draft = " (draft)" if v.pr.draft else ""
    mark = "❌" if v.errors else ("⚠️" if v.notes else "✅")
    lines = [f"### {mark} #{v.pr.number} {v.pr.title}{draft}", ""]
    if not v.pr.adrs:
        lines.append("ADR の追加なし")
    else:
        lines.append("追加する ADR: " + ", ".join(f"`{n}`" for n in v.pr.adrs))
    lines += [f"- {f.detail}" for f in v.errors]
    lines += [f"- {f.detail} (先に merge した方が番号を使う)" for f in v.notes]
    if v.errors:
        lines += ["", f"番号を `{next_num}` 以降に変え、その ADR を指す参照 (`ADR-NNNN`、リンク) も書き換える。"]
    return "\n".join(lines) + "\n"


def post_status(repo: str, v: Verdict, next_num: str) -> bool:
    fields = {"state": v.state, "context": CONTEXT, "description": describe(v, next_num)}
    if all(k in os.environ for k in ("GITHUB_SERVER_URL", "GITHUB_REPOSITORY", "GITHUB_RUN_ID")):
        fields["target_url"] = (
            f"{os.environ['GITHUB_SERVER_URL']}/{os.environ['GITHUB_REPOSITORY']}"
            f"/actions/runs/{os.environ['GITHUB_RUN_ID']}"
        )
    try:
        gh_api(f"repos/{repo}/statuses/{v.pr.head_sha}", method="POST", fields=fields)
        return True
    except GhError as e:
        # fork からの PR では token が read-only で書けない。job の成否で返す
        print(f"::warning::#{v.pr.number} に status を付けられない: {e}", file=sys.stderr)
        return False


def main() -> int:
    parser = argparse.ArgumentParser(description="ADR の番号の重複を検出する")
    parser.add_argument("--pr", type=int, help="この PR だけを判定する")
    parser.add_argument("--post-status", action="store_true",
                        help=f"判定結果を PR の head commit に status ({CONTEXT}) で付ける")
    args = parser.parse_args()

    try:
        repo = os.environ.get("GITHUB_REPOSITORY") or subprocess.run(
            ["gh", "repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"],
            capture_output=True, text=True, check=True,
        ).stdout.strip()
        branch = gh_api(f"repos/{repo}")["default_branch"]
        main_adrs = fetch_main(repo, branch)
        prs = fetch_open_prs(repo)
    except (GhError, subprocess.CalledProcessError) as e:
        print(f"GitHub から取得できない: {e}", file=sys.stderr)
        return 2

    nums = sorted({n for n in map(number_of, main_adrs) if n})
    next_num = next_number(main_adrs, prs)
    main_problems = check_main(main_adrs)

    if args.pr is not None:
        targets = [p for p in prs if p.number == args.pr]
        if not targets:
            print(f"#{args.pr} は open な PR でない", file=sys.stderr)
            return 2
    else:
        targets = prs

    verdicts = [evaluate(p, main_adrs, prs) for p in targets]

    out = [
        "## ADR の番号",
        "",
        f"- {branch} の ADR: {len(main_adrs)} 件 (最大 `{nums[-1] if nums else '-'}`)",
        f"- 次の番号: `{next_num}` ({branch} と open な PR の最大の番号 + 1)",
        "",
    ]
    if main_problems:
        out += [f"{branch} の問題:", ""] + [f"- {p}" for p in main_problems] + [""]
    out += [report(v, next_num) for v in verdicts]
    text = "\n".join(out)
    print(text)
    if summary := os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(summary, "a", encoding="utf-8") as f:
            f.write(text + "\n")

    if args.post_status:
        for v in verdicts:
            post_status(repo, v, next_num)

    if args.pr is not None:
        return 1 if verdicts[0].errors else 0
    return 1 if main_problems else 0


if __name__ == "__main__":
    sys.exit(main())
