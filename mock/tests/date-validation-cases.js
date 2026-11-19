// Shared by the Node tests and the JavaScriptCore shell; no browser or dependencies.
((root) => {
  "use strict";
  function runDateValidationCases(modelApi) {
    let checks = 0;
    const equal = (actual, expected, label) => {
      checks++;
      if (actual !== expected) throw new Error(label + ": " + actual + " !== " + expected);
    };
    const rejects = (run, label) => {
      let rejected = false;
      try { run(); } catch { rejected = true; }
      equal(rejected, true, label);
    };
    for (const date of ["2026-10-14", "2026-12-31", "2024-02-29", "2000-02-29", "0000-01-01"]) {
      equal(modelApi.validDate(date), true, "valid date " + date);
    }
    for (const date of ["", null, undefined, "2026-1-01", "2026-01-1", "2026-02-29", "1900-02-29", "2100-02-29",
      "2026-04-31", "2026-00-10", "2026-13-10", "2026-01-00", "2026-01-32", "2026-10-14Z", "2026-10-14T00:00"]) {
      equal(modelApi.validDate(date), false, "invalid date " + date);
    }
    equal(modelApi.dateAt("2024-02-28", 1), "2024-02-29", "leap day");
    equal(modelApi.dateAt("2026-12-31", 1), "2027-01-01", "year boundary");
    const m = modelApi.createModel(() => "2026-10-14T10:30:00"), manager = m.user("3");
    const period = { unit: "shibuya", from: "2026-12-01", to: "2026-12-31", opens: "2026-11-01T00:00", closes: "2026-11-30T23:59" };
    const before = m.periods.length;
    m.savePeriod(manager, period);
    equal(m.periods.length, before + 1, "date/time period registration");
    rejects(() => m.checkPeriod(manager, { ...period, from: "2026-02-29" }), "invalid period date");
    rejects(() => m.checkPeriod(manager, { ...period, opens: "2026-11-01T25:00" }), "invalid reception time");
    const after = [{ type: "出勤", at: "2026-10-13T09:00:00" }, { type: "退勤", at: "2026-10-13T18:00:00" }];
    m.correct(manager, "1", "2026-10-13", after, "日付時刻の互換性を検証する");
    equal(m.record("1", "2026-10-13").punches.length, 2, "timestamp correction");
    rejects(() => m.correct(manager, "1", "2026-10-13", [{ type: "出勤", at: "2026-10-13T25:00:00" }], "不正な日時"), "invalid punch timestamp");
    return { checks };
  }
  if (typeof module !== "undefined" && module.exports) module.exports = { runDateValidationCases };
  else root.runDateValidationCases = runDateValidationCases;
})(globalThis);
