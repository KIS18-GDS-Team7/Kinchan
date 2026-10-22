# 承認済み成果物の Google Drive への納品は Apps Script で行う

## ステータス

決定

## 背景

- 完成品は Google Drive (Shared Drive の見込み) への納品が必要で、教員の標準的な閲覧先は Google Docs である ([ADR-0004](./0004-branch-strategy.md))。
- 承認済みの commit は `approved/<日付>` タグで記録している ([ADR-0004](./0004-branch-strategy.md))。
- リポジトリの全ファイルを Drive に同期する必要はなく、作業途中の文書や内部向けの文書は同期してはならない。納品するものと置き場所は明示的に指定できる必要がある。
- 検討した手段。
  - GitHub Actions から GCP のサービスアカウント (SA) で Drive API を使う案。SA は学校ドメイン外のアカウントであり、Shared Drive のメンバーに追加できるかは Workspace の共有ポリシーに依存する。My Drive のフォルダの場合は、SA がアップロードしたファイルの所有者が SA になる。
  - Google Workspace Studio の案。外部イベントを受ける custom starters と webhooks は管理者が既定で無効にしており、Education エディションでの提供は未確認。GitHub との連携はない。
  - Google Apps Script (GAS) の案。PM の学校アカウントとして動くため、Shared Drive の共有ポリシーに依存しない。リポジトリは public なので、GitHub の API を認証なしで読める。受け口も秘密情報も不要。学校アカウントで GAS が使えることを 2026/10/22 に確認した。
- GAS には YAML パーサがなく、外部ライブラリなしで確実に読める設定形式は JSON のみ。
- Drive API は取り込み時の形式変換に対応しており、Markdown を Google Docs として作成できる見込み。対応状況はアカウントごとに `checkImportFormats` で確認する。

## 決定

- 納品は GAS で行う。コードは `tools/drive-delivery/` に置き、PM の学校アカウントの GAS プロジェクトに clasp で反映する。
- 時間トリガーで `approved/*` タグを読み、新しいタグごとに納品する。GitHub 側に受け口や秘密情報は置かない。
- 納品対象と置き場所は `tools/drive-delivery/manifest.json` に JSON で書く。書かれたものだけを納品し、Drive 側の削除は行わない。変更は PR で行う。
- 既定は `update` モードとし、固定の置き場所の Google Docs を上書きして URL と版履歴を保つ。履歴を分けたい場合は `snapshot` モードで `approved-<日付>/` 配下に置く。
- Markdown は Google Docs に変換し、画像はファイルとして置く。
- 手順は [tools/drive-delivery/README.md](../../tools/drive-delivery/README.md) に書き、[CONTRIBUTING.md](../../CONTRIBUTING.md) の納品の節から参照する。
