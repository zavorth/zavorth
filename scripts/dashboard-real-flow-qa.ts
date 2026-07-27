#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ZavorthAgentGateway,
  type UniversalAgentExecutor,
} from "../src/runtime/agent/index";
import {
  buildZavorthControlViewModelFromZavorthAgentGatewaySnapshot,
} from "../src/zavorth-control/app/(zavorthControl)/control/zavorth-control/adapters/zavorthAgentGatewayZavorthControlAdapter";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultOutDir = path.join(rootDir, ".tmp", "zavorthControl-real-flow-qa");

type QaStep = {
  id: string;
  status: "pass" | "fail";
  detail: string;
};

type QaReport = {
  ok: boolean;
  generatedAt: string;
  scenario: string;
  outDir: string;
  runId?: string;
  approvalId?: string;
  artifactIds: string[];
  steps: QaStep[];
  visualChecklist: Array<{
    area: string;
    expected: string;
  }>;
};

type CliOptions = {
  outDir: string;
  requirePass: boolean;
};

function readOptions(): CliOptions {
  const args = process.argv.slice(2);
  const outArg = args.find((arg) => arg.startsWith("--out="));
  return {
    outDir: path.resolve(rootDir, String(outArg?.split("=").slice(1).join("=") || defaultOutDir).trim()),
    requirePass: args.includes("--require-pass"),
  };
}

function createIdFactory() {
  let index = 0;
  return (prefix: string) => {
    index += 1;
    return `${prefix}-visual-real-${index}`;
  };
}

function createClock() {
  let tick = 0;
  const base = Date.parse("2026-04-26T18:00:00.000Z");
  return () => {
    tick += 1;
    return new Date(base + tick * 1000);
  };
}

