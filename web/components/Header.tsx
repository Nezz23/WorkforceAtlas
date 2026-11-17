"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

const NAV = [
  { href: "/", label: "Brief" },
  { href: "/mobility", label: "Mobility" },
  { href: "/planning", label: "Planning" },
  { href: "/compensation", label: "Compensation" },
  { href: "/methods", label: "Methods" },
];

export function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2.5 shrink-0" aria-label="Workforce Atlas, home">
      {/* Three strata of a population pyramid: the mark reads as "a workforce, measured". */}
      <svg width="18" height="16" viewBox="0 0 18 16" aria-hidden>
        <rect x="0" y="0" width="18" height="3.5" fill="var(--accent)" />
        <rect x="3" y="6.25" width="12" height="3.5" fill="var(--accent)" />
        <rect x="6" y="12.5" width="6" height="3.5" fill="var(--teal)" />
      </svg>
      <span className="font-serif text-[19px] leading-none tracking-[-0.01em] font-medium">Workforce Atlas</span>
    </Link>
  );
}

export function Header({ scopes }: { scopes: { code: string; name: string }[] }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-paper">
      <div className="wrap flex h-14 items-center gap-4 lg:gap-8">
        <Wordmark />
        <nav aria-label="Primary" className="flex-1 overflow-x-auto max-lg:hidden">
          <ul className="flex gap-1">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} aria-current={active(n.href) ? "page" : undefined}
                  className={`nav-link t-small px-3 py-2 inline-block ${active(n.href) ? "text-ink font-medium" : "text-ink-2"}`}>
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2 ml-auto">
          <button type="button" onClick={() => setOpen(true)}
            className="t-small text-ink-2 border border-rule hover:border-rule-strong px-3 h-8 flex items-center gap-3 rounded-[2px] transition-colors">
            <span className="max-sm:hidden">Find a department</span><span className="sm:hidden">Search</span>
            <kbd className="t-micro text-ink-3 max-sm:hidden">⌘K</kbd>
          </button>
          <ThemeToggle />
        </div>
      </div>
      <nav aria-label="Primary mobile" className="lg:hidden border-t border-rule nav-scroll nav-mobile">
        <ul className="wrap flex">
          {NAV.map((n) => (
            <li key={n.href}>
              <Link href={n.href} aria-current={active(n.href) ? "page" : undefined}
                className={`nav-link t-small px-2 inline-flex items-center whitespace-nowrap snap-start min-h-11 ${active(n.href) ? "text-ink font-medium" : "text-ink-2"}`}>
                {n.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {open && <Palette scopes={scopes} onClose={() => setOpen(false)} />}
    </header>
  );
}

function subscribeTheme(notify: () => void) {
  const mo = new MutationObserver(notify);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}

function ThemeToggle() {
  // The inline theme script sets data-theme before paint; this reads it, so there is no state to copy and no flash.
  const dark = useSyncExternalStore(subscribeTheme, () => document.documentElement.dataset.theme === "dark", () => false);
  const flip = () => {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch {}
  };
  return (
    <button type="button" onClick={flip} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      className="h-8 w-8 grid place-items-center border border-rule hover:border-rule-strong rounded-[2px] transition-colors text-ink-2">
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
        <circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" strokeWidth="1.25" />
        <path d="M7 1a6 6 0 0 1 0 12z" fill="currentColor" />
      </svg>
    </button>
  );
}

function Palette({ scopes, onClose }: { scopes: { code: string; name: string }[]; onClose: () => void }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const items = useMemo(() => {
    const pages = NAV.map((n) => ({ href: n.href, label: n.label, kind: "Page" }));
    const depts = scopes.map((s) => ({ href: `/d/${s.code}`, label: s.name, kind: "Department" }));
    const needle = q.trim().toLowerCase();
    return [...pages, ...depts].filter((it) => !needle || it.label.toLowerCase().includes(needle)).slice(0, 9);
  }, [q, scopes]);
  useEffect(() => { ref.current?.showModal(); }, []);
  const go = (href: string) => { onClose(); router.push(href); };
  return (
    <dialog ref={ref} onClose={onClose} aria-label="Find a page or department"
      className="palette m-auto mt-[12vh] w-[min(560px,calc(100vw-32px))] bg-paper text-ink border border-rule-strong p-0 backdrop:bg-ink/20">
      <input autoFocus value={q} placeholder="Department or page" aria-label="Search"
        onChange={(e) => { setQ(e.target.value); setI(0); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setI((i + 1) % Math.max(1, items.length)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setI((i - 1 + items.length) % Math.max(1, items.length)); }
          if (e.key === "Enter" && items[i]) go(items[i].href);
        }}
        className="w-full h-12 px-4 bg-transparent border-b border-rule outline-none t-body" />
      <ul role="listbox" aria-label="Results" className="py-1">
        {items.length === 0 && <li className="px-4 py-3 t-small text-ink-3">No department matches “{q}”.</li>}
        {items.map((it, k) => (
          <li key={it.href} role="option" aria-selected={k === i}>
            <button type="button" onClick={() => go(it.href)} onPointerEnter={() => setI(k)}
              className={`w-full text-left px-4 h-10 flex items-center justify-between t-small ${k === i ? "bg-paper-2" : ""}`}>
              <span>{it.label}</span><span className="t-micro text-ink-3">{it.kind}</span>
            </button>
          </li>
        ))}
      </ul>
    </dialog>
  );
}
