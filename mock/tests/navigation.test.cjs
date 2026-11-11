"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { menus, screens, allowedViews, homes, resolve } = require("../navigation.js");
const { createModel } = require("../model.js");
const m = createModel();

test("login uses the reference order: master, manager, employee", () => {
  assert.equal(resolve("/", m.user("1")).path, "/emp/home");
  assert.equal(resolve("/", m.user("3")).path, "/mgr/home");
  assert.equal(resolve("/", m.user("4")).path, "/adm/home");
  assert.deepEqual(allowedViews({ roles: ["manager", "master"] }), ["master", "manager", "employee"]);
});
test("the employee navigation matches the five reference tabs", () => {
  assert.deepEqual(menus.employee.map(([, label]) => label), ["ホーム", "勤怠", "シフト", "申請", "メニュー"]);
  for (const [path] of menus.employee) assert.equal(screens[path].view, "employee");
  assert.equal(screens["/emp/corrections"].section, "requests");
  assert.equal(screens["/emp/hope"].section, "requests");
});
test("manager and master menus route to separate screens", () => {
  assert.deepEqual(menus.manager.map(([, label]) => label),
    ["ホーム", "シフト管理", "シフト希望", "勤怠修正申請", "シフト日時変更申請", "勤務実態", "勤怠修正"]);
  for (const [path] of menus.manager) assert.equal(screens[path].view, "manager");
  for (const [path] of menus.master) assert.equal(screens[path].view, "master");
});
test("switching a user's displayed view does not grant privileges or switch accounts", () => {
  const manager = m.user("3");
  assert.equal(resolve("/emp/home", manager, "manager").screen.view, "employee");
  assert.equal(resolve("/mgr/shifts", manager, "employee").screen.view, "manager");
  assert.equal(resolve("/adm/users", manager, "manager").path, "/mgr/home");
  assert.equal(resolve("/mgr/shifts", m.user("1"), "employee").path, "/emp/home");
  assert.deepEqual(manager.roles, ["manager"]);
  assert.equal(resolve("/adm/users", null).path, "/login");
});
test("deep links retain targets only when the screen is authorized", () => {
  assert.equal(resolve("/emp/correction?id=a1", m.user("1"), "employee").path, "/emp/correction?id=a1");
  assert.equal(resolve("/adm/user?id=2", m.user("4"), "master").path, "/adm/user?id=2");
  assert.equal(resolve("/adm/user?id=2", m.user("1"), "employee").path, "/emp/home");
  assert.equal(resolve("/does-not-exist", m.user("3"), "manager").path, homes.manager);
  assert.equal(resolve("/users", m.user("4"), "master").path, "/adm/users");
});
