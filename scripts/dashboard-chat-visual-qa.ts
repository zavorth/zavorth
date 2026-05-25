#!/usr/bin/env node

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetDir = path.join(rootDir, "assets", "dashboard");
const defaultOutDir = path.join(rootDir, ".tmp", "dashboard-chat-visual-qa");

type CliOptions = {
  outDir: string;
  requirePass: boolean;
};

type QaCheck = {
  id: string;
  status: "pass" | "fail";
  detail: string;
};

type QaReport = {
  ok: boolean;
  generatedAt: string;
  url: string;
  outDir: string;
  screenshots: string[];
  checks: QaCheck[];
  metrics: Record<string, unknown>;
};

type RuntimeState = {
  sessionId: string;
  messages: Array<{ id: string; role: "user" | "assistant"; content: string; kind?: string }>;
  runs: any[];
  artifacts: any[];
};

function readOptions(): CliOptions {
  const outArg = process.argv.slice(2).find((arg) => arg.startsWith("--out="));
  return {
    outDir: path.resolve(rootDir, String(outArg?.split("=").slice(1).join("=") || defaultOutDir).trim()),
    requirePass: process.argv.includes("--require-pass"),
  };
}

function contentTypeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js") return "text/javascript; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".png") return "image/png";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "application/octet-stream";
}

function safeAssetPath(urlPath: string): string | null {
  const normalized = urlPath === "/" || urlPath === "/dashboard"
    ? "index.html"
    : urlPath.replace(/^\/+/, "");
  const absolute = path.resolve(assetDir, normalized);
  if (!absolute.startsWith(assetDir)) {
    return null;
  }
  return absolute;
}

function responseDecisionFor(kind: "conversation" | "approval" | "artifact") {
  if (kind === "conversation") {
    return {
      schemaVersion: 1,
      mode: "conversation",
      confidence: "high",
      reason: "Respond as normal chat; do not wake the agent runtime.",
      sourceReason: "conversation-only",
      target: { type: "none", value: null },
      requestedTools: [],
      responsePath: "fast-chat",
      shouldCreateArtifact: false,
      shouldShowArtifactInChat: false,
      artifactPolicy: {
        shouldCreateArtifact: false,
        shouldShowArtifactInChat: false,
        reason: "conversation-response-does-not-create-artifact",
      },
      diagnostics: { surface: "web", shouldExecute: false, semantic: false },
    };
  }

  if (kind === "approval") {
    return {
      schemaVersion: 1,
      mode: "operation",
      confidence: "high",
      reason: "Execute through the agent runtime (tool-affordance-detected).",
      sourceReason: "tool-affordance-detected",
      target: { type: "shell", value: null },
      requestedTools: ["shell.exec"],
      responsePath: "agent-runtime",
      shouldCreateArtifact: false,
      shouldShowArtifactInChat: false,
      artifactPolicy: {
        shouldCreateArtifact: false,
        shouldShowArtifactInChat: false,
        reason: "operation-without-user-facing-artifact",
      },
      diagnostics: { surface: "web", shouldExecute: true, semantic: false },
    };
  }

  return {
    schemaVersion: 1,
    mode: "operation",
    confidence: "high",
    reason: "Execute through the agent runtime (tool-affordance-detected).",
    sourceReason: "tool-affordance-detected",
    target: { type: "workflow", value: null },
    requestedTools: ["pdf.generate"],
    responsePath: "agent-runtime",
    shouldCreateArtifact: true,
    shouldShowArtifactInChat: true,
    artifactPolicy: {
      shouldCreateArtifact: true,
      shouldShowArtifactInChat: true,
      reason: "deliverable-artifact-requested",
    },
    diagnostics: { surface: "web", shouldExecute: true, semantic: false },
  };
}

function dashboardPayload(state: RuntimeState) {
  return {
    live: true,
    authRequired: false,
    sessionId: state.sessionId,
    modelProfile: {
      providerLabel: "Gemini",
      modelLabel: "gemini-2.5-flash",
      routingPolicy: "gateway",
      supportsTools: true,
    },
    snapshot: {
      activeSessionId: state.sessionId,
      modelProfile: {
        providerLabel: "Gemini",
        modelLabel: "gemini-2.5-flash",
        routingPolicy: "gateway",
        supportsTools: true,
      },
      activeRun: state.runs[0] || null,
      runs: state.runs,
      workflowJobs: [],
    },
  };
}

