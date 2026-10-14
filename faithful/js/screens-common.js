/*
 * 全ユーザー共通: UC-001 ログインする / UC-002 ログアウトする(ログアウトは app.js の K.logout)
 * 詳細ドキュメントは管理者版(docx UC-101/102)しかないため、全ロールに当てはめている(#17)
 */
(function () {
  const { h, ui, store } = K;

  // ───────── ログイン画面(UC-001) ─────────
  function loginScreen() {
    const id = ui.input({ name: 'userId', autocomplete: 'username' });
    const pw = ui.input({ type: 'password', name: 'password', autocomplete: 'current-password' }); // パスワードは他のユーザーから見えないように表示(docx UC-101 備考)
    const msg = h('div', { class: 'msg-area' });

    function login(ev) {
      ev?.preventDefault();
      msg.replaceChildren();
      const loginId = id.value.trim();
      if (!loginId || !pw.value) return ui.tbdNotice(21, 'ユーザーID・パスワードが未入力のままログインボタンが押されました。');
      const u = store.state.users.find((x) => x.loginId === loginId && !x.deleted); // 削除したユーザーはログインできない(docx UC-105 備考)
      if (!u) { // Ex-2: アカウントが登録されていない場合 → ログイン処理を中断
        msg.replaceChildren(ui.alert('error', ui.docMsg('アカウントが存在しないこと'), ' ', ui.conflict(20)));
        return;
      }
      if (u.password !== pw.value) { // Ex-1: ユーザーIDまたはパスワードが誤っている場合 → 再入力を求める
        msg.replaceChildren(ui.alert('error', ui.docMsg('ログイン情報が正しくないこと'), ' ', ui.conflict(20)));
        pw.value = '';
        pw.focus();
        return;
      }
      store.state.session.userId = u.id;
      store.event('デモ', `${u.name}(${u.role})がログイン(UC-001)`);
      K.go(K.HOME[u.role]); // 権限に応じた画面を表示(#18)
    }

    const demo = ui.scaffold('デモアカウント(パスワードはすべて password。1ユーザー1権限 #11)',
      h('div', { class: 'demo-accounts' }, ['管理者', '勤怠管理者', '従業員'].map((role) => h('div', { class: 'demo-group' },
        h('div', { class: 'demo-role' }, role),
        store.activeUsers().filter((u) => u.role === role).map((u) => h('button', {
          type: 'button', class: 'demo-account',
          onclick: () => { id.value = u.loginId; pw.value = u.password; msg.replaceChildren(); },
        }, h('span', null, u.name), h('small', null, `${u.loginId}${u.role === '勤怠管理者' ? ` / 担当: ${u.chargeStoreIds.map(store.storeName).join('・')}` : u.storeId ? ` / ${store.storeName(u.storeId)}` : ' / 店舗未設定'}`)))))),
      h('p', { class: 'muted' }, ui.tbd(11, 'ロールの兼務'), ' 入力欄に値を入れるだけです。ログインボタンを押すと UC-001 のフローを通ります。画面上部の「ロール切替(デモ)」を使えば、ログイン画面を経由せずに切り替えられます。'));

    return h('div', { class: 'auth-wrap' },
      ui.screen({ title: 'ログイン画面', uc: ['UC-001'], notes: [ui.tbd(17, '全ロール共通フローは未記述')] },
        h('form', { class: 'card form', onsubmit: login },
          h('p', { class: 'muted' }, 'ログイン情報を入力してください。'), // システムは管理者にログイン情報の入力を求める(メインフロー2)
          ui.field('ユーザーID', id),
          ui.field('パスワード', pw),
          msg,
          h('div', { class: 'form-actions' }, h('button', { type: 'submit', class: 'btn btn-primary' }, 'ログイン')),
          h('div', { class: 'form-sub' }, h('a', { href: '#/login-info' }, 'ログイン情報の変更'), ' ', ui.tbd(19)))),
      demo);
  }

  // ───────── ログイン情報変更画面(docx UC-101 Alt-1) ─────────
  function loginInfoScreen() {
    return h('div', { class: 'auth-wrap' },
      ui.screen({ title: 'ログイン情報変更画面', uc: ['UC-001'], notes: [ui.tbd(19)] },
        h('div', { class: 'card' },
          h('p', null, 'docx UC-101 代替フロー Alt-1 の記述:'),
          h('ol', { class: 'quote' },
            h('li', null, '管理者がログイン情報の変更を選択する'),
            h('li', null, 'システムはログイン情報変更画面を表示する'),
            h('li', null, '管理者が変更内容を入力する'),
            h('li', null, 'システムは変更内容を登録する')),
          ui.tbdPlaceholder(19, '入力項目(変更内容)・本人確認・変更対象が未定義のため、入力欄は作っていません'),
          h('div', { class: 'form-actions' }, ui.scaffoldLink('← ログイン画面へ', '/login')))));
  }

  // ───────── ホーム画面(管理者・勤怠管理者) ─────────
  const ucList = (role) => K.nav[role].filter((it) => !it.group);
  function homeScreen(role, title, quote) {
    return () => ui.screen({ title, notes: [ui.tbd(18)] },
      h('div', { class: 'card' },
        h('p', null, quote),
        ui.tbdPlaceholder(18, 'ホーム画面に何を表示するかは未定義です'),
        ui.scaffold('このロールの画面(左のナビゲーションと同じ)',
          h('ul', { class: 'link-list' }, ucList(role).map((it) => h('li', null, h('a', { href: `#${it.path}` }, (it.uc ?? []).join(' '), ' ', it.label)))))));
  }

  K.route('/login', { role: null, title: 'ログイン画面', render: loginScreen });
  K.route('/login-info', { role: null, title: 'ログイン情報変更画面', render: loginInfoScreen });
  K.route('/admin', { role: '管理者', title: '管理者用のホーム画面',
    render: homeScreen('管理者', '管理者用のホーム画面', 'docx UC-101 メインフロー8「システムは管理者用のホーム画面を表示する」。') });
  K.route('/manager', { role: '勤怠管理者', title: 'ホーム画面',
    render: homeScreen('勤怠管理者', 'ホーム画面(名称・内容未定義)', '勤怠管理者のログイン後の画面は記述がありません(docx UC-101 事後条件「権限に応じた画面が表示されていること」を当てはめています)。') });
})();
