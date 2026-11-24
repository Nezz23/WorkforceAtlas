import type { Metadata } from "next";
import { LineChart } from "@/components/charts/LineChart";
import { LadderBars, RankedBars } from "@/components/charts/Rows";
import { DataTable } from "@/components/DataTable";
import { Chapter, Figure, Figures, Legend, Masthead } from "@/components/ui";
import { facts, kpi, pay, scopes } from "@/lib/data";
import { int, monthName, pct1, titleCase, usd, usdK } from "@/lib/format";

export const metadata: Metadata = { title: "Compensation Intelligence" };

export default function Compensation() {
  const f = facts();
  const rows = kpi();
  const latest = rows[rows.length - 1].month;
  const gs = pay();
  const all = gs.filter((p) => p.grade === "ALL").sort((a, b) => a.month - b.month);
  const now = all.find((p) => p.month === latest)!;
  const ladder = gs.filter((p) => p.month === latest && /^(0[1-9]|1[0-5])$/.test(p.grade)).sort((a, b) => a.grade.localeCompare(b.grade));
  const firstDerived = all.find((p) => p.derived_n > 0)!;
  const k = rows[rows.length - 1];
  const pricedShare = 100 * now.derived_n / (k.headcount - k.pay_n);

  const depts = scopes().filter((s) => s.headcount >= 5000).map((s) => {
    const p = pay(s.code).find((q) => q.month === latest && q.grade === "ALL");
    return p ? { ...s, p } : null;
  }).filter((d): d is NonNullable<typeof d> => !!d && d.p.observed_n >= 1000 && d.p.observed_over_base_pct != null)
    .sort((a, b) => b.p.observed_over_base_pct! - a.p.observed_over_base_pct!);
  const hiddenDepts = scopes().filter((s) => s.headcount >= 5000).map((s) => {
    const p = pay(s.code).find((q) => q.month === latest && q.grade === "ALL");
    return p && p.coverage_observed_pct < 50 ? titleCase(s.name) : null;
  }).filter(Boolean);

  return (
    <>
      <Masthead kicker="Compensation Intelligence"
        title={<>Pay is hidden on {pct1(f("pay_hidden_pct_latest").value)} of federal employment records. Grade and step recover base pay for {Math.round(pricedShare)}% of them.</>}
        lead={<p>OPM’s data release policy withholds pay, with locality, for security agencies and sensitive occupations; about
          half of records have been hidden since the series began. Hidden General Schedule records still carry grade and step, so
          their base pay can be read from OPM’s published pay table: {int(now.derived_n)} of the {int(k.headcount - k.pay_n)} hidden records.</p>}
        contents={[{ id: "visibility", label: "What we can see" }, { id: "ladder", label: "The GS ladder" }, { id: "locality", label: "Locality" }]} />

      <Figures items={[
        { label: "Records with visible pay", value: pct1(100 - f("pay_hidden_pct_latest").value), detail: `All pay plans, ${monthName(latest)}` },
        { label: "GS records with visible pay", value: pct1(now.coverage_observed_pct), detail: `${int(now.observed_n)} of ${int(now.n)}` },
        { label: "GS records priced, visible or derived", value: pct1(now.coverage_with_derived_pct), detail: "Derived = base pay from the OPM table", kind: "derived" },
        { label: "Visible GS pay above base", value: `+${pct1(f("gs_observed_over_base_pct_latest").value)}`, detail: "Locality and special rates, same records" },
      ]} />

      <Chapter n={1} kicker="What we can see" id="visibility"
        title={<>Pricing hidden GS records from the pay table lifts GS coverage from {pct1(now.coverage_observed_pct)} to {pct1(now.coverage_with_derived_pct)}.</>}>
        <Figure kind="derived" question="How much of the workforce has a known pay figure?"
          answer={<>Visible pay is published by OPM. Derived coverage adds hidden GS records priced from the base pay table,
            from {monthName(firstDerived.month)}; OPM’s site does not publish the 2012 and 2013 tables in the same form.</>}
          note="Records without a valid grade and step cannot be priced and stay hidden.">
          <Legend items={[{ label: "Added by pricing hidden records", color: "var(--teal)" }, { label: "GS, visible or derived", color: "var(--teal)", dashed: true },
            { label: "GS, visible", color: "var(--accent)" }, { label: "All employees, visible", color: "var(--ink-3)" }]} />
          <LineChart label="Pay coverage by month" yFormat="pct0" valueFormat="pct1" height={280} zeroBased yMax={100} gap={["d", "g", "var(--teal)", "var(--teal)"]}
            series={[
              { key: "d", label: "GS derived", color: "var(--teal)", dashed: true, points: all.filter((p) => p.derived_n > 0).map((p) => ({ t: p.month, v: p.coverage_with_derived_pct })) },
              { key: "g", label: "GS visible", color: "var(--accent)", points: all.map((p) => ({ t: p.month, v: p.coverage_observed_pct })) },
              { key: "a", label: "All visible", color: "var(--ink-3)", muted: true, points: rows.map((r) => ({ t: r.month, v: r.pay_coverage_pct })) },
            ]} />
        </Figure>
      </Chapter>

      <Chapter n={2} kicker="The GS ladder" id="ladder"
        title={<>Visible GS pay runs {pct1(f("gs_observed_over_base_pct_latest").value)} above the base table. Derived figures are base pay only.</>}>
        <Figure kind="derived" question="What does each GS grade earn?"
          answer={<>Solid bars: average visible pay, including locality. Hatched bars: average derived base pay for hidden
            records, excluding locality. The two are not the same measure and are drawn apart on purpose.</>}
          note={`${monthName(latest)}. Hidden records sit mostly in ${hiddenDepts.slice(0, 3).join(", ")}${hiddenDepts.length > 3 ? " and others" : ""}, where locality pay is also hidden.`}
          aside={<DataTable caption={`GS pay by grade, ${monthName(latest)}`}
            columns={[{ key: "g", label: "Grade" }, { key: "n", label: "Records", num: true }, { key: "v", label: "Visible", num: true },
              { key: "o", label: "Avg. visible pay", num: true }, { key: "d", label: "Avg. derived base", num: true }]}
            rows={ladder.map((p) => ({ g: `GS-${p.grade}`, n: int(p.n), v: int(p.observed_n), o: p.observed_mean ? usd(p.observed_mean) : null, d: p.derived_base_mean ? usd(p.derived_base_mean) : null }))} />}>
          <Legend items={[{ label: "Visible pay, with locality", color: "var(--accent)" }, { label: "Derived base pay, no locality", color: "var(--ink-3)", hatch: true }]} />
          <LadderBars label="Average GS pay by grade, visible and derived" format="usdK" colorObserved="var(--accent)" colorDerived="var(--ink-3)"
            rows={ladder.map((p) => ({
              key: p.grade, label: `GS-${p.grade}`, observed: p.observed_mean, derived: p.derived_base_mean,
              tip: <><div className="font-semibold mb-1">GS-{p.grade}</div>
                <div className="row"><span>Records</span><span>{int(p.n)}</span></div>
                <div className="row"><span>Visible pay, avg.</span><span className="font-medium">{p.observed_mean ? usd(p.observed_mean) : "—"}</span></div>
                <div className="row"><span>Derived base, avg.</span><span>{p.derived_base_mean ? usd(p.derived_base_mean) : "—"}</span></div>
                <div className="row muted"><span>Visible share</span><span>{pct1(p.coverage_observed_pct)}</span></div></>,
            }))} />
        </Figure>
      </Chapter>

      <Chapter n={3} kicker="Locality" id="locality"
        title={<>Locality and special rates lift visible GS pay {pct1(depts[depts.length - 1].p.observed_over_base_pct!)} above base at
          {" "}{titleCase(depts[depts.length - 1].name)} and {pct1(depts[0].p.observed_over_base_pct!)} at {titleCase(depts[0].name)}.</>}>
        <Figure kind="observed" question="How far above the base table is visible GS pay in each department?"
          answer="Visible GS pay divided by the base-table rate for the same records, minus one. Departments with at least 1,000 visible GS records."
          note="Departments with mostly hidden pay cannot be measured here."
          aside={<DataTable caption="Visible GS pay above base by department"
            columns={[{ key: "d", label: "Department" }, { key: "v", label: "Visible GS records", num: true }, { key: "u", label: "Above base", num: true }]}
            rows={depts.map((d) => ({ d: titleCase(d.name), v: int(d.p.observed_n), u: `+${pct1(d.p.observed_over_base_pct!)}` }))} />}>
          <RankedBars lollipop label="Visible GS pay above the base table, by department" format="pct0" color="var(--teal)" labelWidth={300}
            reference={{ value: f("gs_observed_over_base_pct_latest").value, label: "All departments" }}
            rows={depts.map((d) => ({
              key: d.code, label: titleCase(d.name), value: d.p.observed_over_base_pct!, href: `/d/${d.code}/`,
              tip: <><div className="font-semibold mb-1">{titleCase(d.name)}</div>
                <div className="row"><span>Above base</span><span className="font-medium">+{pct1(d.p.observed_over_base_pct!)}</span></div>
                <div className="row muted"><span>Visible GS records</span><span>{int(d.p.observed_n)}</span></div>
                <div className="row muted"><span>Avg. visible pay</span><span>{d.p.observed_mean ? usdK(d.p.observed_mean) : "—"}</span></div></>,
            }))} />
        </Figure>
      </Chapter>
    </>
  );
}
