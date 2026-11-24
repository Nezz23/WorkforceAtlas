import type { Metadata } from "next";
import Link from "next/link";
import { LineChart } from "@/components/charts/LineChart";
import { DotRanges } from "@/components/charts/Rows";
import { StackedArea } from "@/components/charts/StackedArea";
import { Chapter, Figure, Figures, Legend, Masthead } from "@/components/ui";
import { Alerts } from "@/components/Alerts";
import { DataNotices } from "@/components/Notices";
import { anomalyModel, exitModel, forecastModel, kpi, openNotices, pay, scopes, segments } from "@/lib/data";
import { accuracy } from "@/lib/models";
import { StackedColumns } from "@/components/charts/Columns";
import { CATEGORY, last12, separationMix } from "@/lib/derive";
import { compact, fyOf, int, monthName, pct1, signedInt, signedPct, titleCase } from "@/lib/format";
import { segmentRows, standout } from "@/lib/segments";

export const dynamicParams = false;
export function generateStaticParams() {
  return scopes().map((s) => ({ code: s.code }));
}
export async function generateMetadata({ params }: PageProps<"/d/[code]">): Promise<Metadata> {
  const { code } = await params;
  return { title: titleCase(scopes().find((s) => s.code === code)?.name ?? code) };
}

const KEYS = [...CATEGORY, { key: "transfer", label: "Transfer to another agency", color: "var(--c-transfer)" }];

