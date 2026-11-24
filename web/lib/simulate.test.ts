import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_LEVERS, simulate } from "./simulate.ts";

const base = { forecast: [100, 101, 102, 103], hires: [10, 10, 10, 10], exits: [8, 8, 8, 8], retirementShare: 0.25 };

test("default levers reproduce the forecast", () => {
  assert.deepEqual(simulate(base, DEFAULT_LEVERS).path, base.forecast);
});

test("halving hires lowers headcount by the cumulative missing hires", () => {
  const s = simulate(base, { ...DEFAULT_LEVERS, hiring: 0.5 });
  assert.deepEqual(s.path, [95, 91, 87, 83]);
});

test("doubling retirements adds only the retirement share of exits", () => {
  const s = simulate(base, { ...DEFAULT_LEVERS, retirements: 2 });
  assert.deepEqual(s.path, [98, 97, 96, 95]);
});

test("a one-time exit lands once and persists", () => {
  const s = simulate(base, { ...DEFAULT_LEVERS, oneTimeExit: 20, oneTimeMonth: 2 });
  assert.deepEqual(s.path, [100, 81, 82, 83]);
});
