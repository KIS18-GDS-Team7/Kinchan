# ADR の番号の重複を status check で検知する

## ステータス

決定

## 背景

- ADR の番号は、ブランチで ADR を書く時点で各自が選ぶ。`main` への merge の順は、番号を選んだ順と一致しない。
- 2026/11/26 時点で、open な PR の間で番号が重複している。0028 は [#120](https://github.com/KIS18-GDS-Team7/Kinchan/pull/120) と [#122](https://github.com/KIS18-GDS-Team7/Kinchan/pull/122)、0029 は #120 と [#123](https://github.com/KIS18-GDS-Team7/Kinchan/pull/123)、0034 は #120 と [#125](https://github.com/KIS18-GDS-Team7/Kinchan/pull/125) が使っている。#120 の 0033 は、`main` の `0033-use-django-for-backend.md` と重複している。
- `main` では 0028–0032、0034–0041 が欠番になっている。open な PR が使っている番号を避けて、0033 と 0042 を選んだためである。
- これまでの検査は、Claude Code Review の prompt にある「ファイル名の連番が既存と重複・欠番していないか」だけだった。この検査は PR の checkout の中しか見ず、他の open な PR を見ない。push では動かない ([ADR-0027](./0027-automation-triggers-and-noise.md))。
- GitHub の PR の check は、head への push か手動の再実行でしか再実行されない。`main` が進んでも、PR の check の結果は古いまま残る。
- ADR の番号は、ファイル名と、他のファイルからの参照に現れる。参照には `ADR-NNNN` の表記と、`docs/ADR/NNNN-slug.md` `./NNNN-slug.md` `../ADR/NNNN-slug.md` などのリンクがある。
- 検討して退けた案。
  - `main` への merge の後に、bot が `main` の上で番号を振る案。bot に `main` への直接 push を許す bypass が必要になり、`main` は PR でだけ変える ([ADR-0004](./0004-branch-strategy.md)) に反する。参照の書き換えも bot が行うことになる。
  - PR のブランチに bot が番号を振って push する案。承認の後の push は承認を無効にする (ADR-0004)。番号を振ってから merge するまでの間に生じる重複は防げない。
  - merge queue を使う案。merge queue の check は内容を書き換えられない。全 PR の merge の操作が変わる。
  - Ruleset で、PR の branch を `main` の最新にすることを必須にする (strict) 案。`main` が進むたびに、他の全 PR で更新の push が必要になり、承認が無効になる。

## 決定

- workflow `ADR number check` (`.github/workflows/adr-number-check.yml`) が、PR の head の commit に status `adr-number` を設定する。判定の処理は `.github/scripts/adr_numbers.py` に置く。
- PR の ADR は、PR が `docs/ADR/` の直下に追加した、または rename で移した `.md` ファイル (`README.md` を除く) とする。
- 次のいずれかに当たる PR は failure にする。
  - ファイル名が `NNNN-<slug>.md` の形式でない。
  - 番号が `main` で別のファイルに使われている。
  - 同じ番号が PR の中に 2 つある。
- 番号が他の open な PR (draft を含む) で別のファイルに使われている PR は、success にし、相手の PR を注記する。先に merge された PR が番号を使い、`main` が進んだ時点で他方は failure になる。
- status の説明には次の番号 (`main` と open な PR (draft を含む) の ADR で使われている最大の番号 + 1) を表示する。詳細のリンク先は、run の job summary の全体の結果とする。
- PR を開く、PR に push する、PR を再オープンすると、その PR を判定する。`docs/ADR/**` を変える `main` への push と手動の実行 (workflow_dispatch) では、`main` と open な PR をすべて判定し直す。
- コメントは投稿せず、status だけを設定する (ADR-0027)。
- protect-main Ruleset で `adr-number` を必須の status check にする。`dev/**` では必須にしない。
- 新しい ADR は、`main` と open な PR (draft を含む) で使われている最大の番号 + 1 を使う。番号は PR を開いた時点で他から見えるので、ADR を書き始めたら draft でも早めに PR を開く。
- 番号が重複したら、後から merge する側が番号を変える。ファイル名と、その ADR を指す参照を書き換える。
- open な PR が使っている番号は、`main` で欠番に見えてもよい。close された PR の番号による欠番は埋めない。
