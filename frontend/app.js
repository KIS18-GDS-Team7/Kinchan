(() => {
  "use strict";
  const M = globalThis.KinchanModel;
  const N = globalThis.KinchanNavigation;
  const C = globalThis.KinchanCalendar;
  const { punchTypes, kindLabels, roleLabels, statusLabels, dateAt, inRange, monthRange, duration, shiftText, spanLabel } = M;
  const model = M.createModel();
  const app = document.querySelector("#app");
  const demoUsers = model.users.map((u) => ({ ...u }));
  const attendanceLabels = { off: "退勤中", working: "出勤中", break: "休憩中" };
  // UC-206/209/214. Existing wording from mock/generic-kintai: mock/js/store.js REJECT_TEMPLATES.
  // Keep only wording that does not depend on removed staffing/availability rules or TBD deadlines.
  const rejectTemplates = ["申請内容とシフト・打刻記録が一致しないため"];
  const views = { shifts: "published", requests: "own", records: "own" };
  const state = { actor: null, route: "/login", view: "employee", dialog: null, toast: "", drawer: false, filters: {}, periods: {}, logoutNotice: "", calendars: {} };
  const screen = () => N.screens[state.route.split("?")[0]];
  const routeParams = () => new URLSearchParams(state.route.split("?")[1] || "");
  let toastTimer;
  let capturingForm = false;
  let capturedForm = null;
  let pageForm = null;
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const val = (value) => esc(value);
  const time = (value) => value.length === 16 ? value + ":00" : value;
  const h = (tag, value) => "<" + tag + ">" + esc(value) + "</" + tag + ">";
  const current = () => state.actor;
  const manager = () => model.has(current(), "manager");
  const master = () => model.has(current(), "master");
  const person = (key) => model.user(key)?.name || "—";
  const managed = () => model.units.filter((u) => model.manages(current(), u.key));
  const statuses = (draft = false) => Object.entries(statusLabels).filter(([key]) => draft || key !== "draft");
  const roles = (u) => u.roles.map((r) => roleLabels[r]).join("・") || "なし";
  const assigned = (u) => u.managed.map(model.unitName).join("、") || "なし";
  const empty = (message) => '<p class="empty">' + esc(message) + "</p>";
  const note = (message) => '<p class="notice">' + esc(message) + "</p>";
  const status = (key) => '<span class="status status-' + key + '">' + esc(statusLabels[key] || attendanceLabels[key] || key) + "</span>";
  const badge = (ids) => ids.length ? '<div class="uc-row">' + ids.map((i) => '<span class="uc-chip">UC-' + i + "</span>").join("") + "</div>" : "";
  const btn = (label, action, id = "", style = "ghost", extra = "") =>
    `<button type="button" class="btn btn-${style}" data-action="${action}" data-id="${val(id)}" ${extra}>${esc(label)}</button>`;
  const actions = (...parts) => '<div class="item-actions actions-row">' + parts.join("") + "</div>";
  const card = (title, ids, body, css = "") => `<section class="card card-pad ${css}"><div class="card-head"><h3>${esc(title)}</h3>${badge(ids)}</div>${body}</section>`;
  const itemsList = (rows) => '<div class="list">' + rows.join("") + "</div>";
  const itemRow = (title, subtitle, more = "") => `<div class="list-item"><div class="item-main"><p class="item-title">${esc(title)}</p><p class="item-sub">${esc(subtitle)}</p></div>${more}</div>`;
  const table = (heads, rows, message = "条件に合うデータはありません。") => rows.length
    ? `<div class="table-wrap"><table class="table"><thead><tr>${heads.map((x) => h("th", x)).join("")}</tr></thead><tbody>${rows.map((cells) => "<tr>" + cells.map((x) => "<td>" + x + "</td>").join("") + "</tr>").join("")}</tbody></table></div>`
    : empty(message);
  const field = (label, control) => `<label class="field"><span class="field-label">${esc(label)}</span>${control}</label>`;
  const input = (name, type, value = "", attrs = "") =>
    `<input class="input" name="${name}" type="${type}" value="${val(value)}" ${attrs}>`;
  const fieldInput = (label, name, type, value = "", attrs = "") => field(label, input(name, type, value, attrs));
  const textarea = (name, value) => `<textarea class="textarea" name="${name}" required>${esc(value)}</textarea>`;
  const check = (name, label, value, checked = false) => `<label class="check-field"><input type="checkbox" name="${name}" value="${val(value)}" ${checked ? "checked" : ""}> ${esc(label)}</label>`;
  const options = (pairs, selected) => pairs.map(([value, label]) =>
    `<option value="${val(value)}" ${value === selected ? "selected" : ""}>${esc(label)}</option>`).join("");
  const select = (name, pairs, selected = "", attrs = "") => `<select class="select" name="${name}" ${attrs}>${options(pairs, selected)}</select>`;
  const unitPairs = (rows) => rows.map((u) => [u.key, u.name]);
  const userPairs = (rows) => rows.map((u) => [u.key, u.name]);
  const periodPairs = (rows, showUnit = false) => rows.map((p) => [p.id, (showUnit ? model.unitName(p.unit) + "：" : "") + spanLabel(p)]);
  const managerUsers = (includeDeleted = false) => model.users.filter((u) => model.manages(current(), u.unit) && (includeDeleted || !u.deleted));
  const byDate = (a, b) => (a.date + (a.start || "")).localeCompare(b.date + (b.start || ""));
  const pick = (form, key) => String(form.get(key) ?? "").trim();
  const fields = (f, keys) => Object.fromEntries(keys.map((k) => [k, pick(f, k)]));
  const requestStates = (key, date) => [...new Set(model.items.filter((i) => i.kind === "attendance" && i.userId === key && i.date === date).map((i) => i.status))];
  const errorLine = () => '<div class="form-error" data-error role="alert"></div>';
  const filterForm = (id, body, label = "表示する") => `<form class="filter-form" data-filter="${id}">${body}<button class="btn btn-secondary" type="submit">${label}</button>${errorLine()}</form>`;
  const dateFields = ({ from, to }, required = false) => fieldInput("開始日", "from", "date", from, required ? "required" : "")
    + fieldInput("終了日", "to", "date", to, required ? "required" : "");
  const entry = (title, value) => "<dt>" + esc(title) + "</dt><dd>" + esc(value ?? "—") + "</dd>";
  const dl = (...entries) => '<dl class="details">' + entries.map(([title, value]) => entry(title, value)).join("") + "</dl>";

  function navHtml(css) {
    return `<nav class="${css}" aria-label="主要メニュー">${N.menus[state.view].map(([path, label, icon]) => {
      const active = N.screens[path].section === screen()?.section;
      return `<a class="nav-link${active ? " active" : ""}" href="#${path}" ${active ? 'aria-current="page"' : ""}><span class="nav-icon" aria-hidden="true">${icon}</span><span>${label}</span></a>`;
    }).join("")}</nav>`;
  }
  function loginPage() {
    return `<main class="login-shell">
      <section class="login-brand"><div class="brand-mark"><span class="brand-logo">K</span> Kinchan</div>
        <div class="login-copy"><p class="eyebrow">勤怠管理システム</p><h1>1分単位の勤怠を<br>一括管理。</h1><p>打刻、シフト、申請、勤怠記録を試せる静的モックです。</p></div>
      </section>
      <section class="login-panel"><div class="login-card"><p class="eyebrow">UC-301</p><h2>ログイン</h2>
        <p class="lead">ユーザーIDとパスワードを入力してください。</p>${state.logoutNotice ? note(state.logoutNotice) : ""}
        <form id="login-form">${fieldInput("ユーザーID", "userId", "text", "", 'autocomplete="username" required')}
          ${fieldInput("パスワード", "password", "password", "", 'autocomplete="current-password" required')}
          <button class="btn btn-primary btn-block" type="submit">ログイン</button>${errorLine()}</form>
        <div class="demo-box"><h3>モック用デモアカウント</h3><div class="demo-list">${demoUsers.map((u) => {
          const live = model.user(u.key);
          return live.deleted ? "" : `<button class="demo-account" type="button" data-action="demo" data-id="${u.key}"><strong>${esc(live.name)}</strong><span>${u.key === "2" ? "従業員（本日シフトなし）" : esc(["従業員", ...live.roles.map((r) => roleLabels[r])].join("＋"))}</span></button>`;
        }).join("")}</div></div></div></section></main>`;
  }
  function shell(content) {
    const u = current();
    const available = N.allowedViews(u);
    const viewSwitch = available.length > 1 ? `<nav class="view-switch" aria-label="表示する画面"><span class="view-switch-label">表示する画面</span>
      <div class="view-switch-options">${available.map((v) =>
        `<button type="button" class="view-switch-button" data-action="switch-view" data-id="${v}" aria-pressed="${state.view === v}">${N.labels[v]}</button>`).join("")}</div></nav>` : "";
    const mobileMenu = state.view !== "employee" ? field("画面", select("page", N.menus[state.view].map(([path, title]) => [path, title]),
      N.menus[state.view].find(([path]) => N.screens[path].section === screen()?.section)?.[0], 'data-page-switch="true"')) : "";
    return `<div class="app-shell layout-${state.view}"><aside class="sidebar"><div class="brand-mark"><span class="brand-logo">K</span> Kinchan</div>
      ${navHtml("sidebar-nav")}<div class="sidebar-foot"><p>${esc(model.unitName(u.unit))}</p><p>${esc(roles(u) === "なし" ? "従業員" : "従業員・" + roles(u))}</p></div></aside>
      <div class="workspace"><header class="topbar"><div class="topbar-heading"><p class="screen-role">${N.labels[state.view]}</p><h1 class="page-title">${esc(screen()?.title || "Kinchan")}</h1></div>
      ${viewSwitch}
      <div class="top-actions"><button class="icon-btn" type="button" data-action="notifications" aria-label="通知を表示">♧</button>
      <button type="button" class="profile-chip" data-action="profile" aria-label="${val(u.name)}のアカウントメニュー">${esc(u.name)}</button></div></header>
      ${mobileMenu ? `<div class="screen-controls"><div class="compact-menu">${mobileMenu}</div></div>` : ""}
      <main class="content">${content}</main>${state.view === "employee" ? navHtml("mobile-nav") : ""}</div>
      ${state.drawer ? notificationDrawer() : ""}${state.toast ? `<div class="toast" role="status">${esc(state.toast)}</div>` : ""}</div>`;
  }
  function home() {
    const u = current();
    const today = model.today();
    const shifts = model.publishedOn(u.key, today);
    const choices = u.status === "working" ? ["休憩開始", "退勤"] : u.status === "break" ? ["休憩終了"] : ["出勤"];
    const canPunch = u.unit && (u.status !== "off" || shifts.length);
    const shiftLabel = shifts.length ? shifts.map((s) => s.start + "–" + s.end).join("、") : "当日の公開済みシフトなし";
    return `<div class="grid">
        <section class="card card-pad clock-card"><div class="card-head"><div><h3>打刻</h3><p>${esc(shiftLabel)}</p></div>${badge([304, 312])}</div>
        <div class="clock-time num">${model.now().slice(11)}</div><div class="clock-date">デモ日時 ${today.replace("-", "年").replace("-", "月")}日</div>
        <div class="shift-summary"><div><span>勤務ステータス</span><strong>${attendanceLabels[u.status]}</strong></div><div><span>所属単位</span><strong>${esc(model.unitName(u.unit))}</strong></div></div>
        <div class="punch-actions">${choices.map((type) => `<button type="button" class="punch-btn" data-action="punch" data-id="${type}" ${canPunch ? "" : "disabled"}>${type}する</button>`).join("")}</div>
        ${!canPunch ? `<p class="punch-message">${u.unit ? "当日の公開済みシフトがないため、出勤を打刻できません。" : "所属が設定されていません。"}</p>` : ""}</section>
      </div>` + employeeShortcuts();
  }

  const routeLink = (label, path, hint = "") => `<a class="destination-link" href="#${path}"><span><strong>${esc(label)}</strong>${hint ? `<span class="item-sub">${esc(hint)}</span>` : ""}</span><span aria-hidden="true">›</span></a>`;
  function employeeShortcuts() {
    const pending = model.items.filter((i) => i.userId === current().key && i.status === "pending");
    return card("本日のシフト", [308], model.publishedOn(current().key, model.today()).map((s) =>
      itemRow(s.start + "–" + s.end, model.unitName(s.unit), btn("詳細", "shift-detail", s.id))).join("") || empty("本日の公開済みシフトはありません。")) +
      card("申請", [310, 311, 318], Object.entries(kindLabels).map(([kind, label]) => routeLink(label + "一覧",
        kind === "wish" ? "/emp/hopes" : kind === "attendance" ? "/emp/corrections" : "/emp/shift-change",
        "未処理 " + pending.filter((i) => i.kind === kind).length + "件")).join("")) +
      card("ショートカット", [], routeLink("シフト一覧", "/emp/shifts") + routeLink("勤怠記録", "/emp/attendance") + routeLink("通知", "/emp/notifications"));
  }
  function managerHome() {
    const people = managerUsers();
    const pending = model.items.filter((i) => i.status === "pending" && model.managedItem(current(), i) && !model.user(i.userId).deleted);
    const [from, to] = monthRange(model.today().slice(0, 7));
    const warnings = people.map((u) => {
      const minutes = model.dayRows(u.key, from, to).reduce((n, row) => n + row.overtime, 0);
      return { u, minutes, warning: M.overtimeAlert(minutes) };
    }).filter((entry) => entry.warning);
    return card("未処理の申請", [204, 207, 212], `<div class="metric-row">${Object.entries(kindLabels).map(([kind, label]) =>
      `<a class="metric metric-link" href="#${kind === "wish" ? "/mgr/hopes" : kind === "attendance" ? "/mgr/corrections" : "/mgr/shift-changes"}"><span>${label}</span><strong class="num">${pending.filter((i) => i.kind === kind).length}</strong></a>`).join("")}</div>`) +
      (warnings.length ? card("36協定の警告", [211], warnings.map(({ u, minutes, warning }) => note(u.name + "：" + warning + "（当月の残業時間 " + duration(minutes) + "）")).join("") + routeLink("勤務実態を表示する", "/mgr/work")) : "") +
      card("本日の勤務状況", [211], table(["従業員", "所属単位", "本日のシフト", "勤務ステータス"], people.map((u) => [
        esc(u.name), esc(model.unitName(u.unit)), esc(model.publishedOn(u.key, model.today()).map((s) => s.start + "–" + s.end).join("、") || "なし"), status(u.status),
      ])) + routeLink("勤務実態を表示する", "/mgr/work")) +
      card("シフト管理", [201, 215, 216], routeLink("シフト管理を開く", "/mgr/shifts", "登録・変更・削除、対象期間・受付期間の登録、下書きの公開"));
  }
  function requestHub() {
    const pending = model.items.filter((i) => i.userId === current().key && i.status === "pending");
    const [periods] = myPeriods("wishes", true);
    const open = periods.filter(model.receptionOpen);
    return card("申請", [306, 307, 310, 311, 318],
      routeLink("勤怠修正申請一覧", "/emp/corrections", "未処理 " + pending.filter((i) => i.kind === "attendance").length + "件") +
      routeLink("シフト希望一覧", "/emp/hopes", "未処理 " + pending.filter((i) => i.kind === "wish").length + "件") +
      (open.length ? routeLink("シフト希望提出", "/emp/hope") : "") +
      routeLink("シフト日時変更申請一覧", "/emp/shift-change", "申請の送信は自分の公開済みシフトから") +
      routeLink("勤怠修正申請を送信する", "/emp/attendance", "勤怠記録の日付から開始"));
  }
  function employeeMenu() {
    return card("アカウント", [], dl(["ユーザーID", current().id], ["所属単位", model.unitName(current().unit)], ["権限", roles(current())]) +
      routeLink("通知", "/emp/notifications") + actions(btn("ログアウト", "logout", "", "danger")));
  }
  function adminHome() {
    return `<div class="grid grid-2 user-entry-grid">${card("ユーザー登録", [101],
      '<p class="user-entry-description">氏名・ユーザーID・パスワードを入力して、新しいユーザーを登録します。</p>' +
      '<a class="btn btn-primary" href="#/adm/users-new">ユーザーを登録する</a>')}
      ${card("ユーザー編集", [102, 107],
      '<p class="user-entry-description">一覧から対象のユーザーを選び、氏名・ユーザーID・パスワードを変更します。</p>' +
      '<a class="btn btn-secondary" href="#/adm/users">編集するユーザーを選ぶ</a>')}</div>` +
      card("所属単位", [108, 110], actions(btn("所属追加", "unit-new", "", "primary"), btn("所属削除", "go-route", "/adm/units-delete", "danger")));
  }

  function unitDeletionPage() {
    if (!master()) return note("この画面を表示するにはマスタ管理者権限が必要です。");
    return card("所属削除", [110], note("未使用の所属だけ削除できます。現在の所属人数が0人でも、過去のデータや参照履歴がある所属は削除できません。") +
      (model.units.length ? itemsList(model.units.map((u) => {
        const { reasons } = model.unitDeletionPlan(current(), u.key);
        const descriptionId = "unit-usage-" + u.key;
        return `<article class="list-item unit-delete-item"><div class="item-main"><p class="item-title">${esc(u.name)}</p>
          <span class="status status-${reasons.length ? "pending" : "approved"}">${reasons.length ? "削除不可" : "未使用・削除可能"}</span>
          ${reasons.length ? `<ul class="unit-reference-list" id="${val(descriptionId)}">${reasons.map((reason) => h("li", reason)).join("")}</ul>` : `<p class="item-sub" id="${val(descriptionId)}">現在・過去の参照はありません。</p>`}</div>
          ${btn("削除する", "unit-delete", u.key, "danger", `aria-label="${val(u.name)}を削除する" aria-describedby="${val(descriptionId)}"${reasons.length ? " disabled" : ""}`)}</article>`;
      })) : empty("削除対象の所属単位はありません。")) + actions(btn("ホーム", "go-route", "/adm/home", "secondary")));
  }

  const tabs = (group, choices) => '<div class="tabs" aria-label="表示切り替え">' + choices.map(([key, label]) =>
    `<button type="button" class="tab${views[group] === key ? " active" : ""}" aria-pressed="${views[group] === key}" data-action="tab" data-id="${group}:${key}">${label}</button>`).join("") + "</div>";
  function myPeriods(key, wishes = false) {
    const ps = model.periods.filter((p) => p.unit === current().unit).sort((a, b) => a.from.localeCompare(b.from));
    const selected = ps.find((p) => p.id === state.periods[key]);
    const latest = [...ps].reverse().find((p) => p.from <= model.today()) || ps[0];
    return [ps, selected || (wishes ? ps.find(model.receptionOpen) || latest : undefined)];
  }
  const periodControl = (key, ps, p) => ps.length ? field("対象期間", select(key,
    [...(!p ? [["", "対象期間を選択してください"]] : []), ...periodPairs(ps)], p?.id, 'data-period="' + key + '"')) : "";
  const shiftRows = (rows, team = false) => table(["従業員名", "勤務日", "開始時刻", "終了時刻", ...(team ? ["状態"] : []), "詳細"],
    [...rows].sort(byDate).map((s) => [esc(person(s.userId)), esc(s.date), esc(s.start), esc(s.end),
      ...(team ? [status(s.published ? "公開" : "draft")] : []), btn("詳細", "shift-detail", s.id, "ghost", team ? 'data-team="true"' : "")]),
    team ? "対象のシフトがありません。" : "公開済みのシフトがありません。");
  function shiftsPage(single = false) {
    const choices = [["published", "公開済みシフト"], ["wishes", "シフト希望"]];
    if (manager()) choices.push(["team", "管理先のシフト表"], ["incoming", "届いたシフト希望"]);
    if (!choices.some(([key]) => key === views.shifts)) views.shifts = "published";
    let body;
    if (views.shifts === "team") {
      const units = managed();
      const filter = state.filters.teamShifts || {};
      const selectedUnit = units.find((u) => u.key === filter.unit)?.key || units[0]?.key;
      const periods = model.periods.filter((p) => p.unit === selectedUnit);
      const period = periods.find((p) => p.id === filter.period) || periods.find((p) => inRange(model.today(), p.from, p.to)) || periods[0];
      const rows = model.shifts.filter((s) => s.unit === selectedUnit && model.user(s.userId)?.unit === s.unit && !model.user(s.userId).deleted &&
        (!period || inRange(s.date, period.from, period.to)));
      body = card("管理先のシフト表", [201, 202, 203, 215, 216], units.length
        ? `<div class="filter-form">${field("管理先", select("unit", unitPairs(units), selectedUnit, 'data-team-filter="unit"'))}
           ${periods.length ? field("対象期間", select("period", periodPairs(periods), period?.id, 'data-team-filter="period"')) : ""}</div>` +
          actions(btn("シフトを登録する", "shift-new", selectedUnit, "primary"), btn("対象期間・受付期間を登録する", "period-new", selectedUnit, "secondary"),
            period ? btn("下書きを公開する", "publish", period.id, "secondary") : "") +
          (period ? shiftRoster(period, rows, managerUsers().filter((u) => u.unit === selectedUnit)) : empty("対象期間が登録されていません。"))
        : empty("管理先が設定されていません。"), "shifts-card");
    } else if (views.shifts === "incoming") {
      body = inbox("wish");
    } else if (!current().unit) {
      body = note("所属が設定されていません。");
    } else if (views.shifts === "wishes") {
      const [ps, p] = myPeriods("wishes", true);
      const rows = p ? model.items.filter((i) => i.kind === "wish" && i.userId === current().key && i.unit === current().unit && inRange(i.date, p.from, p.to)).sort(byDate) : [];
      body = card("自分のシフト希望", [307, 311, 315], p ? periodControl("wishes", ps, p) +
        dl(["受付期間", p.opens.replace("T", " ") + " ～ " + p.closes.replace("T", " ")]) +
        (model.receptionOpen(p) ? actions(btn("シフト希望を入力する", "wish-edit", p.id, "primary")) : note("シフト希望の受付期間外です。")) +
        (rows.length ? itemsList(rows.map((i) => itemRow(i.date, i.start + "–" + i.end, actions(status(i.status), btn("詳細", "item-own", i.id))))) : empty("この対象期間にシフト希望はありません。"))
        : empty("対象期間が登録されていません。"));
    } else {
      const [ps, p] = myPeriods("published");
      const rows = p ? model.shifts.filter((s) => s.published && s.unit === current().unit && model.user(s.userId)?.unit === s.unit && inRange(s.date, p.from, p.to)) : [];
      body = card("公開済みシフト", [308, 309], ps.length ? periodControl("published", ps, p)
        + (p ? shiftCalendar(p, rows) : empty("対象期間を選択すると、公開済みシフトをカレンダーで表示します。"))
        : empty("対象期間が登録されていません。"), "shifts-card");
    }
    return (single ? "" : tabs("shifts", choices)) + body;
  }
  const calendarKey = (team) => team ? "team" : "published";
  const dateLabel = (date) => new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short", timeZone: "UTC" }).format(new Date(date + "T00:00:00Z"));
  const monthLabel = (month) => Number(month.slice(0, 4)) + "年" + Number(month.slice(5)) + "月";
  const shiftTime = (s) => esc(s.start + "–" + s.end) + (s.end < s.start ? '<small class="shift-overnight">翌日終了</small>' : "");
  function calendarState(period, team) {
    const key = calendarKey(team);
    const identity = period.unit + ":" + period.id;
    if (state.calendars[key]?.identity !== identity) {
      const day = C.initialDay(period, model.today());
      state.calendars[key] = { identity, day, month: day.slice(0, 7), mode: team ? "roster" : "calendar" };
    }
    return state.calendars[key];
  }
  const shiftMode = (ui, primary = "calendar") => `<nav class="shift-mode" aria-label="シフトの表示形式">${[[primary, "▦", primary === "roster" ? "シフト表" : "カレンダー"], ["list", "☷", "一覧"]].map(([mode, icon, label]) =>
    `<button type="button" data-action="calendar-mode" data-id="${mode}" aria-pressed="${ui.mode === mode}"><span aria-hidden="true">${icon}</span>${label}</button>`).join("")}</nav>`;
  function shiftRoster(period, rows, members) {
    const ui = calendarState(period, true);
    const toolbar = `<div class="shift-toolbar roster-toolbar"><p class="shift-caption"><strong aria-live="polite">${ui.mode === "roster" ? dateLabel(ui.day) : esc(model.unitName(period.unit))}</strong><span>${ui.mode === "roster" ? "選択した日・" : ""}${members.length}人の従業員</span></p><div class="roster-toolbar-actions">${shiftMode(ui, "roster")}
      ${ui.mode === "roster" && ui.day >= model.today() ? btn("この日にシフトを登録する", "shift-new", period.unit, "secondary", 'data-date="' + ui.day + '"') : ""}</div></div>`;
    if (ui.mode === "list") return toolbar + shiftRows(rows, true);
    const { dates, people } = C.rosterData(period, members, rows);
    const weekday = (date) => ["日", "月", "火", "水", "木", "金", "土"][new Date(date + "T00:00:00Z").getUTCDay()];
    const dayClass = (date) => (date === model.today() ? " is-today" : "") + (date === ui.day ? " is-selected" : "");
    const head = dates.map((date) => `<th scope="col" data-roster-date="${date}" class="roster-date${dayClass(date)}"><button type="button" data-action="roster-day" data-id="${date}" aria-pressed="${date === ui.day}" aria-label="${val(dateLabel(date) + "を選択")}">
      <strong>${Number(date.slice(5, 7))}/${Number(date.slice(8))}</strong><span>${weekday(date)}${date === model.today() ? "・今日" : ""}</span></button></th>`).join("");
    const body = people.map(({ user, days }) => `<tr><th scope="row" class="roster-person"><strong>${esc(user.name)}</strong>${user.key === current().key ? '<span class="shift-self">自分</span>' : ""}</th>${days.map(({ date, shifts }) =>
      `<td class="roster-cell${dayClass(date)}">${shifts.length ? shifts.map((s) => `<button type="button" class="roster-shift ${s.published ? "is-published" : "is-draft"}" data-action="shift-detail" data-id="${val(s.id)}" data-team="true"
        aria-label="${val(user.name + "、" + dateLabel(date) + "、" + s.start + "から" + s.end + (s.end < s.start ? "、翌日終了" : "") + "、" + (s.published ? "公開" : "下書き") + "の詳細")}"><strong>${shiftTime(s)}</strong><span>${s.published ? "公開" : "下書き"}</span></button>`).join("")
        : '<span class="roster-empty" aria-label="シフトなし">—</span>'}</td>`).join("")}</tr>`).join("");
    return toolbar + (members.length ? `<p class="roster-guide" id="roster-guide">横にスクロールして日付を表示できます。勤務時間を押すと詳細を表示します。「—」はシフトなしを表します。</p>
      <div class="shift-roster-scroll" role="region" aria-label="従業員別のシフト表" aria-describedby="roster-guide" tabindex="0"><table class="shift-roster"><caption class="sr-only">${esc(spanLabel(period))}・${esc(model.unitName(period.unit))}</caption><thead><tr><th scope="col" class="roster-person">従業員</th>${head}</tr></thead><tbody>${body}</tbody></table></div>`
      : empty("この管理先に従業員は登録されていません。"));
  }
  function shiftCalendar(period, rows) {
    const ui = calendarState(period, false);
    const months = C.monthsInPeriod(period);
    const monthIndex = months.indexOf(ui.month);
    const sorted = [...rows].sort(byDate);
    const modeControl = shiftMode(ui);
    const caption = `<p class="shift-caption">${esc(model.unitName(period.unit))}<span>所属単位の全員の公開済みシフト</span></p>`;
    const noRows = rows.length ? "" : empty("この対象期間に公開済みのシフトはありません。");
    if (ui.mode === "list") return `<div class="shift-toolbar">${caption}${modeControl}</div>${shiftRows(rows)}`;
    const cells = C.monthGrid(period, ui.month).map((cell) => {
      if (!cell) return '<div class="shift-day-blank" aria-hidden="true"></div>';
      const dayRows = sorted.filter((s) => s.date === cell.date);
      const own = dayRows.some((s) => s.userId === current().key);
      const today = cell.date === model.today();
      const people = new Set(dayRows.map((s) => s.userId)).size;
      const summary = dayRows.length ? `<span class="shift-day-count">${people}人<span>${dayRows.length}件</span></span>${own ? '<span class="shift-day-own">自分</span>' : ""}` : "";
      return `<button type="button" class="shift-day${today ? " is-today" : ""}${cell.date === ui.day ? " is-selected" : ""}" data-action="calendar-day" data-id="${cell.date}"
        aria-label="${val(dateLabel(cell.date) + (today ? "、今日" : "") + (cell.inPeriod ? "、" + people + "人、シフト" + dayRows.length + "件" + (own ? "、自分のシフトあり" : "") : "、対象期間外"))}"
        aria-pressed="${cell.date === ui.day}" ${today ? 'aria-current="date"' : ""} ${!cell.inPeriod ? "disabled" : ""}>
        <span class="shift-day-top" aria-hidden="true"><span class="shift-day-number">${cell.day}</span>${today ? '<span class="shift-today-label">今日</span>' : ""}</span>
        <span class="shift-day-summary" aria-hidden="true">${summary}</span></button>`;
    }).join("");
    const dayRows = sorted.filter((s) => s.date === ui.day);
    const groups = C.groupByPerson(dayRows);
    const details = groups.map(({ userId, shifts }) => `<article class="shift-person-row${userId === current().key ? " is-mine" : ""}"><div class="shift-person-name"><strong>${esc(person(userId))}</strong>${userId === current().key ? '<span class="shift-self">自分</span>' : ""}</div>
      <div class="shift-person-times">${shifts.map((s) => `<div><span>${shiftTime(s)}</span>${btn("詳細", "shift-detail", s.id, "ghost", 'aria-label="' + val(person(userId) + "、" + s.start + "から" + s.end + "の詳細") + '"')}</div>`).join("")}</div></article>`).join("");
    return `<div class="shift-toolbar">${caption}${modeControl}</div>${noRows}<div class="shift-calendar-layout">
      <section class="shift-calendar-main" aria-labelledby="shift-month-title"><div class="shift-month-toolbar">
        <h4 id="shift-month-title" aria-live="polite">${monthLabel(ui.month)}</h4>${months.length > 1 ? '<div class="shift-month-controls">' + btn("‹", "calendar-month", "-1", "ghost", 'aria-label="前の月"' + (monthIndex === 0 ? " disabled" : "")) + btn("›", "calendar-month", "1", "ghost", 'aria-label="次の月"' + (monthIndex === months.length - 1 ? " disabled" : "")) + '</div>' : ""}</div>
        <p class="shift-calendar-hint">日付を選ぶと、その日にシフトがある全員の勤務時間を表示します。</p><div class="shift-calendar-board">
        <div class="shift-weekdays" aria-hidden="true">${["日", "月", "火", "水", "木", "金", "土"].map((d) => '<span>' + d + '</span>').join("")}</div>
        <div class="shift-month-days" role="group" aria-label="${monthLabel(ui.month)}の日付">${cells}</div></div></section>
      <section class="shift-day-panel" aria-labelledby="shift-day-title"><div class="shift-day-panel-head"><p>選択した日の全員の勤務時間</p><h4 id="shift-day-title" aria-live="polite">${dateLabel(ui.day)}</h4><span>${groups.length}人・${dayRows.length}件のシフト</span></div>
        <div class="shift-day-list">${details || empty("この日に公開済みのシフトはありません。")}</div></section></div>`;
  }
  function updateCalendar(action, id) {
    const team = views.shifts === "team";
    const ui = state.calendars[calendarKey(team)];
    const period = model.periods.find((p) => p.unit + ":" + p.id === ui?.identity);
    if (!ui || !period) return;
    if (action === "calendar-mode" && [team ? "roster" : "calendar", "list"].includes(id)) ui.mode = id;
    if (action === "roster-day" && team && C.rosterData(period, [], []).dates.includes(id)) ui.day = id;
    if (action === "calendar-day" && C.monthGrid(period, ui.month).some((c) => c?.date === id && c.inPeriod)) ui.day = id;
    if (action === "calendar-month") {
      const months = C.monthsInPeriod(period);
      const month = months[months.indexOf(ui.month) + Number(id)];
      if (!month) return;
      ui.month = month;
      ui.day = C.initialDay(period, model.today(), month);
    }
    render();
    app.querySelector(`[data-action="${action}"][data-id="${id}"]`)?.focus({ preventScroll: true });
  }
  function filtered(items, f) {
    return items.filter((i) => (!f.from || i.date >= f.from) && (!f.to || i.date <= f.to) &&
      (!f.status || i.status === f.status) && (!f.kind || i.kind === f.kind) &&
      (!f.user || i.userId === f.user) && (!f.unit || model.user(i.userId)?.unit === f.unit));
  }
  function itemList(rows, isManager) {
    return rows.length ? itemsList([...rows].sort((a, b) => (b.sentAt || b.date).localeCompare(a.sentAt || a.date)).map((i) => {
      const summary = i.kind === "change" ? shiftText(i.before) + " → " + shiftText(i.after)
        : i.kind === "wish" ? i.start + "–" + i.end : punchesText(i.after);
      const extra = isManager ? (i.kind === "wish" ? dl(["所属単位", model.unitName(model.user(i.userId)?.unit)]) : dl(["申請理由", i.reason])) : "";
      return `<div class="list-item"><div class="item-main"><p class="item-title">${esc((isManager ? person(i.userId) + "・" : "") + kindLabels[i.kind] + "・" + i.date)}</p>
        <p class="item-sub">${esc(summary + (i.sentAt ? " ／ 送信 " + i.sentAt.replace("T", " ") : ""))}</p>${extra}</div>
        ${actions(status(i.status), btn("詳細", isManager ? "item-manager" : "item-own", i.id))}</div>`;
    })) : empty("条件に合う申請・希望はありません。");
  }
  function inbox(kind) {
    const id = kind === "wish" ? "wishInbox" : kind + "Inbox";
    const f = state.filters[id] || { status: "pending" };
    const rows = filtered(model.items.filter((i) => (kind === "request" ? i.kind !== "wish" : i.kind === kind)
      && model.managedItem(current(), i) && (f.deleted || !model.user(i.userId).deleted)), f);
    return card(kind === "wish" ? "届いたシフト希望" : kind === "attendance" ? "勤怠修正申請" : kind === "change" ? "シフト日時変更申請" : "管理先の申請",
      kind === "wish" ? [204, 205, 206] : kind === "attendance" ? [207, 208, 209] : kind === "change" ? [212, 213, 214] : [207, 208, 209, 212, 213, 214],
      filterForm(id, dateFields(f) + field("処理状態", select("status", [["", "すべて"], ...statuses()], f.status)) +
        (kind !== "request" ? "" : field("申請の種類", select("kind", [["", "すべて"], ["attendance", kindLabels.attendance], ["change", kindLabels.change]], f.kind))) +
        field("管理先", select("unit", [["", "すべて"], ...unitPairs(managed())], f.unit)) +
        field("従業員", select("user", [["", "すべて"], ...userPairs(managerUsers(true))], f.user)) +
        check("deleted", "削除済みを含める", "yes", f.deleted)) + itemList(rows, true));
  }
  function requestsPage(onlyKind) {
    const choices = [["own", "自分の申請"]];
    if (manager()) choices.push(["incoming", "承認待ち"]);
    if (!manager()) views.requests = "own";
    const filterKey = onlyKind ? "own" + onlyKind : "ownRequests";
    const f = state.filters[filterKey] || {};
    const own = filtered(model.items.filter((i) => i.userId === current().key && (onlyKind ? i.kind === onlyKind : i.kind !== "wish")), f);
    return (onlyKind ? "" : tabs("requests", choices)) + (views.requests === "incoming" && !onlyKind ? inbox("request") :
      card(onlyKind ? kindLabels[onlyKind] + "一覧" : "自分の申請", onlyKind === "attendance" ? [310, 314] : onlyKind === "change" ? [316, 318] : [310, 314, 316, 318],
        filterForm(filterKey, dateFields(f) + field("処理状態", select("status", [["", "すべて"], ...statuses()], f.status))
          + (onlyKind ? "" : field("申請の種類", select("kind", [["", "すべて"], ["attendance", kindLabels.attendance], ["change", kindLabels.change]], f.kind))))
        + itemList(own, false)));
  }

  const punchesText = (punches) => punches.length ? punches.map((p) => p.type + " " + p.at.replace("T", " ")).join(" / ") : "なし";
  const punchesList = (punches) => punches.length ? '<ul class="punch-list num">' + punches.map((p) => h("li", p.type + " " + p.at.replace("T", " "))).join("") + "</ul>" : empty("打刻はありません。");
  const flags = (d) => [d.late ? "遅刻 " + d.late + "件" : "", d.early ? "早退 " + d.early + "件" : "", d.absent ? "欠勤 " + d.absent + "件" : ""].filter(Boolean).join("、") || "—";
  function recordRows(key, rows, team) {
    return table(["日付", "公開済みシフト", "打刻", "休憩時間", "勤務時間", team ? "遅刻・早退・欠勤" : "修正申請の処理状態", "詳細"],
      rows.map((d) => [esc(d.date), d.planned.map((s) => esc(s.start + "–" + s.end)).join("<br>") || "—", punchesList(d.punches),
        duration(d.rest), duration(d.work), team ? esc(flags(d)) : requestStates(key, d.date).map(status).join(" ") || "—",
        btn("詳細", "record-detail", key + ":" + d.date, "ghost", team ? 'data-team="true"' : "")]),
      "条件に合う勤怠記録・公開済みシフトはありません。");
  }
  function teamRecords(f) {
    const selected = managerUsers(f.deleted).filter((u) => (!f.unit || u.unit === f.unit) && (!f.user || u.key === f.user));
    const [monthStart, monthEnd] = monthRange(model.today().slice(0, 7));
    return selected.map((u) => {
      const rows = model.dayRows(u.key, f.from, f.to);
      const total = (key, list = rows) => list.reduce((sum, d) => sum + d[key], 0);
      const monthOvertime = total("overtime", model.dayRows(u.key, monthStart, monthEnd));
      return { u, rows, work: total("work"), overtime: total("overtime"), late: total("late"), early: total("early"), absent: total("absent"),
        monthOvertime, alert: M.overtimeAlert(monthOvertime) };
    });
  }
  const monthFilter = () => {
    const [from, to] = monthRange(model.today().slice(0, 7));
    return { from, to };
  };
  function recordsPage(single = false) {
    const choices = [["own", "自分の勤怠記録"]];
    if (manager()) choices.push(["team", "管理先の勤務実態"]);
    if (!manager()) views.records = "own";
    if (views.records !== "team") {
      const f = state.filters.ownRecords || monthFilter();
      const rows = model.dayRows(current().key, f.from, f.to);
      return (single ? "" : tabs("records", choices)) + card("自分の勤怠記録", [306, 313], filterForm("ownRecords", dateFields(f, true)) +
        (current().unit ? actions(btn("日付を指定して勤怠修正を申請する", "attendance-date", "", "secondary")) : "") +
        recordRows(current().key, rows, false));
    }
    const f = state.filters.teamRecords || monthFilter();
    const summary = teamRecords(f);
    const filter = filterForm("teamRecords", dateFields(f, true) +
      field("管理先", select("unit", [["", "すべての管理先"], ...unitPairs(managed())], f.unit)) +
      field("従業員", select("user", [["", "全従業員"], ...userPairs(managerUsers(true))], f.user)) +
      check("deleted", "削除済みを含める", "yes", f.deleted));
    return (single ? "" : tabs("records", choices)) + card("管理先の勤務実態", [210, 211], filter +
      actions(btn("従業員と日付を指定して修正する", "correction-date", "", "secondary"),
        summary.length ? btn("集計をCSV出力する", "csv", "", "secondary") : "") +
      (summary.length ? summary.map((s) => `<section class="record-group"><div class="card-head"><h3>${esc(s.u.name)}</h3>${status(s.u.status)}</div>
        ${dl(["所属単位", model.unitName(s.u.unit)], ["期間の勤務時間", duration(s.work)], ["期間の残業時間", duration(s.overtime)], ["遅刻・早退・欠勤", [s.late, s.early, s.absent].join(" / ") + " 件"])}
        ${s.alert ? note("36協定：" + s.alert + "（当月の残業時間 " + duration(s.monthOvertime) + "）") : ""}
        ${recordRows(s.u.key, s.rows, true)}</section>`).join("") : empty("条件に合う従業員はいません。")));
  }
  function usersPage() {
    if (!master()) return note("この画面を表示するにはマスタ管理者権限が必要です。");
    const f = state.filters.users || {};
    const rows = model.users.filter((u) => (f.deleted || !u.deleted) && (!f.name || u.name.includes(f.name))
      && (!f.id || u.id.includes(f.id)) && (!f.unit || u.unit === f.unit) && (!f.role || (f.role === "none" ? !u.roles.length : u.roles.includes(f.role))));
    return card("ユーザー検索", [101, 102, 107, 108],
      actions(btn("ユーザーを登録する", "go-route", "/adm/users-new", "primary"), btn("所属追加", "unit-new", "", "primary")) +
      note("対象のユーザーの「編集する」から氏名・ユーザーID・パスワードを変更できます。権限・所属・管理先の操作は「詳細」から開きます。") +
      '<section class="user-search" aria-labelledby="user-search-title"><h4 id="user-search-title">ユーザー検索</h4><p class="item-sub">氏名・ユーザーIDで検索し、権限・所属で絞り込めます。</p>' + filterForm("users",
      fieldInput("氏名", "name", "search", f.name) + fieldInput("ユーザーID", "id", "search", f.id) +
      field("権限", select("role", [["", "すべて"], ...Object.entries(roleLabels), ["none", "なし"]], f.role)) +
      field("所属", select("unit", [["", "すべて"], ...unitPairs(model.units)], f.unit)) + check("deleted", "削除済みを含める", "yes", f.deleted), "検索する") + '</section>'
      + '<p class="item-sub">編集・詳細は表の「操作」欄から開きます。</p>'
      + table(["氏名", "ユーザーID", "権限", "所属", "管理先", "操作"], rows.map((u) => [
        esc(u.name) + (u.deleted ? "（削除済み）" : ""), esc(u.id), esc(roles(u)), esc(model.unitName(u.unit)), esc(assigned(u)),
        '<div class="table-actions">' +
          (!u.deleted ? btn("編集する", "user-edit", u.key, "secondary", `aria-label="${val(u.name)}（${val(u.id)}）のユーザー情報を編集する"`) : "") +
          btn("詳細", "user-detail", u.key, "ghost", `aria-label="${val(u.name)}（${val(u.id)}）の詳細を表示する"`) + '</div>',
      ]), "条件に合うユーザーはいません。"), "user-management-list");
  }

  function notificationDrawer() {
    const rows = model.notifications.filter((n) => n.userId === current().key).sort((a, b) => b.at.localeCompare(a.at));
    return `<div class="drawer-backdrop" data-action="close-notifications"></div><aside class="drawer" aria-label="通知"><div class="drawer-head">
      <div><p class="eyebrow">UC-317</p><h2>通知</h2></div>${btn("閉じる", "close-notifications")}</div>
      ${rows.length ? itemsList(rows.map((n) => itemRow(n.message, n.at.replace("T", " "), btn("詳細", "notification", n.id)))) : empty("あなた宛ての通知はありません。")}</aside>`;
  }
  function notificationsPage() {
    const rows = model.notifications.filter((n) => n.userId === current().key).sort((a, b) => b.at.localeCompare(a.at));
    return card("通知", [317], rows.length ? itemsList(rows.map((n) =>
      itemRow(n.message, n.at.replace("T", " "), btn("詳細", "notification", n.id)))) : empty("あなた宛ての通知はありません。"));
  }
  function openNotification(id) {
    const n = model.notifications.find((n) => n.id === id && n.userId === current().key);
    if (!n) return;
    const t = n.target;
    let target = "";
    if (t?.type === "shift") {
      const s = model.shiftById(t.id);
      if (s?.published && s.userId === current().key && s.unit === current().unit) target = actions(btn("関連するシフト", "shift-detail", s.id, "primary"));
    } else if (t?.type === "published") {
      const rows = t.ids.map(model.shiftById).filter((s) => s?.published && s.userId === current().key && s.unit === current().unit);
      if (rows.length) target = h("h3", "関連するシフト") + shiftRows(rows);
    } else if (t?.type === "item") {
      const i = model.itemById(t.id);
      if (t.manager ? model.managedItem(current(), i) : i?.userId === current().key) {
        target = actions(btn("関連する" + kindLabels[i.kind], t.manager ? "item-manager" : "item-own", i.id, "primary"));
      }
    } else if (t?.type === "record" && t.key === current().key) {
      target = actions(btn("関連する勤怠記録", "record-detail", t.key + ":" + t.date, "primary"));
    }
    state.drawer = false;
    detail("通知", [317], dl(["内容", n.message], ["作成日時", n.at.replace("T", " ")]) + target);
  }

  function showDialog(config) {
    if (capturingForm) { capturedForm = config; return; }
    const source = app.querySelector("#page-form");
    if (source) state.pageDraft = { route: state.route, values: [...new FormData(source).entries()] };
    if (source?.querySelector("#punch-entries")) {
      state.pageDraft.punches = [...source.querySelectorAll(".punch-entry")].map((row) => ({
        type: row.querySelector("[name=type]").value, at: row.querySelector("[name=at]").value,
      }));
    }
    state.dialog = config;
    render();
  }
  function detail(title, ids, body) { showDialog({ title, ids, body }); }
  function form(title, ids, body, submit, label = "内容を確認する") { showDialog({ title, ids, body, submit, label, cancel: "操作をキャンセルしました。" }); }
  function confirm(title, ids, body, run, done, label = "確定する") {
    form(title, ids, body, () => { run(); finish(done); }, label);
  }
  function cancelDialog() {
    const message = state.dialog?.cancel || "";
    if (state.dialog?.submit) { state.pageDraft = null; state.followupRoute = null; }
    finish(message);
  }
  function finish(message) {
    state.dialog = null;
    state.toast = message || "";
    if (pageForm && message) state.pageDraft = null;
    const completedRoute = state.followupRoute || ({
      userEntry: "/adm/users", unitEntry: "/adm/home", wishEntry: "/emp/hopes", attendanceEntry: "/emp/corrections",
      correctionEntry: "/mgr/work",
    })[screen()?.page] || (screen()?.page === "ownChangeRequests" && routeParams().has("shiftId") ? "/emp/shift-change" : "");
    if (current() && message && pageForm && completedRoute && !message.includes("キャンセル")) {
      state.followupRoute = null;
      state.route = completedRoute;
      location.hash = "#" + completedRoute;
    }
    window.clearTimeout(toastTimer);
    render();
    if (message) toastTimer = window.setTimeout(() => {
      state.toast = "";
      app.querySelector(".toast")?.remove();
    }, 3800);
  }
  function render() {
    const u = current();
    const pages = {
      employeeHome: home, managerHome, adminHome, requestHub, employeeMenu, notifications: notificationsPage,
      publishedShifts: () => { views.shifts = "published"; return shiftsPage(true); },
      ownWishes: () => { views.shifts = "wishes"; return shiftsPage(true); },
      teamShifts: () => { views.shifts = "team"; return shiftsPage(true); },
      incomingWishes: () => inbox("wish"),
      incomingAttendance: () => inbox("attendance"),
      incomingChanges: () => inbox("change"),
      ownAttendanceRequests: () => requestsPage("attendance"),
      ownChangeRequests: () => routeParams().has("shiftId") ? embeddedForm(() => changeRequest(routeParams().get("shiftId")), "/emp/shifts") : requestsPage("change"),
      ownRecords: () => { views.records = "own"; return recordsPage(true); },
      teamRecords: () => { views.records = "team"; return recordsPage(true); },
      users: usersPage,
      userEntry: () => embeddedForm(() => userEdit(""), "/adm/users"),
      unitEntry: () => embeddedForm(unitForm, "/adm/home", "ホーム"),
      unitDeletion: unitDeletionPage,
      userDetail: () => embeddedForm(() => userDetails(routeParams().get("id")), "/adm/users"),
      attendanceEntry: () => {
        const item = model.itemById(routeParams().get("id"));
        const date = item?.userId === current().key ? item.date : routeParams().get("date");
        if (!M.validDate(date)) return note("勤怠記録から対象日を指定してください。") + routeLink("勤怠記録", "/emp/attendance");
        return embeddedForm(() => attendanceForm(current().key, date, false, item?.userId === current().key ? item.id : ""), "/emp/corrections");
      },
      correctionEntry: () => routeParams().has("user") && routeParams().has("date")
        ? embeddedForm(() => attendanceForm(routeParams().get("user"), routeParams().get("date"), true), "/mgr/work")
        : embeddedForm(() => recordDate(true), "/mgr/work"),
      wishEntry: () => {
        const [ps, selected] = myPeriods("wishes", true);
        const p = ps.find((p) => p.id === state.periods.wishEntry && model.receptionOpen(p)) || (model.receptionOpen(selected) ? selected : ps.find(model.receptionOpen));
        if (!p) return card("シフト希望提出", [307], note("シフト希望の受付期間外です。") + routeLink("シフト希望一覧", "/emp/hopes"));
        return periodControl("wishEntry", ps.filter(model.receptionOpen), p) + embeddedForm(() => wishForm(p.id), "/emp/hopes");
      },
    };
    pageForm = null;
    const oldRoster = app.querySelector(".shift-roster-scroll");
    if (oldRoster && state.calendars.team) state.calendars.team.scroll = { left: oldRoster.scrollLeft, top: oldRoster.scrollTop };
    app.innerHTML = u && pages[screen()?.page] ? shell(pages[screen().page]()) : loginPage();
    const roster = app.querySelector(".shift-roster-scroll");
    if (roster) {
      const ui = state.calendars.team;
      const column = roster.querySelector('[data-roster-date="' + ui.day + '"]');
      roster.scrollLeft = ui.scroll?.left ?? Math.max(0, (column?.offsetLeft || 0) - 264);
      roster.scrollTop = ui.scroll?.top || 0;
    }
    if (pageForm && state.pageDraft?.route === state.route) {
      const f = app.querySelector("#page-form");
      const values = state.pageDraft.values;
      if (state.pageDraft.punches && f.querySelector("#punch-entries")) {
        f.querySelector("#punch-entries").innerHTML = state.pageDraft.punches.map(punchEntry).join("");
      }
      const occurrence = {};
      for (const el of f.elements) {
        if (!el.name || el.disabled || el.type === "submit") continue;
        const match = values.filter(([key]) => key === el.name).map(([, value]) => value);
        if (el.type === "checkbox") el.checked = match.includes(el.value);
        else if (match.length) { const index = occurrence[el.name] || 0; el.value = match[index] ?? ""; occurrence[el.name] = index + 1; }
      }
    }
    const d = state.dialog;
    if (u && d) {
      app.insertAdjacentHTML("beforeend", `<dialog class="modal" id="dialog" aria-labelledby="dialog-title"><form id="dialog-form">
        ${badge(d.ids)}<h2 id="dialog-title">${esc(d.title)}</h2>${d.body}${errorLine()}
        <div class="modal-actions">${btn(d.submit ? "キャンセル" : "閉じる", "close-dialog")}
        ${d.submit ? `<button class="btn btn-primary" type="submit" value="confirm">${esc(d.label)}</button>` : ""}</div></form></dialog>`);
      const dialog = app.querySelector("#dialog");
      dialog.addEventListener("cancel", (event) => { event.preventDefault(); cancelDialog(); });
      dialog.showModal();
    }
  }
  function embeddedForm(build, back, cancelLabel = "キャンセル") {
    capturingForm = true;
    capturedForm = null;
    try { build(); } finally { capturingForm = false; }
    const d = capturedForm;
    if (!d) return empty("この画面は表示できません。");
    pageForm = d;
    return `<section class="card card-pad"><form id="page-form">${badge(d.ids)}<h2>${esc(d.title)}</h2>${d.body}${errorLine()}
      <div class="modal-actions">${btn(d.submit ? cancelLabel : "一覧に戻る", d.submit ? "cancel-page" : "go-route", back)}
      ${d.submit ? `<button class="btn btn-primary" type="submit" value="confirm">${esc(d.label)}</button>` : ""}</div></form></section>`;
  }
  function syncRoute() {
    const path = location.hash.slice(1);
    const result = N.resolve(path, current(), state.view);
    state.route = result.path;
    if (result.screen) state.view = result.screen.view;
    if (state.pageDraft?.route !== state.route) state.pageDraft = null;
    state.dialog = null;
    state.drawer = false;
    if (location.hash !== "#" + result.path) history.replaceState(null, "", "#" + result.path);
    document.title = (result.screen?.title || "ログイン") + " | Kinchan";
    render();
    window.scrollTo(0, 0);
  }
  function goRoute(path) {
    if (location.hash === "#" + path) syncRoute();
    else location.hash = "#" + path;
  }
  function goTab(id) {
    const destinations = {
      "shifts:published": "/emp/shifts", "shifts:wishes": "/emp/hopes", "shifts:team": "/mgr/shifts",
      "shifts:incoming": "/mgr/hopes", "records:own": "/emp/attendance", "records:team": "/mgr/work",
      "requests:own": "/emp/corrections", "requests:incoming": "/mgr/corrections",
    };
    if (destinations[id]) goRoute(destinations[id]);
  }
  function showError(node, error) {
    const el = node.querySelector("[data-error]");
    if (el) {
      el.textContent = error.message;
      if (error.conflicts?.length) el.insertAdjacentHTML("beforeend", conflictingShifts(error.conflicts));
    }
    else {
      state.toast = error.message;
      render();
    }
  }
  function conflictingShifts(rows, team = true) {
    const visible = rows.filter((s) => team ? model.manages(current(), s.unit)
      : s.published && s.unit === current().unit && s.userId === current().key);
    if (!visible.length) return "";
    return `<section class="conflict-shifts" aria-label="重複しているシフト"><h3>重複しているシフト</h3>` +
      table(["従業員名", "勤務日", "開始時刻", "終了時刻", ...(team ? ["状態"] : [])], [...visible].sort(byDate).map((s) => [
        esc(person(s.userId)), esc(s.date), esc(s.start), esc(s.end) + (s.end < s.start ? "（翌日）" : ""), ...(team ? [status(s.published ? "公開" : "draft")] : []),
      ])) + "</section>";
  }
  function profile() {
    detail("アカウントメニュー", [], dl(["所属単位", model.unitName(current().unit)], ["権限", roles(current())]) +
      actions(btn("ログアウト", "logout", "", "danger")));
  }
  function logout() {
    confirm("ログアウトしますか？", [302], "", () => {
      state.actor = null;
      state.view = "employee";
      state.pageDraft = null;
      state.logoutNotice = "ログアウトしました。";
      state.filters = {};
      state.periods = {};
      Object.assign(views, { shifts: "published", requests: "own", records: "own" });
      state.calendars = {};
      state.route = "/login";
      location.hash = "#/login";
    }, "", "ログアウトする");
    state.dialog.cancel = "ログアウトをキャンセルしました。";
  }

  function shiftDetails(id, team) {
    const s = model.shiftById(id);
    if (!s || (team ? !model.manages(current(), s.unit) : !s.published || s.unit !== current().unit || model.user(s.userId)?.unit !== s.unit)) return;
    const personRecord = model.user(s.userId);
    const assignedNow = personRecord && !personRecord.deleted && personRecord.unit === s.unit;
    detail("シフトの詳細", [team ? 202 : 308], dl(["従業員名", person(s.userId)], ["所属単位", model.unitName(s.unit)],
      ["勤務日", s.date], ["開始時刻", s.start], ["終了時刻", s.end], ["状態", s.published ? "公開" : "下書き"])
      + actions(team && assignedNow ? btn("変更する", "shift-edit", s.id, "secondary") + btn("削除する", "shift-delete", s.id, "danger") : "",
        !team && s.userId === current().key && s.date > model.today() ? btn("シフト日時変更を申請する", "change-new", s.id, "primary") : ""));
  }
  const shiftInput = (s, day) => fieldInput("勤務日", "date", "date", s?.date || day, "required")
    + fieldInput("開始時刻", "start", "time", s?.start, "required") + fieldInput("終了時刻", "end", "time", s?.end, "required");
  function shiftForm(unit, id, day) {
    const s = id ? model.shiftById(id) : null;
    const members = managerUsers().filter((u) => u.unit === unit);
    if (s ? !model.manages(current(), s.unit) : !model.manages(current(), unit)) return;
    const title = s ? "シフトを変更する" : "シフトを登録する";
    form(title, [s ? 202 : 201], (s ? dl(["従業員", person(s.userId)], ["変更前", shiftText(s)]) :
      field("従業員", select("user", [["", "選択してください"], ...userPairs(members)], "", "required"))) +
      '<div class="filter-form">' + shiftInput(s, day || model.today()) + "</div>", (f) => {
      const key = s?.userId || pick(f, "user");
      const info = fields(f, ["date", "start", "end"]);
      model.shiftPlan(current(), key, info, id);
      confirm(title + "確認", [s ? 202 : 201], dl(["従業員", person(key)], ...(s ? [["変更前", shiftText(s)]] : []),
        [s ? "変更後" : "下書きの内容", shiftText(info)]),
        () => model.saveShift(current(), key, info, id), s ? "シフトを変更しました。" : "シフトを下書きで登録しました。", s ? "変更する" : "登録する");
    });
  }
  function deleteShift(id) {
    const s = model.checkDeleteShift(current(), id);
    confirm("シフトの削除確認", [203], dl(["従業員", person(s.userId)], ["シフト", shiftText(s)], ["状態", s.published ? "公開" : "下書き"]),
      () => model.removeShift(current(), model.checkDeleteShift(current(), id), true), "シフトを削除しました。", "削除する");
  }
  function periodForm(unit) {
    form("対象期間・受付期間を登録する", [215], field("管理先", select("unit", unitPairs(managed()), unit, "required")) +
      '<div class="filter-form">' + fieldInput("対象期間の開始日", "from", "date", "", "required")
      + fieldInput("対象期間の終了日", "to", "date", "", "required")
      + fieldInput("受付開始日時", "opens", "datetime-local", "", "required")
      + fieldInput("受付終了日時", "closes", "datetime-local", "", "required") + "</div>", (f) => {
      const info = fields(f, ["unit", "from", "to", "opens", "closes"]);
      model.checkPeriod(current(), info);
      confirm("対象期間・受付期間の登録確認", [215], dl(["管理先", model.unitName(info.unit)], ["対象期間", spanLabel(info)],
        ["受付期間", info.opens.replace("T", " ") + " ～ " + info.closes.replace("T", " ")]),
      () => model.savePeriod(current(), info), "対象期間と受付期間を登録しました。", "登録する");
    });
  }
  function publishForm(id) {
    const p = model.periods.find((p) => p.id === id);
    const rows = model.publishPlan(current(), id);
    if (!rows.length) { detail("シフトの公開", [216], note("この対象期間に下書きのシフトがありません。")); return; }
    confirm("下書きシフトの公開確認", [216], dl(["管理先", model.unitName(p.unit)], ["対象期間", spanLabel(p)]) +
      table(["従業員", "勤務日", "開始", "終了"], rows.sort(byDate).map((s) => [esc(person(s.userId)), esc(s.date), esc(s.start), esc(s.end)])),
      () => model.publish(current(), id), "対象期間の下書きシフトを公開し、対象の従業員へ通知しました。", "公開する");
  }

  function wishForm(id) {
    const p = model.periods.find((p) => p.id === id && p.unit === current().unit);
    if (!model.receptionOpen(p)) { detail("シフト希望", [307], note("シフト希望の受付期間外です。")); return; }
    const rows = [];
    for (let day = p.from; day <= p.to; day = dateAt(day, 1)) {
      const i = model.items.find((i) => i.kind === "wish" && i.userId === current().key && i.date === day && i.status !== "withdrawn");
      const locked = i && (i.unit !== current().unit || ["approved", "rejected"].includes(i.status));
      rows.push(`<div class="wish-entry" data-day="${day}" data-locked="${Boolean(locked)}">
        ${check("batch", day, day, false).replace('type="checkbox"', locked ? 'type="checkbox" disabled' : 'type="checkbox"')}
        ${fieldInput("開始", "start-" + day, "time", i?.start, locked ? "disabled" : "")}
        ${fieldInput("終了", "end-" + day, "time", i?.end, locked ? "disabled" : "")}
        ${i ? status(i.status) : ""}</div>`);
    }
    form("シフト希望を入力する", [307], dl(["対象期間", spanLabel(p)]) + note("希望を出す日の開始・終了時刻を入力してください。") +
      '<div class="filter-form">' + fieldInput("まとめて入力する開始時刻", "batchStart", "time") + fieldInput("まとめて入力する終了時刻", "batchEnd", "time") +
      btn("選択した日に適用する", "wish-batch") + '</div><div class="wish-entries">' + rows.join("") + "</div>" +
      '<div class="actions-row"><button class="btn btn-secondary" type="submit" value="draft">下書きの確認へ</button></div>', (f, mode, el) => {
      const data = [...el.querySelectorAll('.wish-entry[data-locked="false"]')].map((r) => ({
        date: r.dataset.day, start: pick(f, "start-" + r.dataset.day), end: pick(f, "end-" + r.dataset.day),
      }));
      const draft = mode === "draft";
      const changes = model.wishPlan(current(), id, data, draft);
      confirm(draft ? "シフト希望の下書き確認" : "シフト希望の送信確認", [307],
        table(["希望日", "開始", "終了"], changes.map(([row]) => [esc(row.date), esc(row.start), esc(row.end)])),
        () => model.saveWishes(current(), id, data, draft), draft ? "シフト希望を下書きで保存しました。" : "シフト希望を送信しました。", draft ? "下書きで保存する" : "送信する");
    });
  }
  function changeRequest(id) {
    const s = model.shiftById(id);
    if (!s || s.userId !== current().key || !s.published || s.unit !== current().unit || s.date <= model.today()) return;
    if (model.items.some((i) => i.kind === "change" && i.shiftId === id && i.status === "pending")) {
      detail("シフト日時変更申請", [309], note("このシフトには未処理の申請があります。"));
      return;
    }
    form("シフト日時変更を申請する", [309], dl(["変更前のシフト", shiftText(s)]) +
      '<div class="filter-form">' + shiftInput(s, model.today()) + "</div>" + field("申請理由", textarea("reason")), (f) => {
      const after = fields(f, ["date", "start", "end"]);
      const reason = pick(f, "reason");
      const plan = model.changePlan(current(), id, after, reason);
      confirm("シフト日時変更申請の送信確認", [309], dl(["変更前", shiftText(s)], ["変更後", shiftText(after)], ["申請理由", reason]) +
        (plan.conflicts.length ? note("他の公開済みシフトと重複しています。申請は送信できます。") + conflictingShifts(plan.conflicts, false) : ""),
        () => model.submitChange(current(), id, after, reason), "シフト日時変更申請を送信しました。", "送信する");
    });
  }
  function itemDetails(id, team) {
    const i = model.itemById(id);
    if (!i || (team ? !model.managedItem(current(), i) : i.userId !== current().key)) return;
    const wish = i.kind === "wish", att = i.kind === "attendance";
    const ids = team ? [wish ? 204 : att ? 207 : 212] : [wish ? 311 : att ? 310 : 318];
    let body = dl(["従業員", person(i.userId)], ["所属単位", model.unitName(model.user(i.userId).unit)], [wish ? "希望日" : "対象日", i.date],
      ["処理状態", statusLabels[i.status]], ["送信日時", i.sentAt?.replace("T", " ") || "—"],
      ...(i.status === "rejected" ? [["却下理由", i.rejectReason]] : []));
    if (wish) {
      const p = model.periodAt(i.unit, i.date);
      body += dl(["対象期間", p ? spanLabel(p) : "—"], ["希望開始・終了時刻", i.start + "–" + i.end]);
      if (team && model.manages(current(), i.unit)) body += h("h3", "同じ所属単位の登録済みシフト") +
        shiftRows(model.shifts.filter((s) => s.unit === i.unit && s.date === i.date), true);
    } else if (att) {
      body += h("h3", "対象日の勤怠記録") + punchesList(model.record(i.userId, i.date)?.punches || []) + h("h3", "申請された打刻") + punchesList(i.after);
      if (team) body += model.attendanceComparison(i).map(note).join("");
    } else {
      body += dl(["変更前のシフト", shiftText(i.before)], ["変更後のシフト", shiftText(i.after)]);
      if (team) {
        const conflicts = model.shiftConflicts(i.userId, i.after, i.shiftId);
        body += conflicts.length ? note("変更後の日時は登録済みシフトと重複しています。") + conflictingShifts(conflicts)
          : note("登録済みシフトとの重複はありません。");
      }
    }
    if (!wish) body += dl(["申請理由", i.reason]);
    if (i.status === "pending") body += actions(team
      ? (!wish || !model.user(i.userId).deleted ? btn("承認する", "approve", i.id, "primary") : "") + btn("却下する", "reject", i.id, "danger")
      : (att && current().unit ? btn("申請を変更する", "attendance-edit", i.id, "secondary") : "") + btn("取り下げる", "withdraw", i.id, "danger"));
    detail(kindLabels[i.kind] + "の詳細", ids, body);
  }
  function itemPreview(i) {
    const summary = i.kind === "wish" ? i.start + "–" + i.end : i.kind === "change" ? shiftText(i.before) + " → " + shiftText(i.after) : punchesText(i.after);
    return dl(["従業員", person(i.userId)], ["対象日", i.date], ["内容", summary], ...(i.reason ? [["申請理由", i.reason]] : []));
  }
  function decideItem(id, approve) {
    const i = model.itemById(id);
    if (!model.managedItem(current(), i) || i.status !== "pending") return;
    const [a, r] = i.kind === "wish" ? [205, 206] : i.kind === "attendance" ? [208, 209] : [213, 214];
    const content = itemPreview(i) + (i.userId === current().key ? note("対象は自分自身の" + kindLabels[i.kind] + "です。") : "");
    if (approve) confirm(kindLabels[i.kind] + "の承認確認", [a], content,
      () => model.decide(current(), id, true), "承認しました。", "承認する");
    else form(kindLabels[i.kind] + "を却下する", [r], content +
      field("定型文", select("template", [["", "定型文を選んで挿入"], ...rejectTemplates.map((t) => [t, t])], "", 'data-reject-template="true"')) +
      field("却下理由", textarea("reason")), (f) => {
      const reason = pick(f, "reason");
      if (!reason) throw new Error("却下理由を入力してください。");
      confirm(kindLabels[i.kind] + "の却下確認", [r], content + dl(["却下理由", reason]),
        () => model.decide(current(), id, false, reason), "却下しました。", "却下する");
    });
  }
  function withdrawItem(id) {
    const i = model.itemById(id);
    if (!i || i.userId !== current().key || i.status !== "pending") return;
    confirm(kindLabels[i.kind] + "の取り下げ確認", [i.kind === "wish" ? 315 : i.kind === "attendance" ? 314 : 316], itemPreview(i),
      () => model.withdraw(current(), id), "取り下げました。", "取り下げる");
  }

  function recordDetails(key, date, team) {
    if (team ? !model.manages(current(), model.user(key)?.unit) : current().key !== key) return;
    const r = model.record(key, date);
    const d = model.dayRows(key, date, date)[0];
    const hist = r?.history || [];
    detail("勤怠記録の詳細", [team ? 211 : 313], dl(["従業員", person(key)], ["対象日", date],
      ["公開済みシフト", d?.planned.map(shiftText).join("、") || "なし"], ["休憩時間", duration(d?.rest || 0)], ["勤務時間", duration(d?.work || 0)])
      + h("h3", "打刻") + punchesList(r?.punches || []) + h("h3", "修正履歴")
      + (hist.length ? itemsList(hist.map((e) => itemRow(e.at.replace("T", " ") + "・" + person(e.by), e.basis + " ／ " + e.reason) + punchesList(e.before))) : empty("修正履歴はありません。"))
      + actions(team && !model.user(key)?.deleted ? btn("勤怠を修正する", "correction", key + ":" + date, "secondary") :
        !team && current().unit ? btn("勤怠修正を申請する", "attendance-new", date, "primary") : ""));
  }
  function recordDate(team) {
    if (team ? !manager() : !current().unit) return;
    form(team ? "修正する従業員と対象日を指定する" : "申請の対象日を指定する", [team ? 210 : 306],
      (team ? field("従業員", select("user", [["", "選択してください"], ...userPairs(managerUsers())], "", "required")) : "") +
      fieldInput("対象日", "date", "date", model.today(), 'max="' + model.today() + '" required'), (f) => {
        const date = pick(f, "date");
        goRoute(team ? "/mgr/attendance?user=" + encodeURIComponent(pick(f, "user")) + "&date=" + encodeURIComponent(date)
          : "/emp/correction?date=" + encodeURIComponent(date));
      }, "打刻を入力する");
  }
  function punchEntry(p = {}) {
    return `<div class="punch-entry">${field("種類", select("type", punchTypes.map((t) => [t, t]), p.type || "出勤"))}
      ${fieldInput("打刻日時", "at", "datetime-local", p.at, 'step="1" required')}${btn("行を削除", "punch-remove")}</div>`;
  }
  function attendanceForm(key, date, team, id, newRecordConfirmed = false) {
    const u = model.user(key);
    const existing = id ? model.itemById(id) : null;
    if (!M.validDate(date) || (team ? !u || u.deleted || !model.manages(current(), u.unit) : key !== current().key || !current().unit)) return;
    if (!team && !existing && model.items.some((i) => i.kind === "attendance" && i.userId === key && i.date === date && i.status === "pending")) {
      detail("勤怠修正申請", [306], note("対象日に未処理の勤怠修正申請があります。自分の申請一覧から変更してください。") +
        actions(btn("自分の申請を表示", "go-tab", "requests:own", "secondary")));
      return;
    }
    const record = model.record(key, date);
    if (team && !record && !newRecordConfirmed) {
      form("勤怠記録の新規登録", [210], note("対象日の勤怠記録はありません。新しく登録しますか？")
        + dl(["従業員", person(key)], ["対象日", date]), () => attendanceForm(key, date, true, id, true), "入力に進む");
      return;
    }
    const currentPunches = record?.punches || [];
    const history = record?.history || [];
    const pending = team && model.items.find((i) => i.kind === "attendance" && i.userId === key && i.date === date && i.status === "pending");
    const initial = existing?.after || currentPunches;
    const reasonLabel = team ? "修正理由" : "申請理由";
    const basis = team ? 210 : 306;
    form(team ? "勤怠を修正する" : "勤怠修正を申請する", [basis],
      dl(["従業員", person(key)], ["対象日", date]) + h("h3", "現在の打刻") + punchesList(currentPunches) +
      (team && key === current().key ? note("対象は自分自身の勤怠記録です。") : "") +
      (pending ? note("対象日に未処理の勤怠修正申請があります。直接修正してもこの申請の処理状態は変わりません。")
        + dl(["申請された打刻", punchesText(pending.after)], ["申請理由", pending.reason]) : "") +
      (team && history.length ? h("h3", "修正履歴") + itemsList(history.map((e) => itemRow(e.at.replace("T", " ") + "・" + person(e.by), e.basis + " ／ " + e.reason) + punchesList(e.before))) : "") +
      h("h3", "修正後の打刻") + '<div id="punch-entries">' + initial.map(punchEntry).join("") + "</div>" +
      actions(btn("打刻を追加する", "punch-add", date, "secondary")) + field(reasonLabel, textarea("reason", existing?.reason)), (f) => {
      const types = f.getAll("type");
      const after = f.getAll("at").map((at, index) => ({ at: time(String(at)), type: String(types[index]) }));
      const reason = pick(f, "reason");
      if (team) model.correctionPlan(current(), key, date, after, reason);
      else model.attendancePlan(current(), { date, after, reason }, id);
      confirm(team ? "勤怠修正の確認" : "勤怠修正申請の送信確認", [basis], dl(["対象日", date], [reasonLabel, reason])
        + h("h3", "修正前") + punchesList(currentPunches) + h("h3", "修正後") + punchesList(after), () => {
        if (team) model.correct(current(), key, date, after, reason);
        else model.submitAttendance(current(), { date, after, reason }, id);
      }, team ? "勤怠記録を修正しました。" : "勤怠修正申請を送信しました。", team ? "修正する" : "送信する");
    });
  }
  function csvExport() {
    if (!manager()) return;
    const rows = teamRecords(state.filters.teamRecords || monthFilter());
    const data = [["従業員", "所属単位", "勤務時間", "残業時間", "遅刻回数", "早退回数", "欠勤回数", "当月の残業時間", "36協定"],
      ...rows.map((s) => [s.u.name, model.unitName(s.u.unit), duration(s.work), duration(s.overtime), s.late, s.early, s.absent, duration(s.monthOvertime), s.alert])];
    const cell = (raw) => {
      let str = String(raw);
      if (/^[\s]*[=+@-]/.test(str)) str = "'" + str;
      return '"' + str.replaceAll('"', '""') + '"';
    };
    const url = URL.createObjectURL(new Blob(["\ufeff" + data.map((row) => row.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "kinchan-勤務実態.csv";
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function userDetails(id) {
    const u = model.user(id);
    if (!u || !master()) return;
    detail("ユーザーの詳細", [107], dl(["氏名", u.name], ["ユーザーID", u.id], ["権限", roles(u)], ["所属", model.unitName(u.unit)],
      ["管理先", assigned(u)], ["削除済み", u.deleted ? "はい" : "いいえ"]) + (!u.deleted ? actions(
      btn("ユーザー情報を編集する", "user-edit", id, "primary"),
      u.key !== current().key ? btn("権限を変更する", "user-roles", id, "secondary") : "",
      btn(u.unit ? "所属を変更する" : "所属を設定する", "user-unit", id, "secondary"),
      model.has(u, "manager") ? btn("管理先を割り当てる", "user-managed", id, "secondary") : "",
      u.key !== current().key ? btn("ユーザーを削除する", "user-delete", id, "danger") : "") : ""));
  }
  function userEdit(id) {
    if (!master()) return;
    const u = id ? model.adminTarget(current(), id) : null;
    const label = u ? "ユーザー情報を変更する" : "ユーザーを登録する";
    form(label, [u ? 102 : 101], fieldInput("氏名", "name", "text", u?.name, 'maxlength="30" required') +
      fieldInput("ユーザーID", "id", "text", u?.id, 'maxlength="20" required') +
      fieldInput(u ? "新しいパスワード（変更時のみ）" : "パスワード", "password", "password", "", 'autocomplete="new-password"' + (u ? "" : " required")), (f) => {
        const info = { ...fields(f, ["name", "id"]), password: String(f.get("password") || "") };
        model.checkUserInfo(current(), info, id);
        confirm(label + "確認", [u ? 102 : 101], dl(["氏名", info.name], ["ユーザーID", info.id],
          ["パスワード", info.password ? "入力済み" : "変更なし"]), () => {
          const saved = model.saveUser(current(), info, id);
          if (!id && screen()?.page === "userEntry") state.followupRoute = "/adm/user?id=" + encodeURIComponent(saved.key);
        },
        u ? "ユーザー情報を変更しました。" : "ユーザーを登録しました。", u ? "変更する" : "登録する");
      });
  }
  function userRoles(id) {
    const u = model.adminTarget(current(), id, true);
    form("ユーザーの権限を変更する", [104], dl(["現在の権限", roles(u)]) +
      Object.entries(roleLabels).map(([r, label]) => check("roles", label, r, u.roles.includes(r))).join(""), (f) => {
        const next = f.getAll("roles").map(String);
        confirm("権限の変更確認", [104], dl(["変更前", roles(u)], ["変更後", roles({ roles: next })]) +
          (!next.includes("manager") && u.managed.length ? note("管理先の割り当ても外れます。") : ""),
        () => model.setRoles(current(), id, next), "権限を変更しました。", "変更する");
      });
  }
  function userUnit(id) {
    const u = model.adminTarget(current(), id);
    const uc = u.unit ? 106 : 105;
    form(u.unit ? "ユーザーの所属を変更する" : "ユーザーの所属を設定する", [uc], dl(["現在の所属", model.unitName(u.unit)]) +
      field("所属単位", select("unit", [["", "選択してください"], ...unitPairs(model.units)], u.unit, "required")), (f) => {
        const unit = pick(f, "unit");
        confirm("所属の確認", [uc], dl(["氏名", u.name], ["変更前", model.unitName(u.unit)], ["変更後", model.unitName(unit)]),
          () => model.setUnit(current(), id, unit), "所属を更新しました。", "確定する");
      });
  }
  function userManaged(id) {
    const u = model.adminTarget(current(), id);
    if (!model.has(u, "manager")) return;
    form("勤怠管理者に管理先を割り当てる", [109], dl(["現在の管理先", assigned(u)]) +
      model.units.map((unit) => check("managed", unit.name, unit.key, u.managed.includes(unit.key))).join(""), (f) => {
        const next = f.getAll("managed").map(String);
        if (!next.length) throw new Error("管理先を1つ以上指定してください。");
        confirm("管理先の割り当て確認", [109], dl(["変更前", assigned(u)], ["変更後", next.map(model.unitName).join("、")]),
          () => model.setManaged(current(), id, next), "管理先を割り当てました。", "割り当てる");
      });
  }
  function userDelete(id) {
    const u = model.adminTarget(current(), id, true);
    const count = model.shifts.filter((s) => s.userId === id && s.date > model.today()).length;
    confirm("ユーザーの削除確認", [103], dl(["氏名", u.name], ["ユーザーID", u.id], ["翌日以降に削除するシフト", count + "件"],
      ["割り当てを外す管理先", assigned(u)]), () => model.deleteUser(current(), id), "ユーザーを削除しました。", "削除する");
  }
  function unitForm() {
    if (!master()) return;
    form("所属追加", [108], fieldInput("所属単位名", "name", "text", "", "required"), (f) => {
      const name = pick(f, "name");
      model.checkUnit(current(), name);
      confirm("所属追加の確認", [108], dl(["所属単位名", name]), () => model.addUnit(current(), name), "所属を追加しました。", "追加する");
    });
  }
  function unitDelete(id) {
    const { unit, reasons } = model.unitDeletionPlan(current(), id);
    if (reasons.length) throw new Error("この所属は削除できません：" + reasons.join("、"));
    confirm("所属削除の確認", [110], dl(["所属単位名", unit.name]) +
      note("ユーザーの所属・管理先・シフト・申請・対象期間・勤怠記録などで使われている所属は削除不可。過去の参照も含めます。") +
      '<p class="item-sub">関連データの削除や所属・管理先の解除は行いません。</p>',
      () => model.deleteUnit(current(), id), "所属を削除しました。", "削除する");
  }

  app.addEventListener("submit", (event) => {
    event.preventDefault();
    const el = event.target;
    const f = new FormData(el);
    const formId = el.getAttribute("id");
    try {
      if (formId === "login-form") {
        const user = model.authenticate(pick(f, "userId"), String(f.get("password")));
        if (!user) throw new Error("ユーザーIDまたはパスワードが正しくありません。");
        state.actor = user;
        state.view = "employee";
        state.logoutNotice = "";
        location.hash = "#" + N.loginDestination();
        syncRoute();
      } else if (formId === "dialog-form") state.dialog?.submit?.(f, event.submitter?.value, el);
      else if (formId === "page-form") pageForm?.submit?.(f, event.submitter?.value, el);
      else if (el.dataset.filter) {
        const filter = { ...Object.fromEntries(f), deleted: f.has("deleted") };
        if (filter.from && filter.to && filter.from > filter.to) throw new Error("開始日は終了日以前を指定してください。");
        state.filters[el.dataset.filter] = filter;
        render();
      }
    } catch (error) { showError(el, error); }
  });
  app.addEventListener("change", (event) => {
    const el = event.target;
    if (el.dataset.rejectTemplate) {
      const reason = el.form.elements.reason;
      if (rejectTemplates.includes(el.value)) {
        reason.value = [reason.value.trim(), el.value].filter(Boolean).join("\n");
        reason.focus();
      }
      el.value = "";
      return;
    }
    if (el.dataset.pageSwitch) { goRoute(el.value); return; }
    if (el.dataset.period) { state.periods[el.dataset.period] = el.value; render(); }
    if (el.dataset.teamFilter) {
      state.filters.teamShifts = el.dataset.teamFilter === "unit" ? { unit: el.value }
        : { ...state.filters.teamShifts, unit: app.querySelector("[data-team-filter=unit]").value, period: el.value };
      render();
    }
  });
  app.addEventListener("click", (event) => {
    const el = event.target.closest("[data-action]");
    if (!el) return;
    const { action, id } = el.dataset;
    try {
      if (!current()) {
        if (action === "demo") {
          const u = model.user(id);
          const form = app.querySelector("#login-form");
          form.elements.userId.value = u.id;
          form.elements.password.value = u.password;
        }
        return;
      }
      const [key, day] = (id || "").split(":");
      const commands = {
        "switch-view": () => { if (N.allowedViews(current()).includes(id)) goRoute(N.homes[id]); },
        "tab": () => goTab(id),
        "go-tab": () => goTab(id),
        "go-route": () => goRoute(id),
        "calendar-mode": () => updateCalendar(action, id),
        "calendar-day": () => updateCalendar(action, id),
        "calendar-month": () => updateCalendar(action, id),
        "roster-day": () => updateCalendar(action, id),
        "profile": profile, "logout": logout,
        "close-dialog": cancelDialog,
        "cancel-page": () => { state.pageDraft = null; state.followupRoute = null; goRoute(id); finish("操作をキャンセルしました。"); },
        "notifications": () => goRoute("/" + (state.view === "manager" ? "mgr" : state.view === "master" ? "adm" : "emp") + "/notifications"),
        "close-notifications": () => { state.drawer = false; render(); },
        "notification": () => openNotification(id),
        "punch": () => { const at = model.punch(current(), id); finish(id + "を " + at.replace("T", " ") + " に記録しました。"); },
        "shift-detail": () => shiftDetails(id, el.dataset.team === "true"),
        "shift-new": () => shiftForm(id, "", el.dataset.date),
        "shift-edit": () => shiftForm(model.shiftById(id)?.unit, id),
        "shift-delete": () => deleteShift(id),
        "period-new": () => periodForm(id),
        "publish": () => publishForm(id),
        "wish-edit": () => wishForm(id),
        "wish-batch": () => {
          const form = el.form;
          const { batchStart, batchEnd } = form.elements;
          if (!batchStart.value || !batchEnd.value || batchStart.value === batchEnd.value) throw new Error("まとめて入力する開始・終了時刻を指定してください。");
          const days = new FormData(form).getAll("batch");
          if (!days.length) throw new Error("まとめて入力する日を選択してください。");
          for (const d of days) {
            form.elements["start-" + d].value = batchStart.value;
            form.elements["end-" + d].value = batchEnd.value;
          }
        },
        "change-new": () => goRoute("/emp/shift-change?shiftId=" + encodeURIComponent(id)),
        "item-own": () => itemDetails(id, false),
        "item-manager": () => itemDetails(id, true),
        "approve": () => decideItem(id, true),
        "reject": () => decideItem(id, false),
        "withdraw": () => withdrawItem(id),
        "record-detail": () => recordDetails(key, day, el.dataset.team === "true"),
        "attendance-date": () => recordDate(false),
        "correction-date": () => recordDate(true),
        "attendance-new": () => goRoute("/emp/correction?date=" + encodeURIComponent(id)),
        "attendance-edit": () => { const i = model.itemById(id); if (i?.userId === current().key && i.status === "pending") goRoute("/emp/correction?id=" + encodeURIComponent(id)); },
        "correction": () => goRoute("/mgr/attendance?user=" + encodeURIComponent(key) + "&date=" + encodeURIComponent(day)),
        "punch-add": () => app.querySelector("#punch-entries").insertAdjacentHTML("beforeend", punchEntry({ at: id + "T00:00:00" })),
        "punch-remove": () => el.closest(".punch-entry").remove(),
        "csv": csvExport,
        "user-detail": () => goRoute("/adm/user?id=" + encodeURIComponent(id)),
        "user-edit": () => userEdit(id),
        "user-roles": () => userRoles(id),
        "user-unit": () => userUnit(id),
        "user-managed": () => userManaged(id),
        "user-delete": () => userDelete(id),
        "unit-new": unitForm,
        "unit-delete": () => unitDelete(id),
      };
      commands[action]?.();
    } catch (error) { showError(app.querySelector("#dialog-form") || app, error); }
  });
  window.addEventListener("hashchange", syncRoute);
  syncRoute();
})();
