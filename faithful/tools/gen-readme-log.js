#!/usr/bin/env node
/*
 * mock/js/log-data.js(判断ログの正本)から README の「判断ログ」の表を生成し、
 * mock/README.md の <!-- LOG:BEGIN --> 〜 <!-- LOG:END --> を置き換える。
 *   node mock/tools/gen-readme-log.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const ctx = {};
ctx.window = ctx; // ブラウザと同じく window === グローバル
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/log-data.js'), 'utf8'), ctx);
const LOG = ctx.K.LOG;

const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, '<br>');
const tbd = LOG.filter((e) => e.kind === 'TBD').length;
const lines = [
  `全 ${LOG.length} 件(未定義・曖昧: ${tbd} 件 / 矛盾: ${LOG.length - tbd} 件)。画面上の「TBD #n」「矛盾 #n」は、この表の # に対応する。`,
  '',
  '| # | 対象UC | 曖昧点・未定義点 | 採用した扱い | 根拠・該当箇所 |',
  '| --- | --- | --- | --- | --- |',
  ...LOG.map((e) => `| ${e.no} | ${cell(e.uc)} | **[${e.kind === '矛盾' ? '矛盾' : 'TBD'}]** ${cell(e.issue)} | ${cell(e.treatment)} | ${cell(e.source)} |`),
];

const readme = path.join(root, 'README.md');
const src = fs.readFileSync(readme, 'utf8');
const re = /(<!-- LOG:BEGIN -->)[\s\S]*?(<!-- LOG:END -->)/;
if (!re.test(src)) { console.error('README.md に <!-- LOG:BEGIN --> / <!-- LOG:END --> がありません'); process.exit(1); }
fs.writeFileSync(readme, src.replace(re, (_, b, e) => `${b}\n${lines.join('\n')}\n${e}`));
console.log(`判断ログ ${LOG.length} 件を README.md に書き出しました`);
