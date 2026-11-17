import type { Metadata } from "next";
import { StackedColumns } from "@/components/charts/Columns";
import { LineChart } from "@/components/charts/LineChart";
import { RankedBars } from "@/components/charts/Rows";
import { Scatter } from "@/components/charts/Scatter";
import { DataTable } from "@/components/DataTable";
import { PlanningLab, type LabScope } from "@/components/PlanningLab";
import { Chapter, Figure, Legend, Masthead } from "@/components/ui";
import { exposure, facts, forecastModel, kpi, scopes } from "@/lib/data";
import { accuracy, METHOD_NAMES } from "@/lib/models";
import { last12, movers, rolling12 } from "@/lib/derive";
import { compact, fyOf, int, monthName, pct1, titleCase } from "@/lib/format";
import type { Kpi } from "@/lib/types";

export const metadata: Metadata = { title: "Planning & Forecasting" };

const HIRES = [
  { key: "competitive", label: "Competitive service", color: "var(--accent)" },
  { key: "excepted", label: "Excepted service", color: "var(--teal)" },
  { key: "ses", label: "Senior Executive Service", color: "var(--c-drp)" },
];

function rateRange(rows: Kpi[], gov: boolean): { hire: [number, number]; exit: [number, number] } {
  const h: number[] = [], x: number[] = [];
  rows.forEach((_, i) => {
    if (i < 12) return;
    const w = rows.slice(i - 11, i + 1);
    const avg = w.reduce((s, r) => s + r.headcount, 0) / 12;
    h.push((100 * w.reduce((s, r) => s + (gov ? r.acc_new_hire : r.accessions), 0)) / avg);
    x.push((100 * w.reduce((s, r) => s + r.separations - r.sep_drp, 0)) / avg);
  });
  return { hire: [Math.min(...h), Math.max(...h)], exit: [Math.min(...x), Math.max(...x)] };
}

