const https = require("https");
const fs = require("fs");
const path = require("path");
const dns = require("dns");
const { promisify } = require("util");
const {
  ZAVORTH_PROXY_PLANE,
  getMitmApiKey,
  getMitmDataDir,
  getMitmRouterBaseUrl,
  shouldBypassGatewayLoop,
} = require("./proxyPlane.cjs");

// Configuration
const TARGET_HOST = "daily-cloudcode-pa.googleapis.com";
const LOCAL_PORT = 443;
const DEFAULT_MAX_BODY_BYTES = 10 * 1024 * 1024;
const MAX_BODY_BYTES = parsePositiveInteger(
  process.env.ZAVORTH_MITM_MAX_BODY_BYTES,
  DEFAULT_MAX_BODY_BYTES
);
const ROUTER_BASE_URL = getMitmRouterBaseUrl();
const ROUTER_URL = `${ROUTER_BASE_URL}/v1/chat/completions`;
const API_KEY = getMitmApiKey();
const DATA_DIR = getMitmDataDir();
const DB_FILE = path.join(DATA_DIR, "db.json");
const SQLITE_FILE = path.join(DATA_DIR, "storage.sqlite");

let _sqliteDb = null;

// Toggle logging (set true to enable file logging for debugging)
const ENABLE_FILE_LOG = false;

if (!API_KEY) {
  console.error(`${ZAVORTH_PROXY_PLANE.env.apiKey[0]} required`);
  process.exit(1);
}

// Load SSL certificates
const certDir = path.join(DATA_DIR, "mitm");
const sslOptions = {
  key: fs.readFileSync(path.join(certDir, "server.key")),
  cert: fs.readFileSync(path.join(certDir, "server.crt")),
};

// Chat endpoints that should be intercepted
const CHAT_URL_PATTERNS = [":generateContent", ":streamGenerateContent"];

// Log directory for request/response dumps
const LOG_DIR = path.join(__dirname, "../../logs/mitm");
if (ENABLE_FILE_LOG && !fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function requestHostName(hostHeader) {
  const value = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "";
  if (normalized.startsWith("[")) return normalized.slice(1, normalized.indexOf("]"));
  return normalized.split(":")[0];
}

function isAllowedMitmHost(hostHeader) {
  return requestHostName(hostHeader) === TARGET_HOST;
}

// Safe log filename: only alphanumeric + hyphens, anchored inside LOG_DIR
function safeLogPath(name) {
  const safe = name.replace(/[^a-zA-Z0-9_\-]/g, "_").substring(0, 80);
  const resolved = path.resolve(LOG_DIR, safe);
  if (!resolved.startsWith(path.resolve(LOG_DIR) + path.sep)) {
    throw new Error("Path traversal attempt detected in log filename");
  }
  return resolved;
}

function saveRequestLog(url, bodyBuffer) {
  if (!ENABLE_FILE_LOG) return;
  try {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const urlSlug = url.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 60);
    const filePath = safeLogPath(`${ts}_${urlSlug}.json`);
    const body = JSON.parse(bodyBuffer.toString());
    fs.writeFileSync(filePath, JSON.stringify(body, null, 2));
    console.log(`Saved request: ${filePath}`);
  } catch {
    // Ignore
  }
}

function saveResponseLog(url, data) {
  if (!ENABLE_FILE_LOG) return;
  try {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const urlSlug = url.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 60);
    const filePath = safeLogPath(`${ts}_${urlSlug}_response.txt`);
    fs.writeFileSync(filePath, data);
    console.log(`Saved response: ${filePath}`);
  } catch {
    // Ignore
  }
}

// Resolve real IP of target host (bypass /etc/hosts)
let cachedTargetIP = null;
async function resolveTargetIP() {
  if (cachedTargetIP) return cachedTargetIP;
  const resolver = new dns.Resolver();
  resolver.setServers(["8.8.8.8"]);
  const resolve4 = promisify(resolver.resolve4.bind(resolver));
  const addresses = await resolve4(TARGET_HOST);
  cachedTargetIP = addresses[0];
  return cachedTargetIP;
}

