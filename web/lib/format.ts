import { format } from "d3-format";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
  "November", "December"];
const SHORT = MONTHS.map((m) => m.slice(0, 3));

export const int = format(",d");
export const pct1 = (v: number) => `${v.toFixed(1)}%`;
export const signedPct = (v: number, digits = 1) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(digits)}%`;
export const signedInt = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${int(Math.abs(v))}`;
export const compact = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1e6) return `${(v / 1e6).toFixed(a >= 1e7 ? 1 : 2)}M`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(a >= 1e5 ? 0 : 1)}K`;
  return int(v);
};
export const usd = (v: number) => `$${int(Math.round(v))}`;
export const usdK = (v: number) => `$${(v / 1e3).toFixed(0)}K`;
export const monthName = (m: number) => `${MONTHS[(m % 100) - 1]} ${Math.floor(m / 100)}`;
export const monthShort = (m: number) => `${SHORT[(m % 100) - 1]} ${Math.floor(m / 100)}`;
export const monthDate = (m: number) => new Date(Math.floor(m / 100), (m % 100) - 1, 1);
export const fyOf = (m: number) => Math.floor(m / 100) + (m % 100 >= 10 ? 1 : 0);
export const titleCase = (s: string) =>
  s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase())
    .replace(/\b(Of|The|And|For|On|In|To|U\.s\.)\b/g, (w) => (w === "U.s." ? "U.S." : w.toLowerCase()))
    .replace(/^./, (c) => c.toUpperCase());

/** Formats by name, so server components can choose a chart's number format without passing a function. */
export const fmt = {
  int, compact, pct1, signedPct: (v: number) => signedPct(v), usd, usdK,
  pct0: (v: number) => `${Math.round(v)}%`,
  ratio: (v: number) => v.toFixed(2),
  years: (v: number) => `${compact(v)} yrs`,
  monthShort, monthName,
} satisfies Record<string, (v: number) => string>;
export type Fmt = keyof typeof fmt;
