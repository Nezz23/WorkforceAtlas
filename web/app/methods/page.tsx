import type { Metadata } from "next";
import { LineChart } from "@/components/charts/LineChart";
import { Chapter, Figure, Mark, Masthead } from "@/components/ui";
import { anomalyModel, exitModel, facts, forecastModel, manifest, reconciliation, retentionModel } from "@/lib/data";
import { int, monthName, pct1 } from "@/lib/format";
import { accuracy } from "@/lib/models";
import { CODES, COVERAGE, CROSSCHECKS, DRP, POLICY, PROBATIONARY, REVISIONS } from "@/lib/context";

const COVERAGE_LEADS = ["Executive branch", "Legislative branch", "Judicial branch", "Employment count", "Flows"];
const longDate = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
/** Presentation only: a parenthetical in a figure drops to a small second line so the number stays on one line. */
function Split2({ v }: { v: string }) {
  const m = v.match(/^(.*?)\s*\((.+)\)$/);
  return m ? <>{m[1]}<span className="block t-micro text-ink-3 mt-1">{m[2]}</span></> : <>{v}</>;
}

export const metadata: Metadata = { title: "Methods & Data" };

const DEFINITIONS: [string, string][] = [
  ["Headcount", "Records in OPM’s monthly employment file. Each record is one on-board employee; there is no person identifier."],
  ["Separation", "A record in the separations file, counted in the month OPM processed it. Government-wide figures exclude transfers between agencies."],
  ["New hire", "An accession in the competitive, excepted or Senior Executive Service. Transfers in are excluded government-wide."],
  ["Deferred resignation (DRP)", "A separation flagged under OPM’s Deferred Resignation Program. It overlaps the formal categories (mostly quit and retirement) and is drawn as its own band."],
  ["Rate", "Count divided by average headcount over the same period. Rates on fewer than 30 people are not shown. Intervals are exact 95% Poisson intervals."],
  ["Length of service", "Years of creditable federal civilian and military service. OPM’s “tenure” field is a layoff retention group and is not used for this."],
  ["Derived base pay", "For hidden General Schedule records: OPM’s base pay table for the grade, step and calendar year. Locality pay is excluded."],
  ["Retirement exposure", "Age 55+ with 30+ years of service, 60+ with 20+, or 65+ with 5+. A lower bound on eligibility, not eligibility itself."],
];

const LIMITS = [
  "No person identifier: no individual histories, true cohorts or individual predictions. Every model works on groups.",
  "OPM does not release sex, race, disability or performance for individuals, so there is no pay-equity analysis by protected class.",
  "Pay and locality are withheld for security agencies and sensitive occupations. Derived pay covers GS base pay only.",
  "Employment files are monthly from mid-2011; earlier years are quarterly and not used.",
  "OPM revises published months and adds late submissions to later releases. The two latest months are first releases; past revisions moved monthly counts by 2–6%.",
  "When OPM reports a month incomplete for a department, that department’s counts for the month are shown but not modelled; see the data notice on the Brief.",
  "Recruiting funnels, time to hire and engagement are not in the data.",
  "Models learn from 2012–2024. A new program or policy, like the 2025 deferred resignations, sits outside what they can anticipate.",
];

