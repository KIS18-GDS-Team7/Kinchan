# DBMS は PostgreSQL にする

## ステータス

決定

## 背景

- ER 図 ([#44](https://github.com/KIS18-GDS-Team7/Kinchan/issues/44)) とテーブルレイアウト ([#45](https://github.com/KIS18-GDS-Team7/Kinchan/issues/45)) を作るために、DBMS を決める必要があった ([#100](https://github.com/KIS18-GDS-Team7/Kinchan/issues/100) [1])。PostgreSQL にすることは口頭で決めていたが、記録が無かった。
- backend のフレームワークは Django とした ([ADR-0033](./0033-use-django-for-backend.md))。Django は PostgreSQL・MySQL・SQLite・Oracle を標準で扱う。ADR-0033 では DBMS を決めていない。
- UC 記述と ADR には、DB の制約で表せる決まりがある。
  - 同じ従業員のシフトは、時刻が重ならない。シフトを登録・変更する 4 つの UC すべてで、重複があれば登録・変更・承認しない (UC-201 Alt-3、UC-202 Alt-6、UC-205 Alt-1、UC-213 備考4、A-33)。
  - 同じ所属単位の対象期間は、重ならない (UC-215 備考4、暫定)。
  - 同じシフトに「未処理」のシフト日時変更申請があるときは、送信できない (UC-309 備考7、A-62)。
  - 日をまたぐ勤務があるため、勤務日と開始時刻・終了時刻から開始日時・終了日時を求める ([ADR-0014](./0014-time-precision-and-overnight-work.md)、UC-201 備考5)。
  - 修正前の勤怠記録 (打刻の一覧) を勤怠修正履歴に残す (UC-210 事後条件)。
- PostgreSQL では、上の決まりを EXCLUDE 制約 (btree_gist 拡張)・条件つきの UNIQUE (部分索引)・生成列・jsonb の 4 つで表せる。MySQL には無いか、書き方が違う。
- DB の制約で表さない場合、これらの判定は backend の実装に移る。`backend/` はまだ無く、実装はこれから始まる ([AGENTS.md](../../AGENTS.md))。
- この 4 つが PostgreSQL 17 で動くことは、Django の model に移して手元で確かめた。

## 決定

- DBMS は PostgreSQL とする。版は 12 以上とする。生成列が 12 以降で使えるためである。
- 上の決まりのうち、次のものは DB の制約で表す。backend の実装での判定に任せない。
  - シフトの時刻の重なりと、対象期間の重なりの禁止: `EXCLUDE USING gist`。btree_gist 拡張を有効にする。
  - 「未処理」の申請を 1 件までとする制限: 条件つきの UNIQUE (部分索引)。
  - シフトの開始日時・終了日時: 生成列。
  - 勤怠修正履歴に残す打刻の一覧: jsonb。
- これにより、#100 の [1] (DB を MySQL にするか PostgreSQL にするか) は決まったものとする。
- 使う版の具体的なバージョンとその設定は、この ADR では決めない。`deploy/` を作るときに決める。
