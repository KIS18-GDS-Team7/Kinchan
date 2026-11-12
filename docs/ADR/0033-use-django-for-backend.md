# backend のフレームワークに Django を使う

## ステータス

決定

## 背景

- [#14](https://github.com/KIS18-GDS-Team7/Kinchan/issues/14) で、backend は Python で作ることにした。PHP はチームに採用を避けたいメンバーが多く、Python は 1・2 組とも講義で扱ったためである (2026/10/03)。
- #14 では Flask と Django を比べる前に、要件を先に決めてから判断することになった (2026/10/04)。その後 Flask に決めたが、理由は先輩の採用実績で、作るものとの相性は比べていない (2026/11/11、[#121](https://github.com/KIS18-GDS-Team7/Kinchan/issues/121))。
- 要件定義書とユースケースが揃った。Kinchan の要件のうち次のものは、Django では標準の機能で扱え、Flask では拡張を選んで組み合わせるか自作する (#121)。
  - ログイン・ログアウト、パスワードの変更 (UC-301・302、UC-102)。Django は標準の auth を使う。Flask は Flask-Login などを組み合わせる。
  - マスタ管理者・勤怠管理者の権限と、管理先による絞り込み (UC-104、UC-109)。Django は標準の権限機構に管理先の絞り込みを足す。Flask はすべて自作する。
  - ユーザー・所属単位・シフト・打刻などのテーブルの設計と変更。Django は ORM と migration が標準である。Flask は SQLAlchemy と Alembic を別に導入する。
  - マスタ管理 (UC-101〜109)。Django は Django admin で早い段階から動くものを用意できる。Flask は画面から作る。
  - CSRF 対策、セッション、パスワードのハッシュ化。Django は既定で有効である。Flask は拡張と設定を揃える。
- UC は 41 件あり、backend は複数人で書く。Django は構成と書き方が規約で決まっている。Flask では部品の選定と構成をチームで決めるところから始まる (#121)。
- 学習コストは Flask の方が低い (#121)。
- 実装はまだ無く、Flask を前提にした文書は要件定義書 9 章の未決事項「Flask を使用して開発する」だけだった (#121)。

## 決定

- backend のフレームワークは Django とし、#14 の Flask の決定を置き換える (#121、backend チーム 2026/11/11、frontend チーム 2026/11/12)。
- 言語は Python のまま変えない (#14)。
- frontend の構成 (SPA にして backend は API だけを提供するか、Django のテンプレートで画面を描画するか) は、この ADR では決めない。要件定義書 9 章の未決事項「PWA形式にしたい」とあわせて決める (#121)。
