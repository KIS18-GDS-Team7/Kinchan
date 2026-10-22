# drive-delivery

承認済み成果物を Google Drive (Shared Drive) に納品する Google Apps Script (GAS)。

## 動作

1. 時間トリガー (30 分ごと) が GitHub の `approved/*` タグを一覧し、未処理のタグを見つける。
2. そのタグの commit にある `tools/drive-delivery/manifest.json` を読む。
3. manifest に書かれたファイルだけを取得し、Drive の指定フォルダ配下に置く。Markdown は Google Docs に変換する。
4. 処理済みタグを Script Properties に記録する。

GitHub 側に受け口や秘密情報は置かない (public repo を GAS 側から読むだけ)。Drive 側のファイルを削除することはない。

## manifest.json

```json
{
  "mode": "update",
  "entries": [
    {"src": "docs/requirements/requirements.md", "dest": "要件定義書", "convert": "gdoc"},
    {"src": "docs/usecase/*.md", "dest": "ユースケース/", "convert": "gdoc"},
    {"src": "docs/usecase/usecase.svg", "dest": "ユースケース/ユースケース図.svg"}
  ]
}
```

| 項目 | 意味 |
|---|---|
| `mode` | `update`: 固定の置き場所を上書きする。既存の Google Docs は内容だけ差し替わり、URL と版履歴が残る。`snapshot`: `approved-<日付>/` フォルダを作って毎回新しく置く |
| `src` | リポジトリのパス。glob 可 (`*` は 1 階層、`**` は階層をまたぐ。`docs/**/x.md` は `docs/` 直下の `x.md` には一致しない)。exact なパスが存在しなければエラー、glob が 0 件なら警告 |
| `dest` | Drive 上の相対パス。`src` が glob、または末尾が `/` ならフォルダ (ファイル名はそのまま)。それ以外はファイル名そのもの (改名できる) |
| `convert` | `gdoc`: Markdown を Google Docs に変換。`none` (既定): そのまま置く |

行頭が `//` の行はコメントとして無視される。書かれていないファイルは一切同期しない。

納品したファイルには `description` にタグ名と commit、`appProperties` に `approvedTag` / `commit` が付く。

## セットアップ (PM の学校アカウントで 1 回)

1. GAS プロジェクトを作る。
   - clasp を使う場合: `clasp login` → `clasp create --type standalone --rootDir tools/drive-delivery --title kinchan-drive-delivery` → `clasp push`。生成される `.clasp.json` は commit しない (gitignore 済み)。
   - 使わない場合: script.google.com で新規プロジェクトを作り、`Code.gs` と `appsscript.json` (プロジェクトの設定で「appsscript.json をエディタで表示」を有効化) を貼り付ける。
2. Script Properties (プロジェクトの設定 → スクリプト プロパティ) を設定する。

   | キー | 値 |
   |---|---|
   | `GITHUB_REPO` | `KIS18-GDS-Team7/Kinchan` |
   | `DRIVE_FOLDER_ID` | 納品先フォルダの ID (URL の `folders/` 以降) |
   | `GITHUB_TOKEN` | 任意。GitHub API の rate limit (無認証 60 回/時) が足りないときだけ。fine-grained PAT、public repo の Contents: read で十分 |
   | `TAG_PREFIX` | 任意。既定 `approved/` |
   | `MANIFEST_PATH` | 任意。既定 `tools/drive-delivery/manifest.json` |

3. `checkImportFormats` を実行し、Markdown → Google Docs の変換がこのアカウントで使えることを確認する (初回は権限の承認ダイアログが出る)。
4. `deliverLatest` を実行し、最新の `approved/*` タグの内容が Drive に置かれることを確認する。
5. `setup` を実行し、30 分ごとのトリガーを作る。

## 運用

- `approved/<日付>` タグを打つと、30 分以内に Drive に反映される。
- 失敗するとトリガーのエラー通知が実行者 (PM) にメールで届く。処理済みにはならないので、原因を直せば次回の実行で再試行される。
- 手動で再納品したいときは `deliverLatest`。処理済みの記録を消すときは `resetProcessed`。
- 納品対象を変えるときは `manifest.json` を PR で変更する。タグ時点の manifest が使われる。

## 制限

- SVG は Google Docs に埋め込めないため、画像はファイルとして置く。Markdown 内の相対パスの画像は Docs には取り込まれない。
- Markdown → Google Docs の変換の忠実度は Google の変換に依存する。
- `update` モードで既存ファイルの更新に失敗した場合は、新規作成して古い方をゴミ箱に移す (URL が変わる)。ログに警告が出る。
