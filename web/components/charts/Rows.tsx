"use client";
// Horizontal, row-based charts: ranked bars, dumbbells (before → after), dots with intervals, paired observed/derived bars.
import { max, min } from "d3-array";
import { scaleLinear } from "d3-scale";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { fmt, type Fmt } from "@/lib/format";
import { ChartBox, Tooltip, type Tip } from "./kit";

const ROW = 30;

function useLayout(width: number, labelWidth: number) {
  const narrow = width < 560;
  const left = narrow ? 0 : labelWidth;
  return { narrow, left, right: 64, row: narrow ? ROW + 18 : ROW, labelY: narrow ? 12 : ROW / 2 };
}

function RowLabel({ label, href, x, y, narrow }: { label: string; href?: string; x: number; y: number; narrow: boolean }) {
  const text = <text x={narrow ? 0 : x - 12} y={y} dy="0.32em" textAnchor={narrow ? "start" : "end"} className="label-ink halo">{label}</text>;
  // The invisible rect makes the whole label cell the link: at least 24px tall (WCAG 2.2 target size).
  const h = narrow ? 28 : ROW;
  return href ? <Link href={href} className="row-link"><rect x={0} y={y - h / 2} width={narrow ? Math.min(x + 260, 300) : x} height={h} fill="transparent" />{text}</Link> : text;
}

function Axis({ ticks, x, y, fmt }: { ticks: number[]; x: (v: number) => number; y: number; fmt: (v: number) => string }) {
  return <g>{ticks.map((t) => <text key={t} x={x(t)} y={y} textAnchor={x(t) < 16 ? "start" : "middle"}>{fmt(t)}</text>)}</g>;
}

export type Ranked = { key: string; label: string; value: number; href?: string; tip?: ReactNode; emphasis?: boolean };

export function RankedBars({ rows, format, color, label, labelWidth = 260, reference, lollipop }: {
  rows: Ranked[]; format: Fmt; color: string; label: string; labelWidth?: number;
  reference?: { value: number; label: string }; lollipop?: boolean;
}) {
  return (
    <ChartBox height={rows.length * ROW + 32} label={label}>
      {(width) => <RankedPlot format={fmt[format]} {...{ rows, color, width, labelWidth, reference, lollipop }} />}
    </ChartBox>
  );
}

function RankedPlot({ rows, format, color, width, labelWidth, reference, lollipop }: {
  rows: Ranked[]; format: (v: number) => string; color: string; width: number; labelWidth: number;
  reference?: { value: number; label: string }; lollipop?: boolean;
}) {
  const [tip, setTip] = useState<Tip>(null);
  const L = useLayout(width, labelWidth);
  const height = rows.length * L.row + 32;
  const lo = Math.min(0, min(rows, (r) => r.value)!);
  const pad = reference ? 24 : 0;
  const x = scaleLinear().domain([lo, Math.max(max(rows, (r) => r.value)!, reference?.value ?? 0)]).nice()
    .range([L.left, width - L.right]);
  return (
    <div style={{ height: height + pad }} className="relative">
      <svg width={width} height={height + pad}><g transform={`translate(0,${pad})`}>
        {!L.narrow && x.ticks(4).map((t) => <line key={t} x1={x(t)} x2={x(t)} y1={0} y2={height - 24} stroke="var(--rule)" />)}
        {reference && <g>
          <line x1={x(reference.value)} x2={x(reference.value)} y1={-4} y2={height - 24} stroke="var(--ink)" strokeDasharray="4 3" />
          <text x={x(reference.value)} y={-10} textAnchor="middle" className="label-strong">{reference.label} {format(reference.value)}</text>
        </g>}
        {rows.map((r, i) => {
          const top = i * L.row;
          const by = top + (L.narrow ? 20 : 7);
          return (
            <g key={r.key} onPointerMove={() => r.tip && setTip({ x: x(r.value), y: top, content: r.tip })} onPointerLeave={() => setTip(null)}>
              <rect x={0} y={top} width={width} height={L.row} fill="transparent" />
              <RowLabel label={r.label} href={r.href} x={L.left} y={top + L.labelY} narrow={L.narrow} />
              {lollipop ? <>
                <line x1={x(0)} x2={x(r.value)} y1={by + (ROW - 14) / 2} y2={by + (ROW - 14) / 2} stroke={color} strokeWidth={1.5} />
                <circle cx={x(r.value)} cy={by + (ROW - 14) / 2} r={5} fill={color} stroke="var(--paper)" strokeWidth={2} />
              </> : <rect x={Math.min(x(0), x(r.value))} y={by} height={ROW - 14} width={Math.abs(x(r.value) - x(0))}
                fill={color} opacity={r.emphasis === false ? 0.5 : 1} />}
              <text x={x(Math.max(0, r.value)) + (lollipop ? 10 : 6)} y={by + (ROW - 14) / 2} dy="0.32em" className="label-strong halo">{format(r.value)}</text>
            </g>
          );
        })}
        <line className="baseline" x1={x(0)} x2={x(0)} y1={0} y2={height - 24} />
        <Axis ticks={x.ticks(4)} x={x} y={height - 8} fmt={format} />
      </g></svg>
      <Tooltip tip={tip} width={width} minLeft={L.left} />
    </div>
  );
}

