"use client";
import { bisector, max } from "d3-array";
import { scaleLinear, scaleTime } from "d3-scale";
import { area, curveMonotoneX, stack, stackOffsetExpand, stackOffsetNone, stackOrderNone } from "d3-shape";
import { timeFormat } from "d3-time-format";
import { useState } from "react";
import { fmt, monthDate, monthName, type Fmt } from "@/lib/format";
import { ChartBox, M, Tooltip, TipRow, YGrid, type Tip } from "./kit";
import type { Annotation } from "./LineChart";

export type AreaKey = { key: string; label: string; color: string };
type Row = { t: number } & Record<string, number>;

const fmtYear = timeFormat("%Y");

/** Monthly stacked areas in a fixed category order, labelled in place on wide screens. */
export function StackedArea({ rows, keys, yFormat: yKey, height = 340, label, annotations = [] }: {
  rows: Row[]; keys: AreaKey[]; yFormat: Fmt; height?: number; label: string;
  annotations?: Annotation[];
}) {
  // One spike (here, September 2025) can flatten every other month in a count view; the share view gives each month the same height.
  const [share, setShare] = useState(false);
  return (
    <div>
      <div className="seg mb-3" role="group" aria-label="Chart view">
        <button type="button" aria-pressed={!share} onClick={() => setShare(false)}>Counts</button>
        <button type="button" aria-pressed={share} onClick={() => setShare(true)}>Share of each month</button>
      </div>
      <ChartBox height={height} label={label}>
        {(width) => <Plot {...{ rows, keys, height, width, annotations, share }} yFormat={fmt[yKey]} />}
      </ChartBox>
    </div>
  );
}

function Plot({ rows, keys, yFormat: countFormat, height, width, annotations, share }: {
  rows: Row[]; keys: AreaKey[]; yFormat: (v: number) => string; height: number; width: number; annotations: Annotation[]; share: boolean;
}) {
  const [tip, setTip] = useState<Tip>(null);
  const [hover, setHover] = useState<number | null>(null);
  const m = { ...M, right: 16 };
  const yFormat = share ? (v: number) => `${Math.round(v * 100)}%` : countFormat;
  const series = stack<Row>().keys(keys.map((k) => k.key)).order(stackOrderNone).offset(share ? stackOffsetExpand : stackOffsetNone)(rows);
  const x = scaleTime().domain([monthDate(rows[0].t), monthDate(rows[rows.length - 1].t)]).range([m.left, width - m.right]);
  const y = scaleLinear().domain([0, share ? 1 : max(series[series.length - 1], (d) => d[1])!]).nice(5).range([height - m.bottom, m.top]);
  const shape = area<[number, number] & { data: Row }>().x((d) => x(monthDate(d.data.t))).y0((d) => y(d[0])).y1((d) => y(d[1]))
    .curve(curveMonotoneX);
  const ts = rows.map((r) => r.t);
  const X = (t: number) => x(monthDate(t));
  const find = bisector((v: number) => v).center;

  return (
    <>
      <svg width={width} height={height}>
        <YGrid ticks={y.ticks(5)} y={y} x0={m.left} x1={width - m.right} fmt={yFormat} />
        {x.ticks(width < 600 ? 4 : 8).map((d) => <text key={+d} x={x(d)} y={height - 8} textAnchor="middle">{fmtYear(d)}</text>)}
        {series.map((s, i) => (
          <path key={s.key} d={shape(s as never) ?? ""} fill={keys[i].color} stroke="var(--paper)" strokeOpacity={0.6} strokeWidth={0.5} />
        ))}
        {annotations.map((a) => (
          <g key={a.t} className="annot" transform={`translate(${X(a.t)},0)`}>
            <text y={m.top + 8} textAnchor="end" dx={-6} className="label-ink">{a.label}</text>
          </g>
        ))}
        {hover != null && <line x1={X(hover)} x2={X(hover)} y1={m.top} y2={height - m.bottom} stroke="var(--ink)" strokeOpacity={0.5} />}
        <line className="baseline" x1={m.left} x2={width - m.right} y1={y(0)} y2={y(0)} />
        <rect x={m.left} y={m.top} width={width - m.left - m.right} height={height - m.top - m.bottom} fill="transparent"
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const t = ts[find(ts.map(X), e.clientX - r.left + m.left)];
            const row = rows.find((q) => q.t === t)!;
            const total = keys.reduce((s, k) => s + (row[k.key] ?? 0), 0);
            setHover(t);
            setTip({
              x: X(t), y: m.top + 8,
              content: <>
                <div className="font-semibold mb-1">{monthName(t)}</div>
                {[...keys].reverse().map((k) => <TipRow key={k.key} swatch={k.color} label={k.label}
                  value={share && total ? <>{countFormat(row[k.key] ?? 0)} <span className="muted">({Math.round(100 * (row[k.key] ?? 0) / total)}%)</span></> : countFormat(row[k.key] ?? 0)} />)}
                <TipRow label="Total" value={countFormat(total)} />
              </>,
            });
          }}
          onPointerLeave={() => { setTip(null); setHover(null); }} />
      </svg>
      <Tooltip tip={tip} width={width} />
    </>
  );
}
