"use client";
import { extent, max, min, bisector } from "d3-array";
import { scaleLinear, scaleTime } from "d3-scale";
import { area, line, curveMonotoneX } from "d3-shape";
import { timeFormat } from "d3-time-format";
import { useMemo, useState } from "react";
import { fmt, monthDate, monthName, type Fmt } from "@/lib/format";
import { ChartBox, END_LABEL, M, Tooltip, TipRow, YGrid, type Tip } from "./kit";

export type Point = { t: number; v: number | null; lo?: number | null; hi?: number | null; lo2?: number | null; hi2?: number | null };
export type Series = { key: string; label: string; color: string; points: Point[]; dashed?: boolean; muted?: boolean };
export type Annotation = { t: number; label: string; dy?: number };

type Props = {
  series: Series[];
  height?: number;
  yFormat: Fmt;
  valueFormat?: Fmt;
  annotations?: Annotation[];
  band?: { label: string; points: { t: number; lo: number; hi: number }[] };
  gap?: [string, string, string, string];   // [seriesA, seriesB, colour when A>B, colour when B>A]
  windows?: { label: string; months: number | null }[];
  zeroBased?: boolean;
  yMax?: number;
  divider?: { t: number; label: string };   // e.g. where the forecast begins
  label: string;
};

const fmtYear = timeFormat("%Y");


export function LineChart(props: Props) {
  const { windows } = props;
  const [win, setWin] = useState(windows?.[windows.length - 1]?.months ?? null);
  return (
    <div>
      {windows && (
        <div className="seg mb-3" role="group" aria-label="Time window">
          {windows.map((w) => (
            <button key={w.label} type="button" aria-pressed={win === w.months} onClick={() => setWin(w.months)}>
              {w.label}
            </button>
          ))}
        </div>
      )}
      <ChartBox height={props.height ?? 320} label={props.label}>
        {(width) => <Plot {...props} yF={fmt[props.yFormat]} vF={fmt[props.valueFormat ?? props.yFormat]} width={width} window={win} />}
      </ChartBox>
    </div>
  );
}

