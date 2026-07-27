#!/usr/bin/env node
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const staticDir = path.join(rootDir, "src", "zavorth-control", "public", "zavorth-control-vite-shell");
const appPublicDir = path.join(rootDir, "apps", "zavorth-control-vite-shell", "public");
const port = Number(process.env.ZAVORTH_CONTROL_CONSOLIDATED_E2E_PORT || 5196);

const state = {
  calls: {},
  projectPreviewApproved: false,
  diskPreviewApproved: false,
  externalProfiles: [],
  latestExternalReceipt: null,
};

function bump(key) {
  state.calls[key] = (state.calls[key] || 0) + 1;
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

function json(response, body, status = 200) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  });
  response.end(`${JSON.stringify(body)}\n`);
}

function readJsonBody(request) {
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

function a2uiSnapshot() {
  return {
    ok: true,
    data: {
      generatedAt: new Date().toISOString(),
      protocolVersion: "a2ui.v1",
      capabilities: ["snapshot", "action", "stream"],
      surfaceId: "consolidated",
      commands: {
        snapshot: "/api/v2/a2ui/snapshot",
        action: "/api/v2/a2ui/action",
        events: "/api/v2/a2ui/events",
        stream: "/api/v2/a2ui/stream",
      },
      surfaces: [{
        surfaceId: "consolidated",
        lastUpdated: new Date().toISOString(),
        metadata: { title: "Consolidated A2UI Surface" },
        dataModel: { phase: "e2e", approval: "gated" },
        components: [{
          type: "panel",
          id: "phase-panel",
          props: { title: "A2UI consolidated proof", description: "Renderer is live inside Z-Canvas." },
          children: [
            { type: "metric", id: "phase-count", props: { label: "Phases", value: "6", delta: "single harness" } },
            { type: "button", id: "approve-preview", props: { label: "Approve Preview", actionId: "approve-preview" } },
          ],
        }],
      }],
    },
  };
}

function runtimeAdapterSnapshot() {
  const profiles = state.externalProfiles;
  return {
    generatedAt: new Date().toISOString(),
    contractVersion: "zavorth-runtime-adapter-gateway/1",
    surface: "runtime-adapter-dashboard",
    registry: {
      generatedAt: new Date().toISOString(),
      contractVersion: "zavorth-runtime-adapter-gateway/1",
      surface: "runtime-adapter-gateway",
      status: profiles.length ? "ready" : "empty",
      registryFile: path.join(rootDir, ".tmp", "consolidated-runtime-adapter-profiles.json"),
      profiles,
      summary: {
        total: profiles.length,
        enabled: profiles.length,
        liveEnabled: profiles.filter((profile) => profile.liveExecutionEnabled).length,
        cli: profiles.filter((profile) => profile.adapter === "cli").length,
        http: profiles.filter((profile) => profile.adapter === "http").length,
        acp: profiles.filter((profile) => profile.adapter === "acp").length,
        mcp: profiles.filter((profile) => profile.adapter === "mcp").length,
        stronglyIsolated: profiles.filter((profile) => profile.isolation?.strongBoundary).length,
      },
      safety: {
        noAgentUsedDuringRegistryRead: true,
        noToolExposure: true,
        noCredentialSerialization: true,
        liveUseRequiresApproval: true,
        strongIsolationAvailable: true,
        localCliDeclaredNonSandboxed: true,
      },
    },
    latestReceipt: state.latestExternalReceipt,
    summary: {
      profiles: profiles.length,
      liveEnabled: profiles.filter((profile) => profile.liveExecutionEnabled).length,
      stronglyIsolated: profiles.filter((profile) => profile.isolation?.strongBoundary).length,
      latestReceiptStatus: state.latestExternalReceipt?.status || "none",
    },
    safety: {
      noAgentUsedDuringDashboardRead: true,
      liveUseRequiresApproval: true,
      localCliDeclaredNonSandboxed: true,
      rawSecretsSerialized: false,
    },
  };
}

function externalProfile(body) {
  const id = String(body.id || body.profileId || "e2e-agent").trim();
  return {
    id,
    label: String(body.label || id).trim(),
    adapter: String(body.adapter || "cli").trim() || "cli",
    status: "enabled",
    root: String(body.root || "").trim() || null,
    command: String(body.command || "node").trim() || null,
    args: Array.isArray(body.args) ? body.args : [],
    endpoint: String(body.endpoint || "").trim() || null,
    acp: { serverId: String(body.acpServerId || "").trim() || null, transport: null },
    promptMode: String(body.promptMode || "stdin").trim() || "stdin",
    allowedCapabilities: ["chat", "review"],
    liveExecutionEnabled: body.enableLive === true || body.liveExecutionEnabled === true,
    allowRemoteNetwork: false,
    isolation: {
      kind: String(body.isolation || "local-supervised").trim() || "local-supervised",
      required: body.requireStrongIsolation === true,
      strongBoundary: body.isolation === "docker" || body.isolation === "wsl",
      image: String(body.dockerImage || "").trim() || null,
      distro: String(body.wslDistro || "").trim() || null,
      workspaceMount: null,
      workingDirectory: null,
      network: "disabled",
      readOnlyRoot: true,
      notes: ["consolidated e2e profile"],
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    provenance: { source: "api", onboardingCandidateId: null },
    safety: {
      requiresApprovalPerInvocation: true,
      noDefaultRuntimeBinding: true,
      secretsPassedThroughEnv: false,
      toolExposureByDefault: false,
      strongIsolationAvailable: true,
      localCliIsNotOsSandbox: true,
    },
  };
}

function externalReceipt(kind, status, profile, outputText, invoked = false) {
  return {
    generatedAt: new Date().toISOString(),
    contractVersion: "zavorth-runtime-adapter-gateway/1",
    surface: "runtime-adapter-gateway",
    kind,
    status,
    profile,
    request: {
      requestedBy: "dashboard",
      promptHash: "e2e-hash",
      promptPreview: "consolidated prompt",
      approvalProvided: status !== "approval-required",
      dryRun: status === "approval-required",
    },
    execution: {
      adapterInvoked: invoked,
      adapter: profile?.adapter || null,
      command: profile?.command || null,
      args: profile?.args || [],
      cwd: profile?.root || null,
      endpoint: profile?.endpoint || null,
      exitCode: invoked ? 0 : null,
      durationMs: 8,
      timedOut: false,
      isolationKind: profile?.isolation?.kind || null,
      isolationStrongBoundary: Boolean(profile?.isolation?.strongBoundary),
      sandboxCommand: null,
      liveExecutionPerformed: invoked,
      liveNetworkPerformed: false,
    },
    output: { text: outputText, stdout: invoked ? outputText : null, stderr: null },
    nextAction: { label: invoked ? "Review runtime adapter output" : "Approve this invocation", command: null },
    safety: {
      approvalRequired: true,
      approvalBypassAllowed: false,
      noShellInterpolation: true,
      rawSecretsSerialized: false,
      profileOnlyNoDefaultBinding: true,
      filesystemSandboxClaimed: Boolean(profile?.isolation?.strongBoundary),
      localCliIsNotOsSandbox: true,
      strongIsolationRequiredForUntrustedCli: true,
    },
  };
}

async function handleApi(request, response, url) {
  const body = request.method === "POST" ? await readJsonBody(request) : {};
  if (url.pathname === "/api/auth/status") return json(response, { authenticated: true, webReady: true, gatewayReady: true });
  if (url.pathname === "/api/web/zavorthControl") return json(response, { ok: true, live: true, authRequired: false, snapshot: { runs: [], activeRun: null } });
  if (url.pathname === "/api/web/dashboard/events") return json(response, { ok: true, events: [] });
  if (url.pathname === "/api/providers/model-catalog") return json(response, { ok: true, providerModelCatalog: { routes: [], models: [] } });
  if (url.pathname === "/api/providers/activation") return json(response, { ok: true, providerActivation: { status: "ready" } });
  if (url.pathname === "/api/v2/sales-pack/snapshot") return json(response, { ok: true, snapshot: { summary: {} } });
  if (url.pathname === "/api/v2/sales-pack/channel-io/snapshot") return json(response, { ok: true, channelIo: { summary: {} } });
  if (url.pathname === "/api/web/catalog") return json(response, { ok: true, tools: [] });
  if (url.pathname === "/api/web/runtime/companions") return json(response, { ok: true, companions: [] });
  if (url.pathname === "/api/web/gateway/runtime") return json(response, { ok: true, gatewayRuntime: {} });
  if (url.pathname === "/api/web/execution-engines") return json(response, { ok: true, engines: [] });
  if (url.pathname === "/api/web/trusted-workspaces") return json(response, { ok: true, policies: [] });
  if (url.pathname === "/api/web/canvas/session") return json(response, { ok: true, session: { engineId: "local", activeAttemptId: "a1", attempts: [{ id: "a1", round: 1, status: "ready", summary: "A2UI active", logs: [], diffs: [] }], logs: [], diffs: [], egressEvents: [], previewUrl: null } });
  if (url.pathname === "/api/v2/a2ui/snapshot") {
    bump("a2ui.snapshot");
    return json(response, a2uiSnapshot());
  }
  if (url.pathname === "/api/v2/a2ui/stream") {
    bump("a2ui.stream");
    return json(response, { ok: true, data: { generatedAt: new Date().toISOString(), protocolVersion: "a2ui.v1", surfaceId: "consolidated", items: [{ id: "event-1", surfaceId: "consolidated", eventType: "ready", createdAt: new Date().toISOString() }] } });
  }
  if (url.pathname === "/api/v2/a2ui/action") {
    bump("a2ui.action");
    return json(response, { ok: true, status: "accepted", summary: `A2UI action ${body.actionId || "unknown"} accepted` });
  }
  if (url.pathname === "/api/web/project-constitution/import") {
    bump(`project.${request.method.toLowerCase()}`);
    if (request.method === "GET") return json(response, { ok: true, status: { surface: "project-constitution-import", candidates: ["CLAUDE.md", "AGENTS.md"] } });
    if (body.previewId && body.approvalPhrase) state.projectPreviewApproved = true;
    return json(response, { ok: true, [body.previewId ? "result" : "preview"]: { status: body.previewId ? "applied" : "preview_ready", previewId: "constitution-preview-e2e", sources: ["CLAUDE.md", "AGENTS.md"], receipt: { approved: Boolean(body.previewId) } } });
  }
  if (url.pathname === "/api/web/disk-mutation-gate") {
    bump(`disk.${request.method.toLowerCase()}`);
    if (request.method === "GET") return json(response, { ok: true, status: { surface: "disk-mutation-gate", pending: 0 } });
    if (body.previewId && body.approvalPhrase) state.diskPreviewApproved = true;
    return json(response, { ok: true, [body.previewId ? "result" : "preview"]: { status: body.previewId ? "applied" : "preview_ready", previewId: "disk-preview-e2e", operations: body.operations || [], receipt: { approved: Boolean(body.previewId) } } });
  }
  if (url.pathname.startsWith("/api/web/git/")) {
    const action = url.pathname.split("/").pop();
    bump(`git.${action}`);
    return json(response, { ok: true, snapshot: { status: "preview", branch: action === "branch" ? "feature/consolidated-e2e" : "main", dirtyFiles: 0, summary: `${action} workflow previewed`, receipt: { receiptId: `git-${action}-receipt` } } });
  }
  if (url.pathname === "/api/web/review") {
    bump("review");
    return json(response, { ok: true, snapshot: { status: "preview", target: "workspace-diff", summary: "Governed review completed", review: { reviewId: "review-e2e", findings: [] }, visual: { route: "/dashboard/reviews" } } });
  }
  if (url.pathname === "/api/web/acp-generic-channel-adapter") {
    bump(`acp.${request.method.toLowerCase()}`);
    if (request.method === "GET") return json(response, { ok: true, snapshot: { surface: "acp-generic-channel-adapter", adapter: { conceptualDependency: "zavorth-native" } } });
    return json(response, { ok: true, receipt: { surface: "acp-generic-channel-adapter", status: "approval_required", normalizedInboundMessage: { topic: "im_message" }, approvals: [{ title: "ACP tool request: Write" }] } }, 202);
  }
  if (url.pathname === "/api/web/zavorth-runtime-adapters") {
    bump("external.get");
    return json(response, { ok: true, snapshot: runtimeAdapterSnapshot() });
  }
  if (url.pathname === "/api/web/zavorth-runtime-adapters/register") {
    bump("external.register");
    const profile = externalProfile(body);
    state.externalProfiles = [profile];
    state.latestExternalReceipt = externalReceipt("profile-registration", "registered", profile, `runtime adapter profile ${profile.id} registered.`, false);
    return json(response, { ok: true, receipt: state.latestExternalReceipt, snapshot: runtimeAdapterSnapshot() });
  }
  if (url.pathname === "/api/web/zavorth-runtime-adapters/invoke") {
    bump("external.invoke");
    const profile = state.externalProfiles.find((entry) => entry.id === body.profileId) || state.externalProfiles[0] || externalProfile({ id: body.profileId });
    const approved = body.approvalGranted === true || body.approveExternalExecution === true;
    state.latestExternalReceipt = externalReceipt("agent-invocation", approved ? "completed" : "approval-required", profile, approved ? "zavorth-runtime-adapter-e2e-ok" : "Invocation plan ready.", approved);
    return json(response, { ok: true, receipt: state.latestExternalReceipt, snapshot: runtimeAdapterSnapshot() }, approved ? 200 : 202);
  }
  return json(response, { ok: true, route: url.pathname });
}

function createServer() {
  if (!fs.existsSync(path.join(staticDir, "index.html"))) {
    throw new Error(`Built ZavorthControl shell not found at ${staticDir}. Run npm run zavorth-control-vite:build first.`);
  }
  const server = http.createServer((request, response) => {
    const url = new URL(request.url || "/", `http://127.0.0.1:${port}`);
    if (url.pathname.startsWith("/api/")) {
      handleApi(request, response, url).catch((error) => json(response, { ok: false, error: error.message }, 500));
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

function addCheck(checks, id, passed, detail) {
  checks.push({ id, status: passed ? "pass" : "fail", detail });
}

async function clickNav(page, name) {
  await page.getByRole("link", { name }).click();
  await page.waitForTimeout(500);
}

async function main() {
  const checks = [];
  const server = await createServer();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  try {
    await page.goto(`http://127.0.0.1:${port}/...qa=consolidated-e2e`, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await page.waitForTimeout(1200);

    await clickNav(page, "Canvas");
    await page.getByText("Z-Canvas A2UI", { exact: false }).waitFor({ timeout: 10_000 });
    await page.getByRole("button", { name: "Approve Preview" }).click();
    await page.waitForTimeout(400);
    const canvasText = await page.locator("#sector-canvas").innerText();
    addCheck(checks, "a2ui-renderer-in-z-canvas", canvasText.includes("A2UI consolidated proof") && state.calls["a2ui.snapshot"] >= 1, canvasText.slice(0, 180));
    addCheck(checks, "a2ui-action-dispatches-to-api", state.calls["a2ui.action"] >= 1, JSON.stringify(state.calls));

    const routeResult = await page.evaluate(async () => {
      const headers = { "Content-Type": "application/json" };
      const constitutionPreview = await fetch("/api/web/project-constitution/import", {
        method: "POST",
        headers,
        body: JSON.stringify({ workspaceRoot: "C:/workspace", sourcePaths: ["CLAUDE.md", "AGENTS.md"] }),
      }).then((response) => response.json());
      const constitutionApply = await fetch("/api/web/project-constitution/import", {
        method: "POST",
        headers,
        body: JSON.stringify({ previewId: constitutionPreview.preview.previewId, approvalPhrase: "APPROVE", approvedBy: "dashboard" }),
      }).then((response) => response.json());
      const diskPreview = await fetch("/api/web/disk-mutation-gate", {
        method: "POST",
        headers,
        body: JSON.stringify({ operations: [{ kind: "write", path: "README.md", content: "preview" }], reason: "e2e" }),
      }).then((response) => response.json());
      const diskApply = await fetch("/api/web/disk-mutation-gate", {
        method: "POST",
        headers,
        body: JSON.stringify({ previewId: diskPreview.preview.previewId, approvalPhrase: "APPROVE", approvedBy: "dashboard" }),
      }).then((response) => response.json());
      const acp = await fetch("/api/web/acp-generic-channel-adapter", {
        method: "POST",
        headers,
        body: JSON.stringify({ kind: "tool_request", tool: { name: "Write" }, payload: { text: "edit" } }),
      }).then((response) => response.json());
      const bridge = window.ZavorthRuntimeBridge;
      const branch = await bridge.runDeveloperWorkflowCommand("branch", "feature/consolidated-e2e");
      const commit = await bridge.runDeveloperWorkflowCommand("commit", "consolidated e2e");
      const pr = await bridge.runDeveloperWorkflowCommand("pr", "open draft");
      const review = await bridge.runDeveloperWorkflowCommand("review", "workspace diff");
      return { constitutionPreview, constitutionApply, diskPreview, diskApply, acp, branch, commit, pr, review };
    });

    addCheck(checks, "constitution-import-preview-and-approval", routeResult.constitutionPreview.preview.status === "preview_ready" && routeResult.constitutionApply.result.status === "applied" && state.projectPreviewApproved, JSON.stringify(routeResult.constitutionApply));
    addCheck(checks, "disk-mutation-gate-preview-and-approval", routeResult.diskPreview.preview.status === "preview_ready" && routeResult.diskApply.result.status === "applied" && state.diskPreviewApproved, JSON.stringify(routeResult.diskApply));
    addCheck(checks, "git-review-commands-dispatch", ["git.branch", "git.commit", "git.pr", "review"].every((key) => state.calls[key] >= 1), JSON.stringify(routeResult.review));
    addCheck(checks, "acp-generic-adapter-normalizes-frame", routeResult.acp.receipt?.surface === "acp-generic-channel-adapter" && routeResult.acp.receipt?.status === "approval_required", JSON.stringify(routeResult.acp.receipt));

    await clickNav(page, "Agentes");
    await page.getByText("runtime adapter control.", { exact: true }).waitFor({ timeout: 10_000 });
    const agentsSection = page.locator("#sector-agents");
    await agentsSection.locator('[name="id"]').fill("e2e-agent");
    await agentsSection.locator('[name="label"]').fill("E2E Agent");
    await agentsSection.locator('[name="command"]').fill("node");
    await agentsSection.locator('[name="enableLive"]').check();
    await agentsSection.locator('[name="approveRegistration"]').check();
    await agentsSection.getByRole("button", { name: "Register profile" }).click();
    await page.waitForFunction(() => document.body.textContent?.includes("e2e-agent"), null, { timeout: 10_000 });
    await agentsSection.locator("[data-runtime-adapter-prompt]").fill("Run consolidated runtime adapter check");
    await agentsSection.locator("[data-runtime-adapter-approve-execution]").check();
    await agentsSection.locator(".runtime-adapter-actions [data-runtime-adapter-action=\"invoke\"]").click();
    await page.waitForFunction(() => document.body.textContent?.includes("zavorth-runtime-adapter-e2e-ok"), null, { timeout: 10_000 });
    const agentsText = await page.locator("#sector-agents").innerText();
    addCheck(checks, "zavorth-runtime-adapters-register-and-invoke", state.calls["external.register"] >= 1 && state.calls["external.invoke"] >= 1 && agentsText.includes("zavorth-runtime-adapter-e2e-ok"), agentsText.slice(0, 220));

    addCheck(checks, "browser-console-has-no-errors", consoleErrors.length === 0, consoleErrors.join("\n"));
    const failed = checks.filter((check) => check.status === "fail");
    const report = {
      ok: failed.length === 0,
      surface: "zavorthControl-consolidated-e2e",
      generatedAt: new Date().toISOString(),
      url: `http://127.0.0.1:${port}/...qa=consolidated-e2e`,
      calls: state.calls,
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
  console.error(`[zavorth-control-consolidated-e2e] FAIL ${error?.message || error}`);
  process.exit(1);
});
