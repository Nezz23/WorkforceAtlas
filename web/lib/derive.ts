// Arithmetic over published, observed counts. Nothing here estimates: sums, ratios and window selections only.
import type { Kpi, Scope } from "./types";

export const CATEGORY = [
  { key: "drp", label: "Deferred resignation (DRP)", color: "var(--c-drp)" },
  { key: "quit", label: "Quit", color: "var(--c-quit)" },
  { key: "retirement", label: "Retirement", color: "var(--c-retirement)" },
  { key: "rif", label: "Reduction in force", color: "var(--c-rif)" },
  { key: "termination", label: "Termination or expired appointment", color: "var(--c-termination)" },
  { key: "other", label: "Other, incl. disability retirement", color: "var(--c-other)" },
] as const;

/** Separations by type with DRP split out of quit and retirement, so the stack adds to the total. */
export function separationMix(k: Kpi) {
  const drpOther = k.sep_drp - k.sep_drp_quit - k.sep_drp_retirement;
  return {
    drp: k.sep_drp,
    quit: k.sep_quit - k.sep_drp_quit,
    retirement: k.sep_retirement - k.sep_drp_retirement,
    rif: k.sep_rif,
    termination: k.sep_termination,
    other: k.sep_other + k.sep_retirement_other - drpOther,
  };
}

export function last12(rows: Kpi[], end?: number) {
  if (rows.length === 0) throw new Error("last12: no rows to window");
  const endMonth = end ?? rows[rows.length - 1].month;
  const i = rows.findIndex((r) => r.month === endMonth);
  if (i < 0) throw new Error(`last12: end month ${endMonth} is not in the data (${rows[0].month} to ${rows[rows.length - 1].month})`);
  const win = rows.slice(Math.max(0, i - 11), i + 1);
  const avg = win.reduce((s, r) => s + (r.avg_headcount ?? r.headcount), 0) / win.length;
  const sum = (f: (r: Kpi) => number) => win.reduce((s, r) => s + f(r), 0);
  return {
    months: win.length, avgHeadcount: avg,
    separations: sum((r) => r.separations), newHires: sum((r) => r.acc_new_hire), drp: sum((r) => r.sep_drp),
    experienceLost: sum((r) => r.experience_lost_years),
  };
}

export function rolling12(rows: Kpi[], f: (r: Kpi) => number) {
  return rows.map((r, i) => ({ t: r.month, v: i >= 11 ? rows.slice(i - 11, i + 1).reduce((s, q) => s + f(q), 0) : null }));
}

export const at = (rows: Kpi[], month: number) => rows.find((r) => r.month === month);

/** Departments large enough that a percentage move is not noise, ordered by 12-month change. */
export function movers(scopes: Scope[], minHeadcount = 5000) {
  return scopes
    .filter((s) => s.headcount_year_ago != null && s.headcount_year_ago >= minHeadcount)
    .map((s) => ({ ...s, change: s.headcount - s.headcount_year_ago!, pct: 100 * (s.headcount / s.headcount_year_ago! - 1) }))
    .sort((a, b) => a.pct - b.pct);
}
