/*
 * サンプルデータ。2026 年 10 月を当月、デモ日時を 2026-10-14(水) 13:20 とする。
 * K.seed() は毎回新しい状態オブジェクトを返す(永続化なし)。
 */
window.K = window.K || {};

K.seed = function () {
  var T = K.T;

  // 再現性のある疑似乱数(mulberry32)
  var a = 20261014;
  function rand() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  function rnd(lo, hi) { return lo + Math.floor(rand() * (hi - lo + 1)); }
  function at(date, min, sec) {
    return date + 'T' + T.fromMin(min) + ':' + K.pad(sec === undefined ? rnd(0, 59) : sec);
  }

  var stores = [
    { id: 's1', name: '駅前店', open: '09:00', close: '22:00', required: { weekday: 3, offday: 3 } },
    { id: 's2', name: '北口店', open: '10:00', close: '21:00', required: { weekday: 2, offday: 2 } },
  ];

  // 曜日(0=日〜6=土)ごとの勤務可能時間。null の曜日は勤務不可
  function avail(spec) {
    var out = [];
    for (var w = 0; w < 7; w++) {
      var v = spec[w];
      out.push(v ? { enabled: true, start: v[0], end: v[1] } : { enabled: false, start: '', end: '' });
    }
    return out;
  }
  var wk = function (s, e) { return [s, e]; };

  var users = [
    { id: 'u01', loginId: 'yamamoto', password: 'admin1234', name: '山本 健一', roles: ['管理者'],
      storeId: null, availability: null, breakRule: null },
    { id: 'u02', loginId: 'sato', password: 'kintai1234', name: '佐藤 美咲', roles: ['勤怠管理者', '従業員'],
      storeId: 's1',
      availability: avail({ 1: wk('09:00', '22:00'), 2: wk('09:00', '22:00'), 3: wk('09:00', '22:00'), 4: wk('09:00', '22:00'), 5: wk('09:00', '22:00'), 6: wk('09:00', '18:00') }),
      breakRule: { overHours: 6, minutes: 60 } },
    { id: 'u03', loginId: 'tanaka', password: 'staff1234', name: '田中 陽菜', roles: ['従業員'], storeId: 's1',
      availability: avail({ 0: wk('09:00', '22:00'), 1: wk('13:00', '22:00'), 2: wk('13:00', '22:00'), 3: wk('13:00', '22:00'), 4: wk('13:00', '22:00'), 5: wk('13:00', '22:00'), 6: wk('09:00', '22:00') }),
      breakRule: { overHours: 6, minutes: 45 } },
    { id: 'u04', loginId: 'suzuki', password: 'staff1234', name: '鈴木 大輔', roles: ['従業員'], storeId: 's1',
      availability: avail({ 0: wk('09:00', '22:00'), 1: wk('09:00', '22:00'), 2: wk('09:00', '22:00'), 3: wk('09:00', '22:00'), 4: wk('09:00', '22:00'), 5: wk('09:00', '22:00'), 6: wk('09:00', '22:00') }),
      breakRule: { overHours: 6, minutes: 60 } },
    { id: 'u05', loginId: 'takahashi', password: 'staff1234', name: '高橋 蓮', roles: ['従業員'], storeId: 's1',
      availability: avail({ 0: wk('10:00', '22:00'), 1: wk('17:00', '22:00'), 2: wk('17:00', '22:00'), 3: wk('17:00', '22:00'), 4: wk('17:00', '22:00'), 5: wk('17:00', '22:00'), 6: wk('17:00', '22:00') }),
      breakRule: { overHours: 6, minutes: 45 } },
    { id: 'u06', loginId: 'ito', password: 'staff1234', name: '伊藤 さくら', roles: ['従業員'], storeId: 's1',
      availability: avail({ 1: wk('09:00', '15:00'), 2: wk('09:00', '15:00'), 3: wk('09:00', '15:00'), 4: wk('09:00', '15:00'), 5: wk('09:00', '15:00') }),
      breakRule: { overHours: 6, minutes: 45 } },
    { id: 'u07', loginId: 'watanabe', password: 'kintai1234', name: '渡辺 拓也', roles: ['勤怠管理者', '従業員'], storeId: 's2',
      availability: avail({ 0: wk('10:00', '21:00'), 1: wk('10:00', '21:00'), 2: wk('10:00', '21:00'), 4: wk('10:00', '21:00'), 5: wk('10:00', '21:00'), 6: wk('10:00', '21:00') }),
      breakRule: { overHours: 6, minutes: 60 } },
    { id: 'u08', loginId: 'nakamura', password: 'staff1234', name: '中村 結衣', roles: ['従業員'], storeId: 's2',
      availability: avail({ 1: wk('10:00', '17:00'), 2: wk('10:00', '17:00'), 3: wk('10:00', '17:00'), 4: wk('10:00', '17:00'), 5: wk('10:00', '17:00') }),
      breakRule: { overHours: 6, minutes: 45 } },
    { id: 'u09', loginId: 'kobayashi', password: 'staff1234', name: '小林 翔', roles: ['従業員'], storeId: 's2',
      availability: avail({ 0: wk('10:00', '21:00'), 1: wk('17:00', '21:00'), 2: wk('17:00', '21:00'), 3: wk('17:00', '21:00'), 4: wk('17:00', '21:00'), 5: wk('10:00', '21:00'), 6: wk('10:00', '21:00') }),
      breakRule: { overHours: 6, minutes: 45 } },
    // 登録直後で所属店舗・勤務可能時間・休憩時間が未設定のユーザー(UC-110/112/114 のデモ用)
    { id: 'u10', loginId: 'kato', password: 'staff1234', name: '加藤 優', roles: ['従業員'],
      storeId: null, availability: null, breakRule: null },
  ];
  users.forEach(function (u, i) {
    u.deleted = false;
    u.createdAt = i < 9 ? '2026-04-01T09:00:00' : '2026-10-13T17:30:00';
    u.order = i;
  });

  // 曜日ごとの勤務パターン(10 月分のシフト生成用)
  var patterns = {
    u02: { 1: ['09:00', '21:00'], 2: ['09:00', '21:00'], 3: ['09:00', '21:00'], 4: ['09:00', '21:00'], 5: ['09:00', '21:00'] },
    u03: { 1: ['13:30', '21:00'], 3: ['13:30', '21:00'], 5: ['13:30', '21:00'], 6: ['10:00', '17:00'] },
    u04: { 0: ['09:00', '22:00'], 2: ['09:00', '22:00'], 3: ['09:00', '22:00'], 4: ['09:00', '22:00'], 5: ['09:00', '22:00'], 6: ['09:00', '22:00'] },
    u05: { 0: ['10:00', '18:00'], 1: ['17:00', '22:00'], 2: ['17:00', '22:00'], 4: ['17:00', '22:00'], 5: ['17:00', '22:00'] },
    u06: { 1: ['09:00', '15:00'], 2: ['09:00', '15:00'], 3: ['09:00', '15:00'], 4: ['09:00', '15:00'], 5: ['09:00', '15:00'] },
    u07: { 0: ['10:00', '19:00'], 1: ['10:00', '19:00'], 2: ['10:00', '19:00'], 4: ['10:00', '19:00'], 5: ['10:00', '19:00'], 6: ['10:00', '19:00'] },
    u08: { 1: ['10:00', '16:00'], 2: ['10:00', '16:00'], 3: ['10:00', '16:00'], 4: ['10:00', '16:00'], 5: ['10:00', '16:00'] },
    u09: { 0: ['12:00', '21:00'], 1: ['17:00', '21:00'], 5: ['12:00', '21:00'], 6: ['12:00', '21:00'] },
  };

  var shifts = [];
  var sid = 0;
  function addShift(userId, date, start, end, createdAt, createdBy, source) {
    var s = { id: 'sh' + (++sid), userId: userId, date: date, start: start, end: end,
      createdAt: createdAt, createdBy: createdBy, source: source || '登録' };
    shifts.push(s);
    return s;
  }
  var octDays = T.daysOf('2026-10');
  Object.keys(patterns).forEach(function (uid) {
    var by = (uid === 'u07' || uid === 'u08' || uid === 'u09') ? 'u07' : 'u02';
    octDays.forEach(function (d) {
      var p = patterns[uid][T.dow(d)];
      if (!p) return;
      if (uid === 'u06' && d === '2026-10-30') return; // 削除済み(シフト履歴参照)
      var start = p[0], end = p[1];
      if (uid === 'u05' && d === '2026-10-18') { start = '12:00'; end = '20:00'; } // 変更済み(シフト履歴参照)
      addShift(uid, d, start, end, '2026-09-25T18:00:00', by, '登録');
    });
  });

  var shiftLog = [
    { id: 'lg1', at: '2026-10-05T11:20:00', by: 'u02', type: '変更', via: 'UC-204', storeId: 's1', userId: 'u05',
      before: { date: '2026-10-18', start: '10:00', end: '18:00' }, after: { date: '2026-10-18', start: '12:00', end: '20:00' } },
    { id: 'lg2', at: '2026-10-09T16:45:00', by: 'u02', type: '削除', via: 'UC-205', storeId: 's1', userId: 'u06',
      before: { date: '2026-10-30', start: '09:00', end: '15:00' }, after: null },
  ];

  // ---- 勤怠記録(10/1〜10/13 + 当日) ----
  var attendance = {};
  function rec(uid, date) {
    attendance[uid] = attendance[uid] || {};
    attendance[uid][date] = attendance[uid][date] || { punches: [], override: null, history: [] };
    return attendance[uid][date];
  }
  function punch(uid, date, type, min, sec) {
    rec(uid, date).punches.push({ type: type, at: at(date, min, sec) });
  }

  var today = '2026-10-14';
  shifts.forEach(function (s) {
    if (s.date >= today) return;
    var uid = s.userId, d = s.date;
    var st = T.toMin(s.start), en = T.toMin(s.end);
    var inMin = st - rnd(2, 12), outMin = en + rnd(0, 8);
    var breakPunch = false;
    if (uid === 'u02') { inMin = st - rnd(17, 23); outMin = en + rnd(45, 55); breakPunch = true; } // 長時間(36 協定 注意)
    if (uid === 'u04') { inMin = st - rnd(18, 22); outMin = en + rnd(14, 18); breakPunch = true; }   // 長時間(36 協定 超過)

    // 個別の例外ケース
    if (uid === 'u05' && d === '2026-10-08') return;                         // 欠勤
    if (uid === 'u05' && d === '2026-10-06') inMin = st + 12;                // 遅刻
    if (uid === 'u03' && d === '2026-10-09') inMin = st + 12;                // 遅刻
    if (uid === 'u06' && d === '2026-10-09') outMin = T.toMin('13:30');      // 早退
    if (uid === 'u08' && d === '2026-10-07') inMin = T.toMin('10:25');       // 遅刻(修正申請中)

    var skipIn = uid === 'u03' && d === '2026-10-02';                        // 出勤打刻漏れ(承認済の修正あり)
    var skipOut = (uid === 'u03' && d === '2026-10-07') || (uid === 'u04' && d === '2026-10-13'); // 退勤打刻漏れ

    if (!skipIn) punch(uid, d, '出勤', inMin);
    if (breakPunch) {
      var bs = T.toMin('13:00') + rnd(-10, 10);
      punch(uid, d, '休憩開始', bs);
      punch(uid, d, '休憩終了', bs + rnd(58, 62));
    }
    if (!skipOut) punch(uid, d, '退勤', outMin);
  });
  // 当日(10/14 13:20 時点)
  punch('u02', today, '出勤', T.toMin('08:41'), 12);
  punch('u04', today, '出勤', T.toMin('08:53'), 40);
  punch('u04', today, '休憩開始', T.toMin('13:05'), 3);
  punch('u08', today, '出勤', T.toMin('09:57'), 26);
  // u06(伊藤)は 9:00 開始のシフトがあるが未出勤、u03(田中)は 13:30 開始で未出勤

  // 承認済の修正(田中 10/2)
  var r2 = rec('u03', '2026-10-02');
  var outAt = r2.punches.filter(function (p) { return p.type === '退勤'; })[0].at.slice(11, 16);
  r2.override = { clockIn: '13:30', clockOut: outAt, breakMinutes: 45 };
  r2.history.push({ at: '2026-10-03T10:15:00', by: 'u02', via: '勤怠修正申請の承認(UC-210)',
    reason: '出勤時に打刻ボタンを押し忘れました。13:30 から勤務しています',
    before: { clockIn: null, clockOut: outAt, breakMinutes: 0 }, after: { clockIn: '13:30', clockOut: outAt, breakMinutes: 45 } });

  function firstPunch(uid, date, type) {
    var r = attendance[uid] && attendance[uid][date];
    if (!r) return null;
    var p = r.punches.filter(function (x) { return x.type === type; })[0];
    return p ? p.at.slice(11, 16) : null;
  }

  var corrections = [
    { id: 'cr1', userId: 'u03', date: '2026-10-02',
      before: { clockIn: null, clockOut: outAt, breakMinutes: 0 },
      after: { clockIn: '13:30', clockOut: outAt, breakMinutes: 45 },
      reason: '出勤時に打刻ボタンを押し忘れました。13:30 から勤務しています',
      status: '承認済', createdAt: '2026-10-02T21:10:00', updatedAt: '2026-10-02T21:10:00',
      processedAt: '2026-10-03T10:15:00', processedBy: 'u02', rejectReason: null },
    { id: 'cr2', userId: 'u03', date: '2026-10-05',
      before: { clockIn: firstPunch('u03', '2026-10-05', '出勤'), clockOut: firstPunch('u03', '2026-10-05', '退勤'), breakMinutes: 45 },
      after: { clockIn: '13:00', clockOut: firstPunch('u03', '2026-10-05', '退勤'), breakMinutes: 45 },
      reason: '早めに来て品出しをしていたため、13:00 からの勤務に修正したいです',
      status: '却下', createdAt: '2026-10-05T21:30:00', updatedAt: '2026-10-05T21:30:00',
      processedAt: '2026-10-06T11:00:00', processedBy: 'u02',
      rejectReason: 'シフト開始前の作業は指示されていないため。必要な場合は事前に相談してください' },
    { id: 'cr3', userId: 'u04', date: '2026-10-13',
      before: { clockIn: firstPunch('u04', '2026-10-13', '出勤'), clockOut: null, breakMinutes: 60 },
      after: { clockIn: firstPunch('u04', '2026-10-13', '出勤'), clockOut: '22:06', breakMinutes: 60 },
      reason: '閉店作業のあと退勤の打刻を忘れました',
      status: '申請中', createdAt: '2026-10-14T09:10:00', updatedAt: '2026-10-14T09:10:00',
      processedAt: null, processedBy: null, rejectReason: null },
    { id: 'cr4', userId: 'u08', date: '2026-10-07',
      before: { clockIn: '10:25', clockOut: firstPunch('u08', '2026-10-07', '退勤'), breakMinutes: 0 },
      after: { clockIn: '09:58', clockOut: firstPunch('u08', '2026-10-07', '退勤'), breakMinutes: 0 },
      reason: '出勤時に打刻画面が開かず、10:25 に打刻しました。実際の出勤は 9:58 です',
      status: '申請中', createdAt: '2026-10-07T16:20:00', updatedAt: '2026-10-07T16:20:00',
      processedAt: null, processedBy: null, rejectReason: null },
  ];

  function findShift(uid, date) {
    return shifts.filter(function (s) { return s.userId === uid && s.date === date; })[0];
  }
  var shTk = findShift('u05', '2026-10-20');
  var shIt = findShift('u06', '2026-10-16');
  var shTn = findShift('u03', '2026-10-10');
  var shKb = findShift('u09', '2026-10-23');
  var shiftChanges = [
    { id: 'sc1', userId: 'u05', shiftId: shTk.id,
      before: { date: shTk.date, start: shTk.start, end: shTk.end },
      after: { date: '2026-10-21', start: '17:00', end: '22:00' },
      reason: '学校の試験と重なったため、翌日に変更したいです',
      status: '申請中', createdAt: '2026-10-13T18:05:00', processedAt: null, processedBy: null, rejectReason: null },
    { id: 'sc2', userId: 'u06', shiftId: shIt.id,
      before: { date: shIt.date, start: shIt.start, end: shIt.end },
      after: { date: '2026-10-16', start: '10:00', end: '15:00' },
      reason: '子どもの通院に付き添うため、開始を 1 時間遅らせたいです',
      status: '申請中', createdAt: '2026-10-14T08:30:00', processedAt: null, processedBy: null, rejectReason: null },
    { id: 'sc3', userId: 'u03', shiftId: shTn.id,
      before: { date: shTn.date, start: shTn.start, end: shTn.end },
      after: { date: '2026-10-11', start: '10:00', end: '17:00' },
      reason: '家族の用事のため、日曜に変更したいです',
      status: '却下', createdAt: '2026-10-06T20:00:00', processedAt: '2026-10-07T12:00:00', processedBy: 'u02',
      rejectReason: '土曜の人員が不足するため' },
    { id: 'sc4', userId: 'u09', shiftId: shKb.id,
      before: { date: shKb.date, start: shKb.start, end: shKb.end },
      after: { date: '2026-10-22', start: '17:00', end: '21:00' },
      reason: 'サークルの合宿のため、前日の夕方に変更したいです',
      status: '申請中', createdAt: '2026-10-12T22:15:00', processedAt: null, processedBy: null, rejectReason: null },
  ];

  // ---- シフト希望(2026 年 11 月分、受付期間 10/1〜10/20) ----
  function hopeDays(list) {
    var days = {};
    list.forEach(function (x) {
      days[x[0]] = { kind: x[1], start: x[2] || '', end: x[3] || '',
        status: x[1] === '休日希望' ? null : (x[4] || '申請中'),
        rejectReason: x[5] || null, processedAt: x[6] || null, processedBy: x[6] ? 'u02' : null, shiftId: null };
    });
    return days;
  }
  var nov = T.daysOf('2026-11');
  var tanakaDays = [];
  nov.forEach(function (d) {
    var w = T.dow(d);
    if (d === '2026-11-14' || d === '2026-11-15' || d === '2026-11-23') tanakaDays.push([d, '休日希望']);
    else if (d === '2026-11-18') tanakaDays.push([d, '時間指定', '10:00', '21:00']); // 勤務可能時間外(UC-207 Alt-3 のデモ)
    else if (w === 1 || w === 3 || w === 5) tanakaDays.push([d, '時間指定', '13:30', '21:00']);
    else if (w === 6) tanakaDays.push([d, '出勤可能']);
  });
  var suzukiDays = [
    ['2026-11-01', '時間指定', '09:00', '22:00', '承認済', null, '2026-10-09T15:00:00'],
    ['2026-11-02', '休日希望'],
    ['2026-11-03', '時間指定', '09:00', '22:00', '却下', '祝日は人員が充足しているため', '2026-10-09T15:02:00'],
    ['2026-11-04', '時間指定', '09:00', '22:00', '承認済', null, '2026-10-09T15:00:00'],
    ['2026-11-05', '時間指定', '09:00', '22:00', '承認済', null, '2026-10-09T15:00:00'],
    ['2026-11-06', '時間指定', '09:00', '22:00', '承認済', null, '2026-10-09T15:00:00'],
    ['2026-11-07', '時間指定', '09:00', '22:00', '承認済', null, '2026-10-09T15:00:00'],
    ['2026-11-08', '時間指定', '09:00', '22:00'],
    ['2026-11-09', '休日希望'],
    ['2026-11-10', '時間指定', '09:00', '22:00'],
    ['2026-11-11', '出勤可能'],
    ['2026-11-12', '時間指定', '09:00', '22:00'],
    ['2026-11-13', '時間指定', '09:00', '22:00'],
  ];
  var itoDays = [];
  T.range('2026-11-02', '2026-11-20').forEach(function (d) {
    var w = T.dow(d);
    if (w === 0 || w === 6) return;
    if (d === '2026-11-03') itoDays.push([d, '休日希望']);
    else itoDays.push([d, '時間指定', '09:00', '15:00']);
  });
  var nakamuraDays = T.range('2026-11-02', '2026-11-06').map(function (d) {
    return d === '2026-11-03' ? [d, '休日希望'] : [d, '時間指定', '10:00', '16:00'];
  });

  var hopes = [
    { id: 'hp1', userId: 'u03', month: '2026-11', submittedAt: '2026-10-08T20:15:00', updatedAt: '2026-10-08T20:15:00', days: hopeDays(tanakaDays) },
    { id: 'hp2', userId: 'u04', month: '2026-11', submittedAt: '2026-10-05T22:40:00', updatedAt: '2026-10-05T22:40:00', days: hopeDays(suzukiDays) },
    { id: 'hp3', userId: 'u06', month: '2026-11', submittedAt: '2026-10-10T10:05:00', updatedAt: '2026-10-10T10:05:00', days: hopeDays(itoDays) },
    { id: 'hp4', userId: 'u08', month: '2026-11', submittedAt: '2026-10-11T12:30:00', updatedAt: '2026-10-11T12:30:00', days: hopeDays(nakamuraDays) },
    // 10 月分(受付終了済み、UC-311 の過去月表示用)
    { id: 'hp0', userId: 'u03', month: '2026-10', submittedAt: '2026-09-12T19:00:00', updatedAt: '2026-09-12T19:00:00',
      days: hopeDays(T.daysOf('2026-10').filter(function (d) { var w = T.dow(d); return w === 1 || w === 3 || w === 5 || w === 6; })
        .map(function (d) {
          return T.dow(d) === 6 ? [d, '時間指定', '10:00', '17:00', '承認済', null, '2026-09-24T10:00:00']
            : [d, '時間指定', '13:30', '21:00', '承認済', null, '2026-09-24T10:00:00'];
        })) },
  ];
  // 承認済みのシフト希望 → シフト
  hopes.forEach(function (h) {
    Object.keys(h.days).forEach(function (d) {
      var x = h.days[d];
      if (x.status !== '承認済') return;
      var existing = findShift(h.userId, d);
      if (existing) { x.shiftId = existing.id; return; }
      var s = addShift(h.userId, d, x.start, x.end, x.processedAt, 'u02', 'シフト希望');
      x.shiftId = s.id;
    });
  });

  var notifications = [
    { id: 'n1', userId: 'u03', at: '2026-09-25T18:00:00', read: true, title: 'シフトが登録されました',
      body: '2026年10月のシフトが登録されました。', link: 'emp/shifts' },
    { id: 'n2', userId: 'u03', at: '2026-10-03T10:15:00', read: true, title: '勤怠修正申請が承認されました',
      body: '10/2(金) の勤怠修正申請が承認されました。', link: 'emp/corrections' },
    { id: 'n3', userId: 'u03', at: '2026-10-06T11:00:00', read: false, title: '勤怠修正申請が却下されました',
      body: '10/5(月) の勤怠修正申請が却下されました。却下理由: シフト開始前の作業は指示されていないため。必要な場合は事前に相談してください', link: 'emp/corrections' },
    { id: 'n4', userId: 'u03', at: '2026-10-07T12:00:00', read: false, title: 'シフト日時変更申請が却下されました',
      body: '10/10(土) 10:00〜17:00 → 10/11(日) 10:00〜17:00 の申請が却下されました。却下理由: 土曜の人員が不足するため', link: 'emp/shift-change' },
    { id: 'n5', userId: 'u04', at: '2026-10-09T15:00:00', read: false, title: 'シフト希望が承認されました',
      body: '11/1(日)・11/4(水)〜11/7(土) のシフト希望が承認され、シフトに登録されました。', link: 'emp/hopes' },
    { id: 'n6', userId: 'u04', at: '2026-10-09T15:02:00', read: false, title: 'シフト希望が却下されました',
      body: '11/3(火) のシフト希望が却下されました。却下理由: 祝日は人員が充足しているため', link: 'emp/hopes' },
  ];

  return {
    stores: stores,
    users: users,
    shifts: shifts,
    shiftLog: shiftLog,
    attendance: attendance,
    corrections: corrections,
    shiftChanges: shiftChanges,
    hopes: hopes,
    notifications: notifications,
    settings: { fault: false, hopeOverride: null },
    session: null,
  };
};
