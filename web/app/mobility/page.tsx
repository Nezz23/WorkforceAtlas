import type { Metadata } from "next";
import { Alerts } from "@/components/Alerts";
import { DotRanges, Dumbbells, RankedBars } from "@/components/charts/Rows";
import { StackedArea } from "@/components/charts/StackedArea";
import { Survival } from "@/components/charts/Survival";
import { DataTable } from "@/components/DataTable";
import { Switcher } from "@/components/Switcher";
import { Chapter, Figure, Legend, Masthead } from "@/components/ui";
import { anomalyModel, exitModel, facts, kpi, occupations, retentionModel, scopes, segments } from "@/lib/data";
import { CATEGORY, separationMix } from "@/lib/derive";
import { compact, fyOf, int, monthName, pct1, titleCase } from "@/lib/format";
import { segmentRows, standout } from "@/lib/segments";

export const metadata: Metadata = { title: "Mobility & Retention" };

// One strong comparison (the pre-2020 baseline, in ink) against FY2025 (rose); every other period is quiet grey.
const PERIOD_COLORS: Record<string, string> = {
  "FY2015–2019": "var(--ink)", "FY2020–2021": "var(--rule-strong)", "FY2022–2024": "var(--rule-strong)",
  "FY2025": "var(--c-rif)", "FY2026": "var(--rule-strong)",
};
const FEATURE_NAMES: Record<string, string> = {
  age_bracket: "Age", los_band: "Length of service", grade_band: "Grade", dept: "Department", supervisor: "Supervisory status",
};

