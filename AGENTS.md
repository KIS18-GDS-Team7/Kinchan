# AGENTS.md

勤怠管理システム Kinchan のリポジトリ。AI コーディングエージェント (Claude Code、Codex、Google Antigravity など) はこの文書に従う。人向けの説明は [CONTRIBUTING.md](CONTRIBUTING.md) にある。

## リポジトリの構成

- `docs/requirements/`: 要件定義書
- `docs/usecase/`: ユースケース図とユースケース記述
- `docs/ADR/`: 設計判断の記録。形式は `docs/ADR/0001-record-ADR.md` に従う。見出しは `# タイトル` `## ステータス` `## 背景` `## 決定` の 4 つだけ。番号は 4 桁の連番で、欠番と重複を作らない
- `.github/`: workflows、CODEOWNERS、PR テンプレート、Rulesets の JSON
- 今後追加予定: `frontend/` `backend/` `database/` `deploy/`

## ブランチと PR

- `main` と `dev/` 配下には直接 push しない。作業ブランチから PR を出す。
- 作業ブランチは `<type>/<topic>` (`docs/` `feat/` `fix/` `ci/`)。PR の base は `main`。複数 PR で進める feature だけ `dev/feat/<name>` を base にする。
- `dev/` 配下は保護された統合ブランチ。指示なく新設しない。
- 1 PR 1 関心事。PR 本文は `.github/pull_request_template.md` に従う。他チームの管轄 (`frontend/` `backend/` `.github/` `database/` `deploy/`、Dockerfile など) に触れた場合はその旨を書く。
- コミットメッセージは日本語。1 行目に何をしたかを書く。
- force push、ブランチの削除、タグの作成はしない。

## 触らないもの

- `review/*` `approved/*` タグと GitHub Release。教員レビューの記録で、PM だけが作る。
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
