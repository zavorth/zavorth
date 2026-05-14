import type {
  DashboardCommandCenterViewModel,
  DashboardNaturalFirstRuntimeSnapshot,
  DashboardRuntimeStatus,
  DashboardToolRiskLevel,
} from "../contracts";
import {
  asArray,
  asRecord,
  asText,
  formatTimestamp,
  normalizeToolRisk,
  type DashboardCommandCenterAdapterInput,
  type LooseRecord,
} from "./dashboardCommandCenterAdapterShared";
import {
  asCommandCenterTextArray as asTextArray,
  resolveCommandCenterAgentRun as resolveAgentRun,
  resolveCommandCenterAgentRunMetadata as resolveAgentRunMetadata,
} from "./dashboardCommandCenterRunObservability";

function routeLabel(route: string): string {
  const labels: Record<string, string> = {
    "slash-command": "Comando",
    "light-chat": "Conversa leve",
    "llm-reply": "Resposta LLM",
    "capability-discovery": "Descoberta",
    "memory-recall": "Memoria",
    "tool-preview": "Preview",
    "approval-proposal": "Approval",
    "governed-execution": "Execucao governada",
  };
  return labels[route] || "Rota natural";
}

function normalizeStatus(value: unknown): DashboardNaturalFirstRuntimeSnapshot["status"] {
  const raw = asText(value).toLowerCase();
  if (
    raw === "received"
    || raw === "classified"
    || raw === "light-reply"
    || raw === "llm-reply"
    || raw === "memory-recall"
    || raw === "tool-preview"
    || raw === "approval-required"
    || raw === "governed-execution"
    || raw === "completed"
  ) {
    return raw;
  }
  return "unknown";
}

function riskFromRoute(routeRisk: LooseRecord | null, approvalSafety: LooseRecord | null): {
  level: DashboardToolRiskLevel;
  requiresApproval: boolean;
  previewRequired: boolean;
  reasons: string[];
} {
  const approvalRisk = asRecord(approvalSafety?.risk);
  const level = normalizeToolRisk({
    risk: approvalRisk?.level ?? routeRisk?.level,
  });
  return {
    level,
    requiresApproval: approvalRisk?.routeRequiresApproval === true
      || approvalRisk?.toolRequiresApproval === true
      || routeRisk?.requiresApproval === true,
    previewRequired: approvalRisk?.previewRequired === true || routeRisk?.previewRequired === true,
    reasons: asTextArray(approvalRisk?.reasons || routeRisk?.reasons) || [],
  };
}

function resolveStatus(input: {
  route: string;
  runStatus: string;
  lightReply: LooseRecord | null;
  llmRuntime: LooseRecord | null;
  memoryContinuity: LooseRecord | null;
  approvalSafety: LooseRecord | null;
}): DashboardNaturalFirstRuntimeSnapshot["status"] {
  const approvalStatus = asText(input.approvalSafety?.status);
  if (approvalStatus === "approval-required" || input.runStatus === "waiting_approval") {
    return "approval-required";
  }
  if (input.lightReply) {
    return "light-reply";
  }
  if (input.llmRuntime) {
    return "llm-reply";
  }
  if (input.memoryContinuity) {
    return "memory-recall";
  }
  if (input.route === "tool-preview") {
    return "tool-preview";
  }
  if (input.route === "governed-execution") {
    return "governed-execution";
  }
  if (input.runStatus === "completed") {
    return "completed";
  }
  return input.route ? "classified" : "unknown";
}

function toneFromStatus(
  status: DashboardNaturalFirstRuntimeSnapshot["status"],
  risk: DashboardNaturalFirstRuntimeSnapshot["risk"],
  runStatus: string,
): DashboardRuntimeStatus {
  if (runStatus === "failed" || runStatus === "cancelled") {
    return "blocked";
  }
  if (status === "approval-required" || risk.requiresApproval || risk.previewRequired) {
    return "degraded";
  }
  return "ready";
}

function normalizeTone(value: unknown): DashboardRuntimeStatus {
  const raw = asText(value).toLowerCase();
  if (raw === "ready" || raw === "degraded" || raw === "blocked" || raw === "offline") {
    return raw;
  }
  return "ready";
}

function headlineFor(status: DashboardNaturalFirstRuntimeSnapshot["status"], route: string): string {
  if (status === "approval-required") {
    return "Acao aguardando aprovacao";
  }
  if (status === "light-reply" || status === "llm-reply" || status === "memory-recall" || status === "completed") {
    return "Resposta pronta";
  }
  if (status === "tool-preview") {
    return "Preview governado preparado";
  }
  if (status === "governed-execution") {
    return "Execucao governada em andamento";
  }
  return route ? "Mensagem classificada" : "Natural First aguardando mensagem";
}

