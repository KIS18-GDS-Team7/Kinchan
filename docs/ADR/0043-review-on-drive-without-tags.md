# 教員レビューを Google Drive の成果物フォルダで受け、タグと Release の記録をやめる

## ステータス

決定

## 背景

- [ADR-0004](./0004-branch-strategy.md) では、教員は GitHub 上のファイルを読み、メールで返す。送付時に PM が `review/<日付>` タグを打ち、メールに commit を固定した permalink を書く。承認の返信を受けたら、同じ commit に `approved/<日付>` タグと GitHub Release を作る。
- [ADR-0042](./0042-deliver-main-and-pr-to-drive.md) で、`main` の最新が Google Drive の `成果物/` に、`main` を base とする PR の変更が `PR-成果物/` に、10 分ごとに置かれるようになった。Markdown は Google Docs に変換される。ADR-0042 では、`approved/*` タグを教員の承認の記録として残すとしていた。
- `approved/*` タグを納品の契機とする仕組み ([ADR-0005](./0005-deliver-via-apps-script.md)) は、ADR-0042 で置き換え済み。
- 2026/11/25 時点で、教員は Drive の成果物フォルダを読む運用に移った。GitHub の permalink は送らないので、`review/` タグで送付対象の commit を固定する必要が無くなった。
- 教員は Drive を随時読んで指摘を返す。特定の版を承認するやり取りは無く、`approved/` タグを打つ契機が無い。
- 既存の `review/*` `approved/*` タグは、Ruleset (review-tags) で作成・変更・削除を pm-qa に限っている。

## 決定

- 教員レビューは Google Drive の `成果物/` と `PR-成果物/` で受ける。GitHub 上での閲覧と permalink の送付は行わない。
- 教員レビューのためのタグ (`review/*` `approved/*`) と GitHub Release は作らない。ADR-0004 の教員レビューの記録手順と、ADR-0042 の「`approved/*` タグは教員の承認の記録として残す」を置き換える。
- 既存の `review/*` `approved/*` タグと Release は過去の記録として残す。review-tags Ruleset も残す。
- 指摘は通常の PR で `main` に反映する。`main` は常に教員に見せられる状態に保つ (ADR-0004)。
