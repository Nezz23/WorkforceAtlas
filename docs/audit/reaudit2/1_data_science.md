# Re-audit 2: data science (forecasting and statistical modelling)

Auditor: independent, did not build it. Date 2026-11-17. Scope: `models/*.py`, `pipeline/labour.py`, `data/published/models/*.json`, `docs/05-models.md`, built site at 127.0.0.1:57558.

## Score: 8.0 / 10 (previous 7.5)

Method. Ran `.venv/bin/python -m pytest -q` (48 passed) and `-m models.run` (forecast 38 s, anomaly 4 s, retention 0.1 s, exit_model 43 s). The first run was byte-identical to the JSON already on disk, so the pipeline is deterministic and reproducible. Then re-derived key quantities independently (scratch script in the session scratchpad, project untouched).

Why 8.0 and not higher. The statistical machinery is now sound: no leakage found in the forecast intervals, the exit-model backtest, or the excess ratio. Selection and test windows are separated and mostly honestly reported, and the written numbers match the JSON in almost every place I checked. The score is held down by three things.
- The gov-wide forecast ranges labelled "80%" cover 53% (test) and 26% (2025-26) of outcomes, and are at the 1% floor today.
- The exit-model level adjustment is a ten-point regression whose motivating hypothesis was formed looking at a test year.
- The methodology document is stale against the JSON in four places, including a coefficient SE that is 16x too small.

No Critical findings.

Moving-target note. During the audit `models/exit_model.py` was edited (15:33, `fit_level` now uses fiscal-year-clustered SEs) and the JSON regenerated. I audited the final state. The pre-edit state (SE 0.0041) is what `docs/05-models.md` still describes.

## Findings

### High

**H1. `docs/05-models.md` contradicts the JSON in four places, despite its rule "every figure is read from the JSON".**
- `docs/05-models.md:142`: "b1 = 0.232 (SE 0.004)". The JSON (`exit_model.json` `labour_market.se`) now says 0.0656 after cluster-by-year SEs. My independent year-level OLS gives 0.070. The old SE treated 84,007 cells as independent for a regressor that varies in only 10 years. The stale text is what a reader would trust.
- `docs/05-models.md:85`: "220,143 hires − 201,162 exits − 17,881 other = +1,099, the plotted 12-month change". `forecast.json` `forecasts.ALL.flows` says hires 220,143, exits 202,398, other −17,882, change_12 −136. The identity holds, but the printed figures and the sign of the 12-month change are wrong. The site (/planning) shows the correct 202,398.
- `docs/05-models.md:72`: departments' pooled 80% range "−28.5% to +8.8%". JSON gives −28.5% to +10.5% at h=12.
- Fix: regenerate every number in 05-models.md from the JSON (a small script, or a test that greps each figure), and add a test asserting the document's quoted figures equal the JSON. The stale SE is the one that matters. Update the text to "SE 0.066, clustered by year; leave-one-year-out b1 ranges 0.137 to 0.274".

**H2. Gov-wide forecast "80%" ranges are not 80% ranges, and the documented guarantee is overclaimed.**
- Evidence (`forecast.json` `intervals.scores_80`): gov-wide coverage is 53.3% (selection, n=60), 53.2% (test), 26.2% (2025-26). Department coverage is 73.6%, 72.6%, 46.8%.
- Evidence: today's gov-wide miss rate `a` is clipped at `A_RANGE[0]=0.01` (`models/forecast.py:54`) for both the 0.2 and 0.05 runs. The published 80% and 95% bounds are therefore identical at h=12 (−10.9% / +3.3%). The planning page headline says "an 80% range of 1.80M to 2.09M". That band is the min and max of 60 past errors, i.e. a 99% target.
- `docs/05-models.md:40`: "the adaptive rule has a long-run coverage guarantee under any error sequence". The Gibbs and Candès bound is |avg miss − α| ≤ (max(α₁,1−α₁)+γ)/(γT). With α₁=0.2, γ=0.05 and T≈44 quarterly origins (fewer for long horizons, because feedback arrives h months late) the bound is about 0.39, which is vacuous. The guarantee also assumes unclipped α and immediate feedback. Neither holds (clip at 0.01/0.6; delayed resolution at h up to 24).
- The site does disclose the undercoverage ("still falls outside too often"). The headline label and the guarantee sentence are the overclaims.
- Fix: drop "guarantee" wording, or state the finite-sample bound. Label the gov-wide band with its measured coverage ("covered 53% of 2023-24 outcomes"), or label it "historical min-max range" when `a` is at the floor. Do not publish two identical bands as "80% and 95%". Consider a floor that keeps the 95% band wider than the 80% band, e.g. clip `a` at 0.01 for 95% and 0.05 for 80%.