function json(res: http.ServerResponse, payload: unknown, status = 200): void {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(`${JSON.stringify(payload)}\n`);
}

function readBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function createQaServer(state: RuntimeState): Promise<{ server: http.Server; url: string }> {
  const server = http.createServer(async (req, res) => {
    const requestUrl = new URL(req.url || "/", "http://127.0.0.1");
    const pathname = requestUrl.pathname;

    if (pathname === "/api/auth/status") {
      json(res, {
        webReady: true,
        gatewayReady: true,
        tokenRequired: false,
        dashboardTokenConfigured: true,
      });
      return;
    }

    if (pathname === "/api/auth/validate") {
      json(res, { ok: true, valid: true });
      return;
    }

    if (pathname === "/api/web/dashboard") {
      json(res, dashboardPayload(state));
      return;
    }

    if (pathname === "/api/web/catalog") {
      json(res, {
        skills: [
          {
            id: "web.search",
            title: "Pesquisar na web",
            status: "pronta",
            prompt: "Pesquise fontes recentes e confiaveis.",
          },
        ],
      });
      return;
    }

    if (pathname === "/api/web/runtime/companions" || pathname === "/api/web/gateway/runtime") {
      json(res, { ok: true, items: [] });
      return;
    }

    if (pathname === "/api/web/events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-store",
        Connection: "close",
      });
      res.end(": dashboard-chat-visual-qa\n\n");
      return;
    }

    if (pathname === "/api/web/dashboard/events") {
      const sessionId = requestUrl.searchParams.get("sessionId") || state.sessionId;
      const runId = requestUrl.searchParams.get("runId") || "";
      const traceId = requestUrl.searchParams.get("traceId") || "";
      const events = state.runs.flatMap((run) => {
        const id = String(run?.id || "");
        const runTraceId = String(run?.traceId || "");
        const baseEvents = [
          {
            id: `agent-run:${id}:${run.status || "running"}`,
            type: "step",
            title: run.summary || "Agent run",
            detail: run.summary || "",
            meta: run.modelProfile?.modelLabel || "agent-run",
            status: run.status || "running",
            runId: id,
            traceId: runTraceId,
            sessionId,
            replay: { runId: id, traceId: runTraceId, sessionId, policy: "receipts only" },
          },
          ...((Array.isArray(run.approvals) ? run.approvals : []).map((approval: any) => ({
            id: `approval:${approval.id}:${approval.status || "pending"}`,
            type: "approval",
            title: approval.title || approval.id,
            detail: approval.summary || "",
            meta: approval.kind || "approval",
            status: approval.status || "pending",
            runId: id,
            traceId: runTraceId,
            sessionId,
            capability: approval.capability,
          }))),
          ...((Array.isArray(run.artifacts) ? run.artifacts : []).map((artifact: any) => ({
            id: `artifact:${artifact.id}`,
            type: "receipt",
            title: artifact.title || artifact.id,
            detail: artifact.summary || "",
            meta: artifact.kind || "artifact",
            status: artifact.status || "ready",
            runId: id,
            traceId: runTraceId,
            sessionId,
            receipt: { id: artifact.id, status: artifact.status || "ready", summary: artifact.summary, artifact: artifact.id },
            replay: { runId: id, traceId: runTraceId, sessionId, policy: "receipts only" },
          }))),
        ];
        return baseEvents;
      }).filter((event) => (!runId || event.runId === runId) && (!traceId || event.traceId === traceId));
      json(res, {
        ok: true,
        generatedAt: new Date().toISOString(),
        sessionId,
        query: { runId: runId || null, traceId: traceId || null },
        source: "persistent-session-history",
        summary: {
          totalEvents: events.length,
          runs: events.filter((event) => event.type === "step").length,
          approvals: events.filter((event) => event.type === "approval").length,
          artifacts: events.filter((event) => event.type === "receipt").length,
          errors: events.filter((event) => event.type === "error").length,
        },
        events,
      });
      return;
    }

    if (pathname === "/api/web/gateway/sessions/history") {
      json(res, {
        session: {
          sessionId: state.sessionId,
          transcript: state.messages,
        },
        snapshot: {
          sessionId: state.sessionId,
          messages: state.messages,
          permissions: [],
          tasks: [],
          workflowRuns: [],
        },
      });
      return;
    }

    if (pathname === "/api/web/permissions") {
      const approvals = state.runs.flatMap((run) => Array.isArray(run.approvals) ? run.approvals : []);
      json(res, { permissions: approvals, snapshot: { permissions: approvals, runs: state.runs } });
      return;
    }

    if (pathname === "/api/web/artifacts") {
      json(res, { artifacts: state.artifacts });
      return;
    }

    if (pathname === "/api/web/chat/send" && req.method === "POST") {
      const body = await readBody(req);
      const message = String(body?.message || "").trim();
      const userMessage = {
        id: `msg-user-${state.messages.length + 1}`,
        role: "user" as const,
        content: message,
      };
      let assistantContent = "Olá! Como posso ajudar você hoje?";
      let taskId: string | null = null;
      let runId: string | null = null;
      let artifacts: any[] = [];
      let responseDecision = responseDecisionFor("conversation");

      state.messages.push(userMessage);

      if (/rode|terminal|npm|shell|powershell/i.test(message)) {
        responseDecision = responseDecisionFor("approval");
        assistantContent = "Preciso da sua aprovação para continuar com segurança.";
        runId = "run-approval-visual-qa";
        state.runs = [
          {
            id: runId,
            traceId: "trace-approval-visual-qa",
            sessionId: state.sessionId,
            channel: "web",
            status: "waiting_approval",
            summary: "Comando aguardando aprovação visual.",
            modelProfile: dashboardPayload(state).modelProfile,
            approvals: [
              {
                id: "approval-shell-visual-qa",
                title: "Aprovar shell.exec",
                summary: "Rodar npm test no terminal local.",
                risk: "danger",
                status: "pending",
                runId,
                traceId: "trace-approval-visual-qa",
                sessionId: state.sessionId,
                capability: {
                  label: "shell.exec",
                  kind: "shell",
                  sideEffect: "process",
                  scope: "workspace",
                  risk: "danger",
                  previewRequired: true,
                  reason: "tool-affordance-detected",
                },
              },
            ],
            artifacts: [],
            metadata: {
              responseDecision,
              artifactPolicy: responseDecision.artifactPolicy,
            },
          },
        ];
      } else if (/pdf|relat[oó]rio|artifact|artefato/i.test(message)) {
        responseDecision = responseDecisionFor("artifact");
        assistantContent = "Relatório pronto para inspeção.";
        taskId = "task-artifact-visual-qa";
        runId = "run-artifact-visual-qa";
        artifacts = [
          {
            id: "artifact-pdf-visual-qa",
            title: "Relatório em PDF",
            kind: "report",
            summary: "Entregável explícito gerado pelo QA visual.",
            status: "ready",
            source: "agent-run",
            runId,
            sessionId: state.sessionId,
          },
        ];
        state.artifacts = artifacts;
        state.runs = [
          {
            id: runId,
            traceId: "trace-artifact-visual-qa",
            sessionId: state.sessionId,
            channel: "web",
            status: "completed",
            summary: "Relatório PDF pronto.",
            modelProfile: dashboardPayload(state).modelProfile,
            approvals: [],
            artifacts,
            metadata: {
              responseDecision,
              artifactPolicy: responseDecision.artifactPolicy,
            },
          },
          ...state.runs.filter((run) => run.id !== runId),
        ];
      }

      const assistantMessage = {
        id: `msg-assistant-${state.messages.length + 1}`,
        role: "assistant" as const,
        content: assistantContent,
        kind: responseDecision.responsePath === "fast-chat" ? "conversation" : "universal-agent-runtime",
      };
      state.messages.push(assistantMessage);

      json(res, {
        sessionId: state.sessionId,
        taskId,
        runId,
        artifacts,
        responseDecision,
        artifactPolicy: responseDecision.artifactPolicy,
        snapshot: {
          sessionId: state.sessionId,
          messages: state.messages,
          permissions: state.runs.flatMap((run) => Array.isArray(run.approvals) ? run.approvals : []),
          tasks: [],
          workflowRuns: [],
          runs: state.runs,
          activeRun: state.runs[0] || null,
        },
      });
      return;
    }

    const filePath = safeAssetPath(pathname);
    if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    res.writeHead(200, {
      "Content-Type": contentTypeFor(filePath),
      "Cache-Control": "no-store",
    });
    fs.createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("Nao foi possivel abrir servidor local de QA visual.");
      }
      resolve({
        server,
        url: `http://127.0.0.1:${address.port}/dashboard`,
      });
    });
  });
}