function detailFor(input: {
  status: DashboardNaturalFirstRuntimeSnapshot["status"];
  route: string;
  routeReason: string;
  lightReply: LooseRecord | null;
  llmRuntime: LooseRecord | null;
  memoryContinuity: LooseRecord | null;
  approvalSafety: LooseRecord | null;
  runSummary: string;
}): string {
  if (input.status === "approval-required") {
    return asText(input.approvalSafety?.summary, "O runtime parou antes de executar e aguarda approval.");
  }
  if (input.lightReply) {
    return asText(input.lightReply.summary, "Resposta leve governada concluida.");
  }
  if (input.llmRuntime) {
    return asText(input.llmRuntime.summary, "Pergunta livre respondida pelo runtime natural.");
  }
  if (input.memoryContinuity) {
    return asText(input.memoryContinuity.summary, "Pedido de memoria tratado com receipts.");
  }
  return input.routeReason || input.runSummary || `Rota ${input.route || "natural"} pronta no gateway.`;
}

function nextSafeAction(input: {
  approvalSafety: LooseRecord | null;
  memoryContinuity: LooseRecord | null;
  llmRuntime: LooseRecord | null;
  routeReason: string;
}): string {
  return asText(
    input.approvalSafety?.nextSafeAction
      ?? input.memoryContinuity?.nextSafeAction
      ?? input.llmRuntime?.nextSafeAction
      ?? input.routeReason,
    "Continuar pelo gateway governado.",
  );
}

function buildStages(input: {
  run: LooseRecord;
  route: string;
  routeLabel: string;
  routeReason: string;
  status: DashboardNaturalFirstRuntimeSnapshot["status"];
  detail: string;
}): DashboardNaturalFirstRuntimeSnapshot["stages"] {
  const waitingApproval = input.status === "approval-required";
  const blocked = asText(input.run.status) === "failed" || asText(input.run.status) === "cancelled";
  return [
    {
      id: "received",
      label: "Mensagem recebida",
      detail: asText(input.run.title ?? input.run.input, "Texto livre entrou no gateway."),
      status: "done",
    },
    {
      id: "classified",
      label: `Classificada como ${input.routeLabel}`,
      detail: input.routeReason || "Classificacao Natural First registrada.",
      status: input.route ? "done" : "pending",
    },
    {
      id: "result",
      label: waitingApproval ? "Aguardando aprovacao" : "Resposta pronta",
      detail: input.detail,
      status: blocked ? "blocked" : waitingApproval ? "pending" : "done",
    },
  ];
}

function fromExplicitRaw(raw: LooseRecord): DashboardNaturalFirstRuntimeSnapshot | null {
  if (asText(raw.contractVersion) !== "natural-first-command-center-ux/8") {
    return null;
  }
  return {
    contractVersion: "natural-first-command-center-ux/8",
    generatedAt: asText(raw.generatedAt, formatTimestamp(new Date().toISOString())),
    route: asText(raw.route, "unknown"),
    routeLabel: asText(raw.routeLabel, routeLabel(asText(raw.route, "unknown"))),
    status: normalizeStatus(raw.status),
    tone: normalizeTone(raw.tone),
    headline: asText(raw.headline, "Natural First"),
    detail: asText(raw.detail, "Runtime natural-first ativo."),
    receivedText: asText(raw.receivedText),
    inputKind: asText(raw.inputKind, "free-text"),
    shouldEnterGateway: raw.shouldEnterGateway !== false,
    channel: asText(raw.channel, "unknown"),
    costTier: asText(raw.costTier, "unknown"),
    effort: asText(raw.effort, "unknown"),
    usesLlm: asText(raw.usesLlm, "unknown"),
    risk: {
      level: normalizeToolRisk({ risk: asRecord(raw.risk)?.level }),
      requiresApproval: asRecord(raw.risk)?.requiresApproval === true,
      previewRequired: asRecord(raw.risk)?.previewRequired === true,
      reasons: asTextArray(asRecord(raw.risk)?.reasons) || [],
    },
    stages: asArray<LooseRecord>(raw.stages).slice(0, 5).map((stage, index) => ({
      id: asText(stage.id, `natural-stage-${index + 1}`),
      label: asText(stage.label, "Etapa Natural First"),
      detail: asText(stage.detail, "Etapa registrada."),
      status: stage.status === "pending" || stage.status === "blocked" ? stage.status : "done",
    })),
    policies: {
      noExecutorForLightChat: asRecord(raw.policies)?.noExecutorForLightChat === true,
      noToolExecutionBeforeApproval: asRecord(raw.policies)?.noToolExecutionBeforeApproval === true,
      noMemoryInvented: asRecord(raw.policies)?.noMemoryInvented === true,
      noApprovalBypass: asRecord(raw.policies)?.noApprovalBypass === true,
      gracefulLlmFallback: asRecord(raw.policies)?.gracefulLlmFallback === true,
    },
    nextSafeAction: asText(raw.nextSafeAction, "Continuar pelo gateway governado."),
  };
}

