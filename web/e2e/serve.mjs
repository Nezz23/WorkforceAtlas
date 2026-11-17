// Minimal static server for the exported site (out/), on a free port. No dependencies. It sends the site-wide headers
// from out/_headers (the "/*" block Cloudflare Pages applies), so every browser check runs under the production policy.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".svg": "image/svg+xml", ".pdf": "application/pdf", ".woff2": "font/woff2", ".png": "image/png", ".ico": "image/x-icon",
  ".txt": "text/plain", ".xml": "application/xml" };

export async function serve(root) {
  const base = path.resolve(root);
  const rules = await readFile(path.join(base, "_headers"), "utf8").catch(() => "");
  const site = Object.fromEntries((rules.split(/\n(?=\S)/).find((b) => b.startsWith("/*")) ?? "").split("\n").slice(1)
    .map((l) => l.trim()).filter((l) => l && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf(":")), l.slice(l.indexOf(":") + 1).trim()]));
  const server = createServer(async (req, res) => {
    try {
      const url = decodeURIComponent(new URL(req.url, "http://x").pathname);
      let file = path.join(base, url);
      if (!file.startsWith(base)) throw new Error("outside root");
      if ((await stat(file).catch(() => null))?.isDirectory()) file = path.join(file, "index.html");
      const body = await readFile(file);
      res.writeHead(200, { ...site, "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("not found");
    }
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}
