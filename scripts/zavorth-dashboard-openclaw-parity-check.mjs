#!/usr/bin/env node

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const sourceOnly = args.has("--source-only");
const allowOpenClawSkip = args.has("--allow-openclaw-skip");
const openClawRoot = path.resolve(process.env.OPENCLAW_ROOT || path.join(rootDir, "..", "..", "openclaw"));
const openClawUi = path.join(openClawRoot, "ui");
const staticDir = path.join(rootDir, "src", "ai-gateway", "public", "zavorth-control-vite-shell");
const appPublicDir = path.join(rootDir, "apps", "zavorth-control-vite-shell", "public");
const outDir = path.join(rootDir, ".tmp", "zavorth-dashboard-openclaw-parity");
const zavorthPort = Number(process.env.ZAVORTH_PARITY_PORT || 5198);
const openClawPort = Number(process.env.OPENCLAW_PARITY_PORT || 5199);

const files = {
  registry: "apps/zavorth-control-vite-shell/src/dashboard-surface-registry.ts",
  components: "apps/zavorth-control-vite-shell/src/page-components.ts",
  pages: "apps/zavorth-control-vite-shell/src/pages.ts",
  learning: "apps/zavorth-control-vite-shell/src/learning-dreams-ui.ts",
  navigation: "apps/zavorth-control-vite-shell/src/shell-navigation.ts",
  html: "apps/zavorth-control-vite-shell/index.html",
  css: "apps/zavorth-control-vite-shell/public/styles/pages.css",
  packageJson: "package.json",
};

const viewports = [
  { id: "desktop", width: 1440, height: 900 },
  { id: "tablet", width: 900, height: 900 },
  { id: "mobile", width: 390, height: 844 },
];

const requiredSectors = ["terminal", "overview", "nodes", "dreams", "canvas", "skills", "agents", "usage", "config"];
const capabilityStripSectors = requiredSectors.filter((sector) => sector !== "terminal");

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

function push(checks, id, ok, detail) {
  checks.push({ id, ok: Boolean(ok), detail });
}

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".woff2")) return "font/woff2";
  return "application/octet-stream";
}

function serveZavorth() {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url || "/", `http://127.0.0.1:${zavorthPort}`);
    if (url.pathname.startsWith("/api/")) {
      if (url.pathname === "/api/web/execution-engines") {
        response.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
          "Access-Control-Allow-Origin": "*",
        });
        response.end(JSON.stringify({
          ok: true,
          activeEngineId: "lite",
          policies: [
            { id: "lite", label: "Zavorth Lite", audience: "personal", latencyTarget: "instant", sandboxPolicy: "none", approvalPolicy: "none", diffPolicy: "not-applicable", traceVisibility: "compact", summary: "Fast chat and read-only help.", allowedActions: [], blockedActions: [] },
            { id: "velocity", label: "Zavorth Velocity", audience: "developer", latencyTarget: "fast", sandboxPolicy: "trusted-workspace-only", approvalPolicy: "risk-based", diffPolicy: "preview-first", traceVisibility: "compact", summary: "Fast work in trusted folders.", allowedActions: [], blockedActions: [] },
            { id: "shield", label: "Zavorth Shield", audience: "business", latencyTarget: "governed", sandboxPolicy: "sandbox-required", approvalPolicy: "always-for-impact", diffPolicy: "approval-required", traceVisibility: "full", summary: "Sandbox, approvals and receipts.", allowedActions: [], blockedActions: [] },
          ],
          availability: [
            { engineId: "lite", available: true, reason: null, nextSafeAction: null },
            { engineId: "velocity", available: true, reason: null, nextSafeAction: null },
            { engineId: "shield", available: true, reason: null, nextSafeAction: null },
          ],
          traces: [],
          decision: null,
        }));
        return;
      }
      response.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      });
      response.end(JSON.stringify({ ok: true, data: { status: "visual-parity", generatedAt: new Date().toISOString() } }));
      return;
    }

    let filePath = path.join(staticDir, decodeURIComponent(url.pathname.replace(/^\/+/, "")));
    if (url.pathname === "/" || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(staticDir, "index.html");
    }
    if (!fs.existsSync(filePath)) {
      const appPath = path.join(appPublicDir, decodeURIComponent(url.pathname.replace(/^\/+/, "")));
      filePath = fs.existsSync(appPath) ? appPath : path.join(staticDir, "index.html");
    }
    response.writeHead(200, { "Content-Type": contentType(filePath), "Cache-Control": "no-store" });
    fs.createReadStream(filePath).pipe(response);
  });
  return new Promise((resolve) => {
    server.listen(zavorthPort, "127.0.0.1", () => resolve(server));
  });
}

