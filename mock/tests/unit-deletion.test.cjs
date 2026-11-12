"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createModel } = require("../model.js");
const make = () => createModel(() => "2026-10-14T10:30:00");
const add = (m) => { m.addUnit(m.user("4"), "未使用確認用"); return m.units.at(-1); };
const related = (m) => JSON.stringify([m.users, m.periods, m.shifts, m.items, m.records, m.notifications, m.shiftHistory, m.unitUsageHistory]);
const state = (m) => JSON.stringify([m.units, related(m)]);

test("UC-110: removing an unused unit changes only that unit and excludes it from assignment", () => {
  const m = make(), admin = m.user("4"), target = add(m);
  const originalUnits = m.units.filter((u) => u !== target);
  const before = related(m);
  assert.deepEqual(m.unitDeletionPlan(admin, target.key).reasons, []);
  m.deleteUnit(admin, target.key);
  assert.deepEqual(m.units, originalUnits);
  assert.equal(related(m), before);
  assert.throws(() => m.setUnit(admin, "1", target.key), /登録済み/);
  assert.throws(() => m.setManaged(admin, "3", [target.key]), /管理先/);
  assert.throws(() => m.deleteUnit(admin, target.key), /存在しません/);
});

test("UC-110: missing, employee, manager and deleted administrator actors cannot inspect or delete", () => {
  const m = make(), target = add(m), before = state(m);
  for (const actor of [null, m.user("1"), m.user("3"), { ...m.user("4"), deleted: true }]) {
    assert.throws(() => m.unitDeletionPlan(actor, target.key), /マスタ管理者/);
    assert.throws(() => m.deleteUnit(actor, target.key), /マスタ管理者/);
    assert.equal(state(m), before);
  }
  assert.throws(() => m.deleteUnit(m.user("4"), "missing"), /存在しません/);
  assert.equal(state(m), before);
});

test("UC-110: every live or historic reference blocks deletion without mutating data", () => {
  const cases = [
    ["削除済みの所属", (m, key) => m.users.push({ key: "deleted", unit: key, managed: [], roles: [], deleted: true }), /ユーザーの所属/],
    ["削除済みの管理先", (m, key) => m.users.push({ key: "deleted", unit: null, managed: [key], roles: [], deleted: true }), /管理先/],
    ["過去の対象期間", (m, key) => m.periods.push({ unit: key, from: "2000-01-01", to: "2000-01-31" }), /対象期間/],
    ["下書きシフト", (m, key) => m.shifts.push({ unit: key, published: false, date: "2000-01-01" }), /シフト/],
    ["公開済みシフト", (m, key) => m.shifts.push({ unit: key, published: true, date: "2000-01-01" }), /シフト/],
    ...["draft", "pending", "approved", "rejected", "withdrawn"].map((status) =>
      [status + "の希望・申請", (m, key) => m.items.push({ unit: key, status, date: "2000-01-01" }), /希望・申請/]),
    ["申請の変更前", (m, key) => m.items.push({ unit: "hq", before: { unit: key }, status: "approved" }), /変更前後/],
    ["申請の変更後", (m, key) => m.items.push({ unit: "hq", after: { unit: key }, status: "rejected" }), /変更前後/],
    ["勤怠記録", (m, key) => m.records.push({ userId: "1", unit: key, punches: [], history: [] }), /勤怠記録/],
    ["勤怠履歴", (m, key) => m.records.push({ userId: "1", unit: "hq", punches: [], history: [{ before: { unit: key } }] }), /履歴/],
    ["削除済みシフトの履歴", (m, key) => m.shiftHistory.push({ unit: key, action: "削除" }), /シフトの履歴/],
    ["過去の所属", (m, key) => m.unitUsageHistory.push({ unit: key, kind: "所属" }), /参照履歴/],
  ];
  for (const [label, seed, expected] of cases) {
    const m = make(), target = add(m);
    seed(m, target.key);
    const before = state(m);
    assert.match(m.unitDeletionPlan(m.user("4"), target.key).reasons.join("、"), expected, label);
    assert.throws(() => m.deleteUnit(m.user("4"), target.key), /削除できません/, label);
    assert.equal(state(m), before, label);
  }
});