export type Dumbbell = { key: string; label: string; from: number; to: number; href?: string; tip?: ReactNode };

/** Before → after per row, ordered by change; the arrowhead carries the direction. */
export function Dumbbells({ rows, format, label, labelWidth = 260, colorUp, colorDown, legend }: {
  rows: Dumbbell[]; format: Fmt; label: string; labelWidth?: number; colorUp: string; colorDown: string;
  /** Built-in key: what the hollow dot and the arrow mean, and, when the two colours differ, what each colour means. */
  legend?: { from: string; to: string; up?: string; down?: string };
}) {
  return (
    <>
      {legend && <DumbbellKey {...legend} colorUp={colorUp} colorDown={colorDown} />}
      <ChartBox height={rows.length * ROW + 32} label={label}>
        {(width) => <DumbbellPlot format={fmt[format]} {...{ rows, width, labelWidth, colorUp, colorDown }} />}
      </ChartBox>
    </>
  );
}

function DumbbellKey({ from, to, up, down, colorUp, colorDown }: {
  from: string; to: string; up?: string; down?: string; colorUp: string; colorDown: string;
}) {
  const split = colorUp !== colorDown;
  return (
    <ul className="t-micro text-ink-2 flex flex-wrap gap-x-5 gap-y-1 mb-3" aria-label="Legend">
      <li className="flex items-center gap-1.5">
        <svg width="14" height="10" aria-hidden><circle cx="7" cy="5" r="3.5" fill="var(--paper)" stroke="var(--ink-2)" strokeWidth="1.5" /></svg>{from}
      </li>
      <li className="flex items-center gap-1.5">
        <svg width="22" height="10" aria-hidden><path d="M1 5H13" stroke="var(--ink-2)" strokeWidth="2" /><path d="M21,5 l-8,-4.5 v9 z" fill="var(--ink-2)" /></svg>{to}
      </li>
      {split && up && <li className="flex items-center gap-1.5"><span aria-hidden className="inline-block w-3 h-2.5" style={{ background: colorUp }} />{up}</li>}
      {split && down && <li className="flex items-center gap-1.5"><span aria-hidden className="inline-block w-3 h-2.5" style={{ background: colorDown }} />{down}</li>}
    </ul>
  );
}

function DumbbellPlot({ rows, format, width, labelWidth, colorUp, colorDown }: {
  rows: Dumbbell[]; format: (v: number) => string; width: number; labelWidth: number; colorUp: string; colorDown: string;
}) {
  const [tip, setTip] = useState<Tip>(null);
  const L = useLayout(width, labelWidth);
  const height = rows.length * L.row + 32;
  const vals = rows.flatMap((r) => [r.from, r.to]);
  const x = scaleLinear().domain([Math.min(0, min(vals)!), Math.max(0, max(vals)!)]).nice().range([L.left, width - L.right]);
  return (
    <div style={{ height }} className="relative">
      <svg width={width} height={height}>
        {!L.narrow && x.ticks(5).map((t) => <line key={t} x1={x(t)} x2={x(t)} y1={0} y2={height - 24} stroke="var(--rule)" />)}
        <line className="baseline" x1={x(0)} x2={x(0)} y1={0} y2={height - 24} />
        {rows.map((r, i) => {
          const top = i * L.row;
          const cy = top + (L.narrow ? 32 : ROW / 2);
          const c = r.to >= r.from ? colorUp : colorDown;
          const dir = r.to >= r.from ? 1 : -1;
          return (
            <g key={r.key} onPointerMove={() => r.tip && setTip({ x: x(r.to), y: top, content: r.tip })} onPointerLeave={() => setTip(null)}>
              <rect x={0} y={top} width={width} height={L.row} fill="transparent" />
              <RowLabel label={r.label} href={r.href} x={L.left} y={top + L.labelY} narrow={L.narrow} />
              <line x1={x(r.from)} x2={x(r.to) - dir * 5} y1={cy} y2={cy} stroke={c} strokeWidth={2} />
              <circle cx={x(r.from)} cy={cy} r={3.5} fill="var(--paper)" stroke={c} strokeWidth={1.5} />
              <path d={`M${x(r.to)},${cy} l${-dir * 8},-5 v10 z`} fill={c} />
              <text x={x(Math.max(r.from, r.to)) + 10} y={cy} dy="0.32em" className="label-strong">{format(r.to)}</text>
            </g>
          );
        })}
        <Axis ticks={x.ticks(5)} x={x} y={height - 8} fmt={format} />
      </svg>
      <Tooltip tip={tip} width={width} minLeft={L.left} />
    </div>
  );
}

