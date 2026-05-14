import type { DashboardNexusWorkbenchSnapshot } from "../contracts";
import {
  asArray,
  asNumber,
  asRecord,
  asText,
  formatTimestamp,
  type DashboardCommandCenterAdapterInput,
  type LooseRecord,
} from "./dashboardCommandCenterAdapterShared";

function normalizeRuntimeLabel(value: unknown): string {
  const raw = asText(value);
  if (raw === "ZavorthAgentGateway") {
    return "Runtime principal";
  }
  if (raw === "ZavorthEchoService") {
    return "Echo seguro";
  }
  return raw || "Runtime desconhecido";
}

function normalizeStatus(raw: LooseRecord): DashboardNexusWorkbenchSnapshot["status"] {
  const approvals = asRecord(raw.approvals);
  const runtime = asRecord(raw.runtime);
  const echo = asRecord(raw.echoExperience);
  const provider = asRecord(echo?.provider);
  if ((asNumber(approvals?.pendingCount) ?? 0) > 0) {
    return "needs-confirmation";
  }
  if (runtime?.agentGatewayAvailable === false) {
    return "fallback";
  }
  if (provider?.online === false) {
    return "degraded";
  }
  if (raw.ok === false) {
    return "offline";
  }
  return "ready";
}

function buildWorkbenchHeadline(
  raw: LooseRecord,
  status: DashboardNexusWorkbenchSnapshot["status"],
): string {
  const explicit = asText(raw.headline);
  if (explicit) {
    return explicit;
  }
  const approvals = asRecord(raw.approvals);
  const pendingCount = asNumber(approvals?.pendingCount) ?? 0;
  if (status === "needs-confirmation") {
    return `${pendingCount} confirmacao(oes) aguardando sua decisao.`;
  }
  if (status === "fallback") {
    return "Nexus em fallback seguro pelo Echo.";
  }
  if (status === "degraded") {
    return "Nexus degradado; Echo permanece disponivel.";
  }
  if (status === "offline") {
    return "Nexus Workbench indisponivel agora.";
  }
  return "Nexus pronto pelo runtime principal.";
}

function buildActionPresentation(
  entry: LooseRecord,
  id: string,
  kind: DashboardNexusWorkbenchSnapshot["actions"][number]["kind"],
): { label: string; description: string } {
  const explicitLabel = asText(entry.label);
  const explicitDescription = asText(entry.description);
  if (explicitLabel && explicitDescription) {
    return { label: explicitLabel, description: explicitDescription };
  }

  const presentations: Record<string, { label: string; description: string }> = {
    "safe-status-check": {
      label: "Checar status seguro",
      description: "Executa uma leitura operacional sem shell, rede externa, secrets ou escrita.",
    },
    "resolve-approval": {
      label: "Confirmar ou negar pedido pendente",
      description: "Resolve uma confirmacao pendente pela rota canonica de permissoes.",
    },
    "capability-readiness": {
      label: "Abrir readiness de capacidades",
      description: "Carrega ferramentas, maturidade e proximos passos sem ativar nada.",
    },
  };
  const fallbackByKind: Record<string, { label: string; description: string }> = {
    safe_execution: {
      label: "Executar leitura segura",
      description: "Acao de leitura controlada pelo Nexus Workbench.",
    },
    approval_resolution: {
      label: "Resolver confirmacao",
      description: "Acao de decisao do operador para uma etapa pendente.",
    },
    capability_readiness: {
      label: "Ver readiness",
      description: "Consulta o estado de capacidades sem ativar nada.",
    },
    navigation: {
      label: "Abrir painel",
      description: "Navega para uma superficie operacional do Command Center.",
    },
    unknown: {
      label: "Acao disponivel",
      description: "Acao controlada pelo Nexus Workbench.",
    },
  };
  const resolved = presentations[id] || fallbackByKind[kind] || fallbackByKind.unknown;
  return {
    label: explicitLabel || resolved.label,
    description: explicitDescription || resolved.description,
  };
}

