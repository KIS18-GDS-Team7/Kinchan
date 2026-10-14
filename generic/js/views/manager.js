/*
 * 勤怠管理者画面(UC-203〜216)。PC 幅・サイドメニュー付き。
 * 担当店舗は自身の所属店舗(判断ログ #2)。状態の変更は必ず K.S を通す。
 * 登録・承認・却下などは 1 つのモーダル内で doc の段階(入力 → 内容の提示 → 実行)をたどる。
 */
window.K = window.K || {};
K.views = K.views || {};

(function () {
  var S = K.S, ui = K.ui, T = K.T, fmt = K.fmt, app = K.app, esc = ui.esc;
  var ROLE = '勤怠管理者';

  // ================= 共通 =================
  function storeId() { var u = S.me(); return u ? u.storeId : null; }
  function noStore(head) { return ui.pageHead(head) + ui.empty('所属店舗が未設定のため担当店舗がありません'); }
  function isEmp(sid, userId) { return !!userId && S.storeEmployees(sid).some(function (u) { return u.id === userId; }); }
  function inStore(sid, userId) { var u = S.user(userId); return !!u && u.storeId === sid; }
  function hm(t) { return t ? t.slice(0, 5).replace(/^0/, '') : ''; }
  function shiftText(s) { return fmt.date(s.date) + ' ' + fmt.range(s.start, s.end); }
  function trunc(s, n) { s = s || ''; return s.length > n ? s.slice(0, n) + '…' : s; }
  function ul(items) { return '<ul>' + items.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>'; }
  function errorsText(errors) { return Object.keys(errors || {}).map(function (k) { return errors[k]; }).join(' / '); }
  function pre(s) { return '<span style="white-space:pre-wrap">' + esc(s) + '</span>'; }
  function empOptions(sid, selected, first) {
    var list = S.storeEmployees(sid).map(function (u) { return { value: u.id, label: u.name }; });
    return ui.options([{ value: '', label: first }].concat(list), selected || '');
  }
  // rows: [[ラベルHTML, 値HTML], ...](null は飛ばす)
  function kv(rows) {
    return '<dl class="kv">' + rows.filter(Boolean).map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>'; }).join('') + '</dl>';
  }
  function card(title, side, body) {
    return '<div class="card"><div class="card-head"><div class="card-title">' + title + '</div>' + (side || '') + '</div>' +
      '<div class="card-body">' + body + '</div></div>';
  }
  function placeholder(msg) { return '<div class="card"><div class="card-body muted">' + esc(msg) + '</div></div>'; }
  function h3(html) { return '<h3 class="section-title" style="margin-top:14px">' + html + '</h3>'; }
  // ラベルに補完バッジを含む項目(label 要素だとバッジが入力欄より先にラベル付けされるため div)
  function fieldDiv(label, inputHtml, name, hint) {
    return '<div class="field"><span class="field-label">' + label + '</span>' + inputHtml +
      (hint ? '<span class="field-hint">' + hint + '</span>' : '') +
      '<span class="field-error" data-err="' + esc(name) + '" hidden></span></div>';
  }
  function checkLabel(name, checked, label) {
    return '<label style="display:inline-flex;gap:6px;align-items:center;min-height:36px;cursor:pointer">' +
      '<input type="checkbox" name="' + name + '"' + (checked ? ' checked' : '') + '> ' + esc(label) + '</label>';
  }
  function periodInputs(from, to) {
    return '<span class="row" style="flex-wrap:nowrap">' +
      '<input type="date" name="from" value="' + esc(from || '') + '" style="width:auto"> 〜 ' +
      '<input type="date" name="to" value="' + esc(to || '') + '" style="width:auto"></span>';
  }
  // 本人の申請・勤怠(#55: 処理は可能)
  function selfNote(userId, what) {
    return userId === S.me().id ? ui.alert('warn', esc('本人の' + what + 'です(処理は可能)') + ' ' + ui.hokan(55)) : '';
  }
  function availText(u, date) {
    if (!u || !u.availability) return '未設定(範囲チェックなし) ' + ui.hokan(26);
    return esc(S.availabilityText(u, date));
  }
  function shiftsText(list) {
    return list.length ? list.map(function (s) { return esc(fmt.range(s.start, s.end)); }).join('、') : '<span class="muted">なし</span>';
  }
  function diffRow(label, b, a) {
    return '<tr><th>' + label + '</th><td>' + esc(b) + '</td><td' + (a !== b ? ' class="changed"' : '') + '>' + esc(a) + '</td></tr>';
  }
  function shiftDiff(b, a, heads, u) {
    return '<table class="table table-sm diff"><thead><tr><th></th><th>' + heads[0] + '</th><th>' + heads[1] + '</th></tr></thead><tbody>' +
      diffRow('勤務日', fmt.dateFull(b.date), fmt.dateFull(a.date)) +
      diffRow('開始時刻', b.start, a.start) + diffRow('終了時刻', b.end, a.end) +
      (u ? diffRow('予定休憩', S.plannedBreak(u, b.start, b.end) + ' 分', S.plannedBreak(u, a.start, a.end) + ' 分') : '') +
      '</tbody></table>';
  }
  var REC_FIELDS = [['clockIn', '出勤時刻', '出勤'], ['clockOut', '退勤時刻', '退勤'], ['breakMinutes', '休憩時間', '休憩']];
  function recVal(k, x) {
    if (k === 'breakMinutes') return x === null || x === undefined || x === '' ? '—' : x + '分';
    return x ? fmt.time(x) : '—';
  }
  function recDiff(b, a, heads, extra) {
    return '<table class="table table-sm diff"><thead><tr><th></th><th>' + heads[0] + '</th><th>' + heads[1] + '</th></tr></thead><tbody>' +
      REC_FIELDS.map(function (f) { return diffRow(f[1], recVal(f[0], b[f[0]]), recVal(f[0], a[f[0]])); }).join('') +
      (extra || []).map(function (x) { return diffRow(x[0], x[1], x[2]); }).join('') + '</tbody></table>';
  }
  function recText(x) {
    if (!x) return '—';
    return REC_FIELDS.map(function (f) { return f[2] + ' ' + recVal(f[0], x[f[0]]); }).join(' / ');
  }
  // 日単位の人員の状況(#8)。o.userId の行を強調、o.note は人数の横に添える
  function staffingBlock(sid, date, o) {
    o = o || {};
    var st = S.staffing(sid, date);
    return '<div class="row" style="margin-bottom:6px"><strong>' + esc(fmt.dateFull(date)) + '</strong>' +
      ui.badge(st.count + ' 名 / 必要 ' + st.required + ' 名', st.short ? 'ng' : 'ok') +
      (st.short ? ui.badge('人員不足', 'ng') : '') + (o.note || '') + '</div>' +
      (st.shifts.length ? '<table class="table table-sm"><tbody>' + st.shifts.map(function (s) {
        var mine = s.userId === o.userId;
        return '<tr' + (mine ? ' class="selected"' : '') + '><td>' + esc(S.userName(s.userId)) +
          (mine ? ' <span class="muted small">(申請者)</span>' : '') + '</td><td class="nowrap">' + esc(fmt.range(s.start, s.end)) + '</td></tr>';
      }).join('') + '</tbody></table>' : '<p class="muted small">登録済みのシフトはありません</p>');
  }
  // モーダル内の段階(doc のメインフローの段階)
  function steps(list, cur) {
    return '<p class="muted small" style="margin:0 0 10px">' + list.map(function (l, i) {
      return i === cur ? '<strong style="color:var(--text)">' + esc(l) + '</strong>' : esc(l);
    }).join(' › ') + '<span style="margin-left:8px">(キャンセルすると操作前の画面に戻る ' + ui.hokan(10) + ')</span></p>';
  }

  /*
   * 段階遷移するモーダル。o: { title, ucs, wide, cancel }
   * m.step(body, actions) で段階を進める(onClick は false を返して閉じないようにする)。
   * m.end() 後に閉じると画面を再描画。end 前に閉じると「〇〇をキャンセルしました」(各 UC の Ex-1、#10)
   */
  function flow(o) {
    var st = { done: false, quiet: false, cancel: o.cancel };
    var m = ui.modal({ title: o.title, wide: o.wide, actions: [], onClose: function () {
      if (st.quiet) return;
      if (st.done) app.refresh();
      else if (st.cancel) ui.toast(st.cancel + 'をキャンセルしました', 'info');
    } });
    m.end = function () { st.done = true; };
    m.setCancel = function (label) { st.cancel = label; };
    m.step = function (body, actions) {
      m.setError(null);
      m.setBody((o.ucs ? '<div class="uc-chips" style="margin:0 0 8px">' + ui.ucs(o.ucs) + '</div>' : '') + body);
      m.setActions(actions);
      var first = m.body.querySelector('input:not([type="checkbox"]), select, textarea');
      if (first) first.focus();
    };
    // モーダル内のリンクで別画面へ移るときは何も出さずに閉じる
    m.el.addEventListener('click', function (e) {
      if (e.target.closest('a[href^="#/"]')) { st.quiet = true; m.close(); }
    });
    return m;
  }
  // 代替フローで一覧(待機状態)に戻る: 理由を提示し、閉じたら再描画
  function terminal(m, html, flowId, label) {
    m.end();
    m.setError(html + (flowId ? ui.flowNote(flowId) : ''));
    m.setActions([{ label: label || '一覧に戻る', kind: 'secondary' }]);
  }

  /*
   * 却下(UC-208/211/216): 却下理由の入力 → 却下の指示 → 実行。
   * o: { uc, title, cancel, userId, summary: 'HTML', reject: function (reason) { return r; } }
   */
  function rejectFlow(o) {
    var reason = '';
    var labels = ['却下理由の入力', '却下の指示'];
    var m = flow({ title: o.title, ucs: [o.uc], cancel: o.cancel });
    function alt1() {
      ui.showErrors(m.body.querySelector('[data-reject]'), { reason: '却下理由を入力してください' });
      m.setError(esc('却下理由の入力が必要です') + ui.flowNote(o.uc + ' Alt-1'));
    }
    function input() {
      m.step(steps(labels, 0) + selfNote(o.userId, '申請') + o.summary +
        '<form class="form" data-reject style="margin-top:12px">' +
        fieldDiv('定型文 ' + ui.hokan(46), '<select data-template>' +
          ui.options([{ value: '', label: '定型文を選んで挿入' }].concat(S.REJECT_TEMPLATES), '') + '</select>', 'template') +
        ui.field('却下理由(必須)', '<textarea name="reason" rows="3">' + esc(reason) + '</textarea>', 'reason', '従業員に通知される') +
        '</form>',
        [{ label: 'キャンセル' }, { label: '次へ', kind: 'primary', onClick: next }]);
      var f = m.body.querySelector('[data-reject]');
      var ta = f.querySelector('[name="reason"]');
      f.querySelector('[data-template]').addEventListener('change', function (e) {
        var t = e.target.value;
        if (t) ta.value = ta.value.trim() ? ta.value.trim() + '\n' + t : t;
        e.target.value = '';
        ta.focus();
      });
      ta.focus();
    }
    function next() {
      reason = m.body.querySelector('[name="reason"]').value;
      if (!reason.trim()) { alt1(); return false; }
      m.step(steps(labels, 1) + o.summary + kv([['却下理由', pre(reason.trim())]]) +
        '<p class="muted small">却下すると従業員に却下結果と却下理由が通知される ' + ui.hokan(3) + '</p>',
        [{ label: 'キャンセル' }, { label: '戻る', onClick: function () { input(); return false; } }, { label: '却下する', kind: 'danger', onClick: run }]);
      return false;
    }
    function run() {
      var r = o.reject(reason);
      if (r.ok) { m.end(); ui.toast('却下しました', 'ok', '従業員に却下結果と却下理由を通知しました'); return; }
      if (r.code === 'reason') { input(); alt1(); return false; }
      if (r.code === 'state') { terminal(m, esc(r.message), o.uc + ' Alt-2'); return false; }
      m.setError(esc(r.message));
      return false;
    }
    input();
  }

  // ---- 申請一覧の条件(Alt-2)と行の選択 ----
  var STATUS_HOPE = [{ value: '申請中', label: '未処理(申請中)' }, '承認済', '却下', { value: 'all', label: 'すべて' }];
  var STATUS_REQ = [{ value: '申請中', label: '未処理(申請中)' }, '承認済', '却下', '取下げ', { value: 'all', label: 'すべて' }];
  function filterBar(sid, params, o) {
    return '<form class="toolbar" data-filter>' +
      ui.field(o.period, periodInputs(params.from, params.to), 'from') +
      ui.field('従業員', '<select name="userId">' + empOptions(sid, params.userId, 'すべて') + '</select>', 'userId') +
      fieldDiv('処理状態 ' + ui.hokan(5), '<select name="status">' + ui.options(o.statuses, params.status || '申請中') + '</select>', 'status') +
      (o.extra || '') +
      '<button type="submit" class="btn btn-secondary">絞り込む</button>' +
      '<a class="btn btn-ghost" href="' + app.href(o.path) + '">条件をクリア</a></form>' +
      (params.from && params.to && params.from > params.to ? ui.alert('warn', '期間の開始日が終了日より後になっています ' + ui.hokan(86)) : '');
  }
  function bindFilter(el, path) {
    var f = el.querySelector('[data-filter]');
    if (!f) return;
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = ui.values(f);
      Object.keys(v).forEach(function (k) { if (typeof v[k] === 'boolean') v[k] = v[k] ? '1' : ''; });
      app.go(path, v);
    });
  }
  // 行の選択はスクロール位置を保つため履歴を置き換えて再描画
  function select(path, params) {
    try { history.replaceState(null, '', app.href(path, params)); app.refresh(); }
    catch (e) { app.go(path, params); }
  }
  function bindRows(el, path, params, key) {
    ui.on(el, 'click', 'tr[data-sel]', function (e, tr) {
      if (e.target.closest('input, a, button')) return;
      var p = Object.assign({}, params);
      p[key] = tr.dataset.sel;
      select(path, p);
    });
  }
  function emptyList(filter, alt1, other, flowId) {
    var isAlt1 = filter.status === '申請中' && !filter.userId && !filter.from && !filter.to;
    return isAlt1 ? ui.empty(alt1) + '<p class="center small">' + ui.flowNote(flowId) + '</p>' : ui.empty(other);
  }
  function listCount(n) { return '<div class="toolbar" style="align-items:center"><span class="muted small">' + n + ' 件</span></div>'; }
  function decideButtons(act, id) {
    return '<div class="row" style="justify-content:flex-end;margin-top:14px">' +
      '<button type="button" class="btn btn-secondary" data-act="reject-' + act + '" data-id="' + esc(id) + '">却下する</button>' +
      '<button type="button" class="btn btn-ok" data-act="approve-' + act + '" data-id="' + esc(id) + '">承認する</button></div>';
  }
  function processedRows(x) {
    return [
      x.processedAt && x.processedBy ? ['処理日時', esc(fmt.dtFull(x.processedAt)) + ' ' + esc(S.userName(x.processedBy))] : null,
      x.status === '取下げ' ? ['取下げ', esc(fmt.dtFull(x.processedAt)) + ' 従業員が取り下げた ' + ui.hokan(6)] : null,
      x.rejectReason ? ['却下理由', pre(x.rejectReason)] : null,
    ];
  }

  // ================= ホーム(#12) =================
  K.views['mgr/home'] = {
    role: ROLE, title: 'ホーム', nav: 'home',
    render: function () {
      var head = { title: 'ホーム', hokan: [12], lead: '勤怠管理者のホーム(docs に定義なし)' };
      var sid = storeId();
      if (!sid) return noStore(head);
      var today = T.today(), ym = T.thisMonth();
      var c = S.managerPending(sid);
      var emps = S.storeEmployees(sid);
      function kpi(label, n, path) {
        return '<a class="kpi" href="#/' + path + '"><div class="kpi-label">' + label + '</div>' +
          '<div class="kpi-value">' + n + '<small>件</small></div></a>';
      }
      var ot = emps.map(function (u) { var m = S.monthOvertime(u.id, ym); return { user: u, minutes: m, alert: S.otAlert(m) }; })
        .filter(function (x) { return x.alert; });
      var shorts = T.range(today, T.addDays(today, 13)).map(function (d) { return S.staffing(sid, d); })
        .filter(function (x) { return x.short; });

      var otHtml = ot.length
        ? ui.alert(ot.some(function (x) { return x.alert === '超過'; }) ? 'ng' : 'warn',
          '<strong>36 協定の警告</strong>(' + fmt.month(ym) + 'の残業時間、上限 月 ' + fmt.dur(S.OT_LIMIT) + ') ' + ui.hokan(57) +
          '<ul>' + ot.map(function (x) {
            return '<li>' + esc(x.user.name) + ' 当月残業 ' + fmt.dur(x.minutes) + ' ' + ui.status(x.alert) + '</li>';
          }).join('') + '</ul><a href="#/mgr/work">勤務実態一覧で表示</a>')
        : '<p class="muted small">36 協定の上限(月 45 時間)を超えている、または超えそうな従業員はいません ' + ui.hokan(57) + '</p>';

      var todayRows = emps.map(function (u) {
        var r = S.dayRecord(u.id, today);
        var status = S.currentStatus(u.id);
        return '<tr' + (!r.shifts.length && !r.hasRecord ? ' class="muted-row"' : '') + '><td>' + esc(u.name) + '</td>' +
          '<td class="nowrap">' + shiftsText(r.shifts) + '</td><td>' + ui.status(status) + '</td>' +
          '<td class="num" title="' + esc(r.clockIn || '') + '">' + esc(fmt.time(r.clockIn)) + '</td>' +
          '<td>' + (r.flags.length ? r.flags.map(ui.status).join(' ') : '') + '</td></tr>';
      }).join('');

      return ui.pageHead(head) +
        '<section><h2 class="section-title">未処理の申請 ' + ui.hokan(4) + '</h2><div class="kpis">' +
        kpi('シフト希望', c.hopes, 'mgr/hopes') + kpi('勤怠修正申請', c.corrections, 'mgr/corrections') +
        kpi('シフト日時変更申請', c.shiftChanges, 'mgr/shift-changes') + '</div></section>' +
        '<section class="section">' + otHtml + '</section>' +
        '<div class="grid-2 section"><div><div class="card"><div class="card-head"><div class="card-title">本日の勤務状況(' + esc(fmt.date(today)) + ')</div>' +
        '<a class="btn btn-ghost btn-sm" href="' + app.href('mgr/work', { from: today, to: today }) + '">勤務実態一覧で表示</a></div>' +
        '<table class="table table-sm"><thead><tr><th>従業員</th><th>本日のシフト</th><th>勤務ステータス ' + ui.hokan(61) + '</th>' +
        '<th class="num">出勤</th><th>差異 ' + ui.hokan(58) + '</th></tr></thead><tbody>' + todayRows + '</tbody></table></div></div><div>' +
        card('今後 14 日間の人員不足 ' + ui.hokan(8), '<a class="btn btn-ghost btn-sm" href="#/mgr/shifts">シフト管理で表示</a>',
          shorts.length ? '<table class="table table-sm"><tbody>' + shorts.map(function (x) {
            return '<tr><td><a href="' + app.href('mgr/shifts', { month: T.month(x.date) }) + '">' + esc(fmt.date(x.date)) + '</a></td>' +
              '<td>' + ui.badge(x.count + ' 名 / 必要 ' + x.required + ' 名', 'ng') + '</td></tr>';
          }).join('') + '</tbody></table>' : '<p class="muted">今後 14 日間に人員不足の日はありません</p>') +
        '</div></div>';
    },
  };

  // ================= シフト管理(UC-203〜205、#32) =================
  function shiftForm(sid, v, o) {
    o = o || {};
    return '<form class="form" data-shift-form>' +
      (o.fixedUser ? '' : ui.field('従業員', '<select name="userId">' + empOptions(sid, v.userId, '選択してください') + '</select>', 'userId')) +
      '<div class="form-row">' +
      ui.field('勤務日', '<input type="date" name="date" min="' + T.today() + '" value="' + esc(v.date) + '">', 'date') +
      ui.field('開始時刻', '<input type="time" name="start" value="' + esc(v.start) + '">', 'start') +
      ui.field('終了時刻', '<input type="time" name="end" value="' + esc(v.end) + '">', 'end') +
      '</div><p class="muted small" style="margin:0">日をまたぐシフトは登録できない。時間の重ならないシフトは同じ日に複数登録できる ' + ui.hokan(33) + '</p>' +
      '<div data-shift-info>' + shiftInfo(o.fixedUser || v.userId, v.date, v.start, v.end, o.excludeId) + '</div></form>';
  }
  function shiftInfo(userId, date, start, end, excludeId) {
    var u = S.user(userId);
    if (!u || !T.validDate(date)) return '<p class="muted small">従業員と勤務日を指定すると、勤務可能時間と予定休憩を表示する</p>';
    var timesOk = T.validTime(start) && T.validTime(end) && T.toMin(start) < T.toMin(end);
    var same = S.shiftsOn(userId, date).filter(function (s) { return s.id !== excludeId; });
    return '<div class="card" style="box-shadow:none"><div class="card-body">' + kv([
      ['勤務可能時間(' + esc(fmt.date(date)) + ')', availText(u, date)],
      ['予定休憩', (timesOk ? S.plannedBreak(u, start, end) + ' 分' : '—') +
        ' <span class="muted small">管理者設定の休憩時間を適用(' + esc(S.breakRuleText(u)) + ')</span> ' + ui.hokan(28)],
      ['同じ日のシフト', shiftsText(same)],
    ]) + '</div></div>';
  }
  function bindShiftForm(m, fixedUser, excludeId) {
    var f = m.body.querySelector('[data-shift-form]');
    function update() {
      var v = ui.values(f);
      f.querySelector('[data-shift-info]').innerHTML = shiftInfo(fixedUser || v.userId, v.date, v.start, v.end, excludeId);
    }
    f.addEventListener('input', update);
    f.addEventListener('change', update);
  }
  // UC-203/204 の Alt-1〜3: 入力に戻して誤り・重複・範囲外を提示
  function shiftError(m, r, uc) {
    var f = m.body.querySelector('[data-shift-form]');
    var alt = { invalid: 'Alt-1', overlap: 'Alt-2', availability: 'Alt-3' }[r.code];
    var html = esc(r.message);
    var errors = r.errors || {};
    if (r.code === 'overlap') { html += ul(r.shifts.map(shiftText)); errors = { end: '登録済みのシフトと重複しています' }; }
    if (r.code === 'availability') { html += '<br>勤務可能時間: ' + esc(r.availability); errors = { end: '勤務可能時間の範囲外です' }; }
    ui.showErrors(f, errors);
    m.setError(html + (alt ? ui.flowNote(uc + ' ' + alt) : ''));
  }

  // UC-203: 従業員の指定・シフト情報の入力 → 登録内容の提示 → 登録
  function registerShift(sid, init) {
    var v = { userId: init.userId || '', date: init.date || T.today(), start: '', end: '' };
    var labels = ['従業員の指定・シフト情報の入力', '登録内容の提示'];
    var m = flow({ title: 'シフトを登録', ucs: ['UC-203'], cancel: 'シフトの登録' });
    function input() {
      m.step(steps(labels, 0) + shiftForm(sid, v), [{ label: 'キャンセル' }, { label: '次へ', kind: 'primary', onClick: next }]);
      bindShiftForm(m, null, null);
    }
    function next() {
      Object.assign(v, ui.values(m.body.querySelector('[data-shift-form]')));
      var r = S.validateShift(v);
      if (!r.ok) { shiftError(m, r, 'UC-203'); return false; }
      var u = S.user(v.userId);
      m.step(steps(labels, 1) + '<h3>登録内容</h3>' + kv([
        ['従業員', esc(u.name)],
        ['勤務日', esc(fmt.dateFull(v.date))],
        ['時間', esc(fmt.range(v.start, v.end))],
        ['予定休憩', S.plannedBreak(u, v.start, v.end) + ' 分 ' + ui.hokan(28)],
        ['勤務可能時間', availText(u, v.date)],
      ]) + '<p class="muted small">登録すると従業員側に表示され、従業員に通知される ' + ui.hokan(34) + ui.hokan(3) + '</p>',
        [{ label: 'キャンセル' }, { label: '戻る', onClick: function () { input(); return false; } }, { label: '登録する', kind: 'primary', onClick: run }]);
      return false;
    }
    function run() {
      var r = S.createShift(S.me().id, { userId: v.userId, date: v.date, start: v.start, end: v.end });
      if (r.ok) { m.end(); ui.toast('シフトを登録しました', 'ok', S.userName(v.userId) + ' ' + shiftText(r.shift) + '(従業員に通知しました)'); return; }
      if (r.code === 'fault') { m.setError(esc(r.message)); return false; }
      input();
      shiftError(m, r, 'UC-203');
      return false;
    }
    input();
  }

  // シフトの指定(UC-204/205 step3)→ 詳細 → [変更][削除]
  function shiftDetail(id) {
    var s = S.shift(id);
    if (!s) { ui.toast('対象のシフトが存在しません', 'ng'); app.refresh(); return; }
    var u = S.user(s.userId);
    var m = flow({ title: 'シフトの詳細', cancel: null });
    function body() {
      return kv([
        ['従業員', esc(u ? u.name : '—')],
        ['勤務日', esc(fmt.dateFull(s.date))],
        ['時間', esc(fmt.range(s.start, s.end))],
        ['状態', ui.status(S.shiftState(s)) + ' ' + ui.hokan(35)],
        ['予定休憩', S.plannedBreak(u, s.start, s.end) + ' 分 ' + ui.hokan(28)],
        ['登録元', esc(s.source) + (s.source === 'シフト希望' ? '(シフト希望の承認 UC-207)' : '')],
        ['登録日時', esc(fmt.dtFull(s.createdAt)) + ' ' + esc(S.userName(s.createdBy))],
      ]);
    }
    function detail() {
      m.setCancel(null);
      var pc = S.pendingShiftChange(s.id);
      m.step('<div class="uc-chips" style="margin:0 0 8px">' + ui.ucs(['UC-204', 'UC-205']) + '</div>' + body() +
        (pc ? ui.alert('info', 'このシフトには申請中のシフト日時変更申請があります(' + esc(shiftText(pc.after)) + ' へ変更希望) ' +
          '<a href="' + app.href('mgr/shift-changes', { id: pc.id }) + '">シフト日時変更申請一覧で表示</a>') : ''),
        [{ label: '閉じる' }, { label: '削除', kind: 'danger', onClick: del }, { label: '変更', kind: 'primary', onClick: change }]);
    }
    // UC-204 Alt-4 / UC-205 Alt-1 は押下時に提示してシフトの指定に戻る(#68 と同じ方針)
    function change() {
      if (S.shiftState(s) === '勤務済み') {
        m.setError(esc('勤務済みのシフトは変更できません') + ui.flowNote('UC-204 Alt-4') + ui.hokan(85) +
          '<br><span class="small">勤務済みの記録は <a href="' + app.href('mgr/attendance', { userId: s.userId, date: s.date }) + '">勤怠修正(UC-212)</a> で直す</span>');
        return false;
      }
      m.setCancel('シフトの変更');
      changeShift(m, s);
      return false;
    }
    function del() {
      var st = S.shiftState(s);
      if (st === '勤務済み' || st === '勤務中') {
        m.setError(esc('勤務済み・勤務中のシフトは削除できません') + ui.flowNote('UC-205 Alt-1') + ui.hokan(85));
        return false;
      }
      m.setCancel('シフトの削除');
      m.step('<div class="uc-chips" style="margin:0 0 8px">' + ui.uc('UC-205') + '</div>' + steps(['削除内容の提示'], 0) + body() +
        ui.alert('warn', '削除したシフトは元に戻せない(削除内容は変更・削除履歴に記録される) ' + ui.hokan(37)) +
        '<p class="muted small">削除すると従業員に通知される ' + ui.hokan(3) + '</p>',
        [{ label: 'キャンセル' }, { label: '削除する', kind: 'danger', onClick: function () {
          var text = shiftText(s);
          var r = S.deleteShift(S.me().id, s.id);
          if (r.ok) { m.end(); ui.toast('シフトを削除しました', 'ok', (u ? u.name : '') + ' ' + text + '(従業員に通知しました)'); return; }
          if (r.code === 'worked' || r.code === 'notfound') {
            terminal(m, esc(r.message), r.code === 'worked' ? 'UC-205 Alt-1' : null, 'シフト表に戻る');
            return false;
          }
          m.setError(esc(r.message));
          return false;
        } }]);
      return false;
    }
    detail();
  }

  // UC-204: 現在の内容の提示・変更後の入力 → 変更前と変更後の提示 → 変更(期限なし #36)
  function changeShift(m, s) {
    var u = S.user(s.userId);
    var v = { date: s.date, start: s.start, end: s.end };
    var labels = ['変更後のシフト情報の入力', '変更前と変更後の提示'];
    var chip = '<div class="uc-chips" style="margin:0 0 8px">' + ui.uc('UC-204') + '</div>';
    function input() {
      m.step(chip + steps(labels, 0) + '<h3>現在の内容</h3>' +
        kv([['従業員', esc(u.name)], ['シフト', esc(shiftText(s))], ['状態', ui.status(S.shiftState(s))]]) +
        h3('変更後のシフト情報') + shiftForm(null, v, { fixedUser: s.userId, excludeId: s.id }) +
        '<p class="muted small">勤怠管理者による変更は期限なし ' + ui.hokan(36) + '</p>',
        [{ label: 'キャンセル' }, { label: '次へ', kind: 'primary', onClick: next }]);
      bindShiftForm(m, s.userId, s.id);
    }
    function next() {
      var f = m.body.querySelector('[data-shift-form]');
      Object.assign(v, ui.values(f));
      if (v.date === s.date && v.start === s.start && v.end === s.end) {
        ui.showErrors(f, { date: '変更前と同じ日時です' });
        m.setError(esc('入力されたシフト情報に誤りがあります') + ui.flowNote('UC-204 Alt-1') + ui.hokan(83));
        return false;
      }
      var r = S.validateShift({ userId: s.userId, date: v.date, start: v.start, end: v.end, excludeId: s.id });
      if (!r.ok) { shiftError(m, r, 'UC-204'); return false; }
      m.step(chip + steps(labels, 1) + '<p><strong>' + esc(u.name) + '</strong> のシフト</p>' + shiftDiff(s, v, ['変更前', '変更後'], u) +
        '<p class="muted small">変更前の内容は変更・削除履歴に記録され、従業員に通知される ' + ui.hokan(38) + ui.hokan(3) + '</p>',
        [{ label: 'キャンセル' }, { label: '戻る', onClick: function () { input(); return false; } }, { label: '変更する', kind: 'primary', onClick: run }]);
      return false;
    }
    function run() {
      var before = shiftText(s);
      var r = S.updateShift(S.me().id, s.id, { date: v.date, start: v.start, end: v.end });
      if (r.ok) { m.end(); ui.toast('シフトを変更しました', 'ok', u.name + ' ' + before + ' → ' + shiftText(r.shift) + '(従業員に通知しました)'); return; }
      if (r.code === 'worked' || r.code === 'notfound') {
        terminal(m, esc(r.message), r.code === 'worked' ? 'UC-204 Alt-4' : null, 'シフト表に戻る');
        return false;
      }
      if (r.code === 'fault') { m.setError(esc(r.message)); return false; }
      input();
      shiftError(m, r, 'UC-204');
      return false;
    }
    input();
  }

  function shiftGrid(sid, ym) {
    var days = T.daysOf(ym), today = T.today();
    var from = days[0], to = days[days.length - 1];
    var byCell = {}, hopes = {};
    S.storeShifts(sid, from, to).forEach(function (s) {
      var k = s.userId + '|' + s.date;
      (byCell[k] = byCell[k] || []).push(s);
    });
    S.hopeItems(sid, { status: '申請中', from: from, to: to, includeOff: true }).forEach(function (h) { hopes[h.userId + '|' + h.date] = h; });
    function cellCls(d) { return (T.isOffDay(d) ? ' offday' : '') + (d === today ? ' today' : '') + (d < today ? ' past' : ''); }
    var thead = '<tr><th class="sg-name">従業員</th>' + days.map(function (d) {
      var w = T.dow(d), hol = T.holiday(d);
      var cls = 'sg-day' + (T.isOffDay(d) ? ' offday' : '') + (hol ? ' holiday' : w === 0 ? ' sun' : w === 6 ? ' sat' : '') + (d === today ? ' today' : '');
      return '<th class="' + cls + '"' + (hol ? ' title="' + esc(hol) + '"' : '') + '>' + Number(d.slice(8)) + '<small>' + fmt.wd(d) + '</small></th>';
    }).join('') + '</tr>';
    var rows = S.storeEmployees(sid).map(function (u) {
      return '<tr><td class="sg-name">' + esc(u.name) + '</td>' + days.map(function (d) {
        var k = u.id + '|' + d;
        var list = byCell[k] || [];
        var h = hopes[k];
        var inner = list.map(function (s) {
          var st = S.shiftState(s);
          return '<span class="sg-shift' + (st === '勤務済み' ? ' worked' : '') + '" data-shift="' + s.id + '" title="' + esc(st) + '">' +
            hm(s.start) + '-<br>' + hm(s.end) + '</span>';
        }).join('<br>');
        if (h && h.kind === '休日希望') inner += '<span class="sg-off" title="休日希望">休</span>';
        else if (h) {
          inner += '<a class="sg-hope" href="' + app.href('mgr/hopes', { key: h.key, from: d, to: d }) + '" title="申請中のシフト希望">希 ' +
            (h.kind === '時間指定' ? hm(h.start) + '-<br>' + hm(h.end) : '出勤可能') + '</a>';
        }
        var tip = list.length || d < today ? '' : ' title="シフトを登録"';
        return '<td class="sg-cell' + cellCls(d) + '" data-user="' + u.id + '" data-date="' + d + '"' + tip + '>' + inner + '</td>';
      }).join('') + '</tr>';
    }).join('');
    var staff = '<tr class="sg-staff"><td class="sg-name">人数 / 必要人数</td>' + days.map(function (d) {
      var st = S.staffing(sid, d);
      return '<td class="' + (st.short ? 'short' : '') + (d === today ? ' today' : '') + '">' + st.count + '/' + st.required + '</td>';
    }).join('') + '</tr>';
    return '<div class="table-wrap"><table class="shift-grid"><thead>' + thead + '</thead><tbody>' + rows + staff + '</tbody></table></div>';
  }
  function gridView(sid, ym) {
    var nav = '<div class="toolbar" style="align-items:center">' +
      '<a class="btn btn-secondary btn-sm" href="' + app.href('mgr/shifts', { month: T.addMonths(ym, -1) }) + '">← 前月</a>' +
      '<strong style="font-size:15px">' + esc(fmt.month(ym)) + '</strong>' +
      '<a class="btn btn-secondary btn-sm" href="' + app.href('mgr/shifts', { month: T.addMonths(ym, 1) }) + '">翌月 →</a>' +
      (ym !== T.thisMonth() ? '<a class="btn btn-ghost btn-sm" href="' + app.href('mgr/shifts') + '">当月</a>' : '') + '</div>';
    var legend = '<div class="legend">' +
      '<span><span class="sg-shift">9:00-17:00</span> シフト</span>' +
      '<span><span class="sg-shift worked">9:00-17:00</span> 勤務済み ' + ui.hokan(35) + '</span>' +
      '<span><span class="sg-hope" style="display:inline">希 13:30-21:00</span> 申請中のシフト希望 ' + ui.hokan(41) + '</span>' +
      '<span><span class="sg-off" style="display:inline">休</span> 休日希望</span>' +
      '<span>過去日のセルには登録できない ' + ui.hokan(77) + '</span>' +
      '<span>最下行は日単位の人数 / 必要人数(赤は人員不足) ' + ui.hokan(8) + '</span></div>';
    return nav +
      (S.monthPublished(sid, ym) ? '' : ui.alert('info', esc(fmt.month(ym)) + 'のシフトは未登録です。登録した時点で従業員側に表示・通知される ' + ui.hokan(34))) +
      legend + shiftGrid(sid, ym);
  }
  var LOG_VIA = { 'UC-204': 'シフトの変更(UC-204)', 'UC-205': 'シフトの削除(UC-205)',
    'UC-215': 'シフト日時変更申請の承認(UC-215)', 'UC-105': 'ユーザーの削除(UC-105)' };
  function historyView(sid) {
    var list = S.shiftLog(sid);
    return '<p class="muted small">シフトの変更・削除の内容を記録する。削除したシフトは元に戻せない ' + ui.hokan(37) + '</p>' +
      (list.length ? '<div class="table-wrap"><table class="table table-sm"><thead><tr><th>日時</th><th>種別</th><th>従業員</th>' +
        '<th>変更前</th><th>変更後</th><th>操作者</th><th>経路</th></tr></thead><tbody>' +
        list.map(function (l) {
          return '<tr><td class="nowrap">' + esc(fmt.dtFull(l.at)) + '</td><td>' + ui.badge(l.type, l.type === '削除' ? 'ng' : 'info') + '</td>' +
            '<td>' + esc(S.userName(l.userId)) + '</td><td class="nowrap">' + (l.before ? esc(shiftText(l.before)) : '—') + '</td>' +
            '<td class="nowrap">' + (l.after ? esc(shiftText(l.after)) : '—') + '</td><td>' + esc(S.userName(l.by)) + '</td>' +
            '<td class="small">' + esc(LOG_VIA[l.via] || l.via) + '</td></tr>';
        }).join('') + '</tbody></table></div>' : ui.empty('変更・削除履歴はありません'));
  }

  K.views['mgr/shifts'] = {
    role: ROLE, title: 'シフト管理', nav: 'shifts',
    render: function (params) {
      var head = { title: 'シフト管理', ucs: ['UC-203', 'UC-204', 'UC-205'], hokan: [32],
        lead: 'シフト表の空きセル(本日以降)で登録、シフトを選ぶと詳細を表示して変更・削除する',
        actions: '<button type="button" class="btn btn-primary" data-act="new-shift">シフトを登録</button>' };
      var sid = storeId();
      if (!sid) return noStore(head);
      var tab = params.tab === 'history' ? 'history' : 'grid';
      var ym = /^\d{4}-\d{2}$/.test(params.month || '') ? params.month : T.thisMonth();
      // 補完バッジは .tabs button のスタイルを受けないようタブの外に置く
      return ui.pageHead(head) +
        '<div class="row" style="gap:4px;border-bottom:1px solid var(--border);margin-bottom:14px">' +
        '<div class="tabs" style="border-bottom:0;margin-bottom:0">' +
        '<a href="' + app.href('mgr/shifts', { month: params.month }) + '" class="' + (tab === 'grid' ? 'active' : '') + '">シフト表</a>' +
        '<a href="' + app.href('mgr/shifts', { tab: 'history', month: params.month }) + '" class="' + (tab === 'history' ? 'active' : '') + '">変更・削除履歴</a>' +
        '</div>' + ui.hokan(38) + '</div>' +
        (tab === 'grid' ? gridView(sid, ym) : historyView(sid));
    },
    mount: function (el) {
      var sid = storeId();
      if (!sid) return;
      var wrap = el.querySelector('.shift-grid') && el.querySelector('.table-wrap');
      var th = el.querySelector('.shift-grid thead th.today');
      if (wrap && th) wrap.scrollLeft = Math.max(0, th.offsetLeft - el.querySelector('.shift-grid .sg-name').offsetWidth - th.offsetWidth * 2);
      ui.on(el, 'click', '[data-act="new-shift"]', function () { registerShift(sid, {}); });
      ui.on(el, 'click', 'td.sg-cell', function (e, td) {
        if (e.target.closest('a')) return;
        var chip = e.target.closest('[data-shift]') || td.querySelector('[data-shift]');
        if (chip) { shiftDetail(chip.dataset.shift); return; }
        if (td.classList.contains('past')) return; // #77
        registerShift(sid, { userId: td.dataset.user, date: td.dataset.date });
      });
    },
  };

  // ================= シフト希望一覧(UC-206〜208、#41) =================
  function hopeTimeText(h) {
    if (h.kind === '時間指定') return esc(fmt.range(h.start, h.end));
    if (h.kind === '出勤可能') return '時間指定なし';
    return ui.badge('休日希望');
  }
  function hopeSummary(h) {
    return kv([['従業員', esc(h.user.name)], ['希望日', esc(fmt.dateFull(h.date))], ['希望時間帯', hopeTimeText(h)],
      ['勤務可能時間', availText(h.user, h.date)]]);
  }
  function hopeList(list, params, filter) {
    if (!list.length) return emptyList(filter, '未処理のシフト希望が存在しません', '条件に合うシフト希望はありません', 'UC-206 Alt-1');
    var pending = list.some(function (h) { return h.status === '申請中'; });
    return '<div class="toolbar" style="align-items:center"><span class="muted small">' + list.length + ' 件</span><span class="spacer"></span>' +
      (pending ? '<button type="button" class="btn btn-ok btn-sm" data-act="bulk">選択した <span data-check-count>0</span> 件を一括承認</button>' + ui.hokan(45) : '') +
      '</div><div class="table-wrap"><table class="table table-sm"><thead><tr>' +
      '<th>' + (pending ? '<input type="checkbox" data-act="check-all" aria-label="申請中をすべて選択">' : '') + '</th>' +
      '<th>従業員</th><th>希望日</th><th>希望時間帯</th><th>提出日時</th><th>状態</th></tr></thead><tbody>' +
      list.map(function (h) {
        return '<tr class="clickable' + (h.key === params.key ? ' selected' : '') + '" data-sel="' + esc(h.key) + '">' +
          '<td>' + (h.status === '申請中' ? '<input type="checkbox" data-check value="' + esc(h.key) + '" aria-label="選択">' : '') + '</td>' +
          '<td>' + esc(h.user.name) + '</td><td class="nowrap">' + esc(fmt.date(h.date)) + '</td>' +
          '<td class="nowrap">' + hopeTimeText(h) + '</td><td class="nowrap">' + esc(fmt.dt(h.submittedAt)) + '</td>' +
          '<td>' + (h.status ? ui.status(h.status) : '—') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function hopeDetail(sid, h) {
    if (!h) return placeholder('一覧からシフト希望を選ぶと、詳細と希望日の人員の状況を表示する');
    var inAv = h.kind === '時間指定' ? S.inAvailability(h.user, h.date, h.start, h.end) : null;
    var shift = h.shiftId ? S.shift(h.shiftId) : null;
    return card('シフト希望の詳細', h.status ? ui.status(h.status) : ui.badge('休日希望'),
      selfNote(h.userId, '申請') +
      kv([
        ['従業員', esc(h.user.name)],
        ['希望日', esc(fmt.dateFull(h.date))],
        ['種類', ui.badge(h.kind)],
        ['希望時間帯', hopeTimeText(h)],
        ['勤務可能時間', availText(h.user, h.date) + (inAv === false ? ' ' + ui.badge('希望が範囲外', 'ng') : '')],
        ['提出日時', esc(fmt.dtFull(h.submittedAt))],
        shift ? ['登録したシフト', esc(shiftText(shift))] : null,
      ].concat(processedRows(h))) +
      (h.kind === '休日希望' ? '<p class="muted small">休日希望は承認・却下の対象外(シフト表に表示) ' + ui.hokan(41) + '</p>' : '') +
      h3('希望日の登録済みシフトと人員の状況 ' + ui.hokan(8)) + staffingBlock(sid, h.date, { userId: h.userId }) +
      (h.status === '申請中' ? decideButtons('hope', h.key) : ''));
  }

  // UC-207: 承認内容の提示 → 承認(Alt-1 は時間帯を調整して step4 に戻る)
  function approveHope(key) {
    var item = S.hopeItem(key);
    if (!item) return;
    var noTime = item.kind === '出勤可能';
    var t = noTime ? S.defaultHopeTimes(item) : { start: item.start, end: item.end };
    var adjusted = false;
    var m = flow({ title: 'シフト希望を承認', ucs: ['UC-207'], cancel: 'シフト希望の承認' });
    function timeFields(note) {
      return '<form class="form" data-times><div class="form-row">' +
        ui.field('開始時刻', '<input type="time" name="start" value="' + esc(t.start) + '">', 'start') +
        ui.field('終了時刻', '<input type="time" name="end" value="' + esc(t.end) + '">', 'end') + '</div>' + (note || '') + '</form>';
    }
    function present() {
      m.step(steps(['承認内容の提示', '承認'], 0) + selfNote(item.userId, '申請') + hopeSummary(item) +
        (noTime
          ? h3('登録するシフトの時刻') + timeFields('<p class="muted small" style="margin:0">時間指定のない希望のため時刻を入力する(初期値: 勤務可能時間、未設定なら店舗の営業時間) ' + ui.hokan(42) + '</p>')
          : '<p>希望どおり <strong>' + esc(fmt.range(t.start, t.end)) + '</strong> のシフトとして登録する</p>') +
        '<p class="muted small">承認するとシフトとして登録され、従業員に承認結果が通知される ' + ui.hokan(3) + '</p>',
        [{ label: 'キャンセル' }, { label: '承認する', kind: 'ok', onClick: run }]);
    }
    function adjust(r) {
      adjusted = true;
      m.step(steps(['承認内容の提示', '時間帯の調整', '承認'], 1) + hopeSummary(item) +
        h3('重複している登録済みシフト') + ul(r.shifts.map(shiftText)) + h3('調整した時間帯') + timeFields(),
        [{ label: 'キャンセル' }, { label: '調整した時間帯で承認する', kind: 'ok', onClick: run }]);
      m.setError(esc(r.message) + ui.flowNote('UC-207 Alt-1'));
    }
    function run() {
      var f = m.body.querySelector('[data-times]');
      if (f) { var v = ui.values(f); t = { start: v.start, end: v.end }; }
      var r = S.approveHope(S.me().id, key, noTime || adjusted ? t : undefined);
      if (r.ok) { m.end(); ui.toast('承認しました。シフトに登録しました', 'ok', item.user.name + ' ' + shiftText(r.shift) + '(従業員に通知しました)'); return; }
      if (r.code === 'overlap') { adjust(r); return false; }
      if (r.code === 'state') { terminal(m, esc(r.message), 'UC-207 Alt-2'); return false; }
      if (r.code === 'availability') { terminal(m, esc(r.message) + '<br>勤務可能時間: ' + esc(r.availability), 'UC-207 Alt-3'); return false; }
      if (f && r.errors) ui.showErrors(f, r.errors);
      m.setError(esc(r.message) + (r.errors ? '<br>' + esc(errorsText(r.errors)) : ''));
      return false;
    }
    present();
  }
  var BULK_FLOW = { overlap: 'UC-207 Alt-1', state: 'UC-207 Alt-2', availability: 'UC-207 Alt-3' };
  // #45 一括承認: 内容の提示 → 承認 → 結果(失敗した件は申請中のまま)
  function bulkApprove(keys) {
    var items = keys.map(function (k) { return S.hopeItem(k); }).filter(Boolean);
    var labels = ['承認内容の提示', '結果'];
    var m = flow({ title: 'シフト希望を一括承認', ucs: ['UC-207'], wide: true, cancel: 'シフト希望の一括承認' });
    m.step(steps(labels, 0) + '<p>選択した ' + items.length + ' 件のシフト希望を承認し、シフトとして登録する ' + ui.hokan(45) + '</p>' +
      (items.some(function (h) { return h.userId === S.me().id; }) ? selfNote(S.me().id, '申請を含む選択') : '') +
      '<table class="table table-sm"><thead><tr><th>従業員</th><th>希望日</th><th>登録するシフトの時間帯</th></tr></thead><tbody>' +
      items.map(function (h) {
        var t = S.defaultHopeTimes(h);
        return '<tr><td>' + esc(h.user.name) + '</td><td class="nowrap">' + esc(fmt.date(h.date)) + '</td><td>' + esc(fmt.range(t.start, t.end)) +
          (h.kind === '出勤可能' ? ' <span class="muted small">(時間指定なしのため初期値)</span> ' + ui.hokan(42) : '') + '</td></tr>';
      }).join('') + '</tbody></table>' +
      '<p class="muted small">1 件ずつ重複・勤務可能時間をチェックし、登録できない件は申請中のまま残す。承認した件は従業員に通知される</p>',
      [{ label: 'キャンセル' }, { label: items.length + ' 件を承認する', kind: 'ok', onClick: function () {
        var res = S.bulkApproveHopes(S.me().id, items.map(function (h) { return h.key; }));
        var okN = res.filter(function (x) { return x.ok; }).length;
        var ng = res.filter(function (x) { return !x.ok; });
        m.end();
        m.step(steps(labels, 1) +
          ui.alert(ng.length ? 'warn' : 'ok', items.length + ' 件中 ' + okN + ' 件を承認し、シフトに登録しました' +
            (ng.length ? '。' + ng.length + ' 件は承認できなかったため申請中のまま残しました' : '')) +
          (ng.length ? '<table class="table table-sm"><thead><tr><th>従業員</th><th>希望日</th><th>承認できなかった理由</th></tr></thead><tbody>' +
            ng.map(function (x) {
              return '<tr><td>' + esc(x.item ? x.item.user.name : '—') + '</td><td class="nowrap">' + esc(x.item ? fmt.date(x.item.date) : '—') + '</td>' +
                '<td>' + esc(x.message) + (BULK_FLOW[x.code] ? ui.flowNote(BULK_FLOW[x.code]) : '') + '</td></tr>';
            }).join('') + '</tbody></table><p class="muted small">重複した件は個別に承認すると時間帯を調整できる(UC-207 Alt-1)</p>' : ''),
          [{ label: '閉じる' }]);
        ui.toast(okN + ' 件を承認しました', ng.length ? 'warn' : 'ok', ng.length ? ng.length + ' 件は申請中のまま' : '');
        return false;
      } }]);
  }

  K.views['mgr/hopes'] = {
    role: ROLE, title: 'シフト希望一覧', nav: 'hopes',
    render: function (params) {
      var head = { title: 'シフト希望一覧', ucs: ['UC-206', 'UC-207', 'UC-208'], hokan: [41],
        lead: '従業員が送信したシフト希望を希望日単位で表示する。休日希望は承認・却下の対象外' };
      var sid = storeId();
      if (!sid) return noStore(head);
      var filter = { status: params.status || '申請中', userId: isEmp(sid, params.userId) ? params.userId : '',
        from: params.from, to: params.to, includeOff: params.off === '1' };
      var sel = params.key ? S.hopeItem(params.key) : null;
      if (sel && !inStore(sid, sel.userId)) sel = null;
      var hp = S.hopePeriod();
      return ui.pageHead(head) +
        '<p class="muted small">受付期間: ' + esc(fmt.month(hp.month)) + '分を ' + esc(fmt.date(hp.from)) + '〜' + esc(fmt.date(hp.to)) +
        '(' + (hp.open ? '受付中' : '受付期間外') + ') ' + ui.hokan(39) + '</p>' +
        filterBar(sid, params, { path: 'mgr/hopes', period: '期間(希望日)', statuses: STATUS_HOPE,
          extra: checkLabel('off', filter.includeOff, '休日希望も表示') }) +
        '<div class="split"><div>' + hopeList(S.hopeItems(sid, filter), params, filter) + '</div>' +
        '<div class="detail-panel">' + hopeDetail(sid, sel) + '</div></div>';
    },
    mount: function (el, params) {
      if (!storeId()) return;
      bindFilter(el, 'mgr/hopes');
      bindRows(el, 'mgr/hopes', params, 'key');
      function count() {
        var c = el.querySelector('[data-check-count]');
        if (c) c.textContent = el.querySelectorAll('[data-check]:checked').length;
      }
      ui.on(el, 'change', '[data-check]', count);
      ui.on(el, 'change', '[data-act="check-all"]', function (e, cb) {
        el.querySelectorAll('[data-check]').forEach(function (x) { x.checked = cb.checked; });
        count();
      });
      ui.on(el, 'click', '[data-act="bulk"]', function () {
        var keys = Array.prototype.map.call(el.querySelectorAll('[data-check]:checked'), function (x) { return x.value; });
        if (!keys.length) { ui.toast('一括承認するシフト希望を選択してください', 'warn'); return; }
        bulkApprove(keys);
      });
      ui.on(el, 'click', '[data-act="approve-hope"]', function (e, b) { approveHope(b.dataset.id); });
      ui.on(el, 'click', '[data-act="reject-hope"]', function (e, b) {
        var h = S.hopeItem(b.dataset.id);
        if (!h) return;
        rejectFlow({ uc: 'UC-208', title: 'シフト希望を却下', cancel: 'シフト希望の却下', userId: h.userId,
          summary: kv([['従業員', esc(h.user.name)], ['希望日', esc(fmt.dateFull(h.date))], ['希望時間帯', hopeTimeText(h)]]),
          reject: function (reason) { return S.rejectHope(S.me().id, h.key, reason); } });
      });
    },
  };

  // ================= 勤怠修正申請一覧(UC-209〜211) =================
  function corrChanges(c) {
    var out = REC_FIELDS.filter(function (f) { return c.before[f[0]] !== c.after[f[0]]; }).map(function (f) {
      return f[2] + ' ' + recVal(f[0], c.before[f[0]]) + '→' + recVal(f[0], c.after[f[0]]);
    });
    return out.length ? out.join('、') : '変更なし';
  }
  function corrList(list, params, filter) {
    if (!list.length) return emptyList(filter, '未処理の勤怠修正申請が存在しません', '条件に合う勤怠修正申請はありません', 'UC-209 Alt-1');
    return listCount(list.length) + '<div class="table-wrap"><table class="table table-sm"><thead><tr><th>従業員</th><th>対象日</th>' +
      '<th>修正内容</th><th>申請理由</th><th>申請日時</th><th>状態</th></tr></thead><tbody>' +
      list.map(function (c) {
        return '<tr class="clickable' + (c.id === params.id ? ' selected' : '') + '" data-sel="' + esc(c.id) + '">' +
          '<td>' + esc(S.userName(c.userId)) + '</td><td class="nowrap">' + esc(fmt.date(c.date)) + '</td>' +
          '<td class="small">' + esc(corrChanges(c)) + '</td><td class="small" title="' + esc(c.reason) + '">' + esc(trunc(c.reason, 22)) + '</td>' +
          '<td class="nowrap">' + esc(fmt.dt(c.createdAt)) + '</td><td>' + ui.status(c.status) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function corrDetail(c) {
    if (!c) return placeholder('一覧から勤怠修正申請を選ぶと、詳細と対象日のシフトとの矛盾の有無を表示する');
    var pend = c.status === '申請中';
    var chk = S.correctionCheck(c);
    var check = chk.contradiction
      ? ui.alert('warn', '<strong>矛盾</strong> ' + esc(chk.messages.join(' / ')) + ui.flowNote('UC-209 Alt-3') + ' ' + ui.hokan(52) +
        '<br><span class="small">矛盾があっても承認・却下できる</span>')
      : ui.alert('info', 'シフトとの矛盾はありません ' + ui.hokan(52) + ul(chk.messages) + '<span class="small">シフト時刻との差は参考表示</span>');
    return card('勤怠修正申請の詳細', ui.status(c.status),
      selfNote(c.userId, '申請') +
      kv([
        ['従業員', esc(S.userName(c.userId))],
        ['対象日', esc(fmt.dateFull(c.date))],
        ['申請日時', esc(fmt.dtFull(c.createdAt))],
        c.updatedAt && c.updatedAt !== c.createdAt ? ['更新日時', esc(fmt.dtFull(c.updatedAt))] : null,
      ].concat(processedRows(c))) +
      h3('修正内容') + recDiff(c.before, c.after, ['修正前', '修正後']) +
      h3('申請理由') + '<p>' + pre(c.reason) + '</p>' +
      h3('対象日のシフト') + '<p>' + shiftsText(chk.shifts) + '</p>' +
      (pend ? check +
        '<p class="muted small">承認時に修正内容は調整できない(調整が必要なら却下するか、勤怠修正で直接修正する) ' + ui.hokan(53) +
        ' <a href="' + app.href('mgr/attendance', { userId: c.userId, date: c.date }) + '">勤怠修正で表示</a></p>' +
        '<p class="muted small">締め処理は未実装のため、全期間の勤怠修正申請を承認できる ' + ui.hokan(7) + '</p>' +
        decideButtons('correction', c.id) : ''));
  }
  // UC-210: 承認内容の提示 → 承認
  function approveCorrection(c) {
    var name = S.userName(c.userId);
    var m = flow({ title: '勤怠修正申請を承認', ucs: ['UC-210'], cancel: '勤怠修正申請の承認' });
    m.step(steps(['承認内容の提示', '承認'], 0) + selfNote(c.userId, '申請') +
      kv([['従業員', esc(name)], ['対象日', esc(fmt.dateFull(c.date))], ['申請理由', pre(c.reason)]]) +
      '<div style="margin-top:10px">' + recDiff(c.before, c.after, ['修正前', '修正後']) + '</div>' +
      '<p class="muted small">承認すると修正後の内容を勤怠記録に反映し、修正前の内容を修正履歴に記録する。従業員に承認結果が通知される ' +
      ui.hokan(54) + ui.hokan(3) + '</p>',
      [{ label: 'キャンセル' }, { label: '承認する', kind: 'ok', onClick: function () {
        var r = S.approveCorrection(S.me().id, c.id);
        if (r.ok) { m.end(); ui.toast('承認しました。勤怠記録に反映しました', 'ok', name + ' ' + fmt.date(c.date) + '(従業員に通知しました)'); return; }
        if (r.code === 'state') { terminal(m, esc(r.message), 'UC-210 Alt-2'); return false; }
        if (r.code === 'invalid') { terminal(m, esc(r.message), 'UC-210 Alt-1'); return false; }
        m.setError(esc(r.message));
        return false;
      } }]);
  }

  K.views['mgr/corrections'] = {
    role: ROLE, title: '勤怠修正申請一覧', nav: 'corrections',
    render: function (params) {
      var head = { title: '勤怠修正申請一覧', ucs: ['UC-209', 'UC-210', 'UC-211'],
        lead: '従業員が送信した勤怠修正申請(打刻漏れ・打刻ミスの修正依頼)を表示する' };
      var sid = storeId();
      if (!sid) return noStore(head);
      var filter = { status: params.status || '申請中', userId: isEmp(sid, params.userId) ? params.userId : '', from: params.from, to: params.to };
      var sel = params.id ? S.correction(params.id) : null;
      if (sel && !inStore(sid, sel.userId)) sel = null;
      return ui.pageHead(head) +
        filterBar(sid, params, { path: 'mgr/corrections', period: '期間(対象日)', statuses: STATUS_REQ }) +
        '<div class="split"><div>' + corrList(S.correctionsForStore(sid, filter), params, filter) + '</div>' +
        '<div class="detail-panel">' + corrDetail(sel) + '</div></div>';
    },
    mount: function (el, params) {
      if (!storeId()) return;
      bindFilter(el, 'mgr/corrections');
      bindRows(el, 'mgr/corrections', params, 'id');
      ui.on(el, 'click', '[data-act="approve-correction"]', function (e, b) {
        var c = S.correction(b.dataset.id);
        if (c) approveCorrection(c);
      });
      ui.on(el, 'click', '[data-act="reject-correction"]', function (e, b) {
        var c = S.correction(b.dataset.id);
        if (!c) return;
        rejectFlow({ uc: 'UC-211', title: '勤怠修正申請を却下', cancel: '勤怠修正申請の却下', userId: c.userId,
          summary: kv([['従業員', esc(S.userName(c.userId))], ['対象日', esc(fmt.dateFull(c.date))], ['修正内容', esc(corrChanges(c))]]),
          reject: function (reason) { return S.rejectCorrection(S.me().id, c.id, reason); } });
      });
    },
  };

  // ================= シフト日時変更申請一覧(UC-214〜216) =================
  function scList(list, params, filter) {
    if (!list.length) return emptyList(filter, '未処理のシフト日時変更申請が存在しません', '条件に合うシフト日時変更申請はありません', 'UC-214 Alt-1');
    return listCount(list.length) + '<div class="table-wrap"><table class="table table-sm"><thead><tr><th>従業員</th><th>変更前のシフト</th>' +
      '<th>変更希望の日時</th><th>申請理由</th><th>申請日時</th><th>状態</th></tr></thead><tbody>' +
      list.map(function (c) {
        return '<tr class="clickable' + (c.id === params.id ? ' selected' : '') + '" data-sel="' + esc(c.id) + '">' +
          '<td>' + esc(S.userName(c.userId)) + '</td><td class="nowrap">' + esc(shiftText(c.before)) + '</td>' +
          '<td class="nowrap">' + esc(shiftText(c.after)) + '</td><td class="small" title="' + esc(c.reason) + '">' + esc(trunc(c.reason, 18)) + '</td>' +
          '<td class="nowrap">' + esc(fmt.dt(c.createdAt)) + '</td><td>' + ui.status(c.status) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function scCheckHtml(chk) {
    return chk.messages.length
      ? ui.alert('warn', '<strong>重複・人員不足・勤務可能時間</strong>' + ui.flowNote('UC-214 Alt-3') + ' ' + ui.hokan(64) + ul(chk.messages) +
        '<span class="small">重複・範囲外のままでは承認できない(承認時に UC-215 Alt-1/Alt-4)。人員不足は承認できる</span>')
      : ui.alert('info', '重複・人員不足・勤務可能時間の範囲外はありません ' + ui.hokan(64));
  }
  function scDetail(sid, c) {
    if (!c) return placeholder('一覧からシフト日時変更申請を選ぶと、詳細と重複・人員不足の有無を表示する');
    var pend = c.status === '申請中';
    var s = S.shift(c.shiftId);
    var chk = pend ? S.shiftChangeCheck(c) : null;
    var staffing = '';
    if (pend) {
      if (c.before.date === c.after.date) staffing = staffingBlock(sid, c.before.date, { userId: c.userId, note: '<span class="muted small">変更前・変更希望とも同じ日</span>' });
      else {
        staffing = '<p class="muted small" style="margin:0">変更前の日</p>' +
          staffingBlock(sid, c.before.date, { userId: c.userId,
            note: chk.shortageBefore ? ui.badge('承認後 ' + chk.shortageBefore.count + ' 名', 'ng') : '' }) +
          '<p class="muted small" style="margin:10px 0 0">変更希望の日</p>' + staffingBlock(sid, c.after.date, { userId: c.userId });
      }
    }
    return card('シフト日時変更申請の詳細', ui.status(c.status),
      selfNote(c.userId, '申請') +
      kv([
        ['従業員', esc(S.userName(c.userId))],
        ['変更前のシフト', esc(shiftText(c.before))],
        ['変更希望の日時', esc(shiftText(c.after))],
        ['申請理由', pre(c.reason)],
        ['申請日時', esc(fmt.dtFull(c.createdAt))],
        pend ? ['変更前のシフトの状態', s ? ui.status(S.shiftState(s)) : ui.badge('削除済み')] : null,
        pend ? ['勤務可能時間(変更希望の日)', availText(S.user(c.userId), c.after.date)] : null,
      ].concat(processedRows(c))) +
      (pend ? h3('重複・人員不足の判定') + scCheckHtml(chk) + h3('人員の状況 ' + ui.hokan(8)) + staffing + decideButtons('shift-change', c.id) : ''));
  }
  var SC_FLOW = { overlap: 'UC-215 Alt-1', shiftGone: 'UC-215 Alt-2', state: 'UC-215 Alt-3', availability: 'UC-215 Alt-4', invalid: 'UC-215 step4' };
  // UC-215: 承認内容の提示 → 承認(代替フローはすべて一覧に戻る)
  function approveShiftChange(c) {
    var name = S.userName(c.userId);
    var chk = S.shiftChangeCheck(c);
    var m = flow({ title: 'シフト日時変更申請を承認', ucs: ['UC-215'], cancel: 'シフト日時変更申請の承認' });
    m.step(steps(['承認内容の提示', '承認'], 0) + selfNote(c.userId, '申請') +
      kv([['従業員', esc(name)], ['申請理由', pre(c.reason)]]) +
      '<div style="margin-top:10px">' + shiftDiff(c.before, c.after, ['変更前', '変更希望'], S.user(c.userId)) + '</div>' +
      (chk.messages.length ? ui.alert('warn', ul(chk.messages)) : '') +
      '<p class="muted small">承認すると登録シフトを変更希望の日時に更新し、変更前の内容を変更・削除履歴に記録する。従業員に承認結果が通知される ' +
      ui.hokan(38) + ui.hokan(3) + '</p>',
      [{ label: 'キャンセル' }, { label: '承認する', kind: 'ok', onClick: function () {
        var r = S.approveShiftChange(S.me().id, c.id);
        if (r.ok) { m.end(); ui.toast('承認しました。登録シフトを変更しました', 'ok', name + ' ' + shiftText(c.before) + ' → ' + shiftText(c.after) + '(従業員に通知しました)'); return; }
        if (r.code === 'fault') { m.setError(esc(r.message)); return false; }
        var html = esc(r.message);
        if (r.code === 'overlap') html += ul(r.shifts.map(shiftText));
        if (r.code === 'availability') html += '<br>勤務可能時間: ' + esc(r.availability);
        if (r.code === 'invalid') html += '<br>' + esc(errorsText(r.errors));
        terminal(m, html, SC_FLOW[r.code] || null);
        return false;
      } }]);
  }

  K.views['mgr/shift-changes'] = {
    role: ROLE, title: 'シフト日時変更申請一覧', nav: 'shift-changes',
    render: function (params) {
      var head = { title: 'シフト日時変更申請一覧', ucs: ['UC-214', 'UC-215', 'UC-216'],
        lead: '従業員が送信した登録済みシフトのシフト日時変更申請を表示する' };
      var sid = storeId();
      if (!sid) return noStore(head);
      var filter = { status: params.status || '申請中', userId: isEmp(sid, params.userId) ? params.userId : '', from: params.from, to: params.to };
      var sel = params.id ? S.shiftChange(params.id) : null;
      if (sel && !inStore(sid, sel.userId)) sel = null;
      return ui.pageHead(head) +
        filterBar(sid, params, { path: 'mgr/shift-changes', period: '期間(変更前・変更希望の日)', statuses: STATUS_REQ }) +
        '<div class="split"><div>' + scList(S.shiftChangesForStore(sid, filter), params, filter) + '</div>' +
        '<div class="detail-panel">' + scDetail(sid, sel) + '</div></div>';
    },
    mount: function (el, params) {
      if (!storeId()) return;
      bindFilter(el, 'mgr/shift-changes');
      bindRows(el, 'mgr/shift-changes', params, 'id');
      ui.on(el, 'click', '[data-act="approve-shift-change"]', function (e, b) {
        var c = S.shiftChange(b.dataset.id);
        if (c) approveShiftChange(c);
      });
      ui.on(el, 'click', '[data-act="reject-shift-change"]', function (e, b) {
        var c = S.shiftChange(b.dataset.id);
        if (!c) return;
        rejectFlow({ uc: 'UC-216', title: 'シフト日時変更申請を却下', cancel: 'シフト日時変更申請の却下', userId: c.userId,
          summary: kv([['従業員', esc(S.userName(c.userId))], ['変更前のシフト', esc(shiftText(c.before))], ['変更希望の日時', esc(shiftText(c.after))]]),
          reject: function (reason) { return S.rejectShiftChange(S.me().id, c.id, reason); } });
      });
    },
  };

  // ================= 勤務実態一覧(UC-213) =================
  // 条件の初期値: 当月 1 日〜本日・担当店舗の全従業員(#60)
  function workCond(sid, params) {
    var c = { userId: isEmp(sid, params.userId) ? params.userId : '',
      from: T.validDate(params.from || '') ? params.from : T.thisMonth() + '-01',
      to: T.validDate(params.to || '') ? params.to : T.today(), diff: params.diff === '1' };
    if (c.from > c.to) c.error = '期間の開始日は終了日以前にしてください';
    return c;
  }
  function workSummary(sid, c) { return S.workSummary({ storeId: sid, userId: c.userId || null, from: c.from, to: c.to }); }
  function workDayRow(r) {
    var today = T.today();
    var src = r.breakSource ? ' ' + ui.badge(r.breakSource, r.breakSource === '修正' ? 'info' : 'gray') : '';
    return '<tr' + (r.date === today ? ' style="background:var(--today)"' : '') + '>' +
      '<td class="nowrap">' + esc(fmt.date(r.date)) + (r.corrected ? ' ' + ui.badge('修正済み') : '') + '</td>' +
      '<td class="nowrap">' + (r.shifts.length ? r.shifts.map(function (s) { return esc(fmt.range(s.start, s.end)); }).join('<br>') : '<span class="muted">なし</span>') + '</td>' +
      '<td class="num" title="' + esc(r.clockIn || '') + '">' + esc(fmt.time(r.clockIn)) + '</td>' +
      '<td class="num" title="' + esc(r.clockOut || '') + '">' + esc(fmt.time(r.clockOut)) + '</td>' +
      '<td class="nowrap">' + (r.breakMinutes === null ? '—' : r.breakMinutes + '分' + src) + '</td>' +
      '<td class="num">' + fmt.dur(r.workMinutes) + '</td>' +
      '<td class="num">' + (r.overtimeMinutes ? fmt.dur(r.overtimeMinutes) : '—') + '</td>' +
      '<td>' + r.flags.map(ui.status).join(' ') + '</td>' +
      '<td class="actions">' + (r.date <= today ? '<a class="btn btn-ghost btn-sm" href="' + app.href('mgr/attendance', { userId: r.userId, date: r.date }) + '">勤怠修正</a>' : '') + '</td></tr>';
  }
  function workView(sum, c) {
    var ot = sum.users.filter(function (x) { return x.alert; });
    var otHtml = ot.length ? ui.alert(ot.some(function (x) { return x.alert === '超過'; }) ? 'ng' : 'warn',
      '<strong>36 協定の警告</strong>(当月の残業時間。上限 月 ' + fmt.dur(S.OT_LIMIT) + '、' + fmt.dur(S.OT_WARN) + ' 以上で注意)' +
      ui.flowNote('UC-213 Alt-2') + ' ' + ui.hokan(57) +
      '<ul>' + ot.map(function (x) { return '<li>' + esc(x.user.name) + ' 当月残業 ' + fmt.dur(x.monthOvertime) + ' ' + ui.status(x.alert) + '</li>'; }).join('') + '</ul>') : '';
    var num = function (n) { return n ? '<strong style="color:var(--ng)">' + n + '</strong>' : '0'; };
    var summary = '<div class="card"><div class="card-head"><div class="card-title">集計(' + esc(fmt.date(c.from)) + '〜' + esc(fmt.date(c.to)) + ')</div></div>' +
      '<div class="table-wrap" style="border:0;border-radius:0"><table class="table table-sm"><thead><tr><th>従業員</th>' +
      '<th>現在の勤務ステータス ' + ui.hokan(61) + '</th><th class="num">勤務日数</th><th class="num">合計勤務時間</th>' +
      '<th class="num">残業時間 ' + ui.hokan(56) + '</th><th class="num">遅刻</th><th class="num">早退</th><th class="num">欠勤</th>' +
      '<th class="num">打刻漏れ ' + ui.hokan(58) + '</th><th class="num">当月残業 ' + ui.hokan(57) + '</th></tr></thead><tbody>' +
      sum.users.map(function (x) {
        var t = x.totals;
        return '<tr><td><a href="' + app.href('mgr/work', { userId: x.user.id, from: c.from, to: c.to }) + '">' + esc(x.user.name) + '</a></td>' +
          '<td>' + ui.status(x.status) + '</td><td class="num">' + t.days + ' 日</td><td class="num">' + fmt.dur(t.workMinutes) + '</td>' +
          '<td class="num">' + fmt.dur(t.overtimeMinutes) + '</td><td class="num">' + num(t.late) + '</td><td class="num">' + num(t.early) + '</td>' +
          '<td class="num">' + num(t.absent) + '</td><td class="num">' + num(t.missing) + '</td>' +
          '<td class="num">' + fmt.dur(x.monthOvertime) + (x.alert ? ' ' + ui.status(x.alert) : '') + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';
    var daily = '<h2 class="section-title" style="margin-top:20px">日別の勤務実態 ' + ui.hokan(59) +
      '<span class="muted small" style="font-weight:400">時刻は 1 分単位(秒は切り捨て。打刻の秒は時刻にカーソルを合わせると表示)</span></h2>' +
      sum.users.map(function (x) {
        var diffDays = x.rows.filter(function (r) { return r.flags.length; });
        var rows = c.diff ? diffDays : x.rows;
        return '<details class="card" style="margin-top:10px"' + (c.userId ? ' open' : '') + '>' +
          '<summary style="padding:12px 16px;cursor:pointer;font-weight:700">' + esc(x.user.name) +
          ' <span class="muted small" style="font-weight:400">' + x.rows.length + ' 日 / 差異のある日 ' + diffDays.length + ' 日</span></summary>' +
          (rows.length ? '<div class="table-wrap" style="border:0;border-top:1px solid var(--border);border-radius:0"><table class="table table-sm"><thead><tr>' +
            '<th>日付</th><th>シフト</th><th class="num">出勤</th><th class="num">退勤</th><th>休憩 ' + ui.hokan(29) + '</th>' +
            '<th class="num">勤務時間</th><th class="num">残業</th><th>差異 ' + ui.hokan(58) + '</th><th></th></tr></thead><tbody>' +
            rows.map(workDayRow).join('') + '</tbody></table></div>'
            : '<div class="card-body muted">' + (c.diff ? '差異のある日はありません' : '該当する勤怠記録が存在しません') + '</div>') +
          '</details>';
      }).join('');
    return otHtml + summary + daily;
  }

  K.views['mgr/work'] = {
    role: ROLE, title: '勤務実態一覧', nav: 'work',
    render: function (params) {
      var head = { title: '勤務実態一覧', ucs: ['UC-213'], hokan: [60],
        lead: '指定した従業員・期間の打刻記録を 1 分単位で集計し、予定シフトとの差異と 36 協定の上限に近い従業員を表示する',
        actions: '<button type="button" class="btn btn-secondary" data-act="recalc">再集計</button>' +
          '<button type="button" class="btn btn-secondary" data-act="csv">CSV 出力</button>' + ui.hokan(60) };
      var sid = storeId();
      if (!sid) return noStore(head);
      var c = workCond(sid, params);
      var form = '<form class="toolbar" data-filter>' +
        ui.field('従業員', '<select name="userId">' + empOptions(sid, c.userId, 'すべて') + '</select>', 'userId') +
        ui.field('期間', periodInputs(c.from, c.to), 'from') +
        checkLabel('diff', c.diff, '差異のある日のみ') +
        '<button type="submit" class="btn btn-primary">表示する</button></form>';
      var out = ui.pageHead(head) + form;
      if (c.error) return out + ui.alert('warn', esc(c.error) + ' ' + ui.hokan(86));
      var sum = workSummary(sid, c);
      if (!sum.hasRecords) return out + ui.empty('該当する勤怠記録が存在しません') + '<p class="center small">' + ui.flowNote('UC-213 Alt-1') + '</p>';
      return out + '<p class="muted small">集計日時 ' + esc(fmt.dtFull(T.nowIso())) + '(表示した時点で集計。自動更新なし) ' + ui.hokan(60) + '</p>' + workView(sum, c);
    },
    mount: function (el, params) {
      var sid = storeId();
      if (!sid) return;
      bindFilter(el, 'mgr/work');
      ui.on(el, 'click', '[data-act="recalc"]', function () { app.refresh(); ui.toast('再集計しました', 'info'); });
      ui.on(el, 'click', '[data-act="csv"]', function () {
        var c = workCond(sid, params);
        if (c.error) { ui.toast(c.error, 'ng'); return; }
        var sum = workSummary(sid, c);
        if (!sum.hasRecords) { ui.toast('該当する勤怠記録が存在しません', 'warn'); return; }
        var a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob(['﻿' + S.workSummaryCsv(sum)], { type: 'text/csv;charset=utf-8' }));
        a.download = 'kinmu_' + c.from + '_' + c.to + '.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
        ui.toast('CSV を出力しました', 'ok', a.download);
      });
    },
  };

  // ================= 勤怠修正(UC-212) =================
  // 修正後の勤怠情報と修正理由の入力 → 修正前と修正後の提示 → 修正(記録がない日は作成 = Alt-1)
  function correctAttendance(userId, date, create) {
    var u = S.user(userId);
    var r = S.dayRecord(userId, date);
    var before = { clockIn: r.clockIn ? r.clockIn.slice(0, 5) : null, clockOut: r.clockOut ? r.clockOut.slice(0, 5) : null, breakMinutes: r.breakMinutes };
    var v = { clockIn: before.clockIn || '', clockOut: before.clockOut || '',
      breakMinutes: before.breakMinutes === null ? '' : String(before.breakMinutes), reason: '' };
    var labels = ['修正後の勤怠情報と修正理由の入力', '修正前と修正後の提示'];
    var m = flow({ title: create ? '勤怠記録を作成' : '勤怠を修正', ucs: ['UC-212'], cancel: '勤怠の修正' });
    var target = kv([['従業員', esc(u.name)], ['日付', esc(fmt.dateFull(date))], ['シフト', shiftsText(r.shifts)]]);
    function input() {
      m.step(steps(labels, 0) + selfNote(userId, '勤怠記録') + target +
        (create ? '<p class="muted small">勤怠記録が存在しない日のため、新しく作成する' + ui.flowNote('UC-212 Alt-1') + '</p>' : '') +
        '<form class="form" data-correct style="margin-top:12px"><div class="form-row">' +
        ui.field('出勤時刻', '<input type="time" name="clockIn" value="' + esc(v.clockIn) + '">', 'clockIn') +
        ui.field('退勤時刻', '<input type="time" name="clockOut" value="' + esc(v.clockOut) + '">', 'clockOut') +
        ui.field('休憩時間(分)', '<input type="number" name="breakMinutes" min="0" step="1" value="' + esc(v.breakMinutes) + '">', 'breakMinutes',
          '管理者設定: ' + esc(S.breakRuleText(u)) + ' ' + ui.hokan(28)) + '</div>' +
        ui.field('修正理由(必須)', '<textarea name="reason" rows="3">' + esc(v.reason) + '</textarea>', 'reason',
          '不正防止のため必須。修正履歴に記録され、削除できない ' + ui.hokan(54)) +
        '</form>',
        [{ label: 'キャンセル' }, { label: '次へ', kind: 'primary', onClick: next }]);
    }
    function next() {
      var f = m.body.querySelector('[data-correct]');
      Object.assign(v, ui.values(f));
      var errors = S.validateTimes(v);
      var noReason = !v.reason.trim();
      if (Object.keys(errors).length) {
        if (noReason) errors.reason = '修正理由を入力してください';
        ui.showErrors(f, errors);
        m.setError(esc('入力された勤怠情報に誤りがあります') + ui.flowNote('UC-212 Alt-2'));
        return false;
      }
      if (noReason) {
        ui.showErrors(f, { reason: '修正理由を入力してください' });
        m.setError(esc('修正理由の入力が必要です') + ui.flowNote('UC-212 Alt-3'));
        return false;
      }
      var after = { clockIn: v.clockIn, clockOut: v.clockOut, breakMinutes: Number(v.breakMinutes) };
      var work = function (x) {
        return x.clockIn && x.clockOut ? fmt.dur(Math.max(0, T.toMin(x.clockOut) - T.toMin(x.clockIn) - (x.breakMinutes || 0))) : '—';
      };
      m.step(steps(labels, 1) + target + '<div style="margin-top:10px">' +
        recDiff(before, after, ['修正前', '修正後'], [['勤務時間', work(before), work(after)]]) + '</div>' +
        '<div style="margin-top:10px">' + kv([['修正理由', pre(v.reason.trim())]]) + '</div>' +
        '<p class="muted small">修正前の内容・修正者・修正日時・修正理由を修正履歴に記録し、従業員に通知される ' + ui.hokan(54) + ui.hokan(3) + '</p>',
        [{ label: 'キャンセル' }, { label: '戻る', onClick: function () { input(); return false; } }, { label: '修正する', kind: 'primary', onClick: run }]);
      return false;
    }
    function run() {
      var res = S.directCorrect(S.me().id, userId, date, { clockIn: v.clockIn, clockOut: v.clockOut, breakMinutes: v.breakMinutes, reason: v.reason });
      if (res.ok) { m.end(); ui.toast('勤怠記録を修正しました', 'ok', u.name + ' ' + fmt.date(date) + '(従業員に通知しました)'); return; }
      if (res.code === 'invalid' || res.code === 'reason') {
        input();
        ui.showErrors(m.body.querySelector('[data-correct]'), res.errors || {});
        m.setError(esc(res.message) + ui.flowNote(res.code === 'invalid' ? 'UC-212 Alt-2' : 'UC-212 Alt-3'));
        return false;
      }
      if (res.code === 'fault') { m.setError(esc(res.message)); return false; }
      terminal(m, esc(res.message), null, '閉じる');
      return false;
    }
    input();
  }
  function attendanceBody(userId, date) {
    var r = S.dayRecord(userId, date);
    var pc = S.pendingCorrection(userId, date);
    var hist = S.history(userId, date);
    var t = function (x) { return r.corrected ? fmt.time(x) : fmt.timeSec(x); };
    var record = r.hasRecord
      ? kv([
        ['シフト', shiftsText(r.shifts)],
        ['出勤時刻', esc(t(r.clockIn))],
        ['退勤時刻', esc(t(r.clockOut))],
        ['休憩時間', (r.breakMinutes === null ? '—' : r.breakMinutes + ' 分') + (r.breakSource ? ' ' + ui.badge(r.breakSource, 'gray') : '') + ' ' + ui.hokan(29)],
        ['勤務時間', esc(fmt.dur(r.workMinutes))],
        ['打刻', r.punches.length ? r.punches.map(function (p) { return esc(p.type + ' ' + p.at.slice(11)); }).join('<br>') : '<span class="muted">なし</span>'],
        ['差異', r.flags.length ? r.flags.map(ui.status).join(' ') : '<span class="muted">なし</span>'],
      ]) + (r.corrected ? '<p class="muted small">修正済みの勤怠記録(打刻より修正後の内容を優先)</p>' : '') +
        '<div class="row" style="justify-content:flex-end;margin-top:12px"><button type="button" class="btn btn-primary" data-act="correct">勤怠を修正する</button></div>'
      : kv([['シフト', shiftsText(r.shifts)]]) +
        ui.alert('warn', '指定された日に勤怠記録が存在しません。勤怠記録を新しく作成しますか' + ui.flowNote('UC-212 Alt-1') +
          '<div class="row" style="margin-top:8px"><button type="button" class="btn btn-primary btn-sm" data-act="create">作成する</button></div>');
    return selfNote(userId, '勤怠記録') +
      (pc ? ui.alert('info', 'この日には申請中の勤怠修正申請があります(' + esc(corrChanges(pc)) + ')。直接修正しても申請の処理状態は変わらない ' + ui.hokan(84) + ' ' +
        '<a href="' + app.href('mgr/corrections', { id: pc.id }) + '">勤怠修正申請一覧で表示</a>') : '') +
      '<div class="grid-2"><div>' +
      card('勤怠記録(' + esc(S.userName(userId)) + ' ' + esc(fmt.date(date)) + ')', r.corrected ? ui.badge('修正済み') : '', record) +
      '</div><div><div class="card"><div class="card-head"><div class="card-title">修正履歴 ' + ui.hokan(54) + '</div>' +
      '<span class="muted small">修正履歴は削除できない(不正防止)</span></div>' +
      (hist.length ? '<div class="table-wrap" style="border:0;border-radius:0"><table class="table table-sm"><thead><tr><th>日時</th><th>修正者</th>' +
        '<th>経路</th><th>修正前</th><th>修正後</th><th>理由</th></tr></thead><tbody>' +
        hist.map(function (h) {
          return '<tr><td class="nowrap">' + esc(fmt.dtFull(h.at)) + '</td><td>' + esc(S.userName(h.by)) + '</td><td class="small">' + esc(h.via) + '</td>' +
            '<td class="small">' + esc(recText(h.before)) + '</td><td class="small">' + esc(recText(h.after)) + '</td><td class="small">' + pre(h.reason) + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '<div class="card-body muted">修正履歴はありません</div>') +
      '</div></div></div>' +
      '<p class="muted small">締め処理は未実装のため、全期間の勤怠を修正できる ' + ui.hokan(7) + '</p>';
  }

  K.views['mgr/attendance'] = {
    role: ROLE, title: '勤怠修正', nav: 'attendance',
    render: function (params) {
      var head = { title: '勤怠修正', ucs: ['UC-212'], hokan: [49],
        lead: '従業員からの申請によらず、勤怠記録(出勤時刻・退勤時刻・休憩時間)を直接修正する' };
      var sid = storeId();
      if (!sid) return noStore(head);
      var today = T.today();
      var userId = params.userId || '', date = params.date || '';
      var err = null;
      if (userId && !isEmp(sid, userId)) err = '担当店舗の従業員を選択してください';
      else if (date && (!T.validDate(date) || date > today)) err = '未来の日付は修正できません';
      var form = '<form class="toolbar" data-target>' +
        ui.field('従業員', '<select name="userId">' + empOptions(sid, userId, '選択してください') + '</select>', 'userId') +
        ui.field('日付', '<input type="date" name="date" max="' + today + '" value="' + esc(date || today) + '">', 'date') +
        '<button type="submit" class="btn btn-primary">表示する</button></form>';
      var body;
      if (err) body = ui.alert('warn', esc(err));
      else if (!userId || !date) body = ui.empty('対象の従業員と日付を指定すると、その日の勤怠記録を表示します');
      else body = attendanceBody(userId, date);
      return ui.pageHead(head) + form + body;
    },
    mount: function (el, params) {
      if (!storeId()) return;
      var f = el.querySelector('[data-target]');
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        var v = ui.values(f);
        var errors = {};
        if (!v.userId) errors.userId = '従業員を選択してください';
        if (!v.date) errors.date = '日付を入力してください';
        else if (v.date > T.today()) errors.date = '未来の日付は修正できません';
        if (Object.keys(errors).length) { ui.showErrors(f, errors); return; }
        app.go('mgr/attendance', v);
      });
      ui.on(el, 'click', '[data-act="correct"]', function () { correctAttendance(params.userId, params.date, false); });
      ui.on(el, 'click', '[data-act="create"]', function () { correctAttendance(params.userId, params.date, true); });
    },
  };
})();
