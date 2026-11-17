export type Kpi = {
  month: number; headcount: number; headcount_prev: number | null; pay_n: number;
  separations: number; sep_voluntary: number; sep_drp: number; sep_drp_quit: number; sep_drp_retirement: number; sep_quit: number; sep_retirement: number;
  sep_retirement_other: number; sep_rif: number; sep_termination: number; sep_other: number; sep_transfer: number;
  experience_lost_years: number; sep_late: number;
  accessions: number; acc_new_hire: number; acc_competitive: number; acc_excepted: number; acc_ses: number;
  acc_transfer: number; acc_late: number; avg_headcount: number | null;
  sep_rate: number | null; sep_rate_lo: number | null; sep_rate_hi: number | null;
  acc_rate: number | null; acc_rate_lo: number | null; acc_rate_hi: number | null;
  new_hire_rate: number | null; too_few: boolean; pay_coverage_pct: number;
};
export type Fact = {
  id: string; label: string; value: number; unit: string; months: string[]; rule: string;
  kind: "observed" | "derived" | "modeled"; pct?: number; ci?: [number, number]; of?: number;
};
export type Scope = { code: string; name: string; headcount: number; headcount_year_ago: number | null };
export type Segment = {
  fy: number; dimension: string; level: string; avg_headcount: number; separations: number; voluntary: number;
  drp: number; rate: number | null; rate_lo: number | null; rate_hi: number | null; voluntary_rate: number | null;
  drp_rate: number | null;
};
export type Pay = {
  month: number; grade: string; n: number; observed_n: number; observed_sum: number | null; derived_n: number;
  derived_base_sum: number | null; observed_mean: number | null; derived_base_mean: number | null;
  coverage_observed_pct: number; coverage_with_derived_pct: number; observed_over_base_pct: number | null;
};
export type Exposure = { month: number; headcount: number; exposed: number; exposed_pct: number };
export type Occupation = {
  fy: number; occ_group: string; name: string | null; avg_headcount: number; separations: number;
  experience_lost_years: number; drp: number;
};
export type Reconciliation = {
  month: number; headcount: number; delta_headcount: number; net_flow_same_month: number;
  net_flow_prior_month: number | null; gap_same_month: number; gap_prior_month: number | null;
};
export type Manifest = {
  published_at: string; code_version: string | null; months: [string, string];
  sources: Record<string, Record<string, { version: number; publish_date: string; rows: number }>>;
  warnings?: Record<string, string[]>; quality?: unknown;
};

export type ForecastPoint = { t: number; v: number; lo80: number; hi80: number; lo95: number; hi95: number };
export type Level = "government-wide" | "departments";
export type Window = "selection" | "test" | "shock";
export type ForecastModel = {
  chosen: Record<Level, string>; methods: string[];
  windows: Record<Window, [number | null, number | null]>;
  wape: Record<Level, Record<Window, Record<string, Record<string, number | null>>>>;
  wape_by_year_12m: { level: Level; year: number; wape: number }[];
  interval_coverage_80: Record<Level, { test: number; shock: number }>;
  intervals: { chosen: Record<Level, "fixed" | "adaptive">; gamma: number;
    scores_80: Record<"fixed" | "adaptive", Record<Level, Record<Window, { n: number; coverage: number; width: number; score: number }>>> };
  n_origins: number; origins: [number, number]; min_size: number; scopes: string[];
  forecasts: Record<string, {
    origin: number; method: string; headcount: number; forecast: ForecastPoint[];
    flows: { hires: number[]; exits: number[]; other: number[]; hires_12: number; exits_12: number; other_12: number; change_12: number };
  }>;
  trace: { origin: number; h: number; target: number; actual: number; forecast: number }[];
};
export type Alert = {
  scope: string; name: string; flow: string; label: string; month: number; actual: number; expected: number;
  ratio: number; z: number; severity: "high" | "moderate" | ""; sustained: boolean;
};
export type AnomalyModel = {
  threshold: number; calibration: [number, number]; holdout: [number, number]; false_alarm_target: number;
  calm_flag_rate: number; holdout_flag_rate: number; n_calibration: number; n_holdout: number; latest: number;
  n_series: number; alerts_latest: Alert[]; alerts_recent: Alert[]; gaps_recent: Alert[];
  flags_by_month: { month: number; flags: number }[];
};
export type RetentionModel = {
  periods: string[]; bands: string[]; draws: number;
  tables: Record<string, Record<string, { rates: Record<string, number>; survival: { year: number; v: number; lo: number; hi: number }[] }>>;
};
export type Excess = {
  fy: number; dept: string; actual: number; drp: number; expected: number; ratio: number; ratio_lo: number; ratio_hi: number;
  ratio_excl_drp: number; ratio_excl_drp_lo: number; ratio_excl_drp_hi: number; exposure: number;
  ratio_no_level: number; ratio_excl_drp_no_level: number;   // the same ratios without the quit-rate level
};
export type ExitModel = {
  chosen: "glm" | "gbm" | "gbm_lm"; select_years: number[]; test_years: number[];
  deviance: { selection_mean: Record<string, number>; test_mean: Record<string, number> };
  by_year: { fy: number; model: string; deviance: number; predicted: number; actual: number; bias_pct: number }[];
  labour_market: { series: string; source: string; quit_rate_by_fy: Record<string, number>; b1: number; se: number; mean_rate: number };
  gain_vs_baseline_test_pct: number; n_cells_train: number; dispersion: number; model_error_sd_log: number;
  reference: Record<string, string>;
  explanation: { feature: string; level: string; rate_ratio: number }[];
  rate_ratios_glm: { feature: string; level: string; rate_ratio: number; lo: number; hi: number }[];
  importance: { feature: string; increase: number; sd: number }[];
  calibration_test: { decile: number; predicted_rate: number; actual_rate: number }[];
  excess: Excess[]; departments: string[];
};
export type DataNotice = {
  month: number; stream: "headcount" | "accessions" | "separations"; scope: string; status: "active" | "suspected" | "resolved";
  records_missing: number | null; source: string; url: string; text: string; note?: string; reviewed: boolean;
};
export type DataNotices = { fetched_at: string; source: string; latest_release: string; banner: string | null; notices: DataNotice[]; unreviewed: DataNotice[] };