export default function Methods() {
  const f = facts();
  const m = manifest();
  const rec = reconciliation();
  const fm = forecastModel(), an = anomalyModel(), rt = retentionModel(), em = exitModel();
  const files = Object.values(m.sources).reduce((s, x) => s + Object.keys(x).length, 0);
  const rows = Object.values(m.sources).reduce((s, x) => s + Object.values(x).reduce((t, v) => t + v.rows, 0), 0);
  const versions = Object.entries(m.sources).map(([stream, months]) => {
    const latest = Object.keys(months).sort().at(-1)!;
    return { stream, n: Object.keys(months).length, latest, v: months[latest].version, published: months[latest].publish_date.slice(0, 10) };
  });
  const warnings = Object.entries(m.warnings ?? {});
  const gw = accuracy(fm), dp = accuracy(fm, "departments");
  const emTest = em.by_year.filter((r) => r.model === em.chosen && em.test_years.includes(r.fy));
  const ex25 = em.excess.find((e) => e.fy === 2025 && e.dept === "ALL")!;
  const labourGain = (100 * (1 - em.deviance.selection_mean.gbm_lm / em.deviance.selection_mean.gbm)).toFixed(0);
  const maxBias = Math.max(...em.by_year.filter((r) => r.model === em.chosen).map((r) => Math.abs(r.bias_pct))).toFixed(0);

  const cards: { name: string; kind: "modeled"; what: string; how: string; tested: string; limits: string }[] = [
    { name: "Headcount forecast", kind: "modeled",
      what: `Monthly headcount 24 months ahead for the government and its ${fm.scopes.length - 1} largest departments, with 80% and 95% ranges.`,
      how: "Four candidates (no change, last year’s trend, exponential smoothing on log headcount, and hires minus exits rolled forward) are refit from every quarter since 2015 using only data to that point. Forecasts for 2022 and earlier choose the method, separately for the government total and for departments; 2023–2024 test it. Ranges are quantiles of its own past errors, 2025–2026 included, and widen after a run of misses (adaptive conformal inference). It tied with fixed quantiles on 2022 and earlier and held more outcomes since. Months OPM reports incomplete are never a starting point, and a department’s missing flows are replaced by its usual level for that month.",
      tested: `${fm.n_origins} forecast origins. Test years 2023–2024, 12 months ahead: ${gw.test.toFixed(1)}% government-wide (${gw.name.toLowerCase()}), ${dp.test.toFixed(1)}% for departments (${dp.name.toLowerCase()}). 2025–2026: ${gw.shock.toFixed(1)}% and ${dp.shock.toFixed(1)}%. 80% ranges built from earlier errors held ${gw.coverage.test.toFixed(0)}% and ${dp.coverage.test.toFixed(0)}% of test outcomes: still too narrow government-wide.`,
      limits: "Deferred resignations are left out of the hires-minus-exits history and assumed not to recur; exponential smoothing learns from headcount itself, so the 2025 step-down is part of its history. Government-wide misses come one year at a time, so two test years say little about the next one." },
    { name: "Unusual months", kind: "modeled",
      what: `${an.n_series} monthly series (hires and five exit types, for the government and departments of 1,000 or more).`,
      how: "Each month is compared with the median of the same calendar month over up to five prior years (at least three), on a log scale, divided by a robust measure of that series’ usual variation. Three months beyond half the threshold in one direction mark a sustained shift. Months OPM reports incomplete are shown as reporting gaps, never as signals.",
      tested: `Threshold ${an.threshold.toFixed(1)}, set so ${an.calm_flag_rate.toFixed(1)}% of ${int(an.n_calibration)} scored months in 2017–2019 are flagged. On 2022–2024, which it never saw, it flagged ${an.holdout_flag_rate.toFixed(1)}% of ${int(an.n_holdout)}. Tests confirm a tripled month is caught and a reported gap is not.`,
      limits: "Series expecting fewer than 10 a month are not scored. The newest month is a first release." },
    { name: "Retention curves", kind: "modeled",
      what: "The share of new federal employees still in service after 1 to 10 years, at each period’s exit rates.",
      how: "A period life table: annual separation rates by length-of-service band, treated as hazards (a year is survived with probability e^−rate) and chained together. Transfers are excluded, so leaving means leaving federal service.",
      tested: `${rt.draws.toLocaleString()} bootstrap draws of the counts for 95% intervals; arithmetic covered by unit tests.`,
      limits: "Synthetic cohorts, not followed people. Year one includes seasonal and temporary appointments. Intervals show count noise only." },
    { name: "Exit-rate model", kind: "modeled",
      what: "Expected voluntary exits for groups defined by department, grade, length of service, age and supervisory status.",
      how: `Each year from FY${em.select_years[0]} is predicted by models fitted only on earlier years. A department-average baseline, a Poisson regression and gradient boosting compete on FY${em.select_years[0]}–${em.select_years[em.select_years.length - 1]}; boosting won. Scaling each year by the private-sector quit rate (BLS JOLTS) cut its error a further ${labourGain}% on the same years, so ${em.chosen === "gbm_lm" ? "it is used" : "it was tested but not used"}; the chosen model is tested on FY${em.test_years.join(" and FY")}. Intervals on actual-to-expected ratios combine overdispersion (dispersion ${em.dispersion.toFixed(1)}) with the model’s normal-year error (log SD ${em.model_error_sd_log.toFixed(2)}).`,
      tested: `Test-year deviance: baseline ${em.deviance.test_mean.baseline.toFixed(2)}, regression ${em.deviance.test_mean.glm.toFixed(2)}, boosting ${em.deviance.test_mean.gbm.toFixed(2)}, with the quit rate ${em.deviance.test_mean.gbm_lm.toFixed(2)}. Predicted totals were off by ${emTest.map((r) => `${r.bias_pct > 0 ? "+" : ""}${r.bias_pct.toFixed(0)}% in FY${r.fy}`).join(" and ")}. Refit on FY2015–2024 for FY2025–2026 expectations.`,
      limits: `Groups, never individuals. Associations, not causes. Good at ranking groups, weaker on the overall level: even with the quit rate, it missed whole-year totals by up to ${maxBias}% (FY2019–2024). The quit rate is the same year’s, so the expectation is conditional on that year’s job market, not a forecast made before it. Without it, FY2025 exits ran ${ex25.ratio_no_level.toFixed(2)} times expected (${ex25.ratio_excl_drp_no_level.toFixed(2)} without deferred resignations), against ${ex25.ratio.toFixed(2)} and ${ex25.ratio_excl_drp.toFixed(2)} with it.` },
  ];

  return (
    <>
      <Masthead kicker="Methods & Data" title="How every number on this site is made, and how far to trust it."
        lead={<p>One public source and one reproducible pipeline: {int(files)} OPM files and {int(rows)} records, checked against a data
          contract before anything is published. Four models sit on top, each scored on later years held out from fitting and from model choice.</p>}
        contents={[{ id: "trust", label: "Trust marks" }, { id: "coverage", label: "Coverage and context" }, { id: "models", label: "Models" }, { id: "definitions", label: "Definitions" },
          { id: "reconciliation", label: "Reconciliation" }, { id: "pipeline", label: "Pipeline" }, { id: "sources", label: "Sources and terms" }, { id: "limits", label: "Limits" }]} />

      <Chapter n={1} kicker="Trust marks" id="trust" title="Every figure says whether it was counted, derived or modeled.">
        <dl className="grid grid-cols-3 max-lg:grid-cols-1 gap-x-12 gap-y-8">
          {([["observed", "Counted directly from OPM records, with no estimation."],
            ["derived", "Computed from observed fields with a published rule, such as pricing a grade and step from the pay table."],
            ["modeled", "Produced by a statistical model, scored on later years held out from fitting and model choice, and shown with its uncertainty."]] as const).map(([k, d]) => (
            <div key={k} className="border-t border-rule pt-4"><dt><Mark kind={k} /></dt><dd className="t-small text-ink-2 mt-3">{d}</dd></div>
          ))}
        </dl>
      </Chapter>

      <Chapter n={2} kicker="Coverage and context" id="coverage" title="Who the data counts, what changed in 2025–2026, and how our figures compare with OPM’s.">
        <p className="t-body text-ink-2 measure">The data covers civilian employees of the Executive branch. Military personnel, the Postal Service and the intelligence
          agencies are out, and the Legislative and Judicial branches are mostly out, each with named exceptions below.</p>
        <div className="grid grid-cols-2 max-lg:grid-cols-1 gap-x-12 gap-y-10 mt-8">
          <section>
            <h3 className="t-small font-semibold">Who is in the data</h3>
            <dl className="mt-3 t-small">
              {([...COVERAGE.map((c, i) => [COVERAGE_LEADS[i] ?? "Coverage", c.text, c.source] as const),
                ...(PROBATIONARY ? [["Probationary staff", PROBATIONARY.text, PROBATIONARY.source] as const] : []),
                ...(REVISIONS ? [["Late revisions", REVISIONS.text, REVISIONS.source] as const] : [])]).map(([lead, text, source]) => (
                <div key={text} className="grid grid-cols-[112px_1fr] max-sm:grid-cols-1 gap-x-4 gap-y-1 border-t border-rule py-3">
                  <dt className="font-semibold">{lead}</dt>
                  <dd className="text-ink-2">{text} <a className="link t-micro whitespace-nowrap" href={source.url} target="_blank" rel="noreferrer">{source.label}</a></dd>
                </div>
              ))}
            </dl>
          </section>
          <section>
            <h3 className="t-small font-semibold">Deferred Resignation Program</h3>
            <ol className="mt-3 t-small">
              {DRP.map((d) => (
                <li key={d.text} className="border-t border-rule py-3 text-ink-2">{d.text} <a className="link t-micro whitespace-nowrap" href={d.source.url} target="_blank" rel="noreferrer">{d.source.label}</a></li>
              ))}
            </ol>
          </section>
        </div>
        <section className="mt-12">
          <h3 className="t-small font-semibold">Official actions that changed hiring or separations</h3>
          <p className="t-micro text-ink-3 mt-1 measure">Listed for context, in date order, each with its official source. The data cannot attribute any month’s change to one action.</p>
          <ol className="mt-4 border-t border-rule">
            {POLICY.map((x) => (
              <li key={x.date + x.title} className="grid grid-cols-[104px_1fr] max-sm:grid-cols-1 gap-x-6 gap-y-1 py-3 border-b border-rule t-small">
                <time dateTime={x.date} className="t-micro font-semibold text-ink-2 pt-0.5">{longDate(x.date)}</time>
                <div>
                  <p className="font-medium">{x.title}</p>
                  <p className="text-ink-2 mt-0.5 measure">{x.effect}</p>
                  <a className="link t-micro inline-block mt-1" href={x.source.url} target="_blank" rel="noreferrer">{x.source.label}</a>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <section className="mt-12">
          <h3 className="t-small font-semibold">Our figures against OPM’s</h3>
          <div className="scroll-x mt-3" tabIndex={0} role="region" aria-label="Table">
            <table className="data-table">
              <caption className="sr-only">Cross-checks against official figures</caption>
              <thead><tr><th scope="col">Figure</th><th scope="col" className="num">Ours</th><th scope="col" className="num">Official</th><th scope="col">Agree</th></tr></thead>
              <tbody>{CROSSCHECKS.map((c) => (
                <tr key={c.claim}>
                  <td className="min-w-[200px] !whitespace-normal">{c.claim}<span className="block t-micro mt-1"><a className="link" href={c.source.url} target="_blank" rel="noreferrer">{c.source.label}</a></span></td>
                  <td className="num min-w-[150px]"><Split2 v={c.ours} /></td>
                  <td className="num min-w-[150px]"><Split2 v={c.official} /></td>
                  <td className="min-w-[110px]">{c.match == null ? "No official figure" : c.match ? "Yes" : "Close; see note"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <p className="t-micro text-ink-3 mt-2 measure">The deferred-resignation totals differ by under 40 records. OPM keeps processing late DRP actions, and its total may count transfers differently; the cause is not confirmed. Pew’s 2025 hire and separation counts are 1.6–4% higher than ours; Pew used earlier file versions, and OPM has revised those months since, so the gap is expected but its exact cause is not confirmed.</p>
        </section>
        <div className="mt-12 max-w-[560px]">
          <section>
            <h3 className="t-small font-semibold">Category codes</h3>
            <div className="scroll-x mt-3" tabIndex={0} role="region" aria-label="Table">
              <table className="data-table">
                <caption className="sr-only">OPM accession and separation category codes</caption>
                <thead><tr><th scope="col">Code</th><th scope="col">OPM label</th><th scope="col">File</th></tr></thead>
                <tbody>{CODES.map((c) => <tr key={c.code}><td>{c.code}</td><td>{c.label.charAt(0) + c.label.slice(1).toLowerCase()}</td><td className="capitalize">{c.dataset}</td></tr>)}</tbody>
              </table>
            </div>
            <p className="t-micro text-ink-3 mt-2">Labels are OPM’s own, from each file’s description column. OPM publishes no longer definition per code.</p>
          </section>
        </div>
      </Chapter>

      <Chapter n={3} kicker="Models" id="models" title="Four models, each chosen against a simpler baseline and tested out of sample.">
        <div className="grid grid-cols-2 max-lg:grid-cols-1 gap-x-12">
          {cards.map((c) => (
            <article key={c.name} className="border-t border-rule py-6">
              <div className="flex items-baseline justify-between gap-4"><h3 className="t-small font-semibold">{c.name}</h3><Mark kind={c.kind} /></div>
              <dl className="mt-3 space-y-3 t-small">
                {([["What", c.what], ["How", c.how], ["Tested", c.tested], ["Limits", c.limits]] as const).map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[72px_1fr] gap-3"><dt className="text-ink-3">{k}</dt><dd className="text-ink-2">{v}</dd></div>
                ))}
              </dl>
            </article>
          ))}
        </div>
      </Chapter>

      <Chapter n={4} kicker="Definitions" id="definitions" title="The measures, in plain terms.">
        <dl className="grid grid-cols-2 max-lg:grid-cols-1 gap-x-12">
          {DEFINITIONS.map(([t, d]) => (
            <div key={t} className="border-t border-rule py-5"><dt className="t-small font-semibold">{t}</dt><dd className="t-small text-ink-2 mt-1">{d}</dd></div>
          ))}
        </dl>
      </Chapter>

      <Chapter n={5} kicker="Reconciliation" id="reconciliation"
        title={<>Headcount change and net flows usually agree within {int(f("reconciliation_median_abs_gap").value)} people a month.</>}>
        <Figure kind="observed" question="Do hires and exits explain the change in headcount?"
          answer={<>Each month: change in headcount minus (new hires − separations). In September 2025 the gap was
            {" "}{int(f("reconciliation_gap_2025_09").value)}: exits processed that month were still in its headcount and left in
            October’s. Across both months the gap nets to {int(f("reconciliation_gap_2025_09_10").value)}.</>}
          note="Late-processed actions and revised files can also open a gap; its causes are not broken down here. The gap is published rather than adjusted away.">
          <LineChart label="Monthly reconciliation gap" yFormat="compact" valueFormat="int" height={240}
            series={[{ key: "g", label: "Gap", color: "var(--accent)", points: rec.map((r) => ({ t: r.month, v: r.gap_same_month })) }]} />
        </Figure>
      </Chapter>

      <Chapter n={6} kicker="Pipeline" id="pipeline" title="A broken file stops the monthly run; the last good data stays live.">
        <div className="grid grid-cols-12 gap-8 max-lg:gap-x-0">
          <ol className="col-span-5 max-lg:col-span-12 t-small text-ink-2 space-y-4">
            {["Download each new or revised OPM file.", "Check it against the data contract: columns, codes, counts, dates.",
              "Summarise it into monthly tables with DuckDB.", "Refit the models and publish every cited figure with its rule and source months."].map((s, i) => (
              <li key={s} className="flex gap-4"><span className="text-ink-3 tabular-nums">{String(i + 1).padStart(2, "0")}</span><span>{s}</span></li>
            ))}
          </ol>
          <div className="col-span-7 max-lg:col-span-12">
<div className="scroll-x" tabIndex={0} role="region" aria-label="Source files by stream">
            <table className="data-table">
              <caption className="sr-only">Source files by stream</caption>
              <thead><tr><th scope="col">Stream</th><th scope="col" className="num">Files</th><th scope="col">Latest month</th><th scope="col" className="num">Version</th><th scope="col">Published by OPM</th></tr></thead>
              <tbody>{versions.map((v) => (
                <tr key={v.stream}><td className="capitalize">{v.stream}</td><td className="num">{v.n}</td><td>{monthName(Number(v.latest))}</td><td className="num">{v.v}</td><td>{v.published}</td></tr>
              ))}</tbody>
            </table>
            </div>
            <h3 className="t-small font-semibold mt-6">{warnings.length ? `${warnings.length} data-quality warnings, none blocking` : "No data-quality warnings"}</h3>
            {warnings.length > 0 && (
              <ul className="t-micro text-ink-2 mt-2 space-y-1">
                {warnings.map(([k, v]) => <li key={k}><span className="capitalize">{k.split(" ")[0]}</span> {monthName(Number(k.split(" ")[1]))}: {v.join("; ")}</li>)}
              </ul>
            )}
            <p className="t-micro text-ink-3 mt-4">{pct1(f("late_actions_pct").value)} of hire and exit records took effect before the month OPM processed them.
              Published {m.published_at.slice(0, 10)}{m.code_version ? `, code ${m.code_version}` : ""}.</p>
          </div>
        </div>
      </Chapter>

      <Chapter n={7} kicker="Sources and terms" id="sources" title="Public OPM data, checked against OPM’s own documents.">
        <dl className="grid grid-cols-2 max-lg:grid-cols-1 gap-x-12 t-small">
          {([
            ["Data", "OPM Federal Workforce Data (data.opm.gov), employment, accession and separation files, version-tracked."],
            ["Release terms", "OPM’s Data Release Policy (December 2024) sets what is withheld. It sets no licence or attribution terms, and U.S. government works carry no U.S. copyright (17 U.S.C. § 105). Workforce Atlas is independent and not affiliated with OPM."],
            ["Context sources", "Coverage, policy dates and program terms above were each read on 2026-11-17 from the official page linked beside them; the full record is in docs/reference/context.md."],
            ["Pay tables", "OPM General Schedule base pay tables, 2014–2026, read from opm.gov."],
          ] as const).map(([t, d]) => (
            <div key={t} className="border-t border-rule py-5"><dt className="font-semibold">{t}</dt><dd className="text-ink-2 mt-1">{d}</dd></div>
          ))}
        </dl>
      </Chapter>

      <Chapter n={8} kicker="Limits" id="limits" title="What this data and these models cannot tell you.">
        <ul className="grid grid-cols-2 max-lg:grid-cols-1 gap-x-12">
          {LIMITS.map((l) => <li key={l} className="t-small text-ink-2 border-t border-rule py-4">{l}</li>)}
        </ul>
      </Chapter>
    </>
  );
}
