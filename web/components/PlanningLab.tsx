"use client";
// Forecast explorer and what-if simulator for one scope at a time. The simulator moves the forecast by the
// cumulative change in flows its levers imply; with every lever at default it is the forecast.
import { useMemo, useState, useSyncExternalStore } from "react";
import { LineChart, type Series } from "@/components/charts/LineChart";
import { Legend, Mark } from "@/components/ui";
import { compact as compactN, int, monthName, signedInt } from "@/lib/format";
import { annualRates, DEFAULT_LEVERS, simulate, type Levers } from "@/lib/simulate";

export type LabScope = {
  code: string; name: string;
  history: { t: number; v: number }[];
  origin: { t: number; v: number };          // last month OPM reports complete: the forecast starts here
  parts12: { hires: number; exits: number; other: number };   // 12-month forecast hires, exits and other change; they add up to the forecast’s change
  forecast: { t: number; v: number; lo80: number; hi80: number; lo95: number; hi95: number }[];
  hires: number[]; exits: number[]; retirementShare: number;
  hireRange: [number, number]; exitRange: [number, number];   // rolling 12-month rates seen since 2012, % of headcount
};

const PIN_COLORS = ["var(--c-termination)", "var(--c-drp)", "var(--c-rif)"];

// Below `lg` the chart and its three figures stay pinned under the header while the levers scroll beneath them,
// so the reader sees the line move as they drag. Desktop keeps two columns.
const COMPACT = "(max-width: 1023px)";
function useCompact() {
  return useSyncExternalStore(
    (notify) => { const mq = window.matchMedia(COMPACT); mq.addEventListener("change", notify); return () => mq.removeEventListener("change", notify); },
    () => window.matchMedia(COMPACT).matches, () => false);
}

