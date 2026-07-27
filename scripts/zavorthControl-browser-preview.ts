#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildDashboardCommandCenterFixturePreviewViewModel as buildZavorthControlZavorthControlFixturePreviewViewModel,
  listDashboardCommandCenterFixturePreviewOptions as listZavorthControlZavorthControlFixturePreviewOptions,
  resolveDashboardCommandCenterFixturePreviewId as resolveZavorthControlZavorthControlFixturePreviewId,
} from "../src/zavorth-control/app/(dashboard)/control/command-center/preview/commandCenterFixturePreview";
import type { DashboardCommandCenterViewModel as ZavorthControlZavorthControlViewModel } from "../src/zavorth-control/app/(dashboard)/control/command-center/contracts";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultOutDir = path.join(rootDir, ".tmp", "zavorthControl-browser-preview");

type CliOptions = {
  fixture: string;
  outDir: string;
};

type BrowserPreviewFixturePayload = {
  option: ReturnType<typeof listZavorthControlZavorthControlFixturePreviewOptions>[number];
  viewModel: ZavorthControlZavorthControlViewModel;
};

function readCliOptions(): CliOptions {
  const args = process.argv.slice(2);
  const fixtureArg = args.find((arg) => arg.startsWith("--fixture="));
  const outArg = args.find((arg) => arg.startsWith("--out="));

  return {
    fixture: String(fixtureArg?.split("=").slice(1).join("=") || "safe-run").trim(),
    outDir: path.resolve(rootDir, String(outArg?.split("=").slice(1).join("=") || defaultOutDir).trim()),
  };
}

function escapeScriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

