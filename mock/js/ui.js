/*
 * UI ヘルパー(DOM 生成・注記チップ・モーダル・フォーム部品)
 *
 * 見た目の約束:
 *   - 通常の見た目           … ドキュメントに書かれている要素
 *   - 破線枠 + 「TBD #n」     … 未定義の要素(K.ui.tbd / tbdBox / tbdPlaceholder)
 *   - 赤バッジ「矛盾 #n」     … ドキュメント間・内の矛盾(K.ui.conflict)
 *   - 斜線背景「モック操作」  … 仕様外。モックを操作するためだけの要素(K.ui.scaffold)
 */
window.K = window.K || {};
(function () {
  /** h('div', { class: 'x', onclick: fn, style: {...}, dataset: {...} }, ...children) */
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = Array.isArray(v) ? v.filter(Boolean).join(' ') : v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'value') el.value = v;
        else if (k === 'checked' || k === 'disabled' || k === 'selected') el[k] = !!v;
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    append(el, children);
    return el;
  }
  function append(el, children) {
    for (const c of children.flat(Infinity)) {
      if (c == null || c === false || c === true) continue;
      el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  }

  // ───────── 注記(TBD / 矛盾) ─────────
  const tip = (no) => { const e = K.logEntry(no); return e ? `#${no} [${e.kind}] ${e.issue}\n\n▶ 採用した扱い: ${e.treatment}` : `#${no}`; };
  function chip(kind, no, label) {
    const e = K.logEntry(no);
    if (!e) console.warn('判断ログに存在しない番号', no);
    const cls = kind === '矛盾' ? 'chip chip-conflict' : 'chip chip-tbd';
    return h('span', { class: cls, title: tip(no), role: 'button', tabindex: '0', dataset: { log: no },
      onclick: (ev) => { ev.preventDefault(); ev.stopPropagation(); showLog(no, ev.currentTarget); },
      onkeydown: (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); showLog(no, ev.currentTarget); } } },
    `${kind === '矛盾' ? '矛盾' : 'TBD'} #${no}`, label ? h('span', { class: 'chip-label' }, label) : null);
  }
  /** TBD チップ(未定義) */
  const tbd = (no, label) => chip('TBD', no, label);
  /** 矛盾バッジ */
  const conflict = (no, label) => chip('矛盾', no, label);
  /** 中身はあるが配置・仕様が未定義の要素を囲む破線枠 */
  const tbdBox = (no, label, ...children) => h('div', { class: 'tbd-box' },
    h('div', { class: 'tbd-box-head' }, tbd(no), label ? h('span', null, label) : null), ...children);
  /** 中身自体が未定義の領域(プレースホルダ) */
  const tbdPlaceholder = (no, label) => h('div', { class: 'tbd-placeholder' }, tbd(no), h('span', null, label));
  /** 矛盾する記述の併記 */
  const conflictBox = (no, label, ...children) => h('div', { class: 'conflict-box' },
    h('div', { class: 'conflict-box-head' }, conflict(no), label ? h('span', null, label) : null), ...children);
  /** 文言未定義のメッセージ(記述の該当句をそのまま表示 #2) */
  const docMsg = (phrase) => h('span', { class: 'docmsg' }, h('span', { class: 'docmsg-text' }, phrase), tbd(2, '文言TBD'));
  /** モック操作用(仕様外)の領域 */
  const scaffold = (label, ...children) => h('div', { class: 'scaffold' },
    h('div', { class: 'scaffold-head' }, 'モック操作(仕様外)', label ? `: ${label}` : ''), ...children);
  /** 仕様外のリンク・ボタン(戻るリンクなど) */
  const scaffoldLink = (label, path) => h('a', { class: 'scaffold-link', href: `#${path}` }, label);

  // ───────── 判断ログのポップオーバー ─────────
  let pop;
  function showLog(no, anchor) {
    const e = K.logEntry(no);
    closePopover();
    pop = h('div', { class: 'popover', role: 'dialog' },
      h('div', { class: 'popover-head' },
        e ? chip(e.kind, no) : `#${no}`, h('span', { class: 'popover-uc' }, e?.uc ?? ''),
        h('button', { class: 'popover-close', 'aria-label': '閉じる', onclick: closePopover }, '×')),
      e ? [
        h('dl', null,
          h('dt', null, '曖昧点・未定義点'), h('dd', null, e.issue),
          h('dt', null, '採用した扱い'), h('dd', null, e.treatment),
          h('dt', null, '根拠・該当箇所'), h('dd', null, e.source)),
        h('a', { class: 'popover-link', href: `index.html#/log/${no}`, target: '_blank', rel: 'noopener' }, '判断ログ一覧で開く ↗'),
      ] : h('p', null, '判断ログに該当がありません'));
    document.body.append(pop);
    const r = anchor.getBoundingClientRect();
    const w = Math.min(420, window.innerWidth - 16);
    pop.style.width = `${w}px`;
    pop.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - w - 8))}px`;
    const top = r.bottom + 6;
    pop.style.top = `${top + pop.offsetHeight > window.innerHeight ? Math.max(8, r.top - pop.offsetHeight - 6) : top}px`;
  }
  function closePopover() { if (pop) { pop.remove(); pop = null; } }
  document.addEventListener('click', (ev) => { if (pop && !pop.contains(ev.target)) closePopover(); });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') closePopover(); });

  // ───────── モーダル・通知 ─────────
  /**
   * modal({ title, uc, body, actions: [{ label, kind: 'primary'|'danger'|'', onClick(close) }] })
   * onClick が false を返したら閉じない
   */
  function modal({ title, uc, body, actions = [], wide = false }) {
    const close = () => back.remove();
    const back = h('div', { class: 'modal-back' },
      h('div', { class: ['modal', wide && 'modal-wide'], role: 'dialog', 'aria-modal': 'true' },
        h('div', { class: 'modal-head' }, h('h3', null, title), uc ? ucTags(uc) : null),
        h('div', { class: 'modal-body' }, body),
        actions.length ? h('div', { class: 'modal-actions' }, actions.map((a) => h('button', {
          class: ['btn', a.kind && `btn-${a.kind}`],
          onclick: () => { if (a.onClick?.(close) !== false) close(); },
        }, a.label))) : null));
    document.body.append(back);
    return close;
  }
  /** 未定義の分岐に到達したときの通知(#6: データは変更しない) */
  function tbdNotice(no, what) {
    const e = K.logEntry(no);
    return modal({
      title: 'この操作の扱いは未定義です',
      body: h('div', { class: 'tbd-notice' },
        h('p', null, tbd(no), ' ', what),
        e ? h('p', { class: 'muted' }, e.issue) : null,
        h('p', { class: 'muted' }, '判断ログ #6 の原則により、データは変更していません。')),
      actions: [{ label: '閉じる', kind: 'primary' }],
    });
  }
  function toast(text, kind = 'info') {
    const t = h('div', { class: `toast toast-${kind}` }, text);
    document.body.append(t);
    setTimeout(() => t.classList.add('toast-out'), 2600);
    setTimeout(() => t.remove(), 3100);
  }

  // ───────── 画面部品 ─────────
  const ucTag = (uc) => h('span', { class: 'uc-tag', title: K.UC[uc] ?? '' }, uc);
  const ucTags = (ucs) => h('span', { class: 'uc-tags' }, [].concat(ucs).map(ucTag));
  /** 画面見出し: screen({ title, uc: ['UC-203'], notes: [chips...] }, ...body) */
  const screen = ({ title, uc, notes }, ...body) => h('section', { class: 'screen' },
    h('header', { class: 'screen-head' },
      h('h2', null, title), uc ? ucTags(uc) : null, notes ? h('span', { class: 'screen-notes' }, notes) : null),
    ...body);
  /** メッセージ枠: alert('error'|'info'|'success'|'warn', ...children) */
  const alert = (kind, ...children) => h('div', { class: `alert alert-${kind}`, role: kind === 'error' ? 'alert' : 'status' }, ...children);
  const badge = (text, tone = '') => h('span', { class: ['badge', tone && `badge-${tone}`] }, text);
  /** 処理状態などのバッジの色 */
  const statusTone = (s) => ({ 未処理: 'pending', 申請中: 'pending', 承認待ち: 'pending', 承認済: 'ok', 承認済み: 'ok', 却下: 'ng', 出勤中: 'ok', 休憩中: 'warn', 退勤中: 'muted' }[s] ?? '');
  const btn = (label, onclick, kind = '', attrs = {}) => h('button', { type: 'button', class: ['btn', kind && `btn-${kind}`], onclick, ...attrs }, label);
  /** フォーム行: field('氏名', inputEl, { required, note }) */
  const field = (label, control, opts = {}) => h('label', { class: 'field' },
    h('span', { class: 'field-label' }, label, opts.required ? h('span', { class: 'req' }, '*') : null, opts.note ?? null),
    control);
  const input = (attrs = {}) => h('input', { type: 'text', class: 'input', ...attrs });
  const textarea = (attrs = {}) => h('textarea', { class: 'input', rows: 3, ...attrs });
  /** select(options: [{ value, label }] | string[], attrs) */
  const select = (options, attrs = {}) => h('select', { class: 'input', ...attrs },
    options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o))
      .map((o) => h('option', { value: o.value, selected: attrs.value === o.value }, o.label)));
  /**
   * table({ cols: [{ label, render(row) | key, class }], rows, onRowClick, empty, rowClass(row) })
   */
  function table({ cols, rows, onRowClick, empty = '', rowClass }) {
    return h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
      h('thead', null, h('tr', null, cols.map((c) => h('th', { class: c.class }, c.label)))),
      h('tbody', null, rows.length ? rows.map((r) => h('tr', {
        class: [onRowClick && 'clickable', rowClass?.(r)],
        onclick: onRowClick ? () => onRowClick(r) : null,
      }, cols.map((c) => h('td', { class: c.class }, c.render ? c.render(r) : r[c.key])))) : h('tr', null, h('td', { colspan: cols.length, class: 'empty' }, empty)))));
  }
  /** 定義リスト: kv([['氏名', '田中'], ...]) */
  const kv = (pairs) => h('dl', { class: 'kv' }, pairs.filter(Boolean).map(([k, v]) => [h('dt', null, k), h('dd', null, v)]));
  /** 確認画面などの「修正前→修正後」 */
  const diff = (before, after) => h('span', { class: 'diff' }, h('span', { class: 'diff-before' }, before || '(なし)'), ' → ', h('span', { class: 'diff-after' }, after || '(なし)'));
  /** 戻り値の DOM をその場で描き直すための入れ物: const v = view(() => h(...)); v.draw(); */
  function view(render) {
    const root = h('div', { class: 'view' });
    root.draw = () => { root.replaceChildren(render()); return root; };
    return root.draw();
  }

  K.h = h;
  K.ui = {
    append, tbd, conflict, tbdBox, tbdPlaceholder, conflictBox, docMsg, scaffold, scaffoldLink,
    showLog, closePopover, modal, tbdNotice, toast,
    ucTag, ucTags, screen, alert, badge, statusTone, btn, field, input, textarea, select, table, kv, diff, view,
  };
})();
