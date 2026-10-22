# CONTRIBUTING

Kinchan リポジトリでの作業の決まり。設計の経緯は [ADR-0004](docs/ADR/0004-branch-strategy.md) を参照。

## ブランチ

```
<type>/<topic> ──PR──> main ──(教員レビュー)──> review/<日付>, approved/<日付> タグ
                        ↑
dev/feat/<name> ───PR───┘   複数人・複数 PR で進める feature の統合ブランチ (任意)
      ↑
feat/<name>/<topic> ─PR─┘
```

| ブランチ | 役割 | 決まり |
|---|---|---|
| `main` | チームの統合先。常に教員に見せられる状態に保つ | 直接 push 不可。PR 必須。削除・force push 不可 |
| `<type>/<topic>` | 作業ブランチ。`docs/` `feat/` `fix/` `ci/` など | `main` から切り、`main` に PR を出す。マージ後に削除 |
| `dev/feat/<name>` | 複数人・複数 PR で進める feature の統合ブランチ | `main` から切る。直接 push 不可。PR 必須。`main` に PR を出し、マージ後に削除 |
| `feat/<name>/<topic>` | `dev/feat/<name>` に対する作業ブランチ | `dev/feat/<name>` に PR を出す |

- 1 PR で終わる変更は `dev/` を経由せず `main` に直接 PR を出す。
- 未完成の変更を `main` に入れない。途中の状態を共有したいときは `dev/feat/<name>` を使う。
- `dev/feat/<name>` が長く残ると `main` から離れる。`main` の取り込みも PR で行うため、feature は小さく区切って早く `main` に入れる。
- 自動生成のブランチ (`claude/issue-...`) はそのまま `main` に PR を出してよい。

## PR とレビュー

- PR 本文はテンプレートに従う。他チームの管轄に触れた場合はその旨を書く。
- `main` と `dev/**` への PR は、作者以外の承認が 1 件以上必要。
- 変更したパスに応じて、次のチームの承認が必須になる。複数に該当すれば全チームの承認が必要。

| パス | 必須レビュアー (org Team) |
|---|---|
| `frontend/**` | frontend |
| `backend/**` | backend |
| `.github/**` `database/**` `deploy/**` `compose*.yaml` `Dockerfile*` `.dockerignore` | platform (Infra / CI / Database) |
| 上記以外 (`docs/` など) | 指定なし。作者以外の承認 1 件で通る |

- 承認後に push すると承認は無効になる。再度レビューを依頼する。
- 自分の PR は自分で承認できない。必須チームのメンバーが自分だけの場合は、同じチームの他のメンバーに依頼する。
- マージ方法は merge / squash / rebase のいずれも可。これまでの PR は merge commit で揃えている。
- Repository admin (PM) は緊急時に限り、PR のマージ時にルールを bypass できる。直接 push はできない。

## 教員レビュー

教員は `main` のファイルを GitHub 上で読み、メールで返す。PR やタグの操作はしない。

1. `main` が送付できる状態か確認する (未完成の変更が入っていないこと)。
2. PM が送付する commit に `review/<YYYYMMDD>` タグを打つ。

   ```sh
   git fetch origin
   git tag -a review/20261022 -m "教員レビュー依頼 (UC ドキュメント)" origin/main
   git push origin review/20261022
   ```

3. メールには commit を固定したリンク (permalink) を書く。GitHub でファイルを開いて `y` を押すと URL が `blob/<commit>/...` の形になる。この URL は後で `main` が進んでも同じ内容を表示する。
4. 承認の返信を受けたら、同じ commit に `approved/<YYYYMMDD>` タグと GitHub Release を作り、返信の日時と要旨を記録する。リポジトリは public なので、メールの原文や個人情報は書かない。

   ```sh
   gh release create approved/20261022 --target "$(git rev-parse review/20261022^{commit})" \
     --title "教員承認 2026-10-22" --notes "2026-10-22 のメールで承認。対象: review/20261022。指摘事項: なし"
   ```

5. 差し戻しの場合はタグを打たず、`main` で修正して 1 からやり直す。

`review/*` `approved/*` タグの作成・変更・削除は pm-qa チームのみ。

## 困ったとき

| 表示 | 意味 | 対処 |
|---|---|---|
| `Changes must be made through a pull request` | 保護されたブランチへ直接 push した | 作業ブランチを切って PR を出す |
| `Review required` / `Waiting on required reviewers` | 必須レビュアーの承認が足りない | 表示されたチームのメンバーに依頼する |
| `GH013: Repository rule violations found` | Rulesets に違反した。続く行に理由がある | 理由に従う。`review/` `approved/` タグなら PM に依頼する |
| 承認が消えた | 承認後に push した | 再度レビューを依頼する |

## 自動化

| 名前 | 起動 | 動作 |
|---|---|---|
| Claude Code Review | PR を開く、draft を解除する、再オープンする、`claude-review` ラベルを付ける | 差分をレビューし、inline comment と総評を書く。push では動かない。再レビューはラベルを付け直す |
| Claude Code | Issue / PR のコメントに `@claude` と書く | 質問に答える、調査する。承認・編集・close はしない。write 権限のあるメンバーのみ起動できる |
| Issue duplicate check | Issue を開く | 既存 Issue との重複を判定し、重複があればコメントする |

## 設定の変更

ブランチ保護は GitHub の Rulesets で設定している。内容は `.github/rulesets/*.json` と一致させる。

1. JSON を変更する PR を出す (platform の承認が必須)。
2. マージ後、PM が適用する。

   ```sh
   gh api -X PUT repos/KIS18-GDS-Team7/Kinchan/rulesets/<id> --input .github/rulesets/<name>.json
   ```

   ID の対応は [.github/rulesets/README.md](.github/rulesets/README.md) にある。

CODEOWNERS (`.github/CODEOWNERS`) は所有の宣言と review request の自動化に使う。承認の強制は Rulesets 側で行う。

## 関連文書

- [ADR-0001 ADRを書く](docs/ADR/0001-record-ADR.md)
- [ADR-0002 ドキュメントでは人間的な表現を使わない](docs/ADR/0002-avoid-human-centric-expressions.md)
- [ADR-0003 曖昧な語を使わない](docs/ADR/0003-avoid-ambiguous-terms.md)
- [ADR-0004 ブランチの運用と必須レビューを定める](docs/ADR/0004-branch-strategy.md)
- [AGENTS.md](AGENTS.md): AI コーディングエージェント向けの決まり
