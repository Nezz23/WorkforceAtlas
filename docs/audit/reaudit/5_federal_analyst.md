# Re-audit 5: Federal research (Workforce Atlas), 2026-11-17

Score: 8.3/10 (first audit 7.5). Sources opened live this session: OPM release notes, Workforce Changes, Fork page, WH July 2025 memo, WH EO 14356. Federal Register pages redirected to an unblock page, so FR-sourced rows (freeze, EO 14210, Schedule P/C) were NOT re-verified by me.

## 1. Spot-checks of context.ts
Confirmed against primary source: DRP closing 7:20 pm ET 12 Feb 2025; 141,084 DRP count and the "additional actions expected" wording; -258,108; 2025-07-07 memo (through 15 Oct 2025, department-head approval); EO 14356 date and Strategic Hiring Committee / Annual Staffing Plan; coverage list (copied from data-sources); DOW notice on Workforce Changes.
Findings:
- MEDIUM, EO 14356 effect text says it "Replaced the freeze memoranda". The order does not say that. It preserves prior OPM exemptions ("shall remain in effect unless withdrawn by OPM") and adds committee approval and staffing plans. Fix: "Required Strategic Hiring Committee approval and Annual Staffing Plans for filling vacancies; kept earlier OPM exemptions in effect." (context.ts POLICY row 2025-10-15; docs/reference/context.md.)
- LOW, July 2025 memo effect says "approved in writing by senior agency leadership". Page text I got says department heads approve with OPM notification; context.md says "department head, chief of staff or Presidential appointee". Align the two.
- LOW, policy rows mix dates (signing vs publication vs effective); the 2026-03-09 row uses the effective date while others use signing. The title carries both, acceptable, but state the convention.
- Wording otherwise neutral and descriptive. Good: "OPM is not directing agencies..." was kept in the doc but dropped from the site row; the site row says "determine whether to retain them", which is accurate.
- UNVERIFIED by me: FR rows, OMB M-27-01 (a post-cutoff doc), CPM 2025-14, the 3ff4a7e bulletin (undated; context.md says so honestly).

## 1b. data_notices.csv vs OPM release notes
- 1.13.0 (5 Aug): Status+Dynamics DD07/DD21/DD35 missing for June, about 83,000 records, expected through July. Matches the CSV description.
- 1.14.0 (2 Sep): June Dynamics still missing, July Dynamics missing. Matches.
- 1.16.0 (7 Oct): "June 2026 datasets were republished from EHRI Status", missing DOW records now included. Matches "202606 headcount resolved". Aug 2026 published with no gap noted. Matches.
- 1.17.0 (4 Nov): DD07 second Sept Dynamics file missing, about 1,700; AR00 Status about 10,000. Matches. OPM Workforce Changes says only Sept 2026 is affected.
- Defensible but inferred: June/July Dynamics stay "active" only because OPM is silent. OPM's current page names only September. The CSV note admits "not announced as received", but the site banner states "OPM reports the month incomplete" for June and July, which reads as a current OPM statement. Fix: "OPM last reported these files missing (release 1.14.0); no later notice."
- "about 12,422 records missing" for June is not an OPM figure (OPM gave 83,000 for status+dynamics; status was later restored). If derived from our own counts, say so; if from a release note I could not find, cite it. Page /, /d/DOD/, /brief/.
- "about 13,400" for Sept: OPM gives 1,700 + 10,000 = 11,700. 13,400 is unexplained. Verify; this is a number an OPM reader will check. (HIGH-MEDIUM, wrong unless derived.)
- August "suspected" row: honest and well labelled ("not announced by OPM ... treated as a probable reporting gap", Workforce Atlas review). Reasonable. But the CSV note says "all categories at once", with 1,325 vs 7,457; the alternative (a real change, or a data-processing change that moved separation coding) is not offered on the page. Fine, but the site banner should say "or a change in how DOW reports", not only "gap".

