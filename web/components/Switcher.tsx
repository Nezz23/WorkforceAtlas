"use client";
// Swaps between pre-rendered views of one figure (e.g. fiscal years). Only the chosen view is mounted.
import { useState, type ReactNode } from "react";

export function Switcher({ label, options, initial = 0 }: { label: string; options: { label: string; content: ReactNode }[]; initial?: number }) {
  const [i, setI] = useState(initial);
  return (
    <div>
      <div className="seg mb-4" role="group" aria-label={label}>
        {options.map((o, k) => (
          <button key={o.label} type="button" aria-pressed={k === i} onClick={() => setI(k)}>{o.label}</button>
        ))}
      </div>
      {options[i].content}
    </div>
  );
}
