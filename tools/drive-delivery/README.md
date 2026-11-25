# drive-delivery

成果物を Google Drive (Shared Drive) に置く Google Apps Script (GAS)。設計判断は [ADR-0042](../../docs/ADR/0042-deliver-main-and-pr-to-drive.md)。

## 置き場所

```
<DRIVE_FOLDER_ID のフォルダ>/
├── 成果物/                                   main の最新
│   ├── 01ユースケース図/
│   ├── 02ユースケースドキュメント/
│   └── ...
└── PR-成果物/
    ├── #130 用語集に所属単位…を追加する-成果物/   PR #130 の差分に含まれる成果物
    │   └── 要件定義書
    └── #125 シーケンス図…を追加する-成果物/
        └── ...
```

- `成果物/`: `main` の最新にある、manifest に一致する全ファイル。`main` が進むと 10 分以内に追従する。
- `PR-成果物/#<番号> <タイトル>-成果物/`: `main` を base とする PR の差分 (削除を除く) のうち、manifest に一致するファイルだけ。次の PR は対象外で、フォルダを作らない。
  - draft の PR
  - fork から出た PR (public repo なので誰でも出せる)
  - 差分に成果物を含まない PR (`ci/` や ADR だけの PR など)
- PR が close (merge を含む) されたとき、draft に戻されたとき、base が `main` 以外に変わったとき、差分から成果物が無くなったときは、PR フォルダごとゴミ箱に移す。共有ドライブのゴミ箱から 30 日間は戻せる。
- PR のタイトルが変わるとフォルダ名も変わる。フォルダの説明欄に PR の URL と head の commit が入る。

## 動作

時間トリガー (10 分ごと) の `poll` が、GitHub の状態に Drive を合わせる。

1. `main` の head が前回と違えば、`main` の manifest とファイル一覧を読み、`成果物/` を更新する。
2. open な PR の一覧を読み、対象外になった PR のフォルダをゴミ箱に移す。
3. 対象の PR ごとに、head が前回と違えば、PR の head の manifest と PR の差分を読み、PR フォルダを更新する。

更新の規則。

- 内容 (git の blob SHA) が前回と同じファイルは触らない。変わったファイルは同じファイルの内容を差し替える (URL と版履歴が残る)。
- 対象から外れたファイルは、script が置いたものに限りゴミ箱に移す。人が手で置いたファイルやフォルダは、更新も削除もしない (PR フォルダごとゴミ箱に移すときを除く)。
- 識別には Drive の `properties` を使う。フォルダには `kinchanPr` (PR 番号) と `kinchanHead` (同期済みの commit)、ファイルには `kinchanManaged` と `kinchanBlob` (blob SHA) が付く。
- approved/* タグで納品していた旧版が置いたファイル (`appProperties.approvedTag` 付き) は script が置いたものとして扱い、同じパスなら引き継いで更新する。

GitHub 側に受け口や秘密情報は置かない (public repo を GAS 側から読むだけ)。

## manifest.json

```json
{
  "entries": [
    {"src": "docs/requirements/requirements.md", "dest": "要件定義書", "convert": "gdoc"},
    {"src": "docs/usecase/*.md", "dest": "02ユースケースドキュメント/", "convert": "gdoc"},
    {"src": "docs/usecase/usecase.svg", "dest": "01ユースケース図/ユースケース図.svg"}
  ]
}
```

| 項目 | 意味 |
|---|---|
| `src` | リポジトリのパス。glob 可 (`*` は 1 階層、`**` は階層をまたぐ。`docs/**/x.md` は `docs/` 直下の `x.md` には一致しない) |
| `dest` | 成果物フォルダ (`成果物/` または PR フォルダ) からの相対パス。`src` が glob、または末尾が `/` ならフォルダ (ファイル名はそのまま)。それ以外はファイル名そのもの (改名できる) |
| `convert` | `gdoc`: Markdown を Google Docs に変換。`none` (既定): そのまま置く |

- 行頭が `//` の行はコメントとして無視される。書かれていないファイルは置かない。
- `main` では `main` の manifest を、PR では PR の head の manifest を使う。manifest を変える PR は、その PR のフォルダで結果を確かめられる。
- PR の head に manifest が無い場合、または旧形式 (`mode` を持ち、`dest` が `成果物/` 始まり) の場合は、`main` の manifest を使う。`main` の manifest が旧形式の間は `成果物/` を変えずにエラーにする。
- `main` で exact な `src` が存在しなければエラー、glob が 0 件なら警告。全エントリで 0 件になった場合は `成果物/` を変えずにエラーにする。PR では差分に無い `src` は単に対象外になる。

