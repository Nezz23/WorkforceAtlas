// Plain readings of the published model files, shared by every page that quotes them.
import type { ForecastModel, Level } from "./types";

export const METHOD_NAMES: Record<string, string> = {
  naive: "No change", drift: "Last year’s trend", ets: "Exponential smoothing", stock_flow: "Hires minus exits",
};

/** The chosen method for a level and its 12-month error in each window, plus interval coverage. */
export function accuracy(fm: ForecastModel, level: Level = "government-wide") {
  const method = fm.chosen[level];
  const w = fm.wape[level];
  return {
    method, name: METHOD_NAMES[method],
    selection: w.selection[method]["12"]!, test: w.test[method]["12"]!, shock: w.shock[method]["12"]!,
    coverage: fm.interval_coverage_80[level],
  };
}