function collectBodyRaw(req, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    req.on("data", (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        reject(new Error("MITM request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function extractModel(body) {
  try {
    return JSON.parse(body.toString()).model || null;
  } catch {
    return null;
  }
}

/**
 * Get a lazy SQLite connection for reading MITM aliases.
 * Falls back to null if better-sqlite3 is unavailable.
 */
function getSqliteDb() {
  if (_sqliteDb) return _sqliteDb;
  try {
    const Database = require("better-sqlite3");
    if (fs.existsSync(SQLITE_FILE)) {
      _sqliteDb = new Database(SQLITE_FILE, { readonly: true });
      return _sqliteDb;
    }
  } catch {
    // better-sqlite3 not available in this process
  }
  return null;
}

function getMappedModel(model) {
  if (!model) return null;

  // Primary: read from SQLite key_value table
  try {
    const db = getSqliteDb();
    if (db) {
      const row = db
        .prepare(
          "SELECT value FROM key_value WHERE namespace = 'mitmAlias' AND key = 'zavorthBridge'"
        )
        .get();
      if (row) {
        const mappings = JSON.parse(row.value);
        return mappings[model] || null;
      }
    }
  } catch {
    // Fall through to JSON fallback
  }

  // Fallback: read from db.json (legacy installs not yet migrated)
  try {
    if (fs.existsSync(DB_FILE)) {
      const db = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
      return db.mitmAlias?.zavorthBridge?.[model] || null;
    }
  } catch {
    // Ignore
  }

  return null;
}

async function passthrough(req, res, bodyBuffer) {
  const targetIP = await resolveTargetIP();

  // TLS validation is enabled by default. Set MITM_DISABLE_TLS_VERIFY=1 only
  // in controlled local environments where the target uses a self-signed cert.
  const rejectUnauthorized = process.env.MITM_DISABLE_TLS_VERIFY !== "1";

  const forwardReq = https.request(
    {
      hostname: targetIP,
      port: 443,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: TARGET_HOST },
      servername: TARGET_HOST,
      rejectUnauthorized,
    },
    (forwardRes) => {
      res.writeHead(forwardRes.statusCode, forwardRes.headers);
      forwardRes.pipe(res);
    }
  );

  forwardReq.on("error", (err) => {
    console.error(`Passthrough error: ${err.message}`);
    if (!res.headersSent) res.writeHead(502);
    res.end("Bad Gateway");
  });

  if (bodyBuffer.length > 0) forwardReq.write(bodyBuffer);
  forwardReq.end();
}

async function intercept(req, res, bodyBuffer, mappedModel) {
  try {
    const body = JSON.parse(bodyBuffer.toString());
    body.model = mappedModel;

    const response = await fetch(ROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(`Zavorth gateway ${response.status}: ${errText}`);
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        res.end();
        break;
      }
      res.write(decoder.decode(value, { stream: true }));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    if (!res.headersSent) res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: { message, type: "mitm_error" } }));
  }
}

const server = https.createServer(sslOptions, async (req, res) => {
  if (!isAllowedMitmHost(req.headers.host)) {
    res.writeHead(421, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: { message: "Misdirected Request", type: "mitm_host_rejected" } }));
    return;
  }

  let bodyBuffer;
  try {
    bodyBuffer = await collectBodyRaw(req);
  } catch (error) {
    const status = error && error.message === "MITM request body too large" ? 413 : 400;
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: { message: error.message || "Invalid request body", type: "mitm_body_rejected" } }));
    return;
  }

  // Save request log if enabled
  if (bodyBuffer.length > 0) saveRequestLog(req.url, bodyBuffer);

  // Anti-loop: requests already emitted by the gateway must bypass interception.
  if (shouldBypassGatewayLoop(req.headers)) {
    return passthrough(req, res, bodyBuffer);
  }

  const isChatRequest = CHAT_URL_PATTERNS.some((p) => req.url.includes(p));

  if (!isChatRequest) {
    return passthrough(req, res, bodyBuffer);
  }

  const model = extractModel(bodyBuffer);
  const mappedModel = getMappedModel(model);

  if (!mappedModel) {
    return passthrough(req, res, bodyBuffer);
  }

  console.log(`Intercepting ${model} -> ${mappedModel}`);
  return intercept(req, res, bodyBuffer, mappedModel);
});

server.listen(LOCAL_PORT, () => {
  console.log(`MITM ready on :${LOCAL_PORT} -> ${ROUTER_URL}`);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${LOCAL_PORT} already in use`);
  } else if (error.code === "EACCES") {
    console.error(`Permission denied for port ${LOCAL_PORT}`);
  } else {
    console.error(error.message);
  }
  process.exit(1);
});

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});
process.on("SIGINT", () => {
  server.close(() => process.exit(0));
});
