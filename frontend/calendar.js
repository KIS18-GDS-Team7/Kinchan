/* Calendar dates use UTC so weekday alignment does not depend on the device timezone. */
((root) => {
  "use strict";
  const iso = (date) => date.toISOString().slice(0, 10);
  function monthsInPeriod(period) {
    const months = [];
    const date = new Date(period.from.slice(0, 7) + "-01T00:00:00Z");
    const last = period.to.slice(0, 7);
    while (iso(date).slice(0, 7) <= last) {
      months.push(iso(date).slice(0, 7));
      date.setUTCMonth(date.getUTCMonth() + 1);
    }
    return months;
  }
  function monthGrid(period, month) {
    const first = new Date(month + "-01T00:00:00Z");
    const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    const cells = Array(first.getUTCDay()).fill(null);
    for (let day = 1; day <= count; day++) {
      const date = month + "-" + String(day).padStart(2, "0");
      cells.push({ date, day, inPeriod: date >= period.from && date <= period.to });
    }
    while (cells.length % 7) cells.push(null);
    return cells;
  }
  // A period is supplied only after the existing period selection has been made.
  function initialDay(period, today, month = "") {
    const from = month ? [period.from, month + "-01"].sort().at(-1) : period.from;
    const to = month ? [period.to, iso(new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)))].sort()[0] : period.to;
    return today >= from && today <= to ? today : from;
  }
  const api = { monthsInPeriod, monthGrid, initialDay };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.KinchanCalendar = api;
})(globalThis);
