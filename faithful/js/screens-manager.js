/*
 * 勤怠管理者: UC-203〜UC-216
 * - 起動箇所が書かれていないため、各画面へはモック用ナビゲーションから入る(#1)
 * - メッセージは文言が書かれていないため、記述の該当句を ui.docMsg で表示する(#2)
 * - 対象は担当店舗に所属する従業員だけ(#9 #42)
 */
(function () {
  const { h, ui, store } = K;
  const st = store.state;

  // ───────── 共通 ─────────
  const charge = () => store.me()?.chargeStoreIds ?? [];
  const staff = () => store.employeesOf(charge());
  const staffIds = () => staff().map((u) => u.id);
  const isStaff = (uid) => staffIds().includes(uid);
  const nameOf = (uid) => store.user(uid)?.name ?? uid;
  const fmtShift = (s) => `${store.fmtDate(s.date)} ${s.start}〜${s.end}`;
  const sbadge = (s) => ui.badge(s, ui.statusTone(s) || (s === '勤務済み' ? 'muted' : s === '勤務中' ? 'ok' : ''));
  const toSec = (t) => (t ? (t.length === 5 ? `${t}:00` : t) : null);
  const breakMin = (b) => { const m = String(b ?? '').match(/\d+/); return m ? Number(m[0]) : 0; }; // 数値部分を分として読む(#64)
  const chargeNote = () => h('span', { class: 'charge-note' }, `担当店舗: ${charge().map(store.storeName).join('・') || '(なし)'}`, ui.tbd(9));
  const staffOptions = (first) => [{ value: '', label: first }, ...staff().map((u) => ({ value: u.id, label: u.name }))];

  // 画面遷移をまたいで1回だけ表示するメッセージ
  let flash = null;
  const setFlash = (...nodes) => { flash = nodes; };
  const flashArea = () => { const f = flash; flash = null; return h('div', { class: 'msg-area' }, f); };
  /** 各 Ex-1: キャンセルが完了したことを提示し、待機状態(=起点画面 #4)に戻る */
  const cancelMsg = () => ui.alert('info', ui.docMsg('キャンセルが完了したこと'), ' ', ui.tbd(4, '待機状態'));
  const cancelled = () => { setFlash(cancelMsg()); K.rerender(); };
  const cancelTo = (path) => { setFlash(cancelMsg()); K.go(path); };
  /** 完了表示 + 従業員への通知(方式TBD #5) */
  const done = (phrase, ...extra) => ui.alert('success', ui.docMsg(phrase),
    h('div', { class: 'notify-line' }, '従業員へ通知(方式TBD) ', ui.tbd(5)), ...extra);
  /** Alt: 対象がすでに処理済み・取り下げ済み(従業員側に取り下げ UC なし #51) */
  const alreadyDone = (phrase) => { setFlash(ui.alert('error', ui.docMsg(phrase), ' ', ui.conflict(51))); K.rerender(); };
  const overlapAlert = (ov, ...extra) => ui.alert('error', ui.docMsg('重複しているシフト'),
    h('ul', { class: 'compact' }, ov.map((s) => h('li', null, `${nameOf(s.userId)} ${fmtShift(s)}`))), ...extra);
  const outAlert = (text) => ui.alert('error', ui.docMsg('範囲外であること'), h('div', null, '従業員の勤務可能時間: ', text));

  /** 確認モーダル(承認系 メインフロー2〜3)。キャンセルは Ex-1 */
  function confirmModal({ uc, title, content, okLabel, onOk }) {
    ui.modal({
      title, uc: [uc],
      body: h('div', null, content(), h('p', null, `${okLabel}しますか。`)),
      actions: [{ label: 'キャンセル', onClick: cancelled }, { label: okLabel, kind: 'primary', onClick: () => { onOk(); } }],
    });
  }

  /** 却下フロー(UC-208/211/216 共通。メインフロー2〜8、Alt-1、Alt-2、Ex-1) */
  function rejectFlow({ uc, title, content, alreadyPhrase, isPending, apply, userId, notifyText, doneExtra }) {
    const reason = ui.textarea({ name: 'rejectReason' });
    const err = h('div', { class: 'msg-area' });
    ui.modal({
      title, uc: [uc],
      body: h('div', null, content(), ui.field('却下理由', reason, { required: true, note: ui.tbd(53, '定型文からの選択') }), err), // メインフロー2
      actions: [
        { label: 'キャンセル', onClick: cancelled }, // Ex-1: 入力された却下理由は破棄
        { label: '却下', kind: 'danger', onClick: () => {
          const r = reason.value.trim();
          if (!r) { err.replaceChildren(ui.alert('error', ui.docMsg('却下理由の入力が必要であること'))); return false; } // Alt-1 → メインフロー2
          confirmReject(r);
          return true;
        } },
      ],
    });
    function confirmReject(r) { // メインフロー4
      ui.modal({
        title: '却下の確認', uc: [uc],
        body: h('div', null, content(), ui.kv([['却下理由', r]]), h('p', null, '却下しますか。')),
        actions: [
          { label: 'キャンセル', onClick: cancelled },
          { label: '却下を確定', kind: 'danger', onClick: () => {
            if (store.takeFault('MGR-ALREADY-PROCESSED') || !isPending()) return alreadyDone(alreadyPhrase); // Alt-2
            apply(r); // メインフロー6
            store.notify(userId, notifyText); // メインフロー7
            setFlash(done('却下が完了したこと', doneExtra)); // メインフロー8
            K.rerender();
          } },
        ],
      });
    }
  }

  /** 一覧の絞り込み条件(Alt-2: 期間・従業員・処理状態 #50) */
  function filterBar(f, dateLabel, redraw) {
    const set = (k) => (ev) => { f[k] = ev.target.value; redraw(); };
    return h('div', { class: 'filters' },
      h('span', { class: 'muted' }, '条件(Alt-2) ', ui.tbd(50)),
      h('span', { class: 'filter-period' }, `期間(${dateLabel})`,
        ui.input({ type: 'date', value: f.from, onchange: set('from') }), '〜', ui.input({ type: 'date', value: f.to, onchange: set('to') })),
      ui.select(staffOptions('従業員(指定なし)'), { value: f.uid, onchange: set('uid') }),
      ui.select([{ value: '', label: '処理状態(指定なし)' }, '未処理', '承認済', '却下'], { value: f.status, onchange: set('status') }));
  }
  const matchFilter = (f, date, uid, status) => (!f.from || date >= f.from) && (!f.to || date <= f.to)
    && (!f.uid || uid === f.uid) && (!f.status || status === f.status);
  const isDefaultFilter = (f) => !f.from && !f.to && !f.uid && f.status === '未処理';

  /** UC-203/204 メインフロー6 の検証。表示するノード、TBD 通知済みなら 'tbd'、問題なしなら null */
  function checkShift({ uid, date, start, end, excludeId }) {
    if (!date || !start || !end || store.minutes(end) <= store.minutes(start)) { // Alt-1(#16)
      return ui.alert('error', ui.docMsg('入力されたシフト情報に誤りがあること'), ' ', ui.tbd(16));
    }
    const ov = store.overlaps(uid, date, start, end, excludeId);
    if (ov.length) return overlapAlert(ov); // Alt-2
    const av = store.availabilityCheck(uid, date, start, end);
    if (!av.ok && av.reason === 'unset') { ui.tbdNotice(43, `${nameOf(uid)} さんの勤務可能時間が未設定のため、範囲チェックができません。`); return 'tbd'; }
    if (!av.ok) return outAlert(av.text); // Alt-3
    return null;
  }
  function shiftFields(f, onChange) {
    const bind = (k) => (ev) => { f[k] = ev.target.value; onChange?.(); };
    return h('div', { class: 'inline-fields' },
      ui.field('勤務日', ui.input({ type: 'date', value: f.date, onchange: bind('date') }), { required: true }),
      ui.field('開始時刻', ui.input({ type: 'time', value: f.start, onchange: bind('start') }), { required: true }),
      ui.field('終了時刻', ui.input({ type: 'time', value: f.end, onchange: bind('end') }), { required: true }));
  }

  // ───────── シフト指定画面(UC-204/205 メインフロー2 #41) ─────────
  const shiftFilter = { ym: '2026-10', uid: '' };
  function shiftListScreen() {
    const msg = flashArea();
    const say = (node) => { msg.replaceChildren(node); msg.scrollIntoView({ block: 'nearest' }); };

    // UC-204 メインフロー3: シフトの指定。勤務済みなら Alt-4 → メインフロー2
    const onEdit = (s) => {
      if (store.shiftState(s) === '勤務済み') return say(ui.alert('error', ui.docMsg('勤務済みのシフトは変更できないこと'), ' ', ui.tbd(45)));
      K.go(`/manager/shifts/${s.id}/edit`);
    };
    // UC-205
    const onDelete = (s) => {
      if (store.shiftState(s)) return say(ui.alert('error', ui.docMsg('勤務済み・勤務中のシフトは削除できないこと'), ' ', ui.tbd(45), ui.conflict(46))); // Alt-1
      ui.modal({ // メインフロー4: 内容を提示し、削除の確認を求める
        title: 'シフトの削除確認', uc: ['UC-205'],
        body: h('div', null,
          ui.kv([['従業員', nameOf(s.userId)], ['勤務日', store.fmtDate(s.date)], ['開始時刻', s.start], ['終了時刻', s.end]]),
          h('p', null, 'このシフトを削除しますか。'),
          h('p', { class: 'muted' }, ui.tbd(47), ' 削除したシフトを元に戻す操作はありません')),
        actions: [
          { label: 'キャンセル', onClick: cancelled }, // Ex-1
          { label: '削除', kind: 'danger', onClick: () => {
            store.history('シフト削除履歴', { summary: `${nameOf(s.userId)} ${fmtShift(s)}`, before: { ...s } }); // メインフロー6
            st.shifts.splice(st.shifts.indexOf(s), 1); // 7
            store.notify(s.userId, 'シフトが削除されたこと'); // 8
            setFlash(done('削除が完了したこと')); // 9
            K.rerender();
          } },
        ],
      });
    };

    const body = ui.view(() => {
      const ids = staffIds();
      const rows = st.shifts
        .filter((s) => ids.includes(s.userId) && s.date.startsWith(shiftFilter.ym) && (!shiftFilter.uid || s.userId === shiftFilter.uid))
        .sort((a, b) => (a.date + a.start + nameOf(a.userId)).localeCompare(b.date + b.start + nameOf(b.userId)));
      return h('div', null,
        h('div', { class: 'filters' },
          ui.btn('前月', () => { shiftFilter.ym = store.addMonths(shiftFilter.ym, -1); body.draw(); }, 'sm'),
          h('strong', null, store.fmtMonth(shiftFilter.ym)),
          ui.btn('翌月', () => { shiftFilter.ym = store.addMonths(shiftFilter.ym, 1); body.draw(); }, 'sm'),
          ui.select(staffOptions('従業員(すべて)'), { value: shiftFilter.uid, onchange: (ev) => { shiftFilter.uid = ev.target.value; body.draw(); } }),
          h('span', { class: 'grow' }),
          ui.btn('シフトを登録する', () => K.go('/manager/shifts/new'), 'primary')),
        ui.table({
          cols: [
            { label: '勤務日', render: (s) => store.fmtDate(s.date), class: 'nowrap' },
            { label: '従業員', render: (s) => nameOf(s.userId), class: 'nowrap' },
            { label: '開始', key: 'start' },
            { label: '終了', key: 'end' },
            { label: ['状態 ', ui.tbd(45)], render: (s) => { const x = store.shiftState(s); return x ? sbadge(x) : ''; } },
            { label: '操作', class: 'nowrap', render: (s) => h('span', { class: 'row-actions' },
              ui.btn('変更', () => onEdit(s), 'sm', { title: 'UC-204' }), ui.btn('削除', () => onDelete(s), 'sm', { title: 'UC-205' })) },
          ],
          rows, empty: '(該当するシフトなし)',
        }));
    });

    return ui.screen({ title: 'シフト指定画面', uc: ['UC-203', 'UC-204', 'UC-205'], notes: [ui.tbd(41), chargeNote()] },
      h('p', { class: 'muted' }, 'UC-204/205 メインフロー2「変更/削除対象となるシフトの指定を求める」の指定方法が書かれていないため、担当店舗のシフトを表で表示しています。勤怠管理者向けのシフト一覧 UC はありません。'),
      msg, body);
  }

  // ───────── UC-203 シフトを登録する ─────────
  function shiftNewScreen() {
    const f = { uid: '', date: '', start: '', end: '' };
    let step = 'form';
    let err = null;
    const v = ui.view(() => {
      if (step === 'confirm') { // メインフロー7: 入力内容を提示し、登録の確認を求める
        const u = store.user(f.uid);
        return h('div', { class: 'card' },
          h('h3', null, '登録内容の確認'),
          ui.kv([
            ['従業員', u.name],
            ['勤務日', [store.fmtDate(f.date), f.date < store.TODAY ? [' ', ui.tbd(105, '過去日への登録')] : null]],
            ['開始時刻', f.start], ['終了時刻', f.end],
            ['適用される休憩時間(UC-114)', [u.breakTime ?? '未設定', ' ', ui.conflict(40)]], // 備考1
          ]),
          h('p', null, '登録しますか。'),
          h('div', { class: 'form-actions' },
            ui.btn('キャンセル', () => cancelTo('/manager/shifts')), // Ex-1(メインフロー8より前)
            ui.btn('登録', register, 'primary')));
      }
      return h('div', { class: 'card form' },
        // メインフロー2〜3: 担当店舗の従業員の中から対象となる従業員を指定
        ui.field('従業員', ui.select(staffOptions('選択してください'), { value: f.uid, onchange: (ev) => { f.uid = ev.target.value; err = null; v.draw(); } }),
          { required: true, note: ui.tbd(42) }),
        // メインフロー4〜5: シフト情報(勤務日、開始時刻、終了時刻)
        f.uid ? shiftFields(f) : h('p', { class: 'muted' }, '従業員を指定すると、シフト情報(勤務日、開始時刻、終了時刻)の入力欄を表示します。'),
        err,
        h('div', { class: 'form-actions' },
          ui.btn('キャンセル', () => cancelTo('/manager/shifts')),
          f.uid ? ui.btn('確認へ', next, 'primary') : null));
    });
    function next() { // メインフロー6
      const r = checkShift({ uid: f.uid, date: f.date, start: f.start, end: f.end });
      if (r === 'tbd') return;
      if (r) { err = r; v.draw(); return; } // Alt-1〜3 → メインフロー4
      err = null; step = 'confirm'; v.draw();
    }
    function register() {
      st.shifts.push({ id: store.id('SH'), userId: f.uid, date: f.date, start: f.start, end: f.end }); // メインフロー9
      store.notify(f.uid, 'シフトが登録されたこと'); // 10
      shiftFilter.ym = f.date.slice(0, 7);
      setFlash(done('登録が完了したこと', // 11
        h('div', null, ui.conflict(44), ' 確定・公開の操作がないため、登録したシフトはそのまま従業員の UC-308 に表示されます')));
      K.go('/manager/shifts');
    }
    return ui.screen({ title: K.UC['UC-203'], uc: ['UC-203'], notes: [chargeNote()] },
      v, h('div', null, ui.scaffoldLink('← シフト指定画面へ', '/manager/shifts')));
  }

  // ───────── UC-204 シフトを変更する ─────────
  function shiftEditScreen({ id }) {
    const s = st.shifts.find((x) => x.id === id);
    if (!s || !isStaff(s.userId)) { setTimeout(() => K.go('/manager/shifts')); return h('div'); }
    if (store.shiftState(s) === '勤務済み') { // Alt-4(URL を直接開いた場合)
      setFlash(ui.alert('error', ui.docMsg('勤務済みのシフトは変更できないこと'), ' ', ui.tbd(45)));
      setTimeout(() => K.go('/manager/shifts'));
      return h('div');
    }
    const f = { date: s.date, start: s.start, end: s.end };
    let step = 'form';
    let err = null;
    const v = ui.view(() => {
      if (step === 'confirm') { // メインフロー7: 変更前と変更後の内容を提示し、変更の確認を求める
        return h('div', { class: 'card' },
          h('h3', null, '変更内容の確認'),
          ui.kv([['従業員', nameOf(s.userId)], ['勤務日', ui.diff(store.fmtDate(s.date), store.fmtDate(f.date))],
            ['開始時刻', ui.diff(s.start, f.start)], ['終了時刻', ui.diff(s.end, f.end)]]),
          h('p', null, '変更しますか。'),
          h('div', { class: 'form-actions' },
            ui.btn('キャンセル', () => cancelTo('/manager/shifts')), // Ex-1
            ui.btn('変更', apply, 'primary')));
      }
      const working = store.shiftState(s) === '勤務中';
      return h('div', null,
        h('div', { class: 'card' }, // メインフロー4: 現在の内容
          h('h3', null, '現在の内容'),
          ui.kv([['従業員', nameOf(s.userId)], ['勤務日', store.fmtDate(s.date)], ['開始時刻', s.start], ['終了時刻', s.end],
            ['状態', [store.shiftState(s) ? sbadge(store.shiftState(s)) : '—', ' ', ui.tbd(45)]]]),
          working ? h('p', null, ui.conflict(46), ' 勤務中のシフトです。UC-204 Alt-4 が変更を禁止しているのは勤務済みのシフトだけのため、変更できます。') : null),
        h('div', { class: 'card form' }, // メインフロー5
          h('h3', null, '変更後のシフト情報'),
          shiftFields(f), err,
          h('div', { class: 'form-actions' },
            ui.btn('キャンセル', () => cancelTo('/manager/shifts')),
            ui.btn('確認へ', next, 'primary'))));
    });
    function next() { // メインフロー6(重複チェックは対象シフト自身を除く)
      const r = checkShift({ uid: s.userId, date: f.date, start: f.start, end: f.end, excludeId: s.id });
      if (r === 'tbd') return;
      if (r) { err = r; v.draw(); return; } // Alt-1〜3 → メインフロー5
      err = null; step = 'confirm'; v.draw();
    }
    function apply() {
      const before = { ...s };
      store.history('シフト変更履歴', { summary: `${nameOf(s.userId)} ${fmtShift(before)} → ${fmtShift(f)}`, before }); // メインフロー9
      Object.assign(s, { date: f.date, start: f.start, end: f.end }); // 10
      store.notify(s.userId, 'シフトが変更されたこと'); // 11
      setFlash(done('変更が完了したこと')); // 12
      K.go('/manager/shifts');
    }
    return ui.screen({ title: K.UC['UC-204'], uc: ['UC-204'], notes: [ui.tbd(14, '何日前まで変更を認めるか'), chargeNote()] },
      v, h('div', null, ui.scaffoldLink('← シフト指定画面へ', '/manager/shifts')));
  }

  // ───────── UC-206〜208 シフト希望 ─────────
  const wishFilter = { from: '', to: '', uid: '', status: '未処理' };
  let wishSel = null;
  const wishText = (d) => (d.kind === '時間指定' ? `時間指定 ${d.start}〜${d.end}` : d.kind === '出勤可能' ? '出勤可能(時間指定なし)' : d.kind);
  /** 期間単位の提出を日単位の行に展開(#48) */
  const wishRows = () => {
    const ids = staffIds();
    return st.wishSubmissions.filter((w) => ids.includes(w.userId))
      .flatMap((w) => w.days.filter((d) => d.kind).map((d) => ({ key: `${w.id}|${d.date}`, sub: w, day: d })))
      .sort((a, b) => (a.day.date + nameOf(a.sub.userId)).localeCompare(b.day.date + nameOf(b.sub.userId)));
  };
  const submittedText = (w) => [store.fmtStamp(w.submittedAt), w.updatedAt !== w.submittedAt ? `(更新 ${store.fmtStamp(w.updatedAt)})` : ''].join(' ');
  const wishContent = (sub, day) => () => ui.kv([['従業員', nameOf(sub.userId)], ['希望日', store.fmtDate(day.date)], ['希望時間帯', wishText(day)], ['提出日時', submittedText(sub)]]);

  function wishesScreen() {
    const msg = flashArea();
    const body = ui.view(() => {
      const all = wishRows();
      const rows = all.filter((r) => matchFilter(wishFilter, r.day.date, r.sub.userId, r.day.status));
      const sel = all.find((r) => r.key === wishSel);
      return h('div', null,
        filterBar(wishFilter, '希望日', () => body.draw()),
        isDefaultFilter(wishFilter) && !rows.length ? ui.alert('info', ui.docMsg('未処理のシフト希望が存在しないこと')) : null, // Alt-1
        h('div', { class: 'split' },
          ui.table({ // メインフロー2
            cols: [
              { label: '従業員名', render: (r) => nameOf(r.sub.userId), class: 'nowrap' },
              { label: '希望日', render: (r) => store.fmtDate(r.day.date), class: 'nowrap' },
              { label: '希望時間帯', render: (r) => wishText(r.day) },
              { label: '提出日時', render: (r) => submittedText(r.sub) },
              { label: '処理状態', render: (r) => sbadge(r.day.status) },
            ],
            rows, empty: '(該当なし)',
            onRowClick: (r) => { wishSel = r.key; body.draw(); }, rowClass: (r) => (r.key === wishSel ? 'selected' : ''),
          }),
          sel ? wishDetail(sel) : h('div', { class: 'card muted' }, '一覧からシフト希望を指定すると、詳細を表示します(メインフロー3〜4)。')));
    });
    return ui.screen({ title: K.UC['UC-206'], uc: ['UC-206', 'UC-207', 'UC-208'], notes: [ui.conflict(48), ui.tbd(84, '提出締切日'), chargeNote()] }, msg, body);
  }
  function wishDetail({ sub, day }) {
    const ids = staffIds();
    const sameDay = st.shifts.filter((s) => s.date === day.date && ids.includes(s.userId)).sort((a, b) => a.start.localeCompare(b.start));
    return h('div', { class: 'card' },
      h('h3', null, 'シフト希望の詳細'), // メインフロー4
      ui.kv([['従業員', nameOf(sub.userId)], ['希望日', store.fmtDate(day.date)], ['希望時間帯', wishText(day)], ['提出日時', submittedText(sub)],
        ['処理状態', sbadge(day.status)], day.rejectReason ? ['却下理由', day.rejectReason] : null, day.processedAt ? ['処理日時', store.fmtStamp(day.processedAt)] : null]),
      h('h4', null, '希望日に登録済みのシフト(メインフロー5)'),
      sameDay.length ? h('ul', { class: 'compact' }, sameDay.map((s) => h('li', null, `${nameOf(s.userId)} ${s.start}〜${s.end}`))) : h('p', { class: 'muted' }, '(なし)'),
      ui.tbdPlaceholder(13, '人員の状況(必要人数が定義されていないため表示できません)'),
      day.status === '未処理' ? h('div', { class: 'form-actions' }, // メインフロー6(≪extend≫ UC-207 / UC-208)
        h('span', { class: 'muted' }, ui.tbd(52, '一括承認')),
        ui.btn('却下', () => rejectWish(sub, day), 'danger', { title: 'UC-208' }),
        ui.btn('承認', () => approveWish(sub, day), 'primary', { title: 'UC-207' })) : null);
  }
  // UC-207
  function approveWish(sub, day) {
    if (day.kind !== '時間指定') return ui.tbdNotice(49, `「${wishText(day)}」の行を承認した場合に、どんなシフトを登録するかが書かれていません。`);
    confirmModal({ uc: 'UC-207', title: 'シフト希望の承認', content: wishContent(sub, day), okLabel: '承認', onOk: () => {
      if (store.takeFault('MGR-ALREADY-PROCESSED') || day.status !== '未処理') return alreadyDone('対象のシフト希望が承認できない状態であること'); // Alt-2
      checkWishApproval(sub, day, day.start, day.end);
    } });
  }
  function checkWishApproval(sub, day, start, end) { // メインフロー4
    const ov = store.overlaps(sub.userId, day.date, start, end);
    if (ov.length) return adjustModal(sub, day, start, end, ov); // Alt-1
    const av = store.availabilityCheck(sub.userId, day.date, start, end);
    if (!av.ok && av.reason === 'unset') return ui.tbdNotice(43, `${nameOf(sub.userId)} さんの勤務可能時間が未設定のため、範囲チェックができません。`);
    if (!av.ok) { setFlash(outAlert(av.text)); return K.rerender(); } // Alt-3 → UC-206
    day.status = '承認済'; // メインフロー5
    day.processedAt = store.nowStamp();
    st.shifts.push({ id: store.id('SH'), userId: sub.userId, date: day.date, start, end }); // 6
    store.notify(sub.userId, 'シフト希望の承認結果'); // 7
    const adjusted = start !== day.start || end !== day.end;
    setFlash(done('承認が完了したこと', adjusted ? h('div', null, ui.tbd(106), ` 調整後の時間帯 ${start}〜${end} でシフトを登録しました(希望の内容は変更していません)`) : null)); // 8
    K.rerender();
  }
  function adjustModal(sub, day, start, end, ov) { // Alt-1: 重複しているシフトを提示し、時間帯を調整した内容を入力 → メインフロー4
    const s = ui.input({ type: 'time', value: start });
    const e = ui.input({ type: 'time', value: end });
    ui.modal({
      title: '時間帯の調整', uc: ['UC-207'],
      body: h('div', null,
        overlapAlert(ov),
        h('p', null, '時間帯を調整した内容を入力してください(Alt-1)。'),
        h('div', { class: 'inline-fields' }, ui.field('開始時刻', s), ui.field('終了時刻', e)),
        h('p', { class: 'muted' }, ui.tbd(106), ' 調整中の中止と、調整した時間帯の入力チェックは書かれていません')),
      actions: [
        { label: '中止', onClick: () => { ui.tbdNotice(106, '時間帯の調整中に承認をやめた場合の扱いが書かれていません(Ex-1 はメインフロー3より前のキャンセルだけ)。'); } },
        { label: '再チェック', kind: 'primary', onClick: () => {
          if (!s.value || !e.value || store.minutes(e.value) <= store.minutes(s.value)) {
            ui.tbdNotice(106, '調整した時間帯が正しくない(終了が開始以前など)場合の扱いが書かれていません。');
            return false;
          }
          checkWishApproval(sub, day, s.value, e.value);
        } },
      ],
    });
  }
  // UC-208
  function rejectWish(sub, day) {
    rejectFlow({
      uc: 'UC-208', title: 'シフト希望の却下', content: wishContent(sub, day),
      alreadyPhrase: '対象のシフト希望が却下できない状態であること', isPending: () => day.status === '未処理',
      apply: (r) => { day.status = '却下'; day.rejectReason = r; day.processedAt = store.nowStamp(); },
      userId: sub.userId, notifyText: 'シフト希望の却下結果と却下理由',
    });
  }

  // ───────── UC-209〜211 勤怠修正申請 ─────────
  const fixFilter = { from: '', to: '', uid: '', status: '未処理' };
  let fixSel = null;
  /** 修正内容「出勤 前→後 / 退勤 前→後」(#58) */
  const fixChange = (fr) => h('div', { class: 'fix-change' },
    h('div', null, '出勤 ', ui.diff(store.hm(fr.before.clockIn), fr.after.clockIn || '')),
    h('div', null, '退勤 ', ui.diff(store.hm(fr.before.clockOut), fr.after.clockOut || '')));
  const fixContent = (fr) => () => ui.kv([['従業員', nameOf(fr.userId)], ['対象日', store.fmtDate(fr.date)], ['修正内容', fixChange(fr)], ['申請理由', fr.reason], ['申請日時', store.fmtStamp(fr.submittedAt)]]);

  function fixesScreen() {
    const msg = flashArea();
    const body = ui.view(() => {
      const ids = staffIds();
      const all = st.fixRequests.filter((x) => ids.includes(x.userId)).sort((a, b) => (a.date + a.submittedAt).localeCompare(b.date + b.submittedAt));
      const rows = all.filter((x) => matchFilter(fixFilter, x.date, x.userId, x.status));
      const sel = all.find((x) => x.id === fixSel);
      return h('div', null,
        filterBar(fixFilter, '対象日', () => body.draw()),
        isDefaultFilter(fixFilter) && !rows.length ? ui.alert('info', ui.docMsg('未処理の勤怠修正申請が存在しないこと')) : null, // Alt-1
        h('div', { class: 'split' },
          ui.table({ // メインフロー2
            cols: [
              { label: '従業員名', render: (x) => nameOf(x.userId), class: 'nowrap' },
              { label: '対象日', render: (x) => store.fmtDate(x.date), class: 'nowrap' },
              { label: ['修正内容 ', ui.tbd(58)], render: fixChange, class: 'nowrap' },
              { label: '申請理由', key: 'reason', class: 'reason' },
              { label: '申請日時', render: (x) => store.fmtStamp(x.submittedAt), class: 'nowrap' },
              { label: '処理状態', render: (x) => sbadge(x.status) },
            ],
            rows, empty: '(該当なし)',
            onRowClick: (x) => { fixSel = x.id; body.draw(); }, rowClass: (x) => (x.id === fixSel ? 'selected' : ''),
          }),
          sel ? fixDetail(sel) : h('div', { class: 'card muted' }, '一覧から勤怠修正申請を指定すると、詳細を表示します(メインフロー3〜4)。')));
    });
    return ui.screen({ title: K.UC['UC-209'], uc: ['UC-209', 'UC-210', 'UC-211'], notes: [ui.tbd(15, '何日前まで・締め処理後'), chargeNote()] }, msg, body);
  }
  function fixDetail(fr) {
    const sh = store.shiftsOf(fr.userId, fr.date);
    const noShiftWork = !sh.length && !!fr.after.clockIn;
    return h('div', { class: 'card' },
      h('h3', null, '勤怠修正申請の詳細'), // メインフロー4
      ui.kv([['従業員', nameOf(fr.userId)], ['対象日', store.fmtDate(fr.date)], ['修正内容', fixChange(fr)], ['申請理由', fr.reason],
        ['申請日時', store.fmtStamp(fr.submittedAt)], ['処理状態', sbadge(fr.status)],
        fr.rejectReason ? ['却下理由', fr.rejectReason] : null, fr.processedAt ? ['処理日時', store.fmtStamp(fr.processedAt)] : null]),
      h('h4', null, '対象日のシフトとの矛盾チェック(メインフロー5)'),
      ui.kv([['対象日のシフト', sh.length ? sh.map((s) => `${s.start}〜${s.end}`).join('、') : '(なし)']]),
      noShiftWork
        ? ui.alert('warn', ui.docMsg('矛盾している点'), ': シフトのない日の出勤 ', ui.tbd(57)) // Alt-3 → メインフロー6
        : h('p', null, ui.docMsg('矛盾がないこと'), ' ', ui.tbd(57, '「シフトのない日の出勤」以外の判定基準は未定義')),
      fr.status === '未処理' ? h('div', { class: 'form-actions' }, // メインフロー6
        ui.btn('却下', () => rejectFix(fr), 'danger', { title: 'UC-211' }),
        ui.btn('承認', () => approveFix(fr), 'primary', { title: 'UC-210' })) : null);
  }
  // UC-210
  function approveFix(fr) {
    confirmModal({ uc: 'UC-210', title: '勤怠修正申請の承認', content: fixContent(fr), okLabel: '承認', onOk: () => {
      if (store.takeFault('MGR-ALREADY-PROCESSED') || fr.status !== '未処理') return alreadyDone('対象の勤怠修正申請が承認できない状態であること'); // Alt-2
      const a = fr.after;
      if (!a.clockIn || !a.clockOut || store.minutes(a.clockIn) >= store.minutes(a.clockOut)) { // メインフロー4 → Alt-1(#59)
        setFlash(ui.alert('error', ui.docMsg('修正後の内容が無効である理由'),
          `: ${!a.clockIn || !a.clockOut ? '出勤時刻または退勤時刻がない' : '出勤時刻が退勤時刻より前ではない'} `, ui.tbd(59)));
        return K.rerender(); // UC-209 に戻る
      }
      fr.status = '承認済'; // メインフロー5
      fr.processedAt = store.nowStamp();
      fr.processedBy = store.me().id;
      const rec = store.recordOf(fr.userId, fr.date);
      store.history('勤怠修正履歴', { summary: `${nameOf(fr.userId)} ${store.fmtDate(fr.date)}(勤怠修正申請の承認)`, before: rec ? { ...rec } : null, reason: fr.reason }); // 6
      let created = false;
      if (rec) Object.assign(rec, { clockIn: toSec(a.clockIn), clockOut: toSec(a.clockOut) }); // 7
      else {
        st.records.push({ id: store.id('RC'), userId: fr.userId, date: fr.date, clockIn: toSec(a.clockIn), clockOut: toSec(a.clockOut), breakTime: store.user(fr.userId)?.breakTime ?? null });
        created = true; // #60
      }
      store.notify(fr.userId, '勤怠修正申請の承認結果'); // 8
      setFlash(done('承認が完了したこと', created ? h('div', null, ui.tbd(60), ' 対象日に勤怠記録がなかったため、新しく作成して反映しました') : null)); // 9
      K.rerender();
    } });
  }
  // UC-211
  function rejectFix(fr) {
    rejectFlow({
      uc: 'UC-211', title: '勤怠修正申請の却下', content: fixContent(fr),
      alreadyPhrase: '対象の勤怠修正申請が却下できない状態であること', isPending: () => fr.status === '未処理',
      apply: (r) => Object.assign(fr, { status: '却下', rejectReason: r, processedAt: store.nowStamp(), processedBy: store.me().id }),
      userId: fr.userId, notifyText: '勤怠修正申請の却下結果と却下理由',
    });
  }

  // ───────── UC-212 勤怠を修正する ─────────
  function attendanceFixScreen() {
    const f = { uid: '', date: '' };
    const inp = { clockIn: '', clockOut: '', breakTime: '', reason: '' };
    let step = 'select'; // select → missing(Alt-1) → form → confirm
    let rec = null;
    let err = null;
    const msg = flashArea();
    const reset = () => { step = 'select'; rec = null; err = null; };
    const v = ui.view(() => h('div', null,
      h('div', { class: 'card form' }, // メインフロー2〜3
        h('div', { class: 'inline-fields' },
          ui.field('従業員', ui.select(staffOptions('選択してください'), { value: f.uid, class: ['input', step === 'invalid' && !f.uid && 'invalid'], onchange: (ev) => { f.uid = ev.target.value; reset(); v.draw(); } }), { required: true, note: ui.tbd(42) }),
          ui.field('日付', ui.input({ type: 'date', value: f.date, class: ['input', step === 'invalid' && !f.date && 'invalid'], onchange: (ev) => { f.date = ev.target.value; reset(); v.draw(); } }), { required: true, note: ui.tbd(15) })),
        step === 'select' || step === 'invalid' ? h('div', { class: 'form-actions' }, ui.btn('勤怠記録を表示', show, 'primary')) : null),
      step === 'missing' ? h('div', { class: 'card' }, // Alt-1
        ui.alert('warn', ui.docMsg('勤怠記録が存在しないこと')),
        h('p', null, ui.docMsg('勤怠記録を新しく作成するか確認')),
        h('div', { class: 'form-actions' },
          ui.btn('キャンセル', cancelled), // Ex-1
          ui.btn('勤怠記録を作成する', () => { step = 'form'; v.draw(); }, 'primary'))) : null,
      step === 'form' ? formView() : null,
      step === 'confirm' ? confirmView() : null));

    function show() {
      if (!f.uid || !f.date) { step = 'invalid'; v.draw(); return; }
      rec = store.recordOf(f.uid, f.date); // メインフロー4
      const u = store.user(f.uid);
      Object.assign(inp, rec
        ? { clockIn: rec.clockIn ?? '', clockOut: rec.clockOut ?? '', breakTime: rec.breakTime ?? '', reason: '' }
        : { clockIn: '', clockOut: '', breakTime: u.breakTime ?? '', reason: '' }); // 休憩時間の初期値はユーザーの設定値(#40)
      step = rec ? 'form' : 'missing';
      v.draw();
    }
    const bind = (k) => (ev) => { inp[k] = ev.target.value; };
    function formView() {
      return h('div', null,
        h('div', { class: 'card' },
          h('h3', null, '指定された日の勤怠記録(メインフロー4)'),
          rec ? ui.kv([['出勤時刻', rec.clockIn ?? '(なし)'], ['退勤時刻', rec.clockOut ?? '(なし)'], ['休憩時間', [rec.breakTime ?? '(なし)', ' ', ui.conflict(40)]]])
            : h('p', null, '(勤怠記録なし。新しく作成します)')),
        h('div', { class: 'card form' }, // メインフロー5
          h('h3', null, '修正後の勤怠情報'),
          h('div', { class: 'inline-fields' },
            ui.field('出勤時刻', ui.input({ type: 'time', step: 1, value: inp.clockIn, oninput: bind('clockIn') })),
            ui.field('退勤時刻', ui.input({ type: 'time', step: 1, value: inp.clockOut, oninput: bind('clockOut') }))),
          ui.tbdBox(61, '休憩時間の形式は未定義(自由入力)', ui.field('休憩時間', ui.input({ value: inp.breakTime, oninput: bind('breakTime') }), { note: ui.conflict(40) })),
          ui.field('修正理由', ui.textarea({ value: inp.reason, oninput: bind('reason') }), { required: true }),
          err,
          h('div', { class: 'form-actions' },
            ui.btn('キャンセル', cancelled), // Ex-1
            ui.btn('確認へ', next, 'primary'))));
    }
    function next() { // メインフロー6
      const errs = [];
      if (inp.clockIn && inp.clockOut && store.minutes(inp.clockOut) < store.minutes(inp.clockIn)) errs.push(ui.alert('error', ui.docMsg('入力された勤怠情報に誤りがあること'))); // Alt-2
      if (!inp.reason.trim()) errs.push(ui.alert('error', ui.docMsg('修正理由の入力が必要であること'))); // Alt-3
      if (errs.length) { err = errs; v.draw(); return; } // → メインフロー5
      err = null; step = 'confirm'; v.draw();
    }
    function confirmView() { // メインフロー7: 修正前と修正後の内容を提示し、修正の確認を求める
      return h('div', { class: 'card' },
        h('h3', null, '修正内容の確認'),
        ui.kv([['従業員', nameOf(f.uid)], ['日付', store.fmtDate(f.date)],
          ['出勤時刻', ui.diff(rec?.clockIn ?? '', toSec(inp.clockIn) ?? '')],
          ['退勤時刻', ui.diff(rec?.clockOut ?? '', toSec(inp.clockOut) ?? '')],
          ['休憩時間', ui.diff(rec?.breakTime ?? '', inp.breakTime)],
          ['修正理由', inp.reason.trim()]]),
        h('p', null, '修正しますか。'),
        h('div', { class: 'form-actions' }, ui.btn('キャンセル', cancelled), ui.btn('修正', apply, 'primary')));
    }
    function apply() {
      const name = nameOf(f.uid);
      // メインフロー9: 修正前の内容・修正者・修正日時・修正理由(修正者と修正日時は history が by / at として持つ)
      store.history('勤怠修正履歴', { summary: `${name} ${store.fmtDate(f.date)}(勤怠の直接修正)`, before: rec ? { ...rec } : null, reason: inp.reason.trim() });
      const after = { clockIn: toSec(inp.clockIn), clockOut: toSec(inp.clockOut), breakTime: inp.breakTime || null };
      if (rec) Object.assign(rec, after); // 10
      else st.records.push({ id: store.id('RC'), userId: f.uid, date: f.date, ...after });
      store.notify(f.uid, '勤怠記録が修正されたこと'); // 11
      setFlash(done('修正が完了したこと')); // 12
      K.rerender();
    }
    return ui.screen({ title: K.UC['UC-212'], uc: ['UC-212'], notes: [ui.tbd(15, '締め処理後の月'), chargeNote()] }, msg, v);
  }

  // ───────── UC-213 勤務実態を一覧表示する ─────────
  const actualF = { uid: 'ALL', from: '2026-10-01', to: store.TODAY, shown: false };
  /** 差異(メインフロー8 #66)。今日の分は判定途中のため遅刻だけ判定(#107) */
  function diffsOf(d, sh, rec) {
    const out = [];
    if (!sh) { if (rec) out.push('シフトのない日の打刻'); return out; }
    if (d > store.TODAY) return out;
    const hasIn = !!rec?.clockIn;
    const hasOut = !!rec?.clockOut;
    if (d === store.TODAY) { if (hasIn && store.minutes(rec.clockIn) > store.minutes(sh.start)) out.push('遅刻'); return out; }
    if (!hasIn && !hasOut) return ['打刻なし(欠勤/打刻漏れの区分TBD)'];
    if (hasIn && store.minutes(rec.clockIn) > store.minutes(sh.start)) out.push('遅刻');
    if (hasOut && store.minutes(rec.clockOut) < store.minutes(sh.end)) out.push('早退');
    if (hasIn !== hasOut) out.push('打刻漏れ');
    return out;
  }
  const worked = (rec) => (rec?.clockIn && rec?.clockOut
    ? Math.max(0, store.minutes(rec.clockOut) - store.minutes(rec.clockIn) - breakMin(rec.breakTime)) : null); // #64
  const diffTone = (x) => (x === '遅刻' || x === '早退' || x === '打刻漏れ' ? 'ng' : 'warn');

  function actualScreen() {
    const v = ui.view(() => h('div', null, filterCard(), actualF.shown ? result() : null));
    function filterCard() { // メインフロー2〜3
      const set = (k) => (ev) => { actualF[k] = ev.target.value; };
      return h('div', { class: 'card form' },
        h('div', { class: 'inline-fields' },
          ui.field('従業員', ui.select([{ value: 'ALL', label: '担当店舗の全従業員' }, ...staff().map((u) => ({ value: u.id, label: u.name }))],
            { value: actualF.uid, onchange: set('uid') }), { note: ui.tbd(63) }),
          ui.field('期間(開始)', ui.input({ type: 'date', value: actualF.from, onchange: set('from') })),
          ui.field('期間(終了)', ui.input({ type: 'date', value: actualF.to, onchange: set('to') }))),
        h('div', { class: 'form-actions' }, ui.btn('表示', () => { actualF.shown = true; v.draw(); }, 'primary')));
    }
    function result() {
      const emps = actualF.uid === 'ALL' ? staff() : staff().filter((u) => u.id === actualF.uid);
      const dates = [];
      if (actualF.from && actualF.to) for (let d = actualF.from; d <= actualF.to && dates.length < 93; d = store.addDays(d, 1)) dates.push(d);
      const rows = [];
      for (const d of dates) {
        for (const u of emps) {
          const sh = store.shiftsOf(u.id, d)[0];
          const rec = store.recordOf(u.id, d); // メインフロー4: 最新の打刻記録を1分単位で集計
          if (!sh && !rec) continue;
          rows.push({ d, u, sh, rec, mins: worked(rec), diffs: diffsOf(d, sh, rec) });
        }
      }
      if (!rows.some((r) => r.rec)) return ui.alert('info', ui.docMsg('該当する勤怠記録が存在しないこと')); // Alt-1 → メインフロー2
      const totals = emps.map((u) => {
        const mine = rows.filter((r) => r.u === u);
        return { u, sum: mine.reduce((a, r) => a + (r.mins ?? 0), 0),
          late: mine.filter((r) => r.diffs.includes('遅刻')).length, early: mine.filter((r) => r.diffs.includes('早退')).length };
      });
      const diffRows = rows.filter((r) => r.diffs.length);
      return h('div', null,
        // (a) メインフロー5: 各従業員の現在の勤務ステータス
        h('div', { class: 'card' },
          h('h3', null, '現在の勤務ステータス(メインフロー5)'),
          ui.conflictBox(62, '勤務ステータスの呼び方',
            h('div', null, 'UC-213 メインフロー5: 「勤務中、休憩中、退勤済みなど」'),
            h('div', null, 'UC-305 備考: 「出勤中」「退勤中」「休憩中」 → 表示は UC-305 の値')),
          ui.table({ cols: [{ label: '従業員', render: (u) => u.name }, { label: '勤務ステータス', render: (u) => sbadge(u.status) }], rows: emps })),
        // (b) メインフロー6: 日ごと
        h('div', { class: 'card' },
          h('h3', null, '日ごとの勤務実態(メインフロー6)'),
          h('p', { class: 'muted' }, '打刻記録は1分単位で集計(秒は切り捨て) ', ui.tbd(64)),
          ui.table({
            cols: [
              { label: '日付', render: (r) => store.fmtDate(r.d), class: 'nowrap' },
              { label: '従業員', render: (r) => r.u.name, class: 'nowrap' },
              { label: 'シフト', render: (r) => (r.sh ? `${r.sh.start}〜${r.sh.end}` : '—'), class: 'nowrap' },
              { label: '出勤時刻', render: (r) => store.hm(r.rec?.clockIn) || '—' },
              { label: '退勤時刻', render: (r) => store.hm(r.rec?.clockOut) || '—' },
              { label: ['休憩時間 ', ui.conflict(40)], render: (r) => r.rec?.breakTime ?? '—' },
              { label: ['勤務時間 ', ui.tbd(64)], render: (r) => (r.mins == null ? '—' : store.fmtMinutes(r.mins)) },
              { label: ['差異 ', ui.tbd(66)], render: (r) => h('span', null, r.diffs.map((x) => ui.badge(x, diffTone(x))),
                r.d === store.TODAY && r.sh ? ui.tbd(107, '当日分') : null) },
            ],
            rows,
          })),
        // (c) メインフロー7: 期間内の合計
        h('div', { class: 'card' },
          h('h3', null, '期間内の合計(メインフロー7)'),
          ui.table({
            cols: [
              { label: '従業員', render: (t) => t.u.name },
              { label: '合計勤務時間', render: (t) => store.fmtMinutes(t.sum) },
              { label: '残業時間', render: () => ui.tbd(65, '定義なし') },
              { label: '遅刻', render: (t) => `${t.late}回` },
              { label: '早退', render: (t) => `${t.early}回` },
              { label: '欠勤', render: () => ui.tbd(66, '判定基準なし') },
            ],
            rows: totals,
          }),
          ui.tbdPlaceholder(65, '残業時間の定義(1日8時間超/週40時間超/シフト超過 など)がないため集計できません')),
        // (d) メインフロー8: 予定シフトと打刻記録に差異がある日
        h('div', { class: 'card' },
          h('h3', null, '予定シフトと打刻記録に差異がある日(メインフロー8)'),
          ui.table({
            cols: [
              { label: '日付', render: (r) => store.fmtDate(r.d) },
              { label: '従業員', render: (r) => r.u.name },
              { label: 'シフト', render: (r) => (r.sh ? `${r.sh.start}〜${r.sh.end}` : '—') },
              { label: '差異', render: (r) => r.diffs.map((x) => ui.badge(x, diffTone(x))) },
            ],
            rows: diffRows, empty: '(なし)',
          })),
        // (e) Alt-2 / (f) 備考1
        ui.tbdPlaceholder(67, 'Alt-2: 36協定の上限を超えている/超えそうな従業員の警告(上限値・閾値が未定義のため判定しません)'),
        ui.tbdPlaceholder(68, '集計結果のファイル出力(備考1)'));
    }
    return ui.screen({ title: K.UC['UC-213'], uc: ['UC-213'], notes: [chargeNote()] },
      h('p', { class: 'muted' }, '勤務ステータスは従業員の打刻(UC-304)と勤務ステータスの変更(UC-305)によって変わります(備考2)。'), v);
  }

  // ───────── UC-214〜216 シフト日時変更申請 ─────────
  const chgFilter = { from: '', to: '', uid: '', status: '未処理' };
  let chgSel = null;
  const chgContent = (cr) => () => ui.kv([['従業員', nameOf(cr.userId)], ['変更前のシフト', fmtShift(cr.before)], ['変更希望の日時', fmtShift(cr.after)],
    ['申請理由', cr.reason], ['申請日時', store.fmtStamp(cr.submittedAt)]]);

  function changesScreen() {
    const msg = flashArea();
    const body = ui.view(() => {
      const ids = staffIds();
      const all = st.changeRequests.filter((x) => ids.includes(x.userId)).sort((a, b) => (a.before.date + a.submittedAt).localeCompare(b.before.date + b.submittedAt));
      const rows = all.filter((x) => matchFilter(chgFilter, x.before.date, x.userId, x.status));
      const sel = all.find((x) => x.id === chgSel);
      return h('div', null,
        filterBar(chgFilter, '変更前のシフトの日', () => body.draw()),
        isDefaultFilter(chgFilter) && !rows.length ? ui.alert('info', ui.docMsg('未処理のシフト日時変更申請が存在しないこと')) : null, // Alt-1
        h('div', { class: 'split' },
          ui.table({ // メインフロー2
            cols: [
              { label: '従業員名', render: (x) => nameOf(x.userId), class: 'nowrap' },
              { label: '変更前のシフト', render: (x) => fmtShift(x.before), class: 'nowrap' },
              { label: '変更希望の日時', render: (x) => fmtShift(x.after), class: 'nowrap' },
              { label: '申請理由', key: 'reason', class: 'reason' },
              { label: '申請日時', render: (x) => store.fmtStamp(x.submittedAt), class: 'nowrap' },
              { label: '処理状態', render: (x) => sbadge(x.status) },
            ],
            rows, empty: '(該当なし)',
            onRowClick: (x) => { chgSel = x.id; body.draw(); }, rowClass: (x) => (x.id === chgSel ? 'selected' : ''),
          }),
          sel ? changeDetail(sel) : h('div', { class: 'card muted' }, '一覧からシフト日時変更申請を指定すると、詳細を表示します(メインフロー3〜4)。')));
    });
    return ui.screen({ title: K.UC['UC-214'], uc: ['UC-214', 'UC-215', 'UC-216'], notes: [ui.tbd(69), ui.tbd(14, '何日前まで'), chargeNote()] }, msg, body);
  }
  function changeDetail(cr) {
    const a = cr.after;
    const ov = store.overlaps(cr.userId, a.date, a.start, a.end, cr.shiftId); // メインフロー5(元のシフト自身は除く)
    return h('div', { class: 'card' },
      h('h3', null, 'シフト日時変更申請の詳細'), // メインフロー4
      ui.kv([['従業員', nameOf(cr.userId)], ['変更前のシフト', fmtShift(cr.before)], ['変更希望の日時', fmtShift(a)], ['申請理由', cr.reason],
        ['申請日時', store.fmtStamp(cr.submittedAt)], ['処理状態', sbadge(cr.status)],
        cr.rejectReason ? ['却下理由', cr.rejectReason] : null, cr.processedAt ? ['処理日時', store.fmtStamp(cr.processedAt)] : null]),
      h('h4', null, '重複・人員不足のチェック(メインフロー5)'),
      ov.length
        ? ui.alert('warn', ui.docMsg('重複・人員不足の内容'), h('ul', { class: 'compact' }, ov.map((s) => h('li', null, `重複: ${nameOf(s.userId)} ${fmtShift(s)}`)))) // Alt-3 → メインフロー6
        : h('p', null, ui.docMsg('他のシフトとの重複が生じないこと')),
      ui.tbdPlaceholder(13, '人員不足(必要人数が定義されていないため判定できません)'),
      cr.status === '未処理' ? h('div', { class: 'form-actions' }, // メインフロー6
        ui.btn('却下', () => rejectChange(cr), 'danger', { title: 'UC-216' }),
        ui.btn('承認', () => approveChange(cr), 'primary', { title: 'UC-215' })) : null);
  }
  // UC-215
  function approveChange(cr) {
    confirmModal({ uc: 'UC-215', title: 'シフト日時変更申請の承認', content: chgContent(cr), okLabel: '承認', onOk: () => {
      if (store.takeFault('MGR-ALREADY-PROCESSED') || cr.status !== '未処理') return alreadyDone('対象のシフト日時変更申請が承認できない状態であること'); // Alt-3
      const sh = st.shifts.find((s) => s.id === cr.shiftId);
      if (store.takeFault('UC-215-Alt2') || !sh || store.shiftState(sh) === '勤務済み') { // Alt-2
        setFlash(ui.alert('error', ui.docMsg('変更前のシフトが変更できない状態であること'), ' ', ui.tbd(45)));
        return K.rerender();
      }
      const a = cr.after;
      const ov = store.overlaps(cr.userId, a.date, a.start, a.end, cr.shiftId); // メインフロー4
      if (ov.length) { setFlash(overlapAlert(ov, h('div', null, ui.conflict(54), ' UC-207 と異なり、時間帯の調整はせず一覧に戻ります'))); return K.rerender(); } // Alt-1 → UC-214
      const av = store.availabilityCheck(cr.userId, a.date, a.start, a.end);
      if (!av.ok && av.reason === 'unset') return ui.tbdNotice(43, `${nameOf(cr.userId)} さんの勤務可能時間が未設定のため、範囲チェックができません。`);
      if (!av.ok) { setFlash(outAlert(av.text)); return K.rerender(); } // Alt-4 → UC-214
      cr.status = '承認済'; // メインフロー5
      cr.processedAt = store.nowStamp();
      cr.processedBy = store.me().id;
      const before = { ...sh };
      store.history('シフト変更履歴', { summary: `${nameOf(cr.userId)} ${fmtShift(before)} → ${fmtShift(a)}(シフト日時変更申請の承認)`, before }); // 6
      Object.assign(sh, { date: a.date, start: a.start, end: a.end }); // 7
      store.notify(cr.userId, 'シフト日時変更申請の承認結果'); // 8
      setFlash(done('承認が完了したこと')); // 9
      K.rerender();
    } });
  }
  // UC-216
  function rejectChange(cr) {
    rejectFlow({
      uc: 'UC-216', title: 'シフト日時変更申請の却下', content: chgContent(cr),
      alreadyPhrase: '対象のシフト日時変更申請が却下できない状態であること', isPending: () => cr.status === '未処理',
      apply: (r) => Object.assign(cr, { status: '却下', rejectReason: r, processedAt: store.nowStamp(), processedBy: store.me().id }),
      userId: cr.userId, notifyText: 'シフト日時変更申請の却下結果と却下理由',
      doneExtra: h('div', null, ui.conflict(70), ' 従業員が却下理由を参照できる画面はありません'),
    });
  }

  // ───────── ルート・ナビ ─────────
  const R = (path, title, render) => K.route(path, { role: '勤怠管理者', title, render });
  R('/manager/shifts', 'シフト指定画面', shiftListScreen);
  R('/manager/shifts/new', K.UC['UC-203'], shiftNewScreen);
  R('/manager/shifts/:id/edit', K.UC['UC-204'], shiftEditScreen);
  R('/manager/wishes', K.UC['UC-206'], wishesScreen);
  R('/manager/fixes', K.UC['UC-209'], fixesScreen);
  R('/manager/attendance-fix', K.UC['UC-212'], attendanceFixScreen);
  R('/manager/actual', K.UC['UC-213'], actualScreen);
  R('/manager/changes', K.UC['UC-214'], changesScreen);

  K.nav['勤怠管理者'].push(
    { group: 'シフト' },
    { path: '/manager/shifts', uc: ['UC-204', 'UC-205'], label: 'シフト指定(変更・削除)', match: '/manager/shifts/SH' },
    { path: '/manager/shifts/new', uc: ['UC-203'], label: K.UC['UC-203'] },
    { group: 'シフト希望' },
    { path: '/manager/wishes', uc: ['UC-206', 'UC-207', 'UC-208'], label: K.UC['UC-206'] },
    { group: '勤怠修正申請' },
    { path: '/manager/fixes', uc: ['UC-209', 'UC-210', 'UC-211'], label: K.UC['UC-209'] },
    { group: '勤怠' },
    { path: '/manager/attendance-fix', uc: ['UC-212'], label: K.UC['UC-212'] },
    { path: '/manager/actual', uc: ['UC-213'], label: K.UC['UC-213'] },
    { group: 'シフト日時変更申請' },
    { path: '/manager/changes', uc: ['UC-214', 'UC-215', 'UC-216'], label: K.UC['UC-214'] },
  );
})();
