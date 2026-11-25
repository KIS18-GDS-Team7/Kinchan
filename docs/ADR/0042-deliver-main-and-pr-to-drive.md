# Google Drive の成果物フォルダを main と PR ごとに分けて置く

## ステータス

決定

## 背景

- [ADR-0005](./0005-deliver-via-apps-script.md) では、`approved/*` タグを契機に Apps Script (GAS) が成果物を Google Drive に置く。Drive 側の削除は行わない。
- 2026/11/25 時点で、教員の閲覧先を GitHub から Google Drive の成果物フォルダに移す運用が検討されている。教員に見せたいのは、`main` の状態と、`main` に入る前の PR の変更内容の 2 つである。
- `approved/*` タグを契機にすると、`main` に入った変更が Drive に出るのは教員の承認後になる。`main` は常に教員に見せられる状態に保つ決まりである ([ADR-0004](./0004-branch-strategy.md))。
- PR は作業中に何度も push され、close されると不要になる。不要になったフォルダが Drive に残ると、どれが最新か判別できない。
- 検討した手段。
  - GAS の時間トリガーで `main` の head と open な PR の一覧を読み、Drive の状態と突き合わせる案。ADR-0005 の仕組みの延長で、受け口も秘密情報も不要。取りこぼしたイベントがあっても次回の実行で追いつく。反映はトリガーの間隔だけ遅れる。
  - GitHub Actions の `pull_request` イベントから GAS の Web App を呼ぶ案。即時に反映されるが、Web App の公開 URL と共有の秘密情報が必要で、取りこぼしたイベントを再送する仕組みも別に要る。`.github/workflows/` の変更になる。
- PR フォルダに置く範囲として、PR の head の全成果物と、PR の差分に含まれる成果物だけ、の 2 案がある。全成果物を置くと PR の数だけ同じファイルが並び、PR で何が変わったかがフォルダから判別できない。
- リポジトリは public で、fork からの PR は誰でも出せる。fork の PR を対象にすると、外部の内容が学校の Drive に置かれる。
- GitHub API は認証なしだと送信元 IP ごとに 1 時間 60 回までで、GAS の送信元 IP は他の利用者と共有される。10 分ごとの実行では、変化が無いときでも 1 回あたり 2 回 (`main` の head と PR の一覧) を呼ぶ。
- Drive の `appProperties` は作成したアプリ (GAS プロジェクト) からしか読めない。`properties` はどのアプリからも読める。
- 共有ドライブのゴミ箱に移したファイルは 30 日間は戻せる。
- GAS の 1 回の実行時間の上限は 6 分。

## 決定

- 次の 2 か所に置く。同じ `manifest.json` の対応表を使い、`dest` は成果物フォルダからの相対パスとする。
  - `成果物/`: `main` の最新にある、manifest に一致する全ファイル。`main` の manifest を使う。
  - `PR-成果物/#<番号> <タイトル>-成果物/`: `main` を base とし、draft ではなく、同じリポジトリのブランチから出た PR ごとに作る。PR の差分 (削除を除く) のうち manifest に一致するファイルだけを置き、該当が無い PR にはフォルダを作らない。PR の head の manifest を使う (head に無い場合と旧形式の場合は `main` のもの)。
- PR が close (merge を含む) されたとき、draft に戻されたとき、base が `main` 以外に変わったとき、差分から成果物が無くなったときは、PR フォルダをゴミ箱に移す。完全な削除はしない。
- ADR-0005 の決定のうち、`approved/*` タグを契機とする納品、`update` / `snapshot` モード、Drive 側の削除を行わない点を置き換える。`approved/*` タグは教員の承認の記録として残す (ADR-0004)。
- GAS の時間トリガー (10 分ごと) で GitHub の状態と Drive の状態を突き合わせる。`main` と各 PR の head が前回と同じなら何もしない。内容 (git の blob SHA) が同じファイルは更新しない。
- フォルダとファイルの識別には Drive の `properties` を使う。対象から外れたファイルは script が置いたものに限りゴミ箱に移し、人が置いたものは更新も削除もしない。
- 不完全な情報でファイルを消さない。PR の一覧の取得に失敗した場合は何も消さない。`main` で manifest に一致するファイルが 0 件の場合は `成果物/` を変えずにエラーにする。
- `GITHUB_TOKEN` (public repo の読み取りのみの fine-grained PAT) の設定を必須とする。2026/11/25 の初回の運用で、token 無しの `poll` が rate limit による HTTP 403 で失敗した。
- 手順は [tools/drive-delivery/README.md](../../tools/drive-delivery/README.md) に書く。
