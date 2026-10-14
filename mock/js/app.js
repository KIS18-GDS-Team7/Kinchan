/*
 * ルーター・ロール別レイアウト・共通画面(ログイン、通知一覧、判断ログ)・デモ操作バー。
 *
 * 画面(view)の登録: K.views['emp/home'] = {
 *   role: '従業員' | '勤怠管理者' | '管理者',   // 表示に必要な権限(ヘッダーの「表示する画面」)
 *   title: '画面名' | function (params) {...},
 *   tab: 'home' | 'attendance' | 'shifts' | 'requests' | 'menu',             // 従業員の下部タブ
 *   nav: 'home' | 'shifts' | 'hopes' | ... ,                                  // PC のサイドメニュー
 *   render: function (params) { return 'HTML'; },
 *   mount: function (el, params) { ...イベント登録... },                      // 任意
 * };
 * 状態を変えたら K.app.refresh()(同じ画面を再描画)か K.app.go(path, params)(遷移)を呼ぶ。
 */
window.K = window.K || {};
K.views = K.views || {};

(function () {
  var S = K.S, ui = K.ui, T = K.T, fmt = K.fmt, esc = ui.esc;
  var app = K.app = {};
  var root;
  var lastPath = null;

  // ---------------- ルーティング ----------------
  app.parse = function () {
    var h = location.hash.replace(/^#\/?/, '');
    var i = h.indexOf('?');
    var path = i >= 0 ? h.slice(0, i) : h;
    var params = {};
    if (i >= 0) {
      h.slice(i + 1).split('&').forEach(function (kv) {
        if (!kv) return;
        var p = kv.split('=');
        params[decodeURIComponent(p[0])] = decodeURIComponent((p[1] || '').replace(/\+/g, ' '));
      });
    }
    return { path: path, params: params };
  };
  app.href = function (path, params) {
    var q = Object.keys(params || {}).filter(function (k) { return params[k] !== undefined && params[k] !== null && params[k] !== ''; })
      .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&');
    return '#/' + path + (q ? '?' + q : '');
  };
  app.go = function (path, params) {
    var h = app.href(path, params);
    if (location.hash === h) app.refresh();
    else location.hash = h;
  };
  app.refresh = function () { render(true); };
  app.home = function () { return S.HOME[S.view()] || 'login'; };

  function render(keepScroll) {
    var r = app.parse();
    var me = S.me();
    var y = window.scrollY;
    try {
      if (!r.path) return app.go(me ? app.home() : 'login');
      if (r.path === 'login') {
        if (me) return app.go(app.home());
        return paint(K.views.login, r, 'blank', keepScroll, y);
      }
      if (r.path === 'decisions') return paint(K.views.decisions, r, 'doc', keepScroll, y);
      // ログアウト後はログインが必要な画面を表示しない(docx UC-102 備考)
      if (!me) return app.go('login');
      var view = K.views[r.path];
      if (!view) return app.go(app.home());
      if (view.role && view.role !== S.view()) {
        if (S.hasRole(me, view.role)) S.setView(view.role);
        else return app.go(app.home());
      }
      paint(view, r, view.role === '従業員' ? 'phone' : 'pc', keepScroll, y);
    } catch (err) {
      showFatal(err);
    }
  }

  function titleOf(view, params) { return typeof view.title === 'function' ? view.title(params) : (view.title || ''); }

  function paint(view, r, layout, keepScroll, y) {
    var content = view.render(r.params);
    var title = titleOf(view, r.params);
    document.title = title + ' | Kinchan UCモック';
    var body;
    if (layout === 'phone') body = phoneLayout(view, title, content);
    else if (layout === 'pc') body = pcLayout(view, title, content);
    else if (layout === 'doc') body = '<div class="doc-wrap" data-view-root>' + content + '</div>';
    else body = '<div data-view-root>' + content + '</div>';
    root.innerHTML = demoBar() + body;
    bindDemoBar();
    var el = root.querySelector('[data-view-root]') || root;
    if (view.mount) view.mount(el, r.params);
    var same = r.path === lastPath;
    lastPath = r.path;
    window.scrollTo(0, keepScroll && same ? y : 0);
  }

  function showFatal(err) {
    console.error(err);
    var box = document.getElementById('fatal') || document.createElement('div');
    box.id = 'fatal';
    box.textContent = '画面の描画でエラーが発生しました: ' + (err && err.message ? err.message : err);
    document.body.appendChild(box);
  }
  window.addEventListener('error', function (e) { showFatal(e.error || e.message); });

  // ---------------- デモ操作バー(製品の画面ではない) ----------------
  function demoBar() {
    var p = S.hopePeriod();
    var me = S.me();
    var acc = [['u03', '従業員', '田中'], ['u02', '勤怠管理者', '佐藤'], ['u01', '管理者', '山本']];
    return '<div class="demobar" role="region" aria-label="デモ操作">' +
      '<span class="demo-tag">UCモック・パターンA</span>' +
      '<span class="demo-clock" id="demo-clock">' + clockText() + '</span>' +
      '<span class="demo-group"><span class="demo-label">ロール切替</span>' +
      acc.map(function (a) {
        var cur = me && me.id === a[0];
        return '<button type="button" class="demo-btn' + (cur ? ' current' : '') + '" data-demo-login="' + a[0] + '">' + a[1] + '(' + a[2] + ')</button>';
      }).join('') + '</span>' +
      '<label class="demo-check"><input type="checkbox" data-demo="hope-closed"' + (p.override === 'closed' ? ' checked' : '') + '> シフト希望を受付期間外にする</label>' +
      '<label class="demo-check"><input type="checkbox" data-demo="fault"' + (S.fault() ? ' checked' : '') + '> 通信エラーを発生させる</label>' +
      '<a class="demo-link" href="#/decisions">判断ログ(' + K.DECISIONS.length + ')</a>' +
      '<button type="button" class="demo-btn" data-demo="reset">データ初期化</button>' +
      '</div>';
  }
  function clockText() {
    var n = T.now();
    return 'デモ日時 ' + fmt.dateFull(T.ymd(n)) + ' ' + T.hms(n).slice(0, 5);
  }
  function bindDemoBar() {
    var bar = root.querySelector('.demobar');
    ui.on(bar, 'click', '[data-demo-login]', function (e, el) {
      S.loginAs(el.dataset.demoLogin);
      ui.toast(S.me().name + ' でログインしました(' + S.view() + ')');
      app.go(app.home());
    });
    ui.on(bar, 'change', '[data-demo="hope-closed"]', function (e, el) {
      S.setHopeOverride(el.checked ? 'closed' : null);
      app.refresh();
    });
    ui.on(bar, 'change', '[data-demo="fault"]', function (e, el) {
      S.setFault(el.checked);
      app.refresh();
    });
    ui.on(bar, 'click', '[data-demo="reset"]', function () {
      S.reset();
      ui.toast('サンプルデータを初期化しました');
      app.go('login');
    });
  }
  setInterval(function () { var c = document.getElementById('demo-clock'); if (c) c.textContent = clockText(); }, 10000);

  // ---------------- レイアウト ----------------
  var ICON_BELL = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5.5-6.84V3.5a1.5 1.5 0 0 0-3 0v.66A7 7 0 0 0 5 11v5l-2 2v1h18v-1l-2-2Z"/></svg>';

  function viewSwitch(me) {
    var views = S.viewsOf(me);
    if (views.length < 2) return '';
    return '<label class="view-switch"><span>表示する画面</span><select data-act="switch-view">' +
      ui.options(views, S.view()) + '</select></label>' + ui.hokan(1);
  }

  var EMP_TABS = [
    ['home', 'ホーム', 'emp/home'],
    ['attendance', '勤怠', 'emp/attendance'],
    ['shifts', 'シフト', 'emp/shifts'],
    ['requests', '申請', 'emp/requests'],
    ['menu', 'メニュー', 'emp/menu'],
  ];
  function phoneLayout(view, title, content) {
    var me = S.me();
    var unread = S.unreadCount(me.id);
    return '<div class="phone-stage"><div class="phone">' +
      '<header class="appbar">' +
      '<div class="appbar-title">' + esc(title) + '</div>' +
      '<div class="appbar-right">' + viewSwitch(me) +
      '<a class="bell" href="#/emp/notifications" aria-label="通知 未読 ' + unread + ' 件">' + ICON_BELL +
      (unread ? '<span class="bell-count">' + unread + '</span>' : '') + '</a></div>' +
      '</header>' +
      '<main class="phone-main" data-view-root>' + content + '</main>' +
      '<nav class="tabbar">' + EMP_TABS.map(function (t) {
        return '<a href="#/' + t[2] + '" class="' + (view.tab === t[0] ? 'active' : '') + '">' + t[1] + '</a>';
      }).join('') + ui.hokan(76) + '</nav>' +
      '</div><p class="phone-caption">従業員画面はスマホ幅で表示(店頭のスマホでの打刻を想定)</p></div>';
  }

  function pcNav(view) {
    var me = S.me();
    var v = S.view();
    var items;
    if (v === '管理者') {
      items = [
        ['home', 'ホーム', 'adm/home'],
        ['users', 'ユーザー一覧', 'adm/users'],
        ['users-new', 'ユーザー登録', 'adm/users-new'],
      ];
    } else {
      var c = me.storeId ? S.managerPending(me.storeId) : { hopes: 0, corrections: 0, shiftChanges: 0 };
      items = [
        ['home', 'ホーム', 'mgr/home'],
        ['shifts', 'シフト管理', 'mgr/shifts'],
        ['hopes', 'シフト希望', 'mgr/hopes', c.hopes],
        ['corrections', '勤怠修正申請', 'mgr/corrections', c.corrections],
        ['shift-changes', 'シフト日時変更申請', 'mgr/shift-changes', c.shiftChanges],
        ['work', '勤務実態', 'mgr/work'],
        ['attendance', '勤怠修正', 'mgr/attendance'],
      ];
    }
    return '<nav class="sidenav">' + items.map(function (it) {
      return '<a href="#/' + it[2] + '" class="' + (view.nav === it[0] ? 'active' : '') + '">' + esc(it[1]) +
        (it[3] ? '<span class="nav-count">' + it[3] + '</span>' : '') + '</a>';
    }).join('') + (v === '勤怠管理者' ? '<div class="nav-note">件数は未処理(申請中)の件数 ' + ui.hokan(4) + '</div>' : '') + '</nav>';
  }
  function pcLayout(view, title, content) {
    var me = S.me();
    var v = S.view();
    var storeTxt = v === '勤怠管理者' ? '<span class="topbar-store">担当店舗: ' + esc(S.storeName(me.storeId)) + ' ' + ui.hokan(2) + '</span>' : '';
    return '<div class="pc">' +
      '<header class="topbar">' +
      '<div class="brand">Kinchan<span class="brand-sub">' + esc(v) + '</span></div>' + storeTxt +
      '<div class="spacer"></div>' + viewSwitch(me) +
      '<span class="topbar-user">' + esc(me.name) + '</span>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-act="password">パスワードを変更</button>' +
      '<button type="button" class="btn btn-secondary btn-sm" data-act="logout">ログアウト</button>' +
      '</header>' +
      '<div class="pc-body">' + pcNav(view) + '<main class="pc-main" data-view-root>' + content + '</main></div>' +
      '</div>';
  }
  function bindLayout() {
    ui.on(root, 'change', '[data-act="switch-view"]', function (e, el) {
      S.setView(el.value);
      app.go(app.home());
    });
    ui.on(root, 'click', '[data-act="logout"]', function () { app.logout(); });
    ui.on(root, 'click', '[data-act="password"]', function () { app.passwordModal(); });
  }

  // ---------------- ログアウト(UC-002) ----------------
  app.logout = function () {
    ui.modal({
      title: 'ログアウト',
      body: '<div class="uc-chips">' + ui.uc('UC-002') + ' ' + ui.hokan(15) + '</div><p>ログアウトしますか?</p>',
      actions: [
        { label: 'キャンセル', kind: 'secondary' }, // Alt-1: 操作していた画面に戻る
        { label: 'ログアウト', kind: 'primary', onClick: function (m) {
          var r = S.logout();
          if (!r.ok) { m.setError(esc(r.message) + ui.flowNote('UC-002 Ex-1')); return false; }
          ui.toast('ログアウトしました');
          app.go('login');
        } },
      ],
    });
  };

  // ---------------- パスワード変更(docx UC-101 Alt-1 の配置替え。#13) ----------------
  app.passwordModal = function () {
    var me = S.me();
    ui.modal({
      title: 'パスワードを変更',
      body: '<p class="muted">ログイン情報の変更(docx UC-001 Alt-1 相当)' + ui.hokan(13) + '</p>' +
        '<form class="form" data-pw>' +
        ui.field('現在のパスワード', '<input type="password" name="current" autocomplete="current-password">', 'current') +
        ui.field('新しいパスワード', '<input type="password" name="next" autocomplete="new-password">', 'next', '8 文字以上で英字と数字を含める ' + ui.hokan(17)) +
        ui.field('新しいパスワード(再入力)', '<input type="password" name="confirm" autocomplete="new-password">', 'confirm') +
        '</form>',
      actions: [
        { label: 'キャンセル', kind: 'secondary' },
        { label: '変更する', kind: 'primary', onClick: function (m) {
          var f = m.el.querySelector('[data-pw]');
          var v = ui.values(f);
          var r = S.changePassword(me.id, v.current, v.next, v.confirm);
          if (!r.ok) { ui.showErrors(f, r.errors); return false; }
          ui.toast('パスワードを変更しました');
        } },
      ],
    });
  };

  // ---------------- ログイン(UC-001) ----------------
  var DEMO_ACCOUNTS = [
    { id: 'u03', role: '従業員', note: '駅前店。シフト希望・勤怠修正申請のデモ向け' },
    { id: 'u02', role: '勤怠管理者', note: '駅前店の店長。従業員権限も保持(#1)' },
    { id: 'u01', role: '管理者', note: '本部。ユーザー管理' },
  ];
  K.views.login = {
    title: 'ログイン',
    render: function () {
      var others = S.activeUsers().filter(function (u) { return !DEMO_ACCOUNTS.some(function (d) { return d.id === u.id; }); });
      return '<div class="login-stage"><div class="login-card">' +
        '<h1 class="login-title">Kinchan</h1>' +
        '<div class="uc-chips center">' + ui.uc('UC-001') + ' ' + ui.hokan(11) + '</div>' +
        '<form class="form" data-login novalidate>' +
        ui.field('ユーザーID', '<input name="loginId" autocomplete="username" inputmode="latin">', 'loginId') +
        ui.field('パスワード', '<input type="password" name="password" autocomplete="current-password">', 'password') +
        '<div class="form-error" data-login-error hidden></div>' +
        '<button type="submit" class="btn btn-primary btn-block">ログイン</button>' +
        '</form>' +
        '<p class="login-note">パスワードを忘れた場合は管理者に連絡してください ' + ui.hokan(13) + '</p>' +
        '</div>' +
        '<div class="login-demo"><h2>デモアカウント</h2><p class="muted">選ぶと ID・パスワードを入力してログインします</p>' +
        '<div class="demo-accounts">' + DEMO_ACCOUNTS.map(function (d) {
          var u = S.user(d.id);
          if (!u || u.deleted) return '';
          return '<button type="button" class="demo-account" data-login-as="' + u.id + '">' +
            ui.badge(d.role) + '<strong>' + esc(u.name) + '</strong>' +
            '<span class="mono">' + esc(u.loginId) + ' / ' + esc(u.password) + '</span>' +
            '<span class="muted small">' + esc(d.note) + '</span></button>';
        }).join('') + '</div>' +
        '<details class="other-users"><summary>その他のユーザー</summary><table class="table table-sm"><tbody>' +
        others.map(function (u) {
          return '<tr><td>' + esc(u.name) + '</td><td>' + u.roles.map(ui.badge).join(' ') + '</td><td>' + esc(S.storeName(u.storeId)) +
            '</td><td class="mono">' + esc(u.loginId) + ' / ' + esc(u.password) + '</td>' +
            '<td><button type="button" class="btn btn-ghost btn-sm" data-login-as="' + u.id + '">ログイン</button></td></tr>';
        }).join('') + '</tbody></table></details>' +
        '<p class="muted small">エラー表示の確認: 存在しない ID は「アカウントが存在しません」(docx UC-001 Ex-2)、パスワード誤りは「ログイン情報が正しくありません」(Ex-1)</p>' +
        '</div></div>';
    },
    mount: function (el) {
      var form = el.querySelector('[data-login]');
      var errBox = el.querySelector('[data-login-error]');
      function submit(loginId, password) {
        var r = S.login(loginId, password);
        if (!r.ok) {
          ui.showErrors(form, r.errors || {});
          errBox.hidden = false;
          errBox.innerHTML = esc(r.message) + (r.code ? ui.flowNote(r.code === 'notfound' ? 'UC-001 Ex-2' : 'UC-001 Ex-1') : '');
          return;
        }
        ui.toast(r.user.name + ' でログインしました');
        app.go(app.home());
      }
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var v = ui.values(form);
        submit(v.loginId, v.password);
      });
      ui.on(el, 'click', '[data-login-as]', function (e, b) {
        var u = S.user(b.dataset.loginAs);
        form.loginId.value = u.loginId;
        form.password.value = u.password;
        submit(u.loginId, u.password);
      });
    },
  };

  // ---------------- 通知一覧(#3) ----------------
  K.views['emp/notifications'] = {
    role: '従業員',
    title: '通知',
    tab: 'home',
    render: function () {
      var me = S.me();
      var list = S.notificationsOf(me.id);
      return ui.pageHead({ title: '通知', hokan: [3],
        lead: 'シフトの登録・変更・削除、申請の承認・却下、勤怠の修正の通知(通知方法は TBD のためアプリ内通知とした)' }) +
        (list.length ? '<div class="toolbar"><button type="button" class="btn btn-ghost btn-sm" data-act="read-all">すべて既読にする</button></div>' +
          '<ul class="notice-list">' + list.map(function (n) {
            return '<li class="notice' + (n.read ? '' : ' unread') + '">' +
              '<div class="notice-head"><strong>' + esc(n.title) + '</strong><span class="muted small">' + fmt.dt(n.at) + '</span></div>' +
              '<div class="notice-body">' + esc(n.body) + '</div>' +
              (n.link ? '<a class="small" href="#/' + n.link + '" data-read="' + n.id + '">関連する画面へ</a>' : '') + '</li>';
          }).join('') + '</ul>'
          : ui.empty('通知はありません'));
    },
    mount: function (el) {
      var me = S.me();
      ui.on(el, 'click', '[data-act="read-all"]', function () { S.markAllRead(me.id); app.refresh(); });
      ui.on(el, 'click', '[data-read]', function (e, a) { S.markRead(a.dataset.read); });
    },
  };

  // ---------------- 判断ログ一覧 ----------------
  K.views.decisions = {
    title: '判断ログ',
    render: function (params) {
      var focus = Number(params.focus || 0);
      var back = S.me() ? app.home() : 'login';
      return '<div class="doc">' +
        '<div class="doc-head"><a class="btn btn-secondary btn-sm" href="#/' + back + '">← モックに戻る</a>' +
        '<h1>判断ログ(' + K.DECISIONS.length + ' 件)</h1>' +
        '<p class="muted">曖昧・未定義な箇所と、パターンA(一般的な勤怠アプリの慣行に寄せる)で採用した扱い。画面上の「補完 #n」はこの # に対応する。README の「判断ログ」と同内容。</p>' +
        '<input type="search" class="input" placeholder="UC ID や語句で絞り込み(例: UC-307、休憩)" data-filter></div>' +
        '<table class="table decisions"><thead><tr><th>#</th><th>対象UC</th><th>曖昧点・未定義点</th><th>採用した扱い</th><th>根拠・該当箇所</th></tr></thead><tbody>' +
        K.DECISIONS.map(function (d) {
          return '<tr id="d' + d.id + '" class="' + (d.id === focus ? 'focus' : '') + '"><td class="num">' + d.id + '</td><td>' + esc(d.uc) +
            '</td><td>' + esc(d.issue) + '</td><td>' + esc(d.decision) + '</td><td>' + esc(d.basis) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    },
    mount: function (el, params) {
      var input = el.querySelector('[data-filter]');
      input.addEventListener('input', function () {
        var q = input.value.trim().toLowerCase();
        el.querySelectorAll('tbody tr').forEach(function (tr) { tr.hidden = q && tr.textContent.toLowerCase().indexOf(q) < 0; });
      });
      if (params.focus) {
        var row = el.querySelector('#d' + Number(params.focus));
        if (row) setTimeout(function () { row.scrollIntoView({ block: 'center' }); }, 0);
      }
    },
  };

  // ---------------- 起動 ----------------
  function boot() {
    root = document.getElementById('app');
    bindLayout();
    // ?as=<ユーザーID> で自動ログイン(動作確認用)
    var m = location.search.match(/[?&]as=([^&]+)/);
    if (m) {
      var u = S.userByLogin(decodeURIComponent(m[1]));
      if (u) S.loginAs(u.id);
      var v = location.search.match(/[?&]view=([^&]+)/);
      if (v && u) S.setView(decodeURIComponent(v[1]));
    }
    window.addEventListener('hashchange', function () { render(false); });
    render(false);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
