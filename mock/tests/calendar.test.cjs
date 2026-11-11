"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { monthsInPeriod, monthGrid, initialDay, groupByPerson, rosterData } = require("../calendar.js");

test("calendar weekdays align for partial periods and include only valid selectable dates", () => {
  const period = { from: "2026-10-14", to: "2026-10-20" };
  const grid = monthGrid(period, "2026-10");
  assert.equal(grid.length % 7, 0);
  assert.equal(grid.findIndex((c) => c?.date === "2026-10-14") % 7, 3);
  assert.equal(grid.findIndex((c) => c?.date === "2026-10-01") % 7, 4);
  assert.equal(grid.filter((c) => c?.inPeriod).length, 7);
  assert.equal(grid.find((c) => c?.date === "2026-10-13").inPeriod, false);
  assert.equal(grid.find((c) => c?.date === "2026-10-21").inPeriod, false);
});
test("multi-month periods retain year boundaries and leap days without overflowing the month", () => {
  const period = { from: "2027-12-20", to: "2028-03-02" };
  assert.deepEqual(monthsInPeriod(period), ["2027-12", "2028-01", "2028-02", "2028-03"]);
  const leap = monthGrid(period, "2028-02").filter(Boolean);
  assert.equal(leap.length, 29);
  assert.equal(leap.at(-1).date, "2028-02-29");
  assert.equal(monthGrid({ from: "2026-02-01", to: "2026-02-28" }, "2026-02").filter(Boolean).length, 28);
});
test("selected days stay in the chosen period and visible month", () => {
  const period = { from: "2026-10-14", to: "2026-12-04" };
  assert.equal(initialDay(period, "2026-10-15"), "2026-10-15");
  assert.equal(initialDay(period, "2026-09-01"), "2026-10-14");
  assert.equal(initialDay(period, "2027-01-01"), "2026-10-14");
  assert.equal(initialDay(period, "2026-10-15", "2026-11"), "2026-11-01");
  assert.equal(initialDay(period, "2026-12-05", "2026-12"), "2026-12-01");
});

test("a roster retains every employee and multiple shifts on the same day without a display limit", () => {
  const members = Array.from({ length: 40 }, (_, i) => ({ key: String(i), name: "従業員" + i }));
  const shifts = members.map((u) => ({ id: "morning" + u.key, userId: u.key, date: "2026-10-14", start: "09:00", end: "12:00", published: true }));
  shifts.push({ id: "night", userId: "0", date: "2026-10-14", start: "22:00", end: "06:00", published: false });
  const grouped = groupByPerson(shifts);
  assert.equal(grouped.length, 40);
  assert.equal(grouped.reduce((n, g) => n + g.shifts.length, 0), 41);
  assert.deepEqual(grouped.find((g) => g.userId === "0").shifts.map((s) => s.id), ["morning0", "night"]);
  const roster = rosterData({ from: "2026-10-01", to: "2026-10-31" }, members, shifts);
  assert.equal(roster.people.length, 40);
  assert.equal(roster.dates.length, 31);
  assert.equal(roster.people.flatMap((p) => p.days.flatMap((d) => d.shifts)).length, 41);
  assert.equal(roster.people[0].days[13].shifts[1].end, "06:00");
  assert.equal(roster.people[39].days[13].shifts[0].userId, "39");
});

test("a roster keeps employees with no shifts and excludes other employees or periods", () => {
  const members = [{ key: "1", name: "同名" }, { key: "2", name: "同名" }, { key: "3", name: "シフトなし" }];
  const rows = [
    { id: "a", userId: "1", date: "2026-12-31", start: "09:00", end: "12:00" },
    { id: "b", userId: "2", date: "2026-12-31", start: "13:00", end: "18:00" },
    { id: "other-unit", userId: "4", date: "2026-12-31", start: "09:00", end: "18:00" },
    { id: "outside-period", userId: "1", date: "2026-12-30", start: "09:00", end: "18:00" },
  ];
  const roster = rosterData({ from: "2026-12-31", to: "2027-01-02" }, members, rows);
  assert.deepEqual(roster.dates, ["2026-12-31", "2027-01-01", "2027-01-02"]);
  assert.equal(roster.people.length, 3);
  assert.deepEqual(roster.people.map((p) => p.days[0].shifts.map((s) => s.id)), [["a"], ["b"], []]);
  assert.ok(roster.people[2].days.every((d) => d.shifts.length === 0));
});