### Medium

**M1. Test-year contamination of the exit-model hypothesis is not disclosed.**
- `models/exit_model.py:15` (docstring) and `docs/05-models.md:140` motivate the quit-rate level from the gbm's yearly misses "FY2020 low, FY2022 high, FY2024 low". FY2024 is a test year, so the idea was formed looking at the test set. The forecast-interval section carries a prototype disclosure. This one does not.
- Test evidence is weak and the document says so ("modest"). Deviance goes 2.068 → 2.023 (−2.2%). FY2023 gets worse (1.866 → 1.950; bias +3.8% → +8.0%). FY2024 improves. Mean absolute bias is unchanged (10.0% → 9.9%).
- The selection gain (2.518 → 2.360) comes from FY2021 and FY2022. In the rolling fits b1 was 0.126 and 0.135 for those years, against 0.232 in the final fit.
- Fix: add the same disclosure sentence. Say the quit-rate level is supported by selection years only and is neutral in test.

**M2. The final quit-rate coefficient rests on ten annual points and three influential years.**
- Year-level log(actual/gbm) against q: r² = 0.56. FY2020 (−0.127), FY2022 (+0.186) and FY2024 (−0.134) drive it. Leave-one-year-out b1 runs 0.137 (drop FY2022) to 0.274 (drop FY2015).
- q is confounded with everything else that moved by year (COVID freeze, 2022 retirement wave, hiring trend). Cluster SE 0.066 is honest about sampling, not about confounding.
- Effect on headlines. FY2025 all-exit ratio is 1.78 at b1=0, 1.84 at 0.1 and 1.92 at 0.232. FY2026 is 1.52, 1.57, 1.65. The q term accounts for 0.14 and 0.13 of those ratios. FY2026 q (2.175) sits at the minimum of the training range (FY2015, 2.175), so the FY2026 adjustment is an edge extrapolation.
- The published ratio intervals (`log_interval`, `exit_model.py` around line 190) carry no b1 uncertainty. The effect is small (±2%) at SE 0.066, but it is absent.
- Fix: publish the ratio with b1=0 beside the adjusted ratio (1.78 / 1.92) and say the adjustment is an assumption. Add b1 SE to the interval variance.

**M3. The adaptive-versus-fixed selection rule is nearly a coin flip, so "chosen on selection" is weaker than it reads.**
- `models/forecast.py:245` picks adaptive unless it scores >2% worse. Selection-window scores: gov-wide 3.33 versus 3.34 (n=60), departments 25.58 versus 25.54. These are ties. The adaptive rule wins by default and its real benefit appears only in test and shock windows (the ones seen in the prototype, as disclosed).
- Fix: say so plainly ("selection could not distinguish them; adaptive adopted for its behaviour under shift, evidence from test and shock is post-hoc"). Do not describe it as chosen by the 2022-and-earlier score.

**M4. Department ranges are one pooled range for all 18 departments** (`forecast.json`: VA and DOD both −28.5% / +10.5% at h=12).
- It is dominated by small, volatile departments and is meaningless for DOD or VA. Coverage by size band is not reported.
- Fix: pool within size tercile, or scale errors by department volatility. The "scaled variant" tried and discarded was a different change. Report coverage by tercile.

**M5. Retention intervals understate uncertainty** (`models/retention.py`, `docs/05-models.md:106`).
- 5-year retention 45.07% with a 44.97–45.17 interval (±0.1 pt) is count noise only (exposure held fixed, Poisson bootstrap). The period-to-period swings are 4 to 12 points.
- FY2025's 38.3% includes DRP exits in the 1–9 year bands (3–4 year rate 11.8% versus 7.5% in FY2026) and the document does not say so beside the table. The FY2026 first-year rate (36.3%) is higher than FY2022–24, but the same table is read as "retention recovered".
- Fix: show an interval across periods (or label the interval "sampling only"). Add a DRP-excluded FY2025 row, or a footnote.

### Low

