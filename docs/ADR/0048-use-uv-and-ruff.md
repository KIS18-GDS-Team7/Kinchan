# backend のパッケージ管理に uv、formatter / linter に Ruff を使う

## ステータス

決定

## 背景

- backend は Python と Django で作り、複数人で書く ([ADR-0033](./0033-use-django-for-backend.md)、[#121](https://github.com/KIS18-GDS-Team7/Kinchan/issues/121))。`backend/` はまだ無く、実装はこれから始まる。
- Python のバージョンと依存パッケージのバージョンは、メンバーの手元、CI、deploy 先で揃える必要がある。揃っていないと、ある環境でだけ動かない、テストが落ちる、といった差が出る。
  - 標準の pip と venv では、Python 本体の導入、仮想環境の作成、依存の記録 (`requirements.txt`) を別々に行う。`requirements.txt` に直接の依存だけを書くと、間接的な依存のバージョンは導入した時期によって変わる。
- uv は、次のことを 1 つのコマンドで扱う。
  - Python 本体の導入。`.python-version` に書いたバージョンが手元に無ければ、取得して使う。
  - 仮想環境の作成と、`pyproject.toml` に書いた依存の導入。
  - ロックファイル (`uv.lock`)。間接的な依存も含めて、すべてのパッケージのバージョンを記録する。`uv sync` で、記録どおりの環境を作る。`uv.lock` は OS ごとに分かれず、Windows・macOS・Linux で同じファイルを使う。
- コーディング規約の案 ([#123](https://github.com/KIS18-GDS-Team7/Kinchan/pull/123)) では、機械的に検査できる項目は formatter / linter で強制するとしている。ツールは TBD で、Ruff を検討中としている。
- Ruff は formatter (`ruff format`) と linter (`ruff check`) を 1 つのツールで提供する。
  - formatter は Black と互換である。linter は flake8・isort・pyupgrade などの規則を含む。Django に固有の規則 (flake8-django) と、#123 の案で選んだ Google style の docstring の検査も含む。
  - 設定は `pyproject.toml` に書ける。uv の設定と同じファイルで管理できる。
  - Black・isort・flake8 を組み合わせる場合は、ツールごとに設定とバージョンを揃える必要がある。
- formatter / linter のバージョンがメンバーごとに違うと、同じコードでも整形の結果と検査の結果が変わる。
- ルートの `.gitignore` に `*.lock` があり、このままでは `uv.lock` も git の管理から外れる。

## 決定

- backend の Python のバージョン、仮想環境、依存パッケージは uv で管理する。pip や venv で直接管理せず、`requirements.txt` は作らない。
  - `pyproject.toml` と `.python-version` は `backend/` に置く。
  - 依存は `uv add` で追加する。開発にだけ使うもの (Ruff など) は、dev の依存グループ (`uv add --dev`) に入れる。
  - `uv.lock` を commit する。`.gitignore` に `!uv.lock` などの例外を追加する。
  - backend のコマンドは `uv run` で実行する (例: `uv run python manage.py runserver`)。
- formatter と linter は Ruff とする。
  - Ruff は dev の依存グループに入れ、`uv.lock` でバージョンを揃える。
  - 設定は `backend/pyproject.toml` の `[tool.ruff]` に書く。1 行の長さは、#123 の案に合わせて 79 文字とする (Ruff の既定は 88 文字)。
  - 有効にする規則は、コーディング規約で決める。
- 次のものは、この ADR では決めない。
  - Python のバージョン (#123 の案の未決事項)。
  - 型チェッカー。
  - CI での検査 (`uv sync --locked`、`ruff format --check`、`ruff check` など)。`.github/workflows/` の変更として、platform チームに提案する。
  - Dockerfile での uv の使い方。`deploy/` を作るときに platform チームと決める。
