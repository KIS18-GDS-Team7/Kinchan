/* Screen organization follows mock/generic-kintai; authorization remains in model.js. */
((root) => {
  "use strict";
  const screens = {
    "/emp/home": { view: "employee", title: "ホーム", section: "home", page: "employeeHome" },
    "/emp/attendance": { view: "employee", title: "勤怠記録", section: "attendance", page: "ownRecords" },
    "/emp/shifts": { view: "employee", title: "シフト", section: "shifts", page: "publishedShifts" },
    "/emp/requests": { view: "employee", title: "申請", section: "requests", page: "requestHub" },
    "/emp/menu": { view: "employee", title: "メニュー", section: "menu", page: "employeeMenu" },
    "/emp/corrections": { view: "employee", title: "勤怠修正申請一覧", section: "requests", page: "ownAttendanceRequests" },
    "/emp/correction": { view: "employee", title: "勤怠修正申請", section: "requests", page: "attendanceEntry" },
    "/emp/shift-change": { view: "employee", title: "シフト日時変更申請一覧", section: "requests", page: "ownChangeRequests" },
    "/emp/hopes": { view: "employee", title: "シフト希望一覧", section: "requests", page: "ownWishes" },
    "/emp/hope": { view: "employee", title: "シフト希望提出", section: "requests", page: "wishEntry" },
    "/emp/notifications": { view: "employee", title: "通知", section: "home", page: "notifications" },
    "/mgr/home": { view: "manager", title: "ホーム", section: "home", page: "managerHome" },
    "/mgr/shifts": { view: "manager", title: "シフト管理", section: "shifts", page: "teamShifts" },
    "/mgr/hopes": { view: "manager", title: "シフト希望", section: "hopes", page: "incomingWishes" },
    "/mgr/corrections": { view: "manager", title: "勤怠修正申請", section: "corrections", page: "incomingAttendance" },
    "/mgr/shift-changes": { view: "manager", title: "シフト日時変更申請", section: "changes", page: "incomingChanges" },
    "/mgr/work": { view: "manager", title: "勤務実態", section: "work", page: "teamRecords" },
    "/mgr/attendance": { view: "manager", title: "勤怠修正", section: "attendance", page: "correctionEntry" },
    "/mgr/notifications": { view: "manager", title: "通知", section: "home", page: "notifications" },
    "/adm/home": { view: "master", title: "ホーム", section: "home", page: "adminHome" },
    "/adm/users": { view: "master", title: "ユーザー検索", section: "users", page: "users" },
    "/adm/users-new": { view: "master", title: "ユーザー登録", section: "new", page: "userEntry" },
    "/adm/units-new": { view: "master", title: "所属追加", section: "unitNew", page: "unitEntry" },
    "/adm/user": { view: "master", title: "ユーザー詳細", section: "users", page: "userDetail" },
    "/adm/notifications": { view: "master", title: "通知", section: "home", page: "notifications" },
  };
  const menus = {
    employee: [
      ["/emp/home", "ホーム", "⌂"], ["/emp/attendance", "勤怠", "◫"],
      ["/emp/shifts", "シフト", "▦"], ["/emp/requests", "申請", "✓"], ["/emp/menu", "メニュー", "☰"],
    ],
    manager: [
      ["/mgr/home", "ホーム", "⌂"], ["/mgr/shifts", "シフト管理", "▦"],
      ["/mgr/hopes", "シフト希望", "▦"], ["/mgr/corrections", "勤怠修正申請", "✓"],
      ["/mgr/shift-changes", "シフト日時変更申請", "✓"], ["/mgr/work", "勤務実態", "◫"],
      ["/mgr/attendance", "勤怠修正", "◫"],
    ],
    master: [["/adm/home", "ホーム", "⌂"], ["/adm/users", "ユーザー検索", "♙"], ["/adm/users-new", "ユーザー登録", "＋"], ["/adm/units-new", "所属追加", "＋"]],
  };
  const labels = { employee: "従業員", manager: "勤怠管理者", master: "マスタ管理者" };
  const homes = { employee: "/emp/home", manager: "/mgr/home", master: "/adm/home" };
  const allowedViews = (user) => user && !user.deleted ? ["employee", "manager", "master"].filter((v) =>
    v === "employee" || user.roles.includes(v)) : [];
  // All users are employees. Login always starts with their own punch screen.
  const loginDestination = () => homes.employee;
  function resolve(path, user, view) {
    if (!user || user.deleted) return { path: "/login", screen: null };
    const allowed = allowedViews(user);
    const selected = allowed.includes(view) ? view : allowed[0];
    const aliases = { "/": homes[selected], "/shifts": "/emp/shifts", "/requests": "/emp/requests",
      "/records": "/emp/attendance", "/users": "/adm/users" };
    const [pathname, query] = path.split("?");
    const actual = aliases[pathname] || pathname;
    const screen = screens[actual];
    const destination = screen && allowed.includes(screen.view) ? actual : homes[selected];
    return { path: destination + (destination === actual && query ? "?" + query : ""), screen: screens[destination] };
  }
  const api = { screens, menus, labels, homes, allowedViews, loginDestination, resolve };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.KinchanNavigation = api;
})(globalThis);