## 2. First-audit research findings
- H5 coverage exclusions: Resolved. Methods lists the full exclusion list with a source (rendered /methods/ and context.ts COVERAGE). Brief footnote not checked in detail.
- H6 policy timeline: Resolved for timeline (11 sourced rows on /methods/), DRP note corrected in verification.md. Partly: one row overstates EO 14356 (above). Original audit's "OPM probationary guidance 28 Apr 2025" was wrong; the new record correctly uses 20 Jan/4 Mar. Good self-correction.
- Probationary terminations not isolable: Resolved (stated on Methods, labelled as our inference in context.md; site text states it as fact, should say "in our reading of the data dictionary").
- SJ/SE not glossed: Partly. CODES gives OPM's own labels, definitions deliberately empty and "Not verified" recorded. Honest, but still open for users.
- Revision claim cites OPM: Resolved (Data Quality page cited; 2-6% revisions stated; sample still small).
- No OPM cross-check of -258,108: Resolved (CROSSCHECKS, match true; DRP 141,053 vs 141,084 honestly "No").
- Department net not comparable with government-wide: Partly. /planning/ says "Department figures include transfers"; /d/DOD/ says "including transfers to other agencies" but the profile headline compares DoD 9.7% against 10.6% government-wide without a caveat.
- Low wording ("tested on years not seen", causal "What would change it", "The 2025 shock"): Partly. "Months" backtest wording is now precise (chose/test split). "The 2025 shock" remains editorial; the "truth sits between the two" DRP sentence is a reasonable hedge.

## 3. New problems
- HIGH, DoD profile comparisons use incomplete data. /d/DOD/: "668,724 employees ... down 63,626 (-8.7%)" has no inline caveat (home does), though Sept headcount is missing about 10,000 Army records. The 12-month separation rate 9.7% vs 10.6% government-wide spans months where DOW separations are missing (Jun, Jul) or collapsed (Aug, Sep). It is biased low and reads as "DoD loses fewer people". Fix: suppress or footnote the rate and year-over-year change for DOW departments, or compute over complete months only; add "lower bound" language.
- HIGH, same issue for government-wide: 12-month separations 218K, 0.80 hires per exit, "17 straight months" include DOW gap months for hires and separations in both numerator and denominator. Home caveats headcount only. Add a caveat or compute on complete months.
- MEDIUM, naming: OPM now says "Department of War"; page title and department scope say "Department of Defense" with notices saying DOW. Add one line explaining that DoD and DOW are the same department in the data.
- MEDIUM, /planning/ forecast starts from August 2026 headcount while the Brief shows September: two "now" figures (2,024,832 vs 2,017,021) a reader will see as inconsistent. Explained in a note but not near the headline.
- MEDIUM, causal reach: "Without deferred resignations ... 1.12 times, within the model's normal error" and the DRP-excluded ratio assume non-DRP exits are unaffected by the DRP (pull-forward, retirement timing). The "truth sits between" line helps; also state that the expected level comes from a pre-2025 model.
- LOW, DRP counts: "141,084 DRP separations" vs ours 141,053 are both "processed actions", not participants; the doc says this, the site crosscheck row does not.
- LOW, "OPM reports ... missing" wording for July/June (above); "treated as a probable reporting gap" is fine.

## 4. Score and open list
Score 8.3. Strengths: primary-sourced, dated record; honest mismatch rows; "Not verified" list; reporting gaps never treated as signals.
Open: HIGH 2 (DoD/gov-wide aggregates over incomplete months), MEDIUM 4 (EO 14356 wording, unexplained 13,400 and 12,422, DoD/DoW naming, two headcount "now" figures, causal DRP framing counts as one), LOW 3.

Summary
1. Score 8.3/10 (was 7.5).
2. Counts: High 2, Medium 4, Low 3. First-audit research items: 4 Resolved, 4 Partly, 0 Open.
3. Top issue 1: DoD profile and government-wide 12-month rates and ratios include DOW gap months with no inline caveat.
4. Top issue 2: Notice figures "about 13,400" (OPM gives 1,700 + 10,000) and "about 12,422" are not traceable to OPM; June/July "OPM reports incomplete" rests on silence.
5. Top issue 3: EO 14356 described as having "replaced" the freeze memoranda; the order preserves their exemptions.
