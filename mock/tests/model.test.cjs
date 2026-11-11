"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createModel, overtimeAlert } = require("../model.js");

const make = () => createModel(() => "2026-10-14T10:30:00");
const shift = (date, start, end) => ({ date, start, end });
const punches = (date, start, end) => [{ type: "出勤", at: date + "T" + start }, { type: "退勤", at: date + "T" + end }];

test("UC-201/202/203/216: only a manager's selected drafts are published and notified", () => {
  const m = make(), mgr = m.user("3");
  assert.throws(() => m.saveShift(m.user("1"), "2", shift("2026-10-21", "10:00", "18:00")), /管理先/);
  assert.throws(() => m.saveShift(mgr, "4", shift("2026-10-21", "10:00", "18:00")), /管理先/);
  const october = m.saveShift(mgr, "2", shift("2026-10-21", "10:00", "18:00"));
  const november = m.saveShift(mgr, "2", shift("2026-11-01", "10:00", "18:00"));
  assert.throws(() => m.saveShift(mgr, "2", shift("2026-10-21", "17:00", "22:00")), /重複/);
  m.saveShift(mgr, "2", shift("2026-10-21", "10:00", "19:00"), october.id);
  assert.equal(m.notifications.filter((n) => n.userId === "2").length, 0);
  m.publish(mgr, "p1");
  assert.equal(october.published, true);
  assert.equal(november.published, false);
  const [notice] = m.notifications.filter((n) => n.userId === "2");
  assert.ok(notice.target.ids.includes(october.id));
  assert.equal(m.notifications.filter((n) => n.userId === "1").length, 0);
  m.removeShift(mgr, m.checkDeleteShift(mgr, october.id), true);
  assert.equal(m.shiftById(october.id), undefined);
  assert.equal(m.notifications.at(-1).target, null);
  assert.deepEqual(m.shiftHistory.map((entry) => entry.action), ["変更", "削除"]);
});

test("UC-204/205/206/307/311/315: drafts, updates, rejection, withdrawal and approval", () => {
  const m = make(), mgr = m.user("3"), emp = m.user("1");
  const day = "2026-11-06", row = shift(day, "10:00", "18:00");
  assert.throws(() => m.saveWishes(emp, "p2", [shift(day, "", "")], false), /1日以上/);
  assert.throws(() => m.saveWishes(emp, "p2", [shift(day, "10:00", "10:00")], false), /開始・終了/);
  assert.throws(() => m.saveWishes(emp, "p1", [shift("2026-10-18", "10:00", "18:00")], false), /受付期間外/);
  const before = m.notifications.length;
  m.saveWishes(emp, "p2", [row], true);
  const draft = m.items.find((i) => i.date === day);
  assert.equal(draft.status, "draft");
  assert.equal(m.managedItem(mgr, draft), false);
  assert.equal(m.notifications.length, before);
  m.saveWishes(emp, "p2", [row], false);
  assert.equal(draft.status, "pending");
  m.saveWishes(emp, "p2", [shift(day, "11:00", "18:00")], false);
  assert.equal(m.items.filter((i) => i.date === day).length, 1);
  assert.equal(draft.start, "11:00");
  assert.throws(() => m.decide(mgr, draft.id, false), /却下理由/);
  m.decide(mgr, draft.id, false, "勤務時間帯を調整してください。");
  assert.equal(draft.rejectReason, "勤務時間帯を調整してください。");
  assert.equal(m.notifications.at(-1).userId, emp.key);
  assert.throws(() => m.saveWishes(emp, "p2", [row], false), /承認済・却下/);
  const count = m.notifications.length;
  m.withdraw(emp, "w1");
  assert.equal(m.notifications.length, count);
  assert.throws(() => m.decide(mgr, "w1", true), /未処理/);
  m.decide(mgr, "w2", true);
  assert.equal(m.notifications.at(-1).target.type, "shift");
  assert.equal(m.publishedOn("2", "2026-11-04").length, 1);
});

test("UC-207/208/210/306: enforce scope, update the actual record and retain correction history", () => {
  const m = make(), emp = m.user("1"), mgr = m.user("3"), date = "2026-10-12";
  const after = punches(date, "10:00:00", "18:02:00");
  const info = { date, after, reason: "打刻を訂正する" };
  assert.throws(() => m.submitAttendance(emp, info), /未処理の申請/);
  assert.throws(() => m.submitAttendance(emp, { ...info, date: "2026-10-15" }), /当日以前/);
  assert.throws(() => m.submitAttendance(emp, { ...info, date: "2026-09-30" }), /締切日/);
  assert.equal(m.submitAttendance(emp, info, "a1").id, "a1");
  assert.throws(() => m.decide(m.user("4"), "a1", true), /管理先/);
  m.correct(mgr, "1", date, punches(date, "10:00:00", "17:59:00"), "直接修正");
  assert.equal(m.itemById("a1").status, "pending");
  m.decide(mgr, "a1", true);
  const r = m.record("1", date);
  assert.deepEqual(r.punches, after);
  assert.equal(r.history[0].basis, "勤怠修正申請に基づく");
  assert.equal(r.history[0].before.at(-1).at, date + "T17:59:00");
  assert.equal(r.history[1].basis, "勤怠管理者の直接修正");
  assert.equal(m.dayRows("1", date, date)[0].work, 482);
});