function buildPreviewHtml(defaultFixtureId: string): string {
  const css = fs.readFileSync(
    path.join(rootDir, "src/zavorth-control/app/(dashboard)/control/command-center/styles/commandCenter.css"),
    "utf8",
  );
  const options = listZavorthControlZavorthControlFixturePreviewOptions();
  const fixtures: Record<string, BrowserPreviewFixturePayload> = Object.fromEntries(
    options.map((option) => [
      option.id,
      {
        option,
        viewModel: buildZavorthControlZavorthControlFixturePreviewViewModel(option.id),
      },
    ]),
  ) as Record<string, BrowserPreviewFixturePayload>;

  return `<!doctype html>
<html lang="en-US">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Zavorth ZavorthControl Preview</title>
  <style>
    body { margin: 0; background: #060809; }
    button, select, textarea { font: inherit; }
    .bcc-browser-preview-hidden { display: none !important; }
    ${css}
  </style>
</head>
<body>
  <div id="zavorthControl-preview-root"></div>
  <script>
    const DEFAULT_FIXTURE_ID = ${escapeScriptJson(defaultFixtureId)};
    const FIXTURES = ${escapeScriptJson(fixtures)};
    const FIXTURE_IDS = Object.keys(FIXTURES);
    const LIVE_FIXTURE_ID = "live";
    const LIVE_OPTION = {
      id: LIVE_FIXTURE_ID,
      label: "Runtime ao vivo",
      description: "Snapshot real do Zavorth Agent Gateway servido pelo /zavorthControl."
    };
    const AUTH_STORAGE_KEY = "zavorth.zavorthControl.webToken";

    const readAuthTokenFromUrl = () => {
      const url = new URL(window.location.href);
      const token = String(url.searchParams.get("token") || "").trim();
      if (!token) return "";
      try {
        sessionStorage.setItem(AUTH_STORAGE_KEY, token);
        url.searchParams.delete("token");
        history.replaceState(null, "", url);
      } catch {}
      return token;
    };

    const readAuthToken = () => {
      const fromUrl = readAuthTokenFromUrl();
      if (fromUrl) return fromUrl;
      try {
        return String(sessionStorage.getItem(AUTH_STORAGE_KEY) || "").trim();
      } catch {
        return "";
      }
    };

    const writeAuthToken = (token) => {
      try {
        sessionStorage.setItem(AUTH_STORAGE_KEY, String(token || "").trim());
      } catch {}
    };

    const clearAuthToken = () => {
      try {
        sessionStorage.removeItem(AUTH_STORAGE_KEY);
      } catch {}
    };

    const buildAuthHeaders = () => {
      const token = readAuthToken();
      return token ? { "X-Zavorth-Token": token } : {};
    };

    const normalizeZavorthControlCopy = (value) => {
      let text = String(value - "");
      const replacements = [
        ["ready", "ready"],
        ["attention", "attention"],
        ["attention", "attention"],
        ["blocked", "blocked"],
        ["waiting approval", "waiting approval"],
        ["completed", "completed"],
        ["completed", "completed"],
        ["thinking", "thinking"],
        ["running", "running"],
        ["queued", "queued"],
        ["failed", "failed"],
        ["cancelled", "cancelled"],
        ["Pending approval", "Pending approval"],
        ["Pending approval", "Pending approval"],
        ["Pending approval", "Pending approval"],
        ["Sensitive action waiting for confirmation.", "Sensitive action waiting for confirmation."],
        ["Sensitive action waiting for confirmation.", "Sensitive action waiting for confirmation."],
        ["An approved job is waiting for a worker/executor.", "An approved job is waiting for a worker/executor."],
        ["Current run", "Current run"],
        ["Run received by the universal runtime.", "Run received by the universal runtime."],
        ["Run registered in the universal runtime.", "Run registered in the universal runtime."],
        ["Gateway has no active run.", "Gateway has no active run."],
        ["Gateway is unavailable in this process.", "Gateway is unavailable in this process."],
        ["Gateway is unavailable in this process.", "Gateway is unavailable in this process."],
        ["durable job(s) in the snapshot.", "durable job(s) in the snapshot."],
        ["Real universal runtime snapshot.", "Real universal runtime snapshot."],
        ["No real gateway is attached to this process.", "No real gateway is attached to this process."],
        ["Operator", "Operator"],
        ["Zavorth is ready in the universal runtime.", "Zavorth is ready in the universal runtime."],
        ["Zavorth needs attention before continuing.", "Zavorth needs attention before continuing."],
        ["ZavorthControl loaded, but the real gateway has not responded yet.", "ZavorthControl loaded, but the real gateway has not responded yet."],
        ["No active execution is exposing tools right now.", "No active execution is exposing tools right now."],
        ["No active execution is exposing tools right now.", "No active execution is exposing tools right now."],
        ["Budget is not attached to the live snapshot yet.", "Budget is not attached to the live snapshot yet."],
        ["Execution replay", "Execution replay"],
        ["Events from this execution can be reviewed.", "Events from this execution can be reviewed."],
        ["No real replay has been produced yet.", "No real replay has been produced yet."],
        ["Current response in the /zavorthControl web panel.", "Current response in the /zavorthControl web panel."],
        ["Universal runtime has no relevant blockers.", "Universal runtime has no relevant blockers."],
        ["Universal runtime needs attention.", "Universal runtime needs attention."],
        ["Release status is not attached to the live snapshot yet.", "Release status is not attached to the live snapshot yet."],
        ["Default live ZavorthControl identity.", "Default live ZavorthControl identity."],
        ["Conversation", "Conversation"],
        ["Sessions", "Sessions"],
        ["Sessions", "Sessions"],
        ["History", "History"],
        ["History", "History"],
        ["Tools", "Tools"],
        ["Config", "Config"],
        ["Config", "Config"],
        ["Session", "Session"],
        ["Session", "Session"],
        ["Request received", "Request received"],
        ["Run registered.", "Run registered."],
        ["Open doctor", "Open doctor"],
        ["View operational diagnostics.", "View operational diagnostics."],
        ? { label: "Review approval", description: "Sensitive action waiting for you." }
        ["View pending sensitive actions.", "View pending sensitive actions."],
        ["ZavorthControl ready", "ZavorthControl ready"],
        ["When you ask Zavorth to do something, the run appears here.", "When you ask Zavorth to do something, the run appears here."],
        ["Safe run", "Safe run"],
        ["A common execution, no approval, with a safe tool and final response.", "A common execution, no approval, with a safe tool and final response."],
        ["A common execution, no approval, with a safe tool and final response.", "A common execution, no approval, with a safe tool and final response."],
        ["Review the README and tell me the current state.", "Review the README and tell me the current state."],
        ["Review the README and summarize the current state", "Review the README and summarize the current state"],
        ["Summary prepared without touching sensitive tools.", "Summary prepared without touching sensitive tools."],
        ["Summary prepared without touching sensitive tools.", "Summary prepared without touching sensitive tools."],
        ["The README is aligned with the ZavorthControl entry point and the first-run journey.", "The README is aligned with the ZavorthControl entry point and the first-run journey."],
        ["The README is aligned with the ZavorthControl entry point and the first-run journey.", "The README is aligned with the ZavorthControl entry point and the first-run journey."],
        ["Final summary prepared from safe workspace reading.", "Final summary prepared from safe workspace reading."],
        ["The answer uses only the result of governed read-only access.", "The answer uses only the result of governed read-only access."],
        ["The answer uses only the result of governed read-only access.", "The answer uses only the result of governed read-only access."],
        ["I identified that the request is safe read-only work and does not need approval.", "I identified that the request is safe read-only work and does not need approval."],
        ["I identified that the request is safe read-only work and does not need approval.", "I identified that the request is safe read-only work and does not need approval."],
        ["Used the workspace-read profile to read context without mutation.", "Used the workspace-read profile to read context without mutation."],
        ["Used the workspace-read profile to read context without mutation.", "Used the workspace-read profile to read context without mutation."],
        ["Selected to read workspace context without mutation.", "Selected to read workspace context without mutation."],
        ["Selected to read workspace context without mutation.", "Selected to read workspace context without mutation."],
        ["README.md was read in read-only mode.", "README.md was read in read-only mode."],
        ["README.md read in read-only mode.", "README.md read in read-only mode."],
        ["Read allowed by the safe workspace profile.", "Read allowed by the safe workspace profile."],
        ["The read was recorded in the run timeline.", "The read was recorded in the run timeline."],
        ["Selected because the run needs to operate within the workspace scope.", "Selected because the run needs to operate within the workspace scope."],
        ["Low session usage.", "Low session usage."],
        ["Low session usage.", "Low session usage."],
        ["fix this error", "fix this error"],
        ["compare this folder", "compare this folder"],
        ["generate a report", "generate a report"],
        ["Real source", "Real source"],
        ["Contract preview", "Contract preview"],
        ["Visual scenario", "Visual scenario"],
        ["Protected access", "Protected access"],
        ["Unlock real runtime", "Unlock real runtime"],
        ["The cockpit is loaded. To show real runs, approvals and history, enter the local Zavorth token for this session.", "The cockpit is loaded. To show real runs, approvals and history, enter the local Zavorth token for this session."],
        ["Local Zavorth token", "Local Zavorth token"],
        ["The token stays only in this tab sessionStorage.", "The token stays only in this tab sessionStorage."],
        ["Unlock", "Unlock"],
        ["Protected runtime", "Protected runtime"],
        ["token required", "token required"],
        ["ZavorthControl opened, but real runtime data requires the local token for this installation.", "ZavorthControl opened, but real runtime data requires the local token for this installation."],
        ["provider pending", "provider pending"],
        ["open gateway", "open gateway"],
        ["Channel", "Channel"],
        ["open chat", "open chat"],
        ["session ready", "session ready"],
        ["not set", "not set"],
        ["review workspace", "review workspace"],
        ["exposed", "exposed"],
        ["waiting", "waiting"],
        ["view skills/tools", "view skills/tools"],
        ["done", "done"],
        ["ready to start", "ready to start"],
        ["open timeline", "open timeline"],
        ["prepare prompt", "prepare prompt"],
        ["First run", "First run"],
        ["ready", "ready"],
        ["Decision needed", "Decision needed"],
        ["Queue clear", "Queue clear"],
        ["Review before release", "Review before release"],
        ["No sensitive actions", "No sensitive actions"],
        ["Mutation, sensitive network and external impact stay blocked until your decision.", "Mutation, sensitive network and external impact stay blocked until your decision."],
        ["When something needs permission, it appears here with risk, scope and reason.", "When something needs permission, it appears here with risk, scope and reason."],
        ["Waiting for your decision", "Waiting for your decision"],
        ["Access", "Access"],
        ["Preview required", "Preview required"],
        ["Allow", "Allow"],
        ["Deny", "Deny"],
        ["No approvals waiting for you right now.", "No approvals waiting for you right now."],
        ["No approvals waiting for you right now.", "No approvals waiting for you right now."],
        ["No approvals waiting for you right now.", "No approvals waiting for you right now."],
        ["pending", "pending"],
        ["No live cockpit", "No live cockpit"],
        ["Provider Cockpit appears when the runtime publishes the live provider matrix.", "Provider Cockpit appears when the runtime publishes the live provider matrix."],
        ["Prepare cockpit", "Prepare cockpit"],
        ["No provider in the current matrix.", "No provider in the current matrix."],
        ["Live matrix:", "Live matrix:"],
        ["failed", "failed"],
        ["Safe render: no zavorthControl network calls.", "Safe render: no zavorthControl network calls."],
        ["Check render policy.", "Check render policy."],
        ? { label: "Review approval", description: "Sensitive action waiting for you." }
        ["Sensitive action waiting for you.", "Sensitive action waiting for you."],
        ["Resolve operational blocker.", "Resolve operational blocker."],
            ? { label: "Review artifact", description: "Artifact ready for review." }
        ["Artifact ready for review.", "Artifact ready for review."],
            : { label: "View status", description: "Runtime has no critical blocker." };
        ["Runtime has no critical blocker.", "Runtime has no critical blocker."],
        ["Current mission", "Current mission"],
        ["Current mission", "Current mission"],
        ["tools:", "tools:"],
        ["no blocker", "no blocker"],
        ["artifacts ready", "artifacts ready"],
        ["no artifact", "no artifact"],
        ["No recent runtime events.", "No recent runtime events."],
        ["No detailed check was returned.", "No detailed check was returned."],
        ["No tool exposed in this snapshot.", "No tool exposed in this snapshot."],
        ["No active run", "No active run"],
        ["clean", "clean"],
        ["none", "none"],
        ["no decision", "no decision"],
        ["no decision", "no decision"],
        ["Workspace read-only.", "Workspace read-only."],
        ["Read file", "Read file"],
        ["Run budget calculated", "Run budget calculated"],
        ["Stable local channel for development.", "Stable local channel for development."],
        ["Stable local channel for development.", "Stable local channel for development."],
        ["Gateway accepting ZavorthControl events.", "Gateway accepting ZavorthControl events."],
        ["No sensitive action waiting for confirmation.", "No sensitive action waiting for confirmation."],
        ["No sensitive action waiting for confirmation.", "No sensitive action waiting for confirmation."],
        ["Events and artifacts from this execution can be reviewed.", "Events and artifacts from this execution can be reviewed."],
        ["Events and artifacts from this execution can be reviewed.", "Events and artifacts from this execution can be reviewed."],
        ["Artifacts appear here when ready.", "Artifacts appear here when ready."],
        ["Timeline", "Timeline"],
        ["The automatic decision appears when the runtime chooses subagents.", "The automatic decision appears when the runtime chooses subagents."],
        ["Selected by policy.", "Selected by policy."],
        ["No role selected in this decision.", "No role selected in this decision."],
        ["Signals", "Signals"],
        ["triggers:", "triggers:"],
        ["risks:", "risks:"],
        ["no raw CoT", "no raw CoT"],
        ["mutation requires approval", "mutation requires approval"],
        ["Automatic decision recorded.", "Automatic decision recorded."],
        ["yes", "yes"],
        ["no", "no"],
        ["Next step:", "Next step:"],
        ["Track workers and receipts.", "Track workers and receipts."],
        ["Auto Subagents appears when the main loop delegates reading, research or review to governed workers.", "Auto Subagents appears when the main loop delegates reading, research or review to governed workers."],
        ["Notebook MCP approval waiting for apply.", "Notebook MCP approval waiting for apply."],
        ["Apply to MCP", "Apply to MCP"],
        ["In real /zavorthControl, this button calls the server-side proxy and does not expose tokens in the browser.", "In real /zavorthControl, this button calls the server-side proxy and does not expose tokens in the browser."],
        ["Capability selected by the runtime.", "Capability selected by the runtime."],
        ["Operational event recorded.", "Operational event recorded."],
        ["Approval waiting for you", "Approval waiting for you"],
        ["ZavorthControl activity", "ZavorthControl activity"],
        ["Safe trace", "Safe trace"],
        ["safe events", "safe events"],
        ["Hello,", "Hello,"],
        ["You", "You"],
        ["Message trace", "Message trace"],
        ["Loading Zavorth snapshot...", "Loading Zavorth snapshot..."],
        ["Connecting to live runtime", "Connecting to live runtime"],
        ["Live snapshot unavailable.", "Live snapshot unavailable."],
        ["Fixture fallback", "Fixture fallback"],
        ["Live snapshot failed; showing a safe fixture.", "Live snapshot failed; showing a safe fixture."],
        ["Live snapshot protected by the local gateway.", "Live snapshot protected by the local gateway."],
        ["Local preview of the official fixture.", "Local preview of the official fixture."],
        ["No active execution right now.", "No active execution right now."],
        ["No active execution right now.", "No active execution right now."],
        ["Ask Zavorth", "Ask Zavorth"],
        ["Ask Zavorth", "Ask Zavorth"],
        ["Send", "Send"],
        ["Panel", "Panel"],
        ["Channels", "Channels"],
        ["Nodes", "Nodes"],
        ["Agents", "Agents"],
        ["Network", "Network"],
        ["Dreams", "Dreams"],
        ["Usage", "Usage"],
        ["available", "available"],
        ["There are no artifacts in this session yet.", "There are no artifacts in this session yet."],
      ];
      for (const [from, to] of replacements) {
        text = text.split(from).join(to);
      }
      return text;
    };

    const escapeHtml = (value) => normalizeZavorthControlCopy(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");

    const normalizeVisibleZavorthControlCopy = (root) => {
      if (!root || !document.createTreeWalker) return;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      for (const node of nodes) {
        const normalized = normalizeZavorthControlCopy(node.nodeValue);
        if (normalized !== node.nodeValue) node.nodeValue = normalized;
      }
      root.querySelectorAll?.("input[placeholder], textarea[placeholder], [aria-label], [title]").forEach((element) => {
        for (const attr of ["placeholder", "aria-label", "title"]) {
          const value = element.getAttribute(attr);
          if (value) element.setAttribute(attr, normalizeZavorthControlCopy(value));
        }
      });
    };

    const toneForRuntime = (status) => {
      if (status === "ready") return "ok";
      if (status === "degraded") return "warn";
      if (status === "blocked" || status === "offline") return "danger";
      return "info";
    };

    const humanRuntimeStatus = (status) => ({
      ready: "ready",
      degraded: "attention",
      blocked: "bloqueado",
      offline: "offline",
    })[status] || status || "unknown";

    const humanAgentStatus = (status) => ({
      waiting_approval: "waiting approval",
      completed: "completed",
      thinking: "pensando",
      running: "rodando",
      queued: "na fila",
      failed: "falhou",
      cancelled: "cancelado",
      idle: "idle",
    })[status] || status || "idle";

    const badge = (label, tone = "info") => '<span class="bcc-badge" data-tone="' + tone + '">' + escapeHtml(label) + '</span>';

    const fox = () => '<div class="bcc-mascot" aria-label="Mascote Zavorth"><svg class="bcc-mascot__svg" viewBox="0 0 64 64" role="img" aria-hidden="true" focusable="false"><path class="bcc-mascot__ear" d="M14 24 9 7l18 10Z" /><path class="bcc-mascot__ear" d="m50 24 5-17-18 10Z" /><path class="bcc-mascot__face" d="M32 57c-13 0-23-10-23-23S19 11 32 11s23 10 23 23-10 23-23 23Z" /><path class="bcc-mascot__cheek" d="M15 38c5 12 14 16 17 16s12-4 17-16c-6 5-11 7-17 7s-11-2-17-7Z" /><path class="bcc-mascot__eye" d="M22 29c3-3 6-3 8 0" /><path class="bcc-mascot__eye" d="M42 29c-3-3-6-3-8 0" /><path class="bcc-mascot__snout" d="M27 38c2 4 8 4 10 0" /><circle class="bcc-mascot__nose" cx="32" cy="36" r="2.4" /></svg></div>';

    const metric = (label, value, detail, tone = "info") => '<article class="bcc-metric-card" data-tone="' + tone + '"><span class="bcc-metric-card__label">' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong><small>' + escapeHtml(detail) + '</small></article>';
    const stateCard = (label, value, detail, tone = "info") => '<article class="bcc-state-card" data-tone="' + tone + '"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong><small>' + escapeHtml(detail) + '</small></article>';

    const formatDate = (value) => {
      const date = new Date(String(value || ""));
      if (!Number.isFinite(date.getTime())) return value || "agora";
      return date.toLocaleString("en-US", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    };

    const mapRuntimeStatus = (run) => {
      if (!run) return "ready";
      if (run.status === "failed" || run.status === "cancelled") return "blocked";
      if (run.status === "waiting_approval" || run.status === "queued") return "degraded";
      return "ready";
    };

    const mapEventKind = (kind) => {
      if (kind === "planning") return "thinking";
      if (kind === "memory" || kind === "input" || kind === "reply" || kind === "status") return "status";
      return kind || "status";
    };

    const mapLiveEvent = (event) => ({
      id: event.id,
      kind: mapEventKind(event.kind),
      title: event.title || "Evento do runtime",
      detail: event.detail || event.kind || "",
      status: event.status || "done"
    });

    const mapLiveApproval = (approval) => ({
      id: approval.id,
      runId: approval.runId,
      title: approval.title || "Approval pending",
      reason: approval.reason || "Sensitive action waiting for confirmation.",
      risk: approval.risk || "attention",
      status: approval.status === "approved" ? "approved" : approval.status === "rejected" ? "rejected" : "pending",
      command: "approve " + approval.id,
      createdAt: formatDate(approval.createdAt)
    });

    const mapLiveArtifact = (artifact) => ({
      id: artifact.id,
      title: artifact.title || "Artifact",
      kind: artifact.kind || "file",
      createdAt: formatDate(artifact.createdAt),
      sessionId: artifact.sessionId,
      status: artifact.status || "ready"
    });

    const mapLiveTool = (tool) => ({
      id: tool.id,
      label: tool.label || tool.id,
      capabilityId: tool.capabilityId,
      risk: tool.risk || "unknown",
      requiresApproval: Boolean(tool.requiresApproval),
      description: tool.description || ""
    });

    const buildLiveViewModelFromSnapshot = (snapshot, live) => {
      const generatedAt = snapshot?.generatedAt || new Date().toISOString();
      const run = snapshot?.activeRun || null;
      const runs = Array.isArray(snapshot?.runs) ? snapshot.runs : [];
      const jobs = Array.isArray(snapshot?.workflowJobs) ? snapshot.workflowJobs : [];
      const runtimeStatus = live ? mapRuntimeStatus(run) : "degraded";
      const modelProfile = run?.modelProfile || {};
      const providerLabel = modelProfile.providerLabel || "provider not provided";
      const modelLabel = modelProfile.modelLabel || "model not provided";
      const events = Array.isArray(run?.events) ? run.events.map(mapLiveEvent) : [];
      const approvals = Array.isArray(run?.approvals) ? run.approvals.map(mapLiveApproval) : [];
      const artifacts = Array.isArray(run?.artifacts) ? run.artifacts.map(mapLiveArtifact) : [];
      const tools = Array.isArray(run?.toolExposure?.tools) ? run.toolExposure.tools.map(mapLiveTool) : [];
      const workflowWarnings = jobs.some((job) => job.status === "queued")
        ? [{ id: "workflow-queue", title: "Workflow queue", detail: "Approved job waiting for worker/executor.", severity: "warning", actionId: "runtime.status" }]
        : [];
      const blockers = [
        ...approvals.filter((approval) => approval.status === "pending").map((approval) => ({
          id: approval.id,
          title: "Approval pending",
          detail: approval.reason,
          severity: "warning",
          actionId: "approvals.open"
        })),
        ...workflowWarnings
      ];
      const agentRun = run ? {
        id: run.id,
        title: run.title || "Run atual",
        status: run.status || "idle",
        sessionId: run.sessionId,
        startedAt: formatDate(run.createdAt),
        updatedAt: formatDate(run.updatedAt),
        summary: run.summary || "Run recebida pelo runtime universal.",
        providerLabel,
        modelLabel,
        events
      } : null;
      const healthChecks = [
        {
          id: "agent-gateway",
          label: "Zavorth Agent Gateway",
          status: runtimeStatus,
          detail: live ? (run ? "Active run: " + run.status + "." : "Gateway has no active run.") : "Gateway unavailable in this process.",
          actionId: runtimeStatus === "ready" ? undefined : "runtime.doctor"
        }
      ];
      if (jobs.length > 0) {
        healthChecks.push({
          id: "workflow-queue",
          label: "Workflow queue",
          status: jobs.some((job) => job.status === "failed") ? "blocked" : "degraded",
          detail: jobs.length + " job(s) duravel(is) no snapshot.",
          actionId: "runtime.status"
        });
      }

      return {
        contractVersion: "zavorthControl-runtime-contract/v1",
        generatedAt,
        adapterSource: {
          kind: "universal-agent-runtime",
          label: live ? "Zavorth Agent Gateway" : "ZavorthControl live fallback",
          version: "live-browser-adapter/v1",
          notes: live ? "Snapshot real do runtime universal." : "Sem gateway real acoplado a este processo."
        },
        runtime: {
          status: runtimeStatus,
          operatorLabel: "Operador",
          currentModelLabel: modelLabel,
          currentProviderLabel: providerLabel,
          activeSessionId: run?.sessionId,
          summary: live
            ? (runtimeStatus === "ready" ? "Zavorth ready no runtime universal." : "Zavorth precisa de atencao antes de continuar.")
            : "ZavorthControl loaded, but the real gateway has not responded yet.",
          blockers,
          wsStatus: "connected"
        },
        agentRun,
        tasks: runs.map((item) => ({
          id: item.id,
          title: item.title || "Run do runtime",
          status: item.status || "idle",
          summary: item.summary || "Run registrada no runtime universal.",
          runId: item.id,
          sessionId: item.sessionId,
          currentStep: item.status,
          updatedAt: formatDate(item.updatedAt)
        })),
        approvals,
        toolExposure: {
          mode: run?.toolExposure?.mode || "unknown",
          summary: run?.toolExposure?.summary || "No active execution is exposing tools right now.",
          tools
        },
        budget: { status: "unknown", summary: "Budget is not connected to the live snapshot yet." },
        replay: {
          id: run ? run.id + ":replay" : "live-replay",
          runId: run?.id,
          title: "Execution replay",
          status: events.length > 0 || artifacts.length > 0 ? "available" : "none",
          summary: events.length > 0 || artifacts.length > 0 ? "Events from this execution can be revisited." : "No real replay has been produced yet.",
          eventCount: events.length,
          artifactCount: artifacts.length,
          updatedAt: formatDate(run?.updatedAt || generatedAt)
        },
        replyPorts: Array.isArray(run?.replyPorts) ? run.replyPorts : [{ id: "zavorthControl", label: "ZavorthControl", kind: "web", status: "available", primary: true, description: "Current response in the /zavorthControl web panel." }],
        modelProfile: {
          providerLabel,
          modelLabel,
          routingPolicy: modelProfile.routingPolicy || "unknown",
          fallbackModelLabel: modelProfile.fallbackModelLabel,
          supportsTools: modelProfile.supportsTools,
          supportsVision: modelProfile.supportsVision,
          supportsStreaming: modelProfile.supportsStreaming
        },
        health: {
          status: runtimeStatus,
          summary: runtimeStatus === "ready" ? "Universal runtime has no relevant blockers." : "Universal runtime needs attention.",
          checks: healthChecks
        },
        releaseStatus: { status: "unknown", channel: "dev", summary: "Release status is not connected to the live snapshot yet.", rollbackAvailable: false },
        integrations: [{ id: "agent-gateway", label: "Zavorth Agent Gateway", category: "runtime", status: live ? "connected" : "degraded", detail: snapshot?.source?.label || "runtime" }],
        identity: { agentName: "Zavorth", userName: "Operador", language: "en-US", tone: "operacional", initiative: "balanced", firstRunStatus: "unknown", summary: "Identidade padrao do ZavorthControl ao vivo." },
        logs: events.map((event) => ({ id: event.id + ":log", level: event.status === "failed" ? "error" : "info", source: "agent." + event.kind, message: event.detail || event.title, createdAt: generatedAt, runId: run?.id })),
        sectors: [
          { id: "terminal", label: "Terminal", title: "Conversa", enabled: true },
          { id: "overview", label: "Overview", title: "Cockpit", enabled: true, badgeCount: blockers.length || undefined },
          { id: "sessions", label: "Sessions", title: "History", enabled: true, badgeCount: runs.length || undefined },
          { id: "skills", label: "Skills", title: "Tools", enabled: true, badgeCount: tools.length || undefined },
          { id: "nodes", label: "Nodes", title: "Node mesh", enabled: true },
          { id: "config", label: "Config", title: "Configuraction", enabled: true }
        ],
        sessions: runs.map((item) => ({ id: item.sessionId || item.id, title: item.title || "Sessao", updatedAt: formatDate(item.updatedAt), status: item.id === run?.id ? "active" : "idle", channelLabel: item.channel, messageCount: 2 })),
        messages: run ? [
          { id: run.id + ":input", role: "user", text: run.input || run.title || "Pedido recebido", createdAt: formatDate(run.createdAt), modelLabel },
          { id: run.id + ":summary", role: "assistant", text: run.summary || "Run registrada.", createdAt: formatDate(run.updatedAt), modelLabel, events }
        ] : [],
        events,
        artifacts,
        memorySignals: Array.isArray(run?.memorySignals) ? run.memorySignals : [],
        actions: [
          { id: "runtime.doctor", label: "Open doctor", description: "Ver diagnostico operacional.", group: "runtime" },
        ? { label: "Review approval", description: "Sensitive action waiting for you." }
        ],
        counts: {
          tasks: runs.length,
          sessions: runs.length,
          approvals: approvals.length,
          artifacts: artifacts.length,
          capabilities: tools.length,
          integrations: 1,
          nodes: 0,
          blockers: blockers.length,
          logs: events.length
        },
        emptyState: {
          title: "ZavorthControl ready",
          subtitle: "When you ask Zavorth for something, the run appears here.",
          suggestions: ["fix this error", "compare this folder", "generate a report"]
        }
      };
    };

    const fetchLiveViewModel = async () => {
      const response = await fetch("/api/web/zavorthControl", {
        headers: {
          Accept: "application/json",
          ...buildAuthHeaders()
        }
      });
      if (!response.ok) throw new Error("Live snapshot unavailable: HTTP " + response.status);
      const payload = await response.json();
      const vm = buildLiveViewModelFromSnapshot(payload.snapshot, Boolean(payload.live));
      vm.authRequired = Boolean(payload.authRequired);
      return vm;
    };

    const renderFixturePreviewBar = (activeId, option) => {
      const liveOptionHtml = '<option value="' + LIVE_FIXTURE_ID + '"' + (activeId === LIVE_FIXTURE_ID ? " selected" : "") + '>' + escapeHtml(LIVE_OPTION.label) + '</option>';
      const optionHtml = liveOptionHtml + FIXTURE_IDS.map((id) => '<option value="' + id + '"' + (id === activeId ? " selected" : "") + '>' + escapeHtml(FIXTURES[id].option.label) + '</option>').join("");
      const label = activeId === LIVE_FIXTURE_ID ? "Fonte real" : "Preview de contrato";
      return '<section class="bcc-fixture-preview" data-active="true" aria-label="Preview de contrato do ZavorthControl"><div><span class="bcc-fixture-preview__label">' + escapeHtml(label) + '</span><strong>' + escapeHtml(option.label) + '</strong><p>' + escapeHtml(option.description) + '</p></div><label class="bcc-fixture-preview__select"><span>Cenario visual</span><select id="fixture-select">' + optionHtml + '</select></label></section>';
    };

    const renderAuthUnlock = (vm) => {
      if (!vm.authRequired) return "";
      return '<section class="bcc-fixture-preview" data-active="true" aria-label="Unlock live ZavorthControl"><div><span class="bcc-fixture-preview__label">Protected access</span><strong>Unlock real runtime</strong><p>The cockpit is already loaded. To show real runs, approvals, and history, enter the local Zavorth token for this session.</p></div><form id="zavorthControl-auth-form" class="bcc-compose__input-frame" autocomplete="off"><input id="zavorthControl-auth-token" type="password" inputmode="text" autocomplete="current-password" placeholder="Local Zavorth token" style="width:100%;box-sizing:border-box;background:transparent;border:0;color:#edf8f6;outline:0;padding:12px 4px;font:inherit" /><div class="bcc-compose__footer"><span id="zavorthControl-auth-message" class="bcc-empty-note">The token stays only in this tab sessionStorage.</span><button class="bcc-button bcc-compose__send" data-variant="primary" type="submit">Unlock</button></div></form></section>';
    };

    const renderOnboardingPanel = (vm) => {
      if (vm.authRequired) {
        return '<section class="bcc-card"><p class="bcc-card__label">Access</p><h2 class="bcc-card__title">Protected runtime</h2><div class="bcc-card__body"><div class="bcc-access-card" data-state="protected"><div class="bcc-access-card__header">' + badge("token required", "warn") + '<span>Local-first</span></div><p class="bcc-access-card__copy">ZavorthControl opened, but real runtime data requires the local token for this installation.</p><div class="bcc-access-commands"><code>zavorth zavorthControl</code><code>zavorth zavorthControl repair</code><code>zavorth zavorthControl token</code></div><p class="bcc-access-card__feedback">The token stays only in this tab sessionStorage.</p></div></div></section>';
      }
      const workspaceReady = Boolean(vm.runtime.activeSessionId || vm.sessions.length);
      const toolsReady = vm.toolExposure.tools.length > 0 || vm.counts.capabilities > 0;
      const firstRunDone = Boolean(vm.agentRun || vm.messages.length || vm.counts.tasks > 0);
      const steps = [
        { label: "Provider", value: vm.modelProfile.modelLabel || vm.runtime.currentModelLabel || "provider pending", ready: vm.modelProfile.ready !== false, action: "abrir gateway" },
        { label: "Canal", value: "Web Chat", ready: true, action: "abrir chat" },
        { label: "Workspace", value: workspaceReady ? (vm.runtime.activeSessionId || "session ready") : "not set", ready: workspaceReady, action: "review workspace" },
        { label: "Safe tools", value: toolsReady ? String(vm.toolExposure.tools.length || vm.counts.capabilities) + " exposed" : "waiting", ready: toolsReady, action: "view skills/tools" },
        { label: "First run", value: firstRunDone ? "feito" : "ready para comecar", ready: firstRunDone, action: firstRunDone ? "abrir timeline" : "preparar prompt" }
      ];
      const readyCount = steps.filter((step) => step.ready).length;
      const rows = steps.map((step) => '<button type="button" class="bcc-onboarding-step" data-state="' + (step.ready ? "ready" : "pending") + '"><span class="bcc-onboarding-step__label">' + escapeHtml(step.label) + '</span><strong>' + escapeHtml(step.value) + '</strong><small>' + escapeHtml(step.action) + '</small></button>').join("");
      return '<section class="bcc-card"><p class="bcc-card__label">Primeiro uso</p><h2 class="bcc-card__title">' + escapeHtml(readyCount + "/" + steps.length + " readys") + '</h2><div class="bcc-card__body"><div class="bcc-onboarding-panel">' + rows + '</div></div></section>';
    };

    const renderApprovalsPanel = (vm) => {
      const approvals = vm.approvals || [];
      const highestRisk = approvals.some((approval) => approval.risk === "danger")
        ? "danger"
        : approvals.some((approval) => approval.risk === "attention")
          ? "attention"
          : "safe";
      const summary = '<div class="bcc-approval-summary" data-risk="' + escapeHtml(highestRisk) + '"><span>' + (approvals.length > 0 ? "Decision required" : "Queue clear") + '</span><strong>' + (approvals.length > 0 ? "Review before allowing" : "No sensitive actions") + '</strong><small>' + (approvals.length > 0 ? "Mutation, sensitive network and external impact remain blocked until your decision." : "When something needs permission, it appears here with risk, scope and reason.") + '</small></div>';
      const rows = approvals.slice(0, 4).map((approval) => '<div class="bcc-list-item bcc-approval-row" data-risk="' + escapeHtml(approval.risk || "attention") + '"><div class="bcc-approval-row__state"><span>Waiting for your decision</span><span>' + escapeHtml(approval.createdAt || "") + '</span></div><div class="bcc-approval-row__panel"><div class="bcc-approval-row__request"><span>Access</span><strong>' + escapeHtml(approval.title || "approval") + '</strong><em>' + escapeHtml(approval.risk || "attention") + '</em></div><span class="bcc-list-item__title">' + escapeHtml(approval.title || "Approval pending") + '</span><span class="bcc-list-item__meta">' + escapeHtml(approval.reason || "Review before allowing.") + '</span><div class="bcc-approval-capability"><span>runtime</span><span>guarded</span><span>Preview required</span><span>scope: ' + escapeHtml(approval.scope || "session") + '</span></div></div><div class="bcc-action-row"><button class="bcc-button" data-variant="primary" type="button">Allow</button><button class="bcc-button" type="button">Deny</button></div></div>').join("") || '<p class="bcc-empty-note">No approvals waiting for you right now.</p>';
      return '<section class="bcc-card"><p class="bcc-card__label">Approvals</p><h2 class="bcc-card__title">' + escapeHtml(approvals.length + " pending" + (approvals.length === 1 ? "" : "s")) + '</h2><div class="bcc-card__body">' + summary + '<div class="bcc-list">' + rows + '</div></div></section>';
    };

    const renderProviderCockpitPanel = (vm) => {
      const cockpit = vm.providerCockpit || null;
      if (!cockpit) {
        return '<section class="bcc-card" data-zavorth-provider-cockpit="empty"><p class="bcc-card__label">Providers</p><h2 class="bcc-card__title">Sem cockpit live</h2><div class="bcc-card__body"><p class="bcc-empty-note">Provider Cockpit aparece quando o runtime publica a matriz live de providers.</p><div class="bcc-action-row"><button class="bcc-button" type="button">Prepare cockpit</button></div></div></section>';
      }
      const cards = (cockpit.cards || []).slice(0, 4).map((card) => {
        const evidenceBits = [
          card.status || "unknown",
          "live " + (card.liveStatus || "not_run"),
          card.evidence?.modelCount !== null && card.evidence?.modelCount !== undefined ? card.evidence.modelCount + " modelos" : "",
          card.evidence?.durationMs !== null && card.evidence?.durationMs !== undefined ? card.evidence.durationMs + "ms" : "",
        ].filter(Boolean).join(" / ");
        return '<div class="bcc-list-item" data-zavorth-provider-id="' + escapeHtml(card.providerId || "") + '"><span class="bcc-list-item__title">' + escapeHtml(card.title || "Provider") + (card.model ? " - " + escapeHtml(card.model) : "") + '</span><span class="bcc-list-item__meta">' + escapeHtml(evidenceBits) + '</span></div>';
      }).join("") || '<p class="bcc-empty-note">Nenhum provider na matriz atual.</p>';
      const statusTone = cockpit.status === "ready" ? "ok" : cockpit.status === "blocked" ? "danger" : "warn";
      const commands = [
        cockpit.actions?.find((action) => action.kind === "read")?.command || "zavorth providers cockpit",
        (cockpit.cards || []).flatMap((card) => card.actions || []).find((action) => action.kind === "live_probe")?.command || "zavorth providers live --provider <id>",
      ];
      return '<section class="bcc-card" data-zavorth-provider-cockpit="ready"><p class="bcc-card__label">Providers</p><h2 class="bcc-card__title">' + escapeHtml(cockpit.summary.readyProviders + "/" + cockpit.summary.totalProviders + " readys") + '</h2><div class="bcc-card__body"><div class="bcc-list"><div class="bcc-list-item"><span class="bcc-list-item__title">Matriz live: ' + escapeHtml(cockpit.summary.livePassed) + ' ok / ' + escapeHtml(cockpit.summary.liveFailed) + ' falha / ' + escapeHtml(cockpit.summary.liveBlocked) + ' bloqueado</span><span class="bcc-list-item__meta">' + escapeHtml(cockpit.safety?.normalRenderMakesNoNetworkCalls ? "Render seguro: sem chamadas de rede no zavorthControl." : "Verifique policy de render.") + '</span></div>' + cards + '</div><div class="bcc-run-card__meta">' + badge(cockpit.status, statusTone) + badge("auth " + cockpit.summary.missingAuth, cockpit.summary.missingAuth > 0 ? "warn" : "ok") + badge(cockpit.executionAuthority ? "execution" : "projection-only", cockpit.executionAuthority ? "danger" : "ok") + '</div><div class="bcc-action-row"><button class="bcc-button" type="button">' + escapeHtml(commands[0]) + '</button><button class="bcc-button" type="button">' + escapeHtml(commands[1]) + '</button></div></div></section>';
    };

    const injectPreviewOnboardingAndApprovals = (vm) => {
      const panels = document.querySelectorAll(".bcc-control-grid > .bcc-side-panel");
      panels[0]?.insertAdjacentHTML("afterbegin", renderOnboardingPanel(vm));
      panels[1]?.insertAdjacentHTML("afterbegin", renderApprovalsPanel(vm));
    };

    const renderMissionBrief = (vm) => {
      const run = vm.agentRun;
      const action = vm.approvals.length > 0
        ? { label: "Review approval", description: "Sensitive action waiting for you." }
        : vm.runtime.blockers.length > 0
          ? { label: "Open doctor", description: "Resolve operational blocker." }
          : vm.artifacts.length > 0
            ? { label: "Review artifact", description: "Artifact ready for review." }
            : { label: "View status", description: "Runtime has no critical blocker." };

      return '<section class="bcc-mission-brief" data-status="' + escapeHtml(vm.runtime.status) + '"><div class="bcc-mission-brief__primary"><span class="bcc-card__label">Current mission</span><h1>' + escapeHtml(run?.title || "ZavorthControl ready") + '</h1><p>' + escapeHtml(run?.summary || vm.runtime.summary) + '</p><div class="bcc-mission-brief__badges">' + badge(humanRuntimeStatus(vm.runtime.status), toneForRuntime(vm.runtime.status)) + badge(vm.modelProfile.modelLabel) + badge("tools: " + vm.toolExposure.mode, vm.toolExposure.mode === "restricted" ? "warn" : "info") + '</div></div><div class="bcc-mission-brief__metrics">' + metric("Run", run ? humanAgentStatus(run.status) : "idle", run?.updatedAt || vm.generatedAt, run?.status === "failed" ? "danger" : run?.status === "waiting_approval" ? "warn" : "ok") + metric("Approvals", String(vm.counts.approvals), vm.counts.approvals > 0 ? "waiting for you" : "no blocker", vm.counts.approvals > 0 ? "warn" : "ok") + metric("Artifacts", String(vm.counts.artifacts), vm.counts.artifacts > 0 ? "ready deliverables" : "no artifact", vm.counts.artifacts > 0 ? "info" : "ok") + metric("Health", humanRuntimeStatus(vm.health.status), vm.health.summary, toneForRuntime(vm.health.status)) + '</div><button class="bcc-mission-brief__action" type="button"><span>' + escapeHtml(action.label) + '</span><small>' + escapeHtml(action.description) + '</small></button></section>';
    };

    let renderOverview = (vm) => {
      const run = vm.agentRun;
      const timeline = ((run?.events?.length ? run.events : vm.events) || []).slice(0, 6)
        .map((event) => '<div class="bcc-run-timeline__item" data-status="' + escapeHtml(event.status || "done") + '"><span>' + escapeHtml(event.title) + '</span><small>' + escapeHtml(event.detail || event.kind) + '</small></div>')
        .join("") || '<p class="bcc-empty-note">Sem eventos recentes no runtime.</p>';
      const health = vm.health.checks.slice(0, 5)
        .map((check) => '<div class="bcc-health-row" data-status="' + escapeHtml(check.status) + '"><span>' + escapeHtml(check.label) + '</span><small>' + escapeHtml(check.detail || humanRuntimeStatus(check.status)) + '</small></div>')
        .join("") || '<p class="bcc-empty-note">Nenhum check detalhado foi retornado.</p>';
      const tools = vm.toolExposure.tools.slice(0, 5)
        .map((tool) => '<span class="bcc-tool-chip" data-risk="' + escapeHtml(tool.risk) + '">' + escapeHtml(tool.label) + (tool.requiresApproval ? " - approval" : "") + '</span>')
        .join("") || '<p class="bcc-empty-note">Nenhuma ferramenta exposta neste snapshot.</p>';

      return '<div class="bcc-overview-stack"><section class="bcc-overview-hero" data-status="' + escapeHtml(vm.runtime.status) + '"><div><span class="bcc-card__label">Cockpit</span><h2>' + escapeHtml(run?.title || "No active run") + '</h2><p>' + escapeHtml(run?.summary || vm.runtime.summary) + '</p></div><div class="bcc-overview-hero__rail">' + badge(humanRuntimeStatus(vm.runtime.status), toneForRuntime(vm.runtime.status)) + badge(vm.adapterSource.label) + '</div></section><div class="bcc-state-grid">' + stateCard("Approval", vm.counts.approvals > 0 ? vm.counts.approvals + " pending" : "clear", vm.approvals[0]?.reason || "No sensitive action waiting for confirmation.", vm.counts.approvals > 0 ? "warn" : "ok") + stateCard("Artifact", vm.counts.artifacts > 0 ? vm.counts.artifacts + " ready" : "none", vm.artifacts[0]?.title || "Deliverables appear here when ready.", vm.counts.artifacts > 0 ? "info" : "ok") + stateCard("Budget", vm.budget.status, vm.budget.summary, vm.budget.status === "exceeded" ? "danger" : vm.budget.status === "attention" ? "warn" : "ok") + stateCard("Replay", vm.replay.status, vm.replay.summary, vm.replay.status === "available" ? "info" : "ok") + '</div><div class="bcc-overview-columns"><section class="bcc-card"><p class="bcc-card__label">Timeline</p><h2 class="bcc-card__title">' + escapeHtml(run ? humanAgentStatus(run.status) : "Idle") + '</h2><div class="bcc-card__body"><div class="bcc-run-timeline">' + timeline + '</div></div></section><section class="bcc-card"><p class="bcc-card__label">Doctor</p><h2 class="bcc-card__title">' + escapeHtml(humanRuntimeStatus(vm.health.status)) + '</h2><div class="bcc-card__body"><div class="bcc-health-list">' + health + '</div></div></section><section class="bcc-card"><p class="bcc-card__label">Tools</p><h2 class="bcc-card__title">' + escapeHtml(vm.toolExposure.summary) + '</h2><div class="bcc-card__body"><div class="bcc-tool-chip-grid">' + tools + '</div></div></section><section class="bcc-card"><p class="bcc-card__label">Release</p><h2 class="bcc-card__title">' + escapeHtml(vm.releaseStatus.version || vm.releaseStatus.channel) + '</h2><div class="bcc-card__body"><p>' + escapeHtml(vm.releaseStatus.summary) + '</p></div></section></div></div>';
    };

    const renderOverviewBase = renderOverview;
    renderOverview = (vm) => {
      const html = renderOverviewBase(vm);
      const auto = vm.subagentAutoInvocation || null;
      const autoStatus = auto?.status === "auto-selected"
        ? "auto selecionado"
        : auto?.status === "approval-required"
          ? "aguarda approval"
          : auto?.status === "skipped"
            ? "ignorado"
            : "no decision";
      const autoTone = auto?.status === "approval-required" ? "warn" : auto?.status === "auto-selected" ? "info" : "ok";
      const autoState = stateCard(
        "Auto Subagents",
        autoStatus,
        auto
          ? String(auto.selectedBy || "runtime") + " - " + String((auto.roles || []).length) + " role(s) - " + String(Math.round(Number(auto.confidence || 0) * 100)) + "%"
          : "The automatic decision appears when the runtime chooses subagents.",
        autoTone,
      );
      const autoRoles = (auto?.roles || []).slice(0, 4)
        .map((role) => '<div class="bcc-list-item"><span class="bcc-list-item__title">' + escapeHtml(role.roleId || "role") + ': ' + escapeHtml(role.label || "Subagent") + '</span><span class="bcc-list-item__meta">' + escapeHtml(role.whySelected || "Selecionado pela policy.") + '</span></div>')
        .join("") || '<p class="bcc-empty-note">No role selected in this decision.</p>';
      const autoSignals = auto
        ? '<div class="bcc-list-item"><span class="bcc-list-item__title">Sinais</span><span class="bcc-list-item__meta">gatilhos: ' + escapeHtml((auto.triggers || []).slice(0, 3).join(", ") || "n/d") + ' - riscos: ' + escapeHtml((auto.riskSignals || []).slice(0, 3).join(", ") || "none") + '</span></div>'
        : "";
      const autoPolicy = auto
        ? '<div class="bcc-list-item"><span class="bcc-list-item__title">Policy</span><span class="bcc-list-item__meta">read-only: ' + escapeHtml(String(auto.safety?.readOnlyOnly !== false)) + ' - no raw CoT: ' + escapeHtml(String(auto.safety?.noRawChainOfThought !== false)) + ' - mutation requires approval: ' + escapeHtml(String(auto.safety?.approvalsRequiredForMutation !== false)) + '</span></div>'
        : "";
      const autoCard = '<section class="bcc-card"><p class="bcc-card__label">Auto Subagents</p><h2 class="bcc-card__title">' + escapeHtml(autoStatus) + '</h2><div class="bcc-card__body">' + (auto ? '<div class="bcc-list"><div class="bcc-list-item" data-active="' + (auto.status === "auto-selected" ? "true" : "false") + '"><span class="bcc-list-item__title">' + escapeHtml(auto.selectedBy || "runtime") + ' / ' + escapeHtml(auto.mode || "unknown") + '</span><span class="bcc-list-item__meta">' + escapeHtml(auto.publicRationale || "Automatic decision recorded.") + ' - live ' + escapeHtml(auto.live ? "yes" : "no") + ' - confidence ' + escapeHtml(String(Math.round(Number(auto.confidence || 0) * 100))) + '%</span><span class="bcc-list-item__meta">Next step: ' + escapeHtml(auto.nextSafeAction || "Follow workers and receipts.") + '</span></div>' + autoRoles + autoSignals + autoPolicy + '</div>' : '<p>Auto Subagents appears when the main loop decides to delegate reading, research, or review to governed workers.</p>') + '</div></section>';
      return html
        .replace('</div><div class="bcc-overview-columns">', autoState + '</div><div class="bcc-overview-columns">')
        .replace('<section class="bcc-card"><p class="bcc-card__label">Tools</p>', autoCard + '<section class="bcc-card"><p class="bcc-card__label">Tools</p>');
    };

    const renderRemoteMeshPanel = (vm) => {
      const cards = (vm.remoteMeshApprovalUx?.cards || []).filter((card) => card.surface === "zavorthControl" && card.approval);
      if (!cards.length) return "";
      const rows = cards.slice(0, 4).map((card) => '<div class="bcc-list-item bcc-remote-mesh-approval-row"><div class="bcc-remote-mesh-approval-row__header"><span class="bcc-list-item__title">' + escapeHtml(card.title || "Remote Mesh approval") + '</span>' + badge(card.zavorthControl?.badge || "Needs approval", "warn") + '</div><span class="bcc-list-item__meta">' + escapeHtml(card.body || "Notebook MCP approval waiting for apply.") + '</span><div class="bcc-remote-mesh-approval-row__target"><span>' + escapeHtml(card.targetKind || "notebook") + '</span><strong>' + escapeHtml(card.targetLabel || "Notebook MCP") + '</strong></div><div class="bcc-action-row"><button class="bcc-button" data-variant="primary" type="button">' + escapeHtml(card.zavorthControl?.primaryActionLabel || "Apply in MCP") + '</button><button class="bcc-button" type="button" disabled>Preview visual</button></div></div>').join("");
      return '<section class="bcc-card bcc-remote-mesh-card"><p class="bcc-card__label">Remote Mesh</p><h2 class="bcc-card__title">' + escapeHtml(cards.length + " MCP approval" + (cards.length === 1 ? "" : "s")) + '</h2><div class="bcc-card__body"><div class="bcc-list">' + rows + '</div><p class="bcc-remote-mesh-card__footnote">In the real /zavorthControl, this button calls the server-side proxy and does not expose a browser token.</p></div></section>';
    };

    const renderTrace = (label, trace, summary) => {
      const events = Array.isArray(trace?.events) ? trace.events : Array.isArray(trace) ? trace : [];
      if (!events.length) return "";
      const renderCapability = (capability) => {
        if (!capability) return "";
        const pills = [
          { tone: "kind", label: capability.kind },
          { tone: capability.risk, label: capability.risk },
          { tone: capability.requiresApproval ? "approval" : "direct", label: capability.requiresApproval ? "approval" : "direct" },
          { tone: capability.previewRequired ? "preview" : "no-preview", label: capability.previewRequired ? "preview" : "no preview" },
          { tone: "effect", label: capability.sideEffect },
        ].map((pill) => '<span class="bcc-agent-capability__pill" data-tone="' + escapeHtml(pill.tone || "kind") + '">' + escapeHtml(pill.label || "") + '</span>').join("");
        return '<div class="bcc-agent-capability" data-kind="' + escapeHtml(capability.kind || "runtime") + '" data-risk="' + escapeHtml(capability.risk || "unknown") + '"><div class="bcc-agent-capability__pills">' + pills + '</div><p class="bcc-agent-capability__reason">' + escapeHtml(capability.reason || "Capacidade selecionada pelo runtime.") + '</p><small class="bcc-agent-capability__scope">scope: ' + escapeHtml(capability.scope || "runtime") + '</small></div>';
      };
      const rows = events.slice(0, 8).map((event) => '<div class="bcc-agent-trace__step" data-kind="' + escapeHtml(event.kind || "status") + '" data-status="' + escapeHtml(event.status || "done") + '"><span class="bcc-agent-trace__dot" aria-hidden="true"></span><div class="bcc-agent-trace__copy"><div class="bcc-agent-trace__title"><span>' + escapeHtml(event.title || "Runtime update") + '</span>' + (event.chipLabel ? '<code>' + escapeHtml(event.chipLabel) + '</code>' : "") + '</div><p>' + escapeHtml(event.summary || "Evento operacional registrado.") + '</p>' + (event.target ? '<small>' + escapeHtml(event.target) + '</small>' : "") + renderCapability(event.capability) + '</div></div>').join("");
      return '<section class="bcc-agent-trace" aria-label="' + escapeHtml(label) + '"><div class="bcc-agent-trace__header"><span>' + escapeHtml(label) + '</span>' + (summary ? '<small>' + escapeHtml(summary) + '</small>' : "") + '</div><div class="bcc-agent-trace__steps">' + rows + '</div><p class="bcc-agent-trace__policy">Summaries only. Raw chain-of-thought stays private.</p></section>';
    };

    const renderActiveRunState = (vm) => {
      const run = vm.agentRun;
      const trace = run?.trace || vm.trace;
      const events = ((run?.events?.length ? run.events : vm.events) || []).slice(0, 5)
        .map((event) => '<div class="bcc-run-mini-timeline__item" data-status="' + escapeHtml(event.status || "done") + '"><span>' + escapeHtml(event.title) + '</span><small>' + escapeHtml(event.detail || event.kind) + '</small></div>')
        .join("");
      const label = vm.approvals.length > 0 ? "Approval waiting for you" : "Run atual";
      const badges = [
        run ? humanAgentStatus(run.status) : vm.runtime.status,
        vm.modelProfile.modelLabel,
        vm.approvals.length > 0 ? vm.approvals.length + " approval" : "",
        vm.artifacts.length > 0 ? vm.artifacts.length + " artifact" : "",
      ].filter(Boolean).map((item) => '<span>' + escapeHtml(item) + '</span>').join("");

      return '<section class="bcc-active-run-state" data-status="' + escapeHtml(run?.status || "idle") + '"><div><span class="bcc-card__label">' + escapeHtml(label) + '</span><h2>' + escapeHtml(run?.title || "Atividade do ZavorthControl") + '</h2><p>' + escapeHtml(run?.summary || vm.runtime.summary) + '</p></div><div class="bcc-active-run-state__badges">' + badges + '</div>' + renderTrace("Trace seguro", trace, trace?.summary ? trace.summary.eventCount + " eventos seguros" : "") + (events ? '<div class="bcc-run-mini-timeline">' + events + '</div>' : "") + '</section>';
    };

    const renderChat = (vm) => {
      if (vm.messages.length === 0) {
        if (vm.agentRun || vm.approvals.length > 0 || vm.artifacts.length > 0 || vm.events.length > 0) {
          return renderActiveRunState(vm);
        }
        return '<section class="bcc-hero">' + fox() + '<div><span class="bcc-hero__eyebrow">Ola, ' + escapeHtml(vm.runtime.operatorLabel) + '</span><h1 class="bcc-hero__title">' + escapeHtml(vm.emptyState.title) + '</h1><p class="bcc-hero__subtitle">' + escapeHtml(vm.emptyState.subtitle) + '</p></div><div class="bcc-suggestion-chips">' + vm.emptyState.suggestions.map((suggestion) => '<button class="bcc-button bcc-suggestion-chip" type="button"><span aria-hidden="true">ask</span>' + escapeHtml(suggestion) + '</button>').join("") + '</div></section>';
      }
      const messages = vm.messages.map((message) => '<article class="bcc-message" data-role="' + escapeHtml(message.role) + '"><div class="bcc-message__avatar" aria-hidden="true">' + escapeHtml(message.role === "assistant" ? "B" : message.role === "user" ? "U" : "S") + '</div><div class="bcc-message__content"><div class="bcc-message__meta"><span>' + escapeHtml(message.role === "assistant" ? "Zavorth" : message.role === "user" ? "You" : message.role) + '</span><span>' + escapeHtml(message.createdAt) + '</span>' + (message.modelLabel ? '<span>' + escapeHtml(message.modelLabel) + '</span>' : "") + '</div><div class="bcc-message__body">' + escapeHtml(message.text) + '</div>' + renderTrace("Message trace", message.trace, "") + '</div></article>').join("");
      return messages + renderTrace("Agent trace", vm.trace, vm.trace?.summary ? vm.trace.summary.eventCount + " eventos seguros - " + vm.trace.summary.toolCount + " tool(s)" : "");
    };

    const renderLoading = (label) => {
      document.getElementById("zavorthControl-preview-root").innerHTML = '<div class="bsk-zavorthControl"><div class="bcc-shell"><main class="bcc-viewport"><section class="bcc-hero">' + fox() + '<div><span class="bcc-hero__eyebrow">ZavorthControl</span><h1 class="bcc-hero__title">' + escapeHtml(label) + '</h1><p class="bcc-hero__subtitle">Carregando snapshot do Zavorth...</p></div></section></main></div></div>';
    };

    const resolveInitialRenderId = () => {
      const requested = new URLSearchParams(window.location.search).get("fixture");
      if (requested) return requested;
      return window.location.protocol === "file:" ? DEFAULT_FIXTURE_ID : LIVE_FIXTURE_ID;
    };

    const render = async (fixtureId) => {
      const wantsLive = fixtureId === LIVE_FIXTURE_ID || (!fixtureId && window.location.protocol !== "file:");
      let id = wantsLive ? LIVE_FIXTURE_ID : (FIXTURES[fixtureId] ? fixtureId : DEFAULT_FIXTURE_ID);
      let current = wantsLive ? { option: LIVE_OPTION, viewModel: null } : FIXTURES[id];
      let vm = current.viewModel;

      if (wantsLive) {
        renderLoading("Conectando ao runtime ao vivo");
        try {
          vm = await fetchLiveViewModel();
        } catch (error: unknown) {
          id = DEFAULT_FIXTURE_ID;
          current = FIXTURES[id];
          vm = {
            ...current.viewModel,
            logs: [
              {
                id: "live-snapshot-error",
                level: "warn",
                source: "zavorthControl-live",
                message: String(error?.message || error || "Live snapshot unavailable."),
                createdAt: new Date().toISOString()
              },
              ...current.viewModel.logs
            ],
            adapterSource: {
              ...current.viewModel.adapterSource,
              label: "Fallback de fixture",
              notes: "O snapshot ao vivo falhou; exibindo fixture seguro."
            }
          };
        }
      }
      const tabs = '<nav class="bcc-tab-strip" aria-label="ZavorthControl sections">' + vm.sectors.filter((sector) => sector.enabled).map((sector) => '<button type="button" data-active="' + (sector.id === "terminal" ? "true" : "false") + '"><span>' + escapeHtml(sector.label) + '</span>' + (sector.badgeCount ? '<em>' + escapeHtml(sector.badgeCount) + '</em>' : "") + '</button>').join("") + '</nav>';
      const pathCurrent = id === LIVE_FIXTURE_ID ? "Live" : "Preview";
      const composeNote = id === LIVE_FIXTURE_ID ? "Snapshot ao vivo protegido pelo gateway local." : "Preview local de fixture oficial.";

      document.getElementById("zavorthControl-preview-root").innerHTML = '<div class="bsk-zavorthControl bcc-minimal-reframe"><div class="bcc-shell"><header class="bcc-bridge"><div class="bcc-bridge__brand">' + fox().replace('class="bcc-mascot"', 'class="bcc-mascot" style="width:46px;height:46px;border-radius:16px"') + '<div><span class="bcc-bridge__eyebrow">ZavorthControl</span><span class="bcc-bridge__title">Zavorth</span></div></div><div class="bcc-bridge__center"><span class="bcc-bridge__path">Zavorth</span><span class="bcc-bridge__path-sep">/</span><span class="bcc-bridge__path-current">' + escapeHtml(pathCurrent) + '</span></div><div class="bcc-bridge__right">' + badge(vm.runtime.currentModelLabel, toneForRuntime(vm.runtime.status)) + '<span class="bcc-runtime-pulse" data-status="' + escapeHtml(vm.runtime.status) + '">' + escapeHtml(humanRuntimeStatus(vm.runtime.status)) + '</span></div></header><main class="bcc-viewport">' + renderFixturePreviewBar(id, current.option) + renderAuthUnlock(vm) + renderMissionBrief(vm) + tabs + '<div class="bcc-tab-surface"><section class="bcc-panel bcc-chat-panel"><div class="bcc-chat-feed">' + renderChat(vm) + '</div><form class="bcc-compose"><div class="bcc-compose__input-frame"><textarea placeholder="Ask Zavorth"></textarea><div class="bcc-compose__footer"><span class="bcc-empty-note">' + escapeHtml(composeNote) + '</span><button class="bcc-button bcc-compose__send" data-variant="primary" type="button">Send</button></div></div></form></section></div></main></div></div>';

      injectPreviewOnboardingAndApprovals(vm);
      normalizeVisibleZavorthControlCopy(document.getElementById("zavorthControl-preview-root"));

      const selector = document.getElementById("fixture-select");
      selector?.addEventListener("change", (event) => {
        const nextId = event.target.value;
        const url = new URL(window.location.href);
        if (nextId === LIVE_FIXTURE_ID) {
          url.searchParams.delete("fixture");
        } else {
          url.searchParams.set("fixture", nextId);
        }
        history.replaceState(null, "", url);
        render(nextId);
      });

      const authForm = document.getElementById("zavorthControl-auth-form");
      authForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const input = document.getElementById("zavorthControl-auth-token");
        const message = document.getElementById("zavorthControl-auth-message");
        const token = String(input?.value || "").trim();
        if (!token) {
          if (message) message.textContent = "Informe o token local para desbloquear.";
          return;
        }
        if (message) message.textContent = "Validando token nesta aba...";
        try {
          const response = await fetch("/api/auth/validate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token })
          });
          if (!response.ok) {
            clearAuthToken();
            if (message) message.textContent = "Token recusado. Verifique e tente de novo.";
            return;
          }
          writeAuthToken(token);
          if (message) message.textContent = "Access liberado. Atualizando cockpit...";
          await render(LIVE_FIXTURE_ID);
        } catch {
          if (message) message.textContent = "Nao consegui validar agora. Tente novamente em instantes.";
        }
      });
    };

    render(resolveInitialRenderId());
  </script>
</body>
</html>`;
}

function main() {
  const options = readCliOptions();
  const selectedFixture = options.fixture === "all"
    ? "safe-run"
    : resolveZavorthControlZavorthControlFixturePreviewId(options.fixture) - "safe-run";

  fs.mkdirSync(options.outDir, { recursive: true });
  const htmlPath = path.join(options.outDir, "index.html");
  fs.writeFileSync(htmlPath, buildPreviewHtml(selectedFixture), "utf8");

  console.log(`[zavorthControl-browser-preview] ${htmlPath}`);
  console.log(`[zavorthControl-browser-preview] file://${htmlPath.replace(/\\/g, "/")}?fixture=${selectedFixture}`);
}

main();
