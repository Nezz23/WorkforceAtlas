# Workforce Atlas: data science re-audit (independent)

Score: 7.5 / 10 (was 6.5). Method: reran code against the published parquet/JSON, re-derived numbers, read live pages on :3100. pytest passes (17), which I treat as non-evidence.

## 1. First-audit findings

| # | Status | Evidence I produced |
|---|---|---|
| H1 simulator vs forecast | Resolved (with caveat) | For all 19 scopes, cumsum(hires - exits + other) matches the plotted path to rounding (max error < 30 head, rounding only). ALL: 220,143 - 201,162 - 17,881 = +1,099 = `change_12`. `simulate.ts` adds lever deltas to `b.forecast`, so default = forecast by construction. Caveat: "other" is large (ALL -8% of hires; DOD -21.9k against hires-exits of +2.3k), so for departments the "flows" the levers scale are almost irrelevant to the path. |
| H2 non-DRP ratio | Resolved | `exit_model.json` ALL: 1.77 -> 1.12 (FY25), 1.39 -> 1.05 (FY26); Mobility page shows both and says neither is causal. |
| H3 overdispersion | Resolved | `log_interval` at `exit_model.py` uses phi (7.25) plus model-error s2 (log SD 0.156). I reproduced ALL FY25 1.77 -> (1.30, 2.40); s2 dominates, phi/count is 2.7e-5. |
| H4 test bias | Resolved | By-year GBM bias published: FY23 +3.8%, FY24 +16.3% (predicted 160,481 vs 138,033). On Mobility and Methods. Selection-year biases are also shown (-17.5% FY22). |
| Anomaly calibration | Resolved | `anomaly.json`: 3,962 calibration months, threshold 4.73, calm rate 1.01%; holdout 2022-24 0.69% of 3,790. Matches the page. |
| WAPE pooled | Mostly resolved | Gov-wide and departments are now separated, with 3 windows and by-year error in the JSON. I reproduced all 12-month WAPEs (e.g. gov-wide test stock_flow 1.669). Per-department error is still not published. |
| ETS includes DRP step-down | Open | `forecast.py` ETS fits log H directly (ets branch of `_forecast`). Methods "Limits" says DRP is "left out of the exit history and assumed not to recur"; that is true only for stock_flow. DOD (ETS): hires 82k > exits 80k, yet the forecast change is -19.6k. |
| Scopes by latest size | Resolved | `backtest()` tests `s.at[origin,"H"] < MIN_SIZE`. I truncated kpi at 2019-06, 2021-12 and 2024-12 for ALL and VA: forecasts for all 4 methods were identical to the untruncated ones (max diff 0.0). Backtest (my rerun) matches the JSON. |
| GLM ratios vs GBM | Resolved | Explanation is the chosen model's partial dependence; GLM ratios are kept as a check. |
| Life table exp(-rate) | Resolved | Recomputed from the JSON rates: exp gives 45.1 / 49.1 / 50.8 / 38.3 / 46.6, equal to the JSON; 1-rate would give 40.6 / 33.5 etc. |
| "Tested on years not seen" overclaim | Partly | Brief and Planning now say "years not used to choose". Methods still says all four models are "tested out of sample" (see M5). |
| Coverage claim | Resolved, but see M1 | Sequential coverage reproduced: 80% range held 49.4% / 63.3% (2023-24) and 18.1% / 33.1% (2025-26). Published honestly on Brief and Planning. |

## 2. New problems

**High**

**N1. Data-notice masking is applied only to the forecast and anomaly models. The exit model, life table and headline KPIs read the gap months.** `exit_model.py` `cells()` and `retention.py` use the warehouse and segments untouched. DOD Aug 2026 separations are 1,325 (usual ~7.5k) and Sep 1,727 (usual ~7.9k). My estimate: ~6.6k voluntary exits are missing from FY2026 (DOD 51,349 of which ~13%). Corrected, DOD FY26 excl-DRP goes from 0.88 to ~1.02 and ALL from 1.05 to ~1.10. The FY2026 retention rates are also affected: the 1-2 year band is 12.4% against 19.0% in FY25, and 46.6% at 5 years is probably overstated. Every page says "Models skip them", which is false for these two models. The DOD profile says "9.7% separation rate vs 13.9% a year earlier", and the Brief shows 218K separations and 0.80 hires per separation. All of these include the gap months with no flag on the KPI itself (the notice paragraph does say totals understate). Fix: in `cells()` and `retention`, drop or flag (scope, month, stream) in `notices.unreliable`, or print "FY2026 incomplete for DOD" next to those figures. Replace "Models skip them" with a list of what is skipped.

