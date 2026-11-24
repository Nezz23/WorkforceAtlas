// Serve out/ and run the browser checks against it. Exits non-zero if any check fails.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { serve } from "./serve.mjs";

if (!existsSync("out/index.html")) { console.error("out/ is missing: run `npm run build` first."); process.exit(1); }
const site = await serve("out");
let failed = false;
for (const script of ["e2e/interact.mjs", "e2e/a11y.mjs"]) {
  console.log(`\n== ${script} against ${site.url}`);
  // Async spawn: the static server lives in this process and must keep answering while the script runs.
  const child = spawn(process.execPath, [script], { stdio: "inherit", env: { ...process.env, BASE_URL: site.url } });
  const code = await new Promise((done) => { child.on("exit", done); child.on("error", () => done(1)); });
  if (code !== 0) failed = true;
}
site.close();
process.exit(failed ? 1 : 0);