export function buildNexusWorkbench(input: DashboardCommandCenterAdapterInput): DashboardNexusWorkbenchSnapshot | null {
  const raw = asRecord(
    input.nexusWorkbench
      ?? input.runtime?.nexusWorkbench
      ?? input.state?.nexusWorkbench
      ?? input.state?.nexus?.workbench,
  );
  if (!raw) {
    return null;
  }

  const runtime = asRecord(raw.runtime);
  const execution = asRecord(raw.execution);
  const approvals = asRecord(raw.approvals);
  const capabilities = asRecord(raw.capabilities);
  const echoExperience = asRecord(raw.echoExperience);
  const echoProvider = asRecord(echoExperience?.provider);
  const fallback = asRecord(echoExperience?.fallback);
  const voice = asRecord(echoExperience?.voice);
  const watchMode = asRecord(echoExperience?.watchMode);
  const pending = asArray<LooseRecord>(approvals?.pending).slice(0, 8).map((entry, index) => ({
    id: asText(entry.id, `approval-${index + 1}`),
    action: asText(entry.action, "Confirmacao pendente"),
    reason: asText(entry.reason, "O Zavorth precisa da sua decisao antes de causar impacto."),
    requestedAt: formatTimestamp(entry.requestedAt),
    status: asText(entry.status, "pending"),
    resolveRoute: asText(entry.resolveRoute, "/api/v2/nexus/permissions/resolve"),
  }));
  const recent = asArray<LooseRecord>(execution?.recent).slice(0, 5).map((entry, index) => ({
    id: asText(entry.id, `execution-${index + 1}`),
    timestamp: formatTimestamp(entry.timestamp),
    prompt: asText(entry.prompt, "Pedido registrado"),
    status: asText(entry.status, "unknown"),
    durationMs: asNumber(entry.durationMs),
    tools: asArray<unknown>(entry.tools).map((tool) => asText(tool)).filter(Boolean),
    finalResponse: asText(entry.finalResponse),
  }));
  const categories = Object.entries(asRecord(capabilities?.categories) || {})
    .reduce<Record<string, number>>((acc, [key, value]) => {
      const count = asNumber(value);
      if (count !== undefined) {
        acc[key] = count;
      }
      return acc;
    }, {});
  const provisionedEdges = asArray<LooseRecord>(capabilities?.provisionedEdges).map((entry) => {
    const readiness = asRecord(entry.readiness);
    return {
      id: asText(entry.id, "provisioned-edge"),
      label: asText(entry.label, "Capacidade provisionada"),
      status: asText(entry.status, "official-but-provisioned"),
      publicStatus: asText(entry.publicStatus, "precisa configurar"),
      runtimeTruth: asText(entry.runtimeTruth, "Capacidade oficial condicionada ao ambiente local."),
      ownerLayer: asText(entry.ownerLayer, "runtime"),
      commands: asArray<string>(entry.commands).map((command) => asText(command)).filter(Boolean),
      limitations: asArray<string>(entry.limitations).map((limitation) => asText(limitation)).filter(Boolean),
      nextStep: asText(entry.nextStep, "Concluir readiness antes de ativar live."),
      readiness: readiness ? {
        itemId: asText(readiness.itemId, "capability:unknown"),
        label: asText(readiness.label, "Readiness"),
        kind: asText(readiness.kind, "capability"),
        status: asText(readiness.status, "needs_probe"),
        nextAction: asText(readiness.nextAction, "Rodar doctor/readiness."),
        blockers: asArray<string>(readiness.blockers).map((blocker) => asText(blocker)).filter(Boolean),
        checks: asArray<LooseRecord>(readiness.checks).map((check) => ({
          id: asText(check.id, "check:unknown"),
          kind: asText(check.kind, "readiness-check"),
          status: asText(check.status, "pending"),
          summary: asText(check.summary, "Check pendente."),
        })),
      } : null,
    };
  });
  const primary = asText(runtime?.primary, "ZavorthEchoService");
  const status = normalizeStatus(raw);
  const readiness = asRecord(capabilities?.readiness);

  return {
    status,
    headline: buildWorkbenchHeadline(raw, status),
    generatedAt: formatTimestamp(raw.generatedAt),
    runtime: {
      primary,
      primaryLabel: normalizeRuntimeLabel(primary),
      agentGatewayAvailable: runtime?.agentGatewayAvailable === true,
      echoFallbackAvailable: runtime?.echoFallbackAvailable !== false,
    },
    execution: {
      recentCount: asNumber(execution?.recentCount) ?? recent.length,
      recent,
    },
    approvals: {
      pendingCount: asNumber(approvals?.pendingCount) ?? pending.length,
      pending,
    },
    capabilities: {
      totalTools: asNumber(capabilities?.totalTools) ?? 0,
      categories,
      lifecycleCount: asArray(capabilities?.lifecycle).length,
      maturityCount: asArray(capabilities?.maturity).length,
      provisionedEdges,
      nextAction: asText(capabilities?.nextAction)
        || asText(readiness?.nextStep)
        || provisionedEdges.find((edge) => edge.readiness?.status !== "ready_for_activation_request")?.readiness?.nextAction
        || "Nenhuma acao pendente.",
    },
    echoExperience: {
      status: asText(echoExperience?.status, "unknown"),
      providerName: asText(echoProvider?.providerName, "unknown"),
      model: asText(echoProvider?.model, "unknown"),
      online: echoProvider?.online === true,
      latencyMs: asNumber(echoProvider?.latencyMs),
      recentExecutions: asNumber(fallback?.recentExecutions) ?? 0,
      voiceRequests: asNumber(voice?.totalRequests) ?? 0,
      watchModeNextAction: asText(watchMode?.nextAction) || null,
    },
    actions: asArray<LooseRecord>(raw.actions).slice(0, 6).map((entry, index) => {
      const id = asText(entry.id, `nexus-action-${index + 1}`);
      const kind = normalizeActionKind(entry.kind);
      const presentation = buildActionPresentation(entry, id, kind);
      return {
        id,
        label: presentation.label,
        description: presentation.description,
        kind,
        method: asText(entry.method, "GET"),
        route: asText(entry.route, "/api/v2/nexus/workbench"),
        risk: asText(entry.risk, "read_only"),
        prompt: asText(entry.prompt) || undefined,
      };
    }),
    receipts: asArray<unknown>(raw.receipts).map((receipt) => asText(receipt)).filter(Boolean),
  };
}

function normalizeActionKind(value: unknown): DashboardNexusWorkbenchSnapshot["actions"][number]["kind"] {
  const raw = asText(value).toLowerCase();
  if (
    raw === "safe_execution"
    || raw === "approval_resolution"
    || raw === "capability_readiness"
    || raw === "navigation"
  ) {
    return raw;
  }
  return "unknown";
}
