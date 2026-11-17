# Re-audit 2, lens 6: Hiring manager (2026-11-17)

Score: **8.4 / 10** (previous 8.6). Judged as a live site with a private repository. The drop is not worse work: the
earlier score assumed a public repo and history. With the repo private, the reviewer sees only claims, so the
verification burden moves to the site and the interview. Numbers below were read from data/published/models/*.json
and the site served at 127.0.0.1:57558. I make no statement about who wrote what; a private repo means no reviewer
can either, which is itself a finding (H1).

## 1. First 30 seconds
Strong. Headline ("smallest since 2012", 2,017,021), a plain-language data-notice box, KPIs, a fan chart, the
September 2025 deferred-resignation (DRP) wave. Calm editorial tone, labelled observed/derived/modeled, CSV download
on charts. A reviewer concludes within 30 seconds: this person cares about data quality. Three frictions:
- Nothing says who built it, why, or where to see the code (footer is only the OPM source line; no about, no contact).
- Four notice lines about the Department of War sit before the reader has any context. Honest, but heavy at the door.
- "Smallest since 2012" is stated, then qualified in the same sentence ("true figure is somewhat higher" because DoD
  records are missing). A skeptic reads the qualifier as the claim being unsafe.

## 2. Modelling story: strength and credibility
Strong points (all in the JSON):
- Proper out-of-time design: 44 rolling origins; method chosen on pre-2023 targets, tested 2023-24, 2025-26 reported
  apart (forecast.json windows, n_origins). 12-month WAPE government-wide stock_flow 1.669 test, 5.958 shock vs naive
  2.878 / 7.018.
- Honest failure reporting: 80% intervals covered 53.2% / 72.6% (gov / depts) in test and 26.2% / 46.8% in 2025-26
  even after the adaptive fix (interval_coverage_80, intervals.scores_80.adaptive).
- DRP counterfactual with intervals: FY2025 exits 266,861 vs 139,092 expected = 1.92 (95% 1.43-2.57); excluding DRP
  1.21 (0.90-1.63), interval includes 1.0 (exit_model.json excess, dept ALL).
- Anomaly detector calibrated 2017-19 (threshold 4.73, 1.01% of 3,962), holdout 2022-24 0.69% of 3,790.
- Gaps routed out of the models rather than shown as signals: the best senior-level signal on the site.

Weak points a good interviewer will find:
- The "87.5%" exit-model gain is against a department-average baseline (16.17 vs 2.02). Against the Poisson GLM the
  gain is 62.7% (5.42 vs 2.02). Quote the GLM figure; it is the honest comparison.
- Exit-model whole-year bias for the chosen gbm_lm is not small: +13.6% FY2020, -9.5% FY2022, +8.0% FY2023,
  +12.0% FY2024 (by_year). It ranks groups well but misses totals; 1.21 "within normal error" leans on that error band.
- Forecast is nearly flat: 2,024,832 (Aug 2026) to 2,024,696 (Aug 2027) to 2,024,560 (Aug 2028), after a 7.9% fall
  in 12 months, because DRP is assumed not to recur. Defensible, but the first reaction is "your model predicts
  nothing". The range 1.80M-2.09M is wide and lopsided.
- Test coverage is from 156 overlapping origins; they are not independent, so 53% is itself noisy.
- Model selection happened on a window right before a regime change, and no regime handling exists (disclosed).

## 3. Private repo: effect and what to do
Effect: a recruiter cannot check code, tests, CI, commit cadence, or that the pipeline runs. manifest.json has
code_version null and sha256 null for every source file; the docs say the pipeline has never run in CI. Claims like
"CI-checked", "44 tests", "reconciles every file" are unverifiable from outside, and unverifiable claims on a resume
are read as zero-weight by careful reviewers.
What the owner should do (cheapest first):
1. Put a short "Engineering" section on the public site (or a public page): pipeline diagram, contract checks with
   one real example of a failed check, reconciliation table, test/CI counts only after CI has actually run, dated.
2. Add an About/Contact line and a link to a profile; say the code is available on request.
3. Offer read-only access: GitHub invite for the interviewing team, or a public repo containing only models/,
   tests/ and docs (the data is public OPM data, so there is little to protect). If the decision stays private,
   at least publish a small public repo with the forecast backtest harness and its README.
4. Interview kit, rehearsed: share screen and run the build live; open a data-contract failure; run one backtest origin;
   show the simulator reproducing the forecast (220,143 - 201,162 - 17,881 = +1,099 per forecast.json trace);
   walk the DRP counterfactual and say why 1.21 is not causal. Have the eight questions from the earlier audit answered.
5. Run the pipeline once in CI before putting "CI" on any resume line.

## 4. Limitations without self-undermining
Mostly well done. Methods "Limits" per model plus a global Limits section is the right pattern, and the
under-coverage is stated plainly. Where it tips into undermining: (a) the same page shows "80% range" bare on the
home, planning and brief pages while Methods admits it held 53% / 26%; (b) the home headline is qualified in
mid-sentence; (c) limits are scattered across seven places, with no single "how much to trust this" line.
Fix: label ranges "80% target; held 53% in tests" at the chart, and one sentence per page: "Trust this for X, not Y".

## 5. Missing compared with strong portfolio projects
- Author identity, story and a "what I found / what I would do next" page.
- A public proof of engineering (see s3).
- A decision framed for a user: "so what should a workforce planner do", beyond descriptive numbers.
- No external validation shown on the site (Pew 348,219 separations cross-check suggested earlier, still not shown).
- No data release for outsiders; provenance gaps (code_version null, sha256 null).
- Interval calibration still short of nominal.

## 6. Findings
**Critical** none.

**High**
- H1 Unverifiable work. Private repo, no commits visible, code_version/sha256 null, CI never run. Evidence: manifest.json;
  PROFESSIONAL_AUDIT s5. Fix: s3 items 1-5 above.
- H2 No author, contact or provenance on the site. Evidence: footer and Methods contain only the OPM source line. A
  recruiter cannot connect the site to the resume. Fix: an About line with name, link, "code on request".
- H3 Resume draft contains stale and unprovable numbers. PROFESSIONAL_AUDIT s6 says FY2025 1.77x / 1.12x (now 1.92 /
  1.21), 87% (now 87.5%, but see baseline caveat), and "checked ... in CI" (CI has not run). Fix: use section 7 below.
- H4 Interval labelling. Intervals still under-cover (53.2%, 26.2% gov; 72.6%, 46.8% depts) while pages say "80% range".
  A reader who skips Methods is misled; a reader who finds it doubts the whole forecast. Fix: relabel on charts,
  or run the check on non-overlapping origins and show observed coverage next to the range.

**Medium**
- M1 Weak-baseline headline: 87.5% vs department average; GLM gain is 62.7%. Quote both.
- M2 Exit-model year bias up to 13.6% is only in docs and Methods; put it beside the 1.21 claim.
- M3 Near-flat forecast after a 7.9% fall needs one sentence on why (DRP not repeated) at the number itself.
- M4 "Smallest since 2012" headline qualified by missing DoD records in the same sentence.
- M5 Unverified claims on the site: "534 OPM files and 386,525,463 records" are read from the page; re-check from the
  manifest before using on a resume.
- M6 Dense top-of-page notices (four DoW lines) before the first number.

**Low**
- L1 Tagline "Compensation Intelligence" / "intelligence platform" overclaims for six pages.
- L2 Pew cross-check not on the site.
- L3 No license (repo) and no chart alt-summary check from this lens (not tested here).
- L4 Selection window ends just before the regime change; no regime handling.

## 7. What blocks 9+
1. A reviewer can verify something: public code (or access) plus one green CI run, dated.
2. Identity and story on the site: who, why, findings, what next.
3. Ranges honestly labelled with observed coverage, or coverage near nominal (conformal on a regime-aware window).
4. Resume numbers that match the JSON, with the GLM comparison instead of the weak baseline alone.
5. A decision-oriented takeaway for a planner, not only description.
Items 1-2 need the owner, not code; they are worth about +0.4. Items 3-4 about +0.3.

## 8. Corrected resume bullets (every number from data/published/models/*.json)
- Built Workforce Atlas, an independent analysis of OPM Federal Workforce Data (Dec 2011 to Sep 2026): a
  contract-checked DuckDB pipeline that keeps months OPM reports incomplete out of every model (manifest.json,
  data_notices.json; verify the file and record counts from the manifest first).
- Backtested four headcount methods over 44 rolling origins, choosing on 2016-2022 targets and testing on 2023-24:
  stock-flow missed government-wide headcount 12 months ahead by 1.7% (vs 2.9% for no-change); 6.0% in 2025-26
  (forecast.json wape, wape_by_year_12m).
- Measured and reported forecast-interval failure instead of hiding it: 80% ranges held 53.2% (government) and
  72.6% (departments) of 2023-24 outcomes and 26.2% / 46.8% in 2025-26 after an adaptive-conformal adjustment
  (interval_coverage_80).
- Built a gradient-boosting exit model validated year by year (FY2019-24; test deviance 2.02 vs 16.17 for a
  department baseline and 5.42 for a Poisson GLM; whole-year bias between -9.5% and +13.6%), and used it to show FY2025
  voluntary exits at 1.92x expected (95% 1.43-2.57), 1.21x (0.90-1.63) excluding deferred resignations; not causal
  (exit_model.json deviance, by_year, excess).
- Calibrated a seasonal robust anomaly detector on 2017-19 (threshold 4.73, 1.01% of 3,962 months flagged), held-out
  flag rate 0.69% of 3,790 in 2022-24, across 149 series (anomaly.json).
- Derived GS base pay for redacted records, lifting GS pay coverage from 57.5% to 99.8% for Sep 2026 (check facts.json
  coverage fields).
Drop "CI-checked", "0 axe violations", "15/15" and test counts until the CI run and the numbers are public.

Summary: 8.4/10. Critical 0. High 4 (H1 unverifiable under private repo, H2 no author or provenance on site, H3 stale and
unprovable resume draft, H4 80% ranges under-cover but labelled 80%).