function pushStep(report: QaReport, id: string, condition: boolean, detail: string): void {
  report.steps.push({
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
  const reportPath = path.join(report.outDir, "report.json");
  const checklistPath = path.join(report.outDir, "visual-checklist.md");
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(
    checklistPath,
    [
      "# ZavorthControl Visual Real QA",
      "",
      `Generated at: ${report.generatedAt}`,
      `Status: ${report.ok ? "PASS" : "FAIL"}`,
      `Run: ${report.runId || "-"}`,
      `Approval: ${report.approvalId || "-"}`,
      `Artifacts: ${report.artifactIds.join(", ") || "-"}`,
      "",
      "## Checklist visual manual",
      "",
      ...report.visualChecklist.map((entry) => `- **${entry.area}:** ${entry.expected}`),
      "",
      "## Automated steps",
      "",
      ...report.steps.map((step) => `- [${step.status === "pass" ? "x" : " "}] ${step.id}: ${step.detail}`),
      "",
    ].join("\n"),
    "utf8",
  );
}

async function runQa(options: CliOptions): Promise<QaReport> {
  const report: QaReport = {
    ok: true,
    generatedAt: new Date().toISOString(),
    scenario: "zavorthControl-real-approval-artifact-history",
    outDir: options.outDir,
    artifactIds: [],
    steps: [],
    visualChecklist: [
      {
        area: "Topo",
        expected: "The chip shows Core Unlocked/Core Live after the token.",
      },
      {
        area: "Approvals",
        expected: "A dangerous run appears as pending approval before execution.",
      },
      {
        area: "Chat",
        expected: "History shows the user request and Zavorth response.",
      },
      {
        area: "Artifacts",
        expected: "The generated report appears as a ready artifact.",
      },
      {
        area: "Replay/History",
        expected: "The completed run appears in the sessions/runs list with replay available.",
      },
    ],
  };

  const executor: UniversalAgentExecutor = ({ run }) => ({
    status: "completed",
    summary: "Real visual QA completed: approval approved, artifact generated, and replay available.",
    replyText: "Real visual QA report ready.",
    events: [
      {
        kind: "tool",
        title: "Tool executed",
        detail: "shell.exec foi liberado pelo approval universal.",
        status: "done",
      },
      {
        kind: "artifact",
        title: "Generated artifact",
        detail: "Real visual QA report attached to the run.",
        status: "done",
      },
      {
        kind: "reply",
        title: "Response sent",
        detail: "ZavorthControl received the run completion.",
        status: "done",
      },
    ],
    artifacts: [
      {
        id: "qa-visual-real-report",
        title: "Real Visual QA Report",
        kind: "report",
        createdAt: run.updatedAt,
        sessionId: run.sessionId,
        status: "ready",
      },
    ],
    memorySignals: [
      {
        id: "qa-visual-real-memory",
        title: "ZavorthControl validated",
        layer: "episodic",
        summary: "Approval, artifact, replay, and history passed in the real gateway flow.",
        confidence: 0.99,
      },
    ],
  });

  const gateway = new ZavorthAgentGateway({
    now: createClock(),
    idFactory: createIdFactory(),
    defaultProviderLabel: "OpenAI",
    defaultModelLabel: "gpt-5.2",
  });

  const pending = await gateway.handle({
    userId: "grey",
    channel: "web",
    sessionId: "session-zavorthControl-real-qa",
    text: "generate a PDF report and run a local command to validate the panel",
    requestedTools: ["shell.exec", "pdf.generate"],
    modelProfile: {
      providerLabel: "OpenAI",
      modelLabel: "gpt-5.2",
      routingPolicy: "gateway",
      supportsTools: true,
      supportsStreaming: true,
    },
  });

  report.runId = pending.run.id;
  report.approvalId = pending.run.approvals[0]?.id;

  const pendingViewModel = buildZavorthControlViewModelFromZavorthAgentGatewaySnapshot(
    gateway.buildSnapshot({ activeRunId: pending.run.id }),
  );

  pushStep(
    report,
    "pending-approval-created",
    pending.run.status === "waiting_approval" && pending.run.approvals.some((approval) => approval.status === "pending"),
    "Run perigosa fica parada no approval gate universal.",
  );
  pushStep(
    report,
    "pending-view-model-visible",
    pendingViewModel.runtime.status === "degraded"
      && pendingViewModel.agentRun?.status === "waiting_approval"
      && pendingViewModel.counts.approvals === 1
      && pendingViewModel.toolExposure.mode === "restricted",
    "ViewModel mostra estado degradado, approval pending e tools restritas.",
  );

  const approvalId = pending.run.approvals[0]?.id || "";
  const approved = await gateway.approve(approvalId, { executor });
  const completedRun = approved?.run;

  report.artifactIds = completedRun?.artifacts.map((artifact) => artifact.id) || [];

  const completedViewModel = buildZavorthControlViewModelFromZavorthAgentGatewaySnapshot(
    gateway.buildSnapshot({ activeRunId: completedRun?.id }),
  );

  pushStep(
    report,
    "approval-resumes-run",
    Boolean(approved?.ok && approved.resumed && completedRun?.status === "completed"),
    "Approval universal retoma e conclui a run.",
  );
  pushStep(
    report,
    "artifact-generated",
    completedViewModel.artifacts.some((artifact) => artifact.id === "qa-visual-real-report" && artifact.status === "ready"),
    "Artifact real fica available no ViewModel do ZavorthControl.",
  );
  pushStep(
    report,
    "history-and-replay-visible",
    completedViewModel.sessions.some((session) => session.id === "session-zavorthControl-real-qa")
      && completedViewModel.replay.status === "available"
      && completedViewModel.messages.length >= 2,
    "History, replay, and transcript remain representable after completion.",
  );
  pushStep(
    report,
    "no-stale-pending-approval",
    completedViewModel.runtime.status === "ready"
      && completedViewModel.counts.approvals === 0
      && completedViewModel.runtime.blockers.every((blocker) => blocker.id !== "pending-approvals"),
    "Approved approval no longer pollutes the panel as a pending block.",
  );

  return report;
}

const options = readOptions();
runQa(options)
  .then((report) => {
    writeReport(report);
    const status = report.ok ? "PASS" : "FAIL";
    console.log(`[zavorthControl-real-flow-qa] ${status} ${path.join(report.outDir, "visual-checklist.md")}`);
    if (!report.ok && options.requirePass) {
      process.exitCode = 1;
    }
  })
  .catch((error) => {
    const report: QaReport = {
      ok: false,
      generatedAt: new Date().toISOString(),
      scenario: "zavorthControl-real-approval-artifact-history",
      outDir: options.outDir,
      artifactIds: [],
      steps: [
        {
          id: "unexpected-error",
          status: "fail",
          detail: String(error?.stack || error?.message || error),
        },
      ],
      visualChecklist: [],
    };
    writeReport(report);
    console.error(`[zavorthControl-real-flow-qa] FAIL ${error?.message || error}`);
    if (options.requirePass) {
      process.exitCode = 1;
    }
  });