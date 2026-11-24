// Print /brief/ from the exported site (out/) to out/brief/workforce-brief.pdf. Exits non-zero on failure.
import { chromium } from "@playwright/test";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { serve } from "./serve.mjs";

if (!existsSync("out/brief/index.html")) { console.error("out/brief/index.html is missing: run `npm run build` first."); process.exit(1); }
const site = await serve("out");
let ok = false;
try {
  mkdirSync("out/brief", { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage();
  const r = await p.goto(`${site.url}/brief/`, { waitUntil: "networkidle" });
  if (!r?.ok()) throw new Error(`/brief/ returned ${r?.status()}`);
  await p.pdf({ path: "out/brief/workforce-brief.pdf", format: "Letter", printBackground: false });
  await b.close();
  const size = statSync("out/brief/workforce-brief.pdf").size;
  if (size < 5000) throw new Error(`PDF is only ${size} bytes`);
  console.log(`out/brief/workforce-brief.pdf (${size} bytes)`);
  ok = true;
} catch (e) {
  console.error(e);
} finally {
  site.close();
}
process.exit(ok ? 0 : 1);