export default function Mobility() {
  const f = facts();
  const rows = kpi();
  const seg = segments();
  const latestFy = Math.max(...seg.map((s) => s.fy));
  const fy = (y: number) => rows.filter((r) => fyOf(r.month) === y);
  const sum = (rs: typeof rows, g: (r: (typeof rows)[0]) => number) => rs.reduce((s, r) => s + g(r), 0);
  const sep24 = sum(fy(2024), (r) => r.separations), sep25 = sum(fy(2025), (r) => r.separations), drp25 = sum(fy(2025), (r) => r.sep_drp);
  const drpQuit = sum(rows, (r) => r.sep_drp_quit), drpRet = sum(rows, (r) => r.sep_drp_retirement), drpAll = sum(rows, (r) => r.sep_drp);
  const top = standout(seg, 2025)!;
  const areaRows = rows.filter((r) => r.month >= 201201).map((r) => ({ t: r.month, ...separationMix(r) }));
  const fmtRate = (v: number) => `${v.toFixed(1)}%`;

  const names = new Map(scopes().map((s) => [s.code, titleCase(s.name)]));
  const em = exitModel();
  const ex = (y: number) => em.excess.filter((e) => e.fy === y && e.dept !== "ALL").sort((a, b) => b.ratio - a.ratio);
  const all25 = em.excess.find((e) => e.fy === 2025 && e.dept === "ALL")!;
  const all26 = em.excess.find((e) => e.fy === 2026 && e.dept === "ALL");
  const dev = em.deviance.test_mean;
  const oldest = em.explanation.find((r) => r.feature === "age_bracket" && r.level === "65 OR MORE")!;
  const newest = em.explanation.find((r) => r.feature === "los_band" && r.level === "<1")!;
  const inRange = (e: typeof all25) => e.ratio_excl_drp_lo <= 1 && e.ratio_excl_drp_hi >= 1;
  const testBias = em.by_year.filter((r) => r.model === em.chosen && em.test_years.includes(r.fy));
  const maxImp = Math.max(...em.importance.map((i) => i.increase));

  const ret = retentionModel().tables.ALL;
  const five = (p: string) => ret[p]?.survival[5];
  const an = anomalyModel();
  const recent = an.alerts_recent.filter((a) => a.severity).slice(0, 10);

  const occ = occupations().filter((o) => o.fy === 2025).sort((a, b) => b.experience_lost_years - a.experience_lost_years);
  const exp24 = f("experience_lost_fy2024"), exp25 = f("experience_lost_fy2025");

  return (
    <>
      <Masthead kicker="Mobility & Retention"
        title="Who left, how far beyond normal, and how long people stay."
        lead={<p>Agencies processed {int(sep25)} separations in fiscal year 2025, against {int(sep24)} the year before;
          {" "}{int(drp25)} were deferred resignations, of {int(drpAll)} processed to {monthName(rows[rows.length - 1].month)}. A model of normal exit patterns, trained on 2015–2024, expected
          {" "}{int(all25.expected)} voluntary exits in FY2025. There were {int(all25.actual)}; without deferred resignations,
          {" "}{int(all25.actual - all25.drp)} (the model counts the {int(all25.drp)} deferred resignations whose age and service are reported).</p>}
        contents={[{ id: "wave", label: "The exit wave" }, { id: "beyond", label: "Beyond the norm" }, { id: "who", label: "Who left" },
          { id: "drivers", label: "What drives exits" }, { id: "stay", label: "How long people stay" }, { id: "experience", label: "Experience lost" }]} />

      <Chapter n={1} kicker="The exit wave" id="wave"
        title={<>Deferred resignations were {pct1(100 * drpQuit / drpAll)} resignations and {pct1(100 * drpRet / drpAll)} retirements.
          {" "}{pct1(100 * (rows.find((r) => r.month === 202509)?.sep_drp ?? 0) / drpAll)} were processed in September 2025.</>}>
        <Figure kind="observed" question="What kinds of separation make up each month?"
          answer="Monthly separations by type since 2012. Deferred resignations form their own band, whatever their formal category."
          note={<>“Other” includes deaths and disability retirement. Transfers between agencies are excluded. Months are when OPM processed the action; {pct1(f("late_actions_pct").value)} of hire and exit records took effect earlier.</>}
          aside={<DataTable caption="Monthly separations by type"
            columns={[{ key: "m", label: "Month" }, ...CATEGORY.map((c) => ({ key: c.key, label: c.label, num: true }))]}
            rows={[...areaRows].reverse().map((r) => ({ m: monthName(r.t), ...Object.fromEntries(CATEGORY.map((c) => [c.key, int(r[c.key])])) }))} />}>
          <Legend items={CATEGORY.map((c) => ({ label: c.label, color: c.color }))} />
          <StackedArea label="Monthly separations by type since January 2012" yFormat="compact" height={340}
            keys={CATEGORY.map((c) => ({ ...c }))} rows={areaRows} />
        </Figure>
      </Chapter>

      <Chapter n={2} kicker="Beyond the norm" id="beyond"
        title={<>Voluntary exits ran {all25.ratio.toFixed(2)} times their expected level in FY2025. Without deferred resignations they ran
          {" "}{all25.ratio_excl_drp.toFixed(2)} times{inRange(all25) ? ", within the model’s normal error" : ""}
          {all26 ? <>; in FY2026, {all26.ratio.toFixed(2)} and {all26.ratio_excl_drp.toFixed(2)}</> : null}.</>}>
        <Figure kind="modeled" question="How far did each department's voluntary exits depart from its normal pattern?"
          answer={<>Actual voluntary exits divided by the number a model of FY2015–2024 patterns expected, given each department’s mix
            of age, service, grade and supervisory roles and that year’s private-sector quit rate. 1.00 means exits ran as the structure predicts. The hollow dot leaves deferred
            resignations out; the arrow puts them in.</>}
          note={<>The truth sits between the two: some people who took deferred resignation would have retired or quit anyway. 95% intervals
            (in the tooltip and table) combine overdispersion (dispersion {em.dispersion.toFixed(1)}) with the model’s own error in normal years,
            so they are wide. The expectation also scales with the private-sector quit rate, a proxy for outside job options that was low
            in 2025–2026; without that adjustment the FY2025 ratios are {all25.ratio_no_level.toFixed(2)} and {all25.ratio_excl_drp_no_level.toFixed(2)}.
            In its test years the model’s total was off by {testBias.map((r) => `${r.bias_pct > 0 ? "+" : ""}${r.bias_pct.toFixed(0)}% (FY${r.fy})`).join(" and ")}.
            Departments under 5,000 employees are pooled as “All other departments”.</>}>
          <Switcher label="Fiscal year" options={[2025, 2026].filter((y) => ex(y).length).map((y) => ({
            label: `FY${y}`,
            content: <>
              <Dumbbells label={`Actual to expected voluntary exits by department, FY${y}, excluding and including deferred resignations`} format="ratio"
                colorUp="var(--accent)" colorDown="var(--accent)" labelWidth={300}
                legend={{ from: "Excluding deferred resignations", to: "All voluntary exits" }}
                rows={ex(y).map((e) => ({
                  key: e.dept, label: e.dept === "OTHER" ? "All other departments" : names.get(e.dept) ?? e.dept, from: e.ratio_excl_drp, to: e.ratio,
                  href: e.dept === "OTHER" ? undefined : `/d/${e.dept}/`,
                  tip: <><div className="font-semibold mb-1">{e.dept === "OTHER" ? "All other departments" : names.get(e.dept)}, FY{y}</div>
                    <div className="row"><span>Voluntary exits</span><span className="font-medium">{int(e.actual)}</span></div>
                    <div className="row"><span>of which deferred resignation</span><span>{int(e.drp)}</span></div>
                    <div className="row"><span>Expected</span><span>{int(e.expected)}</span></div>
                    <div className="row"><span>Ratio, all (95%)</span><span>{e.ratio.toFixed(2)} ({e.ratio_lo.toFixed(2)}–{e.ratio_hi.toFixed(2)})</span></div>
                    <div className="row muted"><span>Ratio, excl. DRP (95%)</span><span>{e.ratio_excl_drp.toFixed(2)} ({e.ratio_excl_drp_lo.toFixed(2)}–{e.ratio_excl_drp_hi.toFixed(2)})</span></div></>,
                }))} />
              <DataTable caption={`Actual to expected voluntary exits, FY${y}`}
                columns={[{ key: "d", label: "Department" }, { key: "a", label: "All", num: true }, { key: "ai", label: "95% interval", num: true },
                  { key: "n", label: "Excl. DRP", num: true }, { key: "ni", label: "95% interval", num: true }]}
                rows={ex(y).map((e) => ({ d: e.dept === "OTHER" ? "All other departments" : names.get(e.dept) ?? e.dept, a: e.ratio.toFixed(2),
                  ai: `${e.ratio_lo.toFixed(2)}–${e.ratio_hi.toFixed(2)}`, n: e.ratio_excl_drp.toFixed(2), ni: `${e.ratio_excl_drp_lo.toFixed(2)}–${e.ratio_excl_drp_hi.toFixed(2)}` }))} />
            </>,
          }))} />
        </Figure>
        <div className="mt-14">
          <h3 className="t-small font-semibold">Recent signals</h3>
          <p className="t-small text-ink-2 mt-1 mb-5 measure">Months in the last two years when a flow sat far outside its usual range
            for that month. The threshold flags {an.calm_flag_rate.toFixed(1)}% of months in 2017–2019 and flagged {an.holdout_flag_rate.toFixed(1)}%
            in 2022–2024, years it was not set on. Months OPM reports incomplete are not signals.</p>
          <Alerts alerts={recent} empty="No unusual months in the last two years." preliminaryFrom={an.latest - 1} />
        </div>
      </Chapter>

      <Chapter n={3} kicker="Who left" id="who"
        title={<>{top.who} separated at {fmtRate(top.rate)} in FY2025, {top.x.toFixed(1)} times their highest rate in any year from 2013 to 2024.</>}>
        <Figure kind="observed" question="Which groups separated at unusual rates?"
          answer="Separations in the fiscal year as a share of the group’s average headcount, against the group’s own range over FY2013–2024."
          note="Age is published in five-year brackets. Length of service includes prior federal and creditable military service.">
          <Switcher label="Fiscal year" options={[2025, latestFy].filter((y, i, a) => a.indexOf(y) === i).map((y) => ({
            label: `FY${y}`,
            content: <DotRanges label={`Separation rate by group, fiscal year ${y}`} format="pct0" color="var(--accent)"
              rangeLabel="FY2013–2024 range" rows={segmentRows(seg, y, fmtRate)} labelWidth={200} />,
          }))} />
        </Figure>
      </Chapter>

      <Chapter n={4} kicker="What drives exits" id="drivers"
        title={<>In normal years, {FEATURE_NAMES[em.importance[0].feature].toLowerCase()} and {FEATURE_NAMES[em.importance[1].feature].toLowerCase()} carry
          most of the model’s power to tell high-exit groups from low ones.</>}>
        <div className="grid grid-cols-12 gap-x-12 max-lg:gap-x-0 gap-y-10">
          <div className="col-span-5 max-lg:col-span-12">
            <h3 className="t-small font-semibold">What the model leans on</h3>
            <p className="t-small text-ink-2 mt-1 mb-5">Loss of accuracy on FY2024 when each feature is scrambled. Longer bars matter more.</p>
            <ul className="space-y-3">
              {em.importance.map((i) => (
                <li key={i.feature} className="grid grid-cols-[140px_1fr] items-center gap-3 t-small">
                  <span className="text-ink-2">{FEATURE_NAMES[i.feature]}</span>
                  <span className="h-2 bg-accent" style={{ width: `${(100 * i.increase) / maxImp}%` }} />
                </li>
              ))}
            </ul>
          </div>
          <div className="col-span-7 max-lg:col-span-12">
            <h3 className="t-small font-semibold">How the model was chosen and tested</h3>
            <dl className="mt-3 t-small grid grid-cols-[1fr_auto] gap-x-6 border-t border-rule">
              {([["Department average (baseline)", dev.baseline, "baseline"], ["Poisson regression", dev.glm, "glm"], ["Gradient boosting", dev.gbm, "gbm"],
                ["Gradient boosting with the quit rate", dev.gbm_lm, "gbm_lm"]] as const).map(([n, v, k]) => (
                <div key={n} className="contents">
                  <dt className={`py-2 border-b border-rule ${k === em.chosen ? "font-semibold" : "text-ink-2"}`}>{n}</dt>
                  <dd className="py-2 border-b border-rule text-right tabular-nums">{v.toFixed(2)}</dd>
                </div>
              ))}
            </dl>
            <p className="t-micro text-ink-3 mt-3">Mean Poisson deviance in FY{em.test_years.join(" and FY")}, each predicted by models fitted only on earlier years;
              lower is better. The model was chosen on FY{em.select_years[0]}–{em.select_years[em.select_years.length - 1]} the same way. It cuts the baseline’s error by
              {" "}{em.gain_vs_baseline_test_pct.toFixed(0)}%, but its predicted totals still missed by {testBias.map((r) => `${r.bias_pct > 0 ? "+" : ""}${r.bias_pct.toFixed(0)}%`).join(" and ")}:
              it ranks groups well and gets the overall level less well. Each year’s level is adjusted by the private-sector quit rate
              (BLS JOLTS), a proxy for outside job options: a rate one percentage point higher went with {((Math.exp(em.labour_market.b1) - 1) * 100).toFixed(0)}% more
              voluntary federal exits, an association across ten years. JOLTS quits leave out retirements, and the federal JOLTS series was not used
              because it counts the very exits being explained, deferred resignations included.</p>
            <p className="t-small text-ink-2 mt-6 measure">In the {em.chosen === "glm" ? "regression" : "gradient-boosting"} model, with every other feature held at its
              observed mix, employees 65 or older leave at {oldest.rate_ratio.toFixed(1)} times the rate of 40–44-year-olds, and those in their first year of service
              at {newest.rate_ratio.toFixed(1)} times the rate of those with 10–19 years. These are associations, not causes.</p>
          </div>
        </div>
      </Chapter>

      <Chapter n={5} kicker="How long people stay" id="stay"
        title={<>At FY2025 exit rates, {five("FY2025")!.v.toFixed(0)}% of new federal employees would still be in service after five years.
          At 2022–2024 rates, {five("FY2022–2024")!.v.toFixed(0)}% would.</>}>
        <Figure kind="modeled" question="How long do new federal employees stay?"
          answer="The share of a group of new employees still in federal service after each year, if they met one period’s exit rates at every stage of service."
          note={<>A period life table: no individual is followed, because the data has no person identifier. The first year includes
            seasonal and temporary appointments, which end by design. Intervals reflect count noise only ({retentionModel().draws.toLocaleString()} bootstrap draws).</>}>
          <Survival label="Share of new federal employees still in service by years since hire, by period of exit rates"
            curves={Object.entries(ret).map(([p, t]) => ({ key: p, label: p, color: PERIOD_COLORS[p], points: t.survival, emphasis: p === "FY2025", compare: p === "FY2015–2019" }))} />
        </Figure>
      </Chapter>

      <Chapter n={6} kicker="Experience lost" id="experience"
        title={<>People who left in FY2025 took {compact(exp25.value)} years of federal service with them, {(exp25.value / exp24.value).toFixed(1)} times the year before.</>}>
        <Figure kind="observed" question="Which occupations lost the most experience?"
          answer="Total years of service held by the people who separated in FY2025, by occupational group."
          note="Years of service count all creditable federal civilian and military service, not time in the current job."
          aside={<DataTable caption="Experience lost by occupational group, FY2025"
            columns={[{ key: "g", label: "Occupational group" }, { key: "s", label: "Separations", num: true }, { key: "y", label: "Years of service", num: true }, { key: "a", label: "Average", num: true }]}
            rows={occ.map((o) => ({ g: titleCase(o.name ?? o.occ_group), s: int(o.separations), y: int(Math.round(o.experience_lost_years)), a: (o.experience_lost_years / Math.max(1, o.separations)).toFixed(1) }))} />}>
          <RankedBars label="Years of federal service lost by occupational group, FY2025" format="compact" color="var(--teal)" labelWidth={320}
            rows={occ.slice(0, 10).map((o) => ({
              key: o.occ_group, label: titleCase(o.name ?? o.occ_group).replace(/ Group$/, ""), value: o.experience_lost_years,
              tip: <><div className="font-semibold mb-1">{titleCase(o.name ?? o.occ_group)}</div>
                <div className="row"><span>Separations</span><span>{int(o.separations)}</span></div>
                <div className="row"><span>Average service</span><span className="font-medium">{(o.experience_lost_years / Math.max(1, o.separations)).toFixed(1)} years</span></div></>,
            }))} />
        </Figure>
      </Chapter>
    </>
  );
}
