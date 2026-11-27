# AGENTS.md

勤怠管理システム Kinchan のリポジトリ。AI コーディングエージェント (Claude Code、Codex、Google Antigravity など) はこの文書に従う。人向けの説明は [CONTRIBUTING.md](CONTRIBUTING.md) にある。

## リポジトリの構成

- `docs/requirements/`: 要件定義書
- `docs/usecase/`: ユースケース図とユースケース記述
- `docs/ADR/`: 設計判断の記録。形式は `docs/ADR/0001-record-ADR.md` に従う。見出しは `# タイトル` `## ステータス` `## 背景` `## 決定` の 4 つだけ。番号は 4 桁で、`main` と open な PR (draft を含む) で使われている最大の番号 + 1 を使う (`python3 .github/scripts/adr_numbers.py` が表示する)。ADR を書き始めたら draft でも早めに PR を開く。重複したら後から merge する側が番号を変える。open な PR や close された PR の番号による欠番は残してよい (ADR-0045)
- `.github/`: workflows、CODEOWNERS、PR テンプレート、Rulesets の JSON
- 今後追加予定: `frontend/` `backend/` `database/` `deploy/`

## ブランチと PR

- `main` と `dev/` 配下には直接 push しない。作業ブランチから PR を出す。
- 作業ブランチは `<type>/<topic>` (`docs/` `feat/` `fix/` `ci/`)。PR の base は `main`。`main` への PR の head ブランチを base にした stacked PR も可 (他のメンバーのブランチに出した PR は、そのブランチの作者がマージする)。`dev/feat/<name>` は任意の統合ブランチ。
- `dev/` 配下は保護された統合ブランチ。指示なく新設しない。
- 1 PR 1 関心事。PR 本文は `.github/pull_request_template.md` に従う。他チームの管轄 (`frontend/` `backend/` `.github/` `database/` `deploy/`、Dockerfile など) に触れた場合はその旨を書く。
- コミットメッセージは日本語。1 行目に何をしたかを書く。
- force push、ブランチの削除、タグの作成はしない。

## 触らないもの

- `review/*` `approved/*` タグと GitHub Release。過去の教員レビューの記録で、新たには作らない (ADR-0043)。
- `.github/rulesets/` `.github/CODEOWNERS` `.github/workflows/`。変更が必要なら提案に留め、PR で platform チームのレビューを受ける。
- `.asta` `.png` などのバイナリ。手で編集しない。

## ドキュメントの書き方

- 日本語で書く。英語の技術用語はそのまま使う。
- システムの振る舞いは、人の認知や判断ではなくシステムの動作で書く (「確認する」ではなく「表示する」)。根拠は `docs/ADR/0002-avoid-human-centric-expressions.md`。
- 用語集 (`docs/requirements/requirements.md` の 4 章) で定義されていない語を新たに持ち込まない。未定義なら TBD と書く。根拠は `docs/ADR/0003-avoid-ambiguous-terms.md`。
- 要件定義書はシステムで何ができるか (UC、FR) と用語の定義を扱う。画面の構成やボタン配置は画面設計で扱う。
- 設計判断をしたら ADR を追加する。

## 自動化

- PR を開くと Claude Code Review が自動で走る。再レビューは `claude-review` ラベルを付け直す。
- Issue や PR のコメントで `@claude` と書くと Claude が応答する (読み取りとコメントのみ)。
- Issue を開くと重複チェックが走る。
- PR を開く・push する・再オープンすると、ADR の番号を検査して status `adr-number` を設定する (コメントはしない)。failure の PR は merge できない。failure になったら、status の説明に表示された次の番号にファイル名を変え、その ADR を指す参照 (`ADR-NNNN` の表記とリンク) を書き換える。
