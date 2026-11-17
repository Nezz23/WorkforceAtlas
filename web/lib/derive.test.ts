import { test } from "node:test";
import assert from "node:assert/strict";
import { last12, movers, rolling12, separationMix } from "./derive.ts";
import type { Kpi, Scope } from "./types";

const kpi = (month: number, o: Partial<Kpi> = {}): Kpi => ({
  month, headcount: 100, headcount_prev: null, pay_n: 0, separations: 10, sep_voluntary: 0, sep_drp: 0, sep_drp_quit: 0,
  sep_drp_retirement: 0, sep_quit: 0, sep_retirement: 0, sep_retirement_other: 0, sep_rif: 0, sep_termination: 0,
  sep_other: 0, sep_transfer: 0, experience_lost_years: 1, sep_late: 0, accessions: 0, acc_new_hire: 2, acc_competitive: 0,
  acc_excepted: 0, acc_ses: 0, acc_transfer: 0, acc_late: 0, avg_headcount: null, sep_rate: null, sep_rate_lo: null,
  sep_rate_hi: null, acc_rate: null, acc_rate_lo: null, acc_rate_hi: null, new_hire_rate: null, too_few: false,
  pay_coverage_pct: 0, ...o,
});
// 24 months, 2024-01 .. 2025-12
const series = Array.from({ length: 24 }, (_, i) => kpi((2024 + Math.floor(i / 12)) * 100 + (i % 12) + 1, { headcount: 100 + i }));

test("separation mix adds to total separations, DRP split out of quit and retirement", () => {
  const k = kpi(202501, { sep_drp: 10, sep_drp_quit: 4, sep_drp_retirement: 5, sep_quit: 30, sep_retirement: 25,
    sep_retirement_other: 2, sep_rif: 3, sep_termination: 6, sep_other: 1 });
  const m = separationMix(k);
  assert.deepEqual(m, { drp: 10, quit: 26, retirement: 20, rif: 3, termination: 6, other: 2 });
  assert.equal(Object.values(m).reduce((x, y) => x + y, 0), 67); // 30 quit + 25 retirement + 1 + 2 other + 3 rif + 6 termination
});

test("last12 sums the 12 months ending at the end month", () => {
  const r = last12(series);
  assert.equal(r.months, 12);
  assert.equal(r.separations, 120);
  assert.equal(r.newHires, 24);
  assert.equal(r.avgHeadcount, (112 + 123) / 2);
});

test("last12 with an earlier end month ends there", () => {
  assert.equal(last12(series, 202412).avgHeadcount, (100 + 111) / 2);
});

test("last12 near the start returns the months that exist", () => {
  const r = last12(series, 202403);
  assert.equal(r.months, 3);
  assert.equal(r.separations, 30);
});

test("last12 throws a clear error on empty rows", () => {
  assert.throws(() => last12([]), /no rows/);
});

test("last12 throws a clear error when the end month is absent", () => {
  assert.throws(() => last12(series, 199901), /199901 is not in the data/);
});

test("rolling12 is null until 12 months exist, then sums the window", () => {
  const r = rolling12(series, (k) => k.separations);
  assert.equal(r[10].v, null);
  assert.equal(r[11].v, 120);
  assert.equal(r[23].v, 120);
  assert.equal(r[23].t, 202512);
});

test("movers drops small and no-baseline departments and sorts by percent change", () => {
  const s = (code: string, headcount: number, ago: number | null): Scope => ({ code, name: code, headcount, headcount_year_ago: ago });
  const out = movers([s("A", 6000, 5000), s("B", 4000, 4900), s("C", 7000, null), s("D", 9000, 10000), s("E", 5500, 5000)]);
  assert.deepEqual(out.map((m) => m.code), ["D", "E", "A"]);
  assert.equal(out[0].change, -1000);
  assert.equal(Math.round(out[0].pct), -10);
});