function waitForHttp(url, timeoutMs = 20_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (callback, value) => {
      if (done) return;
      done = true;
      clearTimeout(deadline);
      callback(value);
    };
    const deadline = setTimeout(() => {
      finish(reject, new Error(`Timed out waiting for ${url}`));
    }, timeoutMs);
    const tick = () => {
      if (done) return;
      const request = http.get(url, (response) => {
        response.resume();
        if ((response.statusCode || 0) < 500) {
          finish(resolve, true);
          return;
        }
        retry();
      });
      request.on("error", retry);
      request.setTimeout(2_000, () => {
        request.destroy();
        retry();
      });
    };
    const retry = () => {
      if (done) return;
      if (Date.now() - started > timeoutMs) {
        finish(reject, new Error(`Timed out waiting for ${url}`));
        return;
      }
      setTimeout(tick, 350);
    };
    tick();
  });
}

async function startOpenClaw() {
  if (!fs.existsSync(path.join(openClawUi, "package.json"))) return null;
  const viteBin = [
    path.join(openClawUi, "node_modules", "vite", "bin", "vite.js"),
    path.join(openClawRoot, "node_modules", "vite", "bin", "vite.js"),
  ].find((candidate) => fs.existsSync(candidate));
  if (!viteBin) {
    if (allowOpenClawSkip) return null;
    throw new Error(`OpenClaw Vite binary not found. Run npm install in ${openClawRoot}.`);
  }
  const child = spawn(process.execPath, [viteBin, "--host", "127.0.0.1", "--port", String(openClawPort)], {
    cwd: openClawUi,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk) => { output += chunk.toString(); });
  try {
    await waitForHttp(`http://127.0.0.1:${openClawPort}/`, 25_000);
    return { child, output: () => output };
  } catch (error) {
    child.kill();
    if (allowOpenClawSkip) return null;
    throw new Error(`OpenClaw UI did not start for side-by-side QA: ${(error && error.message) || error}\n${output}`);
  }
}

function stopOpenClaw(openClaw) {
  if (openClaw?.child && !openClaw.child.killed) openClaw.child.kill();
}

async function captureZavorthSector(browser, baseUrl, viewport, sector, takeScreenshot = false) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
  try {
    await page.goto(`${baseUrl}/?qa=openclaw-parity-${sector}`, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await page.click(`[data-sector="${sector}"]`).catch(() => undefined);
    await page.waitForTimeout(250);
    const metrics = await page.evaluate((activeSector) => {
      const active = document.getElementById(`sector-${activeSector}`);
      const bodyText = document.body.innerText || "";
      const visible = (selector) => {
        const node = document.querySelector(selector);
        if (!node) return false;
        return getComputedStyle(node).display !== "none";
      };
      return {
        sector: activeSector,
        title: active?.querySelector(".premium-title, .terminal-hero__hello, h2")?.textContent?.trim() || "",
        hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 2,
        activeHeight: active instanceof HTMLElement ? Math.round(active.getBoundingClientRect().height) : 0,
        capabilityItems: active?.querySelectorAll(".dashboard-capability-item").length || 0,
        decorativeMapVisible: visible(".zavorth-connectivity-map"),
        decorativeChartVisible: visible(".zavorth-charts-panel"),
        hasBrokenEncoding: /ðŸ|âš|ï¸|neon node|interactive memory mesh/i.test(bodyText),
        bodyText: bodyText.slice(0, 8000),
      };
    }, sector);
    let screenshot = null;
    if (takeScreenshot) {
      const file = path.join(outDir, `zavorth-${viewport.id}-${sector}.png`);
      await page.screenshot({ path: file, fullPage: false });
      screenshot = path.relative(rootDir, file).replace(/\\/g, "/");
    }
    return { ...metrics, screenshot };
  } finally {
    await page.close();
  }
}

