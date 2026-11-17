// OPM's own statements that a month is incomplete, shown wherever that month is read: one summary line, details on demand.
import type { DataNotice } from "@/lib/types";
import { int, monthName, monthShort, titleCase } from "@/lib/format";

const DEPT: Record<string, string> = { DOD: "Defense", VA: "Veterans Affairs" };   // OPM's notes call Defense "DOW" (Department of War)
const STREAM = { headcount: "headcount", accessions: "hires", separations: "separations" } as const;
const span = (ms: number[]) => (ms.length === 1 ? monthName(ms[0]) : `${monthShort(ms[0])} – ${monthShort(ms[ms.length - 1])}`);

export function DataNotices({ notices, title = "Incomplete OPM data" }: { notices: DataNotice[]; title?: string }) {
  if (!notices.length) return null;
  const depts = [...new Set(notices.map((n) => n.scope))]
    .sort((a, b) => notices.filter((n) => n.scope === b).length - notices.filter((n) => n.scope === a).length);
  const months = [...new Set(notices.map((n) => n.month))].sort((a, b) => b - a);
  const summary = depts.map((d) => {
    const ms = [...new Set(notices.filter((n) => n.scope === d).map((n) => n.month))].sort((a, b) => a - b);
    return `${DEPT[d] ?? titleCase(d)}, ${span(ms)}`;
  }).join("; ");
  return (
    <aside className="border-y border-rule-strong py-3" aria-label={title}>
      <details>
        <summary className="cursor-pointer list-none flex flex-wrap items-baseline gap-x-3 gap-y-1 t-small min-h-6">
          <span className="t-micro font-semibold uppercase tracking-[0.06em] text-ink">{title}</span>
          <span className="text-ink-2">{summary}. Models leave these months out.</span>
          <span className="link t-micro">Details and sources</span>
        </summary>
        <ul className="mt-3 space-y-2 t-small text-ink-2 measure">
          {months.map((m) => {
            const ns = notices.filter((n) => n.month === m);
            // A count belongs to the files it names: Status (headcount) or Dynamics (hires and separations, counted once).
            const counted = [...new Map(ns.filter((n) => n.records_missing).map((n) => [`${n.text}|${n.stream === "headcount"}`,
              { n: n.records_missing!, what: n.stream === "headcount" ? "headcount" : "hires and separations" }])).values()];
            const missing = counted.map((c) => `about ${int(c.n)} ${c.what} records`).join(" and ");
            const kinds = [...new Set(ns.map((n) => STREAM[n.stream]))].join(", ");
            const suspected = ns.every((n) => n.status === "suspected");
            const who = [...new Set(ns.map((n) => DEPT[n.scope] ?? titleCase(n.scope)))].join(", ");
            return (
              <li key={m}>
                <span className="font-medium text-ink">{monthName(m)}</span>, {who} {kinds}:{" "}
                {suspected
                  ? <>not announced by OPM, but counts fell far below the same month in earlier years in every category; treated as a probable reporting gap.</>
                  : <>OPM reported records missing{missing ? <> ({missing})</> : null} and has not yet announced them received.</>}
                {" "}<a className="link" href={ns[0].url} target="_blank" rel="noreferrer">{ns[0].source}</a>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 t-micro text-ink-3 measure">The forecast, unusual-month and exit-rate models leave these department-months out. Other totals
          and rates, including 12-month figures and FY2026 retention curves, use them as reported, so they understate those hires and separations.
          OPM’s notes call the Department of Defense the Department of War (DOW).</p>
      </details>
    </aside>
  );
}
