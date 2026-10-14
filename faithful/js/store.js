/*
 * メモリ上の状態(全ロール共通)とサンプルデータ
 * - 永続化なし。ページを再読み込みすると初期状態に戻る
 * - 画面ファイル(screens-*.js)はここの state を直接読み書きし、K.store のヘルパーを使う
 */
window.K = window.K || {};
(function () {
  const TODAY = '2026-10-14'; // 当月 = 2026年10月(モック固定)
  const WD = ['日', '月', '火', '水', '木', '金', '土'];
  const pad = (n) => String(n).padStart(2, '0');

  // ───────── 日付・時刻ユーティリティ ─────────
  const dateObj = (d) => new Date(d + 'T00:00:00');
  const ymd = (dt) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
  const weekday = (d) => WD[dateObj(d).getDay()];
  const fmtDate = (d) => { const x = dateObj(d); return `${x.getMonth() + 1}/${x.getDate()}(${WD[x.getDay()]})`; };
  const fmtMonth = (ym) => `${ym.slice(0, 4)}年${Number(ym.slice(5, 7))}月`;
  const daysOfMonth = (ym) => {
    const [y, m] = ym.split('-').map(Number);
    const n = new Date(y, m, 0).getDate();
    return Array.from({ length: n }, (_, i) => `${ym}-${pad(i + 1)}`);
  };
  const addMonths = (ym, k) => { const [y, m] = ym.split('-').map(Number); const x = new Date(y, m - 1 + k, 1); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}`; };
  const addDays = (d, k) => { const x = dateObj(d); x.setDate(x.getDate() + k); return ymd(x); };
  /** 'HH:MM' or 'HH:MM:SS' → 分(秒は切り捨て。#64) */
  const minutes = (t) => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const hm = (t) => (t ? t.slice(0, 5) : '');
  const fmtMinutes = (n) => (n == null ? '' : `${Math.floor(n / 60)}:${pad(n % 60)}`);
  /** モックの現在日時: 日付は 2026-10-14 固定、時刻は実時刻 */
  const now = () => { const r = new Date(); return new Date(2026, 9, 14, r.getHours(), r.getMinutes(), r.getSeconds()); };
  const nowTime = () => { const x = now(); return `${pad(x.getHours())}:${pad(x.getMinutes())}:${pad(x.getSeconds())}`; };
  const nowStamp = () => `${TODAY} ${nowTime()}`;
  const fmtStamp = (s) => (s ? `${fmtDate(s.slice(0, 10))} ${s.slice(11, 16)}` : '');

  // ───────── サンプルデータ ─────────
  const stores = [
    { id: 'S1', name: '渋谷店' },
    { id: 'S2', name: '新宿店' },
  ];

  const av = (spec) => { // spec: { 月: ['09:00','22:00'], ... } → availability
    const o = {};
    for (const d of ['月', '火', '水', '木', '金', '土', '日']) o[d] = spec[d] ? { start: spec[d][0], end: spec[d][1] } : null;
    return o;
  };
  const every = (s, e, days = '月火水木金土日') => Object.fromEntries([...days].map((d) => [d, [s, e]]));

  const users = [
    { id: 'U01', loginId: 'admin01', password: 'password', name: '山本 恵子', role: '管理者', storeId: null, chargeStoreIds: [], availability: null, breakTime: null, status: '退勤中', deleted: false },
    { id: 'U02', loginId: 'manager01', password: 'password', name: '佐藤 健一', role: '勤怠管理者', storeId: 'S1', chargeStoreIds: ['S1'], availability: null, breakTime: null, status: '退勤中', deleted: false },
    { id: 'U03', loginId: 'manager02', password: 'password', name: '中村 美咲', role: '勤怠管理者', storeId: 'S2', chargeStoreIds: ['S2'], availability: null, breakTime: null, status: '退勤中', deleted: false },
    { id: 'U11', loginId: 'emp01', password: 'password', name: '田中 陽菜', role: '従業員', storeId: 'S1', chargeStoreIds: [], availability: av({ ...every('09:00', '22:00', '月火水木金'), 土: ['10:00', '18:00'] }), breakTime: '60分', status: '退勤中', deleted: false },
    { id: 'U12', loginId: 'emp02', password: 'password', name: '鈴木 大輔', role: '従業員', storeId: 'S1', chargeStoreIds: [], availability: av(every('08:00', '23:00', '月火木金土日')), breakTime: '45分', status: '退勤中', deleted: false },
    { id: 'U13', loginId: 'emp03', password: 'password', name: '高橋 さくら', role: '従業員', storeId: 'S1', chargeStoreIds: [], availability: av(every('08:00', '18:00', '月火水木金')), breakTime: '60分', status: '出勤中', deleted: false },
    { id: 'U14', loginId: 'emp04', password: 'password', name: '伊藤 翔太', role: '従業員', storeId: 'S1', chargeStoreIds: [], availability: av(every('12:00', '23:00')), breakTime: '30分', status: '退勤中', deleted: false },
    { id: 'U15', loginId: 'emp05', password: 'password', name: '渡辺 結衣', role: '従業員', storeId: 'S2', chargeStoreIds: [], availability: av(every('09:00', '20:00', '月火水木金')), breakTime: '45分', status: '退勤中', deleted: false },
    { id: 'U16', loginId: 'emp06', password: 'password', name: '小林 拓海', role: '従業員', storeId: 'S2', chargeStoreIds: [], availability: av(every('10:00', '23:00')), breakTime: '60分', status: '退勤中', deleted: false },
    { id: 'U17', loginId: 'emp07', password: 'password', name: '加藤 美月', role: '従業員', storeId: 'S2', chargeStoreIds: [], availability: av(every('09:00', '21:00', '土日')), breakTime: '60分', status: '退勤中', deleted: false },
    // 登録直後で所属店舗・勤務可能時間・休憩時間が未設定のユーザー(UC-110/112/114 のデモ用)
    { id: 'U18', loginId: 'emp08', password: 'password', name: '吉田 蓮', role: '従業員', storeId: null, chargeStoreIds: [], availability: null, breakTime: null, status: '退勤中', deleted: false },
  ];

  // シフトの勤務パターン(曜日 → 時間帯)
  const patterns = {
    U11: { 月: ['10:00', '18:00'], 水: ['10:00', '18:00'], 金: ['10:00', '18:00'], 土: ['10:00', '16:00'] },
    U12: { 火: ['17:00', '22:00'], 木: ['17:00', '22:00'], 土: ['17:00', '22:00'], 日: ['17:00', '22:00'] },
    U13: { 月: ['09:00', '17:00'], 火: ['09:00', '17:00'], 水: ['09:00', '17:00'], 木: ['09:00', '17:00'], 金: ['09:00', '17:00'] },
    U14: { 水: ['17:00', '22:00'], 土: ['17:00', '22:00'], 日: ['17:00', '22:00'] },
    U15: { 月: ['09:00', '15:00'], 火: ['09:00', '15:00'], 木: ['09:00', '15:00'] },
    U16: { 水: ['15:00', '23:00'], 金: ['15:00', '23:00'], 土: ['15:00', '23:00'] },
    U17: { 土: ['09:00', '17:00'], 日: ['09:00', '17:00'] },
  };

  let seq = 1;
  const id = (prefix) => `${prefix}${seq++}`;

  const shifts = [];
  for (const ym of ['2026-09', '2026-10']) { // 11月は未登録(UC-308 Ex-1 のデモ用)
    for (const d of daysOfMonth(ym)) {
      for (const [uid, p] of Object.entries(patterns)) {
        const t = p[weekday(d)];
        if (t) shifts.push({ id: id('SH'), userId: uid, date: d, start: t[0], end: t[1] });
      }
    }
  }

  // 勤怠記録: 今日より前のシフト日について、シフト時刻の前後数分で打刻した体で生成
  const sec = (n) => pad(n % 60);
  const shiftTime = (t, deltaMin, s) => { const m = minutes(t) + deltaMin; return `${pad(Math.floor(m / 60))}:${pad(m % 60)}:${sec(s)}`; };
  const exceptions = { // 'uid date' → 上書き
    'U11 2026-10-02': { clockIn: '10:07:31', clockOut: '18:01:10' }, // 遅刻
    'U11 2026-10-09': { clockIn: '09:58:40', clockOut: null }, // 退勤打刻漏れ
    'U12 2026-10-06': { clockIn: '16:56:02', clockOut: '21:30:44' }, // 早退
    'U12 2026-10-11': 'none', // 打刻なし
    'U14 2026-10-10': 'none',
    'U16 2026-10-09': { clockIn: '14:58:20', clockOut: null },
    'U13 2026-10-05': { clockIn: '08:58:00', clockOut: '17:00:30' }, // FR(承認済)で修正済み
  };
  const records = [];
  let k = 0;
  for (const s of shifts) {
    if (s.date >= TODAY) continue;
    const ex = exceptions[`${s.userId} ${s.date}`];
    if (ex === 'none') continue;
    const u = users.find((x) => x.id === s.userId);
    k++;
    records.push({
      id: id('RC'), userId: s.userId, date: s.date,
      clockIn: ex ? ex.clockIn : shiftTime(s.start, -(k % 5) - 1, k * 7),
      clockOut: ex ? ex.clockOut : shiftTime(s.end, k % 4, k * 13),
      breakTime: u.breakTime,
    });
  }
  // 今日: 高橋は出勤済み(勤務ステータス=出勤中)
  records.push({ id: id('RC'), userId: 'U13', date: TODAY, clockIn: '08:55:12', clockOut: null, breakTime: '60分' });
  const punches = [{ id: id('PN'), userId: 'U13', type: '出勤', at: `${TODAY} 08:55:12` }];

  // 勤怠修正申請(status は勤怠管理者側の語で保持: 未処理/承認済/却下。従業員側の表示は #56)
  const fixRequests = [
    { id: id('FX'), userId: 'U11', date: '2026-10-09', before: { clockIn: '09:58:40', clockOut: null }, after: { clockIn: '09:58', clockOut: '18:02' },
      reason: '退勤打刻を忘れたため', status: '未処理', rejectReason: '', submittedAt: '2026-10-10 09:12:44', processedAt: null, processedBy: null },
    { id: id('FX'), userId: 'U11', date: '2026-10-02', before: { clockIn: '10:07:31', clockOut: '18:01:10' }, after: { clockIn: '09:59', clockOut: '18:01' },
      reason: '打刻ボタンを押すのが遅れたため', status: '却下', rejectReason: '打刻時刻どおりの記録とします(入店時刻の記録がないため)', submittedAt: '2026-10-02 18:10:05', processedAt: '2026-10-03 10:20:00', processedBy: 'U02' },
    { id: id('FX'), userId: 'U12', date: '2026-10-07', before: { clockIn: null, clockOut: null }, after: { clockIn: '17:00', clockOut: '22:00' },
      reason: 'ヘルプで出勤したが、シフトがなく打刻できなかったため', status: '未処理', rejectReason: '', submittedAt: '2026-10-08 11:30:00', processedAt: null, processedBy: null },
    { id: id('FX'), userId: 'U13', date: '2026-10-05', before: { clockIn: '09:12:05', clockOut: '17:00:30' }, after: { clockIn: '08:58', clockOut: '17:00' },
      reason: '出勤打刻の押し忘れに後から気づいたため', status: '承認済', rejectReason: '', submittedAt: '2026-10-05 17:05:00', processedAt: '2026-10-06 09:00:00', processedBy: 'U02' },
    { id: id('FX'), userId: 'U16', date: '2026-10-09', before: { clockIn: '14:58:20', clockOut: null }, after: { clockIn: '14:58', clockOut: '23:01' },
      reason: '退勤打刻を忘れたため', status: '未処理', rejectReason: '', submittedAt: '2026-10-10 15:00:00', processedAt: null, processedBy: null },
  ];

  // シフト希望(期間単位の提出。日ごとの行に処理状態を持つ。#48)
  const WISH_PERIOD = '2026-11';
  const wish = (uid, submittedAt, fn) => ({
    id: id('WS'), userId: uid, period: WISH_PERIOD, submittedAt, updatedAt: submittedAt,
    days: daysOfMonth(WISH_PERIOD).map((d) => ({ date: d, ...fn(weekday(d), d), status: '未処理', rejectReason: '', processedAt: null })),
  });
  const blank = { kind: '', start: '', end: '' };
  const wishSubmissions = [
    wish('U12', '2026-10-10 21:40:00', (w, d) => (
      d === '2026-11-14' ? { kind: '休日希望', start: '', end: '' }
        : '火木土日'.includes(w) ? { kind: '時間指定', start: '17:00', end: '22:00' }
          : w === '金' ? { kind: '出勤可能', start: '', end: '' } : blank)),
    wish('U14', '2026-10-12 23:05:00', (w) => (
      '水土日'.includes(w) ? { kind: '時間指定', start: '17:00', end: '22:00' } : w === '月' ? { kind: '休日希望', start: '', end: '' } : blank)),
    wish('U15', '2026-10-11 08:15:00', (w) => (
      '月火木'.includes(w) ? { kind: '時間指定', start: '09:00', end: '15:00' } : w === '水' ? { kind: '出勤可能', start: '', end: '' } : blank)),
  ];

  // シフト日時変更申請(UC-214〜216。従業員側の送信は UC-309 TBD ページの導出フォーム #94)
  const findShift = (uid, d) => shifts.find((s) => s.userId === uid && s.date === d);
  const cr = (uid, d, after, reason, submittedAt) => {
    const s = findShift(uid, d);
    return { id: id('CR'), userId: uid, shiftId: s.id, before: { date: s.date, start: s.start, end: s.end }, after, reason,
      status: '未処理', rejectReason: '', submittedAt, processedAt: null, processedBy: null };
  };
  const changeRequests = [
    cr('U13', '2026-10-23', { date: '2026-10-23', start: '10:00', end: '17:00' }, '通院のため開始時刻を1時間遅らせたい', '2026-10-12 19:20:00'),
    cr('U14', '2026-10-17', { date: '2026-10-18', start: '17:00', end: '22:00' }, '学校行事と重なったため', '2026-10-13 22:10:00'), // 10/18 に既存シフトあり → 重複
    cr('U16', '2026-10-23', { date: '2026-10-22', start: '15:00', end: '23:00' }, '家族の予定のため前日に移したい', '2026-10-13 12:00:00'),
  ];

  const state = {
    stores, users, shifts, records, punches, fixRequests, wishSubmissions, changeRequests,
    histories: [], // 変更履歴・削除履歴・修正履歴(表示UCなし #12)
    events: [], // モック操作パネルのイベントログ(通知 #5・履歴 #12・デモ操作)
    session: { userId: null },
    settings: { wishPeriod: WISH_PERIOD, wishAccepting: true, annotations: true },
    faults: {}, // 障害注入(一回限り)
  };

  // ───────── 障害注入(ドキュメントに書かれた例外・代替フローの再現用) ─────────
  const FAULTS = [
    { key: 'UC-002-Ex1', label: 'UC-002 Ex-1 ログアウト処理に失敗' },
    { key: 'UC-105-Ex2', label: 'UC-105 Ex-2 ユーザーの削除に失敗' },
    { key: 'UC-116-Alt1', label: 'UC-116 Alt-1 ユーザーが登録されていない(#25)' },
    { key: 'UC-116-Ex1', label: 'UC-116 Ex-1 ユーザー情報の取得に失敗' },
    { key: 'UC-116-Ex2', label: 'UC-116 Ex-2 システムエラー' },
    { key: 'ADMIN-USER-GONE', label: 'UC-104〜115 Ex 対象ユーザーが存在しない' },
    { key: 'ADMIN-STORE-GONE', label: 'UC-110/111 Ex-2 指定した店舗が存在しない' },
    { key: 'ADMIN-ROLE-INVALID', label: 'UC-106/107 Ex-2 指定した権限が不正' },
    { key: 'MGR-ALREADY-PROCESSED', label: 'UC-207/208/210/211/215/216 Alt 対象が処理済み・取り下げ済み(#51)' },
    { key: 'UC-215-Alt2', label: 'UC-215 Alt-2 変更前のシフトが勤務済み・削除済み' },
    { key: 'UC-304-Ex3', label: 'UC-304 Ex-3 打刻情報の保存に失敗' },
    { key: 'UC-305-Ex1', label: 'UC-305 Ex-1 認識不能な打刻種類が渡された(#74)' },
    { key: 'UC-305-Ex2', label: 'UC-305 Ex-2 勤務ステータスの表示更新に失敗' },
    { key: 'UC-308-Ex2', label: 'UC-308 Ex-2 シフトデータの取得に失敗' },
    { key: 'UC-310-Ex2', label: 'UC-310 Ex-2 申請データの取得に失敗' },
    { key: 'UC-311-Ex2', label: 'UC-311 Ex-2 シフト希望データの取得に失敗' },
  ];
  /** 障害が注入されていれば true を返し、注入を解除する(一回限り) */
  const takeFault = (key) => { if (state.faults[key]) { delete state.faults[key]; event('デモ', `障害注入を消費: ${key}`); return true; } return false; };

  // ───────── イベントログ ─────────
  const listeners = new Set();
  const onEvent = (fn) => listeners.add(fn);
  function event(kind, text) {
    state.events.unshift({ at: nowStamp(), kind, text });
    listeners.forEach((fn) => fn());
  }
  /** 従業員への通知(方式TBD #5): 画面は作らずイベントログに記録するだけ */
  const notify = (userId, text) => event('通知', `→ ${user(userId)?.name ?? userId}: ${text}(通知方式TBD #5)`);
  /** 履歴の記録(表示UCなし #12) */
  function history(kind, payload) {
    state.histories.push({ id: id('HS'), kind, at: nowStamp(), by: state.session.userId, ...payload });
    event('履歴', `${kind}を記録: ${payload.summary ?? ''}`);
  }

  // ───────── 参照ヘルパー ─────────
  const user = (uid) => state.users.find((u) => u.id === uid);
  const me = () => user(state.session.userId);
  const storeName = (sid) => state.stores.find((s) => s.id === sid)?.name ?? '';
  const activeUsers = () => state.users.filter((u) => !u.deleted);
  /** 担当店舗の従業員(#42: 担当店舗に所属し、権限が「従業員」のユーザー) */
  const employeesOf = (storeIds) => activeUsers().filter((u) => u.role === '従業員' && storeIds.includes(u.storeId));
  const shiftsOf = (uid, date) => state.shifts.filter((s) => s.userId === uid && (!date || s.date === date));
  const recordOf = (uid, date) => state.records.find((r) => r.userId === uid && r.date === date);

  /** 同じ従業員の登録済みシフトとの重複(時間帯が1分でも重なれば重複) */
  const overlaps = (uid, date, start, end, excludeShiftId) => state.shifts.filter((s) =>
    s.userId === uid && s.date === date && s.id !== excludeShiftId && minutes(s.start) < minutes(end) && minutes(start) < minutes(s.end));

  /**
   * 勤務可能時間の範囲チェック
   * - { ok: true } / { ok: false, reason: 'unset' } (未設定 → #43 TBD) / { ok: false, reason: 'out', text } (範囲外)
   * - 空欄の曜日は勤務可能時間なし(=範囲外)として扱う(#37)
   */
  function availabilityCheck(uid, date, start, end) {
    const u = user(uid);
    if (!u || !u.availability) return { ok: false, reason: 'unset' };
    const a = u.availability[weekday(date)];
    const text = availabilityText(u);
    if (!a) return { ok: false, reason: 'out', text };
    if (minutes(start) < minutes(a.start) || minutes(end) > minutes(a.end)) return { ok: false, reason: 'out', text };
    return { ok: true };
  }
  const availabilityText = (u) => (u.availability
    ? ['月', '火', '水', '木', '金', '土', '日'].map((d) => `${d} ${u.availability[d] ? `${u.availability[d].start}〜${u.availability[d].end}` : '—'}`).join(' / ')
    : '未設定');

  /** シフトの勤務済み/勤務中の判定(#45) */
  function shiftState(s) {
    if (s.date < TODAY) return '勤務済み';
    if (s.date === TODAY && ['出勤中', '休憩中'].includes(user(s.userId)?.status)) return '勤務中';
    return '';
  }

  K.store = {
    TODAY, WD, state, FAULTS,
    id, event, onEvent, notify, history, takeFault,
    user, me, storeName, activeUsers, employeesOf, shiftsOf, recordOf, overlaps, availabilityCheck, availabilityText, shiftState,
    now, nowTime, nowStamp, fmtStamp, fmtDate, fmtMonth, daysOfMonth, addMonths, addDays, weekday, minutes, hm, fmtMinutes, pad,
  };
})();
