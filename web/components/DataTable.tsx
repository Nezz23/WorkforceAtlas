"use client";
// "View as table" for any chart: the same numbers, readable without colour or a pointer.
import { useState } from "react";

export function DataTable({ caption, columns, rows }: {
  caption: string; columns: { key: string; label: string; num?: boolean }[]; rows: Record<string, string | number | null>[];
}) {
  const [open, setOpen] = useState(false);
  const csv = () => {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const body = [columns.map((c) => esc(c.label)).join(","), ...rows.map((r) => columns.map((c) => esc(r[c.key])).join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([body], { type: "text/csv" }));
    a.download = `${caption.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <div className="flex flex-col items-end gap-3">
      <div className="flex gap-4 t-micro">
        <button type="button" className="link tap" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? "Hide table" : "View as table"}
        </button>
        <button type="button" className="link tap" onClick={csv}>Download CSV</button>
      </div>
      {open && (
        <div className="w-full max-h-80 overflow-y-auto scroll-x border-t border-rule" tabIndex={0} role="region" aria-label={`${caption}, scrollable table`}>
          <table className="data-table">
            <caption className="sr-only">{caption}</caption>
            <thead><tr>{columns.map((c) => <th key={c.key} className={c.num ? "num" : undefined} scope="col">{c.label}</th>)}</tr></thead>
            <tbody>{rows.map((r, i) => (
              <tr key={i}>{columns.map((c) => <td key={c.key} className={c.num ? "num" : undefined}>{r[c.key] ?? "—"}</td>)}</tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
