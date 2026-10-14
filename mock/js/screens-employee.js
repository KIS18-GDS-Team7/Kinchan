/*
 * 従業員: UC-303〜UC-311(スマホ幅)
 * - UC-303「マイページ」は ADR-0003 で使わない語のため、参照している UC の記述を並べる TBD ページ(#71)
 * - UC-305 は独立した画面を持たず、UC-303 ページの勤務ステータス表示として実装(#73)
 * - 「」で文言が明記されたメッセージは原文ママ(句読点・括弧の不一致も含む)
 */
(function () {
  const { h, ui, store } = K;
  const st = store.state;
  const ROLE = '従業員';

  // ───────── 共通部品 ─────────
  const back = () => h('div', { class: 'emp-back' }, ui.scaffoldLink('← UC-303 ページへ', '/employee'));
  const quote = (...lines) => h('ul', { class: 'quote' }, lines.map((l) => h('li', null, l)));
  /** 「画面の再読み込みを促す待機状態」(UC-304 Ex-3 など)から抜けるための仕様外ボタン */
  const reloadBtn = () => ui.scaffold('再読み込み', ui.btn('画面を読み込み直す', () => K.rerender()));
  const ucHead = (uc, ...extra) => h('h3', { class: 'emp-uc-head' }, ui.ucTag(uc), h('span', null, K.UC[uc]), ...extra);
  const dash = (v) => v || '—';
  const mySubmission = () => st.wishSubmissions.find((w) => w.userId === st.session.userId && w.period === st.settings.wishPeriod);
  const hasPendingFix = (uid, date) => st.fixRequests.some((f) => f.userId === uid && f.date === date && f.status === '未処理');

  /** 勤怠修正申請の処理状態(従業員側の語で表示。未処理は UC-306「申請中」と UC-310「承認待ち」を併記 #56) */
  const fixStatus = (s) => (s === '未処理'
    ? h('span', null, ui.badge('申請中/承認待ち', 'pending'), ui.conflict(56))
    : ui.badge(s === '承認済' ? '承認済み' : s, ui.statusTone(s)));

  // UC-306 Ex-2 の文言(原文ママ。括弧が『…」になっている #80)
  const FIX_DUP_TEXT = '該当日の修正申請はすでに送信されています。内容を修正する場合は『勤怠修正申請内容を一覧表示する（UC-310）」から編集してください';

  // ───────── UC-303 TBD ページ(+ UC-304 打刻 / UC-305 勤務ステータス) ─────────
  function myPage() {
    const ctx = { msg: null, stale: null }; // stale: UC-305 Ex-2 で更新されなかった画面上のステータス

    function punch(type) {
      const u = store.me();
      const rec = store.recordOf(u.id, store.TODAY);
      ctx.msg = null;
      if (type === '出勤') {
        if (u.status === '出勤中') return ui.tbdNotice(76, '出勤中に出勤ボタンが押されました(UC-304 Ex-1 の「など」に含まれるかが未定義)。');
        if (u.status === '休憩中') return ui.tbdNotice(72, '休憩中に出勤ボタンが押されました(休憩中への遷移経路自体が未定義)。');
        if (rec && rec.clockOut) return ui.tbdNotice(76, '同じ日に退勤した後で、もう一度出勤ボタンが押されました。');
        if (!store.shiftsOf(u.id, store.TODAY).length) { // Ex-2: シフトが入っていない日に出勤打刻
          ctx.msg = ui.alert('error', '現在は打刻できません', ' ', ui.tbd(77));
          return page.draw();
        }
      } else if (u.status !== '出勤中') {
        if (u.status === '休憩中') return ui.tbdNotice(72, '休憩中に退勤ボタンが押されました(休憩中への遷移経路自体が未定義)。');
        ctx.msg = ui.alert('error', '現在は打刻できません', ' ', ui.tbd(76)); // Ex-1: 出勤していないのに退勤 / 退勤済みなのに再度退勤
        return page.draw();
      }
      if (store.takeFault('UC-304-Ex3')) { // Ex-3: 保存失敗 → 保存せず再読み込み待ち
        ctx.msg = h('div', null, ui.alert('error', '打刻情報の保存に失敗しました。画面を読み込み直してください。'), reloadBtn());
        return page.draw();
      }
      // メインフロー2: 打刻情報(打刻時刻、打刻種類)を保存(秒単位)
      const at = store.nowStamp();
      const time = at.slice(11);
      st.punches.push({ id: store.id('PN'), userId: u.id, type, at });
      if (rec) rec[type === '出勤' ? 'clockIn' : 'clockOut'] = time;
      else st.records.push({ id: store.id('RC'), userId: u.id, date: store.TODAY, clockIn: type === '出勤' ? time : null, clockOut: type === '退勤' ? time : null, breakTime: u.breakTime });
      // メインフロー3: UC-305 勤務ステータスを変更する
      if (store.takeFault('UC-305-Ex1')) { // Ex-1: 認識不能な打刻種類 → 直前のステータスを維持(#74)
        ctx.msg = ui.alert('error', '不正な打刻種類が選択されました', ' ', ui.conflict(74));
        return page.draw();
      }
      const prev = u.status;
      u.status = type === '出勤' ? '出勤中' : '退勤中'; // 打刻種類 → ステータスの対応(#74)
      if (store.takeFault('UC-305-Ex2')) { // Ex-2: 画面上のステータス表示だけ更新されない
        ctx.stale = prev;
        ctx.msg = h('div', null, ui.alert('error', '勤務ステータスの更新に失敗しました。画面を読み込み直してください'), reloadBtn());
      }
      return page.draw(); // メインフロー4: 打刻状況を表示(成功メッセージは記述なし)
    }

    const section = (uc, quoteLines, ...body) => h('div', { class: 'card emp-ref' }, ucHead(uc), quote(...quoteLines), ...body);

    const page = ui.view(() => {
      const u = store.me();
      const shown = ctx.stale ?? u.status;
      const todays = st.punches.filter((p) => p.userId === u.id && p.at.startsWith(store.TODAY));
      const accepting = st.settings.wishAccepting;

      return ui.screen({ title: 'マイページ(名称・内容TBD)', uc: ['UC-303'], notes: [ui.tbd(71)] },
        h('div', { class: 'card' },
          h('p', null, '「マイページ」は ADR-0003 で使わないと決めた語です。表示内容と名称は issue #61 で未決です。'),
          quote('解釈A: ログイン後に遷移するページ(打刻ページ)', '解釈B: 個人の勤務実態やシフトを表示するページ'),
          h('p', { class: 'muted' }, 'requirements.md の UC-303 は概要が TBD(FR-012「マイページを表示」)。以下は、このページを参照している UC とその記述です。参照されている要素は、配置を決めないまま(TBD枠)操作できるようにしています。')),

        // UC-304 打刻をする
        section('UC-304', [
          '開始条件: 従業員がマイページで打刻ボタンを押下する',
          'メインフロー: アクターはマイページ（UC-303）上で打刻ボタン（出勤、退勤）を押下する',
          'メインフロー: システムはマイページ（UC-303）に打刻状況を表示する',
          '備考: 本システムでの打刻はWeb画面（マイページ）上の打刻ボタンの押下で行う',
        ], ui.tbdBox(71, 'このページ上の配置は未定義',
          h('div', { class: 'punch-buttons' },
            ui.btn('出勤', () => punch('出勤'), 'primary btn-lg', { 'data-punch': '出勤' }),
            ui.btn('退勤', () => punch('退勤'), 'lg', { 'data-punch': '退勤' })),
          h('p', { class: 'muted' }, '打刻種類は出勤・退勤の2種類のみ。休憩の打刻はありません ', ui.conflict(72)),
          h('div', { class: 'msg-area punch-msg' }, ctx.msg),
          h('div', { class: 'punch-status' },
            h('div', { class: 'field-label' }, '打刻状況(当日) ', ui.tbd(78)),
            todays.length
              ? h('ul', null, todays.map((p) => h('li', null, ui.badge(p.type, p.type === '出勤' ? 'ok' : 'muted'), ' ', p.at.slice(11))))
              : h('p', { class: 'muted' }, '—')))),

        // UC-305 勤務ステータスを変更する(独立した操作はない #73)
        h('div', { class: 'card emp-ref' },
          ucHead('UC-305', ui.conflict(73)),
          quote(
            'メインフロー: システムはマイページ（UC-303）の勤務ステータスを更新する',
            '備考: 勤務ステータスは以下の3つとする「出勤中」「退勤中」「休憩中」',
            '備考: 従業員自身が勤務ステータスを手動で変更することは不可能とする。'),
          ui.tbdBox(71, 'このページ上の配置は未定義',
            h('div', { class: 'status-now' }, '現在の勤務ステータス: ', h('span', { class: 'status-shown', dataset: { status: shown } }, ui.badge(shown, ui.statusTone(shown)))),
            h('ul', { class: 'status-defs' },
              h('li', null, ui.badge('出勤中', 'ok'), ' 出勤の打刻で遷移'),
              h('li', null, ui.badge('退勤中', 'muted'), ' 退勤の打刻で遷移/一度も打刻していないときの初期状態 ', ui.tbd(75)),
              h('li', null, ui.badge('休憩中', 'warn'), ' 遷移する打刻・操作がない(到達経路なし) ', ui.conflict(72))))),

        // UC-306 勤怠修正申請を送信する(開始条件の「勤怠記録一覧画面」#79)
        section('UC-306', [
          '開始条件: 従業員が勤怠記録一覧画面から勤怠修正申請ボタンを押下する',
          '関連ユースケース: マイページを表示する（UC-303）',
        ], ui.tbdBox(79, '「勤怠記録一覧画面」の起動箇所未定義',
          ui.btn('勤怠記録一覧画面', () => K.go('/employee/records')))),

        // UC-307 シフト希望を送信する
        section('UC-307', [
          '開始条件: 従業員がマイページ（UC-303）で「シフト希望提出」ボタンを押下する',
          '備考: 【TBD】 開始条件はまだ未定（どこからシフト希望提出）するか詰める必要がある。（ヘッダーメニュー？において固定で常にボタンをクリックできる感じでもいいかも？）',
          '備考: シフト提出受付期間外（締め切り後または募集開始前）の場合は、マイページ（UC-303）およびシフト希望を一覧表示する（UC-311）の画面に「シフト希望提出」ボタン自体が存在しない（非表示）状態とし、本ユースケースへアクセスできないように制御する',
        ], ui.tbdBox(83, '「シフト希望提出」ボタンの配置は未定(開始条件【TBD】)',
          h('p', { class: 'muted' }, `対象期間: ${store.fmtMonth(st.settings.wishPeriod)}(${accepting ? '受付期間内' : '受付期間外'}) `, ui.tbd(84)),
          accepting
            ? ui.btn('シフト希望提出', () => (mySubmission()
              ? ui.tbdNotice(88, '提出済みの期間で「シフト希望提出」ボタンが押されました(UC-307 メインフローでは UC-311 の「新規提出」と同じ扱い)。')
              : K.go('/employee/wish/new')), 'primary')
            : h('p', { class: 'muted' }, '受付期間外のためボタンは表示されません(UC-307 備考)'))),

        // UC-308 登録シフトを一覧表示する
        section('UC-308', [
          '備考: 起動ボタン（「登録シフト一覧（全体シフト）」ボタン）はホーム画面（旧マイページ？）または、ヘッダーメニュー等への配置を想定する',
        ], ui.tbdBox(90, '起動ボタンの配置は未決(ホーム画面/ヘッダーメニュー等)',
          ui.btn('登録シフト一覧（全体シフト）', () => K.go('/employee/shifts')))),

        // UC-309 シフト日時変更申請を送信する(ドキュメントなし)
        section('UC-309', [
          '詳細ドキュメントなし。requirements.md の概要: 勤怠管理者にシフト日時変更申請を送信する',
        ], ui.tbdBox(94, '起動箇所・画面ともに未定義',
          ui.btn('シフト日時変更申請(TBDページ)', () => K.go('/employee/shift-change')))),

        // UC-310 勤怠修正申請内容を一覧表示する
        h('div', { class: 'card emp-ref' },
          ucHead('UC-310', ui.conflict(95)),
          quote(
            '開始条件: 従業員が「勤怠修正申請一覧」を表示するボタンを押下する',
            '備考: 勤怠修正申請ボタンはマイページ（ホーム画面）またはヘッドメニューにボタンを配置すると想定する'),
          ui.tbdBox(90, '起動ボタンの配置は未決(マイページ/ヘッドメニュー)',
            ui.btn('勤怠修正申請一覧', () => K.go('/employee/fixes')))),

        // UC-311 シフト希望を一覧表示する
        section('UC-311', [
          '開始条件: 従業員が画面上の「シフト希望一覧」を表示するボタンを押下する',
          '備考: 起動ボタンはマイページ（ホーム画面）または、ヘッドメニュー等にボタンを配置することを想定する',
        ], ui.tbdBox(90, '起動ボタンの配置は未決(マイページ/ヘッドメニュー等)',
          ui.btn('シフト希望一覧', () => K.go('/employee/wishes')))));
    });
    return page;
  }

  // ───────── 勤怠記録一覧画面(UC-306 開始条件。対応 UC なし #79) ─────────
  function recordsScreen() {
    const u = store.me();
    const msg = h('div', { class: 'msg-area' });
    const days = store.daysOfMonth(store.TODAY.slice(0, 7)).filter((d) => d <= store.TODAY);
    const press = (d) => {
      msg.replaceChildren();
      if (hasPendingFix(u.id, d)) { // UC-306 Ex-2: 押下時点で検知し、同じ画面のまま表示(#80)
        msg.replaceChildren(ui.alert('error', FIX_DUP_TEXT, ' ', ui.tbd(80)));
        msg.scrollIntoView({ block: 'nearest' });
        return;
      }
      K.go(`/employee/fix/new/${d}`);
    };
    return ui.screen({ title: '勤怠記録一覧画面', uc: ['UC-306'], notes: [ui.tbd(79)] },
      h('p', { class: 'muted' }, '対応する UC がない画面です(UC-306 の開始条件が参照)。表示項目・期間が未定義のため、当月1日〜今日の勤怠記録と「勤怠修正申請ボタン」だけを表示しています。 ', ui.tbd(15)),
      msg,
      ui.table({
        cols: [
          { label: '日付', render: (d) => store.fmtDate(d), class: 'nowrap' },
          { label: '出勤', render: (d) => dash(store.recordOf(u.id, d)?.clockIn), class: 'nowrap' },
          { label: '退勤', render: (d) => dash(store.recordOf(u.id, d)?.clockOut), class: 'nowrap' },
          { label: '', render: (d) => ui.btn('勤怠修正申請', () => press(d), '', { 'data-date': d }) },
        ],
        rows: days,
      }),
      back());
  }

  // ───────── UC-306 勤怠修正申請を送信する ─────────
  function fixForm(params) {
    const u = store.me();
    const editing = params.id ? st.fixRequests.find((f) => f.id === params.id && f.userId === u.id) : null;
    if (params.id && !editing) { setTimeout(() => K.go('/employee/fixes')); return h('div'); }
    const date = editing ? editing.date : params.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { setTimeout(() => K.go('/employee/records')); return h('div'); }
    const head = { title: K.UC['UC-306'], uc: ['UC-306'], notes: editing ? [ui.badge('Alt-1 申請内容の編集')] : null };
    if (editing && editing.status !== '未処理') { // 編集できるのは「申請中」の間だけ(UC-306 備考)
      setTimeout(() => ui.tbdNotice(93, '処理状態が申請中ではない申請の編集画面が開かれました。'));
      return ui.screen(head, back());
    }

    const rec = store.recordOf(u.id, date);
    const init = editing ? editing.after : { clockIn: store.hm(rec?.clockIn), clockOut: store.hm(rec?.clockOut) };
    const inEl = ui.input({ type: 'time', value: init.clockIn ?? '', name: 'clockIn' });
    const outEl = ui.input({ type: 'time', value: init.clockOut ?? '', name: 'clockOut' });
    const reasonEl = ui.textarea({ name: 'reason', value: editing ? editing.reason : '' });
    const msg = h('div', { class: 'msg-area' });
    let done = false;

    function submit(ev) {
      ev.preventDefault();
      msg.replaceChildren();
      // メインフロー4: 入力項目に不足がないか(未入力のみ。前後関係は承認時 #59)
      const missing = [inEl, outEl, reasonEl].filter((el) => !el.value.trim());
      [inEl, outEl, reasonEl].forEach((el) => el.classList.toggle('invalid', missing.includes(el)));
      if (missing.length) { msg.replaceChildren(ui.alert('error', '入力内容に不備があります')); return; } // Ex-1: 入力保持
      const after = { clockIn: inEl.value, clockOut: outEl.value };
      if (editing) { // Alt-1: 既存の申請を上書き。ステータスは「申請中」のまま
        editing.after = after;
        editing.reason = reasonEl.value.trim();
      } else {
        if (hasPendingFix(u.id, date)) { msg.replaceChildren(ui.alert('error', FIX_DUP_TEXT, ' ', ui.tbd(80))); return; } // Ex-2
        st.fixRequests.push({ id: store.id('FX'), userId: u.id, date, before: { clockIn: rec?.clockIn ?? null, clockOut: rec?.clockOut ?? null }, after,
          reason: reasonEl.value.trim(), status: '未処理', rejectReason: '', submittedAt: store.nowStamp(), processedAt: null, processedBy: null });
      }
      done = true;
      v.draw();
    }

    const v = ui.view(() => (done
      ? h('div', { class: 'card' },
        ui.alert('success', ui.docMsg('申請の送信が完了した旨')), // メインフロー6
        h('p', null, '送信した申請は UC-310 の一覧に表示され、ステータスは「申請中」と表示されます(UC-306 メインフロー5)。 ', ui.conflict(56)),
        ui.scaffold('遷移先(仕様外)', ui.scaffoldLink('UC-310 の一覧へ', '/employee/fixes'), ' ', ui.scaffoldLink('勤怠記録一覧画面へ', '/employee/records')))
      : h('form', { class: 'card form', onsubmit: submit },
        ui.kv([
          [h('span', null, '対象日', editing ? ui.tbd(82) : null), store.fmtDate(date)],
          ['現在の勤怠記録', `出勤 ${dash(rec?.clockIn)} / 退勤 ${dash(rec?.clockOut)}`],
        ]),
        h('div', { class: 'field-label' }, '修正後の打刻日時 ', ui.tbd(58)),
        h('div', { class: 'time-row' },
          ui.field('修正後の出勤時刻', inEl, { required: true }),
          ui.field('修正後の退勤時刻', outEl, { required: true })),
        ui.field('申請理由', reasonEl, { required: true }),
        msg,
        h('div', { class: 'form-actions' }, h('button', { type: 'submit', class: 'btn btn-primary' }, '送信')),
        h('p', { class: 'muted' }, '送信した申請は、勤怠管理者が承認するまで打刻情報には反映されません(UC-306 備考)。 ', ui.tbd(15)))));

    return ui.screen(head, v, back());
  }

  // ───────── UC-310 勤怠修正申請内容を一覧表示する ─────────
  function fixesScreen() {
    const u = store.me();
    const head = { title: K.UC['UC-310'], uc: ['UC-310'] };
    if (store.takeFault('UC-310-Ex2')) { // Ex-2: 取得失敗 → 再読み込み待ち
      return ui.screen(head, ui.alert('error', '申請情報の取得に失敗しました。画面を読み込み直してください'), reloadBtn(), back());
    }
    const mine = st.fixRequests.filter((f) => f.userId === u.id).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    let sel = null;

    const detail = (f) => h('div', { class: 'card fix-detail' },
      h('h3', null, '申請の詳細'),
      ui.kv([
        ['対象日', store.fmtDate(f.date)],
        ['修正内容', h('div', null,
          h('div', null, '出勤 ', ui.diff(f.before.clockIn, f.after.clockIn)),
          h('div', null, '退勤 ', ui.diff(f.before.clockOut, f.after.clockOut)))],
        ['申請理由', f.reason],
        [h('span', null, '管理者からのコメント', ui.tbd(92), ui.conflict(10)), dash(f.rejectReason)],
        ['申請日時', store.fmtStamp(f.submittedAt)],
        ['ステータス', fixStatus(f.status)],
      ]),
      f.status === '未処理'
        ? h('div', { class: 'form-actions' }, ui.btn('編集', () => K.go(`/employee/fix/${f.id}/edit`), 'primary'), ui.tbd(93))
        : null,
      ui.tbdPlaceholder(81, '送信内容の削除は【TBD】(UC-306 備考)'));

    const v = ui.view(() => (mine.length
      ? h('div', null,
        ui.table({
          cols: [
            { label: '申請日', render: (f) => store.fmtDate(f.submittedAt.slice(0, 10)), class: 'nowrap' },
            { label: h('span', null, '対象日', ui.tbd(101)), render: (f) => store.fmtDate(f.date), class: 'nowrap' },
            { label: 'ステータス', render: (f) => fixStatus(f.status) },
          ],
          rows: mine,
          onRowClick: (f) => { sel = f.id; v.draw(); },
          rowClass: (f) => (f.id === sel ? 'selected' : ''),
        }),
        sel ? detail(mine.find((f) => f.id === sel)) : null)
      : ui.alert('info', '現在提出済みの勤怠修正申請はありません'))); // Ex-1

    return ui.screen(head,
      h('p', { class: 'muted' }, '自分が提出した申請だけを表示します(UC-310 備考)。'),
      v, back());
  }

  // ───────── UC-307 シフト希望を送信する ─────────
  const KINDS = [{ value: '', label: '未選択' }, { value: '出勤可能', label: '出勤可能' }, { value: '休日希望', label: '休日希望' }, { value: '時間指定', label: '時間指定' }];
  const norm = (r) => ({ kind: r.kind, start: r.kind === '時間指定' ? r.start : '', end: r.kind === '時間指定' ? r.end : '' });
  const sameWish = (a, b) => a.kind === b.kind && a.start === b.start && a.end === b.end;

  const wishForm = (mode) => () => {
    const u = store.me();
    const period = st.settings.wishPeriod;
    if (!st.settings.wishAccepting) { setTimeout(() => K.go('/employee/wishes')); return h('div'); } // 受付期間外はアクセス不可(UC-307 備考)
    const head = { title: K.UC['UC-307'], uc: ['UC-307'], notes: mode === 'edit' ? [ui.badge('Alt-1 編集'), ui.conflict(87)] : null };
    const sub = mySubmission();
    if (mode === 'new' && sub) {
      setTimeout(() => ui.tbdNotice(88, '提出済みの期間で新規提出の画面が開かれました。'));
      return ui.screen(head, back());
    }
    if (mode === 'edit' && !sub) {
      setTimeout(() => ui.tbdNotice(88, '未提出の期間で編集の画面が開かれました。'));
      return ui.screen(head, back());
    }

    // メインフロー2 / Alt-1: 日付・曜日が縦に並んだテーブル(編集時は提出済みの内容をセット)
    const model = store.daysOfMonth(period).map((d) => {
      const ex = sub?.days.find((x) => x.date === d);
      return { date: d, kind: ex?.kind ?? '', start: ex?.start ?? '', end: ex?.end ?? '', status: ex?.status ?? '未処理' };
    });
    const topMsg = h('div', { class: 'msg-area' });
    const bottomMsg = h('div', { class: 'msg-area' });
    const rowEls = new Map();
    let done = false;

    function row(m) {
      const s = ui.input({ type: 'time', value: m.start, disabled: m.kind !== '時間指定', 'aria-label': `${m.date} 開始`, oninput: (ev) => { m.start = ev.target.value; } });
      const e = ui.input({ type: 'time', value: m.end, disabled: m.kind !== '時間指定', 'aria-label': `${m.date} 終了`, oninput: (ev) => { m.end = ev.target.value; } });
      const sel = ui.select(KINDS, { value: m.kind, 'aria-label': `${m.date} 希望条件`,
        onchange: (ev) => { m.kind = ev.target.value; s.disabled = e.disabled = m.kind !== '時間指定'; } });
      const tr = h('tr', { dataset: { date: m.date } },
        h('td', { class: 'nowrap' }, store.fmtDate(m.date),
          m.status !== '未処理' ? h('div', null, ui.badge(m.status, ui.statusTone(m.status))) : null),
        h('td', null, sel, h('div', { class: 'wish-times' }, s, '〜', e)));
      rowEls.set(m.date, { tr, s, e });
      return tr;
    }

    function submit(ev) {
      ev.preventDefault();
      topMsg.replaceChildren();
      bottomMsg.replaceChildren();
      // メインフロー4: 不備の確認(時間指定の行のみ #85)
      let bad = 0;
      for (const m of model) {
        const r = rowEls.get(m.date);
        const ng = m.kind === '時間指定' && (!m.start || !m.end || m.start >= m.end);
        r.tr.classList.toggle('invalid', ng);
        r.s.classList.toggle('invalid', ng && (!m.start || m.start >= m.end));
        r.e.classList.toggle('invalid', ng && (!m.end || m.start >= m.end));
        if (ng) bad++;
      }
      if (bad) { // Ex-1: 入力内容を保持したまま再操作待ち
        topMsg.replaceChildren(ui.alert('error', '入力内容に不備があります'));
        bottomMsg.replaceChildren(ui.alert('error', '入力内容に不備があります'));
        return;
      }
      const now = store.nowStamp();
      if (sub) { // Alt-1: 既存のシフト希望に上書き。処理済みの日の内容が変わる場合は未定義(#87)
        const changed = sub.days.filter((x) => x.status !== '未処理' && !sameWish(x, norm(model.find((m) => m.date === x.date))));
        if (changed.length) {
          ui.tbdNotice(87, `処理済み(承認済/却下)の日の内容が変更されています: ${changed.map((x) => `${store.fmtDate(x.date)}(${x.status})`).join('、')}`);
          return;
        }
        for (const x of sub.days) Object.assign(x, norm(model.find((m) => m.date === x.date)));
        sub.updatedAt = now;
      } else {
        st.wishSubmissions.push({ id: store.id('WS'), userId: u.id, period, submittedAt: now, updatedAt: now,
          days: model.map((m) => ({ date: m.date, ...norm(m), status: '未処理', rejectReason: '', processedAt: null })) });
      }
      done = true;
      v.draw();
    }

    const v = ui.view(() => (done
      ? h('div', { class: 'card' },
        ui.alert('success', ui.docMsg('シフト希望の送信完了した旨')), // メインフロー6
        h('p', null, 'UC-311 の画面で、現在受付中の対象月のシフト希望として一覧表示されます(UC-307 メインフロー5)。'),
        ui.scaffold('遷移先(仕様外)', ui.scaffoldLink('UC-311 の一覧へ', '/employee/wishes')))
      : h('form', { class: 'card form', onsubmit: submit },
        h('p', null, `対象期間: ${store.fmtMonth(period)} `, ui.tbd(84)),
        topMsg,
        h('div', { class: 'table-wrap' }, h('table', { class: 'table wish-table' },
          h('thead', null, h('tr', null, h('th', null, '日付'), h('th', null, '希望条件 ', ui.tbd(85)))),
          h('tbody', null, model.map(row)))),
        bottomMsg,
        h('div', { class: 'form-actions' }, h('button', { type: 'submit', class: 'btn btn-primary' }, '送信')))));

    return ui.screen(head, v, back());
  };

  // ───────── UC-311 シフト希望を一覧表示する ─────────
  function wishesScreen() {
    const head = { title: K.UC['UC-311'], uc: ['UC-311'] };
    const accepting = st.settings.wishAccepting;
    const period = st.settings.wishPeriod;
    if (store.takeFault('UC-311-Ex2')) { // Ex-2: 取得失敗 → シフト希望の表示は非表示のまま
      return ui.screen(head, ui.alert('error', 'シフト希望情報の取得に失敗しました。画面を読み込み直してください'), reloadBtn(), back());
    }
    const sub = mySubmission();
    const rows = sub ? sub.days.filter((d) => d.kind) : [];
    // 受付期間内のみ「新規提出」「編集」(UC-307 開始条件・備考)
    const buttons = accepting
      ? h('div', { class: 'form-actions' },
        ui.btn('新規提出', () => (sub ? ui.tbdNotice(88, '提出済みの期間で「新規提出」が押されました。') : K.go('/employee/wish/new')), 'primary'),
        h('span', { class: 'nowrap' }, ui.btn('編集', () => (sub ? K.go('/employee/wish/edit') : ui.tbdNotice(88, '未提出の期間で「編集」が押されました。'))), ui.conflict(87)),
        ui.conflict(104))
      : h('p', { class: 'muted' }, '受付期間外のため「新規提出」「編集」は表示されません(UC-307 備考) ', ui.conflict(104));

    return ui.screen(head,
      h('div', { class: 'card' },
        h('p', null, `対象月: ${store.fmtMonth(period)}(${accepting ? '受付期間内' : '受付期間外'}) `, ui.tbd(84), accepting ? null : ui.tbd(102)),
        ui.tbdPlaceholder(89, '過去のシフト希望の表示(月の切替)は【TBD】'),
        h('p', { class: 'muted' }, '自分が提出したシフト希望だけを表示します(UC-311 備考)。'),
        buttons),
      sub
        ? h('div', null,
          ui.kv([['提出日時', store.fmtStamp(sub.submittedAt)], sub.updatedAt !== sub.submittedAt ? ['更新日時', store.fmtStamp(sub.updatedAt)] : null]),
          ui.table({
            cols: [
              { label: '日付', render: (d) => store.fmtDate(d.date), class: 'nowrap' },
              { label: h('span', null, '出勤希望日・不可日時(UC-311)/希望条件(UC-307)', ui.conflict(86)),
                render: (d) => (d.kind === '時間指定' ? `時間指定 ${d.start}〜${d.end}` : d.kind) },
              { label: h('span', null, '処理状態・却下理由', ui.conflict(55)),
                render: (d) => h('div', null, ui.badge(d.status, ui.statusTone(d.status)), d.rejectReason ? h('div', { class: 'muted' }, d.rejectReason) : null) },
            ],
            rows,
          }))
        : ui.alert('info', '現在提出済みのシフト希望はありません'), // Ex-1
      back());
  }

  // ───────── UC-308 登録シフトを一覧表示する ─────────
  function shiftsScreen() {
    const u = store.me();
    const head = { title: K.UC['UC-308'], uc: ['UC-308'], notes: [ui.tbd(91)] };
    if (!u.storeId) {
      return ui.screen(head, ui.tbdPlaceholder(103, '所属店舗が未設定のため、表示する「全従業員」の範囲が決まりません'), back());
    }
    const ctx = { month: store.TODAY.slice(0, 7), msg: null, loaded: false };
    const storeShifts = (ym) => st.shifts.filter((s) => s.date.startsWith(ym) && store.user(s.userId)?.storeId === u.storeId);

    function load(ym) {
      if (store.takeFault('UC-308-Ex2')) { // Ex-2: 取得失敗 → 一覧は未更新のまま再読み込み待ち
        ctx.msg = h('div', null, ui.alert('error', 'シフト情報の取得に失敗しました。画面を読み込み直してください'), reloadBtn());
        return;
      }
      if (!storeShifts(ym).length) { // Ex-1: 未確定・未公開 → 画面を遷移せず元の表示を維持
        ctx.msg = ui.alert('info', '該当月の確定シフトはまだ公開されていません', ' ', ui.conflict(44));
        return;
      }
      ctx.month = ym;
      ctx.msg = null;
      ctx.loaded = true;
    }
    load(ctx.month); // メインフロー2: 初期表示は現在月

    const v = ui.view(() => {
      const list = storeShifts(ctx.month);
      return h('div', null,
        h('div', { class: 'month-nav' },
          ui.btn('前月', () => { load(store.addMonths(ctx.month, -1)); v.draw(); }, '', { 'data-month': 'prev' }),
          h('strong', { class: 'month-label' }, store.fmtMonth(ctx.month)),
          ui.btn('翌月', () => { load(store.addMonths(ctx.month, 1)); v.draw(); }, '', { 'data-month': 'next' })),
        h('div', { class: 'msg-area' }, ctx.msg),
        ctx.loaded
          ? ui.table({
            cols: [
              { label: '日付', render: (d) => store.fmtDate(d), class: 'nowrap' },
              { label: '確定シフト', render: (d) => {
                const day = list.filter((s) => s.date === d).sort((a, b) => a.start.localeCompare(b.start));
                return day.length
                  ? day.map((s) => h('div', { class: ['shift-line', s.userId === u.id && 'mine'] }, `${store.user(s.userId)?.name ?? s.userId} ${s.start}〜${s.end}`))
                  : h('span', { class: 'muted' }, '—');
              } },
            ],
            rows: store.daysOfMonth(ctx.month),
          })
          : null);
    });

    return ui.screen(head,
      h('div', { class: 'card' },
        h('p', null, `店舗: ${store.storeName(u.storeId)}(所属店舗の全従業員)`),
        quote('備考: 確定、公開済みシフトのみを閲覧可能とし、管理者が作成中の未公開シフトは表示しない'),
        h('p', { class: 'muted' }, 'シフトを確定・公開する UC がないため、登録済みのシフトをそのまま表示しています ', ui.conflict(44), ui.conflict(10))),
      v, back());
  }

  // ───────── UC-309 シフト日時変更申請を送信する(ドキュメントなし #94) ─────────
  function shiftChangeScreen() {
    const u = store.me();
    const head = { title: K.UC['UC-309'], uc: ['UC-309'], notes: [ui.tbd(94)] };
    const mine = st.shifts.filter((s) => s.userId === u.id && s.date >= store.TODAY).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
    const msg = h('div', { class: 'msg-area' });

    const shiftSel = ui.select([{ value: '', label: '選択してください' }, ...mine.map((s) => ({ value: s.id, label: `${store.fmtDate(s.date)} ${s.start}〜${s.end}` }))], { name: 'shiftId' });
    const dateEl = ui.input({ type: 'date', name: 'date' });
    const startEl = ui.input({ type: 'time', name: 'start' });
    const endEl = ui.input({ type: 'time', name: 'end' });
    const reasonEl = ui.textarea({ name: 'reason' });

    function submit(ev) {
      ev.preventDefault();
      msg.replaceChildren();
      const els = [shiftSel, dateEl, startEl, endEl, reasonEl];
      if (els.some((el) => !el.value.trim())) { ui.tbdNotice(94, '未入力の項目がある状態で送信されました(入力チェック・メッセージは未定義)。'); return; }
      const s = st.shifts.find((x) => x.id === shiftSel.value);
      st.changeRequests.push({ id: store.id('CR'), userId: u.id, shiftId: s.id, before: { date: s.date, start: s.start, end: s.end },
        after: { date: dateEl.value, start: startEl.value, end: endEl.value }, reason: reasonEl.value.trim(),
        status: '未処理', rejectReason: '', submittedAt: store.nowStamp(), processedAt: null, processedBy: null });
      els.forEach((el) => { el.value = ''; });
      msg.replaceChildren(ui.alert('info', ui.tbd(94), ' 送信後の表示は未定義です。勤怠管理者の UC-214 の一覧に追加しました(モック)。'));
    }

    return ui.screen(head,
      h('div', { class: 'card' },
        h('p', null, '詳細ドキュメントがありません。requirements.md 5.4 の記述:'),
        quote('UC-309 シフト日時変更申請を送信する / アクター: 従業員 / 概要: 勤怠管理者にシフト日時変更申請を送信する'),
        h('p', { class: 'muted' }, '送信した申請の状況や却下理由を従業員が見る画面はありません ', ui.conflict(70), ' 取り下げ操作もありません ', ui.conflict(51))),
      ui.tbdBox(94, '他UC(UC-214〜216)の記述から導いた入力項目',
        mine.length
          ? h('form', { class: 'form', onsubmit: submit },
            ui.field(h('span', null, '変更前のシフト', ui.tbd(69)), shiftSel),
            h('div', { class: 'field-label' }, '変更希望の日時'),
            ui.field('勤務日', dateEl),
            h('div', { class: 'time-row' }, ui.field('開始', startEl), ui.field('終了', endEl)),
            ui.field('申請理由', reasonEl),
            msg,
            h('div', { class: 'form-actions' }, h('button', { type: 'submit', class: 'btn btn-primary' }, '送信')),
            h('p', { class: 'muted' }, '何日前までの変更申請を認めるかは TBD ', ui.tbd(14)))
          : ui.tbdPlaceholder(94, '変更前として選べる今日以降の登録シフトがありません')),
      back());
  }

  // ───────── ルート ─────────
  K.route('/employee', { role: ROLE, title: 'マイページ(TBD)', render: myPage });
  K.route('/employee/records', { role: ROLE, title: '勤怠記録一覧画面', render: recordsScreen });
  K.route('/employee/fix/new/:date', { role: ROLE, title: K.UC['UC-306'], render: fixForm });
  K.route('/employee/fix/:id/edit', { role: ROLE, title: K.UC['UC-306'], render: fixForm });
  K.route('/employee/fixes', { role: ROLE, title: K.UC['UC-310'], render: fixesScreen });
  K.route('/employee/wish/new', { role: ROLE, title: K.UC['UC-307'], render: wishForm('new') });
  K.route('/employee/wish/edit', { role: ROLE, title: K.UC['UC-307'], render: wishForm('edit') });
  K.route('/employee/wishes', { role: ROLE, title: K.UC['UC-311'], render: wishesScreen });
  K.route('/employee/shifts', { role: ROLE, title: K.UC['UC-308'], render: shiftsScreen });
  K.route('/employee/shift-change', { role: ROLE, title: K.UC['UC-309'], render: shiftChangeScreen });

  // スマホ画面にサイドバーはないが、画面一覧として登録しておく
  K.nav[ROLE].push(
    { path: '/employee', uc: ['UC-303', 'UC-304', 'UC-305'], label: 'マイページ(TBD)' },
    { path: '/employee/records', uc: ['UC-306'], label: '勤怠記録一覧画面(TBD)' },
    { path: '/employee/fixes', uc: ['UC-310'], label: K.UC['UC-310'] },
    { path: '/employee/wishes', uc: ['UC-311', 'UC-307'], label: K.UC['UC-311'] },
    { path: '/employee/shifts', uc: ['UC-308'], label: K.UC['UC-308'] },
    { path: '/employee/shift-change', uc: ['UC-309'], label: `${K.UC['UC-309']}(TBD)` },
  );
})();
