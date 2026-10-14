#!/usr/bin/env bash
# gh-pages を 2 つのモックブランチの mock/ から再生成する
#
#   generic/  <- mock/generic-kintai : 曖昧な箇所を一般的な勤怠アプリの慣行で補完したモック
#   faithful/ <- mock/doc-faithful   : ドキュメントの記述だけを画面化し、未定義を TBD として可視化したモック
#
# 使い方: このブランチの worktree 内で ./build.sh を実行し、差分を commit / push する
# 参照する ref は環境変数で差し替え可能(例: GENERIC_REF=origin/mock/generic-kintai)
set -euo pipefail
cd "$(dirname "$0")"

GENERIC_REF="${GENERIC_REF:-mock/generic-kintai}"
FAITHFUL_REF="${FAITHFUL_REF:-mock/doc-faithful}"

extract() {
  local dir="$1" ref="$2"
  rm -rf "$dir"
  mkdir -p "$dir"
  git archive "$ref" mock | tar -x --strip-components=1 -C "$dir"
}

extract generic  "$GENERIC_REF"
extract faithful "$FAITHFUL_REF"

{
  echo "generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "generic : $GENERIC_REF @ $(git rev-parse --short "$GENERIC_REF")"
  echo "faithful: $FAITHFUL_REF @ $(git rev-parse --short "$FAITHFUL_REF")"
} > VERSIONS.txt

touch .nojekyll
cat VERSIONS.txt
