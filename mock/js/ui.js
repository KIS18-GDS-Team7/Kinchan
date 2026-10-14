/*
 * UI 部品(HTML 文字列ヘルパー、モーダル、トースト、補完バッジのポップオーバー)。
 */
window.K = window.K || {};

(function () {
  var ui = {};

  var esc = ui.esc = function (s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  // ---------- バッジ類 ----------
  // 補完バッジ(判断ログ #n)。ホバー/クリックで理由を表示
  ui.hokan = function (n) {
    return '<button type="button" class="hokan" data-hokan="' + n + '" aria-label="補完 #' + n + ' の判断理由を表示">補完 #' + n + '</button>';
  };
  ui.hokans = function (list) { return (list || []).map(ui.hokan).join(''); };

  // UC チップ(requirements.md の UC ID・UC 名)
  ui.uc = function (id) {
    var name = K.UC[id] || '';
    if (id === 'UC-303') name = '(名称未決 #61)';
    return '<span class="uc-chip" title="' + esc(id + ' ' + (K.UC[id] || '')) + '">' + esc(id) + ' ' + esc(name) + '</span>';
  };
  ui.ucs = function (ids) { return (ids || []).map(ui.uc).join(''); };

  var STATUS_CLASS = {
    '申請中': 'warn', '承認済': 'ok', '却下': 'ng', '取下げ': 'gray',
    '出勤中': 'ok', '休憩中': 'warn', '退勤中': 'gray',
    '予定': 'info', '勤務中': 'ok', '勤務済み': 'gray',
    '注意': 'warn', '超過': 'ng',
    '遅刻': 'warn', '早退': 'warn', '欠勤': 'ng', '打刻漏れ': 'ng', '未出勤': 'ng', 'シフト外勤務': 'warn',
    '休日希望': 'gray', '出勤可能': 'info', '時間指定': 'info',
    '管理者': 'role-adm', '勤怠管理者': 'role-mgr', '従業員': 'role-emp',
    '未設定': 'gray', '設定済み': 'ok', '削除済み': 'gray', '修正済み': 'info', '自動': 'gray',
  };
  // cls 省略時はラベルから色を決める(Array#map に直接渡しても index を cls と誤解しない)
  ui.badge = function (label, cls) {
    if (typeof cls !== 'string') cls = null;
    return '<span class="badge badge-' + (cls || STATUS_CLASS[label] || 'gray') + '">' + esc(label) + '</span>';
  };
  ui.status = function (label) { return ui.badge(label); };

  // ---------- レイアウト部品 ----------
  /*
   * ページ見出し: { title, ucs: ['UC-206', ...], hokan: [n, ...], actions: 'HTML', lead: '説明文' }
   */
  ui.pageHead = function (o) {
    return '<div class="page-head"><div class="page-head-main">' +
      '<h1>' + esc(o.title) + ' ' + ui.hokans(o.hokan) + '</h1>' +
      (o.ucs && o.ucs.length ? '<div class="uc-chips">' + ui.ucs(o.ucs) + '</div>' : '') +
      (o.lead ? '<p class="lead">' + o.lead + '</p>' : '') +
      '</div>' + (o.actions ? '<div class="page-actions">' + o.actions + '</div>' : '') + '</div>';
  };
  ui.alert = function (kind, html) { return '<div class="alert alert-' + kind + '">' + html + '</div>'; };
  ui.empty = function (msg) { return '<div class="empty">' + esc(msg) + '</div>'; };
  // 例外フローの説明(画面に出すメッセージと、どの例外かの注記)
  ui.flowNote = function (uc) { return '<span class="flow-note">' + esc(uc) + '</span>'; };

  // ---------- フォーム ----------
  ui.values = function (form) {
    var out = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.disabled) return;
      if (el.type === 'checkbox') out[el.name] = el.checked;
      else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; }
      else out[el.name] = el.value;
    });
    return out;
  };
  // errors: { field: msg }。[data-err="field"] に表示し、name=field の入力欄を強調
  ui.showErrors = function (root, errors) {
    ui.clearErrors(root);
    Object.keys(errors || {}).forEach(function (k) {
      var slot = root.querySelector('[data-err="' + k + '"]');
      if (slot) { slot.textContent = errors[k]; slot.hidden = false; }
      root.querySelectorAll('[name="' + k + '"]').forEach(function (el) { el.classList.add('invalid'); });
    });
  };
  ui.clearErrors = function (root) {
    root.querySelectorAll('[data-err]').forEach(function (el) { el.textContent = ''; el.hidden = true; });
    root.querySelectorAll('.invalid').forEach(function (el) { el.classList.remove('invalid'); });
  };
  // ラベル+入力欄+エラー表示
  ui.field = function (label, inputHtml, name, hint) {
    return '<label class="field"><span class="field-label">' + label + '</span>' + inputHtml +
      (hint ? '<span class="field-hint">' + hint + '</span>' : '') +
      '<span class="field-error" data-err="' + esc(name) + '" hidden></span></label>';
  };
  ui.options = function (list, selected) {
    return list.map(function (o) {
      var v = typeof o === 'object' ? o.value : o;
      var l = typeof o === 'object' ? o.label : o;
      return '<option value="' + esc(v) + '"' + (String(v) === String(selected) ? ' selected' : '') + '>' + esc(l) + '</option>';
    }).join('');
  };

  // ---------- イベント ----------
  // 委譲イベント: ui.on(root, 'click', '[data-act="x"]', function (e, el) {...})
  ui.on = function (root, type, selector, fn) {
    root.addEventListener(type, function (e) {
      var el = e.target.closest(selector);
      if (el && root.contains(el)) fn(e, el);
    });
  };

  // ---------- モーダル ----------
  /*
   * ui.modal({ title, body: 'HTML', wide, actions: [{ label, kind: 'primary'|'danger'|'secondary', onClick(modal) }], onMount(modal) })
   * onClick が false を返したら閉じない。modal = { el, body, close, setBody(html), setError(msg) }
   */
  ui.modal = function (o) {
    var wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.innerHTML = '<div class="modal' + (o.wide ? ' modal-wide' : '') + '" role="dialog" aria-modal="true">' +
      '<div class="modal-head"><h2>' + esc(o.title) + '</h2><button type="button" class="modal-x" aria-label="閉じる">×</button></div>' +
      '<div class="modal-error" hidden></div>' +
      '<div class="modal-body">' + (o.body || '') + '</div>' +
      '<div class="modal-actions"></div></div>';
    document.body.appendChild(wrap);
    var closed = false;
    var m = {
      el: wrap,
      body: wrap.querySelector('.modal-body'),
      close: function () {
        if (closed) return;
        closed = true;
        wrap.remove();
        document.removeEventListener('keydown', onKey);
        window.removeEventListener('hashchange', m.close);
        if (o.onClose) o.onClose();
      },
      setBody: function (html) { m.body.innerHTML = html; },
      setError: function (msg) {
        var e = wrap.querySelector('.modal-error');
        if (!msg) { e.hidden = true; e.innerHTML = ''; return; }
        e.hidden = false; e.innerHTML = msg;
      },
      setActions: function (actions) {
        var box = wrap.querySelector('.modal-actions');
        box.innerHTML = '';
        (actions || [{ label: '閉じる', kind: 'secondary' }]).forEach(function (a) {
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'btn btn-' + (a.kind || 'secondary');
          b.textContent = a.label;
          b.addEventListener('click', function () {
            var r = a.onClick ? a.onClick(m) : undefined;
            if (r !== false) m.close();
          });
          box.appendChild(b);
        });
      },
    };
    function onKey(e) { if (e.key === 'Escape') m.close(); }
    document.addEventListener('keydown', onKey);
    window.addEventListener('hashchange', m.close); // 画面遷移したら閉じる
    wrap.querySelector('.modal-x').addEventListener('click', m.close);
    m.setActions(o.actions);
    if (o.onMount) o.onMount(m);
    var first = wrap.querySelector('.modal-body input, .modal-body select, .modal-body textarea');
    if (first) first.focus();
    return m;
  };
  // 確認ダイアログ。onOk が false を返すと閉じない
  ui.confirm = function (o) {
    return ui.modal({
      title: o.title,
      body: o.body,
      actions: [
        { label: o.cancelLabel || 'キャンセル', kind: 'secondary', onClick: o.onCancel },
        { label: o.okLabel || 'OK', kind: o.okKind || 'primary', onClick: o.onOk },
      ],
    });
  };

  // ---------- トースト ----------
  ui.toast = function (msg, kind, detail) {
    var box = document.getElementById('toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
    var t = document.createElement('div');
    t.className = 'toast toast-' + (kind || 'ok');
    t.innerHTML = '<div>' + esc(msg) + '</div>' + (detail ? '<div class="toast-detail">' + esc(detail) + '</div>' : '');
    box.appendChild(t);
    setTimeout(function () { t.classList.add('out'); }, kind === 'ng' ? 5200 : 3200);
    setTimeout(function () { t.remove(); }, kind === 'ng' ? 5600 : 3600);
  };

  // ---------- 補完バッジのポップオーバー ----------
  var pop = null, pinned = null;
  function popEl() {
    if (!pop) { pop = document.createElement('div'); pop.className = 'hokan-pop'; pop.hidden = true; document.body.appendChild(pop); }
    return pop;
  }
  function showPop(btn) {
    var d = K.decision(Number(btn.dataset.hokan));
    if (!d) return;
    var p = popEl();
    p.innerHTML = '<div class="hp-head">判断ログ #' + d.id + ' <span class="hp-uc">' + esc(d.uc) + '</span></div>' +
      '<dl><dt>曖昧点・未定義点</dt><dd>' + esc(d.issue) + '</dd>' +
      '<dt>採用した扱い</dt><dd>' + esc(d.decision) + '</dd>' +
      '<dt>根拠・該当箇所</dt><dd>' + esc(d.basis) + '</dd></dl>' +
      '<a class="hp-link" href="#/decisions?focus=' + d.id + '">判断ログ一覧で表示</a>';
    p.hidden = false;
    var r = btn.getBoundingClientRect();
    var w = Math.min(380, window.innerWidth - 16);
    p.style.width = w + 'px';
    var left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
    p.style.left = left + window.scrollX + 'px';
    var top = r.bottom + 6;
    p.style.top = top + window.scrollY + 'px';
    var ph = p.getBoundingClientRect().height;
    if (top + ph > window.innerHeight - 8 && r.top - ph - 6 > 8) p.style.top = (r.top - ph - 6 + window.scrollY) + 'px';
  }
  function hidePop() { if (pop) pop.hidden = true; pinned = null; }
  document.addEventListener('mouseover', function (e) {
    var b = e.target.closest && e.target.closest('.hokan');
    if (b && !pinned) showPop(b);
  });
  document.addEventListener('mouseout', function (e) {
    var b = e.target.closest && e.target.closest('.hokan');
    if (b && !pinned && !(e.relatedTarget && pop && pop.contains(e.relatedTarget))) hidePop();
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.hokan');
    if (b) {
      e.preventDefault(); e.stopPropagation();
      if (pinned === b) { hidePop(); return; }
      showPop(b); pinned = b;
      return;
    }
    if (pop && !pop.hidden && !pop.contains(e.target)) hidePop();
    if (pop && e.target.closest && e.target.closest('.hp-link')) hidePop();
  }, true);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hidePop(); });
  window.addEventListener('hashchange', hidePop);

  K.ui = ui;
})();
