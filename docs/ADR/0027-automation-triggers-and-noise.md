# PR の自動レビューと issue の重複判定は、区切りでだけ動かし同じ指摘を重ねない

## ステータス

決定

## 背景

- PR の自動レビューは、最初は code-review プラグインで動かしていた。過去の run はすべて 2 ターン・数秒で終わり、PR に何も投稿していなかった ([#29](https://github.com/KIS18-GDS-Team7/Kinchan/pull/29))。
- push のたびにレビューすると、修正途中の commit にも指摘がつく。`@claude` が push すると起動者が bot になり、workflow が失敗した ([#51](https://github.com/KIS18-GDS-Team7/Kinchan/pull/51))。
- [#50](https://github.com/KIS18-GDS-Team7/Kinchan/pull/50) では、再レビューのたびに同じ指摘が新しいスレッドとして投稿され、それぞれ 4 回ずつ並んだ (#51)。重複したスレッドを整理のために解決済みにしたところ、直っていない指摘が総評から漏れた ([#52](https://github.com/KIS18-GDS-Team7/Kinchan/pull/52))。
- issue の重複判定の最初のテストで、[#20](https://github.com/KIS18-GDS-Team7/Kinchan/issues/20) の下位タスクを重複として誤って検出した ([#24](https://github.com/KIS18-GDS-Team7/Kinchan/pull/24))。

## 決定

- PR の自動レビューは、PR の opened・ready_for_review・reopened のときにだけ動かす。draft の PR は対象にせず、push のたびには動かさない (#51、2026/10/07)。
- 再レビューは、PR に `claude-review` ラベルを付けて依頼する。ラベルによる依頼は draft の PR でも動かす。ラベルはレビューの後に workflow が外す (#51)。
- レビューの指示は、プラグインではなく prompt で明示する (#29)。
- 総評は PR ごとに 1 つのコメントを更新し、指摘は inline comment に書く。再レビューでは、未解決の既存の指摘を総評に挙げるだけにし、人が解決済みにした指摘は再び指摘しない。同じ問題に未解決のスレッドが 1 つでも残っていれば、未解決として扱う (#51、#52)。
- issue の重複判定は、issue を開いたときに動かす。重複の基準は「既存の issue が解決すれば、新しい issue が不要になるか」だけとする。包含関係・下位タスク・次の論点は重複として扱わない (#24、2026/10/06)。
- 重複の候補がなければコメントしない。候補には番号・タイトル・理由だけを書き、close や統合などの対応は人が決める ([#21](https://github.com/KIS18-GDS-Team7/Kinchan/pull/21))。
