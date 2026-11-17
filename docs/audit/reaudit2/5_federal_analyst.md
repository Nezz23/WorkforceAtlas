# Re-audit 2: federal workforce policy analyst

Date: 2026-11-17. Independent audit; no project files edited. Previous score 8.3/10.

## Score: 8.4 / 10

The JOLTS inputs are exact, the DRP framing is honest and appropriately hedged, and the policy timeline, coverage exclusions and Pew cross-checks still verify. Points are held back because the headline excess ratios (1.92x, 1.65x) rest on a year-level regressor that is estimated from ten points, carries a standard error that is far too small, and moves the headline by about 8% for a 2% test-deviance gain. The pages do not show that sensitivity. There are also two OPM-notice presentation errors and an unexplained Defense/War naming split. No Critical findings.

## What I verified (primary sources)

- JOLTS: pulled `JTS100000000000000QUR` (BLS public API, https://data.bls.gov/timeseries/JTS100000000000000QUR) and recomputed Oct-Sep fiscal-year means from monthly values. All 12 values in `exit_model.json` `labour_market.quit_rate_by_fy` (FY2015 2.175 ... FY2026 2.175) match exactly, including FY2025 2.208 and FY2026 2.175 (all 12 months present). FY2026 includes September 2026, flagged `P` (preliminary) by BLS (value 2.3).
- b1 = 0.2322 gives exp(0.2322) = 1.261, so "26% more per point" is arithmetically right.
- Policy timeline: Federal Register API confirms FR 2025-01905 (signed 2025-01-20, published 2025-01-28), EO 14210 (signed 2025-02-11, published 2025-02-14), EO 14356 (signed 2025-10-15, published 2025-10-20), FR 2026-02375 (published 2026-02-06, effective 2026-03-09). Matches `web/lib/context.ts` POLICY.
- DRP: OPM Workforce Changes page (https://data.opm.gov/explore-data/analytics/workforce-changes, fetched live) still shows 141,084, with the "September 30, 2025 (or up to December 31, 2025 if retirement eligible)" rule. It now adds that more DRP actions are expected "as agency-specific DRPs are fully processed".
- Data gaps: OPM release notes (https://data.opm.gov/info-and-help/release-notes) 1.13.0 to 1.17.0 match `ref/data_notices.csv` (DD07 Dynamics June/July/September; ~1,700 DD07 and ~10,000 AR00 Status for September; June Status republished in 1.16.0; 1.16.0 says August DOW Dynamics "meet the expected record counts"). The suspected August DOD separations and February VA notices are labelled as the project's own inference, not OPM's. That is the right way to present them.
- Pew (https://www.pewresearch.org/short-reads/2026/03/13/federal-workforce-shrank-10-in-trumps-first-year-back-in-office/): chart data confirm 2,074,649 headcount (Dec 2025), 116,912 hires, 348,219 separations; text confirms -10.3%. The site's cross-check rows and its stated 1.6-4% gap are correct.

## Findings

### Critical
None.

### High

**H1. Headline excess ratios are over-precise relative to the labour-market term that drives their level.** Files: `docs/05-models.md` ("Why the quit rate", "b1 = 0.232 (SE 0.004)"); `web/app/mobility/page.tsx` section 02 and "How the model was chosen" text; `web/app/brief/page.tsx` finding 4; `exit_model.json` `labour_market`.
- b1 is fitted on 10 annual points, one regressor, with a Poisson-naive SE of 0.004. The model's own Pearson dispersion is 7.35 and the pandemic years dominate the variation (FY2020, 2021, 2022). A realistic SE is an order of magnitude larger. The "26% more exits per point" statement is shown with no interval.
- The test-year gain is 2.2% deviance (2.07 to 2.02), and test-year bias barely moves (10.0% to 9.9%). Yet the term raised FY2025 from 1.77 to 1.92 and FY2026 from 1.51 to 1.65 (documented only in `docs/05-models.md`, not on any page). The 95% intervals on the ratios (1.43-2.57) are built from overdispersion plus rolling-year model error and do not carry uncertainty in b0/b1 or in the quit-rate extrapolation.
- A reader of /mobility sees "1.92x" with no hint that the no-labour-market version is 1.77x.
- Source checked: BLS series above; model JSON.
- Fix: (a) refit b1 with a year-clustered or quasi-Poisson SE, or a leave-one-year-out range, and show it. (b) Add one sentence on /mobility and /methods: "Without the quit-rate adjustment the ratios are 1.77 and 1.12 (FY2025), 1.51 and 1.12 (FY2026)." (c) Fold b1 uncertainty into the ratio intervals, or state that they exclude it.

### Medium

**M1. Private quits as the signal for federal voluntary exits is defensible but under-explained, and the "sets each year's level" wording reads causal.** `web/app/mobility/page.tsx` ("The quit rate (BLS JOLTS, private sector...) sets each year's level"); `docs/05-models.md` "Why the quit rate".
- JOLTS "quits" excludes retirements (they sit in "other separations"), yet roughly half of federal voluntary exits are retirements (the DRP split on the page is 48% resignation, 51% retirement). The series is a proxy for outside-option demand, valid mainly for the quit share. The documented empirical fit (error falls in selection years; persistence alternative was worse) is the real justification.
- The "excludes federal separations, so DRP cannot leak" point is correct and good. A federal-government JOLTS quits series (JTS910000000000000QUR) exists but would carry DRP contamination, so rejecting it is sound; the docs do not say why it was not used.
- Fix: replace "sets" with "is scaled by", state that it is an outside-job-market proxy that does not model retirement behaviour, and add one line on why the federal JOLTS series was not used.

**M2. DOW missing-record counts are attached to the wrong streams.** `pipeline/notices.py:88` (`records_missing` parser); rendered on /d/DOD/ and /brief/. Source: OPM release notes 1.14.0 and 1.17.0.
- 1.14.0: ~6,211 missing records are June 2026 **Status** (headcount). June Dynamics (hires/separations) files were missing separately and uncounted. The page prints "June 2026, Department of War hires, separations: about 6,211". 1.16.0 later resolved those Status gaps.
- 1.17.0: ~1,700 are DD07 **Dynamics** and ~10,000 are AR00 **Status**. The page prints "hires, headcount, separations: about 11,700" as one lump.
- Fix: carry a per-stream count (hires/separations 1,700; headcount 10,000), and show no count for June hires/separations, since OPM gave none.

**M3. "Department of War" versus "Department of Defense" is not explained.** `/d/DOD/` header and `/brief/` use "Department of Defense" for the scope, while notices use OPM's "Department of War (DOW)". No page text or `context.md` entry connects them. A reader may think these are two entities. OPM's own banner uses "Department of War".
- Fix: add a methods or definitions line, e.g. "OPM now labels this department's data providers 'Department of War' (secondary title adopted Sept 2025); statutory name remains Department of Defense; this site uses the code DOD." I am recalling the September 2025 executive action from memory and did not open it this session, so cite the primary source (whitehouse.gov or Federal Register) before publishing.

**M4. DRP totals are not reconciled on the page.** /mobility says "98,804 were deferred resignations" in FY2025, and /methods cross-checks cite OPM's 141,084. The gap (FY2026 Oct-Dec retirement-eligible DRP plus later agency-specific DRPs; OPM's page now says the additional actions are agency-specific DRPs) is explained nowhere. Also, the FY2026 "excluding DRP" ratio (1.22) mixes the 2025 program's tail with FY2026 agency-specific agreements, which OPM says are processed through a different mechanism.
- Fix: one sentence next to 98,804: "OPM's 141,084 spans FY2025 and FY2026 and includes retirement-eligible and agency-specific DRP actions." Also note that the 168,675 "without DRP" figure removes voluntary DRP only (266,861 - 168,675 = 98,186, not 98,804).

### Low

**L1. FY2026 labour-market value uses a preliminary BLS observation and one-decimal data.** Sep 2026 is `P`; JOLTS is revised. The FY mean is an unweighted mean of rounded monthly values. Fix: record the vintage date in `labour_market` and say FY2026 will move on revision.

**L2. "within the model's normal error" (/mobility, 1.21x).** Accurate (interval 0.90-1.63 includes 1) but can be read as "no excess". Departments differ (CM 1.91x, DJ 1.59x, EP 1.41x excluding DRP while DOD is 0.97x). Fix: "consistent with 1.0, but several departments sit well above it".

**L3. Pew gap wording.** "Pew used earlier file versions" is an inference that the page already labels as unconfirmed. Keep it that way.

**L4. Hiring-freeze entry.** `context.ts` POLICY does not record that EO 14356 replaced the freeze memoranda; `context.md` does. Minor consistency.

## What blocks 9+

1. H1: honest uncertainty on b1 and the sensitivity (1.77x versus 1.92x) shown on the page, not only in a docs file.
2. M1: reframe the quit-rate term as an outside-market proxy that does not capture retirement, with the federal-series rejection explained.
3. M2/M3/M4: correct the per-stream missing-record counts, explain the Defense/War naming, and reconcile 98,804 with 141,084.

With these, I would score 9.0 to 9.2. The policy, coverage and cross-check layers already look 9-grade.
