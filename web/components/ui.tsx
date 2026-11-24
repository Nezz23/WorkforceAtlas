// Page structure shared by every story page. Server components unless marked.
import type { ReactNode } from "react";

export type TrustKind = "observed" | "derived" | "modeled";

export function Mark({ kind }: { kind: TrustKind }) {
  return <span className="mark" data-kind={kind}>{kind}</span>;
}

/** Page masthead: kicker, serif headline, lead sentence(s) built from facts. */
export function Masthead({ kicker, title, lead, meta, contents }: {
  kicker: string; title: ReactNode; lead?: ReactNode; meta?: ReactNode; contents?: { id: string; label: string }[];
}) {
  return (
    <header className="pt-16 pb-12 max-sm:pt-10 max-sm:pb-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <p className="t-kicker">{kicker}</p>
        {meta && <p className="t-micro text-ink-3">{meta}</p>}
      </div>
      <div className="grid grid-cols-12 gap-x-8 max-lg:gap-x-0 mt-4">
        <div className="col-span-8 max-lg:col-span-12">
          <h1 className="t-display max-w-[26ch]">{title}</h1>
          {lead && <div className="t-lead text-ink-2 mt-6 measure">{lead}</div>}
        </div>
        {contents && (
          <nav aria-label="In this report" className="col-span-3 col-start-9 max-lg:hidden self-end border-l border-rule pl-6 mb-1">
            <p className="t-micro text-ink-3 font-medium mb-3">In this report</p>
            <ol className="t-small space-y-2">
              {contents.map((c, i) => (
                <li key={c.id}>
                  <a href={`#${c.id}`} className="group flex gap-3 text-ink-2 hover:text-ink transition-colors">
                    <span className="text-ink-3 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                    <span className="group-hover:underline underline-offset-4 decoration-rule-strong">{c.label}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        )}
      </div>
    </header>
  );
}

/** A numbered story chapter: the kicker names the topic, the headline states the finding. */
export function Chapter({ n, kicker, title, children, id }: {
  n?: number; kicker: string; title: ReactNode; children: ReactNode; id?: string;
}) {
  return (
    <section className="chapter" id={id} aria-labelledby={id ? `${id}-h` : undefined}>
      <p className="t-kicker">{n != null && <span className="text-ink">{String(n).padStart(2, "0")}</span>}
        {n != null && <span aria-hidden> · </span>}{kicker}</p>
      <h2 className="t-head mt-3 measure" id={id ? `${id}-h` : undefined}>{title}</h2>
      <div className="mt-8">{children}</div>
    </section>
  );
}

/** A chart with its question, trust mark, answer and method note. The mark sits with the answer on every size. */
export function Figure({ question, answer, kind, note, children, aside }: {
  question: string; answer?: ReactNode; kind: TrustKind; note?: ReactNode; children: ReactNode; aside?: ReactNode;
}) {
  return (
    <figure className="m-0">
      <h3 className="t-small font-semibold text-ink">{question}</h3>
      <div className="mt-1 mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Mark kind={kind} />
        {answer && <p className="t-small text-ink-2 measure">{answer}</p>}
      </div>
      {children}
      {(note || aside) && (
        <figcaption className="mt-5 flex flex-wrap justify-between gap-x-8 gap-y-3 t-micro text-ink-3">
          <span className="measure">{note}</span>{aside}
        </figcaption>
      )}
    </figure>
  );
}

/** Headline figures: one lead number set large in the serif, supporting figures at reading size. No tiles.
 *  Every figure is label / value / detail on three shared grid rows, with the values aligned on their text baseline,
 *  so a longer label or a larger lead number never shifts its neighbours. */
export function Figures({ items }: {
  items: { label: string; value: ReactNode; detail?: ReactNode; kind?: TrustKind }[];
}) {
  return (
    <dl className="figures border-t border-rule pt-8 pb-12 max-sm:pb-8">
      {items.map((it, i) => (
        <div key={it.label} className={i === 0 ? "figure figure-lead" : "figure"}>
          <dt className="t-micro text-ink-3 font-medium">{it.label}{it.kind && it.kind !== "observed" && <> <Mark kind={it.kind} /></>}</dt>
          <dd className={i === 0 ? "t-display" : "t-stat"}>{it.value}</dd>
          <dd className={i === 0 ? "t-small text-ink-2" : "t-micro text-ink-2"}>{it.detail}</dd>
        </div>
      ))}
    </dl>
  );
}

/** `range`: a swatch for a forecast range, "inner" filled (80%) or "outer" outlined (95%), matching LineChart. */
export function Legend({ items }: { items: { label: string; color: string; hatch?: boolean; dashed?: boolean; range?: "inner" | "outer" }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 t-micro text-ink-2 mb-3" aria-label="Legend">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block" style={{
            width: 12, height: it.dashed ? 0 : 10, borderTop: it.dashed ? `2px dashed ${it.color}` : undefined,
            background: it.range === "inner" ? `color-mix(in srgb, ${it.color} 24%, transparent)`
              : it.range === "outer" ? `color-mix(in srgb, ${it.color} 8%, transparent)`
              : it.hatch ? `repeating-linear-gradient(135deg, ${it.color} 0 1.5px, transparent 1.5px 4px)` : it.dashed ? undefined : it.color,
            border: it.range === "outer" ? `1px dashed ${it.color}` : it.hatch ? `1px solid ${it.color}` : undefined,
          }} />
          {it.label}
        </li>
      ))}
    </ul>
  );
}

export function Split({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-16 max-lg:grid-cols-1 max-lg:gap-14">{children}</div>;
}