function Plot({ series, height = 320, yF: yFormat, vF, annotations = [], band, gap, zeroBased, yMax, divider, width, window }:
  Props & { yF: (v: number) => string; vF: (v: number) => string; width: number; window: number | null }) {
  const [tip, setTip] = useState<Tip>(null);
  const [hover, setHover] = useState<number | null>(null);
  const narrow = width < 560;
  const m = { ...M, right: narrow ? M.right : END_LABEL, left: narrow ? 52 : 60 };

  const all = useMemo(() => [...new Set(series.flatMap((s) => s.points.map((p) => p.t)))].sort((a, b) => a - b), [series]);
  const last = all[all.length - 1];
  const start = window ? all.find((t) => (Math.floor(last / 100) - Math.floor(t / 100)) * 12 + (last % 100) - (t % 100) < window) ?? all[0] : all[0];
  const inWin = (t: number) => t >= start;
  const vis = series.map((s) => ({ ...s, points: s.points.filter((p) => inWin(p.t)) }));
  const bandPts = band?.points.filter((p) => inWin(p.t)) ?? [];

  const vals = [
    ...vis.flatMap((s) => s.points.flatMap((p) => [p.v, p.lo, p.hi, p.lo2, p.hi2])),
    ...bandPts.flatMap((p) => [p.lo, p.hi]),
  ].filter((v): v is number => v != null && Number.isFinite(v));
  let lo = zeroBased ? Math.min(0, min(vals)!) : min(vals)!;
  let hi = max(vals)!;
  const pad = (hi - lo) * 0.08 || 1;
  if (!zeroBased) lo -= pad;
  hi += pad;

  const x = scaleTime().domain(extent(all.filter(inWin), monthDate) as [Date, Date]).range([m.left, width - m.right]);
  const y = scaleLinear().domain([lo, yMax ?? hi]).nice(5).range([height - m.bottom, m.top]);
  const X = (t: number) => x(monthDate(t));
  const pathOf = line<Point>().defined((p) => p.v != null).x((p) => X(p.t)).y((p) => y(p.v!)).curve(curveMonotoneX);
  const ciOf = area<Point>().defined((p) => p.lo != null && p.hi != null).x((p) => X(p.t))
    .y0((p) => y(p.lo!)).y1((p) => y(p.hi!)).curve(curveMonotoneX);
  const ci2Of = area<Point>().defined((p) => p.lo2 != null && p.hi2 != null).x((p) => X(p.t))
    .y0((p) => y(p.lo2!)).y1((p) => y(p.hi2!)).curve(curveMonotoneX);
  const bandOf = area<{ t: number; lo: number; hi: number }>().x((p) => X(p.t)).y0((p) => y(p.lo)).y1((p) => y(p.hi))
    .curve(curveMonotoneX);
  const xt = x.ticks(narrow ? 4 : 8);
  const months = all.filter(inWin);
  const find = bisector((t: number) => t).center;

  // Fill between two series, coloured by which one is higher.
  const gapPaths = (() => {
    if (!gap) return null;
    const a = vis.find((s) => s.key === gap[0])!, b = vis.find((s) => s.key === gap[1])!;
    const bm = new Map(b.points.map((p) => [p.t, p.v]));
    const pts = a.points.filter((p) => p.v != null && bm.get(p.t) != null).map((p) => ({ t: p.t, a: p.v!, b: bm.get(p.t)! }));
    const above = area<(typeof pts)[0]>().x((p) => X(p.t)).y0((p) => y(p.b)).y1((p) => y(Math.max(p.a, p.b))).curve(curveMonotoneX);
    const below = area<(typeof pts)[0]>().x((p) => X(p.t)).y0((p) => y(p.a)).y1((p) => y(Math.max(p.a, p.b))).curve(curveMonotoneX);
    return (
      <g opacity={0.22}>
        <path d={above(pts) ?? ""} fill={gap[2]} />
        <path d={below(pts) ?? ""} fill={gap[3]} />
      </g>
    );
  })();

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left + m.left;
    const t = months[find(months.map((mm) => X(mm)), px)];
    if (t == null) return;
    setHover(t);
    setTip({
      x: X(t), y: m.top + 8,
      content: (
        <>
          <div className="font-semibold mb-1">{monthName(t)}</div>
          {vis.map((s) => {
            const p = s.points.find((q) => q.t === t);
            if (!p || p.v == null) return null;
            return (
              <TipRow key={s.key} swatch={s.color} label={s.label}
                value={<>{vF(p.v)}{p.lo != null && p.hi != null &&
                  <span className="muted"> ({vF(p.lo)}–{vF(p.hi)})</span>}</>} />
            );
          })}
          {band && (() => {
            const b = bandPts.find((q) => q.t === t);
            return b ? <TipRow label={<span className="muted">{band.label}</span>}
              value={<span className="muted">{yFormat(b.lo)}–{yFormat(b.hi)}</span>} /> : null;
          })()}
        </>
      ),
    });
  }

  // End labels, nudged apart so they never overlap.
  const ends = vis.map((s) => {
    const p = [...s.points].reverse().find((q) => q.v != null);
    // A series that stops before the chart's right edge (observed data under a forecast) gets no label there: it would read as a forecast value.
    return p && p.t === s.points[s.points.length - 1].t && X(p.t) >= width - m.right - 1 ? { s, y: y(p.v!), v: p.v! } : null;
  }).filter((e): e is NonNullable<typeof e> => !!e).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 32) ends[i].y = ends[i - 1].y + 32;

  return (
    <>
      <svg width={width} height={height}>
        <YGrid ticks={y.ticks(5)} y={y} x0={m.left} x1={width - M.right} fmt={yFormat} />
        <g className="axis">
          {xt.map((d) => (
            <text key={+d} x={x(d)} y={height - 8} textAnchor="middle">{fmtYear(d)}</text>
          ))}
        </g>
        {band && <path d={bandOf(bandPts) ?? ""} fill="var(--band)" />}
        {gapPaths}
        {vis.map((s) => s.points.some((p) => p.lo2 != null) && (
          <path key={`ci2-${s.key}`} d={ci2Of(s.points) ?? ""} fill={s.color} fillOpacity={0.08} stroke={s.color} strokeOpacity={0.55}
            strokeWidth={1} strokeDasharray="3 3" />
        ))}
        {vis.map((s) => s.points.some((p) => p.lo != null) && (
          <path key={`ci-${s.key}`} d={ciOf(s.points) ?? ""} fill={s.color} opacity={0.24} />
        ))}
        {divider && inWin(divider.t) && (
          <g className="annot">
            <line x1={X(divider.t)} x2={X(divider.t)} y1={m.top} y2={height - m.bottom} stroke="var(--ink-3)" />
            <text x={X(divider.t) + (X(divider.t) > width - 72 ? -6 : 6)} textAnchor={X(divider.t) > width - 72 ? "end" : "start"} y={height - m.bottom - 8} className="label-ink halo">{divider.label}</text>
          </g>
        )}
        {annotations.filter((a) => inWin(a.t)).map((a) => (
          <g key={a.t} className="annot" transform={`translate(${X(a.t)},0)`}>
            <line y1={m.top + 14 + (a.dy ?? 0)} y2={height - m.bottom} strokeDasharray="2 3" />
            <text y={m.top + 8 + (a.dy ?? 0)} textAnchor={X(a.t) > width - 160 ? "end" : "start"} dx={X(a.t) > width - 160 ? -6 : 6}
              className="label-ink halo">{a.label}</text>
          </g>
        ))}
        {vis.map((s) => (
          <path key={s.key} d={pathOf(s.points) ?? ""} fill="none" stroke={s.color} strokeWidth={s.muted ? 1.25 : 2}
            strokeDasharray={s.dashed ? "4 3" : undefined} strokeLinejoin="round" />
        ))}
        {hover != null && (
          <g>
            <line x1={X(hover)} x2={X(hover)} y1={m.top} y2={height - m.bottom} stroke="var(--rule-strong)" />
            {vis.map((s) => {
              const p = s.points.find((q) => q.t === hover);
              return p && p.v != null ? <circle key={s.key} cx={X(hover)} cy={y(p.v)} r={4} fill={s.color}
                stroke="var(--paper)" strokeWidth={2} /> : null;
            })}
          </g>
        )}
        {!narrow && ends.map((e) => (
          <g key={e.s.key} transform={`translate(${width - m.right + 8},${e.y})`}>
            <text dy="-0.2em" className="label-strong halo">{vF(e.v)}</text>
            <text dy="1.05em" className="halo">{e.s.label}</text>
          </g>
        ))}
        <rect x={m.left} y={m.top} width={Math.max(0, width - m.left - m.right)} height={height - m.top - m.bottom}
          fill="transparent" onPointerMove={onMove} onPointerLeave={() => { setTip(null); setHover(null); }} />
      </svg>
      <Tooltip tip={tip} width={width} />
    </>
  );
}
