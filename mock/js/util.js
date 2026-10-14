/*
 * 日付・時刻ユーティリティとフォーマッタ。
 * デモ時計は 2026-10-14(水) 13:20 を起点に、ページを開いてからの実時間で進む。
 */
window.K = window.K || {};

(function () {
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var DEMO_BASE = new Date(2026, 9, 14, 13, 20, 0).getTime();
  var loadedAt = Date.now();
  var WD = ['日', '月', '火', '水', '木', '金', '土'];

  var T = {
    now: function () { return new Date(DEMO_BASE + (Date.now() - loadedAt)); },
    today: function () { return T.ymd(T.now()); },
    ymd: function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); },
    hms: function (d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); },
    // 'YYYY-MM-DDTHH:MM:SS'(タイムゾーンなしのローカル時刻)
    nowIso: function () { var d = T.now(); return T.ymd(d) + 'T' + T.hms(d); },
    nowHM: function () { var d = T.now(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); },
    parse: function (ymd) { var p = ymd.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); },
    addDays: function (ymd, n) { var d = T.parse(ymd); d.setDate(d.getDate() + n); return T.ymd(d); },
    dow: function (ymd) { return T.parse(ymd).getDay(); },
    month: function (ymd) { return ymd.slice(0, 7); },
    thisMonth: function () { return T.month(T.today()); },
    addMonths: function (ym, n) {
      var p = ym.split('-').map(Number);
      var d = new Date(p[0], p[1] - 1 + n, 1);
      return d.getFullYear() + '-' + pad(d.getMonth() + 1);
    },
    daysOf: function (ym) {
      var p = ym.split('-').map(Number);
      var n = new Date(p[0], p[1], 0).getDate();
      var out = [];
      for (var i = 1; i <= n; i++) out.push(ym + '-' + pad(i));
      return out;
    },
    range: function (from, to) {
      var out = [];
      for (var d = from; d <= to; d = T.addDays(d, 1)) out.push(d);
      return out;
    },
    // 'HH:MM' / 'HH:MM:SS' → 分(秒は切り捨て。判断ログ #59)
    toMin: function (t) {
      if (!t) return null;
      var p = t.split(':').map(Number);
      return p[0] * 60 + p[1];
    },
    fromMin: function (m) { return pad(Math.floor(m / 60)) + ':' + pad(m % 60); },
    validTime: function (t) { return typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t); },
    validDate: function (d) { return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d); },
    // 2026-09〜2026-12 の祝日(デモ範囲)
    HOLIDAYS: {
      '2026-09-21': '敬老の日', '2026-09-22': '国民の休日', '2026-09-23': '秋分の日',
      '2026-10-12': 'スポーツの日', '2026-11-03': '文化の日', '2026-11-23': '勤労感謝の日',
    },
    holiday: function (ymd) { return T.HOLIDAYS[ymd] || null; },
    isOffDay: function (ymd) { var w = T.dow(ymd); return w === 0 || w === 6 || !!T.HOLIDAYS[ymd]; },
    WD: WD,
  };

  var fmt = {
    wd: function (ymd) { return WD[T.dow(ymd)]; },
    // '10/14(水)'
    date: function (ymd) {
      if (!ymd) return '—';
      var p = ymd.split('-');
      return Number(p[1]) + '/' + Number(p[2]) + '(' + WD[T.dow(ymd)] + ')';
    },
    // '2026/10/14(水)'
    dateFull: function (ymd) {
      if (!ymd) return '—';
      return ymd.replace(/-/g, '/') + '(' + WD[T.dow(ymd)] + ')';
    },
    // '2026年10月'
    month: function (ym) { var p = ym.split('-'); return p[0] + '年' + Number(p[1]) + '月'; },
    // '10/14 13:20'
    dt: function (iso) {
      if (!iso) return '—';
      var d = iso.slice(0, 10).split('-');
      return Number(d[1]) + '/' + Number(d[2]) + ' ' + iso.slice(11, 16);
    },
    // '2026/10/14 13:20'
    dtFull: function (iso) {
      if (!iso) return '—';
      return iso.slice(0, 10).replace(/-/g, '/') + ' ' + iso.slice(11, 16);
    },
    time: function (t) { return t ? t.slice(0, 5) : '—'; },
    timeSec: function (t) { return t ? (t.length === 5 ? t + ':00' : t.slice(0, 8)) : '—'; },
    // 分 → 'H:MM'
    dur: function (m) {
      if (m === null || m === undefined) return '—';
      var neg = m < 0; m = Math.abs(m);
      return (neg ? '-' : '') + Math.floor(m / 60) + ':' + pad(m % 60);
    },
    // 分 → 'X時間Y分'
    durJa: function (m) {
      if (m === null || m === undefined) return '—';
      var h = Math.floor(m / 60), mm = m % 60;
      if (h === 0) return mm + '分';
      return h + '時間' + (mm ? mm + '分' : '');
    },
    range: function (a, b) { return fmt.time(a) + '〜' + fmt.time(b); },
  };

  K.T = T;
  K.fmt = fmt;
  K.pad = pad;
})();