export function PlanningLab({ scopes }: { scopes: LabScope[] }) {
  const compact = useCompact();
  const [code, setCode] = useState("ALL");
  const [levers, setLevers] = useState<Levers>(DEFAULT_LEVERS);
  const [pins, setPins] = useState<{ name: string; levers: Levers }[]>([]);
  const s = scopes.find((x) => x.code === code)!;
  const base = useMemo(() => ({ forecast: s.forecast.map((p) => p.v), hires: s.hires, exits: s.exits, retirementShare: s.retirementShare }), [s]);
  const sim = useMemo(() => simulate(base, levers), [base, levers]);
  const start = s.origin;
  const rates = annualRates(base, levers, start.v);
  const outside = rates.hireRate < s.hireRange[0] || rates.hireRate > s.hireRange[1] || rates.exitRate < s.exitRange[0] || rates.exitRate > s.exitRange[1];
  const changed = JSON.stringify(levers) !== JSON.stringify(DEFAULT_LEVERS);
  const at = (i: number) => ({ f: s.forecast[i].v, sc: sim.path[i] });
  const m12 = at(11), m24 = at(s.forecast.length - 1);

  const pathSeries = (name: string, l: Levers, color: string, key: string): Series => ({
    key, label: name, color, points: [{ t: start.t, v: start.v },
      ...simulate(base, l).path.map((v, i) => ({ t: s.forecast[i].t, v }))],
  });
  const series: Series[] = [
    { key: "h", label: "Observed", color: "var(--accent)", points: s.history },
    { key: "f", label: "Forecast", color: "var(--accent)", dashed: true, points: [{ t: start.t, v: start.v, lo: start.v, hi: start.v, lo2: start.v, hi2: start.v },
      ...s.forecast.map((p) => ({ t: p.t, v: p.v, lo: p.lo80, hi: p.hi80, lo2: p.lo95, hi2: p.hi95 }))] },
    ...pins.map((p, i) => pathSeries(p.name, p.levers, PIN_COLORS[i], `pin${i}`)),
    ...(changed ? [pathSeries("Scenario", levers, "var(--teal)", "sc")] : []),
  ];
  const set = (k: keyof Levers) => (e: React.ChangeEvent<HTMLInputElement>) => setLevers({ ...levers, [k]: Number(e.target.value) });

  return (
    <div className="grid grid-cols-12 gap-x-0 lg:gap-x-12 gap-y-6 lg:gap-y-10">
      <div className="col-span-12">
        <label className="t-micro text-ink-3 font-medium block mb-2" htmlFor="scope">Department</label>
        <select id="scope" value={code} onChange={(e) => { setCode(e.target.value); setPins([]); setLevers(DEFAULT_LEVERS); }}
          className="field t-small box-border max-w-full min-w-[min(100%,360px)]">
          {scopes.map((x) => <option key={x.code} value={x.code}>{x.name}</option>)}
        </select>
      </div>

      <div className="lab-panel col-span-12 lg:col-span-8 lg:row-start-2">
        <Legend items={[{ label: "Observed", color: "var(--accent)" }, { label: "Forecast", color: "var(--accent)", dashed: true },
          { label: "80% range", color: "var(--accent)", range: "inner" }, { label: "95% range", color: "var(--accent)", range: "outer" },
          ...(changed ? [{ label: "Scenario", color: "var(--teal)" }] : []), ...pins.map((p, i) => ({ label: p.name, color: PIN_COLORS[i] }))]} />
        <LineChart key={code} label={`${s.name}: observed headcount, forecast and scenarios`} yFormat="compact" valueFormat="int" height={compact ? 200 : 360}
          divider={{ t: start.t, label: "Forecast" }} series={series} />
        {s.history[s.history.length - 1].t !== start.t && <p className="t-micro text-ink-3 mt-2">The forecast starts from {monthName(start.t)}:
          OPM reports later months incomplete for at least one department.</p>}
        <dl className="lab-kpis grid grid-cols-3 gap-x-4 lg:gap-x-6 mt-3 lg:mt-6 border-t border-rule pt-3 lg:pt-5">
          <div><dt className="t-micro text-ink-3">Now, {monthName(start.t)}</dt><dd className="t-stat mt-1">{int(start.v)}</dd></div>
          <div><dt className="t-micro text-ink-3">{changed ? "Scenario" : "Forecast"}, {monthName(s.forecast[11].t)}</dt>
            <dd className="t-stat mt-1">{changed ? int(m12.sc) : compactN(m12.f)}</dd>
            {!changed && <dd className="t-micro text-ink-2 mt-1">80% range {compactN(s.forecast[11].lo80)}–{compactN(s.forecast[11].hi80)}</dd>}
            {changed && <dd className="t-micro text-ink-2 mt-1">{signedInt(Math.round(m12.sc - m12.f))} <span className="max-sm:hidden">against the forecast</span><span className="sm:hidden">vs forecast</span></dd>}</div>
          <div><dt className="t-micro text-ink-3">{changed ? "Scenario" : "Forecast"}, {monthName(s.forecast[s.forecast.length - 1].t)}</dt>
            <dd className="t-stat mt-1">{changed ? int(m24.sc) : compactN(m24.f)}</dd>
            {!changed && <dd className="t-micro text-ink-2 mt-1">80% range {compactN(s.forecast[s.forecast.length - 1].lo80)}–{compactN(s.forecast[s.forecast.length - 1].hi80)}</dd>}
            {changed && <dd className="t-micro text-ink-2 mt-1">{signedInt(Math.round(m24.sc - m24.f))} <span className="max-sm:hidden">against the forecast</span><span className="sm:hidden">vs forecast</span></dd>}</div>
        </dl>
      </div>

      <form className="col-span-12 lg:col-span-4 lg:col-start-9 lg:row-start-2 space-y-6" onSubmit={(e) => e.preventDefault()} aria-label="Scenario levers">
        <div className="flex items-center justify-between"><h3 className="t-small font-semibold">What if…</h3><Mark kind="modeled" /></div>
        <Lever id="hiring" label="New hiring" value={levers.hiring} min={0} max={1.5} step={0.05} onChange={set("hiring")} at={DEFAULT_LEVERS.hiring}
          show={(v) => `${Math.round(v * 100)}% of forecast`} />
        <Lever id="otherExits" label="Quits and other exits" value={levers.otherExits} min={0.5} max={2} step={0.05} onChange={set("otherExits")} at={DEFAULT_LEVERS.otherExits}
          show={(v) => `${Math.round(v * 100)}% of forecast`} />
        <Lever id="retirements" label="Retirements" value={levers.retirements} min={0.5} max={3} step={0.1} onChange={set("retirements")} at={DEFAULT_LEVERS.retirements}
          show={(v) => `${Math.round(v * 100)}% of forecast`} />
        <Lever id="oneTimeExit" label="One-time reduction" value={levers.oneTimeExit} min={0} max={Math.round(start.v * 0.1 / 100) * 100 || 100}
          step={Math.max(10, Math.round(start.v * 0.005 / 10) * 10)} onChange={set("oneTimeExit")} show={(v) => (v ? `${int(v)} people` : "None")} />
        {levers.oneTimeExit > 0 && (
          <Lever id="oneTimeMonth" label="…in month" value={levers.oneTimeMonth} min={1} max={12} step={1} onChange={set("oneTimeMonth")}
            show={(v) => monthName(s.forecast[v - 1].t)} />
        )}
        <p className={`t-micro ${outside && changed ? "text-ink" : "text-ink-3"}`} role="status">
          {changed ? "This scenario implies" : "The forecast implies"} a hiring rate of {rates.hireRate.toFixed(1)}% and an exit rate of
          {" "}{rates.exitRate.toFixed(1)}% a year{outside ? ", outside every 12-month rate seen since 2012 (latest months are first releases)." : ", within the range seen since 2012."}
        </p>
        <div className="flex flex-wrap gap-3">
          <button type="button" disabled={!changed || pins.length >= 3} className="seg-btn"
            onClick={() => setPins([...pins, { name: `Scenario ${String.fromCharCode(65 + pins.length)}`, levers }])}>Keep for comparison</button>
          <button type="button" disabled={!changed && !pins.length} className="seg-btn" onClick={() => { setLevers(DEFAULT_LEVERS); setPins([]); }}>Reset</button>
        </div>
        <p className="t-micro text-ink-3">Over the next 12 months the forecast assumes {int(s.parts12.hires)} hires and {int(s.parts12.exits)} exits;
          the remaining {signedInt(s.parts12.other)} is other change (transfers, reorganisations and the gap between processed actions and headcount).
          A scenario scales those hires and exits and carries the difference forward.
          It assumes nothing else reacts: no rehiring after a reduction, no change in who leaves.</p>
      </form>
    </div>
  );
}

function Lever({ id, label, value, min, max, step, onChange, show, at }: {
  at?: number; id: string; label: string; value: number; min: number; max: number; step: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; show: (v: number) => string;
}) {
  return (
    <div>
      <div className="flex justify-between t-small"><label htmlFor={id} className="text-ink-2">{label}</label><output htmlFor={id} className="font-medium">{show(value)}</output></div>
      {/* The tick marks the default (the forecast itself), so 100% sits visibly at the same meaning on every track. */}
      <div className={at != null ? "tick mt-2" : "mt-2"} style={at != null ? { "--f": (at - min) / (max - min) } as React.CSSProperties : undefined}>
        <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={onChange} className="range" />
      </div>
    </div>
  );
}

