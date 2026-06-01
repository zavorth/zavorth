import type { ExperienceCommand } from "../../../../services/experience/ExperienceContracts";
import { ExperienceCoreService } from "../../../../services/experience/ExperienceCoreService";
import {
  ZavorthAgentGateway,
  createDefaultAgentRunStore,
  createDefaultAgentWorkflowQueueStore,
} from "../../../../runtime/agent";
import { RuntimeAccessReadinessService } from "../../../../runtime/access/RuntimeAccessReadinessService";
import { ZavorthLearningPlaneService } from "../../../../services/ZavorthLearningPlaneService";
import { ZavorthMemoryPlaneService } from "../../../../services/ZavorthMemoryPlaneService";
import { LlmRuntimeService } from "../../../../services/llm/LlmRuntimeService";
import { config } from "../../../../config";

let experienceCore: ExperienceCoreService | null = null;

export function getExperienceCoreService(): ExperienceCoreService {
  if (experienceCore) return experienceCore;
  const agentGateway = new ZavorthAgentGateway({
    defaultProviderLabel: config.llmProvider || "Zavorth",
    defaultModelLabel: config.geminiModel || config.geminiDefaultModel || config.openaiModel || "modelo atual",
    llmRuntime: new LlmRuntimeService(),
    runStore: createDefaultAgentRunStore(),
    workflowQueueStore: createDefaultAgentWorkflowQueueStore(),
  });
  experienceCore = new ExperienceCoreService({
    agentGateway,
    memoryPlane: new ZavorthMemoryPlaneService(),
    learningPlane: new ZavorthLearningPlaneService(),
    runtimeAccessReadiness: new RuntimeAccessReadinessService(),
  });
  return experienceCore;
}

export function readExperienceQuery(request: Request): {
  sessionId: string | null;
  workspace: string | null;
  activeRunId: string | null;
  activeTraceId: string | null;
  userId: string | null;
  responseProfile: ExperienceCommand["responseProfile"];
} {
  const url = new URL(request.url);
  const responseProfile = url.searchParams.get("responseProfile");
  return {
    sessionId: url.searchParams.get("sessionId"),
    workspace: url.searchParams.get("workspace"),
    activeRunId: url.searchParams.get("runId"),
    activeTraceId: url.searchParams.get("traceId"),
    userId: url.searchParams.get("userId") || "control-ui",
    responseProfile: responseProfile === "short" || responseProfile === "dev" || responseProfile === "executive" || responseProfile === "mentor"
      ? responseProfile
      : null,
  };
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function parseResponseProfileText(value: unknown): ExperienceCommand["responseProfile"] {
  const text = String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/\b(estilo|perfil|resposta)\s+(curto|objetivo|short)\b/.test(text) || /\b(use|usar)\s+(curto|objetivo|short)\b/.test(text)) return "short";
  if (/\b(estilo|perfil|resposta)\s+(dev|developer|tecnico|technical)\b/.test(text) || /\b(include|inclua).*(arquivos|testes|evidencias)\b/.test(text)) return "dev";
  if (/\b(estilo|perfil|resposta)\s+(executivo|executive|manager)\b/.test(text) || /\b(resuma|resumo).*(impacto|decisao)\b/.test(text)) return "executive";
  if (/\b(estilo|perfil|resposta)\s+(mentor|didatico|teacher)\b/.test(text) || /\b(explique|ensine).*(enquanto|passo)\b/.test(text)) return "mentor";
  return null;
}

export function buildExperienceCommand(body: Record<string, unknown>): Partial<ExperienceCommand> & { text: string } {
  const text = String(body.text || body.message || body.prompt || "").trim();
  const responseProfile = body.responseProfile === "short"
    || body.responseProfile === "dev"
    || body.responseProfile === "executive"
    || body.responseProfile === "mentor"
    ? body.responseProfile
    : parseResponseProfileText(text);
  const actionCardDecision = body.actionCardDecision && typeof body.actionCardDecision === "object" && !Array.isArray(body.actionCardDecision)
    ? body.actionCardDecision as ExperienceCommand["actionCardDecision"]
    : null;
  const diffDecision = body.diffDecision && typeof body.diffDecision === "object" && !Array.isArray(body.diffDecision)
    ? body.diffDecision as ExperienceCommand["diffDecision"]
    : null;
  const contextRecoveryDecision = body.contextRecoveryDecision && typeof body.contextRecoveryDecision === "object" && !Array.isArray(body.contextRecoveryDecision)
    ? body.contextRecoveryDecision as ExperienceCommand["contextRecoveryDecision"]
    : null;
  return {
    contractVersion: "ExperienceCommand/v1",
    text,
    intent: typeof body.intent === "string" ? body.intent as ExperienceCommand["intent"] : "ask",
    surface: body.surface === "cli" || body.surface === "telegram" || body.surface === "discord" || body.surface === "api"
      ? body.surface
      : "web",
    userId: String(body.userId || body.requestedBy || "control-ui").trim() || "control-ui",
    sessionId: typeof body.sessionId === "string" ? body.sessionId : null,
    workspace: typeof body.workspace === "string" ? body.workspace : null,
    trustMode: typeof body.trustMode === "string" ? body.trustMode as ExperienceCommand["trustMode"] : "protected",
    autonomyMode: body.autonomyMode === "manual" || body.autonomyMode === "speculative" || body.autonomyMode === "governed"
      ? body.autonomyMode
      : "governed",
    actionCardDecision,
    diffDecision,
    contextRecoveryDecision,
    responseProfile,
    metadata: {
      requestedBy: body.requestedBy || "control-ui",
      source: "api/experience",
      responseProfile: responseProfile || undefined,
    },
  };
}

export async function resolveRouteParams<T extends Record<string, string>>(
  params: T | Promise<T>,
): Promise<T> {
  return await Promise.resolve(params);
}
