"use client";
// Shared chart parts: width measurement, hover tooltip, axis ticks. Every chart is hand-drawn SVG on these.
import { useEffect, useRef, useState, type ReactNode } from "react";

export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

export type Tip = { x: number; y: number; content: ReactNode } | null;

/** Positions a tooltip inside the chart box, flipping left when it would overflow. `minLeft` keeps it off a label column. */
export function Tooltip({ tip, width, minLeft = 0 }: { tip: Tip; width: number; minLeft?: number }) {
  if (!tip) return null;
  let left = tip.x + 276 > width ? tip.x - 268 : tip.x + 14;
  if (left < minLeft) left = Math.max(minLeft, width - 264);
  return (
    <div className="tip" role="status" style={{ left: Math.max(0, left), top: Math.max(0, tip.y - 12) }}>
      {tip.content}
    </div>
  );
}

export function TipRow({ label, value, swatch }: { label: ReactNode; value: ReactNode; swatch?: string }) {
  return (
    <div className="row">
      <span className="flex items-center gap-1.5">
        {swatch && <span aria-hidden style={{ width: 8, height: 8, background: swatch, display: "inline-block" }} />}
        {label}
      </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

/** Box that reserves the chart's height before it is measured, so nothing jumps. */
export function ChartBox({ height, children, label }: {
  height: number; label: string; children: (width: number) => ReactNode;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  return (
    <div ref={ref} className="relative chart" style={{ minHeight: height }} role="figure" aria-label={label}>
      {width > 0 && children(width)}
    </div>
  );
}

/** One right-edge convention: every chart's rules and axes run to `width - M.right`. A chart with direct end labels
 *  ends its data `END_LABEL` px short of that edge and writes the labels in the gap, so the rules still line up. */
export const M = { top: 16, right: 16, bottom: 28, left: 52 };
export const END_LABEL = 104;

export function YGrid({ ticks, y, x0, x1, fmt }: {
  ticks: number[]; y: (v: number) => number; x0: number; x1: number; fmt: (v: number) => string;
}) {
  return (
    <g className="grid">
      {ticks.map((t) => (
        <g key={t} transform={`translate(0,${y(t)})`}>
          <line x1={x0} x2={x1} />
          <text x={x0 - 8} dy="0.32em" textAnchor="end">{fmt(t)}</text>
        </g>
      ))}
    </g>
  );
}