async function captureOpenClaw(browser, baseUrl, viewport) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
  try {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 25_000 });
    await page.waitForTimeout(750);
    const metrics = await page.evaluate(() => ({
      title: document.title,
      hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 2,
      text: (document.body.innerText || "").slice(0, 4000),
    }));
    const file = path.join(outDir, `openclaw-${viewport.id}.png`);
    await page.screenshot({ path: file, fullPage: false });
    return { ...metrics, screenshot: path.relative(rootDir, file).replace(/\\/g, "/") };
  } finally {
    await page.close();
  }
}

function renderSideBySideManifest(zavorthCaptures, openClawCaptures) {
  const rows = viewports.map((viewport) => {
    const zavorth = zavorthCaptures.find((capture) => capture.viewport === viewport.id && capture.sector === "agents");
    const openclaw = openClawCaptures.find((capture) => capture.viewport === viewport.id);
    if (!zavorth || !openclaw) return "";
    return `
      <section>
        <h2>${viewport.id}</h2>
        <div class="pair">
          <figure><figcaption>Zavorth Agents</figcaption><img src="../../${zavorth.screenshot}" /></figure>
          <figure><figcaption>OpenClaw shell</figcaption><img src="../../${openclaw.screenshot}" /></figure>
        </div>
      </section>
    `;
  }).join("");
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Zavorth / OpenClaw dashboard parity</title>
<style>
body{margin:0;background:#07110f;color:#d7e8e2;font-family:Inter,Segoe UI,sans-serif;padding:24px}
h1,h2{margin:0 0 16px}section{margin:0 0 32px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}
figure{margin:0;border:1px solid rgba(0,255,170,.18);border-radius:8px;overflow:hidden;background:#071b16}
figcaption{padding:10px 12px;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#8fb5aa}
img{display:block;width:100%;height:auto}
@media(max-width:900px){.pair{grid-template-columns:1fr}}
</style></head><body><h1>Zavorth / OpenClaw dashboard parity</h1>${rows}</body></html>`;
  const file = path.join(outDir, "side-by-side.html");
  fs.writeFileSync(file, html);
  return path.relative(rootDir, file).replace(/\\/g, "/");
}

async function runBrowserQa(checks) {
  if (!fs.existsSync(path.join(staticDir, "index.html"))) {
    throw new Error(`Built ZavorthControl shell not found at ${staticDir}. Run npm run zavorth-control-vite:build first.`);
  }
  fs.mkdirSync(outDir, { recursive: true });
  const zavorthServer = await serveZavorth();
  const zavorthCaptures = [];
  const openClawCaptures = [];
  let openClaw = null;
  let browser = null;
  try {
    openClaw = await startOpenClaw();
    browser = await chromium.launch({ headless: true });
    for (const viewport of viewports) {
      for (const sector of requiredSectors) {
        const capture = await captureZavorthSector(browser, `http://127.0.0.1:${zavorthPort}`, viewport, sector, sector === "agents");
        zavorthCaptures.push({ ...capture, viewport: viewport.id });
      }
      if (openClaw) {
        const capture = await captureOpenClaw(browser, `http://127.0.0.1:${openClawPort}/`, viewport);
        openClawCaptures.push({ ...capture, viewport: viewport.id });
      }
    }
  } finally {
    if (browser) await browser.close();
    zavorthServer.close();
    stopOpenClaw(openClaw);
  }

  const sideBySide = openClawCaptures.length ? renderSideBySideManifest(zavorthCaptures, openClawCaptures) : null;
  const overflows = zavorthCaptures.filter((capture) => capture.hasHorizontalOverflow);
  const missingCapability = zavorthCaptures.filter((capture) => capture.sector !== "terminal" && capture.capabilityItems === 0);
  const inboxStrips = zavorthCaptures.filter((capture) => capture.sector === "terminal" && /AVAILABLE HERE|Prompt queue|composer powers/i.test(capture.bodyText || ""));
  const brokenEncoding = zavorthCaptures.filter((capture) => capture.hasBrokenEncoding);
  const decorativeVisible = zavorthCaptures.filter((capture) => capture.decorativeMapVisible || capture.decorativeChartVisible);

  push(checks, "responsive-viewports-covered", zavorthCaptures.length === viewports.length * requiredSectors.length, `${zavorthCaptures.length} Zavorth captures`);
  push(checks, "no-horizontal-overflow", overflows.length === 0, overflows.map((capture) => `${capture.viewport}:${capture.sector}`).join(", ") || "desktop/tablet/mobile ok");
  push(checks, "new-powers-visible-in-tabs", missingCapability.length === 0, missingCapability.map((capture) => `${capture.viewport}:${capture.sector}`).join(", ") || "capability strips visible");
  push(checks, "inbox-chat-home-visual-clean", inboxStrips.length === 0, inboxStrips.map((capture) => capture.viewport).join(", ") || "Inbox renders as chat home");
  push(checks, "density-decorations-hidden", decorativeVisible.length === 0, decorativeVisible.map((capture) => `${capture.viewport}:${capture.sector}`).join(", ") || "decorative map/charts hidden");
  push(checks, "visible-text-clean", brokenEncoding.length === 0, brokenEncoding.map((capture) => `${capture.viewport}:${capture.sector}`).join(", ") || "visible text clean");
  push(checks, "openclaw-side-by-side-captured", openClawCaptures.length === viewports.length || allowOpenClawSkip, sideBySide || "OpenClaw runtime skipped");

  const manifest = {
    generatedAt: new Date().toISOString(),
    openClawRoot,
    sideBySide,
    zavorthCaptures,
    openClawCaptures,
  };
  fs.writeFileSync(path.join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

async function main() {
  const checks = [];
  const registry = read(files.registry);
  const components = read(files.components);
  const pages = read(files.pages);
  const learning = read(files.learning);
  const navigation = read(files.navigation);
  const html = read(files.html);
  const css = read(files.css);
  const packageJson = JSON.parse(read(files.packageJson));
  const scripts = JSON.stringify(packageJson.scripts || {});

  push(checks, "canonical-surface-registry", /PRIMARY_DASHBOARD_SURFACE/.test(registry) && /LEGACY_DASHBOARD_SURFACE_MAP/.test(registry), "registry declares primary and legacy surface map");
  push(checks, "navigation-uses-registry", /sectorLabel/.test(navigation) && !/SECTOR_LABELS/.test(navigation), "navigation labels come from registry");
  push(checks, "page-components-extracted", /renderCapabilityStrip/.test(components) && /renderSurfaceFlow/.test(components) && /renderCapabilityStrip/.test(pages), "large pages use shared components");
  push(checks, "new-powers-placed", ["prompt.queue", "slash.commands", "memory.mnemos", "canvas.a2ui", "git.workflow", "external.acp", "providers.streaming"].every((id) => registry.includes(id)), "registry covers major new powers");
  push(
    checks,
    "visible-tabs-use-capability-strip",
    capabilityStripSectors.every((sector) => pages.includes(`renderCapabilityStrip('${sector}')`) || (sector === "dreams" && learning.includes("renderCapabilityStrip('dreams')"))),
    "visible non-chat sectors expose capabilities",
  );
  push(checks, "inbox-chat-home-is-clean", !/dashboard-surface-strip--inbox/.test(html) && !/Prompt queue/.test(html) && registry.includes("prompt.queue") && registry.includes("slash.commands"), "Inbox stays chat-first; composer powers remain in registry");
  push(checks, "density-budget-source", /zavorth-connectivity-map,[\s\S]*\.zavorth-charts-panel[\s\S]*display: none !important/.test(css), "decorative map and charts are hidden");
  push(checks, "responsive-simple-components", /dashboard-capability-list/.test(css) && /@media \(max-width: 640px\)/.test(css), "new strips are responsive");
  push(checks, "openclaw-reference-source-found", fs.existsSync(path.join(openClawUi, "src", "styles", "layout.mobile.css")) && fs.existsSync(path.join(openClawUi, "src", "ui", "app-render.ts")), openClawUi);
  push(checks, "package-script-wired", /qa:zavorthControl-openclaw-dashboard-parity/.test(scripts), "parity QA script is in package.json");

  if (!sourceOnly) {
    await runBrowserQa(checks);
  }

  const failed = checks.filter((check) => !check.ok);
  const report = { ok: failed.length === 0, checks };
  console.log(JSON.stringify(report, null, 2));
  if (failed.length) {
    throw new Error(`Zavorth dashboard/OpenClaw parity failed: ${failed.map((check) => check.id).join(", ")}`);
  }
}

main().catch((error) => {
  console.error(`[zavorth-dashboard-openclaw-parity] FAIL ${error?.message || error}`);
  process.exitCode = 1;
});
