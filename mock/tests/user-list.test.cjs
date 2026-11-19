"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createModel, roleLabels } = require("../model.js");
const source = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");

function renderRows(includeDeleted) {
  const model = createModel();
  model.users[0].deleted = true;
  let rows;
  const context = {
    model, roleLabels, state: { filters: { users: { deleted: includeDeleted } } },
    master: () => true, esc: String, val: String, roles: () => "", assigned: () => "",
    card: (_title, _ids, body) => body,
    actions: (...parts) => parts.join(""), note: () => "", filterForm: () => "",
    fieldInput: () => "", field: () => "", select: () => "", unitPairs: () => [], check: () => "",
    btn: (label, action, id) => `<button data-action="${action}" data-id="${id}">${label}</button>`,
    table: (_headers, values) => { rows = values; return ""; },
  };
  const start = source.indexOf("  function usersPage() {");
  const end = source.indexOf("  function notificationDrawer()", start);
  assert.ok(start >= 0 && end > start);
  vm.runInNewContext(source.slice(start, end) + "\nusersPage();", context);
  return { rows, model };
}

test("user list has a single edit entry opening the existing detail route", () => {
  const { rows, model } = renderRows(false);
  assert.equal(rows.length, model.users.filter((user) => !user.deleted).length);
  for (const row of rows) {
    const controls = row[5];
    assert.equal((controls.match(/<button /g) || []).length, 1);
    assert.match(controls, /data-action="user-detail"/);
    assert.match(controls, />編集する<\/button>/);
    assert.doesNotMatch(controls, /data-action="user-edit"|>詳細<\/button>/);
  }
  assert.match(source, /"user-detail": \(\) => goRoute\("\/adm\/user\?id=" \+ encodeURIComponent\(id\)\)/);
});

test("deleted users retain a view-only list entry instead of an edit entry", () => {
  const { rows, model } = renderRows(true);
  assert.equal(rows.length, model.users.length);
  const deleted = rows.find((row) => row[1] === model.users[0].id);
  assert.ok(deleted);
  assert.equal((deleted[5].match(/<button /g) || []).length, 1);
  assert.match(deleted[5], /data-action="user-detail"/);
  assert.match(deleted[5], />表示する<\/button>/);
  assert.doesNotMatch(deleted[5], />編集する<\/button>|>詳細<\/button>/);
});
