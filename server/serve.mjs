import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createAdminAuth, resolveApiBaseUrl } from "./auth.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const distDir = resolve(__dirname, "../dist");
const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || process.env.VITE_PORT || 15173);
const apiBase = resolveApiBaseUrl().replace(/\/$/, "");
const { middleware: authMiddleware } = createAdminAuth();

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".map": "application/json"
};

function sendFile(res, filePath) {
  const ext = extname(filePath);
  res.statusCode = 200;
  res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
  createReadStream(filePath).pipe(res);
}

function safeJoin(root, urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const full = normalize(join(root, decoded));
  if (!full.startsWith(root)) return null;
  return full;
}

async function proxyApi(req, res) {
  const target = `${apiBase}${req.url}`;
  const headers = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null) continue;
    if (["host", "content-length", "connection"].includes(key)) continue;
    headers[key] = Array.isArray(value) ? value.join(",") : value;
  }
  const method = req.method || "GET";
  const hasBody = !["GET", "HEAD"].includes(method);
  const chunks = [];
  if (hasBody) {
    await new Promise((resolve, reject) => {
      req.on("data", chunk => chunks.push(chunk));
      req.on("end", resolve);
      req.on("error", reject);
    });
  }
  try {
    const upstream = await fetch(target, {
      method,
      headers,
      body: hasBody ? Buffer.concat(chunks) : undefined
    });
    res.statusCode = upstream.status;
    upstream.headers.forEach((value, key) => {
      if (["content-encoding", "transfer-encoding", "connection"].includes(key)) {
        return;
      }
      res.setHeader(key, value);
    });
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.end(buf);
  } catch (error) {
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        success: false,
        message: `k-data-new 代理失败: ${apiBase}`,
        error: String(error)
      })
    );
  }
}

function serveStatic(req, res) {
  const urlPath = req.url?.split("?")[0] || "/";
  if (urlPath === "/healthz") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: true, apiBase }));
    return;
  }
  const filePath = safeJoin(distDir, urlPath === "/" ? "/index.html" : urlPath);
  if (filePath && existsSync(filePath) && statSync(filePath).isFile()) {
    sendFile(res, filePath);
    return;
  }
  const index = join(distDir, "index.html");
  if (existsSync(index)) {
    sendFile(res, index);
    return;
  }
  res.statusCode = 404;
  res.end("dist not found; run pnpm build first");
}

const server = createServer((req, res) => {
  const url = req.url?.split("?")[0] ?? "";
  if (url === "/v1" || url.startsWith("/v1/")) {
    proxyApi(req, res);
    return;
  }
  authMiddleware(req, res, () => serveStatic(req, res));
});

server.listen(port, host, () => {
  console.info(`[k-admin] http://${host}:${port} → API ${apiBase}`);
});
