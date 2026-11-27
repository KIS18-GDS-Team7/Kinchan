# コーディング規約 (Python / Django)

Kinchan の backend の Python コードの書き方を定める。backend のフレームワークは Django とする ([ADR-0033](../ADR/0033-use-django-for-backend.md))。Python 全般の規約の後に、「Django」の章で Django に固有の規約を書く。

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
- メッセージは英語の固定の文字列とし、変わる値は `extra` で渡す。値をメッセージに埋め込むと JSON の `message` の文字列の一部になり、値で検索・集計できない。Django などのライブラリのログも英語であり、言語の混在を防ぐ。

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
- 日時は UTC で保存する (「Django」の「日時」を参照)。

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

## Django

この章には、Django で書き方を複数選べるものと、誤りやすいものだけを書く。view と template の規約は、frontend の構成 (SPA にして backend は API だけを提供するか、Django のテンプレートで画面を描画するか) の決定後に追記する。

コード例の model 名 (`Entry` など) は仮のもの。

### 基本方針

- Django が標準で持つ機能を優先して使う。third-party の package を追加するときは、標準の機能で足りない理由を PR に書く。Django を選んだ理由は標準の機能で要件の多くを扱えることであり ([ADR-0033](../ADR/0033-use-django-for-backend.md))、package を足すほど、選定と学習の負担と、依存の更新の手間が増える。

### 構成

- settings を置く project の package は `config` とする。`kinchan/kinchan/` のように同じ名前の階層が重ならず、設定の package であることが名前で分かる。
- app は model のまとまりで分ける。権限 (マスタ管理者権限・勤怠管理者権限) では分けない。同じ model を、権限の異なるユーザーが扱う。権限で分けると、1 つの model の処理が複数の app に散らばる。app の分け方と名前は、用語集の英語表記とあわせて決める (TBD)。
- app の中では、処理を次のように置く。

  | file | 置くもの |
  | --- | --- |
  | `models.py` | model、QuerySet、1 つの model で完結する処理 |
  | `services.py` | 複数の model にまたがる操作 |
  | `views.py` | request から値を取り出し、`services.py` などを呼び、response を返す処理 |
  | `admin.py` | Django admin の設定 |
  | `tests/` | テスト |

- view には業務上の規則を書かない。view に書くと、同じ操作を Django admin、別の view、テストから呼べず、処理が重複する。frontend の構成が API とテンプレートのどちらに決まっても、書き換えるのが view だけで済む。
- 入力の形式 (必須か、桁数、日時として解釈できるか) は入力を受け取る層 (form など) で検査する。業務上の規則 (受付期間内か、期限内かなど) は `services.py` か model で検査する。業務上の規則を form に書くと、form を通らない書き込み (Django admin、別の view) に規則が適用されない。
- 別の app の model を ForeignKey で参照するときは、`"<app_label>.<Model>"` の文字列で指定する。model を import すると、2 つの app が互いに参照したときに循環 import になる。
- 業務上の処理を signal (`post_save` などの receiver) で行わない。処理の流れが関数の呼び出しから辿れなくなる。`QuerySet.update()` と `bulk_create()` では `post_save` が送られず、書き込みの方法によって処理が実行されない。

### settings

- settings は `config/settings.py` の 1 ファイルとし、環境ごとの差分 (DB の接続先、`DEBUG`、ログの形式など) は環境変数で与える。環境ごとにファイルを分けると、値がどのファイルで上書きされたかを辿る必要がある。環境変数にすると、環境ごとの差分が変数の一覧として見える。
- deploy 先で危険になる値を既定値にしない。`DEBUG` の既定値は `False` とする。`SECRET_KEY` は既定値を持たず、未設定なら起動時にエラーにする。環境変数を設定し忘れたまま `DEBUG = True` で公開されると、エラー時に設定値と stack trace が表示される。

### model

