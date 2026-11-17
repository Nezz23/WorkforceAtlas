import type { Metadata } from "next";
import { Newsreader, Public_Sans } from "next/font/google";
import { Header } from "@/components/Header";
import { manifest, scopes } from "@/lib/data";
import { titleCase } from "@/lib/format";
import { AUTHOR } from "@/lib/site";
import "./globals.css";

const serif = Newsreader({ variable: "--font-newsreader", subsets: ["latin"], weight: ["400", "500"], display: "swap" });
const sans = Public_Sans({ variable: "--font-public-sans", subsets: ["latin"], weight: ["400", "500", "600"], display: "swap" });

const DESCRIPTION = "The changing federal workforce, measured from OPM's Federal Workforce Data.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3100"),
  title: { default: "Workforce Atlas", template: "%s · Workforce Atlas" },
  description: DESCRIPTION,
  authors: [{ name: AUTHOR.name, ...(AUTHOR.linkedin ? { url: AUTHOR.linkedin } : {}) }],
  openGraph: { type: "website", siteName: "Workforce Atlas", title: "Workforce Atlas", description: DESCRIPTION },
  twitter: { card: "summary", title: "Workforce Atlas", description: DESCRIPTION },
};

// Light is the default; a saved choice is applied before first paint so the page never flashes.
const THEME = `(function(){try{var t=localStorage.getItem("theme");if(t)document.documentElement.dataset.theme=t}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  const m = manifest();
  const list = scopes().map((s) => ({ code: s.code, name: titleCase(s.name) }));
  return (
    <html lang="en" data-theme="light" className={`${serif.variable} ${sans.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME }} /></head>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-3 focus:bg-paper">Skip to content</a>
        <Header scopes={list} />
        <main id="main" className="wrap">{children}</main>
        <footer className="wrap mt-24">
          <div className="py-10 border-t border-rule t-micro text-ink-3 space-y-3">
            <p className="text-ink-2">
              Built by{" "}
              {AUTHOR.linkedin
                ? <a className="link font-medium text-ink" href={AUTHOR.linkedin} rel="author noopener" target="_blank">{AUTHOR.name}</a>
                : <span className="font-medium text-ink">{AUTHOR.name}</span>}
              {" "}<span aria-hidden className="mx-1.5 text-rule-strong">|</span>{" "}
              Code available on request
            </p>
            <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
              <span>Source: U.S. Office of Personnel Management, Federal Workforce Data, {m.months[0]} to {m.months[1]}.</span>
              <span>Published {m.published_at.slice(0, 10)} · An independent analysis, not affiliated with OPM</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
