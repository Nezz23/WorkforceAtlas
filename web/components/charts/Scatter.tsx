"use client";
// Two measures per department, one dot each, sized by headcount, with reference lines.
import { extent } from "d3-array";
import { scaleLinear, scaleSqrt } from "d3-scale";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { fmt, type Fmt } from "@/lib/format";
import { ChartBox, M, Tooltip, type Tip } from "./kit";

export type Dot = { key: string; label: string; x: number; y: number; size: number; href?: string; tip?: ReactNode; labelled?: boolean };

export function Scatter({ dots, xLabel, yLabel, xFormat, yFormat, yRef, label, height = 420 }: {
  dots: Dot[]; xLabel: string; yLabel: string; xFormat: Fmt; yFormat: Fmt; yRef?: { value: number; label: string }; label: string; height?: number;
}) {
  return <ChartBox height={height} label={label}>{(width) => <Plot {...{ dots, xLabel, yLabel, height, width, yRef }} xF={fmt[xFormat]} yF={fmt[yFormat]} />}</ChartBox>;
}

function Plot({ dots, xLabel, yLabel, xF, yF, yRef, height, width }: {
  dots: Dot[]; xLabel: string; yLabel: string; xF: (v: number) => string; yF: (v: number) => string;
  yRef?: { value: number; label: string }; height: number; width: number;
}) {
  const [tip, setTip] = useState<Tip>(null);
  const [hover, setHover] = useState<string | null>(null);
  const m = { ...M, left: 56, bottom: 44, right: 24, top: 24 };
  const [x0, x1] = extent(dots, (d) => d.x) as [number, number];
  const [y0, y1] = extent([...dots.map((d) => d.y), yRef?.value ?? dots[0].y]) as [number, number];
  const x = scaleLinear().domain([Math.min(0, x0), x1 * 1.08]).nice().range([m.left, width - m.right]);
  const y = scaleLinear().domain([Math.min(0, y0), y1 * 1.1]).nice().range([height - m.bottom, m.top]);
  const r = scaleSqrt().domain([0, Math.max(...dots.map((d) => d.size))]).range([3, width < 560 ? 16 : 26]);
  const sorted = [...dots].sort((a, b) => b.size - a.size);
  const placed: { x0: number; x1: number; y: number }[] = [];
  const labelPos = new Map<string, { x: number; anchor: "start" | "end" }>();
  for (const d of sorted.filter((q) => q.labelled)) {
    const w = d.label.length * 6.4, rr = r(d.size) + 4;
    const right = x(d.x) + rr + w < width - m.right;
    const x0 = right ? x(d.x) + rr : x(d.x) - rr - w;
    if (placed.some((p) => Math.abs(p.y - y(d.y)) < 14 && x0 < p.x1 && x0 + w > p.x0)) continue;
    placed.push({ x0, x1: x0 + w, y: y(d.y) });
    labelPos.set(d.key, { x: right ? x(d.x) + rr : x(d.x) - rr, anchor: right ? "start" : "end" });
  }
  return (
    <>
      <svg width={width} height={height}>
        <g className="grid">
          {y.ticks(5).map((t) => <g key={t}><line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} /><text x={m.left - 8} y={y(t)} dy="0.32em" textAnchor="end">{yF(t)}</text></g>)}
          {x.ticks(width < 560 ? 4 : 6).map((t) => <text key={t} x={x(t)} y={height - m.bottom + 18} textAnchor="middle">{xF(t)}</text>)}
        </g>
        <text x={width - m.right} y={height - 6} textAnchor="end" className="label-ink">{xLabel} →</text>
        <text x={m.left} y={12} className="label-ink">↑ {yLabel}</text>
        {yRef && <g><line x1={m.left} x2={width - m.right} y1={y(yRef.value)} y2={y(yRef.value)} stroke="var(--ink)" strokeDasharray="4 3" />
          <text x={width - m.right} y={y(yRef.value) - 6} textAnchor="end" className="label-strong halo">{yRef.label}</text></g>}
        {sorted.map((d) => {
          const c = (
            <g key={d.key} opacity={hover && hover !== d.key ? 0.35 : 1} style={{ transition: "opacity 160ms ease-out" }}
              onPointerMove={() => { setHover(d.key); setTip({ x: x(d.x), y: y(d.y), content: d.tip }); }}
              onPointerLeave={() => { setHover(null); setTip(null); }}>
              <circle cx={x(d.x)} cy={y(d.y)} r={r(d.size)} fill="var(--accent)" fillOpacity={0.2} stroke="var(--accent)" strokeWidth={1.25} />
              {labelPos.has(d.key) && <text x={labelPos.get(d.key)!.x} y={y(d.y)} dy="0.32em" textAnchor={labelPos.get(d.key)!.anchor}
                className="label-ink halo">{d.label}</text>}
            </g>
          );
          return d.href ? <Link key={d.key} href={d.href} aria-label={d.label}>{c}</Link> : c;
        })}
      </svg>
      <Tooltip tip={tip} width={width} />
    </>
  );
}
