# GitHub 上の AI エージェントには読み取りとコメントだけを許可する

## ステータス

決定

## 背景

- GitHub Actions で Claude Code を 3 つの用途に使っている。issue・PR での `@claude` への応答 (`.github/workflows/claude.yml`)、PR の自動レビュー (`claude-code-review.yml`)、issue の重複判定 (`issue-dedup.yml`) である ([#17](https://github.com/KIS18-GDS-Team7/Kinchan/pull/17)、[#21](https://github.com/KIS18-GDS-Team7/Kinchan/pull/21)、[#29](https://github.com/KIS18-GDS-Team7/Kinchan/pull/29))。
- AI に任せるときに好き勝手に動かれると困る ([ADR-0001](./0001-record-ADR.md))。
- UC 記述やモックは未マージのブランチにあり、PR がないものは `gh pr diff` でも読めなかった。`git show` `git grep` `git log` を許可する案は、`-O<コマンド>` や `--output=<ファイル>` などのオプションでコマンドの実行やファイルの書き込みができ、前方一致の許可では防げない ([#95](https://github.com/KIS18-GDS-Team7/Kinchan/pull/95))。
- `@claude` の応答が issue の論点から外れることがあった ([#67](https://github.com/KIS18-GDS-Team7/Kinchan/pull/67))。`gh issue view --comments` の出力は投稿者と本文が離れて表示され、要約で発言者を取り違えた ([#70](https://github.com/KIS18-GDS-Team7/Kinchan/pull/70))。

## 決定

- AI エージェントに許可するのは、issue・PR の読み取り (`gh issue view` `gh issue list` `gh pr view` `gh pr diff`)、ファイルの読み取り、コメントと inline comment の投稿だけとする。approve、issue・PR の編集・close、`gh api` は許可しない ([#19](https://github.com/KIS18-GDS-Team7/Kinchan/pull/19)、2026/10/04、[#49](https://github.com/KIS18-GDS-Team7/Kinchan/pull/49)、2026/10/07)。
- 未マージのブランチは、workflow が `.branches/<ブランチ名>/` にファイルとして展開する。AI エージェントは展開したファイルを読み、git コマンドは使わない (#95、2026/10/20)。
- `@claude` には応答の方針を与える。issue の論点から外れない、未定義の語を持ち込まない、要件定義と画面設計を混ぜない。発言を引用・要約するときは、投稿者と日時を確かめる (#67、#70)。
- 各 workflow の設定の理由は、その workflow の冒頭のコメントに書く。workflow の変更は platform チームのレビューを受ける ([ADR-0004](./0004-branch-strategy.md))。
