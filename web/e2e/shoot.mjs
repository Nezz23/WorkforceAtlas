// Full-page screenshots of each route, desktop and phone, light and dark: node e2e/shoot.mjs <out dir> <path>...
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const [out, ...paths] = process.argv.slice(2);
const BASE = process.env.BASE_URL ?? process.env.BASE ?? "http://localhost:3100";
const THEMES = (process.env.THEMES ?? "light").split(",");
const SIZES = (process.env.SIZES ?? "desktop,phone").split(",");
const VIEW = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
for (const size of SIZES) for (const theme of THEMES) {
  const page = await browser.newPage({ viewport: VIEW[size], deviceScaleFactor: size === "phone" ? 2 : 1, reducedMotion: "reduce" });
  await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  for (const p of paths) {
    await page.goto(BASE + p, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const name = `${p === "/" ? "home" : p.replace(/\//g, "_").replace(/^_|_$/g, "")}-${size}-${theme}.png`;
    await page.screenshot({ path: `${out}/${name}`, fullPage: true });
    console.log(name, overflow > 0 ? `HORIZONTAL OVERFLOW ${overflow}px` : "ok", errors.splice(0).join(" | "));
  }
  await page.close();
}
await browser.close();
