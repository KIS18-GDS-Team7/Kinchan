# GitHub 上の AI エージェントには読み取りとコメントだけを許可する

## ステータス

決定

## 背景

- GitHub Actions で Claude Code を 3 つの用途に使っている。issue・PR での `@claude` への応答 (`.github/workflows/claude.yml`)、PR の自動レビュー (`claude-code-review.yml`)、issue の重複判定 (`issue-dedup.yml`) である ([#17](https://github.com/KIS18-GDS-Team7/Kinchan/pull/17)、[#21](https://github.com/KIS18-GDS-Team7/Kinchan/pull/21)、[#29](https://github.com/KIS18-GDS-Team7/Kinchan/pull/29))。
- AI に任せるときに好き勝手に動かれると困る ([ADR-0001](./0001-record-ADR.md))。
- claude-code-action の既定のツールでは、ファイルの読み書きや、コメント・ブランチ・commit の作成ができる (#17)。
- 最初は閲覧系の gh コマンドも許可されておらず、`@claude` が呼び出し元以外の issue を読めなかった。[#19](https://github.com/KIS18-GDS-Team7/Kinchan/pull/19) で閲覧系のコマンドだけを許可し、書き込み系のコマンドは許可しなかった。#19 には、書き込み系を許可しない理由は書かれていない。
- PR の承認は、作者以外のメンバーとパスごとのチームが行う ([ADR-0004](./0004-branch-strategy.md))。AGENTS.md も、`@claude` の応答を読み取りとコメントだけとしている。
- inline comment のツールは、`--allowed-tools` に明示しないと起動しない。[#49](https://github.com/KIS18-GDS-Team7/Kinchan/pull/49) で、PR の特定の行への指摘を投稿できるように、inline comment のツールだけを足した。
- UC 記述やモックは未マージのブランチにあり、PR がないものは `gh pr diff` でも読めなかった。`git show` `git grep` `git log` を許可する案は、`-O<コマンド>` や `--output=<ファイル>` などのオプションでコマンドの実行やファイルの書き込みができ、前方一致の許可では防げない ([#95](https://github.com/KIS18-GDS-Team7/Kinchan/pull/95))。
- `@claude` の応答が issue の論点から外れることがあった ([#67](https://github.com/KIS18-GDS-Team7/Kinchan/pull/67))。`gh issue view --comments` の出力は投稿者と本文が離れて表示され、要約で発言者を取り違えた ([#70](https://github.com/KIS18-GDS-Team7/Kinchan/pull/70))。

## 決定

- AI エージェントに許可するツールの上限を次のとおりとする。各 workflow は、この範囲のうち用途に必要なものだけを `--allowed-tools` で許可する (#19、2026/10/04、#49、2026/10/07)。
  - 読み取り: `gh issue view` `gh issue list` `gh pr view` `gh pr diff`、ファイルの読み取り。
  - 投稿: Claude が作る tracking comment の更新 (`claude.yml`)、inline comment (`claude.yml` `claude-code-review.yml`)、`gh issue comment` (`issue-dedup.yml`)。
- approve、issue・PR の編集・close、`gh api` は許可しない (#19、#49)。
- 未マージのブランチは、workflow が `.branches/<ブランチ名>/` にファイルとして展開する。AI エージェントは展開したファイルを読み、git コマンドは使わない (#95、2026/10/20)。
- `@claude` には応答の方針を与える。issue の論点から外れない、未定義の語を持ち込まない、要件定義と画面設計を混ぜない。発言を引用・要約するときは、投稿者と日時を確かめる (#67、#70)。
- 各 workflow の設定の理由は、その workflow の冒頭のコメントに書く。workflow の変更は platform チームのレビューを受ける ([ADR-0004](./0004-branch-strategy.md))。
