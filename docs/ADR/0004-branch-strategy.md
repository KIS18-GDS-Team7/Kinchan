# ブランチの運用と必須レビューを定める

## ステータス

決定

## 背景

- 2026/10/22 時点で、開発メンバーは 6 名 (frontend 3、backend 3、database 1、infra 1、PM 1。兼任あり)、教員は 1 名。GitHub は Free plan の organization で、リポジトリは public。
- 実現したいことは次の 4 つ。
  - `main` への直接 push を禁止し、PR を必須にする。
  - チームのレビューと教員のレビューを分ける。教員レビュー待ちの間もチームの統合を止めない。教員が承認した状態を後から特定できるようにする。
  - 他チームの管轄に触れる PR は、その管轄チームのレビューを必須にする。
  - PM が緊急時に使える迂回経路を残す。
- 教員は GitHub 上のファイルを読み、メールで返す。GitHub の利用経験が少なく、PR やブランチ、タグの操作は求められない。本来のレビューは Google Docs 上で行う運用で、この班は GitHub 上での閲覧を例外的に認められている。完成品は Google Drive への納品が必要で、`main` から CI で自動反映する案は、教員が権限を持つフォルダへ書き込めるトークンを発行できるかが未確認。
- 検討して退けた案。
  - `develop` を単一のチームゲートにし、`develop` から `main` への PR を教員ゲートにする案。`develop` が `main` から離れ、取り込みの PR が必要になる。frontend と backend の変更が同じ PR に同居し、片方の差し戻しがもう片方を止める。
  - チーム別の `develop` を置く案。両方に跨る変更の行き先が決まらない。
  - 教員承認済みの `release` ブランチに `main` から PR を出す案。GitHub の PR マージは fast-forward を行わず、`release` の先頭が `main` に存在しない merge commit になる。教員が PR を操作しない以上、PR の形に意味がない。
- CODEOWNERS の制約。同一行の複数 owner は OR で、同一ファイルに 2 チームの承認を要求できない。後の行が前の行を上書きする。owner が作者 1 人だけのパスは、作者が自分の PR を承認できないため、承認必須を満たせない。
- GitHub Rulesets の required reviewers (2026/02 GA) は、パスごとにチームと承認数を指定でき、チーム間は AND になる。Free plan の public repo で設定できることを確認した。
- Rulesets の ref パターンでは `**` が `/` を跨がない。`dev/**` は `dev/x` にしか一致せず、`dev/feat/x` には `dev/**/*` が必要。
- Rulesets の bypass には個人を指定できない (Team、Role、App のみ)。PM だけに許す操作 (教員レビューのタグ作成など) を表すには、PM 1 人の Team が必要になる。
- 1 人チーム (database、infra) は承認必須を自分で満たせない。両者の合意のもと 1 つのチームにまとめる。
- Rulesets は GitHub の設定画面にしかなく、変更の履歴と理由が残らない。
- 2026/10/22 時点で `develop` ブランチが存在し、`main` への PR [#102](https://github.com/KIS18-GDS-Team7/Kinchan/pull/102) が開いている。

## 決定

- `main` をチームの統合先 (default branch) とする。作業は `<type>/<topic>` ブランチで行い、`main` に PR を出す。複数人・複数 PR にまたがる feature は `dev/feat/<name>` を `main` から切って統合し、まとめて `main` に PR を出す。`dev/` 配下は統合ブランチ専用とする。
- `main` と `dev/**` への PR は、作者以外の承認 1 件を必須とする。パスごとの必須レビュアーは次のとおり。複数に該当すれば全チームの承認を必要とする。承認後の push で承認は無効になる。
  - `frontend/**`: frontend
  - `backend/**`: backend
  - `.github/**` `database/**` `deploy/**` `compose*.yaml`、および任意の階層の `Dockerfile*` `.dockerignore`: platform (例: `backend/Dockerfile` は backend と platform の両方)
- org Team として frontend、backend、platform (infra と database を統合)、pm-qa を置く。CODEOWNERS は所有の宣言と review request の自動化に使い、承認の強制は Rulesets の required reviewers で行う。
- 教員レビューは次の手順で記録する。送付時に PM が `review/<日付>` タグを `main` の commit に打ち、メールにはその commit を固定した permalink を書く。承認の返信を受けたら同じ commit に `approved/<日付>` タグと GitHub Release を作り、返信の日時と要旨を記録する。差し戻しは `main` で修正して再送付する。`review/*` `approved/*` の作成・変更・削除は pm-qa のみとする。
- 完成品の Google Drive への納品はレビューとは別の手順とし、決まり次第 CONTRIBUTING.md に書く。
- `main` は常に教員に見せられる状態に保つ。未完成の変更は `dev/feat/<name>` に置き、`main` に入れない。
- Repository admin は PR のマージ時に限り Rulesets を bypass できる。直接 push はできない。緊急時以外は使わない。
- Rulesets の内容は `.github/rulesets/*.json` に置き、変更は PR で行う。適用は PM が行う。
- 既存の `develop` ブランチは通常のチーム PR として `main` にマージし、マージ後に削除する。
- 日々の手順は [CONTRIBUTING.md](../../CONTRIBUTING.md) に、AI コーディングエージェント向けの決まりは [AGENTS.md](../../AGENTS.md) に書く。
