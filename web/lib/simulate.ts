// What-if scenarios on top of the headcount forecast. Pure arithmetic, no model refit:
// a scenario changes the baseline monthly flows, and the headcount path moves by the cumulative difference.
// With every lever at its default the scenario equals the forecast exactly.

export type Baseline = {
  forecast: number[];          // forecast headcount, months 1..n after the origin
  hires: number[];             // baseline monthly hires
  exits: number[];             // baseline monthly non-DRP exits
  retirementShare: number;     // share of those exits that are retirements (last 12 months)
};

export type Levers = {
  hiring: number;              // multiplier on baseline hires (1 = as forecast)
  otherExits: number;          // multiplier on non-retirement exits
  retirements: number;         // multiplier on retirements
  oneTimeExit: number;         // people leaving at once, in `oneTimeMonth`
  oneTimeMonth: number;        // 1-based month after the origin
};

export const DEFAULT_LEVERS: Levers = { hiring: 1, otherExits: 1, retirements: 1, oneTimeExit: 0, oneTimeMonth: 3 };

export function simulate(b: Baseline, l: Levers, horizon = b.forecast.length) {
  const path: number[] = [];
  let delta = 0, hires = 0, exits = 0;
  for (let i = 0; i < horizon; i++) {
    const r = b.retirementShare;
    const dHires = (l.hiring - 1) * b.hires[i];
    const dExits = ((1 - r) * (l.otherExits - 1) + r * (l.retirements - 1)) * b.exits[i] + (i + 1 === l.oneTimeMonth ? l.oneTimeExit : 0);
    delta += dHires - dExits;
    hires += l.hiring * b.hires[i];
    exits += ((1 - r) * l.otherExits + r * l.retirements) * b.exits[i] + (i + 1 === l.oneTimeMonth ? l.oneTimeExit : 0);
    path.push(Math.max(0, b.forecast[i] + delta));
  }
  return { path, hires, exits, change: path[horizon - 1] - b.forecast[horizon - 1] };
}

/** Annual rates (percent of headcount) a scenario implies over its first 12 months, for the history check. */
export function annualRates(b: Baseline, l: Levers, start: number) {
  const s = simulate(b, l, Math.min(12, b.forecast.length));
  const avg = (start + s.path[s.path.length - 1]) / 2;
  return { hireRate: (100 * s.hires) / avg, exitRate: (100 * s.exits) / avg };
}
