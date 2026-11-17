# Workforce Atlas: product design re-audit (2026-11-17)

Shots: scratchpad/reaudit/design/ (abbrev. D/). Own captures at 375, 834, 1440, light and dark. Zero horizontal overflow observed.

## Score: 8.6 / 10 (was 8.0)

The three First-audit High findings are fixed, and the Medium list mostly closed. What is left is density and polish rather than structural bugs. The new caveat-heavy copy is honest but is now the main threat to the editorial feel: a non-expert gets four "Department of War" notice lines before the first number, and Methods ch. 2 is the densest page on the site.

## 1. First-audit findings

| # | Status | Evidence |
|---|---|---|
| H1 tablet nav | Resolved | D/home-834-light-0.png: all five links visible, Search + theme on row 1, nav on its own row below |
| H2 phone simulator | Resolved | D/sim-phone-light-b-drag.png, sim-phone-dark-a.png: chart + 3 KPIs are sticky under the header (`.lab-panel`, globals.css:214), sliders scroll under it, 190px chart on phones. Cost: the panel takes ~37% of an 812px viewport and covers the label of the slider being dragged (see N6) |
| H3 survival labels | Partly | D/mob-stay-1440-dark.png: no clipping, labels de-collided. But five similar categorical hues remain (blue/teal/violet vs gold/rose), the grey-baseline fix was not adopted, labels are nudged off their curves (FY2025 label sits at ~17% while the line ends at 24%) and a vertical "cliff" leader at 10y reads like data. On phone (D/mob-stay-375-light.png) there are no end labels, only a legend of near-identical hues |
| M1 chart right edges | Resolved (mostly) | Mobility/home charts now end at 1272 vs grid 1288 consistently (D/mob-1440-light-440.png, home-shape-light.png); Planning plot sits inside its column |
| M2 KPI baselines | Partly | Brief OK (D/home-top-light.png, 834 shot). Compensation still mixed: lead "52.9%" serif and larger, siblings sans and smaller, so figures do not share a baseline; DERIVED badge now wraps under its label (D/comp-1440-light-0.png) |
| M3 repetitive/weak charts | Partly | Mobility 01 now has Counts/Share toggle; lollipops varied into an arrow chart and a range/dot plot (D/mob-1440-light-1280.png, -3420.png). Compensation 01 now shades the 57.5% to 99.8% gap, which tells the story, but is still three near-flat lines |
| M4 dumbbell legend | Resolved | D/home-departments-dark.png: "Better/Worse than the year before" swatches |
| M5 phone tables | Resolved | D/table-phone-planning.png: edge-shadow scroll wrapper, nowrap headers, scrollWidth 488 in 343. "Forecast" label no longer clipped |
| M6 select | Resolved | D/plan-1440-light-300.png: custom chevron, hairline border |
| M7 slider baseline | Resolved | Tick below each thumb marks 100% (same shot) |
| L1 tap targets | Partly | Table/CSV links 24px desktop, 32px phone (measured); 44px not reached |
| L2 header opacity | Resolved | Computed background solid, backdrop-filter none |
| L3 lollipop tooltip | Not re-verified | Hover shots missed the marker (headless coordinates); treat as unchanged |
| L4 memo no chart | Resolved | D/memo-1440-light-0.png: headcount + forecast chart added |
| L5 orphan headline | Resolved | h1 `text-wrap: balance`; D/comp-1440-light-0.png |
| L6 detached TOC | Open (accepted) | TOC still floats at x~930 beside the standfirst (D/home-top-light.png); acceptable, low value |

## 2. New problems

### Medium
- **N1. Methods ch. 2 is a wall.** D/m2-1440-light-810.png: "Who is in the data" opens with one 8-line paragraph of acronyms (USPS, CIA, NSA, DIA, NGA, ODNI, TVA, CFPB, PHS) and two more list-paragraphs; a non-expert cannot find "what is missing that matters". Lead each item with a bold plain claim ("Excluded: postal, intelligence, most legislative/judicial staff") and push the agency lists into a collapsed details row. Left column is 7 items vs right 5, with an empty right half. File: app/methods/page.tsx (coverage section) and ui.tsx list primitives.
- **N2. "Our figures against OPM's" table is cramped.** D/m2-1440-light-2600.png: right-aligned numeric cells carry parentheticals ("-258,108 (accessions 250,147 minus separations 508,255)") that wrap into 5-line columns; the "Agree" column wraps "No official figure" in three lines. Move qualifiers to a notes row or a third text column, keep numbers single-line. Same file.
- **N3. Data notice box dominates the first screen.** D/home-top-light.png, home-834-light-0.png: a tinted, bordered, alert-like card with four near-identical "Department of War ..." lines pushes KPIs below the fold at 1440x900, and its wrapping is ragged (lines break at different widths, "gap." orphans). Collapse to one lead sentence + "3 earlier months" disclosure, drop the box fill (use a rule + label like other callouts). File: components/Notices.tsx.
- **N4. Share view y-axis runs to 120%.** D/mob-share-1440-dark.png: stack tops at 100% but the axis has a 120% gridline; black 1px area strokes look heavy in dark; DRP band in gold is hard to read at the bottom. Cap domain at 100%. File: components/charts/StackedArea.tsx.
- **N5. Forecast fan is jagged.** D/home-shape-light.png, plan-1440-light-300.png: 80/95% bands bump and dip irregularly (1.82M notches) and read as noise, not a widening cone. Smooth or monotonic-widen the band. File: charts/LineChart.tsx band path / forecast data.
- **N6. Phone sticky panel covers the control.** D/sim-phone-light-b-drag.png: while dragging the first slider its label and value are under the panel. Reduce chart to ~150px or scroll-margin the form so labels clear the panel. File: PlanningLab.tsx / globals.css:214.

### Low
- **N7. End label "Headcount/Observed 2,017,021" sits at the forecast end** (home-shape-light.png, memo chart): reads as a forecast value. Pin it at the observed end or drop it.
- **N8. Compensation KPI row inconsistent** (see M2). File: ui.tsx Stat/Kpi.
- **N9. "UNUSUAL" repeats on every signal row** (D/ in mobility signals list, tip-lolli.png): redundant label; the section title already says it.
- **N10. Timeline dates** use wide grey tabular figures (D/m2-1440-light-1800.png) that look like a different typeface from the serif/Public Sans pairing; also footnote copy such as "Ranges ... held 49% of outcomes ... short of 80%" (home-shape-light.png) is accurate but jargon; rephrase for a general reader ("our ranges were too narrow in 2025-26").
- **N11. Survival chart** hue convergence and label offsets (H3 residual).
- **N12. Tap targets** 32px on phone.
- Note: Data-notice numbers differed between two of my loads (13,400 at 834, 11,700 at 1440), so the data was rebuilt mid-audit; check no stale copy ships.

## Dark mode
Consistent: lifted chart hues, gold DRP held, notice box and tables fine (D/home-departments-dark.png, mph-375-dark-800.png). Only blemish is N4 outlines.

## AI-default check
Clean: no gradients, pills, icon cards. The tinted bordered notice box (N3) is the one component that looks like a stock alert.

## Summary (5 lines)
1. Score 8.6/10.
2. Counts: High 0, Medium 6 (N1-N6), Low 6 (N7-N12); first-audit: 13 Resolved, 4 Partly, 1 Open, 1 unverified.
3. Top 1: Methods ch.2 density (coverage paragraph and cross-check table).
4. Top 2: Data-notice box overwhelms the Brief first screen.
5. Top 3: Survival chart label and hue clarity, with Share axis (120%) and jagged forecast fan close behind.

Simplicity ✓
