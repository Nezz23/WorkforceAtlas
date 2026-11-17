# Workforce Atlas: models and methodology

- **Updated:** 2026-11-17, after the professional audit of 2026-11-16 (`docs/PROFESSIONAL_AUDIT.md`)
- **Data:** OPM Federal Workforce Data, December 2011 to September 2026
- **Code:** `models/` (run with `python -m models.run`, about 60 s), tests in `tests/test_models.py`, simulator in `web/lib/simulate.ts`
- **Rule:** every figure below is read from `data/published/models/*.json`, written by the code. Nothing is hand-entered.

Every model works on groups. The data has no person identifier, so no individual is scored, tracked or predicted.

## 0. Months OPM reports incomplete (`pipeline/notices.py`)

OPM announces missing submissions in its release notes, not in the data files. A missing submission looks exactly
like a collapse in the count, so every model must know about it.

- **Source:** `pipeline.notices` reads https://data.opm.gov/info-and-help/release-notes each run and turns every
  "missing records" bullet into (month, stream, department) notices.
- **Review:** `ref/data_notices.csv` records a person's decision on each notice: active, resolved (OPM republished),
  or suspected (a gap OPM did not announce, with the evidence). An unreviewed notice is applied as active, so a
  notice nobody has read can only make the site more cautious. The workflow opens an issue when one is unreviewed.
- **Current notices (all Department of War):** June and July 2026 hires and separations (DD07 files missing);
  August 2026 separations (suspected: 1,325 against 7,457 in the same month of the three prior years, every
  category at once); September 2026 headcount (~10,000 Army records) and flows (~1,700 DD07 records).
- **Effect:** these department-months are shown with a notice but never read as workforce change. The forecast
  starts from the last month without a headcount notice (August 2026), department flows in noticed months are
  replaced by the same calendar month's median over the three prior years, and the anomaly model lists them as
  reporting gaps, never signals. The September 2026 Defense "signals" of the first audit are now gaps.

## 1. Headcount forecast (`models/forecast.py`)

**Question:** where will headcount be in 1 to 24 months, for the government and its 18 largest departments?

| Decision | Choice | Why |
|---|---|---|
| Candidates | No change; last year's trend; exponential smoothing (damped trend, monthly seasonality, log scale); stock-flow (hires and non-DRP exits forecast separately, rolled forward with the recent reconciliation gap) | Two naive baselines any model must beat, one direct model, one structural model |
| Origins | Every quarter-end, December 2015 to September 2026 (44), each using only data to that origin | A unit test proves a forecast does not change when data after its origin is altered |
| Eligibility | A department is forecast from an origin only if it had 5,000+ employees at that origin | Choosing departments by today's size would leak the future into the backtest |
| Split by target month | Targets to 2022-12 choose the method; 2023–2024 test it; 2025 onward reported apart | No number is both used to choose and reported as a result |
| Selection | Lowest 12-month WAPE in the selection window, separately for government-wide and departments | The two levels behave differently; pooling hid it |
| Smoothing and DRP | Exponential smoothing fits headcount itself, so the 2025 step-down is in its history; only stock-flow removes DRP exits | Stated as a limit on the site |
| Intervals | Empirical quantiles of the chosen method’s log errors at each horizon, from errors already resolved at each origin. The quantile level adapts (adaptive conformal inference, Gibbs and Candès 2021): after each origin the miss rate aimed for moves by 0.05 × (target − share missed), kept between 0.25 and 3 times the target (80%: 5%–60%; 95%: 1.25%–15%). Published ranges use every error to date and the latest level, made monotone so a range never narrows with horizon | Fixed quantiles of calm-year errors cannot widen when the regime changes; the adaptive rule is designed to track a target miss rate as errors shift (with ~44 origins and delayed feedback, an aim rather than a guarantee) |

**Error a year ahead (WAPE, %; bold = chosen at that level):**

| Method | Gov-wide: choose | Gov-wide: test | Gov-wide: 2025–26 | Depts: choose | Depts: test | Depts: 2025–26 |
|---|---|---|---|---|---|---|
| No change | 0.97 | 2.88 | 7.02 | 2.04 | 3.12 | 7.22 |
| Last year's trend | 1.04 | 2.33 | 8.50 | 2.00 | 2.95 | 8.18 |
| Exponential smoothing | 0.98 | 2.25 | 6.41 | **1.65** | **2.92** | **7.16** |
| Stock-flow | **0.87** | **1.67** | **5.96** | 2.47 | 3.34 | 6.13 |

- **Error by target year, government-wide:** 0.25–1.6% in 2016–2022, 2.6% in 2023, 0.8% in 2024, 6.8% in 2025, 4.1% in 2026.
- **Interval choice (2026-11-17):** fixed and adaptive quantiles were scored on the 80% interval score (width plus
  10 × any distance outside; lower is better). Rule, set before the run: use adaptive unless it scores more than 2%
  worse on targets up to 2022-12. Step size 0.05 was set before any run and not tuned.
  Disclosures: (1) the test-window results were seen in a prototype before this rule was written down; (2) on the
  selection window the two methods tie (3.33 vs 3.34; 25.6 vs 25.5), so the choice rests on the design argument,
  not on a measured win; (3) after a reviewer found that today's 80% and 95% ranges had collapsed onto the same 1%
  floor, the bounds were changed from a fixed 1%–60% to multiples of each target. Treat the test gains as suggestive.