test("UC-209/212/213/309: select a real shift, permit sending a collision, recheck before applying", () => {
  const m = make(), emp = m.user("1"), mgr = m.user("3");
  assert.throws(() => m.submitChange(emp, "s3", shift("2026-10-15", "10:00", "18:00"), "理由"), /自分の翌日以降/);
  assert.throws(() => m.submitChange(emp, "s2", shift("2026-10-15", "10:00", "18:00"), "理由"), /未処理/);
  m.withdraw(emp, "c1");
  const blocked = m.saveShift(mgr, "1", shift("2026-10-16", "08:00", "16:00"));
  m.publish(mgr, "p1");
  assert.equal(m.changePlan(emp, "s2", shift("2026-10-16", "12:00", "20:00"), "理由").conflict.id, blocked.id);
  const item = m.submitChange(emp, "s2", shift("2026-10-16", "12:00", "20:00"), "理由");
  assert.throws(() => m.decide(mgr, item.id, true), /重複/);
  assert.equal(item.status, "pending");
  m.removeShift(mgr, m.checkDeleteShift(mgr, blocked.id), true);
  m.decide(mgr, item.id, true);
  assert.equal(m.shiftById("s2").date, "2026-10-16");
  assert.equal(m.shiftById("s2").published, true);
  assert.equal(m.shiftHistory.at(-1).date, "2026-10-15");
});

test("UC-101〜109/215/301: independent admin roles, validation, and logical deletion", () => {
  const m = make(), admin = m.user("4"), mgr = m.user("3");
  assert.throws(() => m.saveUser(mgr, { name: "例", id: "demo5", password: "password2" }), /マスタ管理者/);
  assert.throws(() => m.saveUser(admin, { name: "例", id: "demo5", password: "password" }), /英字と数字/);
  const u = m.saveUser(admin, { name: "確認用 従業員", id: "demo5", password: "password2" });
  assert.equal(u.unit, null);
  assert.deepEqual(u.roles, []);
  assert.throws(() => m.setRoles(admin, admin.key, []), /自分自身/);
  m.addUnit(admin, "確認用所属");
  assert.throws(() => m.addUnit(admin, "確認用所属"), /重複/);
  const unit = m.units.at(-1).key;
  m.setUnit(admin, u.key, unit);
  m.setRoles(admin, u.key, ["master", "manager"]);
  m.setManaged(admin, u.key, [unit, "hq"]);
  m.savePeriod(u, { unit, from: "2026-10-20", to: "2026-10-31", opens: "2026-10-01T00:00", closes: "2026-10-19T23:59" });
  assert.throws(() => m.savePeriod(u, { unit, from: "2026-10-31", to: "2026-11-05", opens: "2026-10-01T00:00", closes: "2026-10-19T23:59" }), /重複/);
  m.setRoles(admin, u.key, ["master"]);
  assert.deepEqual(u.managed, []);
  assert.throws(() => m.deleteUser(admin, admin.key), /自分自身/);
  m.deleteUser(admin, "1");
  assert.equal(m.authenticate("emp01", "password"), undefined);
  assert.equal(m.shiftById("s2"), undefined);
  assert.ok(m.record("1", "2026-10-12"));
  assert.equal(m.itemById("a1").status, "pending");
  assert.throws(() => m.saveUser(admin, { name: "例", id: "emp01", password: "password2" }), /使用/);
});

test("UC-211/313: gaps count as rest, daily overtime is summed, and warning boundaries are inclusive", () => {
  const m = make(), date = "2026-10-10";
  m.correct(m.user("3"), "1", date, [...punches(date, "09:00:59", "13:00:00"), ...punches(date, "14:00:00", "18:01:01")], "勤務時間を修正");
  const [row] = m.dayRows("1", date, date);
  assert.deepEqual([row.work, row.rest, row.overtime], [481, 60, 1]);
  assert.deepEqual([2159, 2160, 2699, 2700].map(overtimeAlert), ["", "注意", "注意", "超過"]);
});
