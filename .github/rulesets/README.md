# Rulesets

GitHub の Rulesets (Settings → Rules → Rulesets) の内容。設定画面と一致させる。変更は PR で行い、マージ後に PM が適用する。

| ファイル | Ruleset ID | 対象 |
|---|---|---|
| protect-main.json | 24692600 | default branch (`main`) |
| protect-dev.json | 25614665 | `dev/**/*` |
| review-tags.json | 25622859 | タグ `review/*` `approved/*` |

```sh
gh api -X PUT repos/KIS18-GDS-Team7/Kinchan/rulesets/24692600 --input .github/rulesets/protect-main.json
```

`bypass_actors` と `reviewer.id` は org Team と Repository role の ID。Team ID は `gh api orgs/KIS18-GDS-Team7/teams --jq '.[] | {slug, id}'` で確認できる。