| Level | Method | Choose: coverage / score | Test 2023–24: coverage / score | 2025–26: coverage / score |
|---|---|---|---|---|
| Government-wide | Fixed | 53.3% / 3.34 | 49.4% / 8.16 | 18.1% / 53.1 |
| Government-wide | **Adaptive** | 53.3% / 3.33 | 53.2% / 8.29 | 22.5% / 51.2 |
| Departments | Fixed | 71.5% / 25.5 | 63.3% / 28.6 | 33.1% / 87.0 |
| Departments | **Adaptive** | 73.6% / 25.6 | 72.6% / 27.7 | 46.8% / 73.3 |

- **Reading:** departments gain clearly (test coverage 63% → 73%, better score in test and shock). Government-wide
  barely changes and stays far below 80%. Its errors move together within a year (all four origins of 2023 missed
  high, all of 2025 missed low), so the selection window holds about seven independent years and the test two. No
  quantile rule can learn the size of the next year-level shock from that. A scaled variant (errors divided by each
  series' recent volatility) was also tried and scored worse in every window; it was not used.
- **Today's ranges:** after the 2025–2026 misses the adaptive levels sit at their lower bounds (80% range: 5% miss
  rate; 95% range: 1.25%). Government-wide, 12 months ahead: 80% range 1.87M–2.07M (−7.7% to +2.5%), 95% range
  1.81M–2.09M. Departments share one pooled relative range, so a stable department gets the same width as one that
  was cut sharply in 2025 (Veterans Affairs, 12 months: 334K–489K at 80%). Ranges narrow again as forecasts land
  inside them. The site prints each 80% range with the share of test outcomes such ranges actually held.
- **The previous version** chose one method for all scopes on errors before 2025 and reported 79.8% coverage measured
  on the same errors that built the range. That figure checked construction, not foresight, and has been removed.

## 2. Scenario simulator (`web/lib/simulate.ts`, flows from `models/forecast.py`)

- **Baseline flows:** government-wide, the stock-flow model's own hire and exit forecasts. For departments (chosen
  method: smoothing), the same calendar month's median over the last three years, so one spike at the origin, such
  as a reorganisation moving an office in, is not extrapolated.
- **Other change:** each month the forecast's change minus (hires − exits). It holds transfers, reorganisations,
  the reconciliation gap and any disagreement between the stock and flow views. It is published and shown in the
  simulator. Hires − exits + other change equals the forecast exactly, so the default scenario is the forecast.
- **First audit finding:** baseline flows implied +49,579 over 12 months against a plotted −34,101. Now,
  government-wide: 220,143 hires − 202,398 exits − 17,882 other = −136 (rounded), the plotted 12-month change.
