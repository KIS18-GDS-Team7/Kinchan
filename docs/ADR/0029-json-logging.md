# backend のログは JSON で出力し、値はメッセージに埋め込まない

## ステータス

決定

## 背景

- backend のログの出力形式が決まっていなかった。deploy 先とログの収集基盤も未定で、要件定義書の NFR-004 (運用・保守) は TBD である。
- ログの出力形式は logging の formatter が決める。各 module は logger を呼ぶだけで、出力形式には関与しない。
- 変わる値をメッセージの文字列に埋め込むと、出力形式を JSON にしても値は `message` の文字列の一部になり、値で検索・集計できない。呼び出し側の書き方を後から変えるには、すべての呼び出し箇所の修正が必要になる。
- Django と Flask はどちらも標準ライブラリの `logging` を使う。この判断はフレームワークの選定 ([#121](https://github.com/KIS18-GDS-Team7/Kinchan/issues/121)) に依存しない。
- 検討した案。
  - text 形式で出力する案。人は読みやすいが、収集基盤で値ごとに検索・集計できない。
  - `structlog` を使う案。request_id などの文脈情報をまとめて付けやすいが、書き方が標準の `logging` と異なり、学習コストが増える。
  - 標準の `logging` で書き、JSON への変換は `python-json-logger` の formatter で行う案。書く側は標準の `logging` のままで、学習コストが最も小さい。

## 決定

- backend のログは JSON で、1 行に 1 件ずつ出力する (2026/11/11)。
- 書く側は標準ライブラリの `logging` を使う。JSON への変換は `python-json-logger` の formatter で行い、logging の設定で一括して指定する。各 module で handler や formatter を追加しない。
- すべてのログに timestamp (ISO 8601、timezone 付き)、level、logger、message を含める。request_id の付与は、フレームワークの決定後に定める。
- ローカルの開発環境では text 形式で出力してよい。形式は環境ごとの設定で切り替える。
- 変わる値はメッセージに埋め込まず、`extra` で渡す。メッセージは英語の固定の文字列とする。書き方の詳細は [コーディング規約 (Python)](../coding-conventions/python-django.md) に書く。
- ログの出力先と収集基盤は、deploy 先の決定時に定める。
