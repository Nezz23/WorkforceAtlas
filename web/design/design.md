# Design

**Why (the visitor):** "What happened to the federal workforce, how sure are we, and where is it going?" A hiring
manager reads it as: can this person turn messy public data into a decision-grade product?

## System
- Ground `--paper` warm off-white; one surface step; hairline rules (`--rule`), no shadows, radius 2px (inputs only).
- Type: Newsreader 400/500 for h1/h2 and lead sentences; Public Sans 400/500/600 for everything else, `tnum` on.
  Scale (px): 12 · 14 · 16 · 22 · 34 (5 sizes). Weights 400/500/600.
- Grid: 12 columns, max 1200px, 32px gutters; section rhythm 96px desktop / 56px mobile.
- Trust marks (small caps label, never colour alone): OBSERVED solid; DERIVED hatched 45°; MODELED dashed + band.
- Motion: 160ms ease-out on hover/state; chart lines draw once (400ms) on first view; reduced motion = end frame.

## Pages (each a story; ask lines mapped)
1. **Brief** "interactive intelligence report": masthead (edition month, data-as-of), lead in serif from facts,
   four figures in a ruled strip (no cards), then numbered chapters: 1 Shape (headcount since 2012, range buttons,
   annotated DRP month), 2 Shock (September exits vs 2012–24 range), 3 Who moved (department slope ranking, click →
   profile), 4 Replacement (hires vs exits). Each chapter: kicker, serif headline = finding, one chart, method note.
2. **Mobility**: exit wave by type (stacked monthly, DRP split), who left (FY rate dot plot with CIs by service,
   age, grade, supervisory; FY2025 vs FY2013–24 range), experience lost by occupation (ranked bars).
3. **Planning**: net flow (diverging monthly bars), hires by appointment type (stacked area), retirement-exposure
   proxy (line, labelled lower bound), replacement ratio by department. Forecast: "Modeled in Phase 5" note, no line.
4. **Compensation**: coverage story (observed vs observed+derived over time), GS grade ladder (observed solid vs
   derived hatched), locality uplift by department.
5. **Methods**: definitions, trust marks, reconciliation chart, checks/warnings from manifest, limitations.
6. **Department** `/d/[code]`: same chapters, one department, with comparison to government-wide.

Distinct forms across pages: line, stacked area, dot plot with whiskers, slope/rank, diverging bars, ranked bars,
hatched comparison bars. No form repeats on one page.