## セットアップ (PM の学校アカウントで 1 回)

1. GAS プロジェクトを作る。
   - clasp を使う場合: `clasp login` → `clasp create --type standalone --rootDir tools/drive-delivery --title kinchan-drive-delivery` → `clasp push`。生成される `.clasp.json` は commit しない (gitignore 済み)。
   - 使わない場合: script.google.com で新規プロジェクトを作り、`Code.gs` と `appsscript.json` (プロジェクトの設定で「appsscript.json をエディタで表示」を有効化) を貼り付ける。
2. Script Properties (プロジェクトの設定 → スクリプト プロパティ) を設定する。

   | キー | 値 |
   |---|---|
   | `GITHUB_REPO` | `KIS18-GDS-Team7/Kinchan` |
   | `DRIVE_FOLDER_ID` | `成果物/` と `PR-成果物/` を置くフォルダの ID (URL の `folders/` 以降) |
   | `GITHUB_TOKEN` | 推奨。認証なしの GitHub API は送信元 IP ごとに 60 回/時で、GAS の送信元 IP は他の利用者と共有される。fine-grained PAT で、対象は Public repositories (read-only)、権限の追加は不要 |
   | `BASE_BRANCH` | 任意。既定 `main` |
   | `MAIN_FOLDER_NAME` | 任意。既定 `成果物` |
   | `PR_FOLDER_NAME` | 任意。既定 `PR-成果物` |
   | `MANIFEST_PATH` | 任意。既定 `tools/drive-delivery/manifest.json` |

3. `checkImportFormats` を実行し、Markdown → Google Docs の変換がこのアカウントで使えることを確認する (初回は権限の承認ダイアログが出る)。
4. `dryRun` を実行し、置かれる予定のファイルの一覧をログで確認する (Drive には書き込まない)。
5. `poll` を 1 回手で実行し、Drive に `成果物/` と `PR-成果物/` ができることを確認する。
6. `setup` を実行し、10 分ごとのトリガーを作る。

### 旧版 (approved/* タグで納品) からの移行

- この変更 (新形式の `manifest.json`) が `main` に merge されてから、同じ GAS プロジェクトに `clasp push` し、`setup` を実行し直す (トリガーの間隔が 30 分から 10 分に変わる)。merge 前に push すると、`main` の manifest が旧形式のため `成果物/` の同期がエラーになる。
- Script Properties の `TAG_PREFIX` と `PROCESSED_TAGS` は使わなくなったので削除してよい。
- `要件定義書` の置き場所が Drive の直下から `成果物/要件定義書` に変わる。今の URL を残したい場合は、移行前に Drive 上で `要件定義書` を `成果物/` に移動しておくと、そのファイルが引き継がれる。移動しない場合は `成果物/` に新しく作られ、直下の `要件定義書` はそのまま残る。
- 旧版が置いたファイルを引き継げるのは、旧版と同じ GAS プロジェクトで動かした場合に限る (`appProperties` は作ったプロジェクトからしか読めない)。別のプロジェクトで動かすと同名のファイルが新しく作られる。

## 運用

- 失敗するとトリガーのエラー通知が実行者 (PM) にメールで届く。1 つの PR の失敗は他の PR や `成果物/` の処理を止めない。同期済みの記録は成功したときだけ付くので、原因を直せば次回の実行で再試行される。
- 1 回の実行は 4.5 分で打ち切り、残りは次回に回す (GAS の実行時間の上限は 6 分)。
- PR フォルダを作り直したいときは、Drive 上でそのフォルダをゴミ箱に移す。次回の実行で作り直される。
- script を更新したあとで全体を読み直させたいときは `forceResync` を実行する。内容が同じファイルは再アップロードされない。
- 置くファイルを変えるときは `manifest.json` を PR で変更する (platform の承認が必要)。

## 制限

- SVG は Google Docs に埋め込めないため、画像はファイルとして置く。Markdown 内の相対パスの画像は Docs には取り込まれない。
- Markdown → Google Docs の変換の忠実度は Google の変換に依存する。
- Google Docs の内容を差し替えると、Docs に付いたコメントとコメントを付けた箇所との対応が失われる場合がある (未検証)。内容が変わらないファイルは差し替えない。
- 反映までの遅れは最大でトリガーの間隔 (10 分) と実行時間の和。
- 削除された成果物は PR フォルダに表示されない (差分のうち追加・変更・改名だけを置く)。
- 差分を読むのは PR の head が変わったときだけ。成果物を含まない PR の head は CacheService に最大 6 時間記録し、その間は差分を読み直さない。
