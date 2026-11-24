import type { Metadata } from "next";
import Link from "next/link";
import { LineChart } from "@/components/charts/LineChart";
import { DataNotices } from "@/components/Notices";
import { anomalyModel, exitModel, facts, forecastModel, kpi, manifest, openNotices, retentionModel, scopes } from "@/lib/data";
import { last12 } from "@/lib/derive";
import { compact, int, monthName, pct1, signedPct, titleCase } from "@/lib/format";
import { accuracy } from "@/lib/models";
import { AUTHOR } from "@/lib/site";

export const metadata: Metadata = { title: "Monthly brief" };

// The monthly brief as a printable memo. Every sentence is filled from published facts and model outputs.
export default function PrintBrief() {
  const f = facts();
  const rows = kpi();
  const latest = rows[rows.length - 1];
  const L = last12(rows);
  const fm = forecastModel(), an = anomalyModel(), em = exitModel(), rt = retentionModel().tables.ALL;
  const g = fm.forecasts.ALL.forecast[11];
  const ex25 = em.excess.find((e) => e.fy === 2025 && e.dept === "ALL")!;
  const names = new Map(scopes().map((s) => [s.code, titleCase(s.name)]));
  const change = f("headcount_change_12m");
  const file = "workforce-brief.pdf";
  const findings = [
    <>Federal headcount was {int(latest.headcount)} in {monthName(latest.month)}, {signedPct(change.pct!)} in 12 months and {int(-f("headcount_change_from_peak").value)} below the {monthName(Number(f("headcount_peak").months[0].replace("-", "")))} peak.</>,
    <>Over the last 12 months agencies made {int(L.newHires)} new hires and processed {int(L.separations)} separations: {f("replacement_ratio_12m").value.toFixed(2)} hires per exit.</>,
    <>The forecast for {monthName(g.t)} is {compact(g.v)} (80% range {compact(g.lo80)}–{compact(g.hi80)}; in testing, such ranges held {accuracy(fm).coverage.test.toFixed(0)}% of outcomes). In 2023–2024, years not used to choose the method, it missed by {accuracy(fm).test.toFixed(1)}% a year ahead; in 2025–2026, by {accuracy(fm).shock.toFixed(1)}%.</>,
    <>Voluntary exits in FY2025 were {ex25.ratio.toFixed(2)} times what FY2015–2024 patterns and that year’s private-sector quit rate predicted ({int(ex25.actual)} against {int(ex25.expected)}). Without deferred resignations the ratio is {ex25.ratio_excl_drp.toFixed(2)} (95% interval {ex25.ratio_excl_drp_lo.toFixed(2)}–{ex25.ratio_excl_drp_hi.toFixed(2)}).</>,
    <>At FY2025 exit rates, {rt.FY2025.survival[5].v.toFixed(0)}% of new federal employees would remain after five years, against {rt["FY2022–2024"].survival[5].v.toFixed(0)}% at 2022–2024 rates.</>,
  ];
  const alerts = an.alerts_latest.filter((a) => a.severity).sort((a, b) => Math.abs(b.z) - Math.abs(a.z)).slice(0, 5);
  const top = fm.scopes.slice(1, 9);
  const notices = openNotices().filter((n) => n.month >= latest.month - 100);

  return (
    <article className="memo max-w-[760px] mx-auto py-12">
      <div className="no-print flex justify-between items-center mb-10 t-small">
        <Link href="/" className="link">← Back to the interactive brief</Link>
        <a href={`/brief/${file}`} className="seg-btn" download>Download PDF</a>
      </div>
      <p className="t-kicker">Workforce Atlas · Monthly brief · {monthName(latest.month)}</p>
      <h1 className="t-display mt-3">The federal workforce in {monthName(latest.month)}</h1>
      <p className="t-micro text-ink-3 mt-2">OPM Federal Workforce Data through {monthName(latest.month)} · published {manifest().published_at.slice(0, 10)} · independent analysis by {AUTHOR.name}, not affiliated with OPM</p>

      <h2 className="t-small font-semibold mt-10 border-t border-rule pt-4">Key findings</h2>
      <ol className="mt-3 space-y-3 t-body list-decimal pl-5">{findings.map((x, i) => <li key={i}>{x}</li>)}</ol>

      <h2 className="t-small font-semibold mt-10 border-t border-rule pt-4">Headcount since 2019 and forecast <span className="mark ml-2" data-kind="modeled">modeled</span></h2>
      <div className="mt-3">
        <LineChart label="Federal headcount since 2019 with the 24-month forecast and its 80% range" yFormat="compact" valueFormat="int" height={220}
          divider={{ t: fm.forecasts.ALL.origin, label: "Forecast" }}
          series={[
            { key: "h", label: "Headcount", color: "var(--accent)", points: rows.filter((r) => r.month >= 201901).map((r) => ({ t: r.month, v: r.headcount })) },
            { key: "f", label: "Forecast", color: "var(--accent)", dashed: true, points: [{ t: fm.forecasts.ALL.origin, v: fm.forecasts.ALL.headcount, lo: fm.forecasts.ALL.headcount, hi: fm.forecasts.ALL.headcount, lo2: fm.forecasts.ALL.headcount, hi2: fm.forecasts.ALL.headcount },
              ...fm.forecasts.ALL.forecast.map((q) => ({ t: q.t, v: q.v, lo: q.lo80, hi: q.hi80 }))] },
          ]} />
      </div>
      {notices.length > 0 && <div className="mt-6"><DataNotices notices={notices} /></div>}

      <h2 className="t-small font-semibold mt-10 border-t border-rule pt-4">Forecast, largest departments <span className="mark ml-2" data-kind="modeled">modeled</span></h2>
      <table className="data-table mt-3">
        <thead><tr><th scope="col">Department</th><th scope="col" className="num">{monthName(fm.forecasts.ALL.origin)}</th><th scope="col" className="num">{monthName(g.t)}</th><th scope="col" className="num">80% range</th></tr></thead>
        <tbody>{["ALL", ...top].map((c) => {
          const fc = fm.forecasts[c]; const p = fc.forecast[11];
          return <tr key={c} className={c === "ALL" ? "font-semibold" : undefined}><td>{c === "ALL" ? "All departments" : names.get(c)}</td>
            <td className="num">{int(fc.headcount)}</td><td className="num">{int(p.v)}</td><td className="num">{compact(p.lo80)}–{compact(p.hi80)}</td></tr>;
        })}</tbody>
      </table>

      <h2 className="t-small font-semibold mt-10 border-t border-rule pt-4">Signals this month <span className="mark ml-2" data-kind="modeled">modeled</span></h2>
      {alerts.length ? (
        <ul className="mt-3 space-y-2 t-small">{alerts.map((a) => (
          <li key={`${a.scope}-${a.flow}`}><span className="font-semibold">{a.scope === "ALL" ? "All departments" : titleCase(a.name)}</span> · {a.label}: {int(a.actual)} against a usual {int(Math.round(a.expected))} (first release)</li>
        ))}</ul>
      ) : <p className="mt-3 t-small">No flow sat outside its usual range this month.</p>}

      <h2 className="t-small font-semibold mt-10 border-t border-rule pt-4">How to read this brief</h2>
      <p className="t-micro text-ink-2 mt-3">Counts are observed from OPM records; forecasts, signals and expected exits are modeled, and their errors are measured on later years held out from fitting and model choice.
        Government-wide flows exclude transfers between agencies. {monthName(latest.month)} is a first release; past revisions moved monthly counts by 2–6%.
        Separation rates use average headcount ({pct1(100 * L.separations / L.avgHeadcount)} over the last 12 months). Full methods are on the site’s Methods page.</p>
    </article>
  );
}