function pushCheck(report: QaReport, id: string, condition: boolean, detail: string): void {
  report.checks.push({
    id,
    status: condition ? "pass" : "fail",
    detail,
  });
  if (!condition) {
    report.ok = false;
  }
}

function writeReport(report: QaReport): void {
  fs.mkdirSync(report.outDir, { recursive: true });
  fs.writeFileSync(path.join(report.outDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(
    path.join(report.outDir, "summary.md"),
    [
      "# Dashboard Chat Visual QA",
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

async function sendComposerMessage(page: any, text: string): Promise<void> {
  await page.locator("#compose-input").fill(text);
  await page.evaluate(() => {
    const input = document.getElementById("compose-input");
    input?.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.evaluate(() => {
    document.getElementById("send-btn")?.click();
  });
}

async function runQa(options: CliOptions): Promise<QaReport> {
  const state: RuntimeState = {
    sessionId: "qa-dashboard-session",
    messages: [],
    runs: [],
    artifacts: [],
  };
  const { server, url } = await createQaServer(state);
  const report: QaReport = {
    ok: true,
    generatedAt: new Date().toISOString(),
    url,
    outDir: options.outDir,
    screenshots: [],
    checks: [],
    metrics: {},
  };

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 980 },
    deviceScaleFactor: 1,
  });

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    await page.waitForSelector("#compose-input", { timeout: 15_000 });
    await page.waitForSelector("#boot-gate.hidden", { timeout: 10_000 });

    const initialScreenshot = path.join(options.outDir, "01-chat-shell.png");
    fs.mkdirSync(options.outDir, { recursive: true });
    await page.screenshot({ path: initialScreenshot, fullPage: true });
    report.screenshots.push(initialScreenshot);

    const shellState = await page.evaluate(() => ({
      hasCoreFrame: Boolean(document.getElementById("core-frame")),
      hasLargeMascot: Array.from(document.querySelectorAll("img")).some((img) => {
        const box = img.getBoundingClientRect();
        return box.width > 220 || box.height > 220;
      }),
      hasComposer: Boolean(document.getElementById("compose-input")),
      hasSendButton: Boolean(document.getElementById("send-btn")),
      pulseLabel: document.querySelector("#core-pulse .bridge__pulse-label")?.textContent?.trim() || "",
      authState: document.getElementById("core-pulse")?.getAttribute("data-auth-state") || "",
    }));
    pushCheck(report, "preserves-user-dashboard-shell", shellState.hasCoreFrame && !shellState.hasLargeMascot && shellState.hasComposer && shellState.hasSendButton, "Dashboard premium continua sendo o shell testado sem imagem gigante bloqueando a tela.");
    pushCheck(report, "runtime-unlocked-state-visible", shellState.authState === "unlocked" && /Core/.test(shellState.pulseLabel), "Topo indica runtime local desbloqueado/conectado.");

    await page.evaluate(() => {
      const signalFeed = document.getElementById("signal-feed");
      if (signalFeed) signalFeed.innerHTML = "";
      const qa = {
        scrollSamples: [] as Array<{ t: number; top: number; height: number; client: number; bottomGap: number }>,
        toasts: [] as string[],
      };
      (window as any).__zavorthChatVisualQa = qa;
      const stream = document.getElementById("neural-stream");
      const observer = new MutationObserver(() => {
        qa.toasts = Array.from(document.querySelectorAll(".signal-toast")).map((node) => node.textContent?.trim() || "");
      });
      if (signalFeed) observer.observe(signalFeed, { childList: true, subtree: true });
      (window as any).__zavorthChatVisualQaObserver = observer;
      (window as any).__zavorthChatVisualQaInterval = window.setInterval(() => {
        if (!stream) return;
        qa.scrollSamples.push({
          t: performance.now(),
          top: stream.scrollTop,
          height: stream.scrollHeight,
          client: stream.clientHeight,
          bottomGap: stream.scrollHeight - stream.clientHeight - stream.scrollTop,
        });
      }, 25);
    });

    await page.evaluate(() => {
      document.getElementById("terminal-view")?.classList.remove("is-empty");
      const chat = (window as any).ZavorthDashboardChat;
      for (let index = 0; index < 18; index += 1) {
        chat?.appendEcho(index % 2 === 0 ? "operator" : "core", `Mensagem histórica ${index + 1} para estabilizar o scroll.`);
      }
      const stream = document.getElementById("neural-stream");
      if (stream) stream.scrollTop = stream.scrollHeight;
    });
    await page.waitForTimeout(250);
    await page.evaluate(() => {
      const stream = document.getElementById("neural-stream");
      if (stream) stream.scrollTop = stream.scrollHeight;
      const qa = (window as any).__zavorthChatVisualQa;
      if (qa) qa.scrollSamples = [];
    });

    const beforeSimple = await page.evaluate(() => {
      const stream = document.getElementById("neural-stream");
      const top = stream?.scrollTop || 0;
      const height = stream?.scrollHeight || 0;
      const client = stream?.clientHeight || 0;
      return {
        top,
        height,
        client,
        bottomGap: Math.max(0, height - client - top),
      };
    });

    await sendComposerMessage(page, "oi");
    await page.waitForFunction(() => /Como posso ajudar/.test(document.body.innerText), null, { timeout: 10_000 });
    await page.waitForTimeout(700);

    const simpleState = await page.evaluate(() => {
      const qa = (window as any).__zavorthChatVisualQa || { scrollSamples: [], toasts: [] };
      const artifactCards = document.querySelectorAll(".zavorth-artifact-card").length;
      const approvalCards = document.querySelectorAll(".zavorth-approval-card").length;
      const echoGroups = document.querySelectorAll(".echo-group").length;
      const toasts = Array.from(document.querySelectorAll(".signal-toast")).map((node) => node.textContent?.trim() || "");
      const samples = qa.scrollSamples || [];
      const minTop = samples.reduce((min: number, sample: any) => Math.min(min, Number(sample.top || 0)), Number.POSITIVE_INFINITY);
      const maxBottomGap = samples.reduce((max: number, sample: any) => Math.max(max, Number(sample.bottomGap || 0)), 0);
      return { artifactCards, approvalCards, echoGroups, toasts, minTop, maxBottomGap, samples: samples.length };
    });

    report.metrics.beforeSimple = beforeSimple;
    report.metrics.simpleState = simpleState;
    pushCheck(report, "simple-chat-has-no-artifact-card", simpleState.artifactCards === 0, "Saudação não mostra card de artefato.");
    pushCheck(report, "simple-chat-has-no-approval-card", simpleState.approvalCards === 0, "Saudação não mostra approval.");
    pushCheck(report, "no-message-sent-toast", !simpleState.toasts.some((toast: string) => /mensagem enviada/i.test(toast)), "Enviar mensagem não cria popup 'mensagem enviada'.");
    pushCheck(
      report,
      "no-scroll-jump-after-send",
      Number(simpleState.minTop) >= Math.max(0, Number(beforeSimple.top) - 160)
        && Number(simpleState.maxBottomGap) <= Number(beforeSimple.bottomGap || 0) + 220,
      "Chat não salta para o topo antes de voltar ao fim.",
    );

    const simpleScreenshot = path.join(options.outDir, "02-simple-chat.png");
    await page.screenshot({ path: simpleScreenshot, fullPage: true });
    report.screenshots.push(simpleScreenshot);

    await sendComposerMessage(page, "rode npm test no terminal");
    await page.waitForFunction(() => document.querySelectorAll(".zavorth-approval-card").length > 0, null, { timeout: 3_000 }).catch(() => undefined);
    const approvalState = await page.evaluate(() => ({
      approvalCards: document.querySelectorAll(".zavorth-approval-card").length,
      artifactCards: document.querySelectorAll(".zavorth-artifact-card").length,
      traceButtons: document.querySelectorAll(".zavorth-approval-card [data-zavorth-trace-action='open']").length,
      text: document.querySelector(".zavorth-approval-card")?.textContent || "",
    }));
    report.metrics.approvalState = approvalState;
    pushCheck(report, "approval-card-appears-for-risky-command", approvalState.approvalCards === 1 && /npm test|shell/i.test(approvalState.text), "Comando de terminal vira um unico card de aprovação antes de execução.");
    pushCheck(report, "approval-does-not-create-artifact", approvalState.artifactCards === 0, "Approval não cria artefato falso.");
    pushCheck(report, "approval-card-has-trace-button", approvalState.traceButtons === 1, "Approval com runId expoe botao Ver trace.");

    const approvalScreenshot = path.join(options.outDir, "03-approval-card.png");
    await page.screenshot({ path: approvalScreenshot, fullPage: true });
    report.screenshots.push(approvalScreenshot);

    await page.locator("#trace-sheet-trigger").click();
    await page.waitForSelector("#trace-sheet.active", { timeout: 3_000 });
    const traceSheetState = await page.evaluate(() => ({
      active: document.getElementById("trace-sheet")?.classList.contains("active") || false,
      text: document.getElementById("trace-sheet")?.textContent || "",
      chips: Array.from(document.querySelectorAll(".trace-sheet__chip")).map((node) => node.textContent?.trim() || ""),
      summaries: document.querySelectorAll(".trace-sheet__summary").length,
      receipts: document.querySelectorAll(".trace-sheet__receipt").length,
      replay: document.querySelectorAll(".trace-sheet__replay").length,
    }));
    report.metrics.traceSheetState = traceSheetState;
    pushCheck(report, "trace-sheet-shows-safe-explanation", traceSheetState.active && /Explicacao segura do run|Raciocinio bruto/i.test(traceSheetState.text), "Trace Sheet explica steps seguros sem expor raciocinio bruto.");
    pushCheck(report, "trace-sheet-shows-tool-intelligence", traceSheetState.chips.some((chip: string) => /shell\.exec/i.test(chip)) && /preview required|workspace/i.test(traceSheetState.text), "Trace Sheet mostra capability, risco, preview e escopo.");

    const traceScreenshot = path.join(options.outDir, "04-trace-sheet.png");
    await page.screenshot({ path: traceScreenshot, fullPage: true });
    report.screenshots.push(traceScreenshot);
    await page.keyboard.press("Escape");

    await sendComposerMessage(page, "gere um relatório em PDF");
    await page.waitForFunction(() => document.querySelectorAll(".zavorth-artifact-card").length > 0, null, { timeout: 10_000 });
    const artifactState = await page.evaluate(() => ({
      artifactCards: document.querySelectorAll(".zavorth-artifact-card").length,
      traceButtons: document.querySelectorAll(".zavorth-artifact-card [data-zavorth-trace-action='open']").length,
      text: document.querySelector(".zavorth-artifact-card")?.textContent || "",
      modelLabels: Array.from(document.querySelectorAll(".echo-meta__model")).map((node) => node.textContent?.trim() || "").filter(Boolean),
    }));
    report.metrics.artifactState = artifactState;
    pushCheck(report, "artifact-card-only-for-explicit-deliverable", artifactState.artifactCards >= 1 && /PDF/i.test(artifactState.text), "Card de artefato aparece para pedido explícito de PDF.");
    pushCheck(report, "artifact-card-has-trace-button", artifactState.traceButtons >= 1, "Artifact com runId expoe botao Ver trace.");
    pushCheck(report, "current-model-label-is-real", artifactState.modelLabels.some((label: string) => label === "gemini-2.5-flash"), "Chat mostra o modelo atual real, não texto fixo.");

    await page.locator(".zavorth-artifact-card [data-zavorth-trace-action='open']").first().click();
    await page.waitForSelector("#trace-sheet.active", { timeout: 3_000 });
    const artifactTraceButtonState = await page.evaluate(() => ({
      text: document.getElementById("trace-sheet")?.textContent || "",
      url: window.location.href,
    }));
    report.metrics.artifactTraceButtonState = artifactTraceButtonState;
    pushCheck(report, "artifact-trace-button-opens-focused-trace", /run run-artifact-visual-qa|Relat.rio em PDF/i.test(artifactTraceButtonState.text), "Botao Ver trace do artifact abre Trace Sheet focado.");

    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.getElementById("trace-sheet")?.classList.contains("active"), null, { timeout: 3_000 });
    await page.locator("#trace-sheet-trigger").click();
    await page.waitForSelector("#trace-sheet.active", { timeout: 3_000 });
    const receiptTraceState = await page.evaluate(() => ({
      text: document.getElementById("trace-sheet")?.textContent || "",
      receiptBlocks: document.querySelectorAll(".trace-sheet__receipt").length,
      replayBlocks: document.querySelectorAll(".trace-sheet__replay").length,
    }));
    report.metrics.receiptTraceState = receiptTraceState;
    pushCheck(report, "trace-sheet-shows-receipts-and-replay", receiptTraceState.receiptBlocks >= 1 && receiptTraceState.replayBlocks >= 1 && /receipts only|Replay context/i.test(receiptTraceState.text), "Trace Sheet mostra receipts e contexto de replay seguro.");

    await page.evaluate(async () => {
      await (window as any).ZavorthRuntimeBridge?.openPersistentTrace?.({
        runId: "run-artifact-visual-qa",
        traceId: "trace-artifact-visual-qa",
      });
    });
    await page.waitForSelector("#trace-sheet.active", { timeout: 3_000 });
    const persistentTraceState = await page.evaluate(() => ({
      text: document.getElementById("trace-sheet")?.textContent || "",
      url: window.location.href,
      receiptBlocks: document.querySelectorAll(".trace-sheet__receipt").length,
      replayBlocks: document.querySelectorAll(".trace-sheet__replay").length,
    }));
    report.metrics.persistentTraceState = persistentTraceState;
    pushCheck(report, "trace-sheet-loads-persistent-run-events", persistentTraceState.receiptBlocks >= 1 && /run run-artifact-visual-qa|trace trace-artifact-visual-qa|Relat.rio em PDF/i.test(persistentTraceState.text), "Trace Sheet abre eventos persistentes filtrados por runId/traceId.");
    pushCheck(report, "trace-sheet-excludes-neighbor-session-runs", !/run run-approval-visual-qa|trace trace-approval-visual-qa/i.test(persistentTraceState.text), "Trace Sheet focado nao mistura outras runs da mesma sessao.");
    pushCheck(report, "trace-sheet-persists-run-url", /runId=run-artifact-visual-qa/.test(persistentTraceState.url) && /traceId=trace-artifact-visual-qa/.test(persistentTraceState.url), "URL conserva runId/traceId para reload e compartilhamento local.");

    const artifactScreenshot = path.join(options.outDir, "05-artifact-card.png");
    await page.screenshot({ path: artifactScreenshot, fullPage: true });
    report.screenshots.push(artifactScreenshot);

    return report;
  } finally {
    await page.evaluate(() => {
      const interval = (window as any).__zavorthChatVisualQaInterval;
      const observer = (window as any).__zavorthChatVisualQaObserver;
      if (interval) window.clearInterval(interval);
      observer?.disconnect?.();
    }).catch(() => undefined);
    await browser.close().catch(() => undefined);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

const options = readOptions();
runQa(options)
  .then((report) => {
    writeReport(report);
    console.log(JSON.stringify({
      ok: report.ok,
      url: report.url,
      checks: report.checks,
      screenshots: report.screenshots,
      metrics: report.metrics,
    }, null, 2));
    if (!report.ok && options.requirePass) {
      process.exitCode = 1;
    }
  })
  .catch((error) => {
    const report: QaReport = {
      ok: false,
      generatedAt: new Date().toISOString(),
      url: "not-started",
      outDir: options.outDir,
      screenshots: [],
      checks: [
        {
          id: "unexpected-error",
          status: "fail",
          detail: String(error?.stack || error?.message || error),
        },
      ],
      metrics: {},
    };
    writeReport(report);
    console.error(`[dashboard-chat-visual-qa] FAIL ${error?.message || error}`);
    if (options.requirePass) {
      process.exitCode = 1;
    }
  });
