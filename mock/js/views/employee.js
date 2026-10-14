/*
 * 従業員画面(スマホ幅)。UC-303〜311 と勤怠記録一覧(判断ログ #48)。
 */
window.K = window.K || {};
K.views = K.views || {};

(function () {
  var S = K.S, ui = K.ui, T = K.T, fmt = K.fmt, esc = ui.esc, app = K.app;

  var CORRECTION_DUP_MSG = S.CORRECTION_DUP_MSG; // UC-306 Ex-2
  var KIND_OPTS = [{ value: '', label: '未選択' }].concat(S.HOPE_KINDS); // #40

  // ---------------- 共通 ----------------
  function monthOf(params) { return /^\d{4}-\d{2}$/.test(params.month || '') ? params.month : T.thisMonth(); }
  function md(d) { return Number(d.slice(5, 7)) + '/' + Number(d.slice(8, 10)); }
  function dayColor(d) {
    if (T.dow(d) === 0 || T.holiday(d)) return 'color:#c0392b;';
    if (T.dow(d) === 6) return 'color:#2563c9;';
    return '';
  }
  function dayLabel(d) {
    return '<span class="nowrap" style="' + dayColor(d) + '"' + (T.holiday(d) ? ' title="' + esc(T.holiday(d)) + '"' : '') + '>' + fmt.date(d) + '</span>';
  }
  function shiftsText(list) {
    return list.length ? list.map(function (s) { return fmt.range(s.start, s.end); }).join('、') : 'なし';
  }
  function minText(m) { return m === null || m === undefined ? '—' : m + ' 分'; }
  function breakText(u, start, end) {
    if (!u.breakRule) return '休憩時間 未設定';
    var m = S.plannedBreak(u, start, end);
    return (m ? '予定休憩 ' + m + ' 分' : '予定休憩なし') + '(管理者設定)';
  }
  function errBox(msg, uc) { return ui.alert('ng', esc(msg) + (uc ? ui.flowNote(uc) : '')); }
  function emptyNote(msg, uc) { return '<div class="empty">' + esc(msg) + (uc ? '<div>' + ui.flowNote(uc) + '</div>' : '') + '</div>'; }
  function section(title, body) { return '<div class="section"><h2 class="section-title">' + title + '</h2>' + body + '</div>'; }
  function card(title, body) {
    return '<div class="card"><div class="card-head"><div class="card-title">' + title + '</div></div><div class="card-body">' + body + '</div></div>';
  }
  function stat(value, label, href) {
    var tag = href ? 'a' : 'div';
    return '<' + tag + ' class="mini-stat"' + (href ? ' href="#/' + href + '"' : '') + '><b>' + value + '</b><span>' + label + '</span></' + tag + '>';
  }
  function monthNav(path, ym, extra) {
    function href(m) { return app.href(path, Object.assign({}, extra || {}, { month: m })); }
    var cur = T.thisMonth();
    return '<div class="row" style="justify-content:space-between;margin-bottom:10px">' +
      '<a class="btn btn-secondary btn-sm" href="' + href(T.addMonths(ym, -1)) + '">‹ 前月</a>' +
      '<span><strong>' + fmt.month(ym) + '</strong>' + (ym !== cur ? ' <a class="small" href="' + href(cur) + '">当月へ</a>' : '') + '</span>' +
      '<a class="btn btn-secondary btn-sm" href="' + href(T.addMonths(ym, 1)) + '">翌月 ›</a></div>';
  }
  function showFormError(box, html) {
    box.innerHTML = html || '';
    box.hidden = !html;
    if (html) box.scrollIntoView({ block: 'nearest' });
  }
  function punchLog(list) {
    if (!list.length) return '<p class="muted small">打刻はありません</p>';
    return '<ul class="punch-log">' + list.map(function (p) {
      return '<li><span>' + esc(p.type) + '</span><span class="mono">' + p.at.slice(11) + '</span></li>';
    }).join('') + '</ul>';
  }
  var modal = ui.modal; // ハッシュ遷移で閉じる

  // ---------------- ホーム(UC-303 / UC-304 / UC-305) ----------------
  var clockTimer = null;
  var punchFlash = null; // 直前の打刻結果。再描画後に UC-305 の遷移を表示する
  function stopClock() { if (clockTimer) { clearInterval(clockTimer); clockTimer = null; } }

  var PUNCH_BTNS = [{ type: '出勤' }, { type: '退勤', out: true }, { type: '休憩開始' }, { type: '休憩終了' }]; // #67

  K.views['emp/home'] = {
    role: '従業員',
    title: 'ホーム',
    tab: 'home',
    render: function () {
      var me = S.me();
      var today = T.today();
      var status = S.currentStatus(me.id);
      var valid = S.validPunches(me.id);
      var shifts = S.shiftsOn(me.id, today);
      var rec = S.dayRecord(me.id, today);
      var flash = punchFlash;
      punchFlash = null;

      var punchCard = '<section class="punch-card">' +
        '<div class="punch-date">' + fmt.dateFull(today) + '</div>' +
        '<div class="punch-clock" data-clock data-date="' + today + '">' + T.hms(T.now()) + '</div>' +
        '<div class="punch-status"><span class="muted small">勤務ステータス</span>' + ui.status(status) + '</div>' +
        '<div data-punch-msg style="text-align:left">' + (flash ? ui.alert('ok',
          esc(flash.type) + 'を打刻しました(' + flash.at + ')<br>勤務ステータス: ' + esc(flash.from) + ' → <strong>' + esc(flash.to) + '</strong> ' + ui.uc('UC-305')) : '') + '</div>' +
        '<div class="punch-grid">' + PUNCH_BTNS.map(function (b) {
          var emph = valid.indexOf(b.type) >= 0;
          return '<button type="button" class="punch-btn' + (emph ? ' emph' + (b.out ? ' out' : '') : '') + '" data-punch="' + b.type + '">' +
            b.type + '<small>' + (emph ? '次の打刻' : '&nbsp;') + '</small></button>';
        }).join('') + '</div>' +
        '<p class="small muted" style="margin:8px 0 0">休憩開始・休憩終了 ' + ui.hokan(67) + ' 強調表示 = 現在の勤務ステータスで打刻できる種類 ' + ui.hokan(68) + '</p>' +
        '<div style="text-align:left;margin-top:12px"><div class="section-title" style="margin:0">本日の打刻 ' + ui.hokan(59) + '</div>' +
        punchLog(S.punchesOn(me.id, today)) + '</div>' +
        '</section>';

      var shiftBody = shifts.length ? shifts.map(function (s) {
        return '<div class="row" style="justify-content:space-between"><strong style="font-size:16px">' + fmt.range(s.start, s.end) + '</strong>' +
          ui.status(S.shiftState(s)) + '</div>' +
          '<div class="small muted">' + breakText(me, s.start, s.end) + ' ' + ui.hokan(28) + '</div>';
      }).join('<hr>') + (rec.flags.length ? '<div style="margin-top:6px">' + rec.flags.map(ui.status).join(' ') + ' ' + ui.hokan(58) + '</div>' : '')
        : '<p class="muted">本日のシフトはありません(出勤は打刻できません)' + ui.flowNote('UC-304 Ex-2') + '</p>';

      var hp = S.hopePeriod();
      var hopeBtn = '';
      if (hp.open) { // 受付期間外は非表示(UC-307 備考)
        var mine = S.hopeOf(me.id, hp.month);
        hopeBtn = '<div class="section"><a class="btn btn-primary btn-block" style="white-space:normal;text-align:center" href="#/emp/hope">' +
          esc(fmt.month(hp.month) + '分のシフト希望を提出(' + md(hp.to) + ' 締切)') + '</a>' +
          '<div class="small muted" style="margin-top:4px">' +
          (mine ? '提出済み(' + fmt.dt(mine.updatedAt) + ')。受付期間中は再提出で上書きできます ' + ui.hokan(82) : '未提出') + ' ' + ui.hokans([39, 75]) + '</div></div>';
      }

      var pend = S.employeePending(me.id);
      var stats = '<div class="mini-stats">' +
        stat(pend.corrections, '勤怠修正申請', 'emp/corrections') +
        stat(pend.shiftChanges, 'シフト日時変更申請', 'emp/shift-change') +
        stat(pend.hopes, 'シフト希望(日)', 'emp/hopes') + '</div>';

      var unread = S.notificationsOf(me.id).filter(function (n) { return !n.read; });
      var notices = unread.length ? '<ul class="notice-list">' + unread.slice(0, 2).map(function (n) {
        return '<li class="notice unread"><div class="notice-head"><strong>' + esc(n.title) + '</strong><span class="muted small">' + fmt.dt(n.at) + '</span></div>' +
          '<div class="notice-body">' + esc(n.body) + '</div></li>';
      }).join('') + '</ul>' : '<p class="muted small">未読の通知はありません</p>';

      var links = [
        ['emp/shifts', '登録シフト一覧', ui.uc('UC-308')],
        ['emp/attendance', '勤怠記録一覧', '勤怠修正申請(UC-306)の起点'],
        ['emp/corrections', '勤怠修正申請一覧', ui.uc('UC-310')],
        ['emp/hopes', 'シフト希望一覧', ui.uc('UC-311')],
      ];
      var shortcuts = '<ul class="list">' + links.map(function (l) {
        return '<li><a class="list-item" href="#/' + l[0] + '"><div class="list-item-main"><div class="list-item-title">' + l[1] + '</div>' +
          '<div class="list-item-sub">' + l[2] + '</div></div><span class="chev">›</span></a></li>';
      }).join('') + '</ul>';

      var rules = '<details class="card section"><summary style="padding:10px 14px;cursor:pointer;font-weight:600">打刻のルール</summary>' +
        '<div class="card-body" style="padding-top:0"><ul class="small" style="margin:0;padding-left:18px">' +
        '<li>勤務ステータスは当日の打刻だけで決まる。日付が変わると「退勤中」に戻り、前日の退勤漏れは勤怠修正申請の対象になる ' + ui.hokan(69) + '</li>' +
        '<li>出勤は 1 日 1 回(退勤後の再出勤は不可)。シフトがある日は時刻の制限なし ' + ui.hokan(70) + '</li>' +
        '<li>シフトがない日は出勤を打刻できない(UC-304 Ex-2)</li>' +
        '<li>「退勤中」には、当日まだ出勤していない状態も含む ' + ui.hokan(72) + '</li>' +
        '<li>休憩中は退勤できない(先に休憩終了を打刻) ' + ui.hokan(67) + '</li>' +
        '<li>打刻場所の制限なし ' + ui.hokan(71) + '</li>' +
        '<li>勤務ステータスは手動で変更できない(UC-305 備考)</li>' +
        '<li>誤って打刻した場合(退勤し忘れなど)は勤怠修正申請で直す(UC-304 備考)。<a href="#/emp/attendance">勤怠記録一覧</a></li>' +
        '</ul></div></details>';

      return ui.pageHead({ title: 'ホーム', ucs: ['UC-303', 'UC-304', 'UC-305'], hokan: [66] }) +
        punchCard +
        section('本日のシフト', '<div class="card card-body">' + shiftBody + '</div>') +
        hopeBtn +
        section('申請中の件数', stats) +
        section('未読の通知(' + unread.length + ' 件) <a class="small" href="#/emp/notifications" style="margin-left:auto;font-weight:400">すべて表示</a>', notices) +
        section('ショートカット ' + ui.hokan(76), shortcuts) +
        rules;
    },
    mount: function (el) {
      var me = S.me();
      stopClock();
      var clock = el.querySelector('[data-clock]');
      clockTimer = setInterval(function () {
        if (!document.body.contains(clock)) { stopClock(); return; }
        if (T.today() !== clock.dataset.date) { stopClock(); app.refresh(); return; } // 日付が変わると退勤中に戻る(#69)
        clock.textContent = T.hms(T.now());
      }, 1000);
      ui.on(el, 'click', '[data-punch]', function (e, b) {
        var type = b.dataset.punch;
        var r = S.punch(me.id, type);
        if (!r.ok) {
          el.querySelector('[data-punch-msg]').innerHTML = ui.alert('ng', esc(r.message) + ui.flowNote(r.uc) +
            (r.detail ? '<div class="small">' + esc(r.detail) + '</div>' : ''));
          return;
        }
        var at = r.punch.at.slice(11);
        punchFlash = { type: type, at: at, from: r.prevStatus, to: r.status };
        ui.toast(type + 'を打刻しました ' + at, 'ok', '勤務ステータス: ' + r.prevStatus + ' → ' + r.status + '(UC-305)');
        app.refresh();
      });
    },
  };

  // ---------------- 勤怠記録一覧(#48。UC-306 の起点) ----------------
  // 申請中があれば UC-306 Ex-2 を表示して遷移しない。false を返したら元の画面のまま
  function startCorrection(me, d, showMsg) {
    var p = S.pendingCorrection(me.id, d);
    if (p) {
      showMsg(esc(CORRECTION_DUP_MSG) + ui.flowNote('UC-306 Ex-2') + ui.hokan(80) +
        '<div style="margin-top:4px"><a href="' + app.href('emp/corrections', { id: p.id }) + '">申請中の内容を表示</a></div>');
      return false;
    }
    app.go('emp/correction', { date: d });
    return true;
  }
  function historyList(list) {
    if (!list.length) return '<p class="muted small">修正履歴はありません</p>';
    return '<ul class="notice-list">' + list.map(function (h) {
      return '<li class="notice"><div class="notice-head"><strong class="small">' + esc(h.via) + '</strong><span class="muted small">' + fmt.dt(h.at) + '</span></div>' +
        '<div class="small">出勤 ' + fmt.time(h.before.clockIn) + ' → ' + fmt.time(h.after.clockIn) +
        ' / 退勤 ' + fmt.time(h.before.clockOut) + ' → ' + fmt.time(h.after.clockOut) +
        ' / 休憩 ' + minText(h.before.breakMinutes) + ' → ' + minText(h.after.breakMinutes) + '</div>' +
        '<div class="small">理由: ' + esc(h.reason) + '</div>' +
        '<div class="small muted">処理者: ' + esc(S.userName(h.by)) + '</div></li>';
    }).join('') + '</ul>';
  }
  function dayModal(me, d) {
    var r = S.dayRecord(me.id, d);
    var range = S.correctionRange();
    var pending = S.pendingCorrection(me.id, d);
    var t = r.corrected ? fmt.time : fmt.timeSec;
    var body = '<h3 class="section-title">シフト</h3><p style="margin-top:0">' + shiftsText(r.shifts) + '</p>' +
      '<h3 class="section-title">打刻 ' + ui.hokan(59) + '</h3>' + punchLog(r.punches) +
      '<h3 class="section-title" style="margin-top:14px">勤怠記録(反映中の値) ' + (r.corrected ? ui.status('修正済み') : '') + '</h3>' +
      '<dl class="kv">' +
      '<dt>出勤</dt><dd>' + t(r.clockIn) + '</dd>' +
      '<dt>退勤</dt><dd>' + t(r.clockOut) + '</dd>' +
      '<dt>休憩</dt><dd>' + (r.breakMinutes === null ? '—' : r.breakMinutes + ' 分(' + esc(r.breakSource || '') + ')') + ' ' + ui.hokan(29) + '</dd>' +
      '<dt>勤務時間</dt><dd>' + fmt.durJa(r.workMinutes) + '</dd>' +
      '<dt>状態</dt><dd>' + (r.flags.length ? r.flags.map(ui.status).join(' ') : '—') + '</dd>' +
      '</dl>' +
      (pending ? '<div style="margin-top:12px">' + ui.alert('warn', '申請中の勤怠修正申請があります(' + fmt.dt(pending.createdAt) + ' 申請)。' +
        '<a href="' + app.href('emp/corrections', { id: pending.id }) + '">申請内容を表示</a>') + '</div>' : '') +
      '<h3 class="section-title" style="margin-top:14px">修正履歴 ' + ui.hokan(54) + '</h3>' + historyList(S.history(me.id, d));
    var actions = [{ label: '閉じる', kind: 'secondary' }];
    if (d >= range.from && d <= range.to) {
      actions.push({ label: '勤怠修正申請', kind: 'primary', onClick: function (m) {
        return startCorrection(me, d, function (html) { m.setError(html); });
      } });
    }
    modal({ title: fmt.date(d) + ' の勤怠記録', body: body, actions: actions });
  }

  var STICKY = 'position:sticky;left:0;z-index:1;'; // 横スクロール時も日付列を表示

  K.views['emp/attendance'] = {
    role: '従業員',
    title: '勤怠記録一覧',
    tab: 'attendance',
    render: function (params) {
      var me = S.me();
      var ym = monthOf(params);
      var today = T.today();
      var range = S.correctionRange();
      var recs = T.daysOf(ym).map(function (d) { return S.dayRecord(me.id, d); });
      var tot = { days: 0, work: 0, ot: 0 };
      recs.forEach(function (r) {
        if (r.date > today) return;
        if (r.workMinutes !== null) { tot.days++; tot.work += r.workMinutes; }
        tot.ot += r.overtimeMinutes;
      });
      var rows = recs.map(function (r) {
        var d = r.date;
        var future = d > today;
        var pending = S.pendingCorrection(me.id, d);
        var canReq = !future && d >= range.from && d <= range.to;
        var badges = r.flags.map(ui.status);
        if (r.corrected) badges.push(ui.status('修正済み'));
        if (pending) badges.push(ui.badge('修正申請中', 'warn'));
        var bg = d === today ? 'var(--today)' : '#fff';
        return '<tr class="' + (future ? 'muted-row' : 'clickable') + '"' + (future ? '' : ' data-day="' + d + '"') + ' style="background:' + bg + '">' +
          '<td class="nowrap" style="' + STICKY + 'background:' + bg + '"><span style="' + dayColor(d) + '">' + Number(d.slice(8)) + '(' + fmt.wd(d) + ')</span></td>' +
          '<td class="nowrap">' + (r.shifts.length ? r.shifts.map(function (s) { return s.start + '〜<br>' + s.end; }).join('<br>') : '<span class="muted">—</span>') + '</td>' +
          '<td class="num">' + fmt.time(r.clockIn) + '</td>' +
          '<td class="num">' + fmt.time(r.clockOut) + '</td>' +
          '<td class="nowrap">' + (r.breakMinutes === null ? '—' : r.breakMinutes + '分<div class="small muted">' + esc(r.breakSource || '') + '</div>') + '</td>' +
          '<td class="num">' + fmt.dur(r.workMinutes) + '</td>' +
          '<td>' + badges.join(' ') + '</td>' +
          '<td>' + (canReq ? '<button type="button" class="btn btn-secondary btn-sm" data-act="correct" data-date="' + d + '">修正申請</button>' : '') + '</td>' +
          '</tr>';
      }).join('');
      return ui.pageHead({ title: '勤怠記録一覧', ucs: ['UC-306'], hokan: [48],
        lead: 'UC-306 の起点となる勤怠記録一覧画面(対応 UC なし)。行を押すと日別の詳細を表示' }) +
        monthNav('emp/attendance', ym) +
        '<div class="mini-stats">' + stat(tot.days, '勤務日数') + stat(fmt.dur(tot.work), '勤務時間') + stat(fmt.dur(tot.ot), '残業(1 日 8 時間超)') + '</div>' +
        '<p class="small muted">' + (ym === T.thisMonth() ? '本日までの合計' : '月の合計') + ' ' + ui.hokan(56) + '</p>' +
        '<div data-msg></div>' +
        '<div class="table-wrap"><table class="table table-sm"><thead><tr>' +
        '<th style="' + STICKY + '">日付</th><th>シフト</th><th>出勤</th><th>退勤</th><th>休憩 ' + ui.hokan(29) + '</th><th>勤務</th><th>状態 ' + ui.hokan(58) + '</th><th>操作</th>' +
        '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
        '<ul class="small muted" style="padding-left:18px">' +
        '<li>休憩: 打刻 = 休憩打刻の実績、自動 = 休憩打刻がない日に管理者設定の休憩時間で控除、修正 = 勤怠修正後の値</li>' +
        '<li>修正申請できる対象日: ' + fmt.date(range.from) + '〜' + fmt.date(range.to) + ' ' + ui.hokan(50) + '</li>' +
        '<li>勤怠修正申請は、勤怠管理者が承認するまで勤怠記録に反映されない(UC-306 備考)</li>' +
        '</ul>';
    },
    mount: function (el) {
      var me = S.me();
      var box = el.querySelector('[data-msg]');
      ui.on(el, 'click', '[data-act="correct"]', function (e, b) {
        startCorrection(me, b.dataset.date, function (html) {
          box.innerHTML = ui.alert('ng', html);
          box.scrollIntoView({ block: 'nearest' });
        });
      });
      ui.on(el, 'click', 'tr[data-day]', function (e, tr) {
        if (e.target.closest('[data-act]')) return;
        dayModal(me, tr.dataset.day);
      });
    },
  };

  // ---------------- 勤怠修正申請(UC-306) ----------------
  function correctionCtx(me, params) {
    var back = '<p><a href="#/emp/attendance">勤怠記録一覧へ戻る</a></p>';
    if (params.id) {
      var c = S.correction(params.id);
      if (!c || c.userId !== me.id) return { error: errBox('対象の申請が見つかりません') + back };
      if (c.status !== '申請中') {
        return { error: errBox('申請中の申請のみ編集できます') + '<p><a href="' + app.href('emp/corrections', { id: c.id }) + '">勤怠修正申請一覧へ戻る</a></p>' };
      }
      return { edit: true, c: c, date: c.date };
    }
    var d = params.date;
    var range = S.correctionRange();
    if (!T.validDate(d)) return { error: errBox('対象日を選択してください') + back };
    if (d > range.to) return { error: errBox('未来の日付は申請できません') + back };
    if (d < range.from) return { error: errBox(fmt.date(range.from) + ' 以降の日付を選択してください') + ui.hokan(50) + back };
    var p = S.pendingCorrection(me.id, d);
    if (p) {
      return { error: errBox(CORRECTION_DUP_MSG, 'UC-306 Ex-2') +
        '<p><a href="' + app.href('emp/corrections', { id: p.id }) + '">申請中の内容を表示</a></p>' + back };
    }
    return { edit: false, date: d };
  }

  K.views['emp/correction'] = {
    role: '従業員',
    title: '勤怠修正申請',
    tab: 'attendance',
    render: function (params) {
      var me = S.me();
      var ctx = correctionCtx(me, params);
      var head = ui.pageHead({ title: '勤怠修正申請', ucs: ['UC-306'], hokan: [49],
        lead: ctx.edit ? '申請中の勤怠修正申請を編集して上書きします(UC-306 Alt-1)' : '選んだ日の勤怠記録の修正を勤怠管理者に申請します' });
      if (ctx.error) return head + ctx.error;
      var range = S.correctionRange();
      var r = S.dayRecord(me.id, ctx.date);
      var t = r.corrected ? fmt.time : fmt.timeSec;
      var sh = r.shifts;
      var init = ctx.edit
        ? { clockIn: ctx.c.after.clockIn, clockOut: ctx.c.after.clockOut, breakMinutes: ctx.c.after.breakMinutes, reason: ctx.c.reason }
        : { clockIn: r.clockIn ? r.clockIn.slice(0, 5) : '', clockOut: r.clockOut ? r.clockOut.slice(0, 5) : '',
          breakMinutes: r.breakMinutes === null ? '' : r.breakMinutes, reason: '' };
      var current = card('現在の勤怠記録(修正前) ' + (r.corrected ? ui.status('修正済み') : ''),
        '<dl class="kv">' +
        '<dt>対象日</dt><dd>' + dayLabel(ctx.date) + '</dd>' +
        '<dt>シフト</dt><dd>' + shiftsText(sh) + '</dd>' +
        '<dt>出勤</dt><dd>' + t(r.clockIn) + '</dd>' +
        '<dt>退勤</dt><dd>' + t(r.clockOut) + '</dd>' +
        '<dt>休憩</dt><dd>' + (r.breakMinutes === null ? '—' : r.breakMinutes + ' 分(' + esc(r.breakSource || '') + ')') + '</dd>' +
        '<dt>状態</dt><dd>' + (r.flags.length ? r.flags.map(ui.status).join(' ') : '—') + '</dd>' +
        '</dl>' +
        (ctx.edit ? '<p class="small muted" style="margin-bottom:0">申請日時 ' + fmt.dt(ctx.c.createdAt) +
          (ctx.c.updatedAt !== ctx.c.createdAt ? ' / 更新日時 ' + fmt.dt(ctx.c.updatedAt) : '') + '</p>' : ''));
      var cancel = ctx.edit ? app.href('emp/corrections', { id: ctx.c.id }) : app.href('emp/attendance', { month: T.month(ctx.date) });
      var form = '<form class="form card card-body" data-form novalidate>' +
        '<h2 class="section-title" style="margin:0">修正後の勤怠記録 ' + ui.hokan(81) + '</h2>' +
        '<span class="field-error" data-err="date" hidden></span>' +
        '<div class="form-row">' +
        ui.field('出勤時刻', '<input type="time" name="clockIn" value="' + esc(init.clockIn || '') + '">', 'clockIn', sh.length ? 'シフト開始 ' + sh[0].start : 'シフトなし') +
        ui.field('退勤時刻', '<input type="time" name="clockOut" value="' + esc(init.clockOut || '') + '">', 'clockOut', sh.length ? 'シフト終了 ' + sh[sh.length - 1].end : '') +
        '</div>' +
        ui.field('休憩時間(分)', '<input type="number" name="breakMinutes" min="0" step="1" inputmode="numeric" value="' + esc(init.breakMinutes) + '">', 'breakMinutes',
          '休憩の合計時間。休憩打刻ごとの修正は対象外') +
        ui.field('申請理由 ' + ui.badge('必須', 'ng'), '<textarea name="reason" placeholder="例: 閉店作業のあと退勤の打刻を忘れました">' + esc(init.reason) + '</textarea>', 'reason',
          '新規・編集とも必須(UC-306 備考)') +
        '<div class="form-error" data-form-error hidden></div>' +
        '<div class="row"><button type="submit" class="btn btn-primary">' + (ctx.edit ? '更新して送信' : '送信') + '</button>' +
        '<a class="btn btn-secondary" href="' + cancel + '">キャンセル</a></div>' +
        '</form>';
      return head + current +
        '<div style="margin-top:14px">' + ui.alert('info', '送信した勤怠修正申請は、勤怠管理者が承認するまで勤怠記録には反映されません(UC-306 備考)。<br>' +
          '申請できる対象日: ' + fmt.date(range.from) + '〜' + fmt.date(range.to) + ' ' + ui.hokan(50)) + '</div>' +
        form;
    },
    mount: function (el, params) {
      var me = S.me();
      var ctx = correctionCtx(me, params);
      if (ctx.error) return;
      var form = el.querySelector('[data-form]');
      var errEl = form.querySelector('[data-form-error]');
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var v = ui.values(form);
        var input = { date: ctx.date, clockIn: v.clockIn, clockOut: v.clockOut, breakMinutes: v.breakMinutes, reason: v.reason };
        var r = ctx.edit ? S.editCorrection(me.id, ctx.c.id, input) : S.submitCorrection(me.id, input);
        if (!r.ok) {
          // 入力は保持したまま(UC-306 Ex-1)
          ui.showErrors(form, r.errors || {});
          var uc = { invalid: 'UC-306 Ex-1', duplicate: 'UC-306 Ex-2', fault: '通信エラー(UC-306 に記載なし)' }[r.code];
          var p = r.code === 'duplicate' ? S.pendingCorrection(me.id, ctx.date) : null;
          showFormError(errEl, esc(r.message) + (uc ? ui.flowNote(uc) : '') + (r.code === 'fault' ? ui.hokan(79) : '') +
            (p ? '<div><a href="' + app.href('emp/corrections', { id: p.id }) + '">申請中の内容を表示</a></div>' : ''));
          return;
        }
        ui.toast(ctx.edit ? '勤怠修正申請を更新しました(申請中のまま)' : '勤怠修正申請を送信しました');
        app.go('emp/corrections', { id: r.request.id });
      });
    },
  };

  // ---------------- 勤怠修正申請一覧(UC-310) ----------------
  function diffRow(label, a, b) {
    return '<tr><th>' + label + '</th><td>' + a + '</td><td class="' + (a !== b ? 'changed' : '') + '">' + b + '</td></tr>';
  }
  function withdrawCorrection(me, c) {
    ui.confirm({
      title: '勤怠修正申請の取り下げ',
      body: '<p>' + fmt.date(c.date) + ' の勤怠修正申請を取り下げますか?</p>' +
        '<p class="small muted">取り下げた申請は状態「取下げ」で一覧に残ります ' + ui.hokan(6) + '</p>',
      okLabel: '取り下げる',
      okKind: 'danger',
      onOk: function (m) {
        var r = S.withdrawCorrection(me.id, c.id);
        if (!r.ok) { m.setError(esc(r.message)); return false; }
        ui.toast('勤怠修正申請を取り下げました');
        app.refresh();
      },
    });
  }
  function correctionModal(me, id) {
    var c = S.correction(id);
    if (!c || c.userId !== me.id) return;
    var b = c.before, a = c.after;
    var done = c.status === '承認済' || c.status === '却下';
    var body = '<div class="row" style="margin-bottom:8px">' + ui.status(c.status) + '<span class="small">対象日 ' + dayLabel(c.date) + '</span></div>' +
      '<table class="table table-sm diff"><thead><tr><th>項目</th><th>修正前</th><th>修正後</th></tr></thead><tbody>' +
      diffRow('出勤', fmt.time(b.clockIn), fmt.time(a.clockIn)) +
      diffRow('退勤', fmt.time(b.clockOut), fmt.time(a.clockOut)) +
      diffRow('休憩', minText(b.breakMinutes), minText(a.breakMinutes)) +
      '</tbody></table>' +
      '<dl class="kv" style="margin-top:12px">' +
      '<dt>申請理由</dt><dd>' + esc(c.reason) + '</dd>' +
      '<dt>申請日時</dt><dd>' + fmt.dt(c.createdAt) + '</dd>' +
      (c.updatedAt && c.updatedAt !== c.createdAt ? '<dt>更新日時</dt><dd>' + fmt.dt(c.updatedAt) + '</dd>' : '') +
      (c.status === '取下げ' ? '<dt>取下げ日時</dt><dd>' + fmt.dt(c.processedAt) + '</dd>' : '') +
      (done ? '<dt>処理日時</dt><dd>' + fmt.dt(c.processedAt) + '</dd><dt>処理者</dt><dd>' + esc(S.userName(c.processedBy)) + '</dd>' : '') +
      '</dl>' +
      '<h3 class="section-title" style="margin-top:12px">管理者からのコメント(却下理由) ' + ui.hokan(51) + '</h3>' +
      '<p style="margin-top:0">' + (c.rejectReason ? esc(c.rejectReason) : '<span class="muted">—</span>') + '</p>' +
      (c.status === '申請中' ? '<p class="small muted">勤怠管理者が承認するまで勤怠記録には反映されません。申請中の間は編集・取り下げできます</p>' : '') +
      (c.status === '承認済' ? '<p class="small muted">勤怠記録に反映済み</p>' : '');
    var actions = [{ label: '閉じる', kind: 'secondary' }];
    if (c.status === '申請中') {
      actions.push({ label: '取り下げ', kind: 'danger', onClick: function () { withdrawCorrection(me, c); } });
      actions.push({ label: '編集', kind: 'primary', onClick: function () { app.go('emp/correction', { id: c.id }); } }); // UC-306 Alt-1
    }
    modal({ title: '勤怠修正申請の詳細', body: body, actions: actions });
  }

  K.views['emp/corrections'] = {
    role: '従業員',
    title: '勤怠修正申請一覧',
    tab: 'requests',
    render: function (params) {
      var me = S.me();
      var head = ui.pageHead({ title: '勤怠修正申請一覧', ucs: ['UC-310'], hokan: [5], lead: '自分が送信した勤怠修正申請。選ぶと詳細を表示' });
      if (S.fault()) return head + errBox('申請情報の取得に失敗しました。画面を読み込み直してください', 'UC-310 Ex-2');
      var list = S.correctionsOf(me.id);
      if (!list.length) return head + emptyNote('現在提出済みの勤怠修正申請はありません', 'UC-310 Ex-1');
      return head +
        '<ul class="list">' + list.map(function (c) {
          return '<li><button type="button" class="list-item" data-id="' + c.id + '"' + (c.id === params.id ? ' style="background:var(--primary-weak)"' : '') + '>' +
            '<div class="list-item-main"><div class="list-item-title">申請日 ' + fmt.dt(c.createdAt) + '</div>' +
            '<div class="list-item-sub">対象日 ' + fmt.date(c.date) + '</div></div>' +
            '<div class="list-item-side">' + ui.status(c.status) + '</div><span class="chev">›</span></button></li>';
        }).join('') + '</ul>' +
        '<p class="small muted">申請中の申請は詳細から編集・取り下げできます ' + ui.hokan(6) + '</p>';
    },
    mount: function (el, params) {
      var me = S.me();
      ui.on(el, 'click', '[data-id]', function (e, b) { correctionModal(me, b.dataset.id); });
      if (params.id && !S.fault()) correctionModal(me, params.id);
    },
  };

  // ---------------- 登録シフト一覧(UC-308) ----------------
  function shiftModal(me, date) {
    var list = S.shiftsOn(me.id, date);
    if (!list.length) return;
    var actions = [{ label: '閉じる', kind: 'secondary' }];
    var body = list.map(function (s) {
      var pend = S.pendingShiftChange(s.id);
      var can = S.canRequestShiftChange(s);
      if (can && !pend) {
        actions.push({ label: 'シフト日時変更申請' + (list.length > 1 ? '(' + s.start + '〜)' : ''), kind: 'primary',
          onClick: function () { app.go('emp/shift-change', { shiftId: s.id }); } });
      }
      return '<dl class="kv">' +
        '<dt>日付</dt><dd>' + dayLabel(s.date) + '</dd>' +
        '<dt>時間</dt><dd>' + fmt.range(s.start, s.end) + '</dd>' +
        '<dt>状態</dt><dd>' + ui.status(S.shiftState(s)) + ' ' + ui.hokan(35) + '</dd>' +
        '<dt>休憩</dt><dd>' + breakText(me, s.start, s.end) + ' ' + ui.hokan(28) + '</dd>' +
        '<dt>登録元</dt><dd>' + (s.source === 'シフト希望' ? 'シフト希望の承認(UC-207)' : '勤怠管理者による登録(UC-203)') + '</dd>' +
        '</dl>' +
        (pend ? '<div style="margin-top:10px">' + ui.alert('warn', ui.status('申請中') + ' ' + fmt.date(pend.after.date) + ' ' + fmt.range(pend.after.start, pend.after.end) +
          ' へのシフト日時変更申請を送信済み。<a href="#/emp/shift-change">送信した申請を表示</a>') + '</div>' : '') +
        (!can ? '<p class="small muted">当日・過去のシフトはシフト日時変更申請の対象外 ' + ui.hokan(36) + '</p>' : '');
    }).join('<hr>');
    modal({ title: 'シフトの詳細', body: body, actions: actions });
  }

  K.views['emp/shifts'] = {
    role: '従業員',
    title: '登録シフト一覧',
    tab: 'shifts',
    render: function (params) {
      var me = S.me();
      var ym = monthOf(params);
      var mineOnly = params.mine === '1';
      var head = ui.pageHead({ title: '登録シフト一覧', ucs: ['UC-308'], hokan: [73, 74, 34],
        lead: '所属店舗の確定シフトを月単位で表示。自分のシフトを押すと詳細とシフト日時変更申請' });
      if (!me.storeId) return head + ui.alert('warn', '所属店舗が設定されていないため、登録シフトを表示できません(所属店舗は管理者が設定: UC-110)');
      if (S.fault()) return head + errBox('シフト情報の取得に失敗しました。画面を読み込み直してください', 'UC-308 Ex-2');
      var nav = monthNav('emp/shifts', ym, { mine: mineOnly ? '1' : '' });
      if (!S.monthPublished(me.storeId, ym)) return head + nav + ui.alert('info', esc('該当月の確定シフトはまだ公開されていません') + ui.flowNote('UC-308 Ex-1'));

      var days = T.daysOf(ym);
      var today = T.today();
      var cols = mineOnly ? [me] : [me].concat(S.storeEmployees(me.storeId).filter(function (u) { return u.id !== me.id; }));
      var byKey = {};
      S.storeShifts(me.storeId, days[0], days[days.length - 1]).forEach(function (s) {
        var k = s.userId + '|' + s.date;
        (byKey[k] = byKey[k] || []).push(s);
      });
      var myShifts = S.shiftsOf(me.id, days[0], days[days.length - 1]);
      var myMin = myShifts.reduce(function (sum, s) { return sum + T.toMin(s.end) - T.toMin(s.start); }, 0);

      var thead = '<tr><th class="sg-name" style="min-width:52px">日付</th>' + cols.map(function (u) {
        var self = u.id === me.id;
        return '<th title="' + esc(u.name) + '"' + (self ? ' style="color:var(--primary)"' : '') + '>' + esc(u.name.split(' ')[0]) +
          (self ? '<small style="display:block;font-weight:400">自分</small>' : '') + '</th>';
      }).join('') + '</tr>';
      var tbody = days.map(function (d) {
        var w = T.dow(d);
        var isToday = d === today;
        var dcls = ['sg-name', 'sg-day'];
        if (T.isOffDay(d)) dcls.push('offday');
        if (T.holiday(d)) dcls.push('holiday');
        else if (w === 0) dcls.push('sun');
        else if (w === 6) dcls.push('sat');
        if (isToday) dcls.push('today');
        return '<tr><th class="' + dcls.join(' ') + '" style="min-width:52px"' + (T.holiday(d) ? ' title="' + esc(T.holiday(d)) + '"' : '') + '>' +
          Number(d.slice(8)) + '<small>' + fmt.wd(d) + (isToday ? '・本日' : '') + '</small></th>' +
          cols.map(function (u) {
            var list = byKey[u.id + '|' + d] || [];
            var self = u.id === me.id;
            var cls = [];
            if (self) cls.push('me');
            if (self && list.length) cls.push('sg-cell');
            if (isToday) cls.push('today');
            var inner = list.map(function (s) {
              var pend = self && S.pendingShiftChange(s.id);
              return '<span class="sg-shift' + (self ? ' me' : (d < today ? ' worked' : '')) + '"' + (self && d < today ? ' style="opacity:.6"' : '') + '>' +
                s.start + '<br>' + s.end + '</span>' + (pend ? '<span class="sg-hope">変更申請中</span>' : '');
            }).join('');
            return '<td class="' + cls.join(' ') + '"' + (self && list.length ? ' data-date="' + d + '"' : '') + ' style="vertical-align:middle;height:46px">' + inner + '</td>';
          }).join('') + '</tr>';
      }).join('');

      return head + nav +
        '<div class="row" style="justify-content:space-between;margin-bottom:6px">' +
        '<label style="display:inline-flex;gap:6px;align-items:center;cursor:pointer"><input type="checkbox" data-act="mine"' + (mineOnly ? ' checked' : '') + '> 自分のみ表示</label>' +
        '<span class="small muted">自分のシフト ' + myShifts.length + ' 件・計 ' + fmt.durJa(myMin) + '</span></div>' +
        '<div class="table-wrap" style="max-height:520px"><table class="shift-grid"><thead>' + thead + '</thead><tbody>' + tbody + '</tbody></table></div>' +
        '<div class="legend"><span class="sg-shift me">自分</span><span class="sg-shift">他の従業員</span><span class="sg-shift worked">勤務済み</span>' +
        '<span class="sg-hope" style="display:inline">変更申請中</span></div>' +
        '<p class="small muted">表示は所属店舗(' + esc(S.storeName(me.storeId)) + ')の従業員のみ。登録されたシフトは確定・公開済みとして表示</p>';
    },
    mount: function (el, params) {
      var me = S.me();
      ui.on(el, 'change', '[data-act="mine"]', function (e, cb) { app.go('emp/shifts', { month: params.month, mine: cb.checked ? '1' : '' }); });
      ui.on(el, 'click', 'td[data-date]', function (e, td) { shiftModal(me, td.dataset.date); });
    },
  };

  // ---------------- シフト日時変更申請(UC-309。doc なし #62) ----------------
  function shiftChangeCtx(me, params) {
    if (!params.shiftId) return { pick: true };
    var s = S.shift(params.shiftId);
    if (!s || s.userId !== me.id) return { error: errBox('対象のシフトが見つかりません') };
    if (!S.canRequestShiftChange(s)) return { error: errBox('翌日以降のシフトのみ変更を申請できます') + ui.hokan(36) };
    if (S.pendingShiftChange(s.id)) {
      return { error: ui.alert('warn', 'このシフトには申請中のシフト日時変更申請があります。内容を変える場合は「送信した申請」から取り下げてから送信してください') };
    }
    return { shift: s };
  }
  function shiftPicker(me) {
    var list = S.futureShifts(me.id);
    return ui.alert('info', '登録シフト一覧から自分のシフトを選んで申請します。<a href="#/emp/shifts">登録シフト一覧へ</a>') +
      '<h2 class="section-title">翌日以降の自分のシフト ' + ui.hokan(36) + '</h2>' +
      (list.length ? '<ul class="list">' + list.slice(0, 10).map(function (s) {
        var p = S.pendingShiftChange(s.id);
        var inner = '<div class="list-item-main"><div class="list-item-title">' + dayLabel(s.date) + ' ' + fmt.range(s.start, s.end) + '</div></div>' +
          (p ? ui.badge('変更申請中', 'warn') : '<span class="chev">›</span>');
        return '<li>' + (p ? '<div class="list-item" style="cursor:default">' + inner + '</div>'
          : '<a class="list-item" href="' + app.href('emp/shift-change', { shiftId: s.id }) + '">' + inner + '</a>') + '</li>';
      }).join('') + '</ul>' + (list.length > 10 ? '<p class="small muted">11 件目以降は登録シフト一覧から選択</p>' : '')
        : ui.empty('翌日以降のシフトはありません'));
  }
  function shiftChangeForm(s) {
    return card('変更前のシフト', dayLabel(s.date) + ' ' + fmt.range(s.start, s.end)) +
      '<form class="form card card-body" data-form novalidate>' +
      '<h2 class="section-title" style="margin:0">変更希望の日時</h2>' +
      ui.field('変更希望の日付', '<input type="date" name="date" min="' + T.addDays(T.today(), 1) + '" value="' + s.date + '">', 'date', '翌日以降') +
      '<div class="form-row">' +
      ui.field('開始時刻', '<input type="time" name="start" value="' + s.start + '">', 'start') +
      ui.field('終了時刻', '<input type="time" name="end" value="' + s.end + '">', 'end') +
      '</div>' +
      '<div data-av></div>' +
      ui.field('申請理由 ' + ui.badge('必須', 'ng'), '<textarea name="reason" placeholder="例: 学校の試験と重なったため、翌日に変更したいです"></textarea>', 'reason') +
      '<div class="form-error" data-form-error hidden></div>' +
      '<div class="row"><button type="submit" class="btn btn-primary">送信</button>' +
      '<a class="btn btn-secondary" href="' + app.href('emp/shifts', { month: T.month(s.date) }) + '">キャンセル</a></div>' +
      '</form>';
  }
  function sentShiftChanges(me) {
    var list = S.shiftChangesOf(me.id);
    return '<div class="section"><h2 class="section-title">送信した申請 ' + ui.hokan(63) + '</h2>' +
      (list.length ? '<ul class="list">' + list.map(function (c) {
        return '<li style="padding:10px 12px">' +
          '<div class="row" style="justify-content:space-between">' + ui.status(c.status) + '<span class="small muted">申請 ' + fmt.dt(c.createdAt) + '</span></div>' +
          '<div style="margin-top:4px">' + fmt.date(c.before.date) + ' ' + fmt.range(c.before.start, c.before.end) +
          '<br>→ <strong>' + fmt.date(c.after.date) + ' ' + fmt.range(c.after.start, c.after.end) + '</strong></div>' +
          '<div class="small">申請理由: ' + esc(c.reason) + '</div>' +
          (c.rejectReason ? '<div class="small" style="color:var(--ng)">却下理由: ' + esc(c.rejectReason) + '</div>' : '') +
          (c.processedAt ? '<div class="small muted">' + (c.status === '取下げ' ? '取下げ ' : '処理 ') + fmt.dt(c.processedAt) +
            (c.processedBy ? '(' + esc(S.userName(c.processedBy)) + ')' : '') + (c.status === '承認済' ? '・登録シフトに反映済み' : '') + '</div>' : '') +
          (c.status === '申請中' ? '<div style="margin-top:6px"><button type="button" class="btn btn-secondary btn-sm" data-withdraw="' + c.id + '">取り下げ</button> ' + ui.hokan(6) + '</div>' : '') +
          '</li>';
      }).join('') + '</ul>' : ui.empty('送信したシフト日時変更申請はありません')) +
      '<p class="small muted">シフトの取りやめ(欠勤の連絡)はこの申請では扱わない ' + ui.hokan(65) + '</p></div>';
  }
  function withdrawShiftChange(me, id) {
    var c = S.shiftChange(id);
    if (!c) return;
    ui.confirm({
      title: 'シフト日時変更申請の取り下げ',
      body: '<p>' + fmt.date(c.before.date) + ' ' + fmt.range(c.before.start, c.before.end) + ' のシフト日時変更申請を取り下げますか?</p>' +
        '<p class="small muted">取り下げた申請は状態「取下げ」で一覧に残ります ' + ui.hokan(6) + '</p>',
      okLabel: '取り下げる',
      okKind: 'danger',
      onOk: function (m) {
        var r = S.withdrawShiftChange(me.id, id);
        if (!r.ok) { m.setError(esc(r.message)); return false; }
        ui.toast('シフト日時変更申請を取り下げました');
        app.refresh();
      },
    });
  }

  K.views['emp/shift-change'] = {
    role: '従業員',
    title: 'シフト日時変更申請',
    tab: 'shifts',
    render: function (params) {
      var me = S.me();
      var ctx = shiftChangeCtx(me, params);
      var head = ui.pageHead({ title: 'シフト日時変更申請', ucs: ['UC-309'], hokan: [62],
        lead: '登録シフトの日時の変更を勤怠管理者に申請します(UC-309 の詳細 doc なし)' });
      var main = ctx.pick ? shiftPicker(me) : (ctx.error ? ctx.error + '<p><a href="#/emp/shift-change">シフトを選び直す</a></p>' : shiftChangeForm(ctx.shift));
      return head + main + sentShiftChanges(me);
    },
    mount: function (el, params) {
      var me = S.me();
      ui.on(el, 'click', '[data-withdraw]', function (e, b) { withdrawShiftChange(me, b.dataset.withdraw); });
      var ctx = shiftChangeCtx(me, params);
      if (!ctx.shift) return;
      var s = ctx.shift;
      var form = el.querySelector('[data-form]');
      var avBox = form.querySelector('[data-av]');
      var errEl = form.querySelector('[data-form-error]');
      // 勤務可能時間の参考表示と注意(送信は可)
      function updateAv() {
        var v = ui.values(form);
        if (!T.validDate(v.date)) { avBox.innerHTML = ''; return; }
        var html = '<div class="small">勤務可能時間(' + fmt.date(v.date) + '): ' + esc(S.availabilityText(me, v.date)) + ' ' + ui.hokan(78) + '</div>';
        if (T.validTime(v.start) && T.validTime(v.end) && T.toMin(v.start) < T.toMin(v.end)) {
          if (S.inAvailability(me, v.date, v.start, v.end) === false) {
            html += ui.alert('warn', '勤務可能時間の範囲外です。送信はできますが、勤怠管理者は範囲外のまま承認できません(UC-215 Alt-4) ' + ui.hokan(78));
          }
          var ov = S.shiftChangeOverlaps({ userId: me.id, shiftId: s.id, after: { date: v.date, start: v.start, end: v.end } });
          if (ov.length) {
            html += ui.alert('warn', '重なる自分のシフトがあります: ' + ov.map(function (x) { return fmt.range(x.start, x.end); }).join('、') + '(送信は可)');
          }
        }
        avBox.innerHTML = html;
      }
      form.addEventListener('input', updateAv);
      form.addEventListener('change', updateAv);
      updateAv();
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var v = ui.values(form);
        var r = S.submitShiftChange(me.id, s.id, { date: v.date, start: v.start, end: v.end, reason: v.reason });
        if (!r.ok) {
          ui.showErrors(form, r.errors || {});
          showFormError(errEl, esc(r.message) + ui.flowNote(r.code === 'fault' ? '通信エラー(UC-309 doc なし)' : 'UC-309(doc なし #62)') + (r.code === 'fault' ? ui.hokan(79) : ''));
          return;
        }
        ui.toast('シフト日時変更申請を送信しました');
        if (r.warnings && r.warnings.length) {
          ui.toast('変更希望の日時に重なる自分のシフトがあります', 'warn', r.warnings.map(function (x) { return fmt.date(x.date) + ' ' + fmt.range(x.start, x.end); }).join('、'));
        }
        app.go('emp/shift-change');
      });
    },
  };

  // ---------------- シフト希望提出(UC-307) ----------------
  K.views['emp/hope'] = {
    role: '従業員',
    title: 'シフト希望提出',
    tab: 'requests',
    render: function () {
      var me = S.me();
      var p = S.hopePeriod();
      var head = ui.pageHead({ title: 'シフト希望提出', ucs: ['UC-307'], hokan: [40],
        lead: '対象月 ' + fmt.month(p.month) + '、受付期間 ' + fmt.date(p.from) + '〜' + fmt.date(p.to) + ' ' + ui.hokan(39) });
      if (!p.open) return head + ui.alert('warn', 'シフト希望の受付期間外です');
      var h = S.hopeOf(me.id, p.month);
      var rows = T.daysOf(p.month).map(function (d) {
        var x = h && h.days[d];
        var locked = !!x && (x.status === '承認済' || x.status === '却下');
        var kind = x ? x.kind : '';
        var tdis = locked || kind !== '時間指定' ? ' disabled' : '';
        return '<tr data-day="' + d + '"' + (locked ? ' class="locked"' : '') + '>' +
          '<td class="nowrap" style="' + dayColor(d) + '">' + md(d) + '<br><small>' + fmt.wd(d) + (T.holiday(d) ? '・祝' : '') + '</small></td>' +
          '<td><select name="' + d + '" data-kind' + (locked ? ' disabled' : '') + '>' + ui.options(KIND_OPTS, kind) + '</select>' +
          (x && x.status ? '<div style="margin-top:2px">' + ui.status(x.status) + '</div>' : '') + '</td>' +
          '<td><div class="hope-times" style="flex-direction:column;align-items:stretch">' +
          '<input type="time" name="' + d + '_s" aria-label="開始時刻" value="' + esc(x ? x.start : '') + '"' + tdis + '>' +
          '<input type="time" name="' + d + '_e" aria-label="終了時刻" value="' + esc(x ? x.end : '') + '"' + tdis + '>' +
          '</div><span class="field-error" data-err="' + d + '" hidden></span></td>' +
          '<td class="small">' + esc(S.availabilityText(me, d)) + '<div data-warn style="color:var(--warn);font-weight:600"></div>' +
          (locked && x.rejectReason ? '<div style="color:var(--ng)">却下理由: ' + esc(x.rejectReason) + '</div>' : '') + '</td>' +
          '</tr>';
      }).join('');
      return head +
        (h ? ui.alert('info', '提出済みのシフト希望(' + fmt.dt(h.updatedAt) + ')を編集しています(UC-307 Alt-1)。送信すると上書きされます。承認済・却下の日は編集できません ' + ui.hokan(43) + ui.hokan(82)) : '') +
        '<p class="small muted">各日の希望を「出勤可能/時間指定/休日希望」から選ぶ。未選択の日は送信しない。1 日以上の入力が必要。休日希望は承認の対象外 ' + ui.hokan(41) + '</p>' +
        '<form data-form novalidate>' +
        '<div class="table-wrap"><table class="table table-sm hope-table"><thead><tr>' +
        '<th>日付</th><th>希望</th><th>時間</th><th>勤務可能時間 ' + ui.hokan(44) + '</th>' +
        '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
        '<p class="small muted" data-count></p>' +
        '<span class="field-error" data-err="_" hidden></span>' +
        '<div class="form-error" data-form-error hidden></div>' +
        '<div class="row" style="margin-top:10px"><button type="submit" class="btn btn-primary">送信</button>' +
        '<a class="btn btn-secondary" href="#/emp/hopes">キャンセル</a></div>' +
        '</form>';
    },
    mount: function (el) {
      var me = S.me();
      var p = S.hopePeriod();
      if (!p.open) { // 期間外は本 UC にアクセスできない(UC-307 備考)
        ui.toast('シフト希望の受付期間外です', 'warn');
        app.go('emp/hopes');
        return;
      }
      var form = el.querySelector('[data-form]');
      var errEl = form.querySelector('[data-form-error]');
      function rowOf(tr) {
        var ins = tr.querySelectorAll('input[type="time"]');
        var sel = tr.querySelector('[data-kind]');
        return { d: tr.dataset.day, sel: sel, s: ins[0], e: ins[1], warn: tr.querySelector('[data-warn]'), locked: sel.disabled };
      }
      // 勤務可能時間の範囲外・勤務不可の曜日への出勤希望に注意を出す(送信は可。#44)
      function refreshRow(tr) {
        var r = rowOf(tr);
        if (r.locked) return;
        var kind = r.sel.value;
        r.s.disabled = r.e.disabled = kind !== '時間指定';
        var av = S.availabilityOn(me, r.d);
        var msg = '';
        if ((kind === '出勤可能' || kind === '時間指定') && av && !av.enabled) msg = '勤務不可の曜日';
        else if (kind === '時間指定' && T.validTime(r.s.value) && T.validTime(r.e.value) && T.toMin(r.s.value) < T.toMin(r.e.value) &&
          S.inAvailability(me, r.d, r.s.value, r.e.value) === false) msg = '範囲外';
        r.warn.textContent = msg ? '注意: ' + msg : '';
      }
      function updateCount() {
        var c = { '出勤可能': 0, '時間指定': 0, '休日希望': 0 };
        form.querySelectorAll('[data-kind]').forEach(function (s) { if (c[s.value] !== undefined) c[s.value]++; });
        form.querySelector('[data-count]').textContent = '入力: 出勤可能 ' + c['出勤可能'] + ' 日 / 時間指定 ' + c['時間指定'] + ' 日 / 休日希望 ' + c['休日希望'] + ' 日';
      }
      form.querySelectorAll('tr[data-day]').forEach(refreshRow);
      updateCount();
      ui.on(form, 'change', '[data-kind]', function (e, sel) { refreshRow(sel.closest('tr')); updateCount(); });
      ui.on(form, 'input', 'input[type="time"]', function (e, inp) { refreshRow(inp.closest('tr')); });
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var days = {};
        form.querySelectorAll('tr[data-day]').forEach(function (tr) {
          var r = rowOf(tr);
          if (r.locked) return; // 処理済みの日は store 側で保持(#43)
          days[r.d] = { kind: r.sel.value, start: r.s.value, end: r.e.value };
        });
        var res = S.submitHope(me.id, p.month, days);
        if (!res.ok) {
          if (res.code === 'closed') { ui.toast(res.message, 'warn'); app.go('emp/hopes'); return; }
          // 入力は保持したまま(UC-307 Ex-1)
          var errors = res.errors || {};
          ui.showErrors(form, errors);
          Object.keys(errors).forEach(function (d) {
            form.querySelectorAll('[name="' + d + '_s"], [name="' + d + '_e"]').forEach(function (inp) { if (!inp.disabled) inp.classList.add('invalid'); });
          });
          showFormError(errEl, esc(res.message) + ui.flowNote(res.code === 'invalid' ? 'UC-307 Ex-1' : '通信エラー(UC-307 に記載なし)') + (res.code === 'fault' ? ui.hokan(79) : ''));
          var first = form.querySelector('tr .invalid');
          if (first) first.scrollIntoView({ block: 'center' });
          return;
        }
        ui.toast(res.updated ? 'シフト希望を更新しました' : 'シフト希望を送信しました');
        app.go('emp/hopes', { month: p.month });
      });
    },
  };

  // ---------------- シフト希望一覧(UC-311) ----------------
  K.views['emp/hopes'] = {
    role: '従業員',
    title: 'シフト希望一覧',
    tab: 'requests',
    render: function (params) {
      var me = S.me();
      var p = S.hopePeriod();
      var head = ui.pageHead({ title: 'シフト希望一覧', ucs: ['UC-311'], hokan: [47], lead: '自分が送信したシフト希望と処理状態' });
      if (S.fault()) return head + errBox('シフト希望情報の取得に失敗しました。画面を読み込み直してください', 'UC-311 Ex-2');
      var ym = /^\d{4}-\d{2}$/.test(params.month || '') ? params.month : p.month;
      var months = S.hopeMonthsOf(me.id);
      [p.month, ym].forEach(function (m) { if (months.indexOf(m) < 0) months.push(m); });
      months.sort().reverse();
      var isCur = ym === p.month;
      var h = S.hopeOf(me.id, ym);
      var opts = months.map(function (m) {
        return { value: m, label: fmt.month(m) + (m === p.month ? (p.open ? '(受付中)' : '(受付期間外)') : '') };
      });
      var period = isCur
        ? '<p class="small">受付期間 ' + fmt.date(p.from) + '〜' + fmt.date(p.to) + ' ' + (p.open ? ui.badge('受付中', 'ok') : ui.badge('受付期間外', 'gray')) + ' ' + ui.hokan(39) + '</p>'
        : '<p class="small muted">' + (ym < p.month ? '受付は終了しています' : '受付前です') + '</p>';
      var btn = isCur && p.open // 受付期間外は非表示(UC-307 備考)
        ? '<div style="margin-bottom:12px"><a class="btn btn-primary btn-block" href="#/emp/hope">' + (h ? '編集' : '新規提出') + '</a>' +
          '<div class="small muted" style="margin-top:4px">' + fmt.month(p.month) + '分・' + md(p.to) + ' 締切 ' + ui.hokan(75) + '</div></div>'
        : '';
      var body;
      if (!h) {
        body = emptyNote('現在提出済みのシフト希望はありません', 'UC-311 Ex-1');
      } else {
        var keys = Object.keys(h.days).sort();
        var cnt = { '申請中': 0, '承認済': 0, '却下': 0 };
        var off = 0;
        keys.forEach(function (d) {
          var x = h.days[d];
          if (x.kind === '休日希望') off++;
          else if (cnt[x.status] !== undefined) cnt[x.status]++;
        });
        body = '<dl class="kv small"><dt>提出日時</dt><dd>' + fmt.dt(h.submittedAt) + '</dd>' +
          (h.updatedAt !== h.submittedAt ? '<dt>更新日時</dt><dd>' + fmt.dt(h.updatedAt) + '</dd>' : '') + '</dl>' +
          '<div class="mini-stats" style="margin:10px 0 4px">' + stat(cnt['申請中'], '申請中') + stat(cnt['承認済'], '承認済') + stat(cnt['却下'], '却下') + '</div>' +
          '<p class="small muted">休日希望 ' + off + ' 日(承認対象外)</p>' +
          '<div class="table-wrap"><table class="table table-sm"><thead><tr>' +
          '<th>日付</th><th>希望</th><th>処理状態 ' + ui.hokan(41) + '</th><th>却下理由</th>' +
          '</tr></thead><tbody>' + keys.map(function (d) {
            var x = h.days[d];
            return '<tr><td class="nowrap">' + dayLabel(d) + '</td>' +
              '<td>' + ui.status(x.kind) + (x.kind === '時間指定' ? '<div class="small nowrap">' + fmt.range(x.start, x.end) + '</div>' : '') + '</td>' +
              '<td class="nowrap">' + (x.kind === '休日希望' ? '<span class="muted">—(承認対象外)</span>' : ui.status(x.status)) + '</td>' +
              '<td class="small">' + (x.rejectReason ? esc(x.rejectReason) : '') + '</td></tr>';
          }).join('') + '</tbody></table></div>';
      }
      return head +
        '<div class="toolbar">' + ui.field('対象月', '<select data-act="month">' + ui.options(opts, ym) + '</select>', 'month') + '</div>' +
        period + btn + body;
    },
    mount: function (el) {
      ui.on(el, 'change', '[data-act="month"]', function (e, sel) { app.go('emp/hopes', { month: sel.value }); });
    },
  };

  // ---------------- 申請(ハブ) ----------------
  K.views['emp/requests'] = {
    role: '従業員',
    title: '申請',
    tab: 'requests',
    render: function () {
      var me = S.me();
      var pend = S.employeePending(me.id);
      var p = S.hopePeriod();
      function pendBadge(n, unit) { return n ? ui.badge('申請中 ' + n + (unit || ''), 'warn') : ''; }
      var items = [
        { path: 'emp/corrections', title: '勤怠修正申請一覧', uc: 'UC-310', side: pendBadge(pend.corrections) },
        { path: 'emp/hopes', title: 'シフト希望一覧', uc: 'UC-311', side: pendBadge(pend.hopes, ' 日') },
      ];
      if (p.open) items.push({ path: 'emp/hope', title: 'シフト希望提出', uc: 'UC-307', sub: fmt.month(p.month) + '分・' + md(p.to) + ' 締切' });
      items.push({ path: 'emp/shift-change', title: 'シフト日時変更申請', uc: 'UC-309', side: pendBadge(pend.shiftChanges) });
      items.push({ path: 'emp/attendance', title: '勤怠修正申請を送信', uc: 'UC-306', sub: '勤怠記録一覧の各日から' });
      return ui.pageHead({ title: '申請', hokan: [76] }) +
        '<ul class="list">' + items.map(function (it) {
          return '<li><a class="list-item" href="#/' + it.path + '"><div class="list-item-main"><div class="list-item-title">' + esc(it.title) + '</div>' +
            '<div class="list-item-sub">' + ui.uc(it.uc) + (it.sub ? ' ' + esc(it.sub) : '') + '</div></div>' +
            (it.side ? '<div class="list-item-side">' + it.side + '</div>' : '') + '<span class="chev">›</span></a></li>';
        }).join('') + '</ul>' +
        (p.open ? '' : '<p class="small muted">シフト希望提出は受付期間中のみ表示(現在は受付期間外。UC-307 備考)</p>');
    },
  };

  // ---------------- メニュー ----------------
  K.views['emp/menu'] = {
    role: '従業員',
    title: 'メニュー',
    tab: 'menu',
    render: function () {
      var me = S.me();
      var today = T.today();
      var avRows = [1, 2, 3, 4, 5, 6, 0].map(function (w) {
        var d = T.addDays(today, (w - T.dow(today) + 7) % 7);
        return '<dt>' + T.WD[w] + '</dt><dd>' + esc(S.availabilityText(me, d)) + '</dd>';
      }).join('');
      return ui.pageHead({ title: 'メニュー' }) +
        card('アカウント', '<dl class="kv">' +
          '<dt>氏名</dt><dd>' + esc(me.name) + '</dd>' +
          '<dt>ユーザーID</dt><dd class="mono">' + esc(me.loginId) + '</dd>' +
          '<dt>所属店舗</dt><dd>' + esc(S.storeName(me.storeId)) + '</dd>' +
          '<dt>権限</dt><dd>' + me.roles.map(function (r) { return ui.badge(r); }).join(' ') + '</dd>' +
          '</dl>') +
        card('勤務可能時間 ' + ui.hokan(25), '<p class="small muted" style="margin-top:0">管理者が設定(UC-112/113)。シフト希望の入力時に参考表示</p><dl class="kv">' + avRows + '</dl>') +
        card('休憩時間 ' + ui.hokan(28), '<p style="margin-top:0">' + esc(S.breakRuleText(me)) + '</p>' +
          '<p class="small muted" style="margin-bottom:0">管理者が設定(UC-114/115)。休憩打刻がない日はこの時間で自動控除 ' + ui.hokan(29) + '</p>') +
        '<ul class="list" style="margin-top:14px">' +
        '<li><button type="button" class="list-item" data-act="emp-password"><div class="list-item-main"><div class="list-item-title">パスワードを変更</div></div><span class="chev">›</span></button></li>' +
        '<li><button type="button" class="list-item" data-act="emp-logout"><div class="list-item-main"><div class="list-item-title">ログアウト</div>' +
        '<div class="list-item-sub">' + ui.uc('UC-002') + '</div></div><span class="chev">›</span></button></li>' +
        '</ul>';
    },
    mount: function (el) {
      ui.on(el, 'click', '[data-act="emp-password"]', function () { app.passwordModal(); });
      ui.on(el, 'click', '[data-act="emp-logout"]', function () { app.logout(); });
    },
  };
})();
