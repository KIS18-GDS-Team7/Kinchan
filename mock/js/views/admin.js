/*
 * 管理者画面: ホーム、ユーザー一覧(UC-116)、ユーザー登録(UC-103)、ユーザー詳細(UC-104〜115)。
 * 「ユーザー管理画面」= ユーザー一覧とし、各操作はユーザー詳細から行う(判断ログ #30)。
 */
(function () {
  var S = K.S, ui = K.ui, T = K.T, fmt = K.fmt, esc = ui.esc;
  var WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // 月〜日の順で表示

  function rolesHtml(u) { return u.roles.map(ui.badge).join(' '); }
  function setBadge(v) { return v ? ui.badge('設定済み') : ui.badge('未設定'); }
  function isEmployee(u) { return S.hasRole(u, '従業員'); }
  // 各 UC の Alt-1(キャンセル): 「システムはユーザー管理画面を表示する」
  function cancelToList(what) {
    ui.toast(what + 'をキャンセルしました', 'info');
    K.app.go('adm/users');
  }

  // ---------------- ホーム ----------------
  K.views['adm/home'] = {
    role: '管理者',
    title: 'ホーム',
    nav: 'home',
    render: function () {
      var users = S.activeUsers();
      var byRole = S.ROLES.map(function (r) { return [r, users.filter(function (u) { return S.hasRole(u, r); }).length]; });
      var byStore = S.stores().map(function (s) { return [s.name, users.filter(function (u) { return u.storeId === s.id; }).length]; });
      byStore.push(['所属店舗 未設定', users.filter(function (u) { return !u.storeId; }).length]);
      var incomplete = users.filter(function (u) {
        return isEmployee(u) && (!u.storeId || !u.availability || !u.breakRule);
      });
      return ui.pageHead({ title: 'ホーム', hokan: [12], lead: '管理者用のホーム画面(内容は docs に定義がないため一般的な管理画面トップの構成とした)',
        actions: '<a class="btn btn-secondary" href="#/adm/users">ユーザー一覧</a><a class="btn btn-primary" href="#/adm/users-new">ユーザーを登録</a>' }) +
        '<div class="kpis">' +
        '<a class="kpi" href="#/adm/users"><div class="kpi-label">登録ユーザー</div><div class="kpi-value">' + users.length + '<small>名</small></div></a>' +
        byRole.map(function (x) {
          return '<a class="kpi" href="#/adm/users?role=' + encodeURIComponent(x[0]) + '"><div class="kpi-label">権限: ' + esc(x[0]) + '</div><div class="kpi-value">' + x[1] + '<small>名</small></div></a>';
        }).join('') + '</div>' +
        '<div class="grid-2 section">' +
        '<div class="card"><div class="card-head"><div class="card-title">店舗別のユーザー数 ' + ui.hokan(23) + '</div></div><div class="card-body">' +
        '<table class="table table-sm"><tbody>' + byStore.map(function (x) {
          return '<tr><td>' + esc(x[0]) + '</td><td class="num">' + x[1] + ' 名</td></tr>';
        }).join('') + '</tbody></table></div></div>' +
        '<div class="card"><div class="card-head"><div class="card-title">設定が未完了の従業員 ' + ui.hokan(16) + '</div></div><div class="card-body">' +
        (incomplete.length ? '<table class="table table-sm"><thead><tr><th>氏名</th><th>所属店舗</th><th>勤務可能時間</th><th>休憩時間</th></tr></thead><tbody>' +
          incomplete.map(function (u) {
            return '<tr class="clickable" data-href="adm/user?id=' + u.id + '"><td><a href="#/adm/user?id=' + u.id + '">' + esc(u.name) + '</a></td><td>' +
              setBadge(u.storeId) + '</td><td>' + setBadge(u.availability) + '</td><td>' + setBadge(u.breakRule) + '</td></tr>';
          }).join('') + '</tbody></table>'
          : '<p class="muted">すべての従業員の所属店舗・勤務可能時間・休憩時間が設定されています</p>') +
        '</div></div></div>';
    },
    mount: function (el) {
      ui.on(el, 'click', 'tr[data-href]', function (e, tr) {
        if (e.target.closest('a')) return;
        K.app.go(tr.dataset.href);
      });
    },
  };

  // ---------------- ユーザー一覧(UC-116) ----------------
  K.views['adm/users'] = {
    role: '管理者',
    title: 'ユーザー一覧',
    nav: 'users',
    render: function (p) {
      var head = ui.pageHead({ title: 'ユーザー一覧', ucs: ['UC-116'], hokan: [30, 31],
        actions: '<a class="btn btn-primary" href="#/adm/users-new">ユーザーを登録</a>' });
      if (S.fault()) {
        return head + ui.alert('ng', 'ユーザー情報を取得できませんでした ' + ui.flowNote('UC-116 Ex-1'));
      }
      var filter = { q: p.q || '', role: p.role || '', storeId: p.store || '', includeDeleted: p.deleted === '1' };
      var list = S.listUsers(filter);
      var total = S.activeUsers().length;
      var toolbar = '<form class="toolbar" data-filter>' +
        ui.field('氏名・ユーザーID', '<input name="q" value="' + esc(filter.q) + '" placeholder="例: 田中 / tanaka">', 'q') +
        ui.field('権限', '<select name="role">' + ui.options([{ value: '', label: 'すべて' }].concat(S.ROLES), filter.role) + '</select>', 'role') +
        ui.field('所属店舗', '<select name="store">' + ui.options([{ value: '', label: 'すべて' }].concat(S.stores().map(function (s) {
          return { value: s.id, label: s.name };
        })).concat([{ value: 'none', label: '未設定' }]), filter.storeId) + '</select>', 'store') +
        '<div class="check-row"><label><input type="checkbox" name="deleted"' + (filter.includeDeleted ? ' checked' : '') + '> 削除済みを含める</label>' + ui.hokan(19) + '</div>' +
        '<button type="submit" class="btn btn-secondary">絞り込む</button>' +
        '</form>';
      var body;
      if (total === 0) {
        // docx UC-114(=116) Alt-1
        body = ui.alert('info', 'ユーザーが登録されていません ' + ui.flowNote('UC-116 Alt-1')) + emptyTable();
      } else if (!list.length) {
        body = ui.empty('条件に合うユーザーはいません');
      } else {
        body = '<div class="table-wrap"><table class="table"><thead><tr>' +
          '<th>氏名</th><th>ユーザーID</th><th>権限</th><th>所属店舗</th><th>勤務可能時間</th><th>休憩時間</th><th>登録日</th>' +
          '</tr></thead><tbody>' + list.map(function (u) {
            return '<tr class="clickable' + (u.deleted ? ' muted-row' : '') + '" data-href="adm/user?id=' + u.id + '">' +
              '<td><a href="#/adm/user?id=' + u.id + '">' + esc(u.name) + '</a>' + (u.deleted ? ' ' + ui.badge('削除済み') : '') + '</td>' +
              '<td class="mono">' + esc(u.loginId) + '</td>' +
              '<td>' + rolesHtml(u) + '</td>' +
              '<td>' + (u.storeId ? esc(S.storeName(u.storeId)) : ui.badge('未設定')) + '</td>' +
              '<td>' + setBadge(u.availability) + '</td>' +
              '<td>' + setBadge(u.breakRule) + '</td>' +
              '<td class="nowrap">' + fmt.dateFull(u.createdAt.slice(0, 10)) + '</td></tr>';
          }).join('') + '</tbody></table></div>' +
          '<p class="muted small">' + list.length + ' 名を表示(登録ユーザー ' + total + ' 名)</p>';
      }
      return head + toolbar + body;
    },
    mount: function (el) {
      var form = el.querySelector('[data-filter]');
      if (form) {
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          var v = ui.values(form);
          K.app.go('adm/users', { q: v.q, role: v.role, store: v.store, deleted: v.deleted ? '1' : '' });
        });
      }
      ui.on(el, 'click', 'tr[data-href]', function (e, tr) {
        if (e.target.closest('a')) return;
        K.app.go(tr.dataset.href);
      });
    },
  };
  function emptyTable() {
    return '<div class="table-wrap"><table class="table"><thead><tr><th>氏名</th><th>ユーザーID</th><th>権限</th></tr></thead>' +
      '<tbody><tr><td colspan="3" class="muted">—</td></tr></tbody></table></div>';
  }

  // ---------------- ユーザー登録(UC-103) ----------------
  K.views['adm/users-new'] = {
    role: '管理者',
    title: 'ユーザー登録',
    nav: 'users-new',
    render: function () {
      return ui.pageHead({ title: 'ユーザー登録', ucs: ['UC-103'], hokan: [16],
        lead: '所属店舗・勤務可能時間・休憩時間は、登録後にユーザー詳細から設定する' }) +
        '<div class="card" style="max-width:640px"><div class="card-body">' +
        '<form class="form" data-new novalidate>' +
        '<div class="form-error" data-form-error hidden></div>' +
        ui.field('氏名', '<input name="name" maxlength="40" placeholder="例: 山田 花子">', 'name') +
        ui.field('ユーザーID', '<input name="loginId" autocomplete="off" placeholder="例: yamada">', 'loginId', '半角英数字と . _ - の 4〜20 文字 ' + ui.hokan(17)) +
        ui.field('パスワード', '<input type="password" name="password" autocomplete="new-password">', 'password', '8 文字以上で英字と数字を含める') +
        '<label class="check-row small"><span><input type="checkbox" data-show-pw> パスワードを表示する</span></label>' +
        '<div class="field"><span class="field-label">権限 ' + ui.hokan(1) + '</span><div class="check-row">' +
        S.ROLES.map(function (r) {
          return '<label><input type="radio" name="role" value="' + esc(r) + '"' + (r === '従業員' ? ' checked' : '') + '> ' + esc(r) + '</label>';
        }).join('') + '</div><span class="field-hint">登録時に 1 つ設定する(docx UC-103 備考)。追加の権限は登録後に「権限を付与」で行う</span>' +
        '<span class="field-error" data-err="role" hidden></span></div>' +
        '<div class="row"><button type="submit" class="btn btn-primary">登録する</button>' +
        '<a class="btn btn-secondary" href="#/adm/users">キャンセル</a></div>' +
        '</form></div></div>';
    },
    mount: function (el) {
      var form = el.querySelector('[data-new]');
      var err = el.querySelector('[data-form-error]');
      el.querySelector('[data-show-pw]').addEventListener('change', function (e) {
        form.password.type = e.target.checked ? 'text' : 'password';
      });
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var r = S.createUser(S.me().id, ui.values(form));
        if (!r.ok) {
          ui.showErrors(form, r.errors || {});
          err.hidden = false;
          var dup = r.errors && r.errors.loginId === 'このユーザーIDは既に使用されています';
          err.innerHTML = esc(r.message) + ui.flowNote(r.code === 'fault' ? '通信エラー' : (dup ? 'UC-103 Ex-2' : 'UC-103 Ex-1'));
          return;
        }
        ui.toast('ユーザーを登録しました');
        K.app.go('adm/user', { id: r.user.id, created: '1' });
      });
    },
  };

  // ---------------- ユーザー詳細(UC-104〜115) ----------------
  function availabilityTable(u) {
    if (!u.availability) return '<p class="muted">未設定(シフト登録時の範囲チェックは行われない ' + ui.hokan(26) + ')</p>';
    return '<table class="table table-sm"><tbody>' + WEEK_ORDER.map(function (w) {
      var d = u.availability[w];
      return '<tr><th style="width:56px">' + T.WD[w] + '</th><td>' + (d.enabled ? fmt.range(d.start, d.end) : '<span class="muted">勤務不可</span>') + '</td></tr>';
    }).join('') + '</tbody></table>';
  }
  function sectionCard(title, ucs, hokans, bodyHtml, actionsHtml) {
    return '<div class="card"><div class="card-head"><div><div class="card-title">' + esc(title) + ' ' + ui.hokans(hokans) + '</div>' +
      '<div class="uc-chips">' + ui.ucs(ucs) + '</div></div><div class="row">' + (actionsHtml || '') + '</div></div>' +
      '<div class="card-body">' + bodyHtml + '</div></div>';
  }
  function basicKv(u) {
    return '<dl class="kv"><dt>氏名</dt><dd>' + esc(u.name) + '</dd>' +
      '<dt>ユーザーID</dt><dd class="mono">' + esc(u.loginId) + '</dd>' +
      '<dt>パスワード</dt><dd>••••••••</dd>' +
      '<dt>登録日</dt><dd>' + fmt.dtFull(u.createdAt) + '</dd></dl>';
  }

  K.views['adm/user'] = {
    role: '管理者',
    title: 'ユーザー詳細',
    nav: 'users',
    render: function (p) {
      var u = S.user(p.id);
      var back = '<a class="btn btn-secondary btn-sm" href="#/adm/users">← ユーザー一覧</a>';
      if (!u) {
        return ui.pageHead({ title: 'ユーザー詳細', actions: back }) +
          ui.alert('ng', '対象ユーザーが存在しません ' + ui.flowNote('UC-104〜115 Ex'));
      }
      var head = ui.pageHead({ title: u.name, hokan: [30], actions: back,
        lead: 'ユーザー一覧で選んだユーザーの情報。各欄から編集・設定する' });
      if (u.deleted) {
        return head + ui.alert('warn', 'このユーザーは削除されています(' + fmt.dtFull(u.deletedAt) + ')。ログインできず、操作もできません。勤怠記録・申請は保持しています ' + ui.hokan(19)) +
          sectionCard('基本情報', ['UC-104'], [], basicKv(u), '');
      }
      var created = p.created === '1' ? ui.alert('ok', 'ユーザーを登録しました。続けて所属店舗・勤務可能時間・休憩時間を設定できます ' + ui.hokan(16)) : '';
      var hasStore = !!u.storeId, hasAv = !!u.availability, hasBr = !!u.breakRule;
      var future = S.futureShifts(u.id).length;
      return head + created +
        '<div class="grid-2">' +
        '<div class="stack">' +
        sectionCard('基本情報', ['UC-104'], [18], basicKv(u),
          '<button type="button" class="btn btn-secondary btn-sm" data-act="edit">編集</button>') +
        sectionCard('権限', ['UC-106', 'UC-107'], [1, 20], '<p>' + rolesHtml(u) + '</p>' +
          '<p class="muted small">付与 = 保持していない権限を 1 つ追加 / 変更 = 選んだ 1 つの権限に置き換え</p>',
          '<button type="button" class="btn btn-secondary btn-sm" data-act="grant">権限を付与</button>' +
          '<button type="button" class="btn btn-secondary btn-sm" data-act="change-role">権限を変更</button>') +
        sectionCard('所属店舗', [hasStore ? 'UC-111' : 'UC-110'], [21, 22], '<p>' + (hasStore ? esc(S.storeName(u.storeId)) : ui.badge('未設定')) + '</p>' +
          (hasStore && future ? '<p class="muted small">翌日以降のシフト ' + future + ' 件</p>' : ''),
          '<button type="button" class="btn btn-secondary btn-sm" data-act="store">' + (hasStore ? '所属店舗を編集' : '所属店舗を設定') + '</button>') +
        '</div><div class="stack">' +
        sectionCard('勤務可能時間', [hasAv ? 'UC-113' : 'UC-112'], [25, 21], availabilityTable(u),
          '<button type="button" class="btn btn-secondary btn-sm" data-act="availability">' + (hasAv ? '勤務可能時間を変更' : '勤務可能時間を設定') + '</button>') +
        sectionCard('休憩時間', [hasBr ? 'UC-115' : 'UC-114'], [28, 21], '<p>' + (hasBr ? esc(S.breakRuleText(u)) : ui.badge('未設定')) + '</p>' +
          '<p class="muted small">シフトの予定休憩と、休憩打刻がない日の自動控除に使う ' + ui.hokan(29) + '</p>',
          '<button type="button" class="btn btn-secondary btn-sm" data-act="break">' + (hasBr ? '休憩時間を変更' : '休憩時間を設定') + '</button>') +
        sectionCard('ユーザーの削除', ['UC-105'], [19, 20], '<p class="muted small">削除したユーザーはログインできなくなる(docx UC-105 備考)。勤怠記録・申請は保持する</p>',
          '<button type="button" class="btn btn-danger btn-sm" data-act="delete">ユーザーを削除</button>') +
        '</div></div>';
    },
    mount: function (el, p) {
      var u = S.user(p.id);
      if (!u || u.deleted) return;
      var me = S.me();
      ui.on(el, 'click', '[data-act="edit"]', function () { editModal(me, u); });
      ui.on(el, 'click', '[data-act="grant"]', function () { grantModal(me, u); });
      ui.on(el, 'click', '[data-act="change-role"]', function () { changeRoleModal(me, u); });
      ui.on(el, 'click', '[data-act="store"]', function () { storeModal(me, u); });
      ui.on(el, 'click', '[data-act="availability"]', function () { availabilityModal(me, u); });
      ui.on(el, 'click', '[data-act="break"]', function () { breakModal(me, u); });
      ui.on(el, 'click', '[data-act="delete"]', function () { deleteModal(me, u); });
    },
  };

  // 操作中に対象ユーザーが存在しなくなった場合(各 UC の Ex-1)
  function stillExists(u, m) {
    var cur = S.user(u.id);
    if (cur && !cur.deleted) return true;
    m.setError('対象ユーザーが存在しません' + ui.flowNote('Ex-1'));
    return false;
  }

  // UC-104
  function editModal(me, u) {
    ui.modal({
      title: 'ユーザーを編集',
      body: '<div class="uc-chips">' + ui.uc('UC-104') + ' ' + ui.hokan(18) + '</div>' +
        '<form class="form" data-f novalidate>' +
        ui.field('氏名', '<input name="name" value="' + esc(u.name) + '">', 'name') +
        ui.field('ユーザーID', '<input name="loginId" value="' + esc(u.loginId) + '">', 'loginId', '半角英数字と . _ - の 4〜20 文字 ' + ui.hokan(17)) +
        ui.field('パスワード', '<input type="password" name="password" autocomplete="new-password" placeholder="変更しない場合は空欄">', 'password', '空欄なら変更しない') +
        '<p class="muted small">権限は「権限」欄の「権限を付与」「権限を変更」で操作する</p></form>',
      actions: [
        { label: 'キャンセル', kind: 'secondary', onClick: function () { cancelToList('ユーザーの編集'); } },
        { label: '保存する', kind: 'primary', onClick: function (m) {
          if (!stillExists(u, m)) return false;
          var f = m.el.querySelector('[data-f]');
          var r = S.updateUser(me.id, u.id, ui.values(f));
          if (!r.ok) { ui.showErrors(f, r.errors || {}); m.setError(esc(r.message) + ui.flowNote('UC-104 Ex-1')); return false; }
          ui.toast('ユーザー情報を編集しました');
          K.app.refresh();
        } },
      ],
    });
  }

  // UC-106
  function grantModal(me, u) {
    var avail = S.ROLES.filter(function (r) { return !S.hasRole(u, r); });
    ui.modal({
      title: 'ユーザーに権限を付与',
      body: '<div class="uc-chips">' + ui.uc('UC-106') + ' ' + ui.hokan(1) + '</div>' +
        '<p>現在の権限: ' + rolesHtml(u) + '</p>' +
        (avail.length ? '<form data-f><div class="field"><span class="field-label">付与する権限</span><div class="check-row">' +
          avail.map(function (r, i) {
            return '<label><input type="radio" name="role" value="' + esc(r) + '"' + (i === 0 ? ' checked' : '') + '> ' + esc(r) + '</label>';
          }).join('') + '</div></div></form>'
          : '<p class="muted">すべての権限を保持しています</p>'),
      actions: [
        { label: 'キャンセル', kind: 'secondary', onClick: function () { cancelToList('権限の付与'); } },
        { label: '付与する', kind: 'primary', onClick: function (m) {
          if (!stillExists(u, m)) return false;
          var f = m.el.querySelector('[data-f]');
          var role = f ? ui.values(f).role : '';
          var r = S.grantRole(me.id, u.id, role);
          if (!r.ok) { m.setError(esc(r.message) + ui.flowNote('UC-106 Ex-2')); return false; }
          ui.toast('権限「' + role + '」を付与しました');
          K.app.refresh();
        } },
      ],
    });
  }

  // UC-107
  function changeRoleModal(me, u) {
    ui.modal({
      title: 'ユーザーの権限を変更',
      body: '<div class="uc-chips">' + ui.uc('UC-107') + ' ' + ui.hokan(1) + ui.hokan(20) + '</div>' +
        '<p>現在の権限: ' + rolesHtml(u) + '</p>' +
        '<form data-f><div class="field"><span class="field-label">変更後の権限</span><div class="check-row">' +
        S.ROLES.map(function (r) {
          var checked = u.roles.length === 1 && u.roles[0] === r;
          return '<label><input type="radio" name="role" value="' + esc(r) + '"' + (checked ? ' checked' : '') + '> ' + esc(r) + '</label>';
        }).join('') + '</div><span class="field-hint">選んだ 1 つの権限に置き換える</span></div></form>',
      actions: [
        { label: 'キャンセル', kind: 'secondary', onClick: function () { cancelToList('権限の変更'); } },
        { label: '変更する', kind: 'primary', onClick: function (m) {
          if (!stillExists(u, m)) return false;
          var role = ui.values(m.el.querySelector('[data-f]')).role;
          if (!role) { m.setError('変更後の権限を選択してください'); return false; }
          var r = S.changeRole(me.id, u.id, role);
          if (!r.ok) { m.setError(esc(r.message) + ui.flowNote(r.code === 'invalidRole' ? 'UC-107 Ex-2' : '補完 #20')); return false; }
          ui.toast('権限を「' + role + '」に変更しました');
          K.app.refresh();
        } },
      ],
    });
  }

  // UC-110 / UC-111
  function storeModal(me, u) {
    var mode = u.storeId ? 'edit' : 'set';
    var uc = mode === 'set' ? 'UC-110' : 'UC-111';
    var future = S.futureShifts(u.id).length;
    ui.modal({
      title: mode === 'set' ? 'ユーザーの所属店舗を設定' : 'ユーザーの所属店舗を編集',
      body: '<div class="uc-chips">' + ui.uc(uc) + ' ' + ui.hokan(21) + ui.hokan(22) + '</div>' +
        (mode === 'edit' ? '<p>現在の所属店舗: ' + esc(S.storeName(u.storeId)) + '</p>' : '') +
        '<form data-f>' + ui.field(mode === 'set' ? '所属店舗' : '変更後の所属店舗',
          '<select name="storeId">' + ui.options([{ value: '', label: '選択してください' }].concat(S.stores().map(function (s) {
            return { value: s.id, label: s.name };
          })), u.storeId || '') + '</select>', 'storeId', 'システムに登録されている店舗から選択 ' + ui.hokan(23)) + '</form>' +
        (mode === 'edit' && future ? ui.alert('warn', '翌日以降のシフトが ' + future + ' 件あります。シフトは変更されず、変更後は新しい所属店舗の勤怠管理者の管理対象になります ' + ui.hokan(24)) : '') +
        (S.hasRole(u, '勤怠管理者') ? ui.alert('info', 'このユーザーは勤怠管理者のため、所属店舗が担当店舗になります ' + ui.hokan(2)) : ''),
      actions: [
        { label: 'キャンセル', kind: 'secondary', onClick: function () { cancelToList(mode === 'set' ? '所属店舗の設定' : '所属店舗の変更'); } },
        { label: mode === 'set' ? '設定する' : '変更する', kind: 'primary', onClick: function (m) {
          if (!stillExists(u, m)) return false;
          var storeId = ui.values(m.el.querySelector('[data-f]')).storeId;
          var r = S.setStore(me.id, u.id, storeId, mode);
          if (!r.ok) { m.setError(esc(r.message) + ui.flowNote(uc + ' Ex-2')); return false; }
          ui.toast(mode === 'set' ? '所属店舗を設定しました' : '所属店舗を変更しました');
          K.app.refresh();
        } },
      ],
    });
  }

  // UC-112 / UC-113
  function availabilityModal(me, u) {
    var mode = u.availability ? 'change' : 'set';
    var uc = mode === 'set' ? 'UC-112' : 'UC-113';
    var cur = u.availability || [0, 1, 2, 3, 4, 5, 6].map(function () { return { enabled: false, start: '', end: '' }; });
    var rows = WEEK_ORDER.map(function (w) {
      var d = cur[w];
      return '<tr><th>' + T.WD[w] + '</th>' +
        '<td><label class="nowrap"><input type="checkbox" name="en' + w + '"' + (d.enabled ? ' checked' : '') + '> 勤務可</label></td>' +
        '<td><div class="hope-times"><input type="time" name="st' + w + '" value="' + esc(d.start || '09:00') + '"><span>〜</span>' +
        '<input type="time" name="ed' + w + '" value="' + esc(d.end || '18:00') + '"></div>' +
        '<span class="field-error" data-err="' + w + '" hidden></span></td></tr>';
    }).join('');
    ui.modal({
      title: mode === 'set' ? '勤務可能時間を設定' : '勤務可能時間を変更',
      body: '<div class="uc-chips">' + ui.uc(uc) + ' ' + ui.hokan(25) + (mode === 'change' ? ui.hokan(27) : '') + '</div>' +
        '<p class="muted small">曜日ごとに勤務できる時間帯を 1 区間設定する(docx 備考「曜日ごと」)。シフトの登録・承認時に範囲外は登録できない</p>' +
        '<form data-f><table class="table table-sm hope-table"><thead><tr><th>曜日</th><th>勤務</th><th>時間帯</th></tr></thead><tbody>' + rows + '</tbody></table></form>',
      onMount: function (m) {
        var f = m.el.querySelector('[data-f]');
        function sync() {
          WEEK_ORDER.forEach(function (w) {
            var on = f['en' + w].checked;
            f['st' + w].disabled = !on;
            f['ed' + w].disabled = !on;
          });
        }
        f.addEventListener('change', sync);
        sync();
      },
      actions: [
        { label: 'キャンセル', kind: 'secondary', onClick: function () { cancelToList(mode === 'set' ? '勤務可能時間の設定' : '勤務可能時間の変更'); } },
        { label: mode === 'set' ? '設定する' : '変更する', kind: 'primary', onClick: function (m) {
          if (!stillExists(u, m)) return false;
          var f = m.el.querySelector('[data-f]');
          var av = [0, 1, 2, 3, 4, 5, 6].map(function (w) {
            return { enabled: f['en' + w].checked, start: f['st' + w].value, end: f['ed' + w].value };
          });
          var r = S.setAvailability(me.id, u.id, av, mode);
          if (!r.ok) { ui.showErrors(f, r.errors || {}); m.setError(esc(r.message) + ui.flowNote(uc + ' Ex-2')); return false; }
          ui.toast(mode === 'set' ? '勤務可能時間を設定しました' : '勤務可能時間を変更しました');
          K.app.refresh();
        } },
      ],
    });
  }

  // UC-114 / UC-115
  function breakModal(me, u) {
    var mode = u.breakRule ? 'change' : 'set';
    var uc = mode === 'set' ? 'UC-114' : 'UC-115';
    var r0 = u.breakRule || { overHours: 6, minutes: 45 };
    ui.modal({
      title: mode === 'set' ? '休憩時間を設定' : '休憩時間を変更',
      body: '<div class="uc-chips">' + ui.uc(uc) + ' ' + ui.hokan(28) + '</div>' +
        (mode === 'change' ? '<p>現在の休憩時間: ' + esc(S.breakRuleText(u)) + '</p>' : '') +
        '<form data-f><div class="form-row">' +
        ui.field('勤務が次の時間を超える場合', '<input type="number" name="overHours" min="0" max="24" step="0.5" value="' + esc(r0.overHours) + '">', 'overHours', '時間') +
        ui.field('休憩時間', '<input type="number" name="minutes" min="0" max="180" step="1" value="' + esc(r0.minutes) + '">', 'minutes', '分') +
        '</div></form>' +
        '<p class="muted small">参考: 労働基準法 34 条は 6 時間超で 45 分以上、8 時間超で 60 分以上の休憩を求める</p>',
      actions: [
        { label: 'キャンセル', kind: 'secondary', onClick: function () { cancelToList(mode === 'set' ? '休憩時間の設定' : '休憩時間の変更'); } },
        { label: mode === 'set' ? '設定する' : '変更する', kind: 'primary', onClick: function (m) {
          if (!stillExists(u, m)) return false;
          var f = m.el.querySelector('[data-f]');
          var r = S.setBreakRule(me.id, u.id, ui.values(f), mode);
          if (!r.ok) { ui.showErrors(f, r.errors || {}); m.setError(esc(r.message) + ui.flowNote(uc + ' Ex-2')); return false; }
          ui.toast(mode === 'set' ? '休憩時間を設定しました' : '休憩時間を変更しました');
          K.app.refresh();
        } },
      ],
    });
  }

  // UC-105
  function deleteModal(me, u) {
    var future = S.futureShifts(u.id);
    ui.modal({
      title: 'ユーザーを削除',
      body: '<div class="uc-chips">' + ui.uc('UC-105') + ' ' + ui.hokan(19) + ui.hokan(20) + '</div>' +
        '<p>次のユーザーを削除します。削除したユーザーはログインできなくなります。</p>' +
        '<dl class="kv"><dt>氏名</dt><dd>' + esc(u.name) + '</dd><dt>ユーザーID</dt><dd class="mono">' + esc(u.loginId) + '</dd>' +
        '<dt>権限</dt><dd>' + rolesHtml(u) + '</dd><dt>所属店舗</dt><dd>' + esc(S.storeName(u.storeId)) + '</dd></dl>' +
        (future.length ? ui.alert('warn', '翌日以降のシフト ' + future.length + ' 件も削除し、シフトの削除履歴に記録します') : '') +
        '<p class="muted small">勤怠記録・申請・修正履歴は削除せず保持します</p>',
      actions: [
        { label: 'キャンセル', kind: 'secondary', onClick: function () { cancelToList('ユーザーの削除'); } },
        { label: '削除する', kind: 'danger', onClick: function (m) {
          var r = S.deleteUser(me.id, u.id);
          if (!r.ok) {
            var note = r.code === 'notfound' ? 'UC-105 Ex-1' : (r.code === 'fault' ? 'UC-105 Ex-2' : '補完 #20');
            m.setError(esc(r.message) + ui.flowNote(note));
            return false;
          }
          ui.toast('ユーザーを削除しました' + (r.removedShifts ? '(シフト ' + r.removedShifts + ' 件を削除)' : ''));
          K.app.go('adm/users');
        } },
      ],
    });
  }
})();
