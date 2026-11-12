"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("mock README links resolve relative to the repository rather than the work branch", () => {
  const mockDir = path.resolve(__dirname, "..");
  const readme = fs.readFileSync(path.join(mockDir, "README.md"), "utf8");
  assert.doesNotMatch(readme, /github\.com\/KIS18-GDS-Team7\/Kinchan\/blob\/feat\/frontend-mock\//);
  const targets = [...readme.matchAll(/\]\((\.\.\/docs\/[^)#]+)(?:#[^)]*)?\)/g)].map((match) => match[1]);
  assert.equal(targets.length, 6);
  for (const target of targets) assert.ok(fs.existsSync(path.resolve(mockDir, target)), target);
});
