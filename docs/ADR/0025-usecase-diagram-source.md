# ユースケース図は astah で起こし直すまで SVG 版と Mermaid 版を正とする

## ステータス

決定

## 背景

- UC 図を含め、図は astah で描くよう指定があった ([#20](https://github.com/KIS18-GDS-Team7/Kinchan/issues/20))。
- UC 記述を全件書き直したとき、astah の図 (`usecase.asta`・`usecase.png`) は古い UC の一覧のままだった ([#98](https://github.com/KIS18-GDS-Team7/Kinchan/pull/98))。
- «extend» の書き方が UML の表記と合っていなかった ([#104](https://github.com/KIS18-GDS-Team7/Kinchan/pull/104))。
- 打刻の UC にだけ «Abstract» のまとまりがなく、ほかのアクターの UC と見た目がそろっていないという指摘があった (#98)。
- `.asta` などのバイナリは手で編集しない ([AGENTS.md](../../AGENTS.md))。astah の図から画像を書き出す CI はまだない。

## 決定

- astah の図を削除し、astah で起こし直すまでは `docs/usecase/usecase.svg` と `docs/usecase/usecase-diagram.md` の Mermaid 版をユースケース図とする (#98、2026/10/22)。
- 拡張点は、拡張される UC の楕円の中に extension points の区画を設け、条件の形で書く。«extend» の矢印のラベルは «extend» だけにする (#104、2026/10/22)。
- «Abstract» の UC は図を見やすくするためのまとまりで、UC 記述は作らない (#98)。
- astah の図から画像を自動で書き出す CI と、書き出すファイルの名前は、この ADR では決めない。