export type DotRow = {
  key: string; label: string; value: number | null; lo: number | null; hi: number | null;
  range?: [number, number]; group?: string; tip?: ReactNode;
};

/** A dot with its 95% interval per row, over a grey bar showing the historical range. Rows can be grouped. */
export function DotRanges({ rows, format, label, labelWidth = 200, color, rangeLabel }: {
  rows: DotRow[]; format: Fmt; label: string; labelWidth?: number; color: string; rangeLabel: string;
}) {
  const groups = [...new Set(rows.map((r) => r.group ?? ""))];
  const h = rows.length * ROW + groups.length * 36 + 40;
  return (
    <ChartBox height={h} label={label}>
      {(width) => <DotPlot format={fmt[format]} {...{ rows, width, labelWidth, color, rangeLabel, groups }} />}
    </ChartBox>
  );
}

function DotPlot({ rows, format, width, labelWidth, color, rangeLabel, groups }: {
  rows: DotRow[]; format: (v: number) => string; width: number; labelWidth: number; color: string; rangeLabel: string;
  groups: string[];
}) {
  const [tip, setTip] = useState<Tip>(null);
  const narrow = width < 560;
  const left = narrow ? 0 : labelWidth;
  const R = narrow ? ROW + 16 : ROW;      // on phones the label sits above its row
  const vals = rows.flatMap((r) => [r.value, r.lo, r.hi, ...(r.range ?? [])]).filter((v): v is number => v != null);
  const x = scaleLinear().domain([0, max(vals)!]).nice().range([left + 4, width - 16]);
  // Rows are stacked in one pass: each group is a heading, then its rows.
  const placed: { head: { g: string; y: number }; items: { r: DotRow; y: number }[] }[] = [];
  let yy = 0;
  for (const g of groups) {
    const head = { g, y: yy + 22 };
    yy += 36;
    const items: { r: DotRow; y: number }[] = [];
    for (const r of rows) {
      if ((r.group ?? "") !== g) continue;
      items.push({ r, y: yy + (narrow ? R - 12 : R / 2) });
      yy += R;
    }
    placed.push({ head, items });
  }
  const height = yy + 28;
  return (
    <div className="relative">
      <ul className="t-micro text-ink-2 flex flex-wrap gap-x-5 gap-y-1 mb-3" aria-label="Legend">
        <li className="flex items-center gap-1.5"><svg width="14" height="10" aria-hidden><circle cx="7" cy="5" r="4" fill={color} /></svg>This fiscal year</li>
        <li className="flex items-center gap-1.5"><svg width="18" height="12" aria-hidden><path d="M1 1v10M1 6h16M17 1v10" stroke="var(--ink)" strokeWidth="1.5" fill="none" /></svg>95% interval</li>
        <li className="flex items-center gap-1.5"><span aria-hidden className="inline-block w-4 h-2.5" style={{ background: "var(--band)" }} />{rangeLabel}</li>
      </ul>
      <svg width={width} height={height}>
        {x.ticks(5).map((t) => <line key={t} x1={x(t)} x2={x(t)} y1={8} y2={height - 24} stroke="var(--rule)" />)}
        {placed.map(({ head, items }) => (
          <g key={head.g}>
            {head.g && <text x={0} y={head.y} className="label-strong">{head.g}</text>}
            {items.map(({ r, y }) => (
              <g key={r.key}>
                <text x={narrow ? 0 : left - 12} y={narrow ? y - 16 : y} dy="0.32em" textAnchor={narrow ? "start" : "end"}
                  className="label-ink">{r.label}</text>
                {r.range && <rect x={x(r.range[0])} width={Math.max(2, x(r.range[1]) - x(r.range[0]))} y={y - 6} height={12}
                  fill="var(--band)" />}
                {r.value == null ? <text x={x(0)} y={y} dy="0.32em">Too few records (n &lt; 30)</text> : <>
                  {r.lo != null && r.hi != null && (
                    <path d={`M${x(r.lo)},${y - 7}v14M${x(r.lo)},${y}H${x(r.hi)}M${x(r.hi)},${y - 7}v14`} stroke="var(--ink)" strokeWidth={1.5} fill="none" />
                  )}
                  <circle cx={x(r.value)} cy={y} r={4} fill={color} stroke="var(--paper)" strokeWidth={1.5} />
                </>}
                <rect x={0} y={y - R / 2} width={width} height={R} fill="transparent"
                  onPointerMove={() => r.tip && setTip({ x: x(r.value ?? 0), y: y - 8, content: r.tip })}
                  onPointerLeave={() => setTip(null)} />
              </g>
            ))}
          </g>
        ))}
        <Axis ticks={x.ticks(narrow ? 4 : 5)} x={x} y={height - 8} fmt={format} />
      </svg>
      <Tooltip tip={tip} width={width} />
    </div>
  );
}

