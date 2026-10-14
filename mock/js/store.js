/*
 * ページ内メモリの状態とドメイン操作(全ロール共通)。
 * 画面(views)は状態を直接書き換えず、必ず K.S の関数を通す。
 *
 * 戻り値の規約:
 *   成功: { ok: true, ...追加情報 }
 *   失敗: { ok: false, message: '画面に出す文言', code?: '識別子', errors?: { field: '項目別メッセージ' }, ...追加情報 }
 */
window.K = window.K || {};

(function () {
  var T = K.T, fmt = K.fmt;
  var S = {};
  var state = null;
  var seq = 1000;
  function uid(prefix) { return prefix + (++seq); }
  function ok(extra) { return Object.assign({ ok: true }, extra || {}); }
  function ng(message, extra) { return Object.assign({ ok: false, message: message }, extra || {}); }
  function hasErrors(errors) { return Object.keys(errors).length > 0; }
  function byDateTime(a, b) { return (a.date + a.start).localeCompare(b.date + b.start); }

  S.ROLES = ['管理者', '勤怠管理者', '従業員'];
  S.HOME = { '従業員': 'emp/home', '勤怠管理者': 'mgr/home', '管理者': 'adm/home' };
  S.OT_DAILY = 480;     // 法定労働時間(1 日 8 時間)判断ログ #56
  S.OT_LIMIT = 45 * 60; // 36 協定 月 45 時間 #57
  S.OT_WARN = 36 * 60;  // 上限の 80% #57
  S.FAULT_MSG = '通信エラーが発生しました。画面を読み込み直してください';

  S.reset = function () { state = K.seed(); seq = 1000; S.state = state; };
  S.reset();

  // ================= 設定・デモ操作 =================
  S.fault = function () { return !!state.settings.fault; };
  S.setFault = function (v) { state.settings.fault = !!v; };

  // ================= ユーザー・店舗 =================
  S.user = function (id) { return state.users.find(function (u) { return u.id === id; }) || null; };
  S.userName = function (id) { var u = S.user(id); return u ? u.name : '—'; };
  S.userByLogin = function (loginId) { return state.users.find(function (u) { return u.loginId === loginId; }) || null; };
  S.stores = function () { return state.stores; };
  S.store = function (id) { return state.stores.find(function (s) { return s.id === id; }) || null; };
  S.storeName = function (id) { var s = S.store(id); return s ? s.name : '未設定'; };
  S.hasRole = function (u, role) { return !!u && u.roles.indexOf(role) >= 0; };
  S.activeUsers = function () { return state.users.filter(function (u) { return !u.deleted; }); };
  // 店舗に所属する「従業員」権限保持者(シフト・打刻の対象。判断ログ #1)
  S.storeEmployees = function (storeId) {
    return S.activeUsers().filter(function (u) { return u.storeId === storeId && S.hasRole(u, '従業員'); })
      .sort(function (a, b) { return a.order - b.order; });
  };
  S.adminCount = function () { return S.activeUsers().filter(function (u) { return S.hasRole(u, '管理者'); }).length; };

  // ================= セッション(UC-001 / UC-002) =================
  S.session = function () { return state.session; };
  S.me = function () { return state.session ? S.user(state.session.userId) : null; };
  S.view = function () { return state.session ? state.session.view : null; };
  // 表示できる画面(権限)の一覧。優先順は 管理者>勤怠管理者>従業員(#12)
  S.viewsOf = function (u) { return S.ROLES.filter(function (r) { return S.hasRole(u, r); }); };
  S.setView = function (view) {
    var me = S.me();
    if (!me || !S.hasRole(me, view)) return ng('この画面を表示する権限がありません');
    state.session.view = view;
    return ok();
  };
  S.login = function (loginId, password) {
    var errors = {};
    if (!loginId || !loginId.trim()) errors.loginId = 'ユーザーIDを入力してください';
    if (!password) errors.password = 'パスワードを入力してください';
    if (hasErrors(errors)) return ng('ユーザーIDとパスワードを入力してください', { errors: errors });
    var u = S.userByLogin(loginId.trim());
    // docx UC-101 Ex-2(アカウントなし)/ Ex-1(誤り)。削除済みはログイン不可(UC-105 備考)
    if (!u || u.deleted) return ng('アカウントが存在しません', { code: 'notfound' });
    if (u.password !== password) return ng('ログイン情報が正しくありません', { code: 'mismatch' });
    state.session = { userId: u.id, view: S.viewsOf(u)[0] };
    return ok({ user: u });
  };
  // デモ用: パスワードなしでログイン
  S.loginAs = function (userId) {
    var u = S.user(userId);
    if (!u || u.deleted) return ng('アカウントが存在しません');
    state.session = { userId: u.id, view: S.viewsOf(u)[0] };
    return ok({ user: u });
  };
  S.logout = function () {
    if (S.fault()) return ng('ログアウトに失敗しました。もう一度ログアウトしてください', { code: 'fault' });
    state.session = null;
    return ok();
  };
  S.changePassword = function (userId, current, next, confirm) {
    var u = S.user(userId);
    var errors = {};
    if (!u) return ng('ユーザーが存在しません');
    if (u.password !== current) errors.current = '現在のパスワードが正しくありません';
    var pe = S.passwordError(next);
    if (pe) errors.next = pe;
    if (next !== confirm) errors.confirm = '新しいパスワードと一致しません';
    if (hasErrors(errors)) return ng('入力内容が無効です', { errors: errors });
    u.password = next;
    return ok();
  };

  // ================= ユーザー管理(UC-103〜116) =================
  S.passwordError = function (pw) {
    if (!pw) return 'パスワードを入力してください';
    if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return '8 文字以上で、英字と数字を含めてください';
    return null;
  };
  // #17 入力規則
  S.validateUser = function (input, opts) {
    opts = opts || {};
    var errors = {};
    var name = (input.name || '').trim();
    var loginId = (input.loginId || '').trim();
    if (!name) errors.name = '氏名を入力してください';
    else if (name.length > 30) errors.name = '30 文字以内で入力してください';
    if (!loginId) errors.loginId = 'ユーザーIDを入力してください';
    else if (!/^[A-Za-z0-9._-]{4,20}$/.test(loginId)) errors.loginId = '半角英数字と . _ - の 4〜20 文字で入力してください';
    else {
      var dup = state.users.find(function (u) { return u.loginId === loginId && u.id !== opts.excludeId; });
      if (dup) errors.loginId = 'このユーザーIDは既に使用されています'; // docx UC-103 Ex-2
    }
    if (opts.requirePassword || input.password) {
      var pe = S.passwordError(input.password);
      if (pe) errors.password = pe;
    }
    if (opts.requireRole && S.ROLES.indexOf(input.role) < 0) errors.role = '権限を選択してください';
    return errors;
  };
  S.listUsers = function (filter) {
    filter = filter || {};
    var q = (filter.q || '').trim().toLowerCase();
    return state.users.filter(function (u) {
      if (u.deleted && !filter.includeDeleted) return false;
      if (filter.role && !S.hasRole(u, filter.role)) return false;
      if (filter.storeId === 'none' && u.storeId) return false;
      if (filter.storeId && filter.storeId !== 'none' && u.storeId !== filter.storeId) return false;
      if (q && u.name.toLowerCase().indexOf(q) < 0 && u.loginId.toLowerCase().indexOf(q) < 0) return false;
      return true;
    }).sort(function (a, b) { return a.order - b.order; });
  };
  S.createUser = function (byId, input) {
    if (S.fault()) return ng(S.FAULT_MSG, { code: 'fault' });
    var errors = S.validateUser(input, { requirePassword: true, requireRole: true });
    if (hasErrors(errors)) {
      var dupOnly = errors.loginId === 'このユーザーIDは既に使用されています';
      return ng(dupOnly ? 'このユーザーIDは既に使用されています。別のユーザーIDを入力してください' : '入力内容が無効です', { errors: errors });
    }
    var u = { id: uid('u'), loginId: input.loginId.trim(), password: input.password, name: input.name.trim(),
      roles: [input.role], storeId: null, availability: null, breakRule: null, deleted: false,
      createdAt: T.nowIso(), order: state.users.length };
    state.users.push(u);
    return ok({ user: u });
  };
  S.updateUser = function (byId, id, input) {
    var u = S.user(id);
    if (!u || u.deleted) return ng('対象ユーザーが存在しません', { code: 'notfound' });
    var errors = S.validateUser(input, { excludeId: id });
    if (hasErrors(errors)) return ng('入力内容が無効です', { errors: errors });
    u.name = input.name.trim();
    u.loginId = input.loginId.trim();
    if (input.password) u.password = input.password; // 空欄なら変更しない(#18)
    return ok({ user: u });
  };
  // 翌日以降の未勤務シフト
  S.futureShifts = function (userId) {
    var t = T.today();
    return state.shifts.filter(function (s) { return s.userId === userId && s.date > t; }).sort(byDateTime);
  };
  S.deleteUser = function (byId, id) {
    var u = S.user(id);
    if (!u || u.deleted) return ng('対象ユーザーが存在しません', { code: 'notfound' });
    if (id === byId) return ng('自分自身は削除できません', { code: 'self' });
    if (S.hasRole(u, '管理者') && S.adminCount() <= 1) return ng('管理者が 1 人以上必要なため、このユーザーは削除できません', { code: 'lastAdmin' });
    if (S.fault()) return ng('ユーザーの削除に失敗しました', { code: 'fault' });
    var future = S.futureShifts(id);
    future.forEach(function (s) { removeShift(byId, s, 'UC-105'); });
    u.deleted = true;
    u.deletedAt = T.nowIso();
    if (state.session && state.session.userId === id) state.session = null;
    return ok({ removedShifts: future.length });
  };
  S.grantRole = function (byId, id, role) {
    var u = S.user(id);
    if (!u || u.deleted) return ng('対象ユーザーが存在しません', { code: 'notfound' });
    if (S.ROLES.indexOf(role) < 0 || S.hasRole(u, role)) return ng('指定された権限は無効です。権限を選び直してください', { code: 'invalidRole' });
    u.roles.push(role);
    u.roles.sort(function (a, b) { return S.ROLES.indexOf(a) - S.ROLES.indexOf(b); });
    return ok({ user: u });
  };
  S.changeRole = function (byId, id, role) {
    var u = S.user(id);
    if (!u || u.deleted) return ng('対象ユーザーが存在しません', { code: 'notfound' });
    if (S.ROLES.indexOf(role) < 0) return ng('指定された権限は無効です。権限を選び直してください', { code: 'invalidRole' });
    if (id === byId) return ng('自分自身の権限は変更できません', { code: 'self' });
    if (S.hasRole(u, '管理者') && role !== '管理者' && S.adminCount() <= 1) {
      return ng('管理者が 1 人以上必要なため、このユーザーの管理者権限は外せません', { code: 'lastAdmin' });
    }
    u.roles = [role];
    return ok({ user: u });
  };
  // mode: 'set'(UC-110)/ 'edit'(UC-111)
  S.setStore = function (byId, id, storeId, mode) {
    var u = S.user(id);
    if (!u || u.deleted) return ng('対象ユーザーが存在しません', { code: 'notfound' });
    if (!S.store(storeId)) return ng('指定された店舗が存在しません。所属店舗を選び直してください', { code: 'nostore' });
    if (mode === 'set' && u.storeId) return ng('所属店舗は設定済みです');
    if (mode === 'edit' && !u.storeId) return ng('所属店舗が設定されていません');
    u.storeId = storeId;
    return ok({ user: u });
  };
  S.validateAvailability = function (av) {
    var errors = {};
    if (!Array.isArray(av) || av.length !== 7) return { _: '入力された勤務可能時間が不正です' };
    av.forEach(function (d, w) {
      if (!d.enabled) return;
      if (!T.validTime(d.start) || !T.validTime(d.end)) errors[w] = '開始・終了時刻を入力してください';
      else if (T.toMin(d.start) >= T.toMin(d.end)) errors[w] = '終了時刻は開始時刻より後にしてください';
    });
    return errors;
  };
  // mode: 'set'(UC-112)/ 'change'(UC-113)
  S.setAvailability = function (byId, id, av, mode) {
    var u = S.user(id);
    if (!u || u.deleted) return ng('対象ユーザーが存在しません', { code: 'notfound' });
    var errors = S.validateAvailability(av);
    if (hasErrors(errors)) return ng('入力された勤務可能時間が不正です。入力し直してください', { errors: errors });
    u.availability = av.map(function (d) {
      return d.enabled ? { enabled: true, start: d.start, end: d.end } : { enabled: false, start: '', end: '' };
    });
    return ok({ user: u, mode: mode });
  };
  S.validateBreakRule = function (rule) {
    var errors = {};
    var h = Number(rule.overHours), m = Number(rule.minutes);
    if (rule.overHours === '' || !isFinite(h) || h < 0 || h > 24 || Math.round(h * 2) !== h * 2) errors.overHours = '0〜24 の範囲(0.5 時間単位)で入力してください';
    if (rule.minutes === '' || !isFinite(m) || m < 0 || m > 180 || Math.round(m) !== m) errors.minutes = '0〜180 の整数で入力してください';
    return errors;
  };
  // mode: 'set'(UC-114)/ 'change'(UC-115)
  S.setBreakRule = function (byId, id, rule, mode) {
    var u = S.user(id);
    if (!u || u.deleted) return ng('対象ユーザーが存在しません', { code: 'notfound' });
    var errors = S.validateBreakRule(rule);
    if (hasErrors(errors)) return ng('入力された休憩時間が不正です。入力し直してください', { errors: errors });
    u.breakRule = { overHours: Number(rule.overHours), minutes: Number(rule.minutes) };
    return ok({ user: u, mode: mode });
  };
  S.breakRuleText = function (u) {
    if (!u || !u.breakRule) return '未設定';
    var r = u.breakRule;
    return '勤務が ' + r.overHours + ' 時間を超える場合に ' + r.minutes + ' 分';
  };

  // ================= 勤務可能時間 =================
  S.availabilityOn = function (u, date) {
    if (!u || !u.availability) return null;
    return u.availability[T.dow(date)];
  };
  S.availabilityText = function (u, date) {
    if (!u || !u.availability) return '未設定';
    var d = S.availabilityOn(u, date);
    return d.enabled ? fmt.range(d.start, d.end) : '勤務不可';
  };
  // true: 範囲内 / false: 範囲外 / null: 未設定(#26 チェックしない)
  S.inAvailability = function (u, date, start, end) {
    var d = S.availabilityOn(u, date);
    if (!d) return null;
    if (!d.enabled) return false;
    return T.toMin(start) >= T.toMin(d.start) && T.toMin(end) <= T.toMin(d.end);
  };

  // ================= シフト(UC-203〜205) =================
  S.shift = function (id) { return state.shifts.find(function (s) { return s.id === id; }) || null; };
  S.shiftsOf = function (userId, from, to) {
    return state.shifts.filter(function (s) {
      return s.userId === userId && (!from || s.date >= from) && (!to || s.date <= to);
    }).sort(byDateTime);
  };
  S.shiftsOn = function (userId, date) { return S.shiftsOf(userId, date, date); };
  // 店舗のシフト(担当判定は従業員の現所属店舗。#24)
  S.storeShifts = function (storeId, from, to) {
    var ids = S.storeEmployees(storeId).map(function (u) { return u.id; });
    return state.shifts.filter(function (s) {
      return ids.indexOf(s.userId) >= 0 && s.date >= from && s.date <= to;
    }).sort(byDateTime);
  };
  // シフトが 1 件でもある月を「確定・公開済み」とみなす(#34)
  S.monthPublished = function (storeId, ym) {
    var days = T.daysOf(ym);
    return S.storeShifts(storeId, days[0], days[days.length - 1]).length > 0;
  };
  // '予定' / '勤務中' / '勤務済み'(#35)
  S.shiftState = function (shift) {
    var t = T.today();
    if (shift.date < t) return '勤務済み';
    if (shift.date > t) return '予定';
    var p = S.punchesOn(shift.userId, shift.date);
    if (p.some(function (x) { return x.type === '退勤'; })) return '勤務済み';
    if (p.some(function (x) { return x.type === '出勤'; })) return '勤務中';
    return '予定';
  };
  // シフトの予定休憩(UC-203 備考1、#28)
  S.plannedBreak = function (u, start, end) {
    if (!u || !u.breakRule) return 0;
    var span = T.toMin(end) - T.toMin(start);
    return span > u.breakRule.overHours * 60 ? u.breakRule.minutes : 0;
  };
  S.requiredOn = function (storeId, date) {
    var st = S.store(storeId);
    if (!st) return 0;
    return T.isOffDay(date) ? st.required.offday : st.required.weekday;
  };
  // 日単位の人員の状況(#8)
  S.staffing = function (storeId, date) {
    var list = S.storeShifts(storeId, date, date);
    var users = [];
    list.forEach(function (s) { if (users.indexOf(s.userId) < 0) users.push(s.userId); });
    var required = S.requiredOn(storeId, date);
    return { date: date, count: users.length, required: required, short: users.length < required, shifts: list };
  };
  /*
   * シフト入力の検証(UC-203/204 step6、UC-207 step4、UC-215 step4)
   *   code: 'invalid'(Alt-1)/ 'overlap'(Alt-2, shifts)/ 'availability'(Alt-3, availability)
   */
  S.validateShift = function (input) {
    var errors = {};
    var u = S.user(input.userId);
    if (!u || u.deleted) errors.userId = '従業員を選択してください';
    if (!T.validDate(input.date)) errors.date = '勤務日を入力してください';
    else if (input.date < T.today()) errors.date = '過去の日付にはシフトを登録できません(過去の勤務は勤怠修正で扱う)'; // #77
    if (!T.validTime(input.start)) errors.start = '開始時刻を入力してください';
    if (!T.validTime(input.end)) errors.end = '終了時刻を入力してください';
    if (!errors.start && !errors.end && T.toMin(input.start) >= T.toMin(input.end)) {
      errors.end = '終了時刻は開始時刻より後にしてください(日をまたぐシフトは登録できません)';
    }
    if (hasErrors(errors)) return ng('入力されたシフト情報に誤りがあります', { code: 'invalid', errors: errors });
    var st = T.toMin(input.start), en = T.toMin(input.end);
    var overlaps = S.shiftsOn(input.userId, input.date).filter(function (s) {
      return s.id !== input.excludeId && T.toMin(s.start) < en && st < T.toMin(s.end);
    });
    if (overlaps.length) return ng('同じ従業員の登録済みシフトと日時が重複しています', { code: 'overlap', shifts: overlaps });
    if (S.inAvailability(u, input.date, input.start, input.end) === false) {
      return ng('従業員の勤務可能時間の範囲外です', { code: 'availability', availability: S.availabilityText(u, input.date) });
    }
    return ok();
  };
  function logShift(byId, type, via, userId, before, after) {
    var u = S.user(userId);
    state.shiftLog.unshift({ id: uid('lg'), at: T.nowIso(), by: byId, type: type, via: via,
      storeId: u ? u.storeId : null, userId: userId, before: before, after: after });
  }
  function snap(s) { return { date: s.date, start: s.start, end: s.end }; }
  function shiftText(x) { return fmt.date(x.date) + ' ' + fmt.range(x.start, x.end); }
  function removeShift(byId, s, via) {
    logShift(byId, '削除', via, s.userId, snap(s), null);
    state.shifts = state.shifts.filter(function (x) { return x.id !== s.id; });
  }
  S.createShift = function (byId, input, opts) {
    opts = opts || {};
    if (S.fault()) return ng(S.FAULT_MSG, { code: 'fault' });
    var v = S.validateShift(input);
    if (!v.ok) return v;
    var s = { id: uid('sh'), userId: input.userId, date: input.date, start: input.start, end: input.end,
      createdAt: T.nowIso(), createdBy: byId, source: opts.source || '登録' };
    state.shifts.push(s);
    if (!opts.silent) S.notify(s.userId, 'シフトが登録されました', shiftText(s) + ' のシフトが登録されました。', 'emp/shifts');
    return ok({ shift: s });
  };
  function applyShiftUpdate(byId, s, after, via) {
    var before = snap(s);
    logShift(byId, '変更', via, s.userId, before, { date: after.date, start: after.start, end: after.end });
    s.date = after.date; s.start = after.start; s.end = after.end;
    return before;
  }
  S.updateShift = function (byId, id, input) {
    var s = S.shift(id);
    if (!s) return ng('対象のシフトが存在しません', { code: 'notfound' });
    if (S.shiftState(s) === '勤務済み') return ng('勤務済みのシフトは変更できません', { code: 'worked' }); // UC-204 Alt-4
    if (S.fault()) return ng(S.FAULT_MSG, { code: 'fault' });
    var v = S.validateShift({ userId: s.userId, date: input.date, start: input.start, end: input.end, excludeId: id });
    if (!v.ok) return v;
    var before = applyShiftUpdate(byId, s, input, 'UC-204');
    S.notify(s.userId, 'シフトが変更されました', shiftText(before) + ' のシフトが ' + shiftText(s) + ' に変更されました。', 'emp/shifts');
    return ok({ shift: s, before: before });
  };
  S.deleteShift = function (byId, id) {
    var s = S.shift(id);
    if (!s) return ng('対象のシフトが存在しません', { code: 'notfound' });
    var st = S.shiftState(s);
    if (st === '勤務済み' || st === '勤務中') return ng('勤務済み・勤務中のシフトは削除できません', { code: 'worked' }); // UC-205 Alt-1
    if (S.fault()) return ng(S.FAULT_MSG, { code: 'fault' });
    removeShift(byId, s, 'UC-205');
    S.notify(s.userId, 'シフトが削除されました', shiftText(s) + ' のシフトが削除されました。', 'emp/shifts');
    return ok({ shift: s });
  };
  // 変更・削除履歴(#38)
  S.shiftLog = function (storeId) {
    return state.shiftLog.filter(function (l) { return l.storeId === storeId; })
      .sort(function (a, b) { return b.at.localeCompare(a.at); });
  };

  // ================= 打刻・勤務ステータス(UC-304 / UC-305) =================
  S.PUNCH_TYPES = ['出勤', '退勤', '休憩開始', '休憩終了']; // #67
  S.punchesOn = function (userId, date) {
    var r = state.attendance[userId] && state.attendance[userId][date];
    return r ? r.punches.slice().sort(function (a, b) { return a.at.localeCompare(b.at); }) : [];
  };
  function ensureRec(userId, date) {
    state.attendance[userId] = state.attendance[userId] || {};
    if (!state.attendance[userId][date]) state.attendance[userId][date] = { punches: [], override: null, history: [] };
    return state.attendance[userId][date];
  }
  // 当日の打刻のみで判定するため、日付が変わると「退勤中」に戻る(#69, #72)
  S.currentStatus = function (userId) {
    var p = S.punchesOn(userId, T.today());
    if (!p.length) return '退勤中';
    return { '出勤': '出勤中', '休憩終了': '出勤中', '休憩開始': '休憩中', '退勤': '退勤中' }[p[p.length - 1].type];
  };
  // 現在押下して整合する打刻種類(画面で強調表示する。#68)
  S.validPunches = function (userId) {
    var status = S.currentStatus(userId);
    var p = S.punchesOn(userId, T.today());
    var out = [];
    if (status === '退勤中' && !p.some(function (x) { return x.type === '出勤'; })) out.push('出勤');
    if (status === '出勤中') out.push('休憩開始', '退勤');
    if (status === '休憩中') out.push('休憩終了');
    return out;
  };
  S.punch = function (userId, type) {
    var status = S.currentStatus(userId);
    var today = T.today();
    if (S.PUNCH_TYPES.indexOf(type) < 0) {
      return ng('不正な打刻種類が選択されました', { code: 'unknownType', uc: 'UC-305 Ex-1' });
    }
    if (S.validPunches(userId).indexOf(type) < 0) {
      return ng('現在は打刻できません', { code: 'mismatch', uc: 'UC-304 Ex-1', detail: '勤務ステータス「' + status + '」では「' + type + '」は打刻できません' });
    }
    if (type === '出勤' && S.shiftsOn(userId, today).length === 0) {
      return ng('現在は打刻できません', { code: 'noShift', uc: 'UC-304 Ex-2', detail: '本日のシフトが登録されていません' });
    }
    if (S.fault()) {
      return ng('打刻情報の保存に失敗しました。画面を読み込み直してください。', { code: 'fault', uc: 'UC-304 Ex-3' });
    }
    var p = { type: type, at: T.nowIso() };
    ensureRec(userId, today).punches.push(p);
    return ok({ punch: p, status: S.currentStatus(userId), prevStatus: status });
  };

  // ================= 勤怠記録 =================
  S.history = function (userId, date) {
    var r = state.attendance[userId] && state.attendance[userId][date];
    return r ? r.history.slice().sort(function (a, b) { return b.at.localeCompare(a.at); }) : [];
  };
  function breakFromPunches(punches) {
    var total = 0, startAt = null, any = false;
    punches.forEach(function (p) {
      if (p.type === '休憩開始') { startAt = p.at.slice(11); any = true; }
      if (p.type === '休憩終了' && startAt) { total += T.toMin(p.at.slice(11)) - T.toMin(startAt); startAt = null; }
    });
    return { any: any, minutes: total };
  }
  /*
   * 1 日分の勤怠記録(UC-212 step4 の項目: 出勤時刻・退勤時刻・休憩時間)
   *   clockIn/clockOut: 'HH:MM:SS'(打刻)または 'HH:MM'(修正後)
   *   breakSource: '打刻' / '自動'(#29)/ '修正' / null
   */
  S.dayRecord = function (userId, date) {
    var u = S.user(userId);
    var r = state.attendance[userId] && state.attendance[userId][date];
    var punches = S.punchesOn(userId, date);
    var shifts = S.shiftsOn(userId, date);
    var out = { userId: userId, date: date, punches: punches, shifts: shifts, corrected: false,
      clockIn: null, clockOut: null, breakMinutes: null, breakSource: null, workMinutes: null, overtimeMinutes: 0 };
    if (r && r.override) {
      out.corrected = true;
      out.clockIn = r.override.clockIn;
      out.clockOut = r.override.clockOut;
      out.breakMinutes = r.override.breakMinutes;
      out.breakSource = '修正';
    } else {
      var inP = punches.filter(function (p) { return p.type === '出勤'; })[0];
      var outP = punches.filter(function (p) { return p.type === '退勤'; }).slice(-1)[0];
      out.clockIn = inP ? inP.at.slice(11) : null;
      out.clockOut = outP ? outP.at.slice(11) : null;
      var b = breakFromPunches(punches);
      if (b.any) { out.breakMinutes = b.minutes; out.breakSource = '打刻'; }
      else if (out.clockIn && out.clockOut) {
        out.breakMinutes = S.plannedBreak(u, out.clockIn.slice(0, 5), out.clockOut.slice(0, 5));
        out.breakSource = u && u.breakRule ? '自動' : null;
      }
    }
    if (out.clockIn && out.clockOut) {
      var span = T.toMin(out.clockOut) - T.toMin(out.clockIn);
      out.workMinutes = Math.max(0, span - (out.breakMinutes || 0));
      out.overtimeMinutes = Math.max(0, out.workMinutes - S.OT_DAILY);
    }
    out.flags = flagsOf(out);
    out.hasRecord = !!(out.clockIn || out.clockOut || punches.length);
    return out;
  };
  // #58 遅刻・早退・欠勤・打刻漏れ・未出勤・シフト外勤務
  function flagsOf(r) {
    var flags = [];
    var t = T.today();
    var sh = r.shifts;
    var planStart = sh.length ? sh[0].start : null;
    var planEnd = sh.length ? sh.reduce(function (m, s) { return s.end > m ? s.end : m; }, sh[0].end) : null;
    if (!sh.length && (r.clockIn || r.clockOut)) flags.push('シフト外勤務');
    if (planStart && r.clockIn && T.toMin(r.clockIn) > T.toMin(planStart)) flags.push('遅刻');
    if (planEnd && r.clockOut && T.toMin(r.clockOut) < T.toMin(planEnd)) flags.push('早退');
    if (r.date < t) {
      if (sh.length && !r.clockIn && !r.clockOut) flags.push('欠勤');
      else if (!!r.clockIn !== !!r.clockOut) flags.push('打刻漏れ');
    } else if (r.date === t && planStart && !r.clockIn && T.toMin(T.nowHM()) > T.toMin(planStart)) {
      flags.push('未出勤');
    }
    return flags;
  }
  S.monthOvertime = function (userId, ym) {
    var t = T.today();
    return T.daysOf(ym).filter(function (d) { return d <= t; }).reduce(function (sum, d) {
      return sum + S.dayRecord(userId, d).overtimeMinutes;
    }, 0);
  };
  // 36 協定の警告レベル(#57): null / '注意' / '超過'
  S.otAlert = function (minutes) {
    if (minutes >= S.OT_LIMIT) return '超過';
    if (minutes >= S.OT_WARN) return '注意';
    return null;
  };

  // ================= 勤務実態(UC-213) =================
  S.workSummary = function (opts) {
    var users = opts.userId ? [S.user(opts.userId)] : S.storeEmployees(opts.storeId);
    var dates = T.range(opts.from, opts.to);
    var ym = T.thisMonth();
    var list = users.filter(Boolean).map(function (u) {
      var rows = dates.map(function (d) { return S.dayRecord(u.id, d); })
        .filter(function (r) { return r.shifts.length || r.hasRecord; });
      var totals = { workMinutes: 0, overtimeMinutes: 0, late: 0, early: 0, absent: 0, missing: 0, days: 0 };
      rows.forEach(function (r) {
        if (r.workMinutes !== null) { totals.workMinutes += r.workMinutes; totals.days++; }
        totals.overtimeMinutes += r.overtimeMinutes;
        if (r.flags.indexOf('遅刻') >= 0) totals.late++;
        if (r.flags.indexOf('早退') >= 0) totals.early++;
        if (r.flags.indexOf('欠勤') >= 0) totals.absent++;
        if (r.flags.indexOf('打刻漏れ') >= 0) totals.missing++;
      });
      var monthOT = S.monthOvertime(u.id, ym);
      return { user: u, status: S.currentStatus(u.id), rows: rows, totals: totals,
        monthOvertime: monthOT, alert: S.otAlert(monthOT) };
    });
    return { users: list, hasRecords: list.some(function (x) { return x.rows.some(function (r) { return r.hasRecord; }); }) };
  };
  S.workSummaryCsv = function (summary) {
    var lines = [['従業員', '日付', 'シフト', '出勤', '退勤', '休憩(分)', '勤務時間', '残業時間', '差異'].join(',')];
    summary.users.forEach(function (x) {
      x.rows.forEach(function (r) {
        lines.push([x.user.name, r.date,
          r.shifts.map(function (s) { return s.start + '-' + s.end; }).join(' '),
          r.clockIn ? r.clockIn.slice(0, 5) : '', r.clockOut ? r.clockOut.slice(0, 5) : '',
          r.breakMinutes === null ? '' : r.breakMinutes,
          fmt.dur(r.workMinutes), fmt.dur(r.overtimeMinutes), r.flags.join(' ')].join(','));
      });
    });
    return lines.join('\n');
  };

  // ================= 勤怠修正申請(UC-306 / UC-209〜211)・勤怠修正(UC-212) =================
  // 申請できる対象日: 前月 1 日〜当日(#50)
  S.correctionRange = function () {
    return { from: T.addMonths(T.thisMonth(), -1) + '-01', to: T.today() };
  };
  S.correction = function (id) { return state.corrections.find(function (c) { return c.id === id; }) || null; };
  function snapRecord(userId, date) {
    var r = S.dayRecord(userId, date);
    return { clockIn: r.clockIn ? r.clockIn.slice(0, 5) : null, clockOut: r.clockOut ? r.clockOut.slice(0, 5) : null,
      breakMinutes: r.breakMinutes === null ? null : r.breakMinutes };
  }
  // 修正後の勤怠情報の検証(出勤<退勤、休憩は 0 以上かつ勤務時間未満)
  S.validateTimes = function (input) {
    var errors = {};
    if (!T.validTime(input.clockIn)) errors.clockIn = '出勤時刻を入力してください';
    if (!T.validTime(input.clockOut)) errors.clockOut = '退勤時刻を入力してください';
    if (!errors.clockIn && !errors.clockOut && T.toMin(input.clockIn) >= T.toMin(input.clockOut)) {
      errors.clockOut = '退勤時刻は出勤時刻より後にしてください';
    }
    var b = input.breakMinutes;
    if (b === '' || b === null || b === undefined || !isFinite(Number(b)) || Number(b) < 0 || Math.round(Number(b)) !== Number(b)) {
      errors.breakMinutes = '休憩時間は 0 以上の整数(分)で入力してください';
    } else if (!errors.clockIn && !errors.clockOut && Number(b) >= T.toMin(input.clockOut) - T.toMin(input.clockIn)) {
      errors.breakMinutes = '休憩時間が勤務時間以上になっています';
    }
    return errors;
  };
  function validateCorrectionInput(input) {
    var errors = S.validateTimes(input);
    var range = S.correctionRange();
    if (!T.validDate(input.date)) errors.date = '対象日を選択してください';
    else if (input.date > range.to) errors.date = '未来の日付は申請できません';
    else if (input.date < range.from) errors.date = fmt.date(range.from) + ' 以降の日付を選択してください';
    if (!input.reason || !input.reason.trim()) errors.reason = '申請理由を入力してください';
    return errors;
  }
  function normTimes(input) {
    return { clockIn: input.clockIn, clockOut: input.clockOut, breakMinutes: Number(input.breakMinutes) };
  }
  S.pendingCorrection = function (userId, date) {
    return state.corrections.find(function (c) { return c.userId === userId && c.date === date && c.status === '申請中'; }) || null;
  };
  S.submitCorrection = function (userId, input) {
    if (S.pendingCorrection(userId, input.date)) {
      // UC-306 Ex-2(文言は docs のまま、括弧のみ揃えた)
      return ng('該当日の修正申請はすでに送信されています。内容を修正する場合は『勤怠修正申請内容を一覧表示する（UC-310）』から編集してください', { code: 'duplicate' });
    }
    var errors = validateCorrectionInput(input);
    if (hasErrors(errors)) return ng('入力内容に不備があります', { code: 'invalid', errors: errors }); // UC-306 Ex-1
    if (S.fault()) return ng(S.FAULT_MSG, { code: 'fault' });
    var now = T.nowIso();
    var c = { id: uid('cr'), userId: userId, date: input.date, before: snapRecord(userId, input.date),
      after: normTimes(input), reason: input.reason.trim(), status: '申請中', createdAt: now, updatedAt: now,
      processedAt: null, processedBy: null, rejectReason: null };
    state.corrections.push(c);
    return ok({ request: c });
  };
  // UC-306 Alt-1(既存の申請中データを上書き。状態は申請中のまま)
  S.editCorrection = function (userId, id, input) {
    var c = S.correction(id);
    if (!c || c.userId !== userId) return ng('対象の申請が見つかりません', { code: 'notfound' });
    if (c.status !== '申請中') return ng('申請中の申請のみ編集できます', { code: 'state' });
    var errors = validateCorrectionInput(Object.assign({}, input, { date: c.date }));
    if (hasErrors(errors)) return ng('入力内容に不備があります', { code: 'invalid', errors: errors });
    if (S.fault()) return ng(S.FAULT_MSG, { code: 'fault' });
    c.after = normTimes(input);
    c.reason = input.reason.trim();
    c.updatedAt = T.nowIso();
    return ok({ request: c });
  };
  // 取り下げ(#6)
  S.withdrawCorrection = function (userId, id) {
    var c = S.correction(id);
    if (!c || c.userId !== userId) return ng('対象の申請が見つかりません', { code: 'notfound' });
    if (c.status !== '申請中') return ng('申請中の申請のみ取り下げできます', { code: 'state' });
    c.status = '取下げ';
    c.processedAt = T.nowIso();
    return ok({ request: c });
  };
  S.correctionsOf = function (userId) {
    return state.corrections.filter(function (c) { return c.userId === userId; })
      .sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); });
  };
  // filter: { status: '申請中'(既定)|'all'|状態名, userId, from, to }(UC-209 Alt-2)
  S.correctionsForStore = function (storeId, filter) {
    filter = filter || {};
    var status = filter.status || '申請中';
    return state.corrections.filter(function (c) {
      var u = S.user(c.userId);
      if (!u || u.storeId !== storeId) return false;
      if (status !== 'all' && c.status !== status) return false;
      if (filter.userId && c.userId !== filter.userId) return false;
      if (filter.from && c.date < filter.from) return false;
      if (filter.to && c.date > filter.to) return false;
      return true;
    }).sort(function (a, b) { return a.createdAt.localeCompare(b.createdAt); });
  };
  // UC-209 step5 / Alt-3(#52)
  S.correctionCheck = function (c) {
    var shifts = S.shiftsOn(c.userId, c.date);
    var messages = [];
    var contradiction = false;
    if (!shifts.length) { contradiction = true; messages.push('対象日にシフトがありません(シフトのない日の勤務)'); }
    else {
      var ps = shifts[0].start, pe = shifts[shifts.length - 1].end;
      var d1 = T.toMin(c.after.clockIn) - T.toMin(ps);
      var d2 = T.toMin(c.after.clockOut) - T.toMin(pe);
      messages.push('出勤: シフト開始 ' + ps + ' に対して ' + (d1 === 0 ? '差なし' : (Math.abs(d1) + ' 分' + (d1 < 0 ? '早い' : '遅い'))));
      messages.push('退勤: シフト終了 ' + pe + ' に対して ' + (d2 === 0 ? '差なし' : (Math.abs(d2) + ' 分' + (d2 < 0 ? '早い' : '遅い'))));
    }
    return { shifts: shifts, contradiction: contradiction, messages: messages };
  };
  function applyRecord(byId, userId, date, after, reason, via) {
    var r = ensureRec(userId, date);
    var before = snapRecord(userId, date);
    r.history.push({ at: T.nowIso(), by: byId, via: via, reason: reason, before: before, after: after });
    r.override = { clockIn: after.clockIn, clockOut: after.clockOut, breakMinutes: after.breakMinutes };
    return before;
  }
  S.approveCorrection = function (byId, id) {
    var c = S.correction(id);
    if (!c || c.status !== '申請中') {
      return ng('対象の勤怠修正申請は承認できない状態です(処理済み、または取り下げ済み)', { code: 'state' }); // UC-210 Alt-2
    }
    var errors = S.validateTimes(c.after);
    if (hasErrors(errors)) {
      return ng('修正後の内容が無効です: ' + Object.keys(errors).map(function (k) { return errors[k]; }).join(' / '), { code: 'invalid' }); // Alt-1
    }
    if (S.fault()) return ng(S.FAULT_MSG, { code: 'fault' });
    applyRecord(byId, c.userId, c.date, c.after, c.reason, '勤怠修正申請の承認(UC-210)');
    c.status = '承認済';
    c.processedAt = T.nowIso();
    c.processedBy = byId;
    S.notify(c.userId, '勤怠修正申請が承認されました', fmt.date(c.date) + ' の勤怠修正申請が承認されました。', 'emp/corrections');
    return ok({ request: c });
  };
  S.rejectCorrection = function (byId, id, reason) {
    var c = S.correction(id);
    if (!reason || !reason.trim()) return ng('却下理由の入力が必要です', { code: 'reason' }); // Alt-1
    if (!c || c.status !== '申請中') return ng('対象の勤怠修正申請は却下できない状態です(処理済み、または取り下げ済み)', { code: 'state' });
    if (S.fault()) return ng(S.FAULT_MSG, { code: 'fault' });
    c.status = '却下';
    c.rejectReason = reason.trim();
    c.processedAt = T.nowIso();
    c.processedBy = byId;
    S.notify(c.userId, '勤怠修正申請が却下されました', fmt.date(c.date) + ' の勤怠修正申請が却下されました。却下理由: ' + c.rejectReason, 'emp/corrections');
    return ok({ request: c });
  };
  // UC-212(申請によらない直接修正。記録がない日は新規作成 = Alt-1)
  S.directCorrect = function (byId, userId, date, input) {
    var u = S.user(userId);
    if (!u) return ng('対象の従業員が存在しません', { code: 'notfound' });
    if (!T.validDate(date) || date > T.today()) return ng('未来の日付は修正できません', { code: 'date' });
    var errors = S.validateTimes(input);
    var reasonMissing = !input.reason || !input.reason.trim();
    if (hasErrors(errors)) {
      if (reasonMissing) errors.reason = '修正理由を入力してください';
      return ng('入力された勤怠情報に誤りがあります', { code: 'invalid', errors: errors }); // Alt-2
    }
    if (reasonMissing) return ng('修正理由の入力が必要です', { code: 'reason', errors: { reason: '修正理由を入力してください' } }); // Alt-3
    if (S.fault()) return ng(S.FAULT_MSG, { code: 'fault' });
    var after = normTimes(input);
    var before = applyRecord(byId, userId, date, after, input.reason.trim(), '勤怠の直接修正(UC-212)');
    S.notify(userId, '勤怠記録が修正されました', fmt.date(date) + ' の勤怠記録が勤怠管理者によって修正されました。', 'emp/attendance');
    return ok({ before: before, after: after });
  };

  // ================= シフト希望(UC-307 / UC-311 / UC-206〜208) =================
  S.HOPE_KINDS = ['出勤可能', '時間指定', '休日希望']; // #40
  // 受付期間: 翌月分を当月 1〜20 日(#39)。hopeOverride: null(自動)/'closed'/'open'
  S.hopePeriod = function () {
    var t = T.today();
    var ym = T.thisMonth();
    var from = ym + '-01', to = ym + '-20';
    var auto = t >= from && t <= to;
    var o = state.settings.hopeOverride;
    return { month: T.addMonths(ym, 1), from: from, to: to,
      open: o === 'closed' ? false : (o === 'open' ? true : auto), override: o };
  };
  S.setHopeOverride = function (v) { state.settings.hopeOverride = v || null; };
  S.hopeOf = function (userId, month) {
    return state.hopes.find(function (h) { return h.userId === userId && h.month === month; }) || null;
  };
  S.hopeMonthsOf = function (userId) {
    return state.hopes.filter(function (h) { return h.userId === userId; })
      .map(function (h) { return h.month; }).sort().reverse();
  };
  /*
   * days: { 'YYYY-MM-DD': { kind: '出勤可能'|'時間指定'|'休日希望'|'', start, end } }
   * 処理済み(承認済・却下)の日は上書きしない(#43)
   */
  S.submitHope = function (userId, month, days) {
    var p = S.hopePeriod();
    if (!p.open || month !== p.month) return ng('シフト希望の受付期間外です', { code: 'closed' });
    var existing = S.hopeOf(userId, month);
    var errors = {};
    var next = {};
    if (existing) {
      Object.keys(existing.days).forEach(function (d) {
        var x = existing.days[d];
        if (x.status === '承認済' || x.status === '却下') next[d] = x;
      });
    }
    Object.keys(days || {}).forEach(function (d) {
      if (next[d]) return;
      var x = days[d];
      if (!x || !x.kind) return;
      if (S.HOPE_KINDS.indexOf(x.kind) < 0) { errors[d] = '希望の種類が不正です'; return; }
      if (x.kind === '時間指定') {
        if (!T.validTime(x.start) || !T.validTime(x.end)) { errors[d] = '開始・終了時刻を入力してください'; return; }
        if (T.toMin(x.start) >= T.toMin(x.end)) { errors[d] = '終了時刻は開始時刻より後にしてください'; return; }
      }
      next[d] = { kind: x.kind, start: x.kind === '時間指定' ? x.start : '', end: x.kind === '時間指定' ? x.end : '',
        status: x.kind === '休日希望' ? null : '申請中', rejectReason: null, processedAt: null, processedBy: null, shiftId: null };
    });
    if (!hasErrors(errors) && Object.keys(next).length === 0) errors._ = '1 日以上の希望を入力してください';
    if (hasErrors(errors)) return ng('入力内容に不備があります', { code: 'invalid', errors: errors }); // UC-307 Ex-1
    if (S.fault()) return ng(S.FAULT_MSG, { code: 'fault' });
    var now = T.nowIso();
    if (existing) {
      existing.days = next;
      existing.updatedAt = now;
      return ok({ hope: existing, updated: true });
    }
    var h = { id: uid('hp'), userId: userId, month: month, submittedAt: now, updatedAt: now, days: next };
    state.hopes.push(h);
    return ok({ hope: h, updated: false });
  };
  function hopeItem(h, d) {
    var x = h.days[d];
    return { key: h.id + '|' + d, hopeId: h.id, userId: h.userId, user: S.user(h.userId), date: d,
      kind: x.kind, start: x.start, end: x.end, status: x.status, rejectReason: x.rejectReason,
      processedAt: x.processedAt, processedBy: x.processedBy, shiftId: x.shiftId,
      submittedAt: h.updatedAt || h.submittedAt };
  }
  S.hopeItem = function (key) {
    var p = (key || '').split('|');
    var h = state.hopes.find(function (x) { return x.id === p[0]; });
    if (!h || !h.days[p[1]]) return null;
    return hopeItem(h, p[1]);
  };
  // 希望日単位に展開した一覧(#41)。filter: { status: '申請中'(既定)|'all'|状態名, userId, from, to, includeOff }
  S.hopeItems = function (storeId, filter) {
    filter = filter || {};
    var status = filter.status || '申請中';
    var out = [];
    state.hopes.forEach(function (h) {
      var u = S.user(h.userId);
      if (!u || u.storeId !== storeId) return;
      if (filter.userId && h.userId !== filter.userId) return;
      Object.keys(h.days).forEach(function (d) {
        var x = h.days[d];
        if (filter.from && d < filter.from) return;
        if (filter.to && d > filter.to) return;
        if (x.kind === '休日希望') { if (filter.includeOff) out.push(hopeItem(h, d)); return; }
        if (status !== 'all' && x.status !== status) return;
        out.push(hopeItem(h, d));
      });
    });
    return out.sort(function (a, b) { return a.date.localeCompare(b.date) || a.user.order - b.user.order; });
  };
  // 承認時のシフト時刻の初期値(#42)
  S.defaultHopeTimes = function (item) {
    if (item.kind === '時間指定') return { start: item.start, end: item.end };
    var u = S.user(item.userId);
    var a = S.availabilityOn(u, item.date);
    if (a && a.enabled) return { start: a.start, end: a.end };
    var st = S.store(u && u.storeId);
    return st ? { start: st.open, end: st.close } : { start: '09:00', end: '18:00' };
  };
  /*
   * UC-207。times を省略すると希望どおりの時刻(時間指定)で登録する。
   *   code: 'state'(Alt-2)/ 'needTime' / 'invalid' / 'overlap'(Alt-1: 時刻を調整して再実行)/ 'availability'(Alt-3)
   */
  S.approveHope = function (byId, key, times) {
    var item = S.hopeItem(key);
    if (!item || item.status !== '申請中') return ng('対象のシフト希望は承認できない状態です(処理済み、または取り下げ済み)', { code: 'state' });
    var t = times || (item.kind === '時間指定' ? { start: item.start, end: item.end } : null);
    if (!t) return ng('シフトの開始・終了時刻を入力してください', { code: 'needTime' });
    var v = S.validateShift({ userId: item.userId, date: item.date, start: t.start, end: t.end });
    if (!v.ok) return v;
    if (S.fault()) return ng(S.FAULT_MSG, { code: 'fault' });
    var r = S.createShift(byId, { userId: item.userId, date: item.date, start: t.start, end: t.end }, { source: 'シフト希望', silent: true });
    var x = state.hopes.find(function (h) { return h.id === item.hopeId; }).days[item.date];
    x.status = '承認済';
    x.processedAt = T.nowIso();
    x.processedBy = byId;
    x.shiftId = r.shift.id;
    S.notify(item.userId, 'シフト希望が承認されました',
      fmt.date(item.date) + ' のシフト希望が承認され、' + fmt.range(t.start, t.end) + ' のシフトとして登録されました。', 'emp/hopes');
    return ok({ shift: r.shift });
  };
  // #45 一括承認(時間指定のない希望は #42 の初期値で登録)
  S.bulkApproveHopes = function (byId, keys) {
    return keys.map(function (key) {
      var item = S.hopeItem(key);
      var times = item ? S.defaultHopeTimes(item) : null;
      var r = S.approveHope(byId, key, times);
      return { key: key, item: item, ok: r.ok, message: r.message, code: r.code };
    });
  };
  S.rejectHope = function (byId, key, reason) {
    var item = S.hopeItem(key);
    if (!reason || !reason.trim()) return ng('却下理由の入力が必要です', { code: 'reason' }); // UC-208 Alt-1
    if (!item || item.status !== '申請中') return ng('対象のシフト希望は却下できない状態です(処理済み、または取り下げ済み)', { code: 'state' });
    if (S.fault()) return ng(S.FAULT_MSG, { code: 'fault' });
    var x = state.hopes.find(function (h) { return h.id === item.hopeId; }).days[item.date];
    x.status = '却下';
    x.rejectReason = reason.trim();
    x.processedAt = T.nowIso();
    x.processedBy = byId;
    S.notify(item.userId, 'シフト希望が却下されました', fmt.date(item.date) + ' のシフト希望が却下されました。却下理由: ' + x.rejectReason, 'emp/hopes');
    return ok({ item: S.hopeItem(key) });
  };

  // ================= シフト日時変更申請(UC-309 / UC-214〜216) =================
  S.shiftChange = function (id) { return state.shiftChanges.find(function (c) { return c.id === id; }) || null; };
  S.pendingShiftChange = function (shiftId) {
    return state.shiftChanges.find(function (c) { return c.shiftId === shiftId && c.status === '申請中'; }) || null;
  };
  S.shiftChangesOf = function (userId) {
    return state.shiftChanges.filter(function (c) { return c.userId === userId; })
      .sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); });
  };
  // 申請できるシフト: 翌日以降(#36)
  S.canRequestShiftChange = function (shift) { return !!shift && shift.date > T.today(); };
  S.submitShiftChange = function (userId, shiftId, input) {
    var s = S.shift(shiftId);
    if (!s || s.userId !== userId) return ng('対象のシフトが見つかりません', { code: 'notfound' });
    if (!S.canRequestShiftChange(s)) return ng('翌日以降のシフトのみ変更を申請できます', { code: 'date' });
    if (S.pendingShiftChange(shiftId)) {
      return ng('このシフトには申請中のシフト日時変更申請があります。内容を変える場合は取り下げてから送信してください', { code: 'duplicate' });
    }
    var errors = {};
    var tomorrow = T.addDays(T.today(), 1);
    if (!T.validDate(input.date)) errors.date = '変更希望の日付を入力してください';
    else if (input.date < tomorrow) errors.date = '翌日以降の日付を入力してください';
    if (!T.validTime(input.start)) errors.start = '開始時刻を入力してください';
    if (!T.validTime(input.end)) errors.end = '終了時刻を入力してください';
    if (!errors.start && !errors.end && T.toMin(input.start) >= T.toMin(input.end)) errors.end = '終了時刻は開始時刻より後にしてください';
    if (!hasErrors(errors) && input.date === s.date && input.start === s.start && input.end === s.end) errors.date = '変更前と同じ日時です';
    if (!input.reason || !input.reason.trim()) errors.reason = '申請理由を入力してください';
    if (hasErrors(errors)) return ng('入力内容に不備があります', { code: 'invalid', errors: errors });
    if (S.fault()) return ng(S.FAULT_MSG, { code: 'fault' });
    var c = { id: uid('sc'), userId: userId, shiftId: shiftId, before: snap(s),
      after: { date: input.date, start: input.start, end: input.end }, reason: input.reason.trim(),
      status: '申請中', createdAt: T.nowIso(), processedAt: null, processedBy: null, rejectReason: null };
    state.shiftChanges.push(c);
    return ok({ request: c, warnings: S.shiftChangeOverlaps(c) });
  };
  S.shiftChangeOverlaps = function (c) {
    var st = T.toMin(c.after.start), en = T.toMin(c.after.end);
    return S.shiftsOn(c.userId, c.after.date).filter(function (s) {
      return s.id !== c.shiftId && T.toMin(s.start) < en && st < T.toMin(s.end);
    });
  };
  S.withdrawShiftChange = function (userId, id) {
    var c = S.shiftChange(id);
    if (!c || c.userId !== userId) return ng('対象の申請が見つかりません', { code: 'notfound' });
    if (c.status !== '申請中') return ng('申請中の申請のみ取り下げできます', { code: 'state' });
    c.status = '取下げ';
    c.processedAt = T.nowIso();
    return ok({ request: c });
  };
  S.shiftChangesForStore = function (storeId, filter) {
    filter = filter || {};
    var status = filter.status || '申請中';
    return state.shiftChanges.filter(function (c) {
      var u = S.user(c.userId);
      if (!u || u.storeId !== storeId) return false;
      if (status !== 'all' && c.status !== status) return false;
      if (filter.userId && c.userId !== filter.userId) return false;
      if (filter.from && c.before.date < filter.from && c.after.date < filter.from) return false;
      if (filter.to && c.before.date > filter.to && c.after.date > filter.to) return false;
      return true;
    }).sort(function (a, b) { return a.createdAt.localeCompare(b.createdAt); });
  };
  // UC-214 step5: 重複・勤務可能時間・人員不足(#64)
  S.shiftChangeCheck = function (c) {
    var u = S.user(c.userId);
    var storeId = u ? u.storeId : null;
    var overlaps = S.shiftChangeOverlaps(c);
    var inAv = S.inAvailability(u, c.after.date, c.after.start, c.after.end);
    var before = S.staffing(storeId, c.before.date);
    var shortageBefore = null;
    if (c.after.date !== c.before.date) {
      var remain = before.count - 1;
      if (remain < before.required) shortageBefore = { date: c.before.date, count: remain, required: before.required };
    }
    var after = S.staffing(storeId, c.after.date);
    var messages = [];
    if (overlaps.length) messages.push('変更希望の日時が登録済みのシフト(' + overlaps.map(function (s) { return shiftText(s); }).join('、') + ')と重複しています');
    if (shortageBefore) messages.push('変更前の ' + fmt.date(shortageBefore.date) + ' が ' + shortageBefore.count + ' 名(必要 ' + shortageBefore.required + ' 名)になり人員不足が生じます');
    if (inAv === false) messages.push('変更希望の日時が勤務可能時間(' + S.availabilityText(u, c.after.date) + ')の範囲外です');
    return { overlaps: overlaps, inAvailability: inAv, availability: S.availabilityText(u, c.after.date),
      shortageBefore: shortageBefore, staffingAfter: after, messages: messages };
  };
  S.approveShiftChange = function (byId, id) {
    var c = S.shiftChange(id);
    if (!c || c.status !== '申請中') return ng('対象のシフト日時変更申請は承認できない状態です(処理済み、または取り下げ済み)', { code: 'state' }); // Alt-3
    var s = S.shift(c.shiftId);
    if (!s || S.shiftState(s) === '勤務済み') return ng('変更前のシフトが勤務済み、または削除されているため変更できません', { code: 'shiftGone' }); // Alt-2
    var v = S.validateShift({ userId: c.userId, date: c.after.date, start: c.after.start, end: c.after.end, excludeId: s.id });
    if (!v.ok) return v; // overlap = Alt-1 / availability = Alt-4
    if (S.fault()) return ng(S.FAULT_MSG, { code: 'fault' });
    var before = applyShiftUpdate(byId, s, c.after, 'UC-215');
    c.status = '承認済';
    c.processedAt = T.nowIso();
    c.processedBy = byId;
    S.notify(c.userId, 'シフト日時変更申請が承認されました',
      shiftText(before) + ' → ' + shiftText(c.after) + ' の申請が承認され、シフトが変更されました。', 'emp/shift-change');
    return ok({ request: c, shift: s });
  };
  S.rejectShiftChange = function (byId, id, reason) {
    var c = S.shiftChange(id);
    if (!reason || !reason.trim()) return ng('却下理由の入力が必要です', { code: 'reason' }); // Alt-1
    if (!c || c.status !== '申請中') return ng('対象のシフト日時変更申請は却下できない状態です(処理済み、または取り下げ済み)', { code: 'state' });
    if (S.fault()) return ng(S.FAULT_MSG, { code: 'fault' });
    c.status = '却下';
    c.rejectReason = reason.trim();
    c.processedAt = T.nowIso();
    c.processedBy = byId;
    S.notify(c.userId, 'シフト日時変更申請が却下されました',
      shiftText(c.before) + ' → ' + shiftText(c.after) + ' の申請が却下されました。却下理由: ' + c.rejectReason, 'emp/shift-change');
    return ok({ request: c });
  };

  // ================= 却下理由の定型文(#46) =================
  S.REJECT_TEMPLATES = [
    '人員が充足しているため',
    '人員が不足するため',
    '勤務可能時間の範囲外のため',
    '申請内容とシフト・打刻記録が一致しないため',
    '申請期限を過ぎているため',
  ];

  // ================= 通知(#3) =================
  S.notify = function (userId, title, body, link) {
    state.notifications.push({ id: uid('n'), userId: userId, at: T.nowIso(), read: false, title: title, body: body, link: link || null });
  };
  S.notificationsOf = function (userId) {
    return state.notifications.filter(function (n) { return n.userId === userId; })
      .sort(function (a, b) { return b.at.localeCompare(a.at); });
  };
  S.unreadCount = function (userId) {
    return state.notifications.filter(function (n) { return n.userId === userId && !n.read; }).length;
  };
  S.markRead = function (id) { var n = state.notifications.find(function (x) { return x.id === id; }); if (n) n.read = true; };
  S.markAllRead = function (userId) { state.notifications.forEach(function (n) { if (n.userId === userId) n.read = true; }); };

  // ================= 件数(ホーム表示用) =================
  // 従業員: 申請中の件数(#66)
  S.employeePending = function (userId) {
    var hopes = 0;
    state.hopes.forEach(function (h) {
      if (h.userId !== userId) return;
      Object.keys(h.days).forEach(function (d) { if (h.days[d].status === '申請中') hopes++; });
    });
    return {
      corrections: state.corrections.filter(function (c) { return c.userId === userId && c.status === '申請中'; }).length,
      shiftChanges: state.shiftChanges.filter(function (c) { return c.userId === userId && c.status === '申請中'; }).length,
      hopes: hopes,
    };
  };
  // 勤怠管理者: 未処理件数(#4)
  S.managerPending = function (storeId) {
    return {
      hopes: S.hopeItems(storeId, { status: '申請中' }).length,
      corrections: S.correctionsForStore(storeId, { status: '申請中' }).length,
      shiftChanges: S.shiftChangesForStore(storeId, { status: '申請中' }).length,
    };
  };

  K.S = S;
})();
