// A typeset list of statistically unusual months. Each line states the count, what was expected, and how unusual.
import Link from "next/link";
import type { Alert } from "@/lib/types";
import { int, monthName, titleCase } from "@/lib/format";

export function Alerts({ alerts, empty, preliminaryFrom, gap }: { alerts: Alert[]; empty: string; preliminaryFrom?: number; gap?: boolean }) {
  if (!alerts.length) return <p className="t-small text-ink-2">{empty}</p>;
  return (
    <ol className="border-t border-rule">
      {alerts.map((a) => {
        const up = a.actual > a.expected;
        return (
          <li key={`${a.scope}-${a.flow}-${a.month}`} className="grid grid-cols-12 gap-x-6 max-lg:gap-x-0 gap-y-1 py-4 border-b border-rule">
            <p className="col-span-3 max-md:col-span-12 t-micro font-semibold uppercase tracking-[0.06em] text-ink-2">
              {gap ? "Reporting gap" : a.severity === "high" ? "Highly unusual" : a.severity === "moderate" ? "" : "Sustained shift"}
              <span className={`block font-normal normal-case tracking-normal text-ink-3 ${a.severity === "moderate" && !gap ? "" : "mt-1"}`}>{monthName(a.month)}
                {preliminaryFrom != null && a.month >= preliminaryFrom && " · first release"}</span>
            </p>
            <p className="col-span-6 max-md:col-span-12 t-small">
              <Link href={a.scope === "ALL" ? "/" : `/d/${a.scope}/`} className="font-semibold link">
                {a.scope === "ALL" ? "All departments" : titleCase(a.name)}
              </Link>
              {" "}· {a.label}: <span className="font-semibold">{int(a.actual)}</span> against a usual {int(Math.round(a.expected))}
              {!gap && a.sustained && a.severity && <span className="text-ink-3">, third month in a row</span>}
            </p>
            <p className="col-span-3 max-md:col-span-12 t-small text-ink-2 md:text-right tabular-nums">
              {up ? `${a.ratio.toFixed(1)}× usual` : `${Math.round(100 * (1 - a.ratio))}% below usual`}{gap ? ", records missing" : ""}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
