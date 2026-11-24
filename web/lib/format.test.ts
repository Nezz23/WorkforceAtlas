import { test } from "node:test";
import assert from "node:assert/strict";
import { compact, fyOf, monthName, signedInt, signedPct, titleCase } from "./format.ts";

test("compact abbreviates thousands and millions", () => {
  assert.equal(compact(950), "950");
  assert.equal(compact(1500), "1.5K");
  assert.equal(compact(120000), "120K");
  assert.equal(compact(2_300_000), "2.30M");
  assert.equal(compact(12_300_000), "12.3M");
});

test("signedPct shows a plus, a true minus, and no sign at zero", () => {
  assert.equal(signedPct(1.234), "+1.2%");
  assert.equal(signedPct(-1.234), "−1.2%");
  assert.equal(signedPct(0), "0.0%");
});

test("signedInt groups thousands and leaves zero unsigned", () => {
  assert.equal(signedInt(12345), "+12,345");
  assert.equal(signedInt(-12345), "−12,345");
  assert.equal(signedInt(0), "0");
});

test("monthName spells the month and year", () => {
  assert.equal(monthName(202601), "January 2026");
  assert.equal(monthName(202512), "December 2025");
});

test("fiscal year turns over in October", () => {
  assert.equal(fyOf(202509), 2025);
  assert.equal(fyOf(202510), 2026);
  assert.equal(fyOf(202601), 2026);
});

test("titleCase capitalises names, lowercases small words, keeps U.S.", () => {
  assert.equal(titleCase("DEPARTMENT OF THE TREASURY"), "Department of the Treasury");
  assert.equal(titleCase("U.S. CUSTOMS AND BORDER PROTECTION"), "U.S. Customs and Border Protection");
  assert.equal(titleCase("the office"), "The Office");
});
