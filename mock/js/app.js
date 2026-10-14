/*
 * ルーター・レイアウト・モック操作バー
 * - 画面ファイルは K.route(path, def) で画面を登録し、K.nav[ロール] にナビ項目を追加する
 *   def: { role: '管理者'|'勤怠管理者'|'従業員'|null, layout?: 'mock', title, render(params) => Node }
 * - パスは '#/admin/users/:id' のようなハッシュ。画面遷移しても state はメモリに残る
 */
window.K = window.K || {};
(function () {
  const { h, ui, store } = K;
  const routes = [];
  K.nav = { 管理者: [], 勤怠管理者: [], 従業員: [] };
  K.HOME = { 管理者: '/admin', 勤怠管理者: '/manager', 従業員: '/employee' };

  K.route = (pattern, def) => {
    const keys = [];
    const re = new RegExp(`^${pattern.replace(/:[^/]+/g, (m) => { keys.push(m.slice(1)); return '([^/]+)'; })}$`);
    routes.push({ pattern, re, keys, ...def });
  };
  K.go = (path) => { if (location.hash === `#${path}`) render(); else location.hash = path; };
  K.rerender = () => render();
  K.currentPath = () => location.hash.replace(/^#/, '') || '/login';

  // ───────── ログアウト(UC-002。docx UC-102 を全ロールに適用 #17) ─────────
  K.logout = function () {
    const err = h('div');
    ui.modal({
      title: 'ログアウト確認画面', uc: ['UC-002'],
      body: h('div', null, h('p', null, 'ログアウトを確定しますか。 ', ui.tbd(17, '全ロールに管理者版を適用')), err),
      actions: [
        { label: 'キャンセル', onClick: () => true }, // Alt-1: 操作していた画面に戻る
        { label: 'ログアウト', kind: 'primary', onClick: () => {
          if (store.takeFault('UC-002-Ex1')) { // Ex-1
            err.replaceChildren(ui.alert('error', ui.docMsg('ログアウトに失敗したこと'), h('br'), ui.docMsg('再度ログアウトを要求')));
            return false;
          }
          const u = store.me();
          store.state.session.userId = null;
          store.event('デモ', `${u?.name ?? ''} がログアウト(UC-002)`);
          K.go('/login');
          return true;
        } },
      ],
    });
  };

  // ───────── レイアウト ─────────
  const app = document.getElementById('app');

  function headerUser(u) {
    return h('div', { class: 'app-user' },
      h('span', { class: 'app-user-name' }, u.name), h('span', { class: 'app-user-role' }, u.role),
      h('span', { class: 'logout-wrap' }, ui.btn('ログアウト', K.logout, 'ghost'), ui.tbd(22)));
  }
  function navList(role) {
    const cur = K.currentPath();
    return ui.scaffold('ナビゲーション',
      h('div', { class: 'nav-note' }, '画面構成・起動箇所は未定義 ', ui.tbd(1)),
      h('nav', { class: 'side-nav' }, K.nav[role].map((it) => it.group
        ? h('div', { class: 'nav-group' }, it.group)
        : h('a', { href: `#${it.path}`, class: ['nav-item', (cur === it.path || (it.match && cur.startsWith(it.match))) && 'active'] },
          h('span', { class: 'nav-uc' }, (it.uc ?? []).join(' ')), h('span', null, it.label)))));
  }
  function layoutPC(u, content) {
    return h('div', { class: 'layout-pc' },
      h('header', { class: 'app-header' }, h('div', { class: 'app-brand' }, 'Kinchan'), h('div', { class: 'app-role' }, `${u.role}画面`), headerUser(u)),
      h('div', { class: 'layout-pc-body' }, h('aside', { class: 'sidebar' }, navList(u.role)), h('main', { class: 'main' }, content)));
  }
  function layoutPhone(u, content) {
    return h('div', { class: 'phone-stage' },
      h('div', { class: 'phone-caption' }, '従業員画面はスマホ幅(390px)で表示'),
      h('div', { class: 'phone' },
        h('header', { class: 'phone-header' }, h('div', { class: 'app-brand' }, 'Kinchan'), headerUser(u)),
        h('main', { class: 'phone-main' }, content)));
  }
  const layoutAuth = (content) => h('div', { class: 'layout-auth' }, content);
  const layoutMock = (content) => h('div', { class: 'layout-mock' }, content);

  function match(path) {
    for (const r of routes) {
      const m = path.match(r.re);
      if (m) return { r, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
    }
    return null;
  }

  function render() {
    ui.closePopover();
    document.querySelectorAll('.modal-back').forEach((m) => m.remove());
    const path = K.currentPath();
    const found = match(path);
    const u = store.me();
    if (!found) return K.go(u ? K.HOME[u.role] : '/login');
    const { r, params } = found;
    // ログアウト後・権限外の画面は直接操作できない(docx UC-102 備考)
    if (r.role && (!u || u.deleted || u.role !== r.role)) return K.go('/login');
    const content = r.render(params);
    let page;
    if (r.layout === 'mock') page = layoutMock(content);
    else if (!r.role) page = layoutAuth(content);
    else if (r.role === '従業員') page = layoutPhone(u, content);
    else page = layoutPC(u, content);
    app.replaceChildren(page);
    document.title = `${r.title ?? ''} | Kinchan UCモック(パターンB)`;
    drawBar();
    window.scrollTo(0, 0);
  }

  // ───────── モック操作バー ─────────
  const bar = document.getElementById('mockbar');
  const panel = document.getElementById('demopanel');
  let panelOpen = false;

  function quickSwitch() {
    const sel = h('select', { class: 'mockbar-select', 'aria-label': 'ロール切替',
      onchange: (ev) => {
        const uid = ev.target.value;
        if (!uid) return;
        const u = store.user(uid);
        store.state.session.userId = uid;
        store.event('デモ', `ロール切替: ${u.name}(${u.role})としてログイン(UC-001 を経由しないデモ用切替)`);
        K.go(K.HOME[u.role]);
      } },
    h('option', { value: '' }, 'ロール切替(デモ)…'),
    ['管理者', '勤怠管理者', '従業員'].map((role) => h('optgroup', { label: role },
      store.activeUsers().filter((u) => u.role === role).map((u) => h('option', { value: u.id },
        `${u.name}${u.role === '勤怠管理者' ? `(担当: ${u.chargeStoreIds.map(store.storeName).join('・')})` : u.storeId ? `(${store.storeName(u.storeId)})` : ''}`)))));
    return sel;
  }

  function drawBar() {
    const u = store.me();
    const s = store.state.settings;
    bar.replaceChildren(
      h('div', { class: 'mockbar-brand' }, h('strong', null, 'Kinchan UCモック'), h('span', null, 'パターンB: ドキュメント忠実')),
      h('div', { class: 'mockbar-legend' },
        h('span', { class: 'legend legend-tbd' }, 'TBD = 未定義'),
        h('span', { class: 'legend legend-conflict' }, '矛盾'),
        h('span', { class: 'legend legend-scaffold' }, 'モック操作(仕様外)')),
      h('div', { class: 'mockbar-spacer' }),
      h('div', { class: 'mockbar-who' }, u ? `ログイン中: ${u.name}(${u.role})` : '未ログイン'),
      quickSwitch(),
      h('a', { class: 'mockbar-btn', href: '#/log' }, `判断ログ(${K.LOG.length})`),
      h('button', { class: 'mockbar-btn', onclick: () => { s.annotations = !s.annotations; document.body.classList.toggle('hide-notes', !s.annotations); drawBar(); } },
        s.annotations ? '注記: 表示' : '注記: 非表示'),
      h('button', { class: ['mockbar-btn', panelOpen && 'on'], onclick: () => { panelOpen = !panelOpen; drawPanel(); drawBar(); } }, 'デモ操作'),
    );
  }

  function drawPanel() {
    panel.hidden = !panelOpen;
    if (!panelOpen) return;
    const st = store.state;
    const sel = h('select', { class: 'input' }, store.FAULTS.map((f) => h('option', { value: f.key }, f.label)));
    const armed = Object.keys(st.faults);
    panel.replaceChildren(
      h('div', { class: 'demopanel-head' }, h('strong', null, 'デモ操作パネル(仕様外)'), h('button', { class: 'popover-close', onclick: () => { panelOpen = false; drawPanel(); drawBar(); } }, '×')),
      h('section', null,
        h('h4', null, '障害注入(例外・代替フローの再現)'),
        h('p', { class: 'muted' }, '選んだ例外を、該当する操作の次の1回だけ発生させます。'),
        sel, ui.btn('次の1回だけ発生させる', () => { st.faults[sel.value] = true; store.event('デモ', `障害注入: ${sel.value}`); drawPanel(); }, 'primary'),
        armed.length ? h('ul', { class: 'armed' }, armed.map((k) => h('li', null, k, ' ', h('button', { class: 'linklike', onclick: () => { delete st.faults[k]; drawPanel(); } }, '解除')))) : null),
      h('section', null,
        h('h4', null, 'シフト希望の受付期間 ', ui.tbd(84)),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: st.settings.wishAccepting,
          onchange: (ev) => { st.settings.wishAccepting = ev.target.checked; store.event('デモ', `シフト希望の受付期間: ${ev.target.checked ? '期間内' : '期間外'}`); K.rerender(); } }),
        ` ${store.fmtMonth(st.settings.wishPeriod)}分を受付期間内にする`)),
      h('section', null,
        h('h4', null, 'イベントログ(通知 #5・履歴 #12・デモ操作)'),
        st.events.length ? h('ol', { class: 'eventlog' }, st.events.map((e) => h('li', null,
          h('span', { class: 'ev-at' }, e.at.slice(11)), ui.badge(e.kind, e.kind === '通知' ? 'pending' : e.kind === '履歴' ? 'ok' : 'muted'), ' ', e.text)))
          : h('p', { class: 'muted' }, 'まだイベントはありません')),
      h('section', null,
        h('h4', null, 'データ'),
        ui.btn('初期データに戻す(再読み込み)', () => { location.hash = '/login'; location.reload(); }, 'danger')),
    );
  }
  store.onEvent(() => { if (panelOpen) drawPanel(); });

  // ───────── 判断ログ画面(仕様外) ─────────
  function logScreen(params) {
    const focus = params.no ? Number(params.no) : null;
    const f = { kind: '', q: '' };
    const counts = { TBD: K.LOG.filter((e) => e.kind === 'TBD').length, 矛盾: K.LOG.filter((e) => e.kind === '矛盾').length };
    const list = ui.view(() => {
      const rows = K.LOG.filter((e) => (!f.kind || e.kind === f.kind)
        && (!f.q || [e.uc, e.issue, e.treatment, e.source].join(' ').includes(f.q)));
      return ui.table({
        cols: [
          { label: '#', render: (e) => (e.kind === '矛盾' ? ui.conflict(e.no) : ui.tbd(e.no)), class: 'nowrap' },
          { label: '対象UC', key: 'uc', class: 'nowrap' },
          { label: '曖昧点・未定義点', key: 'issue' },
          { label: '採用した扱い', key: 'treatment' },
          { label: '根拠・該当箇所', key: 'source' },
        ],
        rows, rowClass: (e) => (e.no === focus ? 'focus' : ''), empty: '該当なし',
      });
    });
    const root = h('section', { class: 'screen log-screen' },
      h('header', { class: 'screen-head' }, h('h2', null, '判断ログ'),
        h('span', { class: 'muted' }, `全${K.LOG.length}件(TBD ${counts.TBD} / 矛盾 ${counts.矛盾})。README の「判断ログ」と同じ内容です。`)),
      h('div', { class: 'filters' },
        ui.select([{ value: '', label: 'すべて' }, { value: 'TBD', label: 'TBD(未定義)' }, { value: '矛盾', label: '矛盾' }], { onchange: (ev) => { f.kind = ev.target.value; list.draw(); } }),
        ui.input({ placeholder: '絞り込み(例: UC-304)', oninput: (ev) => { f.q = ev.target.value.trim(); list.draw(); } }),
        store.me() ? h('a', { class: 'scaffold-link', href: `#${K.HOME[store.me().role]}` }, '← 画面に戻る') : h('a', { class: 'scaffold-link', href: '#/login' }, '← ログイン画面へ')),
      list);
    if (focus) setTimeout(() => root.querySelector('tr.focus')?.scrollIntoView({ block: 'center' }), 0);
    return root;
  }
  K.route('/log', { role: null, layout: 'mock', title: '判断ログ', render: logScreen });
  K.route('/log/:no', { role: null, layout: 'mock', title: '判断ログ', render: logScreen });

  K.start = () => {
    window.addEventListener('hashchange', render);
    if (!location.hash) location.hash = '/login';
    render();
  };
})();
