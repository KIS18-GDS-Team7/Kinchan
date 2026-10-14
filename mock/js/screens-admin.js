/*
 * 管理者: UC-103〜UC-116(docx の ID は requirements.md と異なる。docx UC-108〜114 = UC-110〜116)
 * - 起点は「ユーザー管理画面」(UC-116 の一覧と同一画面として扱う #23)
 * - UC-104〜115 はユーザーを選択した後の「ユーザー情報の表示」(各メインフロー4)から起動する(#26)
 */
(function () {
  const { h, ui, store } = K;
  const ROLES = ['管理者', '勤怠管理者', '従業員'];
  const WEEK = ['月', '火', '水', '木', '金', '土', '日'];

  K.nav['管理者'].push(
    { group: 'ユーザー' },
    // match を '/admin/users' にすると '/admin/users/new' でも強調されるため、ユーザーID(U〜)配下に限定
    { path: '/admin/users', uc: ['UC-116'], label: 'ユーザー管理画面(ユーザー一覧)', match: '/admin/users/U' },
    { path: '/admin/users/new', uc: ['UC-103'], label: 'ユーザーを登録する' },
  );

  // 完了通知(各UCの最終ステップ)を遷移先の画面で一度だけ表示する(完了後の表示画面は未定義 #96)
  let flash = null;
  const setFlash = (phrase) => { flash = ui.alert('success', ui.docMsg(phrase), ' ', ui.tbd(96, '完了後の表示画面')); };
  const takeFlash = () => { const f = flash; flash = null; return f; };

  const admins = () => store.activeUsers().filter((u) => u.role === '管理者');
  const isLastAdmin = (u) => u.role === '管理者' && admins().length <= 1;
  const isSelf = (u) => u.id === store.state.session.userId;
  const toUsers = () => K.go('/admin/users');
  const toUser = (u) => K.go(`/admin/users/${u.id}`);
  const backToList = () => h('div', { class: 'form-actions' }, ui.scaffoldLink('← ユーザー管理画面へ', '/admin/users'));
  const err = (...children) => ui.alert('error', ...children);
  const markInvalid = (el, bad) => el.classList.toggle('invalid', !!bad);

  // ───────── ユーザー管理画面(UC-116 ユーザー一覧) ─────────
  function usersScreen() {
    const head = { title: 'ユーザー管理画面', uc: ['UC-116'], notes: [ui.tbd(23, 'ユーザー一覧との関係')] };
    const top = h('div', { class: 'admin-toolbar' },
      h('p', { class: 'muted' }, 'ユーザー一覧(UC-116)。行を選択すると UC-104〜UC-115 の操作に進みます。'),
      ui.btn([ui.ucTag('UC-103'), ' ユーザー登録'], () => K.go('/admin/users/new'), 'primary')); // docx UC-103 メインフロー1「ユーザー登録を選択する」
    const f = takeFlash();
    // Ex-1: ユーザー情報の取得に失敗 / Ex-2: システムエラー → ユーザー一覧の表示処理を中断
    if (store.takeFault('UC-116-Ex1')) return ui.screen(head, f, top, err(ui.docMsg('ユーザー情報を取得できなかったこと')));
    if (store.takeFault('UC-116-Ex2')) return ui.screen(head, f, top, err(ui.docMsg('エラーが発生したこと')));
    // Alt-1: ユーザーが登録されていない場合(通常は到達しない #25)
    const empty = store.takeFault('UC-116-Alt1');
    const rows = empty ? [] : store.activeUsers(); // 削除済みは一覧から外す(#33)。管理者自身も含める(#25)
    return ui.screen(head, f, top,
      empty ? ui.alert('info', ui.docMsg('ユーザーが登録されていないこと'), ' ', ui.conflict(25)) : null,
      ui.table({
        cols: [
          { label: '氏名', key: 'name' },
          { label: 'ユーザーID', key: 'loginId' },
          { label: '権限', render: (u) => ui.badge(u.role) },
          { label: h('span', null, 'その他の項目(「など」) ', ui.tbd(24)), render: () => h('span', { class: 'tbd-cell' }, '未定義') },
        ],
        rows, onRowClick: empty ? null : (u) => toUser(u), empty: '(ユーザーなし)',
      }));
  }

  // ───────── ユーザー登録画面(UC-103) ─────────
  function registerScreen() {
    const name = ui.input({ name: 'name' });
    const loginId = ui.input({ name: 'loginId', autocomplete: 'off' });
    const pw = ui.input({ type: 'password', name: 'password', autocomplete: 'new-password' });
    const role = ui.select([{ value: '', label: '選択してください' }, ...ROLES], { name: 'role' });
    const msg = h('div', { class: 'msg-area' });
    function submit(ev) {
      ev.preventDefault();
      msg.replaceChildren();
      // メインフロー5: 入力されたユーザー情報が有効か(判定基準は未入力のみ #28)
      const fields = [name, loginId, pw, role];
      fields.forEach((el) => markInvalid(el, !el.value.trim()));
      if (fields.some((el) => !el.value.trim())) { // Ex-1
        msg.replaceChildren(err(ui.docMsg('入力内容が無効であること'), h('br'), ui.docMsg('入力内容の修正を求める'), ' ', ui.tbd(28)));
        return;
      }
      const id = loginId.value.trim();
      const same = store.state.users.filter((u) => u.loginId === id);
      if (same.some((u) => !u.deleted)) { // Ex-2: 同じユーザーIDが既に登録されている
        markInvalid(loginId, true);
        msg.replaceChildren(err(ui.docMsg('ユーザーIDが既に使用されていること'), h('br'), ui.docMsg('別のユーザーIDの入力を求める')));
        return;
      }
      if (same.length) return ui.tbdNotice(97, '削除済みユーザーと同じユーザーIDで登録しようとしました。');
      const u = { id: store.id('U'), loginId: id, password: pw.value, name: name.value.trim(), role: role.value,
        storeId: null, chargeStoreIds: [], availability: null, breakTime: null, status: '退勤中', deleted: false };
      store.state.users.push(u); // メインフロー6
      store.event('デモ', `UC-103 ユーザーを登録: ${u.name}(${u.role})`);
      setFlash('登録完了'); // メインフロー7: 登録完了を管理者に通知する
      toUser(u);
    }
    return ui.screen({ title: 'ユーザー登録画面', uc: ['UC-103'] },
      h('form', { class: 'card form', onsubmit: submit },
        ui.field('氏名', name, { required: true }),
        ui.field('ユーザーID', loginId, { required: true }),
        ui.field('パスワード', pw, { required: true }),
        ui.field('権限', role, { required: true, note: ui.conflict(29, 'UC-106 との関係') }),
        h('p', { class: 'muted' }, '登録するユーザーには「管理者」「勤怠管理者」「従業員」のいずれかの権限を設定する(docx UC-103 備考)'),
        ui.tbdPlaceholder(27, '上記以外の「ユーザー情報」の項目(UC-104 備考「氏名、ユーザーID、パスワード、権限など」の「など」)は未定義'),
        msg,
        h('div', { class: 'form-actions' }, h('button', { type: 'submit', class: 'btn btn-primary' }, '登録'))),
      backToList()); // UC-103 にはキャンセルの記述がない(Alt-1 は入力内容の修正のみ)
  }

  // ───────── ユーザー情報の表示(UC-104〜115 メインフロー4) ─────────
  function userInfo(u) {
    return ui.kv([
      ['氏名', u.name],
      ['ユーザーID', u.loginId],
      ['パスワード', '●●●●●●●●'],
      ['権限', ui.badge(u.role)],
      ['所属店舗', u.storeId ? store.storeName(u.storeId) : h('span', { class: 'muted' }, '未設定')],
      u.role === '勤怠管理者' && ['担当店舗', h('span', null, u.chargeStoreIds.map(store.storeName).join('・') || '—', ' ', ui.tbd(9, '設定するUCなし'))],
      ['勤務可能時間', u.availability ? h('span', { class: 'avail-text' }, store.availabilityText(u)) : h('span', { class: 'muted' }, '未設定')],
      ['休憩時間', u.breakTime ?? h('span', { class: 'muted' }, '未設定')],
    ]);
  }
  /** 存在しない/削除済みのユーザー → 「対象ユーザーが存在しない」(各UCの Ex) */
  function withUser(params, render) {
    const u = store.user(params.id);
    if (!u || u.deleted) return ui.screen({ title: 'ユーザー情報の表示' }, err(ui.docMsg('対象ユーザーが存在しないこと')), backToList());
    return render(u);
  }
  const OPS = [ // [UC, 操作画面のパス]
    ['UC-104', 'edit'], ['UC-105', null], ['UC-106', 'grant'], ['UC-107', 'role'],
    ['UC-110', 'store-set'], ['UC-111', 'store-edit'], ['UC-112', 'avail-set'], ['UC-113', 'avail-edit'],
    ['UC-114', 'break-set'], ['UC-115', 'break-edit'],
  ];
  function userScreen(params) {
    return withUser(params, (u) => {
      const disabled = { // 事前条件(#35): 変更系は「設定されていること」が必要。UC-113 は #36 により常に有効
        'UC-111': !u.storeId && '事前条件: ユーザーに所属店舗が設定されていること',
        'UC-115': !u.breakTime && '事前条件: 対象ユーザーの休憩時間が設定されていること',
      };
      return ui.screen({ title: 'ユーザー情報の表示', uc: OPS.map(([uc]) => uc), notes: [ui.tbd(26)] },
        takeFlash(),
        h('div', { class: 'card' }, h('p', { class: 'muted' }, '選択されたユーザーの情報(UC-104〜UC-115 メインフロー4)'), userInfo(u)),
        ui.tbdBox(26, '各操作の起動位置・並びは未定義',
          h('div', { class: 'op-grid' }, OPS.map(([uc, path]) => h('div', { class: 'op-cell' },
            ui.btn([ui.ucTag(uc), ` ${K.UC[uc]}`], uc === 'UC-105' ? () => startDelete(u) : () => K.go(`/admin/users/${u.id}/${path}`),
              uc === 'UC-105' ? 'danger' : '', { disabled: !!disabled[uc], title: disabled[uc] || null }),
            disabled[uc] ? h('small', { class: 'muted' }, disabled[uc], ' ', ui.tbd(35)) : null)))),
        backToList());
    });
  }

  // ───────── UC-105 ユーザーを削除する(削除確認はモーダル) ─────────
  function startDelete(u) {
    // メインフロー5: 管理者が削除を要求する。自分自身・最後の管理者の削除を防ぐ記述はない(#32)
    if (isSelf(u) || isLastAdmin(u)) {
      return ui.tbdNotice(32, isSelf(u) ? '操作中の管理者が自分自身を削除しようとしました。' : '最後の管理者を削除しようとしました。');
    }
    const area = h('div', { class: 'msg-area' });
    ui.modal({
      title: '削除確認画面', uc: ['UC-105'], // メインフロー6: システムは削除確認を表示する
      body: h('div', null,
        h('p', null, '次のユーザーを削除します。'), userInfo(u),
        h('p', { class: 'muted' }, '削除したユーザーはログインできなくなる(docx UC-105 備考)。削除方式・関連データの扱い ', ui.tbd(33)),
        area),
      actions: [
        { label: 'キャンセル', onClick: () => { toUsers(); return true; } }, // Alt-1: 削除処理を中止 → ユーザー管理画面
        { label: '削除', kind: 'danger', onClick: () => {
          if (store.takeFault('ADMIN-USER-GONE')) { area.replaceChildren(err(ui.docMsg('対象ユーザーが存在しないこと'))); return false; } // Ex-1
          if (store.takeFault('UC-105-Ex2')) { area.replaceChildren(err(ui.docMsg('削除に失敗したこと'))); return false; } // Ex-2
          u.deleted = true; // メインフロー8(#33: 一覧から外しログイン不可。関連データは残す)
          store.event('デモ', `UC-105 ユーザーを削除: ${u.name}`);
          setFlash('削除完了'); // メインフロー9
          toUsers();
          return true;
        } },
      ],
    });
  }

  // ───────── 操作画面の共通枠(UC-104, 106, 107, 110〜115) ─────────
  /**
   * opScreen(params, { uc, notes, pre(u) → 未充足なら事前条件の文, form(u) → { nodes, run(msg) → 完了句 | null, after? }, submitLabel })
   * - 実行時の障害注入 ADMIN-USER-GONE → 「対象ユーザーが存在しないこと」で処理中断(データ変更なし)
   * - キャンセル(各 Alt-1)→ 変更しない → ユーザー管理画面を表示
   */
  function opScreen(params, { uc, notes = [], pre, form, submitLabel }) {
    return withUser(params, (u) => {
      const head = { title: K.UC[uc], uc: [uc], notes };
      const info = h('div', { class: 'card' }, h('p', { class: 'muted' }, '選択されたユーザーの情報(メインフロー4)'), userInfo(u));
      const unmet = pre?.(u);
      if (unmet) return ui.screen(head, info, ui.alert('warn', `${unmet} を満たしていません `, ui.tbd(35)), backToList());
      const msg = h('div', { class: 'msg-area' });
      const f = form(u);
      function submit(ev) {
        ev.preventDefault();
        msg.replaceChildren();
        if (store.takeFault('ADMIN-USER-GONE')) { msg.replaceChildren(err(ui.docMsg('対象ユーザーが存在しないこと'))); return; }
        const done = f.run(msg);
        if (!done) return;
        store.event('デモ', `${uc} ${K.UC[uc]}: ${u.name}`);
        setFlash(done);
        if (f.after) f.after(); else toUser(u);
      }
      return ui.screen(head, info,
        h('form', { class: 'card form', onsubmit: submit }, f.nodes, msg,
          h('div', { class: 'form-actions' },
            ui.btn('キャンセル', toUsers),
            h('button', { type: 'submit', class: 'btn btn-primary' }, submitLabel))));
    });
  }

  /** 最後の管理者を管理者以外にする変更は #32 */
  function roleGuard(u, next) {
    if (u.role === '管理者' && next !== '管理者' && isLastAdmin(u)) {
      ui.tbdNotice(32, '最後の管理者の権限を管理者以外に変更しようとしました。');
      return false;
    }
    return true;
  }
  /** 操作中の管理者自身の権限を変更した後の遷移(#100) */
  const selfNote = (u) => (isSelf(u)
    ? h('p', { class: 'muted' }, '操作中の管理者自身の権限を変更すると、変更後の権限の画面に切り替わります ', ui.tbd(100))
    : null);
  const afterRole = (u) => (isSelf(u) && u.role !== '管理者' ? () => K.go(K.HOME[u.role]) : null);

  // UC-104 ユーザーを編集する
  function editForm(u) {
    const name = ui.input({ value: u.name });
    const loginId = ui.input({ value: u.loginId, autocomplete: 'off' });
    const pw = ui.input({ type: 'password', value: u.password, autocomplete: 'new-password' });
    const role = ui.select(ROLES, { value: u.role });
    const f = {
      nodes: [
        h('p', { class: 'muted' }, 'ユーザーの氏名、ユーザーID、パスワード、権限などの登録情報を編集できるものとする(docx UC-104 備考) ', ui.tbd(27, '「など」')),
        ui.field('氏名', name, { required: true }),
        ui.field('ユーザーID', loginId, { required: true }),
        ui.field('パスワード', pw, { required: true }),
        ui.field('権限', role, { required: true, note: ui.conflict(30, 'UC-107 との関係') }),
        selfNote(u),
      ],
      run(msg) {
        const all = [name, loginId, pw];
        all.forEach((el) => markInvalid(el, !el.value.trim()));
        if (all.some((el) => !el.value.trim())) { // Ex-1(判定基準は未入力のみ #28)
          msg.replaceChildren(err(ui.docMsg('入力内容が無効であること'), h('br'), ui.docMsg('入力内容の修正を求める'), ' ', ui.tbd(28)));
          return null;
        }
        const id = loginId.value.trim();
        if (store.state.users.some((x) => x.id !== u.id && x.loginId === id)) { // UC-104 に重複IDの記述なし
          markInvalid(loginId, true);
          ui.tbdNotice(98, '他のユーザー(削除済みを含む)と同じユーザーIDに変更しようとしました。');
          return null;
        }
        if (!roleGuard(u, role.value)) return null;
        Object.assign(u, { name: name.value.trim(), loginId: id, password: pw.value, role: role.value }); // メインフロー8
        f.after = afterRole(u);
        return '編集完了'; // メインフロー9
      },
    };
    return f;
  }

  // UC-106 ユーザーに権限を付与する / UC-107 ユーザーの権限を変更する(フローが同一 #31)
  const roleForm = (label, phrase) => (u) => {
    const role = ui.select(ROLES, { value: u.role });
    const f = {
      nodes: [ui.field(label, role, { required: true }),
        h('p', { class: 'muted' }, '権限は「管理者」「勤怠管理者」「従業員」から選択するものとする(docx 備考)'), selfNote(u)],
      run(msg) {
        // メインフロー7: 選択された権限が有効か
        if (store.takeFault('ADMIN-ROLE-INVALID')) { // Ex-2: 指定した権限が不正
          msg.replaceChildren(err(ui.docMsg('指定された権限が無効であること'), h('br'), ui.docMsg('権限の再選択を求める')));
          return null;
        }
        if (!roleGuard(u, role.value)) return null;
        u.role = role.value; // メインフロー8(権限は1つの値として上書き #29)
        f.after = afterRole(u);
        return phrase; // メインフロー9
      },
    };
    return f;
  };

  // UC-110 ユーザーの所属店舗を設定する / UC-111 ユーザーの所属店舗を編集する
  const storeForm = (label, phrase) => (u) => {
    const sel = ui.select(store.state.stores.map((s) => ({ value: s.id, label: s.name })), { value: u.storeId ?? store.state.stores[0].id });
    return {
      nodes: [
        ui.field(label, sel, { required: true, note: ui.tbd(34, '1店舗のみ選択') }),
        h('p', { class: 'muted' }, '所属店舗はシステムに登録されている店舗から選択するものとする(docx 備考) ', ui.tbd(8, '店舗を登録するUCなし')),
        u.role === '勤怠管理者' ? h('p', { class: 'muted' }, '勤怠管理者の担当店舗とは連動しません ', ui.tbd(9)) : null,
      ],
      run(msg) {
        // メインフロー7: 選択された店舗が有効か
        if (store.takeFault('ADMIN-STORE-GONE')) { // Ex-2: 指定した店舗が存在しない
          msg.replaceChildren(err(ui.docMsg('指定された店舗が存在しないこと'), h('br'), ui.docMsg('所属店舗の再選択を求める')));
          return null;
        }
        u.storeId = sel.value; // メインフロー8
        return phrase; // メインフロー9
      },
    };
  };

  // UC-112 勤務可能時間を設定する / UC-113 勤務可能時間を変更する(docx は UC-112 の複製 #36)
  function availForm(u) {
    // 初期値は空(どちらの docx にも現在値の表示はない。現在値は上のユーザー情報に表示される)
    const rows = WEEK.map((d) => ({ d,
      s: h('input', { type: 'time', class: 'input', 'aria-label': `${d} 開始` }),
      e: h('input', { type: 'time', class: 'input', 'aria-label': `${d} 終了` }) }));
    return {
      nodes: [ui.tbdBox(37, '入力形式(1曜日に1時間帯・空欄の曜日は勤務可能時間なし)は未定義',
        h('p', { class: 'muted' }, '勤務可能な曜日と時間を入力する(メインフロー5)。勤務可能時間は曜日ごとに設定できるものとする(docx 備考)'),
        h('table', { class: 'table avail-table' },
          h('thead', null, h('tr', null, h('th', null, '曜日'), h('th', null, '開始'), h('th', null, '終了'))),
          h('tbody', null, rows.map((r) => h('tr', null, h('td', null, r.d), h('td', null, r.s), h('td', null, r.e))))))],
      run(msg) {
        let bad = false;
        for (const r of rows) { // 不正の判定(#38): 片方のみ入力、または終了≦開始
          const invalid = (!!r.s.value !== !!r.e.value) || (!!r.s.value && store.minutes(r.e.value) <= store.minutes(r.s.value));
          markInvalid(r.s, invalid);
          markInvalid(r.e, invalid);
          bad = bad || invalid;
        }
        if (bad) { // Ex-2
          msg.replaceChildren(err(ui.docMsg('入力内容が不正であること'), h('br'), ui.docMsg('勤務可能時間の再入力を求める'), ' ', ui.tbd(38)));
          return null;
        }
        if (rows.every((r) => !r.s.value)) {
          ui.tbdNotice(99, 'すべての曜日が空欄のまま勤務可能時間の設定が要求されました。');
          return null;
        }
        u.availability = Object.fromEntries(rows.map((r) => [r.d, r.s.value ? { start: r.s.value, end: r.e.value } : null])); // メインフロー8
        return '設定完了'; // メインフロー9(UC-113 も docx の複製どおり「設定完了」)
      },
    };
  }

  // UC-114 休憩時間を設定する / UC-115 休憩時間を変更する
  const breakForm = (label, phrase, showCurrent) => (u) => {
    const inp = ui.input({ placeholder: '形式未定義(例: 60分)' });
    return {
      nodes: [
        showCurrent ? ui.kv([['現在の休憩時間', u.breakTime]]) : null, // UC-115 メインフロー4「現在の休憩時間を表示する」
        ui.tbdBox(39, '入力形式・単位は未定義(自由入力)', ui.field(label, inp, { required: true })),
        h('p', { class: 'muted' }, `休憩時間はユーザーごとに${showCurrent ? '変更' : '設定'}できるものとする(docx 備考)`),
      ],
      run(msg) {
        markInvalid(inp, !inp.value.trim());
        if (!inp.value.trim()) { // Ex-2(不正の判定は未入力のみ #38)
          msg.replaceChildren(err(ui.docMsg('入力内容が不正であること'), h('br'), ui.docMsg('休憩時間の再入力を求める'), ' ', ui.tbd(38)));
          return null;
        }
        u.breakTime = inp.value.trim(); // メインフロー8
        return phrase; // メインフロー9
      },
    };
  };

  // ───────── ルート登録('/admin/users/new' は ':id' より先に登録する) ─────────
  const R = (path, title, render) => K.route(path, { role: '管理者', title, render });
  R('/admin/users', 'ユーザー管理画面', usersScreen);
  R('/admin/users/new', 'ユーザー登録画面', registerScreen);
  R('/admin/users/:id', 'ユーザー情報の表示', userScreen);
  R('/admin/users/:id/edit', K.UC['UC-104'], (p) => opScreen(p, { uc: 'UC-104', form: editForm, submitLabel: '保存' }));
  R('/admin/users/:id/grant', K.UC['UC-106'], (p) => opScreen(p, { uc: 'UC-106',
    notes: [ui.conflict(29, 'UC-103 との関係'), ui.conflict(31, 'UC-107 と同一')],
    form: roleForm('付与する権限', '権限の付与完了'), submitLabel: '権限を付与' }));
  R('/admin/users/:id/role', K.UC['UC-107'], (p) => opScreen(p, { uc: 'UC-107',
    notes: [ui.conflict(30, 'UC-104 との関係'), ui.conflict(31, 'UC-106 と同一')],
    form: roleForm('変更後の権限', '権限の変更完了'), submitLabel: '権限を変更' }));
  R('/admin/users/:id/store-set', K.UC['UC-110'], (p) => opScreen(p, { uc: 'UC-110', notes: [ui.tbd(35)],
    form: storeForm('所属店舗', '設定完了'), submitLabel: '設定' }));
  R('/admin/users/:id/store-edit', K.UC['UC-111'], (p) => opScreen(p, { uc: 'UC-111', notes: [ui.tbd(35)],
    pre: (u) => !u.storeId && '事前条件「ユーザーに所属店舗が設定されていること」',
    form: storeForm('変更後の所属店舗', '変更完了'), submitLabel: '変更' }));
  R('/admin/users/:id/avail-set', K.UC['UC-112'], (p) => opScreen(p, { uc: 'UC-112', notes: [ui.tbd(35)],
    form: availForm, submitLabel: '設定' }));
  R('/admin/users/:id/avail-edit', K.UC['UC-113'], (p) => opScreen(p, { uc: 'UC-113',
    notes: [ui.conflict(36, 'docx は UC-112(設定)の複製')],
    form: availForm, submitLabel: '設定' }));
  R('/admin/users/:id/break-set', K.UC['UC-114'], (p) => opScreen(p, { uc: 'UC-114', notes: [ui.conflict(40, '休憩の概念'), ui.tbd(35)],
    form: breakForm('休憩時間', '設定完了', false), submitLabel: '設定' }));
  R('/admin/users/:id/break-edit', K.UC['UC-115'], (p) => opScreen(p, { uc: 'UC-115', notes: [ui.conflict(40, '休憩の概念'), ui.tbd(35)],
    pre: (u) => !u.breakTime && '事前条件「対象ユーザーの休憩時間が設定されていること」',
    form: breakForm('新しい休憩時間', '変更完了', true), submitLabel: '変更' }));
})();
