// Local preview that behaves like Netlify: serves dist/ and routes /v1/* + /health to the oracle function.
//   npm run build && node scripts/serve.mjs            → http://localhost:8888
// For paid routes set the same env vars as on Netlify (X402_PAY_TO, FACILITATOR_PRIVATE_KEY, …).
import http from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(WEB, "dist");
const fn = (await import(join(WEB, "netlify", "functions", "oracle.mjs"))).default;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" };
const port = Number(process.env.PORT ?? 8888);

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  if (url.pathname.startsWith("/v1/") || url.pathname === "/health") {
    const body = ["GET", "HEAD", "OPTIONS"].includes(req.method) ? undefined : await new Promise(r => { let b = ""; req.on("data", c => b += c); req.on("end", () => r(b)); });
    const r = await fn(new Request(url, { method: req.method, headers: req.headers, body }));
    res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer())); return;
  }
  let p = decodeURIComponent(url.pathname);
  if (p.startsWith("/verify/") && p !== "/verify/") p = "/verify/index.html";
  let f = join(DIST, p);
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
  if (!existsSync(f) && existsSync(join(DIST, p + "/index.html"))) { res.writeHead(301, { location: p + "/" }); res.end(); return; }
  if (!existsSync(f)) { res.writeHead(404, { "content-type": "text/plain" }); res.end("not found"); return; }
  res.writeHead(200, { "content-type": TYPES[extname(f)] ?? "application/octet-stream" }); res.end(readFileSync(f));
}).listen(port, () => console.log(`ceres-web preview on http://localhost:${port}`));
