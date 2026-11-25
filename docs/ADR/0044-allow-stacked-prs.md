# main への PR の head に stacked PR を出してよい

## ステータス

決定

## 背景

- [ADR-0004](./0004-branch-strategy.md) では、複数人・複数 PR にまたがる feature は `dev/feat/<name>` を `main` から切って統合し、まとめて `main` に PR を出す。`dev/**` は Ruleset (protect-dev) で保護され、`dev/**` への PR ごとに作者以外の承認が必要になる。
- 2026/11/25 時点で、`dev/` 配下のブランチは作られたことがなく、base が `dev/` の PR も無い。
- 実際には、`main` への PR の head ブランチ (親) に、別の作業ブランチ (子) から PR を出して変更を足している。いずれも親の作者とは別のメンバーが出した。
  - #116: `ci/add-deliver-path` → `Screen-transition-diagram` (#107 の head)。親の作者がマージした。
  - #129 #131: `claude/beautiful-franklin-1o0zqm` → `docs/add-sequence-diagrams` (#125 の head)。子の PR の作者がマージした。
- 作業ブランチは保護されていないため、子の PR は承認なしでマージできる。親から `main` への PR では、子の変更を含めて、作者以外の承認 1 件と管轄チームの承認が必要になる。
- 他のメンバーの親に子の PR をマージすると、親の作者が把握していない変更が親の PR に入る。

## 決定

- `main` への PR の head ブランチ (親) に、別の作業ブランチ (子) から PR を出してよい (stacked PR)。親の作者は自分でも他のメンバーでもよい。
- 子の PR は承認なしでマージしてよい。レビューは親から `main` への PR で、子の変更を含めて受ける。
- 他のメンバーの親に出した子の PR は、親の作者がマージする。
- `dev/feat/<name>` は任意とし、子の PR ごとに承認を必須にして統合を続けたい feature に使う。ADR-0004 の「複数人・複数 PR にまたがる feature は `dev/feat/<name>` で統合する」を置き換える。
- 未完成の変更は stacked PR の親ブランチか `dev/feat/<name>` に置き、`main` に入れない。