export default async function Department({ params }: PageProps<"/d/[code]">) {
  const { code } = await params;
  const scope = scopes().find((s) => s.code === code)!;
  const name = titleCase(scope.name);
  const rows = kpi(code), gov = kpi();
  const latest = rows[rows.length - 1];
  const L = last12(rows), G = last12(gov), P = last12(rows, latest.month - 100);
  const yearAgo = rows.find((r) => r.month === latest.month - 100);
  const change = yearAgo ? latest.headcount - yearAgo.headcount : null;
  const p = pay(code).find((q) => q.month === latest.month && q.grade === "ALL");
  const seg = segments(code);
  const fy = Math.max(0, ...seg.map((s) => s.fy));
  const small = latest.headcount < 1000;
  const fm = forecastModel();
  const fc = fm.forecasts[code];
  const f12 = fc?.forecast[11];
  const acc = accuracy(fm, "departments");
  const notices = openNotices(code).filter((n) => n.month >= latest.month - 100);
  const an = anomalyModel();
  const signals = an.alerts_recent.filter((a) => a.scope === code && a.severity).slice(0, 6);
  const gaps = an.gaps_recent.filter((a) => a.scope === code && a.severity);
  const em = exitModel();
  const excess = [2025, 2026].map((y) => em.excess.find((e) => e.fy === y && e.dept === code)).filter((e) => e != null);
  // The largest one-month move in headcount: above 20% it is a reorganisation or reporting change, not attrition.
  const jump = rows.slice(1).map((r, i) => ({ t: r.month, pct: 100 * (r.headcount / rows[i].headcount - 1) }))
    .reduce((a, b) => (Math.abs(b.pct) > Math.abs(a.pct) ? b : a), { t: 0, pct: 0 });
  const step = Math.abs(jump.pct) >= 20 ? jump : null;
  const quiet = Math.max(...rows.slice(-36).map((r) => r.separations)) < 50;   // too few exits a month for a monthly chart
  const fys = [...new Set(rows.map((r) => fyOf(r.month)))].filter((y) => rows.filter((r) => fyOf(r.month) === y).length === 12);
  const fyMix = fys.map((y) => {
    const w = rows.filter((r) => fyOf(r.month) === y);
    const mix = w.map((r) => ({ ...separationMix(r), transfer: r.sep_transfer }));
    return Object.fromEntries(KEYS.map((k) => [k.key, mix.reduce((a, b) => a + (b as Record<string, number>)[k.key], 0)])) as Record<string, number> & { fy?: number };
  });
  const top = fy > 0 ? standout(seg, fy) : null;
  const sepRate = (x: ReturnType<typeof last12>) => (100 * x.separations) / x.avgHeadcount;

  return (
    <>
      <p className="pt-8 t-micro text-ink-3"><Link href="/" className="link">Brief</Link> <span aria-hidden>/</span> Department profile</p>
      <Masthead kicker="Department profile" title={name}
        lead={<p>{int(latest.headcount)} employees in {monthName(latest.month)}
          {notices.some((n) => n.month === latest.month && n.stream === "headcount") ? <> as reported (OPM says some records are missing, so the true figure is higher)</> : null}
          {change != null && yearAgo && <>, {change < 0 ? "down" : "up"} {int(Math.abs(change))} ({signedPct(100 * change / yearAgo.headcount)}) from a year earlier</>}.
          {" "}Its separation rate over the last 12 months was {pct1(sepRate(L))}, against {pct1(sepRate(G))} government-wide.</p>} />
      {notices.length > 0 && <div className="mb-10"><DataNotices notices={notices} /></div>}

      <Figures items={[
        { label: "Headcount", value: int(latest.headcount), detail: change != null ? `${signedInt(change)} in 12 months` : "No year-earlier data" },
        { label: "Separations, last 12 months", value: compact(L.separations), detail: `${pct1(sepRate(L))} of average headcount, vs ${pct1(sepRate(P))} a year earlier` },
        { label: "Of which deferred resignations", value: compact(L.drp), detail: L.separations ? `${pct1(100 * L.drp / L.separations)} of separations` : "—" },
        { label: "GS pay visible", value: p ? pct1(p.coverage_observed_pct) : "—", detail: p ? `${pct1(p.coverage_with_derived_pct)} with derived base pay` : "No GS employees", kind: "derived" },
      ]} />

      <Chapter n={1} kicker={fc ? "Shape and outlook" : "Shape"} id="shape" title={fc && f12
        ? <>The forecast puts {name} at {compact(f12.v)} in {monthName(f12.t)}, with an 80% range of {compact(f12.lo80)} to {compact(f12.hi80)}.</>
        : step
          ? <>{name}’s headcount moved {signedPct(step.pct)} in {monthName(step.t)} alone, a reorganisation or reporting change rather than people leaving.</>
          : <>{name} has {int(latest.headcount)} employees{change != null && yearAgo ? <>, {signedPct(100 * change / yearAgo.headcount)} in 12 months</> : null}; it is too small for a reliable forecast.</>}>
        <Figure kind={fc ? "modeled" : "observed"} question={`How has ${name}’s headcount changed, and where is it heading?`}
          answer={fc ? <>Observed headcount, then the 24-month forecast from {monthName(fc.origin)} with its 80% and 95% ranges, set from how far the
            method has missed for departments in every past year.</>
            : `Forecasts are made only for departments with at least ${int(fm.min_size)} employees.`}
          note={<>{fc ? <>For departments the forecast missed by {acc.test.toFixed(1)}% a year ahead in 2023–2024 and {acc.shock.toFixed(1)}% in 2025–2026; its
            ranges held fewer outcomes than they claim (see Planning). {fc.origin !== latest.month ? <>It starts from {monthName(fc.origin)}, the last month
            OPM reports complete here. </> : null}</> : null}Reorganisations move whole offices between departments; a sudden step in the line usually marks one.</>}>
          <LineChart label={`${name} headcount${fc ? " with forecast" : ""}`} yFormat="compact" valueFormat="int" height={300}
            windows={[{ label: "Since 2019", months: 96 }, { label: "Since 2012", months: null }]}
            divider={fc ? { t: fc.origin, label: "Forecast" } : undefined}
            annotations={step ? [{ t: step.t, label: `${signedPct(step.pct)} in one month` }] : []}
            series={[
              { key: "d", label: "Headcount", color: "var(--accent)", points: rows.map((r) => ({ t: r.month, v: r.headcount })) },
              ...(fc ? [{ key: "f", label: "Forecast", color: "var(--accent)", dashed: true, points: [{ t: fc.origin, v: fc.headcount, lo: fc.headcount, hi: fc.headcount, lo2: fc.headcount, hi2: fc.headcount },
                ...fc.forecast.map((q) => ({ t: q.t, v: q.v, lo: q.lo80, hi: q.hi80, lo2: q.lo95, hi2: q.hi95 }))] }] : []),
            ]} />
        </Figure>
      </Chapter>

      <Chapter n={2} kicker="Exits" id="exits" title={<>{int(L.separations)} separations in the last 12 months, {int(L.drp)} of them deferred resignations.</>}>
        <Figure kind="observed" question="What kinds of separation does the department see?"
          answer={quiet ? "Separations per fiscal year by type, including transfers to other agencies; monthly counts are too small to chart."
            : "Monthly separations by type, including transfers to other agencies."}>
          <Legend items={KEYS.map((k) => ({ label: k.label, color: k.color }))} />
          {quiet ? (
            <StackedColumns label={`${name} separations by fiscal year and type`} yFormat="int" height={280} stacks={KEYS.map((k) => ({ ...k }))}
              columns={fys.map((y, i) => ({ x: `’${String(y).slice(2)}`, values: fyMix[i], note: `FY${y}` }))} />
          ) : (
            <StackedArea label={`${name} monthly separations by type`} yFormat="compact" height={300} keys={KEYS.map((k) => ({ ...k }))}
              rows={rows.filter((r) => r.month >= 201201).map((r) => ({ t: r.month, ...separationMix(r), transfer: r.sep_transfer }))} />
          )}
        </Figure>
      </Chapter>

      {fy > 0 && !small && (
        <Chapter n={3} kicker="Who left" id="who" title={top && top.x > 1
          ? <>{top.who} separated at {top.rate.toFixed(1)}% in FY{fy}, {top.x.toFixed(1)} times their highest rate from 2013 to 2024.</>
          : <>In FY{fy}, no group separated above its 2013–2024 range.</>}>
          <Figure kind="observed" question="Which groups separated at unusual rates?"
            answer="Dot: the fiscal year, with its 95% interval. Grey bar: the group’s range over FY2013–2024."
            note={small ? "A small department: many groups have too few people for a reliable rate." : "Transfers are excluded so rates compare with the government-wide page."}>
            <DotRanges label={`${name} separation rate by group`} format="pct0" color="var(--accent)" rangeLabel="FY2013–2024 range"
              rows={segmentRows(seg, fy, (v) => `${v.toFixed(1)}%`)} labelWidth={220} />
          </Figure>
        </Chapter>
      )}

      {(excess.length > 0 || signals.length > 0 || gaps.length > 0) && (
        <Chapter n={fy > 0 && !small ? 4 : 3} kicker="Against the norm" id="norm"
          title={excess.length
            ? <>Voluntary exits ran {excess[0].ratio.toFixed(2)} times the expected level in FY{excess[0].fy}; without deferred resignations,
              {" "}{excess[0].ratio_excl_drp.toFixed(2)} times.</>
            : <>Recent months that sat far outside their usual range.</>}>
          {excess.length > 0 && (
            <Figure kind="modeled" question="How far did voluntary exits depart from this department's normal pattern?"
              answer="Actual voluntary exits against the number a model of FY2015–2024 patterns expected for its mix of age, service, grade and supervisory roles."
              note="Some deferred resignations replaced exits that would have happened anyway, so the true departure lies between the two ratios. Intervals include the model’s own error.">
              <div className="scroll-x" tabIndex={0} role="region" aria-label="Actual against expected voluntary exits">
              <table className="data-table">
                <caption className="sr-only">Actual against expected voluntary exits</caption>
                <thead><tr><th scope="col">Fiscal year</th><th scope="col" className="num">Actual</th><th scope="col" className="num">of which DRP</th>
                  <th scope="col" className="num">Expected</th><th scope="col" className="num">Ratio, all (95%)</th><th scope="col" className="num">Excl. DRP (95%)</th></tr></thead>
                <tbody>{excess.map((e) => (
                  <tr key={e.fy}><td>FY{e.fy}</td><td className="num">{int(e.actual)}</td><td className="num">{int(e.drp)}</td><td className="num">{int(e.expected)}</td>
                    <td className="num">{e.ratio.toFixed(2)} ({e.ratio_lo.toFixed(2)}–{e.ratio_hi.toFixed(2)})</td>
                    <td className="num">{e.ratio_excl_drp.toFixed(2)} ({e.ratio_excl_drp_lo.toFixed(2)}–{e.ratio_excl_drp_hi.toFixed(2)})</td></tr>
                ))}</tbody>
              </table>
              </div>
            </Figure>
          )}
          {(signals.length > 0 || gaps.length > 0) && (
            <div className={excess.length ? "mt-12" : undefined}>
              <h3 className="t-small font-semibold">Recent signals</h3>
              <p className="t-small text-ink-2 mt-1 mb-5 measure">Months in the last two years when a flow sat far outside its usual range for that month.</p>
              <Alerts alerts={signals} empty="No unusual months in the last two years." preliminaryFrom={an.latest - 1} />
              {gaps.length > 0 && <div className="mt-8"><h4 className="t-small font-semibold">Reporting gaps, not workforce change</h4>
                <p className="t-micro text-ink-3 mt-1 mb-3 measure">Counts far below normal in months OPM reports incomplete for this department.</p>
                <Alerts alerts={gaps} empty="" gap /></div>}
            </div>
          )}
        </Chapter>
      )}
    </>
  );
}
