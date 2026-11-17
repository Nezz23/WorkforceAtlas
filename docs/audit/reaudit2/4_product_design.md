# Workforce Atlas: product design re-audit 2 (2026-11-17)

Shots in docs/audit/reaudit2/screens/ (full-page 1440 and 390 light/dark for /, /mobility/, /planning/, /compensation/, /methods/, /brief/, /d/VA|DOD|TR; 820 and 375 for the main pages; crops prefixed `crop-`). Own captures plus `node e2e/a11y.mjs` against the served build.

## Score: 8.7 / 10 (was 8.6)

Mechanically the build is clean: zero horizontal overflow on 7 pages at 820 and 375 (measured), 0 axe violations (WCAG 2.2 AA) on 7 pages in light and dark, no console errors in the 1440/390 shoot, tablet nav shows all five links. The new work is honest and mostly well placed. The one design problem it introduced is the Planning forecast band: it is legible as "wide and uncertain" but not as "80% vs 95%", and the legend, headline numbers and precision undercut it. Text density rose again. The score moves up only slightly because those two items are exactly where a Pew/FT editor would intervene.

## Findings

No Critical findings.

### High

**H1. Planning, section 01: the 80% and 95% bands are not distinguishable, and the legend does not say so.** Evidence: crop-planning-forecast-1440.png. The 95% band is a barely lighter sliver outside the 80% fill (a few px at the top and bottom of the right edge), the left edge is jagged (visible steps at roughly Dec 2026 to Mar 2027 on the lower bound), and the legend reads "Forecast, 80% and 95% ranges" with a single dashed-line swatch and no band swatches. A reader cannot tell which shade is which, or that the near-coincidence is a finding rather than a rendering bug (the explanation exists only in a paragraph 600px below in section 02). At 375 (crop-planning-sim-375-b.png) the band is a grey blob, the "Forecast" label sits on top of it, and the 1.60M gridline is clipped by it. Fix: add two band swatches to the legend ("80% range", "95% range"); draw the 95% as a 1px outline or dashed edge instead of a second near-identical fill; smooth or monotone-interpolate the bound series so steps do not read as data; add a one-line direct annotation on the chart at the right edge ("80%: 1.80M to 2.09M; 95% nearly the same") so the coincidence is explained where it is seen; link "Forecast, 80% and 95% ranges" to the section 02 note.

**H2. Planning hero and KPIs: false precision beside a +/-7% range.** Evidence: hero "forecast for August 2027 is 2,024,696, with an 80% range of 1.80M to 2.09M" (crop-planning-820.png) and KPI trio 2,024,832 / 2,024,696 / 2,024,560 (equal -136 steps, which reads as an artefact, not a forecast). Seven-digit exactness next to a 290,000-wide range is the pattern editors strike. The KPI row also shows no range at all, so the most-read numbers on the page drop the uncertainty that the page spent a section establishing. Fix: round the point estimate to the nearest 10,000 (about 2.02M) in hero, KPIs and the in-chart end label; show "80%: 1.80M to 2.09M" under the August 2027 and 2028 KPIs. Keep exact values in the data table.

### Medium

**M1. Text density keeps rising.** Planning section 02 (crop-planning-methods-1440.png and full page): a 3-line chart subtitle, a 4x6 table, a footnote paragraph of about 90 words and a second caption, all before the section 03 headline. Mobility section 04 holds a 4-row model table plus a 60-word paragraph about the gradient-boosting model next to the importance bars; Methods ch. 2 remains the densest page. For a non-expert recruiter this is the weakest editorial spot. Fix: move the coverage/quit-rate paragraphs into a collapsed "How to read this range" disclosure beside the chart; cap notes at about 40 words; keep one sentence per claim in the on-page body.

**M2. Planning method table: the "chosen method" convention is not legible.** Bold cells mark the method chosen per column, but the bold is subtle at 12px, differs by column (Hires minus exits bold in two columns, Exponential smoothing in the department block) and the key sentence is in the footnote. A reader sees four rows with scattered bold numbers. Fix: tint the chosen cell background and add a legend line directly above the table ("Shaded = method chosen on the first column's data"); consider also a "Chose / Test / 2025-26" header explainer for lay readers (Chose = used for picking the method).

**M3. Phone/tablet Planning chart height.** At 375 the plot is about 100px tall (crop-planning-sim-375-b.png) with a 1.60M to 2.40M axis, so the forecast fan, the very thing the page is about, occupies about 70px. At 820 the chart is about 140px (crop-planning-820.png) while the sliders sit below the fold, so tablet users cannot see cause and effect on one screen. Fix: 240px minimum height under 600px, and at 820 keep the two-column layout (chart left, sliders right) as at 1440, or make the chart sticky while sliders scroll (as on phones, sticky under the nav, which does work).

**M4. Mobility survival and exit-wave charts carry over from the last audit.** Exit-wave stacked area (mobility full page, section 01) is a flat band with a single September 2025 spike scaling the y axis, so 2012 to 2024 detail is unreadable (about 20px tall at 1440). Survival chart still uses five similar hues. Fix: cap the y axis with a broken-axis annotation or set a log/"excluding 2025" toggle; use grey for FY2013-2021 baselines and one highlight hue for FY2025.

**M5. Mobility "Who left" dot plot (section 03).** About 25 rows and three overlapping encodings (point, interval, grey range) with no row grouping fills in the page's centre; "Senior executive" and "30 years or more" dominate the axis to 50%, compressing the 10% to 20% range where the 20 other rows live. Fix: sort within group by value, add a "reference line at all-employees rate" and consider a log-ish or capped axis with the outliers labelled at the edge.

### Low

- L1. Phone nav: "Methods" is clipped at the right edge (crop-planning-sim-375-b.png). It is horizontally scrollable, but there is no fade or arrow cue; add a right-edge gradient or reduce to "Brief / Mobility / Planning / Pay / Methods".
- L2. Planning bubble chart (section 06): labels "Veterans Affairs" and "Defense" sit on top of overlapping bubbles; only 4 of 20 bubbles are named. Label bubbles beyond the top 5 on hover only is fine, but label placement should use leader lines.
- L3. Compensation KPI baseline mismatch (serif lead figure vs sans siblings) flagged last time was not re-checked as fixed; verify.
- L4. Tap targets: Table/CSV links remain below 44px (unchanged since the last audit).
- L5. Dark theme: charts hold up (no contrast failures in axe), but the grey forecast band loses separation from the grid in dark; test band-to-background contrast (3:1 non-text) there since axe does not check SVG fills.

## Improvements since the last audit
- Tablet nav and phone simulator (sticky panel) hold; 0 overflow across all tested pages and widths.
- Axe: 0 violations in light and dark on 7 pages.
- Uncertainty is now communicated honestly: wide adaptive intervals, hero states the 80% range, coverage and backtest table are in the page rather than only in Methods.
- The 4-row model comparison on Mobility is compact and aligned; the Planning method table is a clear structure (grouped headers, right-aligned figures, tabular numerals).
- Chart right-edge alignment, dumbbell legend, slider baseline tick, custom select all remain good.

## What blocks 9+
1. Make uncertainty a first-class visual (H1, H2): distinct, labelled bands; rounded point estimates with ranges beside every headline number.
2. Cut or fold the caveat prose (M1): the site reads as a methods paper with charts in it; best-in-class (FT, Pew, USAFacts) puts one sentence under a chart and everything else behind a disclosure.
3. Resolve the compressed small charts on phone/tablet (M3) and the two weak Mobility charts (M4, M5).
4. Close the carried-over polish items (L1, L3, L4, L5).
