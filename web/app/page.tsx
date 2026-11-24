import Link from "next/link";
import { Alerts } from "@/components/Alerts";
import { StackedColumns } from "@/components/charts/Columns";
import { LineChart } from "@/components/charts/LineChart";
import { Dumbbells } from "@/components/charts/Rows";
import { DataTable } from "@/components/DataTable";
import { Chapter, Figure, Figures, Legend, Masthead } from "@/components/ui";
import { DataNotices } from "@/components/Notices";
import { anomalyModel, facts, forecastModel, kpi, manifest, openNotices, scopes } from "@/lib/data";
import { accuracy } from "@/lib/models";
import { last12, movers } from "@/lib/derive";
import { compact, int, monthName, monthShort, pct1, signedInt, signedPct, titleCase } from "@/lib/format";

export default function Brief() {
  const f = facts();
  const rows = kpi();
  const latest = rows[rows.length - 1];
  const L = last12(rows);
  const peak = f("headcount_peak"), fromPeak = f("headcount_change_from_peak"), change = f("headcount_change_12m");
  const peakMonth = Number(peak.months[0].replace("-", ""));
  const sep25 = f("separations_2025_09"), drp25 = f("separations_drp_2025_09"), median = f("separations_september_median_2012_2024");
  const repl = f("replacement_ratio_12m");
  const lowest = f("headcount_latest_rank_low").value === 1;
  const m = manifest();

  const fm = forecastModel();
  const fc = fm.forecasts.ALL;
  const f12 = fc.forecast[11];
  const growth = f12.v - fc.headcount;
  const acc = accuracy(fm);
  const notices = openNotices().filter((n) => n.month >= latest.month - 100);
  const latestIncomplete = notices.some((n) => n.month === latest.month && n.stream === "headcount");

  const septembers = rows.filter((r) => r.month % 100 === 9 && r.month >= 201209);
  const base = septembers.filter((r) => r.month <= 202409).map((r) => r.separations);
  const s25 = septembers.find((r) => r.month === 202509)!;
  const nonDrp25 = s25.separations - s25.sep_drp;
  const insideRange = nonDrp25 >= Math.min(...base) && nonDrp25 <= Math.max(...base);

  // Each large department's 12-month change now, against its 12-month change a year earlier.
  const moved = movers(scopes()).map((d) => {
    const k = kpi(d.code);
    const at = (mm: number) => k.find((r) => r.month === mm)?.headcount;
    const a = at(latest.month - 200), b = at(latest.month - 100);
    return { ...d, before: a && b ? 100 * (b / a - 1) : null };
  }).filter((d) => d.before != null);
  const faster = moved.filter((d) => d.pct < d.before!).length;

  const an = anomalyModel();
  const alerts = [...an.alerts_latest].filter((a) => a.severity).sort((a, b) => Math.abs(b.z) - Math.abs(a.z)).slice(0, 6);
  const gaps = an.gaps_recent.filter((a) => a.month === an.latest && a.severity);

  return (
    <>
      <Masthead
        kicker={`Workforce Brief · ${monthName(latest.month)}`}
        meta={<>OPM data through {monthName(latest.month)} · published {m.published_at.slice(0, 10)} · <Link className="link" href="/brief/">Printable brief</Link></>}
        contents={[{ id: "shape", label: "Shape and outlook" }, { id: "shock", label: "The 2025 shock" },
          { id: "departments", label: "Who moved" }, { id: "signals", label: "Signals this month" }]}
        title={lowest ? <>The federal workforce is the smallest it has been since 2012.</> : <>Federal headcount is {int(latest.headcount)}.</>}
        lead={<p>
          Headcount stands at {int(latest.headcount)}, {int(-fromPeak.value)} below its {monthName(peakMonth)} peak
          {latestIncomplete ? <> (OPM reports some {monthName(latest.month)} records missing, so the true figure is somewhat higher)</> : null}.
          September 2025 processed {int(sep25.value)} separations, {int(drp25.value)} of them deferred resignations.
          On current hiring and exit patterns, the forecast for {monthName(f12.t)} is {compact(f12.v)}, with an 80% range
          of {compact(f12.lo80)} to {compact(f12.hi80)}; in testing, such ranges held {acc.coverage.test.toFixed(0)}% of outcomes.
        </p>}
      />
      {notices.length > 0 && <div className="mb-10"><DataNotices notices={notices} /></div>}

      <Figures items={[
        { label: "Headcount", value: int(latest.headcount), detail: <>{signedInt(change.value)} ({signedPct(change.pct!)}) in 12 months</> },
        { label: `Forecast, ${monthShort(f12.t)}`, value: compact(f12.v), kind: "modeled",
          detail: <>80% range {compact(f12.lo80)}–{compact(f12.hi80)}; held {acc.coverage.test.toFixed(0)}% in tests</> },
        { label: "Separations, last 12 months", value: compact(L.separations), detail: <>{pct1(100 * L.separations / L.avgHeadcount)} of average headcount</> },
        { label: "New hires per separation", value: repl.value.toFixed(2), detail: <>Last 12 months; below 1.00 the workforce shrinks</> },
      ]} />

      <Chapter n={1} kicker="Shape and outlook" id="shape"
        title={<>Headcount peaked in {monthName(peakMonth)} at {int(peak.value)}.{" "}
          {f12.lo80 <= fc.headcount && f12.hi80 >= fc.headcount
            ? <>The forecast for the next year is roughly flat: its 80% range runs from {compact(f12.lo80)} to {compact(f12.hi80)}.</>
            : <>The forecast expects {growth >= 0 ? "a partial recovery" : "a further decline"} of {compact(Math.abs(growth))} over the next year.</>}</>}>
        <Figure kind="modeled" question="Where is federal headcount heading?"
          answer={<>Observed headcount to {monthName(latest.month)}, then the forecast from {monthName(fc.origin)} with its 80% and 95% ranges.
            The ranges come from how far the same method missed in every past year, 2025 included, and widen after a run of misses.</>}
          note={<>{fc.origin !== latest.month ? <>The forecast starts from {monthName(fc.origin)}, the last month OPM reports complete. </> : null}
            Built only from earlier misses, our 80% ranges held {acc.coverage.test.toFixed(0)}% of outcomes in 2023–2024 and {acc.coverage.shock.toFixed(0)}% in
            2025–2026: still too narrow for the government total. Details in Planning. Counts cover the civilian employees OPM
            reports; the Postal Service, intelligence agencies and most legislative and judicial staff are not included (see Methods).</>}
          aside={<Link className="link t-micro" href="/planning/">Forecasts by department and the scenario simulator →</Link>}>
          <Legend items={[{ label: "Observed headcount", color: "var(--accent)" }, { label: "Forecast", color: "var(--accent)", dashed: true },
            { label: "80% range", color: "var(--accent)", range: "inner" }, { label: "95% range", color: "var(--accent)", range: "outer" }]} />
          <LineChart label="Federal headcount since 2012 with a 24-month forecast" yFormat="compact" valueFormat="int" height={340}
            windows={[{ label: "Since 2019", months: 96 }, { label: "Since 2012", months: null }]}
            divider={{ t: fc.origin, label: "Forecast" }}
            series={[
              { key: "h", label: "Headcount", color: "var(--accent)", points: rows.map((r) => ({ t: r.month, v: r.headcount })) },
              { key: "f", label: "Forecast", color: "var(--accent)", dashed: true, points: [
                { t: fc.origin, v: fc.headcount, lo: fc.headcount, hi: fc.headcount, lo2: fc.headcount, hi2: fc.headcount },
                ...fc.forecast.map((p) => ({ t: p.t, v: p.v, lo: p.lo80, hi: p.hi80, lo2: p.lo95, hi2: p.hi95 }))] },
            ]}
            annotations={[{ t: peakMonth, label: `Peak ${compact(peak.value)}` }]} />
        </Figure>
      </Chapter>

      <Chapter n={2} kicker="The 2025 shock" id="shock"
        title={<>September 2025 processed {int(sep25.value)} separations. A typical September from 2012 to 2024 processed {int(median.value)}.</>}>
        <Figure kind="observed" question="How did September 2025 compare with every other September?"
          answer={<>Deferred resignations account for {int(drp25.value)}. The other {int(nonDrp25)} {insideRange ? "fall inside" : "fall outside"} the
            2012–2024 September range of {int(Math.min(...base))} to {int(Math.max(...base))}.</>}
          note={<>The Deferred Resignation Program, offered by OPM on 28 January 2025, let employees resign with pay until 30 September 2025 (later for some retirement dates), so most of its exits were processed that month; agencies may run their own deferred-resignation agreements in FY2026. September is always large: it ends the fiscal year, when seasonal and term appointments close.</>}
          aside={<DataTable caption="September separations by year"
            columns={[{ key: "y", label: "September" }, { key: "drp", label: "DRP", num: true }, { key: "other", label: "Other separations", num: true }, { key: "t", label: "Total", num: true }]}
            rows={septembers.map((r) => ({ y: Math.floor(r.month / 100), drp: int(r.sep_drp), other: int(r.separations - r.sep_drp), t: int(r.separations) }))} />}>
          <Legend items={[{ label: "Deferred resignation (DRP)", color: "var(--c-drp)" }, { label: "All other separations", color: "var(--ink-3)" }]} />
          <StackedColumns label="Separations processed each September, 2012 to 2026, split into DRP and other" yFormat="compact"
            reference={{ value: median.value, label: `2012–2024 median ${compact(median.value)}` }}
            stacks={[{ key: "other", label: "Other separations", color: "var(--ink-3)" }, { key: "drp", label: "DRP", color: "var(--c-drp)" }]}
            columns={septembers.map((r) => ({ x: String(Math.floor(r.month / 100)), highlight: r.month === 202509,
              values: { other: r.separations - r.sep_drp, drp: r.sep_drp } }))} />
        </Figure>
      </Chapter>

      <Chapter n={3} kicker="Who moved" id="departments"
        title={<>{faster} of {moved.length} large departments lost a larger share of staff in the last year than in the year before.
          {" "}{titleCase(moved[0].name)} fell furthest, {signedPct(moved[0].pct)}.</>}>
        <Figure kind="observed" question="How did each department's growth change?"
          answer={<>Twelve-month headcount change: the hollow dot is the year to {monthName(latest.month - 100)}, the arrow the year to
            {" "}{monthName(latest.month)}. Departments with at least 5,000 employees.</>}
          note="Smaller departments are left out because one office opening or closing swings their percentage; each has its own profile."
          aside={<DataTable caption="Department headcount change, two years"
            columns={[{ key: "d", label: "Department" }, { key: "a", label: `Year to ${monthShort(latest.month - 100)}`, num: true }, { key: "b", label: `Year to ${monthShort(latest.month)}`, num: true }, { key: "h", label: "Headcount", num: true }]}
            rows={moved.map((d) => ({ d: titleCase(d.name), a: signedPct(d.before!), b: signedPct(d.pct), h: int(d.headcount) }))} />}>
          <Dumbbells label="Twelve-month headcount change by department, year to September 2025 and year to September 2026" format="signedPct"
            colorUp="var(--teal)" colorDown="var(--c-rif)" labelWidth={300}
            legend={{ from: `Year to ${monthShort(latest.month - 100)}`, to: `Year to ${monthShort(latest.month)}`, up: "Better than the year before", down: "Worse than the year before" }}
            rows={moved.map((d) => ({
              key: d.code, label: titleCase(d.name), from: d.before!, to: d.pct, href: `/d/${d.code}/`,
              tip: <><div className="font-semibold mb-1">{titleCase(d.name)}</div>
                <div className="row"><span>Year to {monthShort(latest.month - 100)}</span><span>{signedPct(d.before!)}</span></div>
                <div className="row"><span>Year to {monthShort(latest.month)}</span><span className="font-medium">{signedPct(d.pct)}</span></div>
                <div className="row muted"><span>Headcount now</span><span>{int(d.headcount)}</span></div></>,
            }))} />
        </Figure>
      </Chapter>

      <Chapter n={4} kicker="Signals this month" id="signals"
        title={alerts.length
          ? <>{alerts.length} flows in {monthName(an.latest)} sat far outside their usual range for the month.</>
          : <>No flow in {monthName(an.latest)} sat outside its usual range for the month.</>}>
        <Figure kind="modeled" question="What is unusual this month?"
          answer={<>Each count is compared with the same month in up to five prior years. The threshold flags {an.calm_flag_rate.toFixed(1)}% of
            months in 2017–2019 and flagged {an.holdout_flag_rate.toFixed(1)}% in 2022–2024, years it was not set on.</>}
          note={<>{monthName(an.latest)} is OPM’s first release of that month; past revisions moved monthly counts by 2–6%. Months OPM reports
            incomplete are listed apart as reporting gaps and never counted as signals.</>}
          aside={<Link className="link t-micro" href="/mobility/#beyond">All recent signals in Mobility →</Link>}>
          <Alerts alerts={alerts} empty="No unusual flows this month." preliminaryFrom={an.latest - 1} />
          {gaps.length > 0 && <div className="mt-8">
            <h4 className="t-small font-semibold">Reporting gaps, not workforce change</h4>
            <p className="t-micro text-ink-3 mt-1 mb-3 measure">These counts fell far below normal in months OPM reports incomplete. They show missing records.</p>
            <Alerts alerts={gaps} empty="" gap />
          </div>}
        </Figure>
      </Chapter>
    </>
  );
}
