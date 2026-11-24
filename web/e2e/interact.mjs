// Interaction smoke test against the running app: tooltips, time windows, table view, theme, search, keyboard.
import { chromium } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const out = process.argv[2] ?? mkdtempSync(path.join(tmpdir(), "atlas-e2e-"));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });   // includes Content-Security-Policy blocks
let failures = 0;
const check = (name, ok) => { if (!ok) failures++; console.log(`${ok ? "PASS" : "FAIL"} ${name}`); };

await page.goto(BASE + "/", { waitUntil: "networkidle" });
const chart = page.locator("#shape figure [role=figure] rect[fill=transparent]").last();
await chart.scrollIntoViewIfNeeded();
const box = await chart.boundingBox();
await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2);
check("line tooltip shows on hover", await page.locator(".tip").first().isVisible());
await page.screenshot({ path: `${out}/hover-line.png`, clip: { x: box.x - 60, y: box.y - 60, width: box.width + 160, height: box.height + 120 } });
await page.getByRole("button", { name: "Since 2019" }).click();
check("time window button toggles", (await page.getByRole("button", { name: "Since 2019" }).getAttribute("aria-pressed")) === "true");
await page.locator("#shock").getByRole("button", { name: "View as table" }).click();
check("table view opens", await page.locator("#shock table").isVisible());
const bars = page.locator("#departments a.row-link").first();
check("department rows link to profiles", (await bars.getAttribute("href"))?.startsWith("/d/"));
await page.getByRole("button", { name: /switch to dark theme/i }).click();
check("theme switches to dark", (await page.evaluate(() => document.documentElement.dataset.theme)) === "dark");
await page.reload({ waitUntil: "networkidle" });
check("theme persists after reload", (await page.evaluate(() => document.documentElement.dataset.theme)) === "dark");
await page.getByRole("button", { name: /switch to light theme/i }).click();
await page.keyboard.press("Meta+k");
check("⌘K opens search", await page.getByRole("dialog").isVisible());
await page.keyboard.type("treasury");
await page.screenshot({ path: `${out}/palette.png` });
await page.keyboard.press("Enter");
await page.waitForURL(/\/d\/TR/);
check("search navigates to department", page.url().includes("/d/TR"));
await page.goto(BASE + "/mobility/", { waitUntil: "networkidle" });
await page.locator("#who").getByRole("button", { name: "FY2026" }).click();
check("fiscal-year switch", (await page.locator("#who").getByRole("button", { name: "FY2026" }).getAttribute("aria-pressed")) === "true");
await page.goto(BASE + "/planning/", { waitUntil: "networkidle" });
const before = await page.locator("#lab dl dd").nth(1).textContent();
await page.locator("#hiring").fill("0.5");
await page.waitForTimeout(200);
const after = await page.locator("#lab dl dd").nth(1).textContent();
const diff = await page.locator("#lab dl dd").nth(2).textContent();   // the scenario's change against the forecast
check(`simulator: halving hiring lowers the 12-month figure (${before} -> ${after}, ${diff})`, /^[−-]\d/.test(diff.trim()));
await page.getByRole("button", { name: "Keep for comparison" }).click();
check("simulator: scenario can be kept for comparison", await page.getByText("Scenario A").first().isVisible());
await page.locator("#scope").selectOption("VA");
check("simulator: department switch", (await page.locator("#scope").inputValue()) === "VA");
await page.goto(BASE + "/brief/", { waitUntil: "networkidle" });
const pdf = await page.request.get(BASE + "/brief/workforce-brief.pdf");
check("printable brief PDF is served", pdf.ok() && (pdf.headers()["content-type"] ?? "").includes("pdf"));
// keyboard: every focus stop shows an outline
await page.goto(BASE + "/", { waitUntil: "networkidle" });
let missing = 0;
for (let i = 0; i < 25; i++) {
  await page.keyboard.press("Tab");
  const o = await page.evaluate(() => { const el = document.activeElement; const s = getComputedStyle(el); return s.outlineStyle !== "none" && s.outlineWidth !== "0px"; });
  if (!o) missing++;
}
check(`focus ring on every tab stop (${missing} missing of 25)`, missing === 0);
check(`no page errors (${errors.length})`, errors.length === 0);
errors.forEach((e) => console.log("  ", e));
await browser.close();
process.exit(failures ? 1 : 0);