- **L1. Hard-coded months.** `models/forecast.py:107` drops 202509 and 202510 from the 24-month reconciliation gap for every scope and every origin. Harmless for earlier backtest origins (they are not in the window), but it is a manual knowledge-of-the-future choice. Tie it to the notice register.
- **L2. Reconciliation test is an identity.** `tests/test_models.py:76` tests `decompose` against its own definition (other = residual). It proves arithmetic, not that the residual stays small. Add a published-JSON assertion that |other_12| / exits_12 is below a stated bound (currently 8.8%), with a warning when it moves. I verified from the JSON that hires − exits + other equals the rounded forecast change to within 1.0 person for all 19 scopes (rounding only).
- **L3. Dispersion and error variance mismatch.** `exit_model.py:223` takes dispersion (7.35) from the GLM, not the chosen gbm_lm, and `s2` (line 228) from rolling years. This is conservative (the GLM is the worse model), so it is acceptable, but unstated. The ALL row's interval uses department-level model error, not the larger shared year-level bias (up to 14%). Adding a year-level term would be more honest for the "ALL" ratio.
- **L4. Anomaly `sustained` rolling(3)** (`models/anomaly.py`) runs over rows, not calendar months. A dropped month (expected < `MIN_EXPECTED`) can make non-adjacent months look consecutive. Also, with 149 series and 1% per-series false-alarm rate, about 1.5 false flags per month are expected by construction. The site should state this base rate beside alerts.
- **L5. Candidate department list** (`forecast.py` run: `kpi.headcount >= MIN_SIZE` at any month, including the future) is mildly look-ahead on eligibility. The per-origin `MIN_SIZE` filter in `backtest` corrects most of it.

## Checks that passed

- **Interval leakage.** `sequential_bounds` uses errors with target ≤ origin only. The adaptive update uses only intervals whose target has resolved. `update(np.ones(...))` runs after the loop and feeds only the published "latest" quantile. A tamper test exists and is meaningful. Forecast origin test (`test_forecast_uses_nothing_after_the_origin`) passes.
- **Exit model, rolling origin.** b0 and b1 for year y are fitted on FY2015..y−1 only. `qbar`, categories and the department pooling (`prepare`: FY2015–2018 only) use no later data. Dispersion and model-error terms use fits that never saw the scored year (except the final refit, which is intended).
- **Same-year quit rate.** For FY2025–26 it is acceptable because the question is "excess relative to the structure given that year's job market", not a forecast. It is disclosed in the module docstring, `docs/05-models.md:144`, and `/methods` ("The quit rate is the same year's ... not a forecast made before it"). The private series excludes federal exits, so DRP cannot leak in.
- **Reported numbers.** WAPE tables, by-year gov-wide errors, interval coverage and score tables, deviance table, per-year biases, 1.92/1.21 and 1.65/1.22 ratios and CIs, anomaly (threshold 4.73, 1.01%, 0.69%, n 3,962/3,790, 149 series), retention table, FY quit rates (2.21/2.18/2.54) and the "≤14% bias" statement all match the JSON. The site pages carry the same figures.
- **Simulator reconciliation.** Forecast flows plus `other` reproduce the plotted path for all 19 scopes (max difference 1.0 from rounding).

## What improved since the previous audit

1. Intervals no longer built and scored on the same errors. They are sequential (origin-honest), and the adaptive rule reduces department undercoverage (test 63% → 73%, shock 33% → 47%).
2. Selection, test and shock windows are separate. The prototype exposure is disclosed in the interval section.
3. Exit-model level bias falls in the selection years (mean absolute bias 9.7% → 6.0%). The 2022 miss goes from −17.5% to −9.5%. A same-year signal is explicitly disclosed and used only for the excess question.
4. Final refit corrected from FY2013–2024 to the documented FY2015–2024.
5. Cluster-by-year SE for b1 was added during this audit window (code only).
6. Tests extended (48 pass), including leakage tamper, slope recovery and fetch-failure tests.

## What blocks a 9+

1. Make 05-models.md match the JSON (H1), with a test that enforces it.
2. Honest gov-wide interval labelling and removal of the "guarantee" claim (H2). Ideally a gov-wide band whose measured coverage reaches 70% or more on a held-out stretch, which needs a different construction (e.g. a year-level shock term) rather than a floor-limited quantile.
3. Disclose the FY2024 contamination (M1). Show the excess ratios with and without the quit-rate term (M2). Keep the exit-model level adjustment on probation until it is neutral-or-better on a test year other than the one that inspired it. FY2025–26 are not usable test years.
4. Size-aware department intervals (M4). Retention intervals that include between-period variation and a DRP note (M5).
