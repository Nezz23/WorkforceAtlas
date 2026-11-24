// WCAG 2.2 AA scan of every main page in both themes with axe-core.
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const b = await chromium.launch();
let total = 0;
for (const theme of ["light", "dark"]) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript((t) => localStorage.setItem("theme", t), theme);
  const p = await ctx.newPage();
  for (const path of ["/", "/mobility/", "/planning/", "/compensation/", "/methods/", "/d/TR/", "/brief/"]) {
    await p.goto(BASE + path, { waitUntil: "networkidle" });
    const r = await new AxeBuilder({ page: p }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    total += r.violations.length;
    console.log(`${theme} ${path}: ${r.violations.length} violations`);
    for (const v of r.violations) console.log(`   ${v.id} (${v.nodes.length}): ${v.nodes[0].target} — ${v.nodes[0].failureSummary?.split("\n")[1] ?? ""}`);
  }
  await ctx.close();
}
await b.close();
process.exit(total ? 1 : 0);