export type Ladder = { key: string; label: string; observed: number | null; derived: number | null; tip?: ReactNode };

/** Per row: observed value as a solid bar, derived value as a hatched bar beneath it. */
export function LadderBars({ rows, format, label, colorObserved, colorDerived }: {
  rows: Ladder[]; format: Fmt; label: string; colorObserved: string; colorDerived: string;
}) {
  return (
    <ChartBox height={rows.length * 36 + 32} label={label}>
      {(width) => <LadderPlot format={fmt[format]} {...{ rows, width, colorObserved, colorDerived }} />}
    </ChartBox>
  );
}

function LadderPlot({ rows, format, width, colorObserved, colorDerived }: {
  rows: Ladder[]; format: (v: number) => string; width: number; colorObserved: string; colorDerived: string;
}) {
  const [tip, setTip] = useState<Tip>(null);
  const left = 64, R = 36;
  const height = rows.length * R + 32;
  const x = scaleLinear().domain([0, max(rows.flatMap((r) => [r.observed ?? 0, r.derived ?? 0]))!]).nice().range([left, width - 72]);
  return (
    <div style={{ height }} className="relative">
      <svg width={width} height={height}>
        <defs>
          <pattern id="hatch" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)">
            <rect width="5" height="5" fill="var(--paper)" />
            <line x1="0" y1="0" x2="0" y2="5" stroke={colorDerived} strokeWidth="2.2" />
          </pattern>
        </defs>
        {x.ticks(4).map((t) => <line key={t} x1={x(t)} x2={x(t)} y1={0} y2={height - 24} stroke="var(--rule)" />)}
        {rows.map((r, i) => {
          const top = i * R;
          return (
            <g key={r.key}>
              <text x={left - 12} y={top + R / 2} dy="0.32em" textAnchor="end" className="label-ink">{r.label}</text>
              {r.observed != null && <>
                <rect x={left} y={top + 6} height={11} width={x(r.observed) - left} fill={colorObserved} />
                <text x={x(r.observed) + 6} y={top + 11.5} dy="0.32em" className="label-strong halo">{format(r.observed)}</text>
              </>}
              {r.derived != null && <>
                <rect x={left} y={top + 19} height={11} width={x(r.derived) - left} fill="url(#hatch)" stroke={colorDerived} strokeWidth={1} />
                <text x={x(r.derived) + 6} y={top + 24.5} dy="0.32em" className="halo">{format(r.derived)}</text>
              </>}
              <rect x={0} y={top} width={width} height={R} fill="transparent"
                onPointerMove={() => r.tip && setTip({ x: x(r.observed ?? r.derived ?? 0), y: top, content: r.tip })}
                onPointerLeave={() => setTip(null)} />
            </g>
          );
        })}
        <line className="baseline" x1={left} x2={left} y1={0} y2={height - 24} />
        <Axis ticks={x.ticks(4)} x={x} y={height - 8} fmt={format} />
      </svg>
      <Tooltip tip={tip} width={width} />
    </div>
  );
}