**Medium**

**M1. Intervals are pooled across scale and thin.** `forecast.py` `qtab`: department quantiles pool all 22 scopes. VA's 95% range at 12 months is 334k-487k (-26%/+8%); 80% is 408k-470k, wider than any VA move since 2012. Gov-wide uses 39 overlapping errors at h=12 (~10 independent years). The 2.5%/97.5% points are essentially the 2025 error. Skew is inherited from one shock (-7.9%/+2.4%). The new construction has no out-of-sample test, yet the pages label it "80% range". Fix: scale the errors (use a size-banded or per-scope quantile, or a log-error SD times horizon), widen with a bootstrap over years, and label the range "empirical, includes the 2025 shock".

**M2. The suspected-gap rule is applied inconsistently.** DOD Aug 2026 was masked because all categories fell at once. VA Feb 2026 has the same signature: separations 808 against ~4,000 normal, hires 1,046 against ~3,000-4,000, and every exit type down. It is published as "Highly unusual" signals (VA, and also in `/d/VA/`). The Oct-Nov 2025 shutdown processing lapse is not in `ref/data_notices.csv`; the anomaly model reports DOD Oct 2025 hires -81% as signals, and the forecast absorbs it as a -86k reconciliation gap. Fix: one rule (e.g. >=3 flow types more than 60% below usual simultaneously => suspected gap), run over all scopes, and list the lapse as a notice.

**M3. The reconciliation-gap term is hand-patched and mixed.** `forecast.py` `flow_forecast`: `drop([202509, 202510])` hard-codes the DRP processing dates. In `series()`, `gap` uses gap-corrected hires with raw separations, so Jun-Aug 2026 gaps are biased negative. I estimate ~ -0.5k/month, about -7k over 12 months, inside the published "other change" -17,881. Fix: compute `gap` from the same corrected series, and drop months where `sep_drp > x% of separations` in code rather than by date.

**M4. "Other change" is labelled wrongly for departments.** For ETS departments the remainder is the damped-trend extrapolation of the 2025 decline (DOD -21.9k), not "transfers, reorganisations and the reconciliation gap" (Planning text). Fix: label it "change not explained by the flow baseline" or switch department simulators to stock-flow.

**M5. Methods overclaims.** "Four models, each chosen against a simpler baseline and tested out of sample", and the trust mark "tested on years it did not see". Retention has no baseline or out-of-sample test (its intervals are Poisson-only, +/-0.1 points, which I flag as meaninglessly narrow). Anomaly tests only the calibration/holdout rate. Fix: reword per model.

**Low**

- L1. `anomaly.py` docstring calls 2017-2019 "a period without a known workforce program": Jan-Apr 2017 hiring freeze and the Dec 2018-Jan 2019 shutdown are in it. Say "calm", not "program-free".
- L2. Brief "FY2025 exit rates imply 38% retained" is projected from a DRP year. Present it as a stress case.
- L3. `test_forecast_uses_nothing_after_the_origin` tampers `s` after `series()`. It does not test `series()` itself or gap-fill leakage (I checked the real data: clean).
- L4. `notices.departments()` regex `[A-Z]{2}[0-9A-Z]{2}` takes the first two letters of any 4-letter caps token (e.g. "NASA" -> "NA"), and no check reports an unmapped scope. Fix: validate scopes against `kpi.scope`.
- L5. Department simulator flows (3-year seasonal medians) are never backtested.
- L6. Mobility prints 98,804 DRP in the lead and 98,186 in the model; the two are on different category bases, so state which.
- L7. Dept and ALL forecast origins differ (VA Sep 2026, DOD/ALL Aug 2026) and are not reconciled; sum of dept forecasts does not equal ALL.

## 3. Verified correct

- No forecast leakage; eligibility by size at origin; windows split by target month.
- Backtest and WAPE reproduced exactly; sequential coverage reproduced.
- Exit rolling-origin design is sound. GBM hyperparameters are fixed, not tuned on the test years.
- Page numbers I spot-checked match the JSON (ALL 80% range 1,972,254-2,060,494; 49/63/18/33%; 1.77/1.12/1.39/1.05; 0.69%).

## 4. Score: 7.5

+1.0 over the first audit. The big statistical errors (H1-H4, calibration, life table) are fixed, and the uncertainty is reported with honest test-year bias and coverage failures. Held back by the incomplete masking (N1, a headline claim that is false for two models), unvalidated and pooled intervals, an unfixed ETS/DRP contradiction, and a gap rule applied to one department. A 9 needs N1, M1, M2 and M4 closed, and out-of-sample coverage measured for the published construction.
