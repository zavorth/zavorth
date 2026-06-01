#!/usr/bin/env node

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const staticDir = path.join(rootDir, "src", "ai-gateway", "public", "zavorth-control-vite-shell");
const defaultOutDir = path.join(rootDir, ".tmp", "zavorth-control-streaming-e2e");

type CheckStatus = "pass" | "fail";

type Check = {
  id: string;
  status: CheckStatus;
  detail: string;
};

type Report = {
  ok: boolean;
  generatedAt: string;
  url: string;
  outDir: string;
  checks: Check[];
  screenshots: string[];
  metrics: Record<string, unknown>;
};

type SseClient = {
  id: number;
  response: http.ServerResponse;
};

type HarnessState = {
  sessionId: string;
  runId: string;
  runStatus: "idle" | "running" | "completed";
  chatSendCalls: unknown[];
  steerCalls: unknown[];
  streamEvents: Array<{ phase: string; accumulated?: string; at: number }>;
  clients: SseClient[];
  timers: NodeJS.Timeout[];
  nextClientId: number;
  steeringAssimilated: boolean;
  startedAt: string;
  completedAt: string | null;
};

function readCliValue(name: string): string {
  const prefix = `--${name}=`;
  const arg = process.argv.slice(2).find((entry) => entry.startsWith(prefix));
  return String(arg?.slice(prefix.length) || "").trim();
}

function readOptions() {
  return {
    outDir: path.resolve(rootDir, readCliValue("out") || defaultOutDir),
    requirePass: process.argv.includes("--require-pass"),
  };
}

function createReport(outDir: string): Report {
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    url: "",
    outDir,
    checks: [],
    screenshots: [],
    metrics: {},
  };
}

function addCheck(report: Report, id: string, condition: boolean, detail: string): void {
  report.checks.push({ id, status: condition ? "pass" : "fail", detail });
  if (!condition) report.ok = false;
}

function writeReport(report: Report): void {
  fs.mkdirSync(report.outDir, { recursive: true });
  fs.writeFileSync(path.join(report.outDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(
    path.join(report.outDir, "summary.md"),
    [
      "# ZavorthControl Streaming E2E",
      "",
      `Status: ${report.ok ? "PASS" : "FAIL"}`,
      `URL: ${report.url}`,
      "",
      "## Checks",
      "",
      ...report.checks.map((check) => `- [${check.status === "pass" ? "x" : " "}] ${check.id}: ${check.detail}`),
      "",
      "## Screenshots",
      "",
      ...report.screenshots.map((screenshot) => `- ${screenshot}`),
      "",
    ].join("\n"),
    "utf8",
  );
}

function contentTypeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js") return "text/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".woff2") return "font/woff2";
  return "application/octet-stream";
}

function json(response: http.ServerResponse, body: unknown, status = 200): void {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  });
  response.end(`${JSON.stringify(body)}\n`);
}

function notFound(response: http.ServerResponse, body: unknown = { ok: false, error: "not_found" }): void {
  json(response, body, 404);
}

