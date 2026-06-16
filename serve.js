// Tiny dependency-free server for the Grow Room app: static files plus a
// JSON state API (GET/PUT /api/state -> data/growdata.json) so a phone and a
// PC on the same network share one dataset.
// Run with: node serve.js   (or double-click start.bat)
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const ROOT = __dirname;
const PORT = process.env.PORT || 4173;
const DATA_DIR = path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "growdata.json");
const MAX_BODY_BYTES = 50 * 1024 * 1024;
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json; charset=utf-8"
};

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

function handleStateApi(req, res) {
  if (req.method === "GET") {
    fs.readFile(DATA_FILE, (err, data) => {
      if (err) return sendJson(res, 404, { error: "no saved state yet" });
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
      res.end(data);
    });
    return;
  }

  if (req.method === "PUT") {
    const chunks = [];
    let size = 0;
    let aborted = false;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        aborted = true;
        sendJson(res, 413, { error: "state too large" });
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (aborted) return;
      const body = Buffer.concat(chunks);
      try {
        JSON.parse(body);
      } catch (error) {
        return sendJson(res, 400, { error: "invalid JSON" });
      }
      // Write to a temp file then rename so a crash mid-write never leaves a
      // truncated growdata.json behind. The outgoing version is kept as
      // growdata.prev.json — a one-step undo if a client ever pushes bad state.
      fs.mkdir(DATA_DIR, { recursive: true }, (mkdirErr) => {
        if (mkdirErr) return sendJson(res, 500, { error: "cannot create data dir" });
        fs.copyFile(DATA_FILE, `${DATA_FILE.replace(/\.json$/, "")}.prev.json`, () => {
          const tmp = `${DATA_FILE}.tmp`;
          fs.writeFile(tmp, body, (writeErr) => {
            if (writeErr) return sendJson(res, 500, { error: "write failed" });
            fs.rename(tmp, DATA_FILE, (renameErr) => {
              if (renameErr) return sendJson(res, 500, { error: "rename failed" });
              sendJson(res, 200, { ok: true, bytes: body.length });
            });
          });
        });
      });
    });
    return;
  }

  sendJson(res, 405, { error: "use GET or PUT" });
}

http
  .createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split("?")[0]);
    if (urlPath === "/api/state") return handleStateApi(req, res);
    if (urlPath === "/") urlPath = "/index.html";
    const safe = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
    const filePath = path.join(ROOT, safe);
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not found");
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        "Content-Type": TYPES[ext] || "application/octet-stream",
        "Cache-Control": "no-store"
      });
      res.end(data);
    });
  })
  .listen(PORT, "0.0.0.0", () => {
    console.log(`Grow Room running at http://localhost:${PORT}`);
    const nets = Object.values(os.networkInterfaces()).flat();
    nets
      .filter((net) => net && net.family === "IPv4" && !net.internal)
      .forEach((net) => console.log(`On your phone (same Wi-Fi): http://${net.address}:${PORT}`));
    console.log(`Shared data file: ${DATA_FILE}`);
    console.log("Leave this window open. Close it to stop the app.");
  });
