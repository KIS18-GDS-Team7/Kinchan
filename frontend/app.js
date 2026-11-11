(() => {
  "use strict";

  const FIXED_DATE = "2026-10-14";
  const app = document.querySelector("#app");

  const users = [
    { id: "emp01", password: "password", name: "田中 陽菜", unit: "渋谷店", roles: [], status: "off", shift: "10:00–18:00" },
    { id: "emp02", password: "password", name: "鈴木 大輔", unit: "渋谷店", roles: [], status: "off", shift: null },
    { id: "manager01", password: "password", name: "佐藤 健一", unit: "渋谷店", roles: ["manager"], status: "working", shift: "09:00–18:00" },
    { id: "admin01", password: "password", name: "山本 恵子", unit: "本部", roles: ["master"], status: "off", shift: "09:00–18:00" },
  ];

  const state = {
    currentUser: null,
    route: "/login",
    activeTabs: { shifts: "mine", requests: "mine", records: "mine", users: "list" },
    drawerOpen: false,
    modal: null,
    toast: "",
    selectedUserId: "emp01",
    selectedRecordUserId: "emp01",
    shifts: [
      { id: 1, date: "2026-10-14", userId: "emp01", user: "田中 陽菜", unit: "渋谷店", start: "10:00", end: "18:00", published: true },
      { id: 2, date: "2026-10-15", userId: "emp01", user: "田中 陽菜", unit: "渋谷店", start: "10:00", end: "18:00", published: true },
      { id: 3, date: "2026-10-14", userId: "manager01", user: "佐藤 健一", unit: "渋谷店", start: "09:00", end: "18:00", published: true },
      { id: 4, date: "2026-10-16", userId: "emp02", user: "鈴木 大輔", unit: "渋谷店", start: "12:00", end: "20:00", published: false },
    ],
    wishes: [
      { id: 1, userId: "emp01", user: "田中 陽菜", date: "2026-11-03", time: "10:00–18:00", status: "pending" },
      { id: 2, userId: "emp02", user: "鈴木 大輔", date: "2026-11-04", time: "12:00–20:00", status: "pending" },
      { id: 3, userId: "emp01", user: "田中 陽菜", date: "2026-11-05", time: "希望なし", status: "approved" },
    ],
    requests: [
      { id: 1, userId: "emp01", user: "田中 陽菜", type: "勤怠修正", target: "2026-10-12", before: "退勤 17:42", after: "退勤 18:02", reason: "打刻時刻の修正", status: "pending" },
      { id: 2, userId: "emp01", user: "田中 陽菜", type: "シフト日時変更", target: "2026-10-18", before: "10:00–18:00", after: "12:00–20:00", reason: "開始時刻の変更", status: "approved" },
      { id: 3, userId: "emp02", user: "鈴木 大輔", type: "勤怠修正", target: "2026-10-11", before: "出勤 09:18", after: "出勤 09:00", reason: "打刻漏れ", status: "pending" },
    ],
    records: [
      { userId: "emp01", date: "2026-10-14", plan: "10:00–18:00", actual: "—", breakTime: "—", work: "—", note: "出勤前" },
      { userId: "emp01", date: "2026-10-13", plan: "10:00–18:00", actual: "09:58–18:03", breakTime: "01:00", work: "07:05", note: "" },
      { userId: "emp01", date: "2026-10-12", plan: "10:00–18:00", actual: "10:01–17:42", breakTime: "01:00", work: "06:41", note: "修正申請中" },
      { userId: "emp02", date: "2026-10-14", plan: "—", actual: "—", breakTime: "—", work: "—", note: "シフトなし" },
    ],
    notifications: [
      { id: 1, title: "シフト希望が承認されました", body: "11月5日の希望が承認されました。", target: "/shifts", unread: true },
      { id: 2, title: "勤怠修正申請を送信しました", body: "10月12日の申請は未処理です。", target: "/requests", unread: false },
    ],
  };

  const icons = { home: "⌂", shifts: "▦", requests: "✓", records: "◫", users: "♙" };
  const labels = { "/": "ホーム", "/shifts": "シフト", "/requests": "申請", "/records": "勤怠記録", "/users": "ユーザー管理" };
  const statusLabels = { pending: "承認待ち", approved: "承認", rejected: "却下", withdrawn: "取り下げ", working: "出勤中", break: "休憩中", off: "未出勤" };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function uc(...ids) {
    return `<div class="uc-row">${ids.map((id) => `<span class="uc-chip">${id}</span>`).join("")}</div>`;
  }

  function status(value) {
    return `<span class="status status-${value}">${statusLabels[value] ?? value}</span>`;
  }

  function hasRole(role) {
    return state.currentUser?.roles.includes(role);
  }

  function formatDate(date) {
    const d = new Date(`${date}T00:00:00`);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  }

  function navItems() {
    const items = [
      ["/", "home", "ホーム"],
      ["/shifts", "shifts", "シフト"],
      ["/requests", "requests", "申請"],
      ["/records", "records", "勤怠記録"],
    ];
    if (hasRole("master")) items.push(["/users", "users", "ユーザー管理"]);
    return items;
  }

  function navHtml(className) {
    return `<nav class="${className}" aria-label="主要メニュー">${navItems().map(([path, icon, label]) => `
      <a class="nav-link ${state.route === path ? "active" : ""}" href="#${path}" data-route="${path}">
        <span class="nav-icon" aria-hidden="true">${icons[icon]}</span><span>${label}</span>
      </a>`).join("")}</nav>`;
  }

  function renderLogin() {
    app.innerHTML = `
      <main class="login-shell">
        <section class="login-brand">
          <div class="brand-mark"><span class="brand-logo">K</span> Kinchan</div>
          <div class="login-copy">
            <p class="eyebrow" style="color:#d9f0ec">勤怠管理システム</p>
            <h1>1分単位の勤怠を<br />一括管理。</h1>
            <p>打刻、シフト希望、申請、勤怠記録をシステム上で完結するための、ドキュメント準拠フロントエンドモックです。</p>
          </div>
        </section>
        <section class="login-panel">
          <div class="login-card">
            <p class="eyebrow">UC-301</p>
            <h2>ログイン</h2>
            <p class="lead">ユーザーIDとパスワードを入力してください。</p>
            <form id="login-form">
              <div class="field"><label for="user-id">ユーザーID</label><input class="input" id="user-id" name="userId" autocomplete="username" required /></div>
              <div class="field"><label for="password">パスワード</label><input class="input" id="password" name="password" type="password" autocomplete="current-password" required /></div>
              <button class="btn btn-primary btn-block" type="submit">ログイン</button>
              <p class="form-error" id="login-error" role="alert"></p>
            </form>
            <div class="demo-box">
              <h3>モック用デモアカウント</h3>
              <div class="demo-list">
                ${users.map((u) => `<button type="button" class="demo-account" data-demo="${u.id}"><strong>${escapeHtml(u.name)}</strong><span>${u.roles.includes("manager") ? "従業員＋勤怠管理者" : u.roles.includes("master") ? "従業員＋マスタ管理者" : u.shift ? "従業員" : "従業員（本日シフトなし）"}</span></button>`).join("")}
              </div>
            </div>
          </div>
        </section>
      </main>`;
  }

  function shell(content) {
    const u = state.currentUser;
    return `
      <div class="app-shell">
        <aside class="sidebar">
          <div class="brand-mark"><span class="brand-logo">K</span> Kinchan</div>
          ${navHtml("sidebar-nav")}
          <div class="sidebar-foot"><strong>${escapeHtml(u.name)}</strong><p>${escapeHtml(u.unit)}</p><p>${roleText(u)}</p></div>
        </aside>
        <div class="workspace">
          <header class="topbar">
            <h1 class="page-title">${labels[state.route] ?? "Kinchan"}</h1>
            <div class="top-actions">
              <button class="icon-btn" id="notification-button" aria-label="通知を表示">♧${state.notifications.some((n) => n.unread) ? '<span class="notification-dot"></span>' : ""}</button>
              <button class="profile-chip" id="profile-button" aria-label="アカウントメニュー"><span class="avatar">${escapeHtml(u.name.slice(0,1))}</span><span>${escapeHtml(u.name)}</span></button>
            </div>
          </header>
          <main class="content">${content}</main>
          ${navHtml("mobile-nav")}
        </div>
        ${state.drawerOpen ? notificationDrawer() : ""}
        ${state.modal ? modalHtml() : ""}
        ${state.toast ? `<div class="toast" role="status">${escapeHtml(state.toast)}</div>` : ""}
      </div>`;
  }

  function roleText(user) {
    const roles = ["従業員"];
    if (user.roles.includes("manager")) roles.push("勤怠管理者");
    if (user.roles.includes("master")) roles.push("マスタ管理者");
    return roles.join("・");
  }

  function pageHead(title, description, action = "") {
    return `<div class="page-head"><div><h2>${title}</h2><p>${description}</p></div>${action}</div>`;
  }

  function cardHead(title, description, ids = []) {
    return `<div class="card-head"><div><h3>${title}</h3>${description ? `<p>${description}</p>` : ""}</div>${uc(...ids)}</div>`;
  }

  function homePage() {
    const u = state.currentUser;
    const now = new Date();
    const hhmmss = now.toLocaleTimeString("ja-JP", { hour12: false });
    const punchDisabled = u.status === "off" && !u.shift;
    const managedUsers = users.filter((member) => member.unit === "渋谷店");
    const statusCount = (value) => managedUsers.filter((member) => member.status === value).length;
    const nextShift = state.shifts
      .filter((shift) => shift.userId === u.id && shift.published && shift.date > FIXED_DATE)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    const punchButtons = u.status === "off"
      ? `<button class="punch-btn" data-punch="working" ${punchDisabled ? "disabled" : ""}>出勤する</button>`
      : u.status === "break"
        ? `<button class="punch-btn" data-punch="working">休憩を終了する</button>`
        : `<button class="punch-btn" data-punch="break">休憩を開始する</button><button class="punch-btn secondary" data-punch="off">退勤する</button>`;
    const managerSection = hasRole("manager") ? `
      <section class="card card-pad">
        ${cardHead("管理先の勤務状況", "渋谷店・本日の状況", ["UC-211"])}
        <div class="metric-row">
          <div class="metric"><span>出勤中</span><strong class="num">${statusCount("working")}</strong></div>
          <div class="metric"><span>休憩中</span><strong class="num">${statusCount("break")}</strong></div>
          <div class="metric"><span>未出勤</span><strong class="num">${statusCount("off")}</strong></div>
        </div>
        <div class="list" style="margin-top:18px">
          ${managedUsers.map((member) => `<div class="list-item"><div class="item-main"><p class="item-title">${member.name}</p><p class="item-sub num">${member.shift ? `予定 ${member.shift}` : "本日の公開済みシフトなし"}</p></div>${status(member.status)}</div>`).join("")}
        </div>
      </section>
      <section class="card card-pad">
        ${cardHead("承認待ち", "管理先から届いた申請", ["UC-204", "UC-207", "UC-212"])}
        <div class="metric-row">
          <div class="metric"><span>シフト希望</span><strong class="num">${state.wishes.filter((x) => x.status === "pending").length}</strong></div>
          <div class="metric"><span>勤怠修正</span><strong class="num">${state.requests.filter((x) => x.type === "勤怠修正" && x.status === "pending").length}</strong></div>
          <div class="metric"><span>シフト変更</span><strong class="num">${state.requests.filter((x) => x.type === "シフト日時変更" && x.status === "pending").length}</strong></div>
        </div>
        <a class="btn btn-secondary" href="#/requests" style="margin-top:18px">申請を表示する</a>
      </section>` : "";

    return shell(`
      ${pageHead(`${u.name.split(" ")[0]}さん、おはようございます`, "2026年10月14日 水曜日")}
      <div class="grid ${hasRole("manager") ? "grid-2" : ""}">
        <section class="card card-pad clock-card">
          ${cardHead("打刻", u.shift ? `今日の公開済みシフト ${u.shift}` : "本日の公開済みシフトはありません", ["UC-304", "UC-312"])}
          <div class="clock-time num">${hhmmss}</div><div class="clock-date">現在時刻</div>
          <div class="shift-summary"><div><span>勤務ステータス</span><strong>${statusLabels[u.status]}</strong></div><div><span>所属単位</span><strong>${escapeHtml(u.unit)}</strong></div></div>
          <div class="punch-actions">${punchButtons}</div>
          <p class="punch-message">${punchDisabled ? "当日の公開済みシフトがないため、出勤を打刻できません。" : state.toast || "打刻日時は秒まで記録します。"}</p>
        </section>
        ${managerSection}
      </div>
      ${!hasRole("manager") ? `<section class="card card-pad" style="margin-top:20px">${cardHead("次の予定", "公開済みシフト", ["UC-308"])}<div class="list">${nextShift ? `<div class="list-item"><div><p class="item-title">${formatDate(nextShift.date)}</p><p class="item-sub num">${nextShift.start}–${nextShift.end}・${nextShift.unit}</p></div><a class="btn btn-ghost" href="#/shifts">シフトを表示する</a></div>` : '<div class="empty">次の公開済みシフトはありません。</div>'}</div></section>` : ""}
    `);
  }

  function tabsHtml(group, tabs) {
    return `<div class="tabs" role="tablist">${tabs.map(([key, label, ids]) => `<button class="tab ${state.activeTabs[group] === key ? "active" : ""}" data-tab-group="${group}" data-tab="${key}">${label}${ids?.length ? ` <span class="uc-chip">${ids.join("/")}</span>` : ""}</button>`).join("")}</div>`;
  }

  function shiftsPage() {
    const tabs = [["mine", "登録シフト", ["UC-308"]], ["wishes", "シフト希望", ["UC-307", "UC-311"]]];
    if (hasRole("manager")) tabs.push(["team", "管理先のシフト表", ["UC-201", "UC-202", "UC-203", "UC-216"]], ["incoming", "届いたシフト希望", ["UC-204", "UC-205", "UC-206"]]);
    let body = "";
    const tab = state.activeTabs.shifts;
    if (!tabs.some(([key]) => key === tab)) state.activeTabs.shifts = "mine";

    if (state.activeTabs.shifts === "mine") {
      const mine = state.shifts.filter((s) => s.userId === state.currentUser.id && s.published);
      body = `<section class="card card-pad">${cardHead("自分の公開済みシフト", "リスト表示", ["UC-308", "UC-309"])}<div class="list">${mine.length ? mine.map((s) => `<div class="list-item"><div><p class="item-title">${formatDate(s.date)}</p><p class="item-sub num">${s.start}–${s.end}・${s.unit}</p></div><button class="btn btn-ghost" data-open-request="shift" data-date="${s.date}">変更を申請する</button></div>`).join("") : '<div class="empty">公開済みシフトはありません。</div>'}</div></section>`;
    }
    if (state.activeTabs.shifts === "wishes") {
      const days = [3,4,5,6,7,8,9,10,11,12,13,14];
      const mine = state.wishes.filter((w) => w.userId === state.currentUser.id);
      body = `<div class="grid grid-2"><section class="card card-pad">${cardHead("シフト希望を送信", "複数日を選び、同じ時間をまとめて入力", ["UC-307"])}<form id="wish-form"><div class="calendar-input">${days.map((d) => `<label class="calendar-day"><input type="checkbox" name="days" value="${d}" /><span>11月</span><strong>${d}</strong></label>`).join("")}</div><div class="inline-form"><div class="field"><label>開始</label><input class="input num" type="time" name="start" value="10:00" required /></div><div class="field"><label>終了</label><input class="input num" type="time" name="end" value="18:00" required /></div><div class="field"><label>希望</label><select class="select" name="kind"><option>時間指定</option><option>希望なし</option></select></div><button class="btn btn-primary" type="submit">希望を送信する</button></div></form></section><section class="card card-pad">${cardHead("自分のシフト希望", "下書きを含む処理状態", ["UC-311", "UC-315"])}<div class="list">${mine.map((w) => `<div class="list-item"><div><p class="item-title">${formatDate(w.date)}</p><p class="item-sub num">${w.time}</p></div><div class="item-actions">${status(w.status)}${w.status === "pending" ? `<button class="btn btn-ghost" data-withdraw-wish="${w.id}">取り下げる</button>` : ""}</div></div>`).join("")}</div></section></div>`;
    }
    if (state.activeTabs.shifts === "team") {
      const rows = state.shifts.filter((s) => s.unit === "渋谷店");
      body = `<section class="card card-pad">${cardHead("渋谷店のシフト表", "下書きと公開済みシフト", ["UC-201", "UC-202", "UC-203", "UC-216"])}<div class="notice warning" style="margin-bottom:16px">公開操作は対象期間の下書きシフトをまとめて公開し、従業員へ通知します。</div><div class="table-wrap"><table class="table"><thead><tr><th>勤務日</th><th>従業員</th><th>時間</th><th>状態</th><th>操作</th></tr></thead><tbody>${rows.map((s) => `<tr><td>${formatDate(s.date)}</td><td>${s.user}</td><td class="num">${s.start}–${s.end}</td><td>${s.published ? status("approved") : status("pending")}</td><td><div class="table-actions"><button class="link-btn" data-edit-shift="${s.id}">変更</button><button class="link-btn" data-delete-shift="${s.id}">削除</button></div></td></tr>`).join("")}</tbody></table></div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:18px"><button class="btn btn-secondary" data-new-shift>シフトを登録する</button><button class="btn btn-primary" data-publish-shifts>下書きを公開する</button></div></section>`;
    }
    if (state.activeTabs.shifts === "incoming") {
      const pending = state.wishes.filter((w) => w.status === "pending");
      body = `<section class="card card-pad">${cardHead("届いたシフト希望", "管理先の従業員から送信された希望", ["UC-204", "UC-205", "UC-206"])}<div class="list">${pending.length ? pending.map((w) => `<div class="list-item"><div><p class="item-title">${w.user}</p><p class="item-sub">${formatDate(w.date)}・<span class="num">${w.time}</span></p></div><div class="item-actions"><button class="btn btn-primary" data-decide-wish="${w.id}" data-decision="approved">承認する</button><button class="btn btn-danger" data-decide-wish="${w.id}" data-decision="rejected">却下する</button></div></div>`).join("") : '<div class="empty">承認待ちのシフト希望はありません。</div>'}</div></section>`;
    }
    return shell(`${pageHead("シフト", "自分のシフトと希望、管理先のシフトを一つの画面で表示します。")}${tabsHtml("shifts", tabs)}${body}`);
  }

  function requestsPage() {
    const tabs = [["mine", "自分の申請", ["UC-306", "UC-309", "UC-310", "UC-318"]]];
    if (hasRole("manager")) tabs.push(["pending", "承認待ち", ["UC-207", "UC-208", "UC-209", "UC-212", "UC-213", "UC-214"]]);
    if (!tabs.some(([key]) => key === state.activeTabs.requests)) state.activeTabs.requests = "mine";
    const tab = state.activeTabs.requests;
    let body = "";
    if (tab === "mine") {
      const mine = state.requests.filter((r) => r.userId === state.currentUser.id);
      body = `<section class="card card-pad">${cardHead("申請履歴", "変更前と変更後、処理状態を並べて表示", ["UC-310", "UC-314", "UC-316", "UC-318"])}<div class="list">${mine.length ? mine.map((r) => `<div class="list-item"><div class="item-main"><p class="item-title">${r.type}・${formatDate(r.target)}</p><p class="item-sub num">${r.before} → ${r.after}</p><p class="item-sub">${r.reason}</p></div><div class="item-actions">${status(r.status)}${r.status === "pending" ? `<button class="btn btn-ghost" data-withdraw-request="${r.id}">取り下げる</button>` : ""}</div></div>`).join("") : '<div class="empty">申請はありません。</div>'}</div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:18px"><button class="btn btn-primary" data-open-request="attendance">勤怠修正を申請する</button><button class="btn btn-secondary" data-open-request="shift">シフト変更を申請する</button></div></section>`;
    } else {
      const pending = state.requests.filter((r) => r.status === "pending");
      body = `<section class="card card-pad">${cardHead("承認待ちの申請", "勤怠修正申請とシフト日時変更申請", ["UC-207", "UC-208", "UC-209", "UC-212", "UC-213", "UC-214"])}<div class="list">${pending.length ? pending.map((r) => `<div class="list-item"><div class="item-main"><p class="item-title">${r.user}・${r.type}</p><p class="item-sub">${formatDate(r.target)}・<span class="num">${r.before} → ${r.after}</span></p><p class="item-sub">${r.reason}</p></div><div class="item-actions"><button class="btn btn-primary" data-decide-request="${r.id}" data-decision="approved">承認する</button><button class="btn btn-danger" data-decide-request="${r.id}" data-decision="rejected">却下する</button></div></div>`).join("") : '<div class="empty">承認待ちの申請はありません。</div>'}</div></section>`;
    }
    return shell(`${pageHead("申請", "自分の申請と管理先から届いた申請を表示します。")}${tabsHtml("requests", tabs)}${body}`);
  }

  function recordsTable(userId) {
    const rows = state.records.filter((r) => r.userId === userId);
    return `<div class="table-wrap"><table class="table"><thead><tr><th>日付</th><th>予定</th><th>打刻</th><th>休憩時間</th><th>勤務時間</th><th>状態</th>${hasRole("manager") && state.activeTabs.records === "team" ? "<th>操作</th>" : ""}</tr></thead><tbody>${rows.map((r) => `<tr><td>${formatDate(r.date)}</td><td class="num">${r.plan}</td><td class="num">${r.actual}</td><td class="num">${r.breakTime}</td><td class="num">${r.work}</td><td>${r.note || "—"}</td>${hasRole("manager") && state.activeTabs.records === "team" ? `<td><button class="link-btn" data-edit-record="${r.date}">修正</button></td>` : ""}</tr>`).join("")}</tbody></table></div>`;
  }

  function recordsPage() {
    const tabs = [["mine", "自分の勤怠記録", ["UC-313"]]];
    if (hasRole("manager")) tabs.push(["team", "管理先の勤務実態", ["UC-210", "UC-211"]]);
    if (!tabs.some(([key]) => key === state.activeTabs.records)) state.activeTabs.records = "mine";
    let body = "";
    if (state.activeTabs.records === "mine") {
      body = `<section class="card card-pad">${cardHead("2026年10月の勤怠記録", "シフト、打刻、休憩時間、勤務時間、申請状態", ["UC-313"])}${recordsTable(state.currentUser.id)}</section>`;
    } else {
      const members = users.filter((u) => u.unit === "渋谷店");
      body = `<section class="card card-pad">${cardHead("管理先の勤務実態", "打刻漏れと36協定の警告を含む", ["UC-210", "UC-211"])}<div class="field" style="max-width:320px"><label for="record-user">従業員</label><select class="select" id="record-user">${members.map((u) => `<option value="${u.id}" ${state.selectedRecordUserId === u.id ? "selected" : ""}>${u.name}</option>`).join("")}</select></div><div class="notice warning" style="margin:14px 0">打刻漏れまたは36協定の警告がある場合は、文字と色で表示します。</div>${recordsTable(state.selectedRecordUserId)}</section>`;
    }
    return shell(`${pageHead("勤怠記録", "予定と実績を期間ごとに表示します。")}${tabsHtml("records", tabs)}${body}`);
  }

  function usersPage() {
    if (!hasRole("master")) return shell(`<div class="empty"><h2>この画面を表示する権限がありません。</h2><p>マスタ管理者権限が必要です。</p></div>`);
    const selected = users.find((u) => u.id === state.selectedUserId) ?? users[0];
    const list = `<section class="card card-pad">${cardHead("ユーザー一覧", "会社全体の登録ユーザー", ["UC-101", "UC-107"])}<div class="table-wrap"><table class="table"><thead><tr><th>氏名</th><th>ユーザーID</th><th>所属</th><th>権限</th><th></th></tr></thead><tbody>${users.map((u) => `<tr><td>${u.name}</td><td class="num">${u.id}</td><td>${u.unit}</td><td>${roleText(u)}</td><td><button class="link-btn" data-select-user="${u.id}">詳細</button></td></tr>`).join("")}</tbody></table></div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:18px"><button class="btn btn-secondary" data-new-unit>所属単位を登録する</button><button class="btn btn-primary" data-new-user>ユーザーを登録する</button></div></section>`;
    const detail = `<section class="card card-pad">${cardHead(selected.name, `${selected.id}・${selected.unit}`, ["UC-102", "UC-103", "UC-104", "UC-105", "UC-106", "UC-109"])}<div class="list"><div class="list-item"><div><p class="item-title">基本情報</p><p class="item-sub">氏名・ユーザーID・パスワード</p></div><button class="btn btn-ghost" data-user-action="edit">編集</button></div><div class="list-item"><div><p class="item-title">権限</p><p class="item-sub">${roleText(selected)}</p></div><button class="btn btn-ghost" data-user-action="role">変更</button></div><div class="list-item"><div><p class="item-title">所属単位</p><p class="item-sub">${selected.unit}</p></div><button class="btn btn-ghost" data-user-action="unit">変更</button></div>${selected.roles.includes("manager") ? `<div class="list-item"><div><p class="item-title">管理先</p><p class="item-sub">渋谷店</p></div><button class="btn btn-ghost" data-user-action="assignment">割り当て</button></div>` : ""}</div><button class="btn btn-danger" data-user-action="delete" style="margin-top:18px">ユーザーを論理削除する</button></section>`;
    return shell(`${pageHead("ユーザー管理", "ユーザー・権限・所属単位・管理先を管理します。")}${tabsHtml("users", [["list", "一覧", ["UC-107"]], ["detail", "詳細", ["UC-102", "UC-104", "UC-106", "UC-109"]]])}${state.activeTabs.users === "detail" ? detail : list}`);
  }

  function notificationDrawer() {
    return `<div class="drawer-backdrop" data-close-drawer></div><aside class="drawer" aria-label="通知"><div class="drawer-head"><div><p class="eyebrow">UC-317</p><h2>通知</h2></div><button class="icon-btn" data-close-drawer aria-label="閉じる">×</button></div><div class="list">${state.notifications.map((n) => `<a class="list-item" href="#${n.target}" data-notification="${n.id}"><div><p class="item-title">${n.title}</p><p class="item-sub">${n.body}</p></div>${n.unread ? '<span class="notification-dot" style="position:static;border:0"></span>' : ""}</a>`).join("")}</div></aside>`;
  }

  function modalHtml() {
    const m = state.modal;
    if (m.type === "profile") return `<div class="modal-backdrop" data-close-modal><section class="modal"><h2>${state.currentUser.name}</h2><p>${roleText(state.currentUser)}・${state.currentUser.unit}</p><div class="modal-actions"><button class="btn btn-ghost" data-close-modal>閉じる</button><button class="btn btn-danger" id="logout-button">ログアウト</button></div></section></div>`;
    if (m.type === "request") return `<div class="modal-backdrop" data-close-modal><form class="modal" id="request-form"><p class="eyebrow">${m.kind === "attendance" ? "UC-306" : "UC-309"}</p><h2>${m.kind === "attendance" ? "勤怠修正を申請" : "シフト日時変更を申請"}</h2><div class="field"><label>対象日</label><input class="input" name="date" type="date" value="${m.date ?? FIXED_DATE}" required /></div><div class="field"><label>変更前</label><input class="input" name="before" value="${m.kind === "attendance" ? "退勤 17:42" : "10:00–18:00"}" required /></div><div class="field"><label>変更後</label><input class="input" name="after" value="${m.kind === "attendance" ? "退勤 18:02" : "12:00–20:00"}" required /></div><div class="field"><label>申請理由</label><textarea class="textarea" name="reason" required></textarea></div><div class="modal-actions"><button class="btn btn-ghost" type="button" data-close-modal>キャンセル</button><button class="btn btn-primary" type="submit">送信する</button></div></form></div>`;
    return `<div class="modal-backdrop" data-close-modal><section class="modal"><h2>${m.title}</h2><p>${m.body}</p><div class="modal-actions"><button class="btn btn-ghost" data-close-modal>キャンセル</button><button class="btn ${m.danger ? "btn-danger" : "btn-primary"}" data-confirm-modal>${m.confirmLabel ?? "実行する"}</button></div></section></div>`;
  }

  function render() {
    if (!state.currentUser || state.route === "/login") {
      state.route = "/login";
      renderLogin();
    } else if (state.route === "/") app.innerHTML = homePage();
    else if (state.route === "/shifts") app.innerHTML = shiftsPage();
    else if (state.route === "/requests") app.innerHTML = requestsPage();
    else if (state.route === "/records") app.innerHTML = recordsPage();
    else if (state.route === "/users") app.innerHTML = usersPage();
    else { state.route = "/"; location.hash = "#/"; app.innerHTML = homePage(); }
  }

  function routeFromHash() {
    const path = location.hash.replace(/^#/, "") || (state.currentUser ? "/" : "/login");
    state.route = path;
    state.drawerOpen = false;
    state.modal = null;
    render();
  }

  function showToast(message) {
    state.toast = message;
    render();
    window.setTimeout(() => { state.toast = ""; render(); }, 2600);
  }

  function openDecisionModal(config) {
    state.modal = { type: "confirm", ...config };
    render();
  }

  app.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.target;
    const data = new FormData(form);
    if (form.id === "login-form") {
      const found = users.find((u) => u.id === data.get("userId") && u.password === data.get("password"));
      if (!found) { form.querySelector("#login-error").textContent = "ユーザーIDまたはパスワードが正しくありません。"; return; }
      state.currentUser = found;
      state.route = "/";
      location.hash = "#/";
      render();
    }
    if (form.id === "wish-form") {
      const days = data.getAll("days");
      if (!days.length) { showToast("希望日を1日以上選択してください。"); return; }
      days.forEach((day) => state.wishes.push({ id: Date.now() + Number(day), userId: state.currentUser.id, user: state.currentUser.name, date: `2026-11-${String(day).padStart(2,"0")}`, time: data.get("kind") === "希望なし" ? "希望なし" : `${data.get("start")}–${data.get("end")}`, status: "pending" }));
      showToast(`${days.length}日分のシフト希望を送信しました。`);
    }
    if (form.id === "request-form") {
      state.requests.push({ id: Date.now(), userId: state.currentUser.id, user: state.currentUser.name, type: state.modal.kind === "attendance" ? "勤怠修正" : "シフト日時変更", target: data.get("date"), before: data.get("before"), after: data.get("after"), reason: data.get("reason"), status: "pending" });
      state.modal = null;
      state.activeTabs.requests = "mine";
      state.route = "/requests";
      location.hash = "#/requests";
      showToast("申請を送信しました。");
    }
  });

  app.addEventListener("change", (event) => {
    if (event.target.matches(".calendar-day input")) event.target.closest(".calendar-day").classList.toggle("selected", event.target.checked);
    if (event.target.id === "record-user") { state.selectedRecordUserId = event.target.value; render(); }
  });

  app.addEventListener("click", (event) => {
    const demo = event.target.closest("[data-demo]");
    if (demo) {
      const u = users.find((x) => x.id === demo.dataset.demo);
      app.querySelector("#user-id").value = u.id;
      app.querySelector("#password").value = u.password;
    }
    const tab = event.target.closest("[data-tab]");
    if (tab) { state.activeTabs[tab.dataset.tabGroup] = tab.dataset.tab; render(); }
    if (event.target.closest("#notification-button")) { state.drawerOpen = true; render(); }
    if (event.target.closest("#profile-button")) { state.modal = { type: "profile" }; render(); }
    if (event.target.closest("[data-close-drawer]")) { state.drawerOpen = false; render(); }
    const notification = event.target.closest("[data-notification]");
    if (notification) { const n = state.notifications.find((x) => x.id === Number(notification.dataset.notification)); if (n) n.unread = false; }
    if (event.target.closest("#logout-button")) { state.currentUser = null; state.modal = null; location.hash = "#/login"; render(); }
    const closeModal = event.target.closest("[data-close-modal]");
    if (closeModal && (closeModal.tagName === "BUTTON" || closeModal === event.target)) { state.modal = null; render(); }

    const punch = event.target.closest("[data-punch]");
    if (punch) {
      const previousStatus = state.currentUser.status;
      state.currentUser.status = punch.dataset.punch;
      const action = punch.dataset.punch === "working" ? (previousStatus === "break" ? "休憩終了" : "出勤") : punch.dataset.punch === "break" ? "休憩開始" : "退勤";
      showToast(`${action}を ${new Date().toLocaleTimeString("ja-JP", { hour12: false })} に記録しました。`);
    }
    const openRequest = event.target.closest("[data-open-request]");
    if (openRequest) { state.modal = { type: "request", kind: openRequest.dataset.openRequest, date: openRequest.dataset.date }; render(); }
    const withdrawRequest = event.target.closest("[data-withdraw-request]");
    if (withdrawRequest) openDecisionModal({ title: "申請を取り下げますか", body: "未処理の申請を取り下げます。", confirmLabel: "取り下げる", danger: true, action: "withdraw-request", id: Number(withdrawRequest.dataset.withdrawRequest) });
    const withdrawWish = event.target.closest("[data-withdraw-wish]");
    if (withdrawWish) openDecisionModal({ title: "シフト希望を取り下げますか", body: "未処理のシフト希望を取り下げます。", confirmLabel: "取り下げる", danger: true, action: "withdraw-wish", id: Number(withdrawWish.dataset.withdrawWish) });
    const decideRequest = event.target.closest("[data-decide-request]");
    if (decideRequest) { const r = state.requests.find((x) => x.id === Number(decideRequest.dataset.decideRequest)); r.status = decideRequest.dataset.decision; showToast(`申請を${r.status === "approved" ? "承認" : "却下"}しました。`); }
    const decideWish = event.target.closest("[data-decide-wish]");
    if (decideWish) { const w = state.wishes.find((x) => x.id === Number(decideWish.dataset.decideWish)); w.status = decideWish.dataset.decision; if (w.status === "approved") state.shifts.push({ id: Date.now(), date: w.date, userId: w.userId, user: w.user, unit: "渋谷店", start: w.time.split("–")[0], end: w.time.split("–")[1], published: true }); showToast(`シフト希望を${w.status === "approved" ? "承認" : "却下"}しました。`); }
    if (event.target.closest("[data-publish-shifts]")) { state.shifts.filter((s) => !s.published).forEach((s) => { s.published = true; }); showToast("下書きのシフトを公開し、従業員へ通知しました。"); }
    const selectUser = event.target.closest("[data-select-user]");
    if (selectUser) { state.selectedUserId = selectUser.dataset.selectUser; state.activeTabs.users = "detail"; render(); }
    if (event.target.closest("[data-new-user]")) { state.modal = { type: "confirm", title: "ユーザーを登録", body: "氏名・ユーザーID・パスワードを入力して登録する画面です。", confirmLabel: "登録する", action: "noop" }; render(); }
    if (event.target.closest("[data-new-unit]")) { state.modal = { type: "confirm", title: "所属単位を登録", body: "所属単位名を登録する画面です。", confirmLabel: "登録する", action: "noop" }; render(); }
    const userAction = event.target.closest("[data-user-action]");
    if (userAction) { const actionName = { edit: "基本情報を編集", role: "権限を変更", unit: "所属単位を変更", assignment: "管理先を割り当て", delete: "ユーザーを論理削除" }[userAction.dataset.userAction]; state.modal = { type: "confirm", title: actionName, body: `${users.find((u) => u.id === state.selectedUserId).name}の${actionName}を行う画面です。`, confirmLabel: userAction.dataset.userAction === "delete" ? "削除する" : "保存する", danger: userAction.dataset.userAction === "delete", action: "noop" }; render(); }
    if (event.target.closest("[data-confirm-modal]")) {
      const m = state.modal;
      if (m.action === "withdraw-request") state.requests.find((x) => x.id === m.id).status = "withdrawn";
      if (m.action === "withdraw-wish") state.wishes.find((x) => x.id === m.id).status = "withdrawn";
      state.modal = null;
      showToast(m.action === "noop" ? "モック上の操作を完了しました。" : "取り下げました。");
    }
  });

  window.addEventListener("hashchange", routeFromHash);
  routeFromHash();
})();