- **Levers:** scale hires, non-retirement exits and retirements (split by the last 12 months' mix), plus a one-time
  reduction; the cumulative difference is carried onto the forecast. Nothing else reacts.

## 3. Unusual months (`models/anomaly.py`)

- **Expected value:** median of the same calendar month over up to five prior years (at least three).
- **Score:** log ratio of actual to expected, over 1.4826 × the median absolute deviation of the series' previous
  60 log ratios (at least 24).
- **Threshold:** 4.73, set so 1.01% of 3,962 scored months in 2017–2019 are flagged. On 2022–2024, which it never
  saw, it flagged 0.69% of 3,790. (The first version calibrated on 2016–2019, but 2016 had too little history to
  score, so the effective window was about one year.)
- **Reporting gaps:** months with an active or suspected OPM notice are scored but published only as gaps.
- **Scope:** 149 series, government and departments of 1,000+, hires and five exit types. Tests: a tripled month
  is flagged; a tripled month under a notice is a gap, not a signal.

## 4. Retention curves (`models/retention.py`)

- **Method:** period life table. Annual separation rates by length-of-service band (<1, 1–2, 3–4, 5–9 years) are
  hazards: a year is survived with probability e^(−rate). The first version used 1 − rate, which overstates exits
  when rates are high (first-year rates exceed 30%). Transfers are excluded.
- **Intervals:** 2,000 Poisson bootstrap draws of the counts; count noise only.

| Period | Retained after 5 years |
|---|---|
| FY2015–2019 | 45.1% |
| FY2020–2021 | 49.1% |
| FY2022–2024 | 50.8% |
| FY2025 | 38.3% |
| FY2026 | 46.6% |

- **Limits:** synthetic cohorts, not followed people; year one includes seasonal and temporary appointments;
  length of service includes prior federal and military service.

## 5. Exit-rate model (`models/exit_model.py`)

| Decision | Choice |
|---|---|
| Unit | Department (under 5,000 pooled) × grade band × length of service × age bracket × supervisory status × fiscal year |
| Target | Voluntary separations (quits, voluntary and early-out retirements; DRP included from 2025), exposure = average headcount |
| Validation | Rolling origin: each FY2019–2024 predicted by models fitted on FY2015 to the year before |
| Selection | Mean deviance over FY2019–2022; boosting must beat the GLM by more than 2%, and the labour-market level must beat boosting by more than 2% |
| Labour-market level | Each year's boosting predictions scaled by exp(b0 + b1 × (q − mean q)), q = the fiscal year's private-sector quit rate (BLS JOLTS `JTS100000000000000QUR`, fetched by `pipeline/labour.py`); b0, b1 from a Poisson GLM on the training years with the boosting model's in-sample predictions as offset |
| Test | FY2023–2024, reported per year with the bias of the predicted total |

**Mean Poisson deviance (lower is better):**

| Model | Choose (FY2019–22) | Test (FY2023–24) |
|---|---|---|
| Department-average baseline | 17.34 | 16.17 |
| Poisson GLM | 6.35 | 5.42 |
| Gradient boosting | 2.52 | 2.07 |
| **Boosting with the quit-rate level (chosen)** | **2.36** | **2.02** |

**Why the quit rate:** boosting's yearly misses followed the private quit rate: it over-predicted when quits were
low (FY2020, FY2024) and under-predicted when they were high (FY2022). The structure had no year-level signal. The
private series excludes federal separations, so deferred resignations cannot leak into it. Refit on FY2015–2024,
b1 = 0.232 (SE 0.066, clustered by fiscal year, since the quit rate varies only by year: the evidence is ten yearly
points, not 50,000 cells): a quit rate one point higher went with 26% more voluntary federal exits. The interval on
each FY2025–2026 ratio adds this coefficient's uncertainty. Using last year's
miss instead (persistence) was also tried and was worse (selection deviance 2.58, mean absolute bias 11.5%).

**Bias of the predicted total (boosting → with quit rate):** FY2019 −1.1 → +0.6%, 2020 +13.8 → +13.6%, 2021
−6.5 → −0.4%, 2022 −17.5 → −9.5%, 2023 +3.8 → +8.0%, 2024 +16.3 → +12.0%. Mean absolute bias falls from 9.7% to
6.0% in the selection years and barely moves in the test years (10.0% → 9.9%). The worst miss is now 14% (FY2020,
COVID, which a fiscal-year quit rate that is half pre-pandemic cannot see). The test deviance gain is modest (2.2%).

**Disclosure:** the quit-rate idea came from looking at the boosting model's bias in all six rolling years, the
FY2023–2024 test years included; the selection rule then used FY2019–2022 only. The test gain is small (deviance
−2.2%; FY2023's bias got worse, 3.8% → 8.0%), so the adjustment is shown with a sensitivity: without it, FY2025
voluntary exits ran 1.77 times expected (1.12 without deferred resignations), against 1.92 and 1.21 with it. Both
are on the Mobility and Methods pages.

**Same-year signal:** the quit rate is that year's, so the expectation means "given the structure and that year's
job market". That is what the FY2025–2026 departure asks; it is not a forecast made before the year began.

**Fix found during this work:** the final refit for FY2025–2026 read FY2013–2024, not the documented FY2015–2024.
It now reads FY2015–2024 (dispersion 7.25 → 7.35).

**Departure from structure, FY2025–2026** (refit on FY2015–2024):

| | All voluntary exits | Excluding DRP |
|---|---|---|
| FY2025 | 1.92 (95%: 1.43–2.58) | 1.21 (0.90–1.63) |
| FY2026 | 1.65 (1.23–2.22) | 1.22 (0.91–1.65) |

Before these two changes they were 1.77 and 1.12 (FY2025) and 1.51 and 1.12 (FY2026). They rose because private
quit rates in FY2025–2026 (2.21%, 2.18%) were below the FY2015–2024 average (2.54%): in that job market, fewer
federal employees would normally have left.

- **Data gaps:** department-months under an OPM notice (Department of War June–September 2026; Veterans Affairs February 2026, suspected) are left out of both exits and exposure, so those rates use only whole months.
- **Reading:** most of FY2025's excess is the deferred resignation program. Without it, exits ran 1.21 times the
  expectation, and the 95% interval (0.90–1.63) still includes 1. Neither ratio is the program's causal effect: some takers would have left anyway, so the
  first overstates and the second understates the departure from normal behaviour.
- **Intervals:** log-scale, combining overdispersion (Pearson dispersion 7.35; variance = 7.35 × mean) and the
  model's own error across departments in the rolling years (log SD 0.150). The first version used Poisson-only
  intervals, far too narrow.
- **Explanation:** the chosen model's partial dependence (every cell set to a level, exposure-weighted mean rate,
  relative to the reference level). Age 65+: 4.6× the rate of 40–44; first year of service: 3.0× the rate of
  10–19 years. Permutation importance on FY2024: age, then length of service, grade, department, supervisory status.
  GLM rate ratios are kept in the JSON as a check. All associations, not causes.

## 6. Monthly brief

`/brief/` is a printable memo whose sentences are filled from `facts.json` and the model outputs; nothing is
written by a language model. The PDF is built from the exported site in the workflow (`npm run pdf`).
