# 図は PlantUML で書いてよく、PNG と SVG は PR の CI で書き出す

## ステータス

決定

## 背景

- 図は astah で描くよう指定があった ([#20](https://github.com/KIS18-GDS-Team7/Kinchan/issues/20))。概念クラス図は astah で描き、`docs/class/conceptual-class-diagram.asta` と書き出した SVG を置いている。
- 教員に見せるのは書き出した SVG・PNG だけでよくなり、`.asta` を見せる必要はなくなった (2026/11/26 時点。出典は TBD)。
- `.asta` はバイナリで、手で編集しない ([AGENTS.md](../../AGENTS.md))。差分をレビューできず、astah を持つメンバーしか図を直せない。
- astah が書き出した概念クラス図の SVG は、文字がグリフのパスになっていて、検索・diff・自動レビューで読めない。
- シーケンス図は、テキストの定義から SVG を書き出す形にした ([ADR-0034](./0034-sequence-diagram-rules.md))。ユースケース図は Mermaid 版を正としている ([ADR-0025](./0025-usecase-diagram-source.md))。
- 概念クラス図は 16 クラスで、従業員から多くの関連が出ている。Mermaid の classDiagram は配置をほとんど指定できない。PlantUML は向きの指定や見えない関連で配置を調整でき、多重度・汎化・ノートも書ける。
- 書き出しを各メンバーの手元で行うと、PlantUML の版・Graphviz・日本語フォントの違いで出力が変わる。

## 決定

- 図は PlantUML (`*.puml`) で書いてよい。教員には、書き出した PNG と SVG を見せる。概念クラス図は PlantUML に移し、移した後は `.asta` を置かない。
- `<name>.puml` から、同じディレクトリに `<name>.png` と `<name>.svg` を書き出す。1 ファイルには図を 1 つだけ書く。
- 書き出しは PR の CI (`.github/workflows/plantuml-render.yml`) で行い、書き出した画像を PR のブランチにコミットする。PlantUML の版は CI で固定する。全員がこのリポジトリのブランチで作業するので、fork からの PR は書き出しの対象にしない。
- SVG の文字は `<text>` 要素の UTF-8 の文字として出力し、検索・diff・自動レビューで読めるようにする (ADR-0034 と同じ考え方)。
- ユースケース図 (ADR-0025)、シーケンス図 (ADR-0034)、画面遷移図の作り方はこの ADR では変えない。
