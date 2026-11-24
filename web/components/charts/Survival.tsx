"use client";
// Retention curves: share still in federal service after 0-10 years, one line per period, each with its interval.
import { scaleLinear } from "d3-scale";
import { area, line } from "d3-shape";
import { useState } from "react";
import { ChartBox, M, Tooltip, TipRow, YGrid, type Tip } from "./kit";

type Pt = { year: number; v: number; lo: number; hi: number };
export type Curve = { key: string; label: string; color: string; points: Pt[]; emphasis?: boolean; compare?: boolean };
/** Strong curves (the current period and one comparison) carry colour, a band and weight; the rest stay quiet grey. */
const strong = (c: Curve) => !!(c.emphasis || c.compare);

export function Survival({ curves, label, height = 340 }: { curves: Curve[]; label: string; height?: number }) {
  return <ChartBox height={height} label={label}>{(width) => <Plot curves={curves} width={width} height={height} />}</ChartBox>;
}

function Plot({ curves, width, height }: { curves: Curve[]; width: number; height: number }) {
  const [tip, setTip] = useState<Tip>(null);
  const [year, setYear] = useState<number | null>(null);
  const narrow = width < 560;
  const m = { ...M, left: 48, right: narrow ? M.right : 164 };
  const x = scaleLinear().domain([0, 10]).range([m.left, width - m.right]);
  const y = scaleLinear().domain([0, 100]).range([height - m.bottom, m.top]);
  const path = line<Pt>().x((p) => x(p.year)).y((p) => y(p.v));
  const band = area<Pt>().x((p) => x(p.year)).y0((p) => y(p.lo)).y1((p) => y(p.hi));
  const ends = curves.map((c) => ({ c, y0: y(c.points[10].v), y: y(c.points[10].v) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 15) ends[i].y = ends[i - 1].y + 15;
  // Quiet curves draw first so the strong ones sit on top.
  const drawn = [...curves].sort((a, b) => Number(strong(a)) - Number(strong(b)));
  return (
    <>
      <svg width={width} height={height}>
        <YGrid ticks={[0, 25, 50, 75, 100]} y={y} x0={m.left} x1={width - M.right} fmt={(v) => `${v}%`} />
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter((t) => !narrow || t % 2 === 0).map((t) => (
          <text key={t} x={x(t)} y={height - 8} textAnchor="middle">{t === 0 ? "Hire" : `${t}y`}</text>
        ))}
        {drawn.filter(strong).map((c) => <path key={`b-${c.key}`} d={band(c.points) ?? ""} fill={c.color} opacity={0.14} />)}
        {drawn.map((c) => (
          <path key={c.key} d={path(c.points) ?? ""} fill="none" stroke={c.color} strokeWidth={c.emphasis ? 2.5 : strong(c) ? 2 : 1.25}
            strokeLinejoin="round" />
        ))}
        {year != null && <line x1={x(year)} x2={x(year)} y1={m.top} y2={height - m.bottom} stroke="var(--rule-strong)" />}
        {!narrow && ends.map((e) => (
          <g key={e.c.key}>
            {/* A leader joins each label to its line's end when the label had to move to clear its neighbours. */}
            {Math.abs(e.y - e.y0) > 1 && <polyline points={`${x(10) + 3},${e.y0} ${x(10) + 9},${e.y0} ${x(10) + 15},${e.y} ${x(10) + 18},${e.y}`}
              fill="none" stroke={e.c.color} strokeWidth={1} />}
            <text x={x(10) + 22} y={e.y} dy="0.32em" className={strong(e.c) ? "label-strong halo" : "halo"}>
              {e.c.label} · {e.c.points[10].v.toFixed(0)}%
            </text>
          </g>
        ))}
        <rect x={m.left} y={m.top} width={width - m.left - m.right} height={height - m.top - m.bottom} fill="transparent"
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const yr = Math.max(0, Math.min(10, Math.round(x.invert(e.clientX - r.left + m.left))));
            setYear(yr);
            setTip({ x: x(yr), y: m.top + 8, content: <>
              <div className="font-semibold mb-1">{yr === 0 ? "At hire" : `After ${yr} year${yr > 1 ? "s" : ""}`}</div>
              {curves.map((c) => <TipRow key={c.key} swatch={c.color} label={c.label}
                value={<>{c.points[yr].v.toFixed(1)}% <span className="muted">({c.points[yr].lo.toFixed(1)}–{c.points[yr].hi.toFixed(1)})</span></>} />)}
            </> });
          }}
          onPointerLeave={() => { setTip(null); setYear(null); }} />
      </svg>
      <Tooltip tip={tip} width={width} />
      {narrow && (
        <dl className="mt-3 t-small" aria-label="Share still in service after 10 years">
          {[...curves].sort((a, b) => b.points[10].v - a.points[10].v).map((c) => (
            <div key={c.key} className="flex items-center gap-2 border-t border-rule py-1.5">
              <span aria-hidden style={{ width: 16, height: c.emphasis ? 3 : 2, background: c.color }} />
              <dt className={strong(c) ? "font-semibold" : "text-ink-2"}>{c.label}</dt>
              <dd className="ml-auto tabular-nums">{c.points[10].v.toFixed(0)}% after 10y</dd>
            </div>
          ))}
        </dl>
      )}
    </>
  );
}