function readRequestJson(request: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let raw = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      raw += chunk;
    });
    request.on("end", () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function createHarnessState(): HarnessState {
  return {
    sessionId: "stream-e2e-session",
    runId: "stream-e2e-run",
    runStatus: "idle",
    chatSendCalls: [],
    steerCalls: [],
    streamEvents: [],
    clients: [],
    timers: [],
    nextClientId: 1,
    steeringAssimilated: false,
    startedAt: new Date().toISOString(),
    completedAt: null,
  };
}

function activeRun(state: HarnessState) {
  if (state.runStatus === "idle") return null;
  return {
    id: state.runId,
    runId: state.runId,
    sessionId: state.sessionId,
    title: "Streaming E2E provider run",
    summary: state.runStatus === "completed" ? "Streaming proof completed" : "Provider-native SSE stream in progress",
    status: state.runStatus === "completed" ? "completed" : "running",
    channel: "web",
    traceId: "stream-e2e-trace",
    createdAt: state.startedAt,
    updatedAt: state.completedAt || new Date().toISOString(),
    events: state.streamEvents.map((event, index) => ({
      id: `stream-event-${index + 1}`,
      kind: "agent-stream",
      title: `stream ${event.phase}`,
      detail: event.accumulated || "",
      status: event.phase,
      createdAt: new Date(event.at).toISOString(),
    })),
    artifacts: [],
    approvals: [],
  };
}

function snapshot(state: HarnessState) {
  const run = activeRun(state);
  return {
    sessionId: state.sessionId,
    generatedAt: new Date().toISOString(),
    activeRun: run,
    runs: run ? [run] : [],
    workflowJobs: [],
    approvals: [],
    artifacts: [],
    messages: [],
    provider: {
      id: "fake-sse-provider",
      label: "Fake SSE Provider",
      nativeTokenStreaming: true,
    },
  };
}

function writeSse(response: http.ServerResponse, eventName: string, payload: unknown): void {
  response.write(`event: ${eventName}\n`);
  response.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function broadcast(state: HarnessState, eventName: string, payload: unknown): void {
  for (const client of state.clients) {
    writeSse(client.response, eventName, payload);
  }
}

function broadcastAgentStream(state: HarnessState, phase: string, payload: Record<string, unknown>): void {
  const event = {
    id: `stream-e2e-${phase}-${state.streamEvents.length + 1}`,
    type: "agent-stream",
    createdAt: new Date().toISOString(),
    payload: {
      eventType: "agent.stream.assistant",
      runId: state.runId,
      sessionId: state.sessionId,
      streamId: `${state.runId}:assistant`,
      providerId: "fake-sse-provider",
      modelId: "fake-stream-model",
      providerNativeTokenStreaming: true,
      phase,
      done: phase === "done",
      ...payload,
    },
  };
  state.streamEvents.push({
    phase,
    accumulated: String(event.payload.accumulated || event.payload.delta || ""),
    at: Date.now(),
  });
  broadcast(state, "agent-stream", event);
}

function schedule(state: HarnessState, delayMs: number, task: () => void): void {
  state.timers.push(setTimeout(task, delayMs));
}

function startFakeStreaming(state: HarnessState): void {
  state.runStatus = "running";
  state.completedAt = null;
  state.steeringAssimilated = false;
  state.streamEvents = [];

  schedule(state, 80, () => {
    broadcast(state, "snapshot", {
      id: "stream-e2e-snapshot-running",
      type: "snapshot",
      payload: snapshot(state),
    });
    broadcast(state, "agent-stream", {
      id: "stream-e2e-lifecycle-start",
      type: "agent-stream",
      createdAt: new Date().toISOString(),
      payload: {
        eventType: "agent.stream.lifecycle",
        phase: "start",
        runId: state.runId,
        sessionId: state.sessionId,
        streamId: `${state.runId}:assistant`,
        title: "Fake provider stream started",
        summary: "The harness is emitting provider-native SSE tokens.",
      },
    });
  });

  schedule(state, 220, () => {
    broadcastAgentStream(state, "delta", {
      delta: "provider alpha-one ",
      accumulated: "provider alpha-one ",
      chunkIndex: 1,
    });
  });

  schedule(state, 720, () => {
    broadcastAgentStream(state, "delta", {
      delta: "beta-two ",
      accumulated: "provider alpha-one beta-two ",
      chunkIndex: 2,
    });
  });

  schedule(state, 1_220, () => {
    const steeringText = state.steeringAssimilated ? "guide-ack " : "";
    broadcastAgentStream(state, "delta", {
      delta: `${steeringText}gamma-three `,
      accumulated: `provider alpha-one beta-two ${steeringText}gamma-three `,
      chunkIndex: 3,
    });
  });

  schedule(state, 1_800, () => {
    const steeringText = state.steeringAssimilated ? "guide-ack " : "";
    state.runStatus = "completed";
    state.completedAt = new Date().toISOString();
    broadcastAgentStream(state, "done", {
      delta: "omega-final",
      accumulated: `provider alpha-one beta-two ${steeringText}gamma-three omega-final`,
      chunkIndex: 4,
    });
    broadcast(state, "snapshot", {
      id: "stream-e2e-snapshot-completed",
      type: "snapshot",
      payload: snapshot(state),
    });
  });
}

function serveStatic(response: http.ServerResponse, requestPath: string): void {
  const decoded = decodeURIComponent(requestPath === "/" ? "/index.html" : requestPath);
  const candidate = path.resolve(staticDir, `.${decoded}`);
  if (!candidate.startsWith(staticDir) || !fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) {
    notFound(response);
    return;
  }
  response.writeHead(200, {
    "Content-Type": contentTypeFor(candidate),
    "Cache-Control": "no-store",
  });
  fs.createReadStream(candidate).pipe(response);
}

async function handleApi(request: http.IncomingMessage, response: http.ServerResponse, state: HarnessState, url: URL): Promise<void> {
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, X-Zavorth-Token",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    });
    response.end();
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/web/events") {
    response.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    response.write(": connected\n\n");
    const client = { id: state.nextClientId++, response };
    state.clients.push(client);
    writeSse(response, "ping", { id: "stream-e2e-ping", type: "ping", payload: { ok: true } });
    request.on("close", () => {
      state.clients = state.clients.filter((entry) => entry.id !== client.id);
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/auth/status") {
    json(response, { authenticated: true, authRequired: false, webReady: true, gatewayReady: true, source: "streaming-e2e" });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/validate") {
    json(response, { ok: true, authenticated: true, authRequired: false });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/web/zavorthControl") {
    json(response, { live: true, authRequired: false, generatedAt: new Date().toISOString(), snapshot: snapshot(state) });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/providers/model-catalog") {
    json(response, {
      providers: [{
        id: "fake-sse-provider",
        label: "Fake SSE Provider",
        status: "ready",
        models: [{ id: "fake-stream-model", label: "Fake Stream Model", capabilities: ["native_token_streaming"] }],
      }],
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/providers/activation") {
    json(response, { ok: true, activeProviderId: "fake-sse-provider", activeModelId: "fake-stream-model" });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/web/gateway/sessions/history") {
    json(response, { sessionId: state.sessionId, snapshot: snapshot(state), messages: [] });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/web/dashboard/events") {
    json(response, { events: [] });
    return;
  }

  if (request.method === "GET" && [
    "/api/v2/sales-pack/snapshot",
    "/api/v2/sales-pack/channel-io/snapshot",
    "/api/web/catalog",
    "/api/web/runtime/companions",
    "/api/web/gateway/runtime",
    "/api/web/permissions",
    "/api/web/artifacts",
  ].includes(url.pathname)) {
    json(response, { ok: true, items: [], approvals: [], artifacts: [], companions: [], runtime: { status: "ready" } });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/web/chat/send") {
    const body = await readRequestJson(request);
    state.chatSendCalls.push(body);
    startFakeStreaming(state);
    json(response, {
      ok: true,
      sessionId: state.sessionId,
      runId: state.runId,
      run: activeRun(state),
      snapshot: snapshot(state),
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/web/chat/steer") {
    const body = await readRequestJson(request);
    state.steerCalls.push(body);
    state.steeringAssimilated = true;
    broadcast(state, "agent-stream", {
      id: `stream-e2e-steer-${state.steerCalls.length}`,
      type: "agent-stream",
      createdAt: new Date().toISOString(),
      payload: {
        eventType: "agent.stream.lifecycle",
        phase: "steering-accepted",
        runId: state.runId,
        sessionId: state.sessionId,
        streamId: `${state.runId}:assistant`,
        title: "Steering accepted",
        summary: "The fake provider stream will assimilate the steering update.",
      },
    });
    json(response, {
      ok: true,
      sessionId: state.sessionId,
      runId: state.runId,
      ack: { id: "stream-e2e-steer-ack", status: "accepted" },
      steering: { id: "stream-e2e-steer", status: "accepted" },
      snapshot: snapshot(state),
    });
    return;
  }

  notFound(response);
}

function startServer(state: HarnessState): Promise<{ server: http.Server; url: string }> {
  if (!fs.existsSync(path.join(staticDir, "index.html"))) {
    throw new Error(`Built ZavorthControl shell not found at ${staticDir}. Run npm run zavorth-control-vite:build first.`);
  }

  const server = http.createServer((request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    if (url.pathname.startsWith("/api/")) {
      handleApi(request, response, state, url).catch((error) => {
        json(response, { ok: false, error: String(error?.message || error) }, 500);
      });
      return;
    }
    serveStatic(response, url.pathname);
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not read server address."));
        return;
      }
      resolve({ server, url: `http://127.0.0.1:${address.port}/` });
    });
  });
}

async function stopServer(server: http.Server, state: HarnessState): Promise<void> {
  for (const timer of state.timers) clearTimeout(timer);
  for (const client of state.clients) client.response.end();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

async function sendComposerMessage(page: any, text: string): Promise<void> {
  await page.locator("#compose-input").fill(text);
  await page.evaluate(`(() => {
    const input = document.getElementById("compose-input");
    input?.dispatchEvent(new Event("input", { bubbles: true }));
    document.getElementById("send-btn")?.click();
  })()`);
}

async function run(): Promise<Report> {
  const options = readOptions();
  const report = createReport(options.outDir);
  fs.mkdirSync(options.outDir, { recursive: true });

  const state = createHarnessState();
  const { server, url } = await startServer(state);
  report.url = `${url}?token=stream-e2e-token&sessionId=${encodeURIComponent(state.sessionId)}&fresh=${Date.now()}`;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 }, deviceScaleFactor: 1 });
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => {
    pageErrors.push(String(error?.message || error));
  });

  try {
    await page.goto(report.url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForSelector("#compose-input", { timeout: 20_000 });
    await page.waitForFunction(`Boolean(window.ZavorthRuntimeBridge && window.ZavorthControlChat)`, null, { timeout: 20_000 });

    await page.evaluate(`(() => {
      const metrics = {
        samples: [],
      };
      window.__zavorthStreamingE2e = metrics;
      const feed = document.getElementById("neural-feed") || document.body;
      const sample = () => {
        const groups = Array.from(document.querySelectorAll(".echo-group--agent-stream"));
        const group = groups[groups.length - 1];
        const bubble = group?.querySelector(".echo-bubble");
        if (!bubble) return;
        const text = String(bubble.textContent || "").replace(/\s+/g, " ").trim();
        metrics.samples.push({ text, className: group.className, at: Date.now() });
      };
      const observer = new MutationObserver(sample);
      observer.observe(feed, { childList: true, subtree: true, characterData: true, attributes: true });
      sample();
    })()`);

    const shellScreenshot = path.join(options.outDir, "01-shell-loaded.png");
    await page.screenshot({ path: shellScreenshot, fullPage: true });
    report.screenshots.push(shellScreenshot);

    await sendComposerMessage(page, "Start a provider-native streaming E2E proof.");
    await page.waitForFunction(
      `Array.from(document.querySelectorAll(".echo-group--agent-stream .echo-bubble")).some((node) => /alpha-one/.test(node.textContent || ""))`,
      null,
      { timeout: 10_000 },
    );

    await sendComposerMessage(page, "/steer fold in the steering update before the final token");

    await page.waitForFunction(
      `Array.from(document.querySelectorAll(".echo-group--agent-stream .echo-bubble")).some((node) => /guide-ack/.test(node.textContent || ""))`,
      null,
      { timeout: 10_000 },
    );
    await page.waitForFunction(
      `Array.from(document.querySelectorAll(".echo-group--agent-stream.is-complete .echo-bubble")).some((node) => /omega-final/.test(node.textContent || ""))`,
      null,
      { timeout: 10_000 },
    );

    const finalScreenshot = path.join(options.outDir, "02-streaming-complete.png");
    await page.screenshot({ path: finalScreenshot, fullPage: true });
    report.screenshots.push(finalScreenshot);

    const domMetrics = await page.evaluate(`(() => {
      const samples = window.__zavorthStreamingE2e?.samples || [];
      const firstPartial = samples.find((sample) => /alpha-one/.test(sample.text));
      const firstSteer = samples.find((sample) => /guide-ack/.test(sample.text));
      const firstDone = samples.find((sample) => /omega-final/.test(sample.text) || /\bis-complete\b/.test(sample.className));
      const groups = Array.from(document.querySelectorAll(".echo-group--agent-stream"));
      const group = groups[groups.length - 1];
      const finalText = String(group?.querySelector(".echo-bubble")?.textContent || "").replace(/\s+/g, " ").trim();
      return {
        sampleCount: samples.length,
        firstPartialAt: firstPartial?.at || 0,
        firstSteerAt: firstSteer?.at || 0,
        firstDoneAt: firstDone?.at || 0,
        partialBeforeDone: Boolean(firstPartial && firstDone && firstPartial.at < firstDone.at),
        steerBeforeDone: Boolean(firstSteer && firstDone && firstSteer.at <= firstDone.at),
        finalText,
        finalClassName: group?.className || "",
      };
    })()`);

    report.metrics.dom = domMetrics;
    report.metrics.server = {
      chatSendCalls: state.chatSendCalls.length,
      steerCalls: state.steerCalls.length,
      streamEvents: state.streamEvents,
      activeClientsAfterRun: state.clients.length,
    };
    const runtimeConsoleErrors = consoleErrors.filter((entry) => !/^Failed to load resource:/i.test(entry));
    report.metrics.consoleErrors = consoleErrors;
    report.metrics.runtimeConsoleErrors = runtimeConsoleErrors;
    report.metrics.pageErrors = pageErrors;

    addCheck(report, "dashboard-shell-loaded", true, "Built ZavorthControl shell loaded with the real runtime bridge.");
    addCheck(report, "chat-send-hit-fake-api", state.chatSendCalls.length === 1, `POST /api/web/chat/send calls: ${state.chatSendCalls.length}.`);
    addCheck(report, "provider-delta-rendered-before-done", Boolean((domMetrics as any).partialBeforeDone), "DOM observed alpha-one before the final done/completed state.");
    addCheck(report, "steer-sent-during-stream", state.steerCalls.length === 1, `POST /api/web/chat/steer calls: ${state.steerCalls.length}.`);
    addCheck(report, "steer-assimilated-before-final", Boolean((domMetrics as any).steerBeforeDone), "DOM observed guide-ack before the completed stream.");
    addCheck(report, "final-stream-text-complete", /alpha-one.*guide-ack.*omega-final/.test(String((domMetrics as any).finalText)), `Final stream text: ${(domMetrics as any).finalText}`);
    addCheck(report, "server-event-order", state.streamEvents.some((event) => event.phase === "delta") && state.streamEvents.at(-1)?.phase === "done", "Fake SSE provider emitted deltas and then done.");
    addCheck(report, "no-browser-runtime-errors", runtimeConsoleErrors.length === 0 && pageErrors.length === 0, [...runtimeConsoleErrors, ...pageErrors].join(" | ") || "No browser runtime errors observed.");
  } finally {
    await browser.close().catch(() => undefined);
    await stopServer(server, state);
  }

  writeReport(report);
  return report;
}

run().then((report) => {
  const failed = report.checks.filter((check) => check.status === "fail");
  console.log(JSON.stringify({
    ok: report.ok,
    report: path.join(report.outDir, "report.json"),
    summary: path.join(report.outDir, "summary.md"),
    failed,
  }, null, 2));
  if (!report.ok && process.argv.includes("--require-pass")) {
    process.exitCode = 1;
  }
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