export function buildNaturalFirstRuntime(
  input: DashboardCommandCenterAdapterInput,
): DashboardCommandCenterViewModel["naturalFirstRuntime"] {
  const explicit = asRecord(input.naturalFirstRuntime)
    || asRecord(input.runtime?.naturalFirstRuntime)
    || asRecord(input.state?.naturalFirstRuntime);
  const explicitSnapshot = explicit ? fromExplicitRaw(explicit) : null;
  if (explicitSnapshot) {
    return explicitSnapshot;
  }

  const run = resolveAgentRun(input);
  const metadata = resolveAgentRunMetadata(input);
  const route = asRecord(metadata?.naturalFirstRoute);
  if (!run || !metadata || !route) {
    return null;
  }

  const entrypoint = asRecord(metadata.naturalFirstEntrypoint) || {};
  const lightReply = asRecord(metadata.naturalFirstLightReply);
  const llmRuntime = asRecord(metadata.naturalFirstLlmRuntime);
  const memoryContinuity = asRecord(metadata.naturalFirstMemoryContinuity);
  const approvalSafety = asRecord(metadata.naturalFirstApprovalSafety);
  const executorResolution = asRecord(metadata.executorResolution) || {};
  const routeName = asText(route.route, "unknown");
  const risk = riskFromRoute(asRecord(route.risk), approvalSafety);
  const status = resolveStatus({
    route: routeName,
    runStatus: asText(run.status),
    lightReply,
    llmRuntime,
    memoryContinuity,
    approvalSafety,
  });
  const label = routeLabel(routeName);
  const detail = detailFor({
    status,
    route: routeName,
    routeReason: asText(route.reason),
    lightReply,
    llmRuntime,
    memoryContinuity,
    approvalSafety,
    runSummary: asText(run.summary),
  });
  const policy = asRecord(memoryContinuity?.policy) || {};
  const lightSafety = asRecord(lightReply?.safety) || {};
  const llmSafety = asRecord(llmRuntime?.safety) || {};
  const approvalEnforcement = asRecord(approvalSafety?.enforcement) || {};

  return {
    contractVersion: "natural-first-command-center-ux/8",
    generatedAt: formatTimestamp(
      approvalSafety?.generatedAt
        ?? memoryContinuity?.generatedAt
        ?? lightReply?.generatedAt
        ?? run.updatedAt
        ?? new Date().toISOString(),
    ),
    route: routeName,
    routeLabel: label,
    status,
    tone: toneFromStatus(status, risk, asText(run.status)),
    headline: headlineFor(status, routeName),
    detail,
    receivedText: asText(run.input ?? input.agentRun?.input),
    inputKind: asText(entrypoint.inputKind, "free-text"),
    shouldEnterGateway: entrypoint.gatewayRequired !== false && route.shouldEnterGateway !== false,
    channel: asText(run.channel, "unknown"),
    costTier: asText(asRecord(route.cost)?.tier, "unknown"),
    effort: asText(route.effort, "unknown"),
    usesLlm: asText(route.usesLlm, "unknown"),
    risk,
    stages: buildStages({
      run,
      route: routeName,
      routeLabel: label,
      routeReason: asText(route.reason),
      status,
      detail,
    }),
    policies: {
      noExecutorForLightChat: lightSafety.noExecutorCalled === true,
      noToolExecutionBeforeApproval: approvalEnforcement.noToolExecutionBeforeApproval === true,
      noMemoryInvented: policy.noMemoryInvented === true,
      noApprovalBypass: approvalEnforcement.noApprovalBypass === true
        || lightSafety.approvalBypass === false
        || llmSafety.noApprovalBypass === true,
      gracefulLlmFallback: executorResolution.gracefulFallback === true || llmRuntime?.fallbackUsed === true,
    },
    nextSafeAction: nextSafeAction({
      approvalSafety,
      memoryContinuity,
      llmRuntime,
      routeReason: asText(route.reason),
    }),
  };
}
