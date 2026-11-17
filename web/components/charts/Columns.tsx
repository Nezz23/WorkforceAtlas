"use client";
import { max, min } from "d3-array";
import { scaleBand, scaleLinear } from "d3-scale";
import { useState, type ReactNode } from "react";
import { fmt, type Fmt } from "@/lib/format";
import { ChartBox, M, Tooltip, TipRow, YGrid, type Tip } from "./kit";

export type Stack = { key: string; label: string; color: string };
export type Column = { x: string; values: Record<string, number>; highlight?: boolean; note?: ReactNode };

/** Stacked columns with an optional reference line (e.g. a historical median). */
export function StackedColumns({ columns, stacks, yFormat: yKey, reference, height = 300, label, xEvery = 1 }: {
  columns: Column[]; stacks: Stack[]; yFormat: Fmt; height?: number; label: string;
  reference?: { value: number; label: string }; xEvery?: number;
}) {
  return (
    <ChartBox height={height} label={label}>
      {(width) => <Stacked {...{ columns, stacks, reference, height, width, xEvery }} yFormat={fmt[yKey]} />}
    </ChartBox>
  );
}

function Stacked({ columns, stacks, yFormat, reference, height, width, xEvery }: {
  columns: Column[]; stacks: Stack[]; yFormat: (v: number) => string; height: number; width: number; xEvery: number;
  reference?: { value: number; label: string };
}) {
  const [tip, setTip] = useState<Tip>(null);
  const [hover, setHover] = useState<string | null>(null);
  const m = { ...M, right: 16 };
  const total = (c: Column) => stacks.reduce((s, k) => s + (c.values[k.key] ?? 0), 0);
  const x = scaleBand().domain(columns.map((c) => c.x)).range([m.left, width - m.right]).paddingInner(0.28).paddingOuter(0.1);
  const y = scaleLinear().domain([0, Math.max(max(columns, total)!, reference?.value ?? 0) * 1.06]).nice(5)
    .range([height - m.bottom, m.top]);
  const every = Math.max(xEvery, Math.ceil(columns.length / Math.max(1, Math.floor(width / 52))));

  return (
    <>
      <svg width={width} height={height}>
        <YGrid ticks={y.ticks(5)} y={y} x0={m.left} x1={width - m.right} fmt={yFormat} />
        {columns.map((c, i) => {
          let acc = 0;
          const bx = x(c.x)!;
          const dim = hover && hover !== c.x;
          return (
            <g key={c.x} opacity={dim ? 0.45 : 1} style={{ transition: "opacity 160ms ease-out" }}>
              {stacks.map((s) => {
                const v = c.values[s.key] ?? 0;
                if (!v) return null;
                const y0 = y(acc), y1 = y(acc + v);
                acc += v;
                return <rect key={s.key} x={bx} width={x.bandwidth()} y={y1} height={Math.max(0, y0 - y1 - 1)}
                  fill={s.color} opacity={c.highlight === false ? 0.55 : 1} />;
              })}
              {i % every === 0 && <text x={bx + x.bandwidth() / 2} y={height - 8} textAnchor="middle"
                className={c.highlight ? "label-strong" : undefined}>{c.x}</text>}
              <rect x={bx - (x.step() - x.bandwidth()) / 2} width={x.step()} y={m.top} height={height - m.top - m.bottom}
                fill="transparent"
                onPointerMove={() => {
                  setHover(c.x);
                  setTip({
                    x: bx + x.bandwidth() / 2, y: y(total(c)),
                    content: (
                      <>
                        <div className="font-semibold mb-1">{c.x}</div>
                        {[...stacks].reverse().map((s) => (c.values[s.key] ?? 0) > 0 &&
                          <TipRow key={s.key} swatch={s.color} label={s.label} value={yFormat(c.values[s.key])} />)}
                        {stacks.length > 1 && <TipRow label="Total" value={yFormat(total(c))} />}
                        {c.note && <div className="muted mt-1">{c.note}</div>}
                      </>
                    ),
                  });
                }}
                onPointerLeave={() => { setTip(null); setHover(null); }} />
            </g>
          );
        })}
        <line className="baseline" x1={m.left} x2={width - m.right} y1={y(0)} y2={y(0)} />
        {reference && (
          <g transform={`translate(0,${y(reference.value)})`}>
            <line x1={m.left} x2={width - m.right} stroke="var(--ink)" strokeDasharray="4 3" />
            <text x={m.left + 6} dy="-0.5em" className="label-strong">{reference.label}</text>
          </g>
        )}
      </svg>
      <Tooltip tip={tip} width={width} />
    </>
  );
}

/** Monthly bars around zero, coloured by sign (e.g. net flow: hires minus exits). */
export function DivergingColumns({ points, yFormat: yKey, labelX: xKey, height = 260, label, pos, neg, posLabel, negLabel }: {
  points: { x: number; v: number }[]; yFormat: Fmt; labelX: Fmt;
  height?: number; label: string; pos: string; neg: string; posLabel: string; negLabel: string;
}) {
  return (
    <ChartBox height={height} label={label}>
      {(width) => {
        const m = { ...M, right: 16 };
        const yFormat = fmt[yKey], labelX = fmt[xKey];
        const x = scaleBand().domain(points.map((p) => String(p.x))).range([m.left, width - m.right]).paddingInner(0.2);
        const lo = Math.min(0, min(points, (p) => p.v)!), hi = Math.max(0, max(points, (p) => p.v)!);
        const y = scaleLinear().domain([lo, hi]).nice(5).range([height - m.bottom, m.top]);
        const years = points.filter((p) => p.x % 100 === 1 && Math.floor(p.x / 100) % (width < 600 ? 4 : 2) === 0);
        return <Diverging {...{ points, yFormat, labelX, height, width, m, x, y, years, pos, neg, posLabel, negLabel }} />;
      }}
    </ChartBox>
  );
}

function Diverging({ points, yFormat, labelX, height, width, m, x, y, years, pos, neg, posLabel, negLabel }: {
  points: { x: number; v: number }[]; yFormat: (v: number) => string; labelX: (x: number) => string; height: number;
  width: number; m: typeof M; x: ReturnType<typeof scaleBand<string>>; y: ReturnType<typeof scaleLinear<number, number>>;
  years: { x: number }[]; pos: string; neg: string; posLabel: string; negLabel: string;
}) {
  const [tip, setTip] = useState<Tip>(null);
  return (
    <>
      <svg width={width} height={height}>
        <YGrid ticks={y.ticks(5)} y={y} x0={m.left} x1={width - m.right} fmt={yFormat} />
        {points.map((p) => (
          <rect key={p.x} x={x(String(p.x))} width={Math.max(1, x.bandwidth())} y={Math.min(y(0), y(p.v))}
            height={Math.abs(y(p.v) - y(0))} fill={p.v >= 0 ? pos : neg}
            onPointerMove={() => setTip({
              x: x(String(p.x))!, y: y(Math.max(0, p.v)),
              content: <><div className="font-semibold mb-1">{labelX(p.x)}</div>
                <TipRow swatch={p.v >= 0 ? pos : neg} label={p.v >= 0 ? posLabel : negLabel} value={yFormat(p.v)} /></>,
            })}
            onPointerLeave={() => setTip(null)} />
        ))}
        <line className="baseline" x1={m.left} x2={width - m.right} y1={y(0)} y2={y(0)} />
        {years.map((p) => (
          <text key={p.x} x={x(String(p.x))} y={height - 8} textAnchor="start">{Math.floor(p.x / 100)}</text>
        ))}
      </svg>
      <Tooltip tip={tip} width={width} />
    </>
  );
}
