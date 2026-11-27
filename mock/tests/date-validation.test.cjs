"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { runDateValidationCases } = require("./date-validation-cases.js");

test("dates, reception timestamps and attendance corrections work with native Date", () => {
  assert.equal(runDateValidationCases(require("../model.js")).checks, 27);
});

test("date validation never relies on nonstandard date-only-plus-Z parsing", () => {
  const parsed = [];
  class StrictDate extends Date {
    static parse(value) {
      parsed.push(value);
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?Z$/.test(value)) return NaN;
      return Date.parse(value);
    }
  }
  const context = vm.createContext({ Date: StrictDate });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../model.js"), "utf8"), context);
  assert.equal(runDateValidationCases(context.KinchanModel).checks, 27);
  assert.ok(parsed.length > 0);
  assert.equal(parsed.some((value) => !value.includes("T")), false);
});