- ユーザーの model は、最初の migration の前に `AbstractUser` を継承して作り、`AUTH_USER_MODEL` に指定する。Django 標準の `User` で足りる場合も同様とする。権限 ([ADR-0012](../ADR/0012-actors-and-permissions.md)) や所属 ([ADR-0007](../ADR/0007-flat-organization-units.md)) など、ユーザーに項目を追加する見込みがある。`AUTH_USER_MODEL` は、migration を作った後に変更すると、migration と DB の作り直しが必要になる。
- ユーザーの model を参照するときは、ForeignKey では `settings.AUTH_USER_MODEL`、それ以外では `get_user_model()` を使う。`django.contrib.auth.models.User` を import しない。import すると、`AUTH_USER_MODEL` に指定した model ではなく、Django 標準の `User` を参照する。
- model のクラスの中は、Django の [coding style](https://docs.djangoproject.com/en/stable/internals/contributing/writing-code/coding-style/#model-style) の順に並べる (field、custom manager、`class Meta`、`__str__()`、`save()`、`get_absolute_url()`、その他の method)。どの model でも同じ位置に同じものがあり、探さずに読める。
- すべての model に `__str__()` を定義する。Django admin と shell で、object が `Entry object (1)` ではなく内容で表示される。
- 文字列の field (`CharField`、`TextField`) に `null=True` を付けない。値が無いことは `""` で表す。`null=True` を付けると、値が無いことの表し方が `NULL` と `""` の 2 つになり、検索の条件も 2 つ必要になる。`unique=True` で空を許す場合だけは、空の行どうしが重複と判定されないように `null=True` を付ける。
- ユーザーを参照する ForeignKey の `on_delete` は `models.PROTECT` とする。ユーザーの削除は論理削除で、削除したユーザーの勤怠記録と申請は残す ([ADR-0013](../ADR/0013-logical-user-deletion.md))。`CASCADE` にすると、Django admin などからユーザーを物理削除したときに、勤怠記録と申請も削除される。
- ForeignKey と ManyToManyField には `related_name` を付ける。既定の逆参照の名前 (`<model>_set`) では、どの field による参照かが分からない。同じ model を 2 つの field で参照する場合 (申請したユーザーと承認したユーザーなど) は、`related_name` が無いとエラーになる。
- 取り得る値が決まっている field (シフト希望の処理状態 ([ADR-0016](../ADR/0016-shift-request-states.md)) など) は、`models.TextChoices` で値を定義する。値の一覧が 1 か所にまとまり、文字列を直に書いたときの綴りの誤りを防げる。DB に保存する値と、表示するラベルを分けて持てる。
- 複数の行や field にまたがる整合性 (一意性、値の範囲など) は、`Meta.constraints` (`UniqueConstraint`、`CheckConstraint`) で DB の制約にする。form などでの検査だけでは、form を通らない書き込みと、同時に届いた 2 つの request による書き込みで整合性が崩れる。

### migration

- model を変更した PR には、`makemigrations` で生成した migration を含める。migration が無いと、他の人の環境で model と DB の構造が食い違う。
- migration には `makemigrations --name` で内容を表す名前を付ける。自動で付く名前は、操作の名前を並べたものか日時になり、変更の目的が分からない。
- base の branch に merge された migration は、編集も削除もしない。修正は新しい migration で行う。適用済みの環境では編集後の migration が再び適用されず、環境ごとに DB の構造が食い違う。
- 2 つの PR が同じ app で同じ番号の migration を作ったときは、後から merge する PR に base の branch を取り込み、自分の migration を作り直す。`makemigrations --merge` は使わない。merge 用の migration で履歴が分岐し、適用の順序を読み取りにくくなる。
- データを書き換える migration (`RunPython`) では、model を import せず `apps.get_model()` で取得する。import した model は最新の定義であり、後で field を変更すると、過去の migration を実行できなくなる。`reverse_code` も指定する。指定しないと、その migration より前の状態に戻せない。

  ```python
  def fill_status(apps, schema_editor) -> None:
      Entry = apps.get_model("<app_label>", "Entry")
      ...
  ```

### query

- 関連する object を一覧で参照するときは、`select_related()` (ForeignKey) と `prefetch_related()` (逆参照、ManyToManyField) で一緒に取得する。一緒に取得しないと、一覧の 1 行ごとに query が発行される (N+1 問題)。複数の従業員のシフトを並べる一覧などで起きやすい。

  ```python
  # Good: query は 1 回
  entries = Entry.objects.select_related("user")
  usernames = [entry.user.username for entry in entries]

  # Bad: entry ごとに user を取得する query が発行される
  entries = Entry.objects.all()
  usernames = [entry.user.username for entry in entries]
  ```

- 権限による絞り込み (勤怠管理者には管理先の所属単位のデータだけを返すなど、[ADR-0007](../ADR/0007-flat-organization-units.md)) は QuerySet の method にまとめ、view はその method を通して取得する。view ごとに filter を書くと、書き忘れた view が他の所属単位のデータを返す。
- SQL を直接書かない (`raw()`、`connection.cursor()`)。ORM で書けない場合に限り使い、値は parameter で渡す。「フォーマット」の f-string の規約は SQL には適用しない。f-string などで値を SQL に埋め込むと、SQL injection が起きる。

  ```python
  # Good
  cursor.execute("SELECT ... WHERE id = %s", [entry_id])

  # Bad
  cursor.execute(f"SELECT ... WHERE id = {entry_id}")
  ```

### transaction

- 複数の行を書き込む操作は、`services.py` の関数の中で `transaction.atomic()` で囲む。途中で失敗すると、一部の行だけが書き込まれる。たとえばシフト希望を承認する操作で、シフト希望の処理状態だけが「承認済」になり、シフトが登録されない ([ADR-0016](../ADR/0016-shift-request-states.md))。
- `ATOMIC_REQUESTS` は使わない。`ATOMIC_REQUESTS` ではすべての request が transaction になり、どの操作に transaction が必要かがコードから読み取れない。view を通らない呼び出し (テスト、管理用の command) では transaction にならない。

### URL

- URLconf の各 path に `name` を付け、app ごとに `app_name` で名前空間を分ける。URL は `reverse()` などで名前から組み立て、パスを文字列で書かない。URL を変更したときに、修正が URLconf の 1 か所で済む。

### 認証とセキュリティ

- ログイン、ログアウト、パスワードの変更とハッシュ化は `django.contrib.auth` を使い、自作しない ([ADR-0033](../ADR/0033-use-django-for-backend.md))。自作すると、session の固定化やパスワードの保存方法などの対策を自分で揃える必要がある。
- ログインしていない request を既定で拒否する設定にし、ログインの処理など例外の view だけを個別に許可する。view ごとに検査を書く方式では、検査を書き忘れた view をログインせずに使える。設定の方法は frontend の構成の決定後に定める (テンプレートで描画する場合は Django 5.1 以降の `LoginRequiredMiddleware`)。
- `csrf_exempt` を使わない。Django の CSRF 対策は既定で有効であり、外すと、ログイン中のユーザーの権限で、他のサイトから操作を実行される。
- `mark_safe()` と template の `|safe` で、入力された値をそのまま HTML として出力しない。HTML の escape が外れ、XSS が起きる。

### Django admin

- ユーザーの admin では削除の操作を無効にする (`has_delete_permission()` で `False` を返す)。Django admin の削除は物理削除であり、論理削除 ([ADR-0013](../ADR/0013-logical-user-deletion.md)) を経ずにユーザーが削除される。

### 日時

- `USE_TZ = True` (Django 5.0 以降の既定値)、`TIME_ZONE = "Asia/Tokyo"` とする。日時は DB に UTC で保存され、表示と入力では `TIME_ZONE` の timezone に変換される。保存する値が、実行環境の timezone の設定に依存しない。
- 現在の日時は `django.utils.timezone.now()` で取得する。「日時」の `datetime.now(tz=...)` の代わりに使う。timezone を指定し忘れる余地が無い。
- 現在の日付は `timezone.localdate()` で取得する。`date.today()` と `timezone.now().date()` は使わない。`timezone.now()` は UTC の日時を返すため、`.date()` は日本時間の 0:00〜9:00 の間、前日の日付になる。出勤打刻を行った日で勤怠記録を決める処理 ([ADR-0014](../ADR/0014-time-precision-and-overnight-work.md)) で、日付を誤る。`date.today()` は実行環境の timezone に依存する。日時から日付を求めるときも、`timezone.localtime()` で変換してから `.date()` を取る。

  ```python
  # Good
  today = timezone.localdate()
  work_date = timezone.localtime(recorded_at).date()

  # Bad
  today = timezone.now().date()
  work_date = recorded_at.date()
  ```

### ログ

- logging の設定は settings の `LOGGING` に書く ([ADR-0029](../ADR/0029-json-logging.md))。`disable_existing_loggers` は `False` とする。`True` にすると、Django とライブラリの logger が無効になり、それらが出力するエラーが記録されない。

## 未決事項

- [ ] Python と Django のバージョン (Django 5.2 は LTS で 2028 年 4 月までサポートされる。Django 6.0 以降は Python 3.12 以降が必要)
- [ ] formatter / linter / 型チェッカーの選定と設定 (Ruff を検討中)
- [ ] 用語集の語に対応する英語の識別子と、app の分け方
- [ ] テストの書き方 (Django の test runner か pytest-django か)
- [ ] frontend の構成に依存する規約 (view、template、Django REST framework を使うか、ログインを既定で要求する設定)
- [ ] 権限 (マスタ管理者権限・勤怠管理者権限) と管理先の、model での表し方 (Django の Group・Permission を使うか、ユーザーの field にするか)
- [ ] ユーザーの論理削除 ([ADR-0013](../ADR/0013-logical-user-deletion.md)) に `is_active` を使うか。`is_active` が `False` のユーザーは、Django 標準の認証でログインできない
- [ ] Django admin を UC の画面 (マスタ管理、UC-101〜109) として使うか
- [ ] ログへの request_id の付与 ([ADR-0029](../ADR/0029-json-logging.md))
- [ ] CI での検査 (`makemigrations --check`、`check --deploy`)。`.github/workflows/` の変更は platform チームに提案する
