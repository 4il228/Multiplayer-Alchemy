import { app, BrowserWindow } from "electron";
import { createServer } from "node:http";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "../../server/src/data");
const API_PORT = 3847;
const API_ORIGIN = `http://127.0.0.1:${API_PORT}`;
const isDev = !app.isPackaged;

function readJson(name) {
  return JSON.parse(readFileSync(join(dataDir, name), "utf8"));
}

function writeJson(name, data) {
  writeFileSync(join(dataDir, name), `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function startApiServer() {
  const server = createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      if (req.method === "GET" && req.url === "/api/data") {
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(
          JSON.stringify({
            elements: readJson("elements.json"),
            recipes: readJson("recipes.json"),
            hints: readJson("hints.json"),
          }),
        );
        return;
      }

      if (req.method === "POST" && req.url === "/api/data") {
        const body = await readBody(req);
        const payload = JSON.parse(body);
        writeJson("elements.json", payload.elements);
        writeJson("recipes.json", payload.recipes);
        writeJson("hints.json", payload.hints);
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal error";
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(message);
    }
  });

  server.listen(API_PORT, "127.0.0.1");
  return server;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: "MultiAlchemy — редактор базы",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    win.loadURL("http://localhost:5174");
  } else {
    win.loadFile(join(__dirname, "../dist/index.html"));
  }
}

let apiServer = null;

app.whenReady().then(() => {
  apiServer = startApiServer();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => {
  apiServer?.close();
});

export { API_ORIGIN };
