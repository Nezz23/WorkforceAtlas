import type { DotRow } from "@/components/charts/Rows";
import type { Segment } from "./types";

export const DIMENSIONS = [
  { key: "los_band", label: "Length of federal service", levels: ["<1", "1-2", "3-4", "5-9", "10-19", "20-29", "30+"],
    name: (l: string) => (l === "<1" ? "Under 1 year" : l === "30+" ? "30 years or more" : `${l.replace("-", "–")} years`),
    who: (n: string) => `Employees with ${n.toLowerCase()} of service` },
  // Under-20s are left out: about a thousand people, whose rates swing past 100% and flatten every other row.
  { key: "age_bracket", label: "Age", levels: ["20-24", "25-29", "30-34", "35-39", "40-44", "45-49", "50-54", "55-59", "60-64", "65 OR MORE"],
    name: (l: string) => (l === "65 OR MORE" ? "65 or older" : l.replace("-", "–")),
    who: (n: string) => (n === "65 or older" ? "Employees 65 or older" : `Employees aged ${n}`) },
  { key: "grade_band", label: "Grade", levels: ["GS 1-7", "GS 8-12", "GS 13-15", "Senior", "Other plans"],
    name: (l: string) => (l === "Senior" ? "Senior executive" : l === "Other plans" ? "Other pay plans" : l.replace("-", "–")),
    who: (n: string) => (n.startsWith("GS") ? `Employees at ${n}` : `${n} employees`) },
  { key: "supervisor", label: "Supervisory status", levels: ["Non-supervisory", "Supervisor or manager"], name: (l: string) => l,
    who: (n: string) => (n === "Non-supervisory" ? "Non-supervisory employees" : "Supervisors and managers") },
] as const;

/** The group whose rate in `fy` sits furthest above its own FY2013–2024 maximum. */
export function standout(seg: Segment[], fy: number) {
  return DIMENSIONS.flatMap((d) => d.levels.map((level) => {
    const hist = seg.filter((s) => s.dimension === d.key && s.level === level && s.fy >= 2013 && s.fy <= 2024 && s.rate != null);
    const cur = seg.find((s) => s.dimension === d.key && s.level === level && s.fy === fy);
    if (cur?.rate == null || !hist.length) return null;
    const hi = Math.max(...hist.map((h) => h.rate!));
    return { who: d.who(d.name(level)), rate: cur.rate, hi, x: cur.rate / hi };
  })).filter((r): r is NonNullable<typeof r> => !!r).sort((a, b) => b.x - a.x)[0] ?? null;
}

/** One fiscal year's separation rate per segment, over the 2013–2024 range of the same segment. */
export function segmentRows(seg: Segment[], fy: number, fmt: (v: number) => string): DotRow[] {
  return DIMENSIONS.flatMap((d) => d.levels.map((level) => {
    const hist = seg.filter((s) => s.dimension === d.key && s.level === level && s.fy >= 2013 && s.fy <= 2024 && s.rate != null);
    const cur = seg.find((s) => s.dimension === d.key && s.level === level && s.fy === fy);
    const range = hist.length ? [Math.min(...hist.map((h) => h.rate!)), Math.max(...hist.map((h) => h.rate!))] as [number, number] : undefined;
    return {
      key: `${d.key}-${level}`, group: d.label, label: d.name(level),
      value: cur?.rate ?? null, lo: cur?.rate_lo ?? null, hi: cur?.rate_hi ?? null, range,
      tip: cur && cur.rate != null ? (
        <>
          <div className="font-semibold mb-1">{d.name(level)}, FY{fy}</div>
          <div className="row"><span>Separation rate</span><span className="font-medium">{fmt(cur.rate)}</span></div>
          <div className="row muted"><span>95% interval</span><span>{fmt(cur.rate_lo!)}–{fmt(cur.rate_hi!)}</span></div>
          {cur.drp_rate != null && cur.drp_rate > 0 && <div className="row"><span>of which DRP</span><span>{fmt(cur.drp_rate)}</span></div>}
          {range && <div className="row muted"><span>FY2013–2024 range</span><span>{fmt(range[0])}–{fmt(range[1])}</span></div>}
          <div className="row muted"><span>Separations / avg. headcount</span><span>{Math.round(cur.separations).toLocaleString()} / {Math.round(cur.avg_headcount).toLocaleString()}</span></div>
        </>
      ) : undefined,
    };
  }).filter((r) => r.range || r.value != null));
}