export default function Planning() {
  const f = facts();
  const rows = kpi();
  const latest = rows[rows.length - 1];
  const fm = forecastModel();
  const names = new Map(scopes().map((s) => [s.code, titleCase(s.name)]));

  const lab: LabScope[] = fm.scopes.map((code) => {
    const k = kpi(code);
    const fc = fm.forecasts[code];
    const w = k.slice(-12);
    const range = rateRange(k, code === "ALL");
    return {
      code, name: code === "ALL" ? "All departments" : names.get(code) ?? code,
      history: k.filter((r) => r.month >= 201901).map((r) => ({ t: r.month, v: r.headcount })),
      origin: { t: fc.origin, v: fc.headcount },
      forecast: fc.forecast, hires: fc.flows.hires, exits: fc.flows.exits, parts12: { hires: fc.flows.hires_12, exits: fc.flows.exits_12, other: fc.flows.other_12 },
      retirementShare: w.reduce((s, r) => s + r.sep_retirement, 0) / Math.max(1, w.reduce((s, r) => s + r.separations - r.sep_drp, 0)),
      hireRange: range.hire, exitRange: range.exit,
    };
  });
  const g12 = fm.forecasts.ALL.forecast[11];
  const gw = accuracy(fm), dp = accuracy(fm, "departments");
  const fixed = { gw: fm.intervals.scores_80.fixed["government-wide"].test.coverage.toFixed(0), dp: fm.intervals.scores_80.fixed.departments.test.coverage.toFixed(0) };
  const levels = [["government-wide", "Government-wide"], ["departments", "Departments"]] as const;
  const years = [...new Set(fm.wape_by_year_12m.map((r) => r.year))].sort();
  const yearErr = (lv: string, y: number) => fm.wape_by_year_12m.find((r) => r.level === lv && r.year === y)?.wape;

  const hires = rolling12(rows, (r) => r.acc_new_hire), exits = rolling12(rows, (r) => r.separations);
  const net = hires.map((h, i) => ({ t: h.t, v: h.v == null || exits[i].v == null ? null : exits[i].v! - h.v }))
    .filter((p): p is { t: number; v: number } => p.v != null);
  let run = 0;
  for (let i = net.length - 1; i >= 0 && net[i].v > 0; i--) run++;
  const repl = f("replacement_ratio_12m");

  const fys = [...new Set(rows.map((r) => fyOf(r.month)))].filter((y) => rows.filter((r) => fyOf(r.month) === y).length === 12);
  const byFy = fys.map((y) => {
    const w = rows.filter((r) => fyOf(r.month) === y);
    return { fy: y, competitive: w.reduce((s, r) => s + r.acc_competitive, 0), excepted: w.reduce((s, r) => s + r.acc_excepted, 0), ses: w.reduce((s, r) => s + r.acc_ses, 0) };
  });
  const lastFy = byFy[byFy.length - 1], prevFy = byFy[byFy.length - 3];
  const share = (r: (typeof byFy)[0]) => (100 * r.excepted) / (r.competitive + r.excepted + r.ses);

  const exAll = exposure().filter((e) => e.month % 100 === 9);
  const exNow = exAll[exAll.length - 1], ex12 = exAll[0];
  const big = movers(scopes());
  const exDept = big.map((d) => ({ ...d, e: exposure(d.code).find((x) => x.month === latest.month)! })).sort((a, b) => b.e.exposed_pct - a.e.exposed_pct);

  const scatter = big.map((d) => {
    const L = last12(kpi(d.code));
    return { ...d, rate: (100 * L.separations) / L.avgHeadcount, ratio: L.newHires / Math.max(1, L.separations) };
  });
  const labelled = new Set([...scatter].sort((a, b) => b.headcount - a.headcount).slice(0, 4).map((d) => d.code)
    .concat([...scatter].sort((a, b) => b.rate - a.rate).slice(0, 2).map((d) => d.code)));

  return (
    <>
      <Masthead kicker="Planning & Forecasting"
        title="Where the federal workforce is heading, and what would change it."
        lead={<p>The forecast for {monthName(g12.t)} is {compact(g12.v)}, with an 80% range of {compact(g12.lo80)} to {compact(g12.hi80)}
          (in testing, such ranges held {gw.coverage.test.toFixed(0)}% of outcomes).
          In 2023–2024, years not used to choose the method, it missed government-wide headcount a year ahead by {gw.test.toFixed(1)}% on average.
          Test your own assumptions below.</p>}
        contents={[{ id: "lab", label: "Forecast and scenarios" }, { id: "accuracy", label: "How accurate it is" },
          { id: "balance", label: "Hires against exits" }, { id: "mix", label: "Who is hired" },
          { id: "exposure", label: "Retirement exposure" }, { id: "departments", label: "Departments" }]} />

      <Chapter n={1} kicker="Forecast and scenarios" id="lab"
        title={<>Pick a department, read its forecast, then change hiring, exits or a one-time reduction to see the path move.</>}>
        <PlanningLab scopes={lab} />
      </Chapter>

      <Chapter n={2} kicker="How accurate it is" id="accuracy"
        title={<>In years not used to choose it, the forecast was off by {gw.test.toFixed(1)}% a year ahead government-wide and
          {" "}{dp.test.toFixed(1)}% for departments. In 2025–2026 the errors rose to {gw.shock.toFixed(1)}% and {dp.shock.toFixed(1)}%.</>}>
        <Figure kind="modeled" question="How far off was each method, forecasting only from the past?"
          answer={<>Every method was refit {fm.n_origins} times, each time using only data up to that quarter, from
            {" "}{monthName(fm.origins[0])} to {monthName(fm.origins[1])}. Error a year ahead, as a headcount-weighted mean absolute percentage.
            Forecasts made for 2022 and earlier chose the method; 2023–2024 tests it; 2025–2026 shows the shock.</>}
          note={<>Used: {gw.name.toLowerCase()} government-wide, {dp.name.toLowerCase()} for departments. A department counts from a quarter
            only if it had at least {int(fm.min_size)} employees then. The 80% ranges use only errors already seen at each point and widen after
            a run of misses (adaptive conformal inference, chosen on 2022 and earlier). They held {gw.coverage.test.toFixed(0)}% (government-wide)
            and {dp.coverage.test.toFixed(0)}% (departments) of 2023–2024 outcomes, against {fixed.gw}% and {fixed.dp}% for fixed ranges, and
            {" "}{gw.coverage.shock.toFixed(0)}% and {dp.coverage.shock.toFixed(0)}% in 2025–2026. The government total still falls outside too often:
            its misses come one year at a time, and two test years cannot teach a range how large the next one will be. After the
            2025–2026 misses the ranges have widened to their limit, and every department shares one pooled relative range, so a stable
            department’s range is as wide as one that was cut sharply in 2025.</>}
          aside={<DataTable caption="Forecast error a year ahead by target year"
            columns={[{ key: "y", label: "Target year" }, { key: "g", label: "Government-wide", num: true }, { key: "d", label: "Departments", num: true }]}
            rows={years.map((y) => ({ y, g: yearErr("government-wide", y)?.toFixed(1) + "%", d: yearErr("departments", y)?.toFixed(1) + "%" }))} />}>
          <div className="scroll-x" tabIndex={0} role="region" aria-label="Forecast error by method, scrollable table">
            <table className="data-table">
              <caption className="sr-only">Error a year ahead by method, level and evaluation window</caption>
              <thead>
                <tr><th scope="col" rowSpan={2}>Method</th>{levels.map(([, label]) => <th key={label} scope="colgroup" colSpan={3} className="num">{label}</th>)}</tr>
                <tr>{levels.map(([lv]) => ["Chose", "Test", "2025–26"].map((w) => <th key={lv + w} scope="col" className="num">{w}</th>))}</tr>
              </thead>
              <tbody>{fm.methods.map((mm) => (
                <tr key={mm}>
                  <td>{METHOD_NAMES[mm]}</td>
                  {levels.map(([lv]) => (["selection", "test", "shock"] as const).map((w) => (
                    <td key={lv + w} className={`num ${fm.chosen[lv] === mm ? "font-semibold" : ""}`}>{fm.wape[lv][w][mm]["12"]?.toFixed(1)}%</td>
                  )))}
                </tr>
              ))}</tbody>
            </table>
          </div>
          <p className="t-micro text-ink-3 mt-3">Bold: the method used at that level, chosen on the first column only.</p>
        </Figure>
      </Chapter>

      <Chapter n={3} kicker="Hires against exits" id="balance"
        title={run > 0
          ? <>Separations have outrun new hires for {run} straight months: {repl.value.toFixed(2)} hires per exit over the last year.</>
          : <>New hires have outrun separations over the last twelve months.</>}>
        <Figure kind="observed" question="How do hires and exits compare over rolling twelve-month windows?"
          answer="Each point sums the previous twelve months, which removes the seasonal September spike. Shading shows which side is larger."
          note="Transfers between agencies are excluded on both sides.">
          <Legend items={[{ label: "New hires", color: "var(--teal)" }, { label: "Separations", color: "var(--c-rif)" }]} />
          <LineChart label="Rolling twelve-month new hires and separations" yFormat="compact" valueFormat="int" height={320} zeroBased
            gap={["h", "s", "var(--teal)", "var(--c-rif)"]}
            series={[
              { key: "h", label: "New hires", color: "var(--teal)", points: hires.filter((p) => p.v != null) },
              { key: "s", label: "Separations", color: "var(--c-rif)", points: exits.filter((p) => p.v != null) },
            ]} />
        </Figure>
      </Chapter>

      <Chapter n={4} kicker="Who is hired" id="mix"
        title={<>Excepted-service appointments were {pct1(share(lastFy))} of new hires in FY{lastFy.fy}, against {pct1(share(prevFy))} in FY{prevFy.fy}.</>}>
        <Figure kind="observed" question="Through which kind of appointment do new hires enter?"
          answer="New hires per fiscal year by service. Competitive service is filled by open competition; excepted service uses other legal authorities."
          aside={<DataTable caption="New hires by fiscal year and appointment type"
            columns={[{ key: "y", label: "Fiscal year" }, { key: "c", label: "Competitive", num: true }, { key: "e", label: "Excepted", num: true }, { key: "s", label: "SES", num: true }]}
            rows={byFy.map((r) => ({ y: `FY${r.fy}`, c: int(r.competitive), e: int(r.excepted), s: int(r.ses) }))} />}>
          <Legend items={HIRES} />
          <StackedColumns label="New hires per fiscal year by appointment type" yFormat="compact" height={300} stacks={HIRES}
            columns={byFy.map((r) => ({ x: `’${String(r.fy).slice(2)}`, highlight: r.fy === lastFy.fy, values: r, note: `FY${r.fy}` }))} />
        </Figure>
      </Chapter>

      <Chapter n={5} kicker="Retirement exposure" id="exposure"
        title={Math.abs(exNow.exposed_pct - ex12.exposed_pct) < 1
          ? <>The share of the workforce near retirement has barely moved since 2012: {pct1(exNow.exposed_pct)} now, {pct1(ex12.exposed_pct)} then. It differs widely by department.</>
          : <>{pct1(exNow.exposed_pct)} of the workforce is near retirement, against {pct1(ex12.exposed_pct)} in 2012.</>}>
        <Figure kind="derived" question="How much of each department is near retirement?"
          answer={`Share of ${monthName(latest.month)} headcount aged 55+ with 30+ years of service, 60+ with 20+, or 65+ with 5+.`}
          note="A lower bound, not eligibility: age is published in five-year brackets, so the 62-and-5 rule is tested at 65, and retirement systems are not published.">
          <RankedBars label="Retirement-exposure share by department" format="pct0" color="var(--teal)" labelWidth={300}
            reference={{ value: exNow.exposed_pct, label: "All departments" }}
            rows={exDept.map((d) => ({ key: d.code, label: titleCase(d.name), value: d.e.exposed_pct, href: `/d/${d.code}/`,
              tip: <><div className="font-semibold mb-1">{titleCase(d.name)}</div>
                <div className="row"><span>Near retirement</span><span className="font-medium">{pct1(d.e.exposed_pct)}</span></div>
                <div className="row muted"><span>People</span><span>{int(d.e.exposed)} of {int(d.e.headcount)}</span></div></> }))} />
        </Figure>
      </Chapter>

      <Chapter n={6} kicker="Departments" id="departments"
        title={<>{scatter.filter((d) => d.ratio < 1).length} of {scatter.length} large departments hired fewer people than they lost over the last 12 months.</>}>
        <Figure kind="observed" question="Which departments are losing people fastest, and which are replacing them?"
          answer="Each circle is a department, sized by headcount. Right: more separations relative to size. Up: more new hires per separation."
          note="Department figures include transfers in and out, since a move between departments changes both."
          aside={<DataTable caption="Separation rate and replacement by department"
            columns={[{ key: "d", label: "Department" }, { key: "r", label: "Separation rate", num: true }, { key: "x", label: "Hires per separation", num: true }, { key: "h", label: "Headcount", num: true }]}
            rows={scatter.map((d) => ({ d: titleCase(d.name), r: pct1(d.rate), x: d.ratio.toFixed(2), h: int(d.headcount) }))} />}>
          <Scatter label="Separation rate against new hires per separation, by department" xLabel="Separations, % of headcount, last 12 months"
            yLabel="New hires per separation" xFormat="pct0" yFormat="ratio" yRef={{ value: 1, label: "Hires equal exits" }}
            dots={scatter.map((d) => ({ key: d.code, label: titleCase(d.name).replace(/^Department of (the )?/, ""), x: d.rate, y: d.ratio,
              size: d.headcount, href: `/d/${d.code}/`, labelled: labelled.has(d.code),
              tip: <><div className="font-semibold mb-1">{titleCase(d.name)}</div>
                <div className="row"><span>Separation rate</span><span>{pct1(d.rate)}</span></div>
                <div className="row"><span>Hires per separation</span><span className="font-medium">{d.ratio.toFixed(2)}</span></div>
                <div className="row muted"><span>Headcount</span><span>{int(d.headcount)}</span></div></> }))} />
        </Figure>
      </Chapter>
    </>
  );
}
