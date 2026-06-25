#!/usr/bin/env node
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const staticDir = path.join(rootDir, "src", "zavorth-control", "public", "zavorth-control-vite-shell");
const appPublicDir = path.join(rootDir, "apps", "zavorth-control-vite-shell", "public");
const port = Number(process.env.ZAVORTH_CONTROL_COCKPIT_E2E_PORT || 5189);

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

function createStaticServer() {
  if (!fs.existsSync(path.join(staticDir, "index.html"))) {
    throw new Error(`Built ZavorthControl shell not found at ${staticDir}. Run npm run zavorth-control-vite:build first.`);
  }
  const server = http.createServer((request, response) => {
    const url = new URL(request.url || "/", `http://127.0.0.1:${port}`);
    if (url.pathname.startsWith("/api/")) {
      if (url.pathname === "/api/web/zavorthControl/memory") {
        if (request.method === "POST") {
          response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
          response.end(JSON.stringify({
            ok: true,
            action: "forget",
            forgotten: { id: "mem-e2e-1" },
            memory: { ok: true, facts: [] },
          }));
          return;
        }
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({
          ok: true,
          contractVersion: "2026-05-30.zavorthControl.memory-facts.v1",
          facts: [{
            id: "mem-e2e-1",
            key: "cockpit-e2e",
            type: "factual",
            content: "Persisted cockpit E2E memory fact",
            sessionId: "session-e2e",
          }],
        }));
        return;
      }
      const body = url.pathname === "/api/auth/status"
        ? { authenticated: true, webReady: true, gatewayReady: true }
        : url.pathname === "/api/web/zavorthControl"
          ? { ok: true, live: true, authRequired: false, snapshot: { runs: [], activeRun: null } }
          : { ok: true };
      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify(body));
      return;
    }
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === "/") pathname = "/index.html";
    const primaryTarget = path.resolve(staticDir, `.${pathname}`);
    const fallbackTarget = path.resolve(appPublicDir, `.${pathname}`);
    const target = fs.existsSync(primaryTarget) ? primaryTarget : fallbackTarget;
    if (!(target.startsWith(staticDir) || target.startsWith(appPublicDir))) {
      response.writeHead(403);
      response.end("forbidden");
      return;
    }
    fs.readFile(target, (error, bytes) => {
      if (error) {
        response.writeHead(404);
        response.end("not found");
        return;
      }
      response.writeHead(200, { "Content-Type": contentType(target) });
      response.end(bytes);
    });
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

function assertCheck(checks, name, passed, detail) {
  checks.push({ name, passed: Boolean(passed), detail });
}

async function main() {
  const server = await createStaticServer();
  const checks = [];
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleErrors.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => consoleErrors.push(`pageerror: ${error.message}`));

  try {
    await page.goto(`http://127.0.0.1:${port}/?qa=cockpit-memory-e2e`, {
      waitUntil: "domcontentloaded",
      timeout: 20_000,
    });
    await page.waitForTimeout(1200);
    const result = await page.evaluate(async () => {
      const q = (selector) => document.querySelector(selector);
      const qa = (selector) => Array.from(document.querySelectorAll(selector));
      const forgotten = [];
      window.ZavorthRuntimeBridge = {
        ...(window.ZavorthRuntimeBridge || {}),
        state: {
          ...(window.ZavorthRuntimeBridge?.state || {}),
          memoryFacts: {
            ok: true,
            contractVersion: "2026-05-30.zavorthControl.memory-facts.v1",
            facts: [
              {
                id: "mem-e2e-1",
                key: "cockpit-e2e",
                type: "factual",
                content: "Persisted cockpit E2E memory fact",
                sessionId: "session-e2e",
              },
            ],
          },
        },
        memoryFactAction: async (input) => {
          if (input.action === "forget") {
            forgotten.push(input.id || input.key);
            window.ZavorthRuntimeBridge.state.memoryFacts.facts = [];
          }
          return {
            ok: true,
            action: input.action,
            memory: window.ZavorthRuntimeBridge.state.memoryFacts,
          };
        },
        forgetMemoryFact: async (input) => {
          forgotten.push(input.id || input.key);
          window.ZavorthRuntimeBridge.state.memoryFacts.facts = [];
          return {
            ok: true,
            action: "forget",
            forgotten: { id: input.id || input.key },
            memory: window.ZavorthRuntimeBridge.state.memoryFacts,
          };
        },
      };
      window.ZavorthControlChat?.recordTraceEvent?.({
        type: "request",
        title: "E2E provider stream started",
        detail: "Prompt real -> provider stream test event",
        replay: { runId: "run-e2e", traceId: "trace-e2e" },
      });
      window.ZavorthControlChat?.recordTraceEvent?.({
        type: "receipt",
        title: "E2E dashboard received token",
        detail: "Token delta reached dashboard before done",
        replay: { runId: "run-e2e", traceId: "trace-e2e" },
      });
      window.ZavorthControlChat?.refreshDashboard?.();
      q("#mem-node-vault")?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      await new Promise((resolve) => setTimeout(resolve, 150));
      const beforeForgetText = q("#zavorth-memory-inspection-body")?.textContent || "";
      q(".fact-forget-btn")?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      await new Promise((resolve) => setTimeout(resolve, 150));
      return {
        ganttRows: qa(".zavorth-gantt-row").length,
        ganttText: q("[data-dashboard-timeline]")?.textContent?.replace(/\s+/g, " ").trim() || "",
        replayButton: Boolean(q(".trace-sheet__replay-btn")),
        memoryNodeCount: qa("#zavorth-memory-tree .zavorth-mem-node").length,
        beforeForgetText,
        forgotten,
        trustedPanel: Boolean(q(".settings-trusted-panel")),
        fakeExternalDemoText: document.body.textContent?.includes("External Daemon Demo") || false,
      };
    });

    assertCheck(checks, "trace-gantt-renders-events", result.ganttRows >= 2, result.ganttText);
    assertCheck(checks, "trace-replay-entrypoint-present", result.replayButton, "Trace replay button is present for run replay.");
    assertCheck(checks, "memory-tree-nodes-present", result.memoryNodeCount >= 5, `${result.memoryNodeCount} memory nodes`);
    assertCheck(checks, "persisted-memory-fact-rendered", result.beforeForgetText.includes("Persisted cockpit E2E memory fact"), result.beforeForgetText);
    assertCheck(checks, "memory-forget-contract-called", result.forgotten.includes("mem-e2e-1"), JSON.stringify(result.forgotten));
    assertCheck(checks, "trusted-folder-panel-present", result.trustedPanel, "Trusted folder panel is available for drag/drop or manual path.");
    assertCheck(checks, "no-external-demo-memory-copy", !result.fakeExternalDemoText, "No external demo memory label rendered.");
    assertCheck(checks, "browser-console-clean", consoleErrors.length === 0, consoleErrors.join("\n"));

    const failed = checks.filter((check) => !check.passed);
    const report = {
      ok: failed.length === 0,
      surface: "zavorthControl-cockpit-memory-e2e",
      checks,
    };
    console.log(JSON.stringify(report, null, 2));
    if (failed.length) process.exitCode = 1;
  } finally {
    await browser.close().catch(() => undefined);
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(`[zavorth-control-cockpit-memory-e2e] FAIL ${error?.message || error}`);
  process.exit(1);
});