test("UC-110: moving an employee away retains the former unit reference", () => {
  const m = make(), admin = m.user("4"), target = add(m);
  m.setUnit(admin, "1", target.key);
  m.setUnit(admin, "1", "hq");
  assert.equal(m.users.some((u) => u.unit === target.key), false);
  assert.match(m.unitDeletionPlan(admin, target.key).reasons.join("、"), /過去の所属・管理先/);
  assert.throws(() => m.deleteUnit(admin, target.key), /参照履歴/);
});

test("UC-110: replacing managed units, removing manager privilege and deleting a user retain references", () => {
  for (const change of [
    (m, admin, user) => m.setManaged(admin, user.key, ["hq"]),
    (m, admin, user) => m.setRoles(admin, user.key, []),
    (m, admin, user) => m.deleteUser(admin, user.key),
  ]) {
    const m = make(), admin = m.user("4"), target = add(m);
    const user = m.saveUser(admin, { name: "管理先確認", id: "test-manager", password: "password2" });
    m.setRoles(admin, user.key, ["manager"]);
    m.setManaged(admin, user.key, [target.key]);
    change(m, admin, user);
    assert.equal(user.managed.includes(target.key), false);
    assert.throws(() => m.deleteUnit(admin, target.key), /参照履歴/);
  }
});

test("UC-110: execution checks again if an unused unit becomes assigned after confirmation", () => {
  const m = make(), admin = m.user("4"), target = add(m);
  assert.deepEqual(m.unitDeletionPlan(admin, target.key).reasons, []);
  m.setUnit(admin, "1", target.key);
  const before = state(m);
  assert.throws(() => m.deleteUnit(admin, target.key), /ユーザーの所属/);
  assert.equal(state(m), before);
});

test("UC-110: attendance retains its original unit after an employee moves", () => {
  const m = make();
  assert.equal(m.record("1", "2026-10-12").unit, "shibuya");
  m.setUnit(m.user("4"), "1", "hq");
  assert.equal(m.record("1", "2026-10-12").unit, "shibuya");
  assert.equal(m.unitDeletionPlan(m.user("4"), "shibuya").reasons.some((r) => r.includes("勤怠記録")), true);
});

test("UC-110: a record with an unknown historical unit is not guessed from the user's current unit", () => {
  const m = make(), target = add(m);
  m.records.push({ userId: "1", date: "1999-01-01", punches: [], history: [] });
  assert.throws(() => m.deleteUnit(m.user("4"), target.key), /未使用と判定できません/);
  assert.equal(m.records.at(-1).unit, undefined);
});

test("UC-110: execution rejects a formerly authorized administrator after privilege changes", () => {
  const m = make(), admin = m.user("4"), target = add(m);
  assert.deepEqual(m.unitDeletionPlan(admin, target.key).reasons, []);
  const other = m.saveUser(admin, { name: "権限確認", id: "other-admin", password: "password2" });
  m.setRoles(admin, other.key, ["master"]);
  m.setRoles(other, admin.key, []);
  const before = state(m);
  assert.throws(() => m.deleteUnit(admin, target.key), /マスタ管理者/);
  assert.equal(state(m), before);
});

test("UC-110: a new attendance record captures the unit at creation and its correction history", () => {
  const m = make(), admin = m.user("4"), manager = m.user("3");
  m.setUnit(admin, "1", "hq");
  m.setManaged(admin, manager.key, ["hq"]);
  m.correct(manager, "1", "2026-10-14", [
    { type: "出勤", at: "2026-10-14T09:00:00" }, { type: "退勤", at: "2026-10-14T18:00:00" },
  ], "作成時の所属を保持する");
  const record = m.record("1", "2026-10-14");
  assert.equal(record.unit, "hq");
  assert.equal(record.history[0].unit, "hq");
  m.setUnit(admin, "1", "shibuya");
  assert.equal(record.unit, "hq");
});

test("UC-110: unknown unit references in periods, shifts, requests and histories also fail closed", () => {
  for (const collection of ["periods", "shifts", "items", "shiftHistory", "unitUsageHistory"]) {
    const m = make(), target = add(m);
    m[collection].push({ unit: null });
    const before = state(m);
    assert.throws(() => m.deleteUnit(m.user("4"), target.key), /未使用と判定できません/);
    assert.equal(state(m), before);
  }
});
