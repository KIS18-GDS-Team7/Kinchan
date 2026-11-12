/* Demo domain model. Times are Japan-local wall times on the demo timeline. */
((root) => {
  "use strict";

  const DAY = 86400000;
  const TODAY = "2026-10-14";
  const punchTypes = ["出勤", "休憩開始", "休憩終了", "退勤"];
  const statusLabels = { draft: "下書き", pending: "未処理", approved: "承認済", rejected: "却下", withdrawn: "取り下げ" };
  const kindLabels = { wish: "シフト希望", attendance: "勤怠修正申請", change: "シフト日時変更申請" };
  const roleLabels = { master: "マスタ管理者", manager: "勤怠管理者" };
  const stamp = (date, time) => date + "T" + time;
  const ms = (value) => Date.parse(value + "Z");
  const iso = (value) => new Date(value).toISOString().slice(0, 19);
  const dateAt = (day, offset) => iso(ms(stamp(day, "00:00")) + offset * DAY).slice(0, 10);
  const inRange = (day, from, to) => day >= from && day <= to;
  const monthRange = (month) => {
    const [y, m] = month.split("-").map(Number);
    return [month + "-01", iso(Date.UTC(y, m, 0)).slice(0, 10)];
  };
  const minutes = (value) => Math.floor(ms(value) / 60000);
  const duration = (n) => String(Math.floor(n / 60)).padStart(2, "0") + ":" + String(n % 60).padStart(2, "0");
  const overtimeAlert = (n) => n >= 45 * 60 ? "超過" : n >= 36 * 60 ? "注意" : "";
  const shiftBounds = ({ date, start, end }) => [ms(stamp(date, start)), ms(stamp(end < start ? dateAt(date, 1) : date, end))];
  const shiftEqual = (a, b) => ["date", "start", "end"].every((field) => a[field] === b[field]);
  const shiftText = (s) => s ? s.date + " " + s.start + "–" + s.end : "なし";
  const sameList = (a, b) => a.length === b.length && a.every((p, i) => p.type === b[i].type && p.at === b[i].at);
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const validDate = (date) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const value = ms(stamp(date, "00:00"));
    return Number.isFinite(value) && iso(value).slice(0, 10) === date;
  };
  const validTime = (time) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
  const validStamp = (at) => typeof at === "string" && validDate(at.slice(0, 10))
    && /^T([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(at.slice(10));
  const overlaps = (a, b) => {
    const [as, ae] = shiftBounds(a), [bs, be] = shiftBounds(b);
    return as < be && bs < ae;
  };
  const spanLabel = (period) => period.from + " ～ " + period.to;

  // UC-208 / UC-210 / UC-306: a full replacement is an ordered list of complete work sessions.
  function validatePunches(punches, date) {
    let step = "出勤", previous = "";
    for (const { type, at } of punches) {
      assert(validStamp(at) && (!previous || ms(at) > ms(previous)), "打刻日時を古い順に入力してください。");
      if (step === "出勤") {
        assert(type === "出勤" && at.slice(0, 10) === date, "出勤の打刻は対象日の日時を指定してください。");
      } else if (step === "勤務") {
        assert(type === "休憩開始" || type === "退勤", "出勤後は休憩開始または退勤を指定してください。");
      } else {
        assert(type === "休憩終了", "休憩開始に対応する休憩終了を入力してください。");
      }
      step = type === "退勤" ? "出勤" : type === "休憩開始" ? "休憩終了" : "勤務";
      previous = at;
    }
    assert(step === "出勤", "勤務ごとに退勤を入力してください。");
  }

  // UC-211 / UC-313: use the minute of each punch; gaps count as break, not work.
  function summarize(punches) {
    let work = 0, rest = 0, current = null, lastOut = null, breakStart = null;
    const sessions = [];
    for (const { type, at } of punches) {
      const minute = minutes(at);
      if (type === "出勤") {
        if (lastOut !== null) rest += Math.max(0, minute - lastOut);
        current = { start: at, rest: 0 };
        sessions.push(current);
      } else if (type === "休憩開始" && current) breakStart = minute;
      else if (type === "休憩終了" && current && breakStart !== null) {
        const n = minute - breakStart;
        current.rest += n;
        rest += n;
        breakStart = null;
      } else if (type === "退勤") {
        if (current) {
          current.end = at;
          work += minute - minutes(current.start) - current.rest;
        } else sessions.push({ end: at });
        lastOut = minute;
        current = null;
        breakStart = null;
      }
    }
    return { work, rest, overtime: Math.max(0, work - 480), sessions };
  }

  function createModel(clock) {
    const started = Date.now();
    const now = clock || (() => iso(ms(stamp(TODAY, "10:30:00")) + Date.now() - started));
    let sequence = 100;
    const id = () => String(++sequence);
    const users = [
      { key: "1", id: "emp01", name: "田中 陽菜", unit: "shibuya" },
      { key: "2", id: "emp02", name: "鈴木 大輔", unit: "shibuya" },
      { key: "3", id: "manager01", name: "佐藤 健一", unit: "shibuya", roles: ["manager"], managed: ["shibuya"], status: "working" },
      { key: "4", id: "admin01", name: "山本 恵子", unit: "hq", roles: ["master"] },
    ].map((u) => ({ password: "password", roles: [], managed: [], status: "off", deleted: false, ...u }));
    const units = [{ key: "shibuya", name: "渋谷店" }, { key: "hq", name: "本部" }];
    // UC-110: retain past references even after an assignment is moved or removed.
    const unitUsageHistory = [];
    function rememberUnitUsage(unit, kind) {
      if (unit && !unitUsageHistory.some((h) => h.unit === unit && h.kind === kind)) unitUsageHistory.push({ unit, kind });
    }
    for (const u of users) {
      rememberUnitUsage(u.unit, "所属");
      u.managed.forEach((unit) => rememberUnitUsage(unit, "管理先"));
    }
    const unitName = (key) => units.find((u) => u.key === key)?.name || "未設定";
    const user = (key) => users.find((u) => u.key === key);
    const has = (actor, role) => Boolean(actor && !actor.deleted && actor.roles.includes(role));
    const manages = (actor, unit) => has(actor, "manager") && actor.managed.includes(unit);
    const requireUnit = (actor) => assert(actor && !actor.deleted && actor.unit, "所属が設定されていません。");
    const periods = [
      { id: "p1", unit: "shibuya", from: "2026-10-01", to: "2026-10-31", opens: "2026-09-01T00:00", closes: "2026-09-30T23:59" },
      { id: "p2", unit: "shibuya", from: "2026-11-01", to: "2026-11-30", opens: "2026-10-01T00:00", closes: "2026-10-31T23:59" },
      { id: "p3", unit: "hq", from: "2026-10-01", to: "2026-10-31", opens: "2026-09-01T00:00", closes: "2026-09-30T23:59" },
      { id: "p4", unit: "hq", from: "2026-11-01", to: "2026-11-30", opens: "2026-10-01T00:00", closes: "2026-10-31T23:59" },
    ];
    const shifts = [
      ["s1", "1", "2026-10-14", "10:00", "18:00", true],
      ["s2", "1", "2026-10-15", "10:00", "18:00", true],
      ["s3", "3", "2026-10-14", "09:00", "18:00", true],
      ["s4", "2", "2026-10-16", "12:00", "20:00", false],
      ["s5", "4", "2026-10-14", "09:00", "18:00", true],
      ["s6", "1", "2026-10-12", "10:00", "18:00", true],
      ["s7", "1", "2026-10-13", "10:00", "18:00", true],
      ["s8", "2", "2026-10-11", "09:00", "17:00", true],
    ].map(([id, userId, date, start, end, published]) => ({ id, userId, unit: user(userId).unit, date, start, end, published }));
    const shiftHistory = [];
    const logShift = (actor, s, action) => shiftHistory.push({ ...s, by: actor.key, at: now(), action });
    const items = [
      { id: "w1", kind: "wish", userId: "1", unit: "shibuya", date: "2026-11-03", start: "10:00", end: "18:00", status: "pending", sentAt: "2026-10-13T12:00:00" },
      { id: "w2", kind: "wish", userId: "2", unit: "shibuya", date: "2026-11-04", start: "12:00", end: "20:00", status: "pending", sentAt: "2026-10-13T12:10:00" },
      { id: "w3", kind: "wish", userId: "1", unit: "shibuya", date: "2026-11-05", start: "10:00", end: "18:00", status: "draft" },
      { id: "c1", kind: "change", userId: "1", unit: "shibuya", date: "2026-10-15", shiftId: "s2", before: { ...shifts[1] },
        after: { date: "2026-10-15", start: "12:00", end: "20:00" }, reason: "開始時刻の変更", status: "pending", sentAt: "2026-10-13T13:00:00" },
    ];
    const punchesAt = (date, pairs) => pairs.map(([type, time]) => ({ type, at: stamp(date, time) }));
    const workDay = (date, start, end) => punchesAt(date, [["出勤", start], ["休憩開始", "12:00:00"], ["休憩終了", "13:00:00"], ["退勤", end]]);
    const records = [
      { userId: "1", date: "2026-10-12", punches: workDay("2026-10-12", "10:01:00", "17:42:00") },
      { userId: "1", date: "2026-10-13", punches: workDay("2026-10-13", "09:58:00", "18:03:00") },
      { userId: "2", date: "2026-10-11", punches: workDay("2026-10-11", "09:18:00", "17:00:00") },
      { userId: "3", date: TODAY, punches: punchesAt(TODAY, [["出勤", "09:00:00"]]) },
    ].map((r) => ({ ...r, unit: user(r.userId).unit, history: [] }));
    // A sample that lets the manager verify the defined 36-hour warning in the UI.
    for (let day = 1; day <= 9; day++) {
      const date = "2026-10-0" + day;
      shifts.push({ id: "sample" + day, userId: "2", unit: "shibuya", date, start: "09:00", end: "18:00", published: true });
      records.push({ userId: "2", unit: "shibuya", date, punches: workDay(date, "09:00:00", "22:00:00"), history: [] });
    }
    items.push(
      { id: "a1", kind: "attendance", userId: "1", unit: "shibuya", date: "2026-10-12", after: workDay("2026-10-12", "10:01:00", "18:02:00"), reason: "退勤時刻の修正", status: "pending", sentAt: "2026-10-13T08:00:00" },
      { id: "a2", kind: "attendance", userId: "2", unit: "shibuya", date: "2026-10-11", after: workDay("2026-10-11", "09:00:00", "17:00:00"), reason: "出勤時刻の修正", status: "pending", sentAt: "2026-10-13T08:10:00" },
    );
    const notifications = [];
    function notify(userId, message, target, at = now()) {
      if (!user(userId)?.deleted) notifications.push({ id: id(), userId, message, target, at });
    }
    function notifyManagers(actor, item) {
      for (const u of users.filter((u) => manages(u, actor.unit))) {
        notify(u.key, actor.name + "さんが" + kindLabels[item.kind] + "を送信しました。", { type: "item", id: item.id, manager: true }, item.sentAt);
      }
    }
    for (const item of items.filter((i) => i.status === "pending")) notifyManagers(user(item.userId), item);
    const record = (key, date) => records.find((r) => r.userId === key && r.date === date);
    function recordFor(key, date) {
      let r = record(key, date);
      if (!r) {
        r = { userId: key, unit: user(key)?.unit, date, punches: [], history: [] };
        records.push(r);
      }
      return r;
    }
    const periodAt = (unit, date) => periods.find((p) => p.unit === unit && inRange(date, p.from, p.to));
    const receptionOpen = (p) => p && ms(now()) >= ms(p.opens) && ms(now()) <= ms(p.closes);
    const shiftById = (key) => shifts.find((s) => s.id === key);
    const itemById = (key) => items.find((i) => i.id === key);
    const managedItem = (actor, i) => i && i.status !== "draft" && manages(actor, user(i.userId)?.unit);
    const changedUnit = (i) => i.unit !== user(i.userId)?.unit;
    const today = () => now().slice(0, 10);
    const publishedOn = (key, date) => shifts.filter((s) => s.userId === key && s.date === date && s.published && s.unit === user(key)?.unit);
    function checkShiftInput(actorUnit, info) {
      assert(validDate(info.date) && validTime(info.start) && validTime(info.end) && info.start !== info.end, "勤務日と異なる開始・終了時刻を入力してください。");
      assert(info.date >= today(), "勤務日は当日以降を指定してください。");
      assert(periodAt(actorUnit, info.date), "勤務日が登録された対象期間に含まれていません。");
    }
    const shiftConflicts = (key, info, skip, publishedOnly = false) => shifts.filter((s) =>
      s.id !== skip && s.userId === key && (!publishedOnly || s.published) && overlaps(s, info));
    const shiftConflict = (...args) => shiftConflicts(...args)[0];
    function requireNoShiftConflicts(key, info, skip, message) {
      const conflicts = shiftConflicts(key, info, skip);
      if (!conflicts.length) return;
      const error = new Error(message);
      error.conflicts = conflicts.map((s) => ({ ...s }));
      throw error;
    }
    function shiftPlan(actor, key, info, existingId) {
      const u = user(key);
      assert(u && !u.deleted && manages(actor, u.unit), "管理先の従業員を選択してください。");
      const existing = existingId ? shiftById(existingId) : null;
      if (existingId) {
        assert(existing && existing.userId === key && existing.unit === u.unit, "指定されたシフトを変更できません。");
        assert(shiftBounds(existing)[1] >= ms(now()), "勤務済みのシフトは変更できません。");
        assert(!items.some((i) => i.kind === "change" && i.shiftId === existing.id && i.status === "pending"), "未処理のシフト日時変更申請がある場合の直接変更はデモ対象外です。");
        assert(!shiftEqual(existing, info), "変更前と同じ内容です。");
      }
      checkShiftInput(u.unit, info);
      requireNoShiftConflicts(key, info, existingId, "登録済みのシフトと時刻が重複しています。");
      return existing;
    }
    function saveShift(actor, key, info, existingId) {
      const existing = shiftPlan(actor, key, info, existingId);
      if (existing) {
        logShift(actor, existing, "変更");
        Object.assign(existing, info);
        if (existing.published) notify(key, "公開済みのシフトが変更されました。", { type: "shift", id: existing.id });
        return existing;
      }
      const s = { id: id(), userId: key, unit: user(key).unit, ...info, published: false };
      shifts.push(s);
      return s;
    }
    function checkDeleteShift(actor, shiftId) {
      const s = shiftById(shiftId);
      assert(s && !user(s.userId).deleted && s.unit === user(s.userId).unit && manages(actor, s.unit), "指定されたシフトを削除できません。");
      assert(shiftBounds(s)[0] > ms(now()), "勤務中・勤務済みのシフトは削除できません。");
      return s;
    }
    function removeShift(actor, s, tell) {
      logShift(actor, s, "削除");
      shifts.splice(shifts.indexOf(s), 1);
      // UC-317 does not define a destination for a deleted shift.
      if (tell && s.published) notify(s.userId, "公開済みのシフトが削除されました。", null);
    }
    function publishPlan(actor, periodId) {
      const p = periods.find((p) => p.id === periodId);
      assert(p && manages(actor, p.unit), "管理先と対象期間を指定してください。");
      return shifts.filter((s) => !s.published && s.unit === p.unit && user(s.userId)?.unit === p.unit
        && !user(s.userId).deleted && inRange(s.date, p.from, p.to));
    }
    function publish(actor, periodId) {
      const rows = publishPlan(actor, periodId);
      assert(rows.length, "この対象期間に下書きのシフトがありません。");
      for (const s of rows) s.published = true;
      for (const key of new Set(rows.map((s) => s.userId))) {
        notify(key, "対象期間のシフトが公開されました。", { type: "published", ids: rows.filter((s) => s.userId === key).map((s) => s.id) });
      }
    }
    function checkPeriod(actor, info) {
      assert(manages(actor, info.unit), "管理先を指定してください。");
      assert(validDate(info.from) && validDate(info.to) && info.from < info.to, "対象期間の終了日は開始日より後にしてください。");
      assert(validStamp(info.opens) && validStamp(info.closes) && ms(info.opens) < ms(info.closes), "受付期間の終了日時は開始日時より後にしてください。");
      assert(!periods.some((p) => p.unit === info.unit && p.from <= info.to && info.from <= p.to), "登録済みの対象期間と重複しています。");
    }
    function savePeriod(actor, info) {
      checkPeriod(actor, info);
      periods.push({ id: id(), ...info });
    }

    function wishPlan(actor, periodId, rows, draft) {
      requireUnit(actor);
      const p = periods.find((p) => p.id === periodId && p.unit === actor.unit);
      assert(p && (receptionOpen(p) || draft), "シフト希望の受付期間外です。");
      if (draft) assert(receptionOpen(p), "受付期間外の下書き保存はデモ対象外です。");
      const seen = new Set();
      const changes = [];
      for (const row of rows) {
        assert(validDate(row.date) && inRange(row.date, p.from, p.to) && !seen.has(row.date), "対象期間内の希望を1日1件入力してください。");
        seen.add(row.date);
        const existing = items.find((i) => i.kind === "wish" && i.userId === actor.key && i.date === row.date && i.status !== "withdrawn");
        if (!row.start && !row.end) {
          assert(!existing || existing.status !== "pending", "未処理の希望は空欄にできません。取り下げを選んでください。");
          if (existing?.status === "draft") throw new Error("下書きの希望を空欄にした場合の扱いはデモ対象外です。");
          continue;
        }
        assert(validTime(row.start) && validTime(row.end) && row.start !== row.end, "希望日ごとに異なる開始・終了時刻を入力してください。");
        assert(!existing || existing.status === "draft" || existing.status === "pending", "承認済・却下の希望は変更できません。");
        assert(!existing || !changedUnit(existing), "所属変更前の希望の扱いはデモ対象外です。");
        if (existing?.status === "pending" && existing.start === row.start && existing.end === row.end) continue;
        if (draft) assert(existing?.status !== "pending", "未処理の希望を下書きに変更する操作はデモ対象外です。");
        changes.push([row, existing]);
      }
      assert(changes.length, "希望を出す日を1日以上入力してください。");
      return changes;
    }
    function saveWishes(actor, periodId, rows, draft) {
      for (const [row, existing] of wishPlan(actor, periodId, rows, draft)) {
        const item = existing || { id: id(), kind: "wish", userId: actor.key, unit: actor.unit };
        Object.assign(item, row, { status: draft ? "draft" : "pending", sentAt: draft ? null : now() });
        if (!existing) items.push(item);
        if (!draft) notifyManagers(actor, item);
      }
    }

    function attendancePlan(actor, info, existingId) {
      requireUnit(actor);
      const { date, after, reason } = info;
      assert(validDate(date) && date <= today(), "対象日は当日以前を指定してください。");
      const previousMonth = dateAt(today().slice(0, 7) + "-01", -1).slice(0, 7);
      assert(date.slice(0, 7) >= previousMonth, "修正申請の期限を過ぎています。");
      assert(date.slice(0, 7) !== previousMonth, "前月分の締切日は未確定のため、このモックでは送信を扱いません。");
      assert(date !== today() || actor.status === "off", "勤務中・休憩中の当日分の扱いはデモ対象外です。");
      assert(reason.trim(), "申請理由を入力してください。");
      assert(after.length, "修正後の打刻を入力してください。");
      validatePunches(after, date);
      const existing = items.find((i) => i.kind === "attendance" && i.userId === actor.key && i.date === date && i.status === "pending");
      assert(existingId ? existing?.id === existingId : !existing, existingId ? "この申請は変更できません。" : "未処理の申請があります。申請一覧から変更してください。");
      return existing;
    }
    function submitAttendance(actor, info, existingId) {
      const existing = attendancePlan(actor, info, existingId);
      const i = existing || { id: id(), kind: "attendance", userId: actor.key, unit: actor.unit, status: "pending" };
      Object.assign(i, info, { sentAt: now() });
      if (!existing) items.push(i);
      notifyManagers(actor, i);
      return i;
    }
    function changePlan(actor, shiftId, after, reason) {
      requireUnit(actor);
      const s = shiftById(shiftId);
      assert(s && s.userId === actor.key && s.published && s.unit === actor.unit && s.date > today(), "自分の翌日以降の公開済みシフトを指定してください。");
      assert(!items.some((i) => i.kind === "change" && i.shiftId === shiftId && i.status === "pending"), "このシフトには未処理の申請があります。");
      assert(reason.trim(), "申請理由を入力してください。");
      checkShiftInput(actor.unit, after);
      assert(!shiftEqual(s, after), "変更前と同じ日時です。");
      const conflicts = shiftConflicts(actor.key, after, s.id, true);
      return { shift: s, conflict: conflicts[0], conflicts };
    }
    function submitChange(actor, shiftId, after, reason) {
      const { shift: s } = changePlan(actor, shiftId, after, reason);
      const i = { id: id(), kind: "change", userId: actor.key, unit: actor.unit, status: "pending",
        shiftId, date: s.date, before: { ...s }, after, reason, sentAt: now() };
      items.push(i);
      notifyManagers(actor, i);
      return i;
    }
    function withdraw(actor, itemId) {
      const i = itemById(itemId);
      assert(i && i.userId === actor.key && i.status === "pending", "未処理の自分の申請・希望だけを取り下げられます。");
      i.status = "withdrawn";
    }
    function correctionPlan(actor, key, date, after, reason) {
      const u = user(key);
      assert(u && !u.deleted && manages(actor, u.unit), "管理先の従業員を選択してください。");
      assert(validDate(date) && date <= today(), "将来日の勤怠修正はデモ対象外です。");
      assert(date !== today() || u.status === "off", "勤務中・休憩中の当日分の扱いはデモ対象外です。");
      assert(reason.trim(), "修正理由を入力してください。");
      const previous = record(key, date)?.punches || [];
      validatePunches(after, date);
      assert(!sameList(previous, after), "修正前と同じ内容です。");
    }
    function replaceRecord(actor, key, date, after, reason, basis) {
      const r = recordFor(key, date);
      r.history.unshift({ unit: r.unit, before: r.punches.map((p) => ({ ...p })), by: actor.key, at: now(), reason, basis });
      r.punches = after.map((p) => ({ ...p }));
      return r;
    }
    function correct(actor, key, date, after, reason) {
      correctionPlan(actor, key, date, after, reason);
      replaceRecord(actor, key, date, after, reason, "勤怠管理者の直接修正");
      notify(key, "勤怠記録が修正されました。", { type: "record", key, date });
    }
    function decide(actor, itemId, approve, reason = "") {
      const i = itemById(itemId);
      assert(managedItem(actor, i) && i.status === "pending", "管理先の未処理の申請・希望だけを処理できます。");
      const u = user(i.userId);
      let target = { type: "item", id: i.id };
      if (!approve) {
        assert(reason.trim(), "却下理由を入力してください。");
        i.rejectReason = reason.trim();
      } else if (i.kind === "wish") {
        assert(!u.deleted && !changedUnit(i), "このシフト希望は承認できません。");
        checkShiftInput(u.unit, i);
        requireNoShiftConflicts(u.key, i, undefined, "登録済みのシフトと重複するため承認できません。");
        const s = { id: id(), userId: u.key, unit: u.unit, date: i.date, start: i.start, end: i.end, published: true };
        shifts.push(s);
        target = { type: "shift", id: s.id };
      } else if (i.kind === "attendance") {
        assert(i.date !== today() || u.status === "off", "勤務中・休憩中の当日分の扱いはデモ対象外です。");
        validatePunches(i.after, i.date);
        replaceRecord(actor, u.key, i.date, i.after, i.reason, "勤怠修正申請に基づく");
      } else {
        const s = shiftById(i.shiftId);
        assert(s && s.unit === u.unit && !changedUnit(i) && shiftBounds(s)[1] >= ms(now()), "変更前のシフトが勤務済み、削除済み、または現在の所属と異なります。");
        checkShiftInput(u.unit, i.after);
        requireNoShiftConflicts(u.key, i.after, s.id, "登録済みのシフトと重複するため承認できません。");
        logShift(actor, s, "変更");
        Object.assign(s, i.after);
      }
      i.status = approve ? "approved" : "rejected";
      notify(u.key, kindLabels[i.kind] + (approve ? "が承認されました。" : "が却下されました。理由：" + i.rejectReason), target);
    }

    function checkUserInfo(actor, info, key) {
      assert(has(actor, "master"), "マスタ管理者権限が必要です。");
      assert(!key || (user(key) && !user(key).deleted), "削除済みのユーザーは編集できません。");
      assert([...info.name.trim()].length >= 1 && [...info.name.trim()].length <= 30, "氏名は1〜30文字で入力してください。");
      assert(/^[A-Za-z0-9._-]{4,20}$/.test(info.id), "ユーザーIDは半角英数字と . _ - の4〜20文字で入力してください。");
      assert(!users.some((u) => u.id === info.id && u.key !== key), "そのユーザーIDは使用されています。");
      assert((key && !info.password) || (info.password.length >= 8 && /[A-Za-z]/.test(info.password) && /[0-9]/.test(info.password)), "パスワードは英字と数字を含む8文字以上で入力してください。");
    }
    function saveUser(actor, info, key) {
      checkUserInfo(actor, info, key);
      if (key) {
        const u = user(key);
        Object.assign(u, { id: info.id, name: info.name.trim(), password: info.password || u.password });
        return u;
      }
      const u = { ...info, name: info.name.trim(), key: id(), unit: null, roles: [], managed: [], status: "off", deleted: false };
      users.push(u);
      return u;
    }
    function adminTarget(actor, key, notSelf = false) {
      assert(has(actor, "master"), "マスタ管理者権限が必要です。");
      const u = user(key);
      assert(u && !u.deleted, "削除済みのユーザーは操作できません。");
      assert(!notSelf || u.key !== actor.key, "自分自身にはこの操作を実行できません。");
      return u;
    }
    function deleteUser(actor, key) {
      const u = adminTarget(actor, key, true);
      for (const s of shifts.filter((s) => s.userId === key && s.date > today())) removeShift(actor, s, false);
      u.managed.forEach((unit) => rememberUnitUsage(unit, "管理先"));
      Object.assign(u, { deleted: true, managed: [] });
    }
    function setRoles(actor, key, roles) {
      const u = adminTarget(actor, key, true);
      assert(roles.every((r) => r in roleLabels), "指定された権限を変更できません。");
      u.managed.forEach((unit) => rememberUnitUsage(unit, "管理先"));
      u.roles = roles;
      if (!roles.includes("manager")) u.managed = [];
    }
    function setUnit(actor, key, unit) {
      const u = adminTarget(actor, key);
      assert(units.some((p) => p.key === unit), "登録済みの所属単位を指定してください。");
      rememberUnitUsage(u.unit, "所属");
      rememberUnitUsage(unit, "所属");
      u.unit = unit;
    }
    function setManaged(actor, key, managed) {
      const u = adminTarget(actor, key);
      assert(has(u, "manager"), "勤怠管理者権限を持つユーザーを指定してください。");
      assert(managed.length && managed.every((k) => units.some((p) => p.key === k)), "管理先を1つ以上指定してください。");
      [...u.managed, ...managed].forEach((unit) => rememberUnitUsage(unit, "管理先"));
      u.managed = [...new Set(managed)];
    }
    function checkUnit(actor, name) {
      assert(has(actor, "master"), "マスタ管理者権限が必要です。");
      assert(name.trim() && !units.some((u) => u.name === name.trim()), "空欄または重複した所属単位名は登録できません。");
    }
    function addUnit(actor, name) {
      checkUnit(actor, name);
      units.push({ key: id(), name: name.trim() });
    }

    function unitDeletionPlan(actor, key) {
      assert(has(actor, "master"), "マスタ管理者権限が必要です。");
      const unit = units.find((u) => u.key === key);
      assert(unit, "対象の所属単位は存在しません。");
      const referencesUnit = (value) => value && typeof value === "object" &&
        (value.unit === key || Object.values(value).some(referencesUnit));
      const reasons = [
        [users.some((u) => u.unit === key), "ユーザーの所属（削除済みユーザーを含む）"],
        [users.some((u) => u.managed.includes(key)), "勤怠管理者の管理先（削除済みユーザーを含む）"],
        [periods.some(referencesUnit), "対象期間・受付期間（過去の期間を含む）"],
        [shifts.some(referencesUnit), "シフト（下書き・公開済み・過去のシフトを含む）"],
        [items.some(referencesUnit), "シフト希望・申請（すべての処理状態と変更前後の内容を含む）"],
        [records.some(referencesUnit), "勤怠記録・勤怠修正の履歴"],
        [shiftHistory.some(referencesUnit), "変更・削除されたシフトの履歴"],
        [unitUsageHistory.some(referencesUnit), "過去の所属・管理先の参照履歴"],
      ].filter(([used]) => used).map(([, label]) => label);
      for (const [rows, label] of [[periods, "対象期間・受付期間"], [shifts, "シフト"], [items, "シフト希望・申請"],
        [records, "勤怠記録"], [shiftHistory, "シフトの履歴"], [unitUsageHistory, "所属・管理先の参照履歴"]]) {
        if (rows.some((row) => !row.unit)) reasons.push(label + "の所属単位が不明なため、未使用と判定できません");
      }
      return { unit, reasons };
    }
    function deleteUnit(actor, key) {
      // Re-evaluate on execution, not just when the confirmation is displayed.
      const { unit, reasons } = unitDeletionPlan(actor, key);
      assert(!reasons.length, "この所属は削除できません：" + reasons.join("、"));
      units.splice(units.indexOf(unit), 1);
    }

    function punch(actor, type) {
      requireUnit(actor);
      const allowed = { off: ["出勤"], working: ["休憩開始", "退勤"], break: ["休憩終了"] };
      assert(allowed[actor.status].includes(type), "現在の勤務ステータスではこの打刻はできません。");
      assert(type !== "出勤" || publishedOn(actor.key, today()).length, "当日の公開済みシフトがないため、出勤を打刻できません。");
      const at = now();
      const r = type === "出勤" ? recordFor(actor.key, today()) : records.filter((r) => r.userId === actor.key && r.punches.length
        && r.punches[r.punches.length - 1].type !== "退勤").sort((a, b) => b.date.localeCompare(a.date))[0];
      assert(r, "現在の勤務の出勤打刻が見つかりません。");
      r.punches.push({ type, at });
      actor.status = type === "退勤" ? "off" : type === "休憩開始" ? "break" : "working";
      return at;
    }
    function dayRows(key, from, to) {
      const selectedRecords = records.filter((r) => r.userId === key && inRange(r.date, from, to));
      const days = new Set([...selectedRecords.map((r) => r.date), ...shifts.filter((s) =>
        s.userId === key && s.published && s.unit === user(key)?.unit && inRange(s.date, from, to)).map((s) => s.date)]);
      return [...days].sort().map((date) => {
        const planned = publishedOn(key, date);
        const punches = record(key, date)?.punches || [];
        const totals = summarize(punches);
        let late = 0, early = 0, absent = 0;
        for (const s of planned) {
          const [start, end] = shiftBounds(s);
          const sessions = totals.sessions.filter((m) => (m.start ? ms(m.start) < end : true)
            && (m.end ? ms(m.end) > start : true));
          if (!sessions.length) { if (end < ms(now())) absent++; continue; }
          const first = sessions.find((m) => m.start)?.start;
          const last = sessions[sessions.length - 1]?.end;
          if (first && ms(first) > start) late++;
          if (last && ms(last) < end) early++;
        }
        return { date, planned, punches, ...totals, late, early, absent };
      });
    }
    function attendanceComparison(i) {
      const planned = publishedOn(i.userId, i.date).sort((a, b) => shiftBounds(a)[0] - shiftBounds(b)[0]);
      const sessions = summarize(i.after).sessions;
      if (!planned.length) return sessions.length ? ["矛盾：公開済みのシフトがない日に勤務があります。"] : ["矛盾なし"];
      const result = [];
      // Show every comparison explicitly; do not infer a shift-to-session assignment.
      for (const s of planned) {
        const [start, end] = shiftBounds(s);
        for (const session of sessions) {
          if (!session.start || !session.end) continue;
          result.push("シフト " + shiftText(s) + " ／ 修正後の勤務 " + session.start.replace("T", " ") + " ～ " + session.end.replace("T", " ")
            + "：開始との差 " + (minutes(session.start) - start / 60000) + "分、終了との差 " + (minutes(session.end) - end / 60000) + "分");
        }
      }
      return ["矛盾なし", ...result];
    }
    const authenticate = (login, password) => users.find((u) => !u.deleted && u.id === login && u.password === password);
    return { now, today, users, units, periods, shifts, records, items, notifications, shiftHistory, unitUsageHistory,
      unitName, user, has, manages, requireUnit, record, periodAt, receptionOpen, shiftById, itemById, managedItem,
      publishedOn, shiftPlan, saveShift, checkDeleteShift, removeShift, publishPlan, publish, checkPeriod, savePeriod,
      wishPlan, saveWishes, attendancePlan, submitAttendance, changePlan, submitChange, withdraw, correctionPlan, correct,
      decide, checkUserInfo, saveUser, adminTarget, deleteUser, setRoles, setUnit, setManaged, checkUnit, addUnit, unitDeletionPlan, deleteUnit,
      punch, dayRows, attendanceComparison, authenticate, shiftConflict, shiftConflicts };
  }

  const api = { createModel, punchTypes, statusLabels, kindLabels, roleLabels, dateAt, inRange, monthRange, duration, overtimeAlert, shiftText, spanLabel, validDate };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.KinchanModel = api;
})(globalThis);
