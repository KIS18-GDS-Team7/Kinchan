"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { monthsInPeriod, monthGrid, initialDay } = require("../calendar.js");

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
