# コーディング規約 (Python)

Kinchan の Python コードの書き方を定める。Django / Flask に固有の規約は、フレームワークの決定 ([#121](https://github.com/KIS18-GDS-Team7/Kinchan/issues/121)) 後に追記する。

## 基本方針

- [PEP 8](https://pep8-ja.readthedocs.io/ja/latest/) をベースとする。PEP 8 は Python で最も広く使われている規約で、formatter / linter の多くが準拠している。
- この文書には、PEP 8 で決まっていないことと、PEP 8 と異なる決まりだけを書く。PEP 8 と同じ内容を書くと、片方だけが更新されて食い違う。
- 機械的に検査できる項目は formatter / linter で強制する。人の目による検査は見落としと指摘の揺れが出るため、レビューは設計と挙動に集中させる。ツールは TBD。
- Python のバージョンは TBD。この文書の記法は Python 3.10 以降を前提とする。型ヒントの `X | None` の記法が 3.10 で導入されたため。

## ファイル

- 文字コードは UTF-8、改行は LF とする。ファイルの末尾は改行 1 つで終える。OS やエディタの設定の違いで、内容が同じでも差分が出るのを防ぐ。改行が CRLF と混在すると全行が差分になり、末尾の改行が無いと git の差分に `No newline at end of file` が表示される。

## フォーマット

- 1 行は 79 文字以内とする。PEP 8 の既定値で、変更する根拠がないため既定のままとする。
- 文字列のクォートは `"` に統一する。文字列の中に `"` を含む場合は `'` を使ってよい。PEP 8 はどちらかに統一することだけを求めている。docstring は PEP 257 で `"""` を使うため、通常の文字列もそれに揃える。
- 複数行にわたる引数、リスト、辞書は、最後の要素の後ろにも `,` を付ける。要素を追加したときの差分が 1 行で済む。

  ```python
  values = [
      "a",
      "b",
  ]
  ```

- 文字列の組み立ては f-string を使う。`%` 形式と `str.format()` は使わない。文字列の中の値の位置がそのまま読め、書き方が 1 つに揃う。ログのメッセージには値を埋め込まない (「ログ」を参照)。

## 命名

PEP 8 の命名規則に従う。早見表として次にまとめる。

| 対象 | 形式 | 例 |
| --- | --- | --- |
| module、package | 小文字の snake_case | `date_utils.py` |
| 変数、関数、メソッド | snake_case | `parse_date()` |
| クラス、例外 | PascalCase | `HttpClient`、`InvalidRangeError` |
| 定数 | 大文字の SNAKE_CASE | `MAX_RETRY_COUNT` |
| module やクラスの内部でのみ使う名前 | 先頭に `_` | `_build_query()` |

- 識別子は英語で書く。ローマ字 (`kinmu`) と日本語の識別子は使わない。固有名詞の `kinchan` は除く。ライブラリやフレームワークの識別子は英語であり、混在すると読みにくい。ローマ字は綴りが人によって揺れる (`kinmu` と `kimmu` など)。
- 用語集 (`docs/requirements/requirements.md` の 4 章) の語を識別子にするときの英語表記は TBD。同じ語に複数の英語表記が混在すると、検索で漏れが出るため、用語集で 1 つに決める。
- bool の変数と、bool を返す関数は `is_` `has_` `can_` で始める。名前だけで bool だと分かり、`if user.is_active:` のように条件式が文として読める。
- 略語は使わない。`id` `url` `db` など広く使われているものは使ってよい。略し方は人によって異なり、元の語が分からなくなる。
- 複数の要素を持つ変数は複数形 (`users`)、その要素は単数形 (`user`) にする。`for user in users:` のように、コレクションと要素を名前で区別できる。

## import

- PEP 8 に従う (標準ライブラリ、third-party、プロジェクト内の順にグループ分けし、`from x import *` を使わない)。
- グループ内の並び順はツールで自動的に揃える。手で並べると人によって順序が揺れ、内容と関係の無い差分が出る。ツールは TBD。

## 型ヒント

- 関数とメソッドの引数と戻り値に型ヒントを付ける。戻り値が無い場合も `-> None` を書く。関数の使い方 (渡す値と返る値) が定義を読むだけで分かり、型チェッカーで呼び出しの誤りを実行前に検出できる。エディタの補完も効く。
- 組み込みの型と `|` を使う。`typing.List` `typing.Optional` は使わない。`typing.List` などは Python 3.9 で非推奨になった。`|` は `Optional` より短く読める。

  ```python
  # Good
  def find(names: list[str], key: str) -> str | None: ...

  # Bad
  def find(names: List[str], key: str) -> Optional[str]: ...
  ```

- `Any` は使わない。型が決められない場合は、理由をコメントに書く。`Any` を使った箇所は型チェックが行われず、型ヒントの効果がなくなる。
- 型チェッカーは TBD。

## docstring とコメント

- 日本語で書く。チーム全員が最も正確に読み書きできる言語のため。ログのメッセージは英語とする (「ログ」を参照)。
- public な module、クラス、関数に docstring を書く。形式は Google style とする。呼び出す側が、実装を読まずに使い方を知れる。Google style は `Args` などの見出しで区切るため読みやすく、Sphinx (napoleon 拡張) などのツールが解釈できる。

  ```python
  def split_by_date(
      start: datetime,
      end: datetime,
  ) -> list[tuple[datetime, datetime]]:
      """期間を日付の境界で分割する。

      Args:
          start: 期間の開始日時。timezone 付き。
          end: 期間の終了日時。timezone 付き。

      Returns:
          日付ごとの (開始日時, 終了日時) のリスト。

      Raises:
          ValueError: end が start より前の場合。
      """
  ```

- コメントには、コードから読み取れない理由 (なぜそうしたか) を書く。コードが何をしているかの説明は書かない。コードの説明は、コードを変更したときに更新されず、内容が食い違いやすい。
- TODO には対応する Issue の番号を書く。TODO の対応状況を Issue で追跡できる。

  ```python
  # TODO(#XXX): 祝日の判定を追加する
  ```

- コメントアウトしたコードを残さない。過去のコードは git の履歴で参照できる。

## 例外処理

- 捕捉する例外は具体的な型で書く。`except:` は使わない。`except Exception:` は、ログを出力して再送出する場合に限る。広く捕捉すると、想定していない bug まで握りつぶし、原因の調査が難しくなる。`except:` は `KeyboardInterrupt` や `SystemExit` まで捕捉する。
- 例外を別の例外に変換するときは `from` で元の例外をつなぐ。元の例外の stack trace が残り、原因を辿れる。

  ```python
  try:
      value = int(text)
  except ValueError as e:
      raise InvalidRangeError(text) from e
  ```

## ログ

- 出力形式は JSON とする。形式は logging の設定で一括して指定し、各 module で handler や formatter を追加しない。根拠は [ADR-0029](../ADR/0029-json-logging.md)。
- `print()` を使わず、`logging` を使う。logger は module ごとに `logger = logging.getLogger(__name__)` で作る。`print()` は level や出力先を設定で制御できず、JSON でも出力されない。`__name__` を使うと logger の名前が module の path になり、ログの出力元が分かる。module ごとに level も設定できる。
- メッセージは英語の固定の文字列とし、変わる値は `extra` で渡す。値をメッセージに埋め込むと JSON の `message` の文字列の一部になり、値で検索・集計できない。ライブラリ (Django / Flask など) のログも英語であり、言語の混在を防ぐ。

  ```python
  # Good
  logger.info("login succeeded", extra={"user_id": user_id})

  # Bad
  logger.info(f"login succeeded: user_id={user_id}")
  logger.info("login succeeded: user_id=%s", user_id)
  ```

- `extra` のキーは snake_case とする。LogRecord の属性名 (`name` `msg` `args` `message` `asctime` など) は使えない。使うと `KeyError` になる。
- except 節の中で例外を記録するときは `logger.exception()` を使う。stack trace が出力される。
- パスワード、token などの認証情報と、個人情報をログに出力しない。ログは閲覧できる人と保管先が多く、漏洩の経路になる。

## 日時

- timezone を持たない datetime (naive datetime) を使わない。`datetime.now()` と `datetime.utcnow()` は使わず、`datetime.now(tz=...)` で timezone を指定する。naive datetime の解釈は実行環境の timezone の設定に依存し、環境によって記録した時刻がずれる。`datetime.utcnow()` は Python 3.12 で非推奨になった。
- timezone は標準ライブラリの `zoneinfo.ZoneInfo` で扱う。`pytz` は使わない。`zoneinfo` は Python 3.9 からの標準ライブラリで、追加の依存が要らない。`pytz` は `localize()` を使わずに timezone を渡すと、誤った offset になる。
- 時間の長さの計算は `timedelta` で行う。日をまたぐ勤務 ([ADR-0014](../ADR/0014-time-precision-and-overnight-work.md)) を含め、日付の境界や単位の変換を自前で計算すると誤りやすい。
- 日時を保存するときの timezone は TBD。

## 設定と秘密情報

- パスワード、API key、secret key などをコードに書かず、環境変数から読み込む。`.env` など、秘密情報を含むファイルも commit しない。リポジトリは public であり、一度 commit した値は履歴から消せない。

## その他

- list や dict など mutable な値を、引数の既定値にしない。`None` を既定値にし、関数の中で生成する。既定値は関数の定義時に 1 回だけ生成され、すべての呼び出しで同じオブジェクトが共有される。ある呼び出しでの変更が、次の呼び出しに残る。

  ```python
  # Good
  def add(item: str, items: list[str] | None = None) -> list[str]:
      if items is None:
          items = []
      ...

  # Bad
  def add(item: str, items: list[str] = []) -> list[str]: ...
  ```

- ファイルのパスは `os.path` ではなく `pathlib.Path` で扱う。パスを文字列ではなくオブジェクトとして扱え、結合 (`/`) や拡張子の取得を OS の違いを意識せずに書ける。
- ファイルや接続など、閉じる必要がある資源は `with` で扱う。例外が発生した場合も、資源が確実に閉じられる。
- 意味を持つ数値や文字列は、名前を付けた定数にする。値の意味が名前で分かり、変更するときに 1 か所の修正で済む。

## 未決事項

- [ ] Python のバージョン
- [ ] formatter / linter / 型チェッカーの選定と設定 (Ruff を検討中)
- [ ] 用語集の語に対応する英語の識別子
- [ ] 日時を保存するときの timezone
- [ ] テストの書き方
- [ ] Django / Flask に固有の規約 ([#121](https://github.com/KIS18-GDS-Team7/Kinchan/issues/121))
