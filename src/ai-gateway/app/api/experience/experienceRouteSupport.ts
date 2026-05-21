import { ExperienceCoreService, type ExperienceCommand } from "../../../../services/experience/index.js";
import {
  ZavorthAgentGateway,
  createDefaultAgentRunStore,
  createDefaultAgentWorkflowQueueStore,
} from "../../../../runtime/agent/index.js";
import { RuntimeAccessReadinessService } from "../../../../runtime/access/RuntimeAccessReadinessService.js";
import { ZavorthLearningPlaneService } from "../../../../services/ZavorthLearningPlaneService.js";
import { ZavorthMemoryPlaneService } from "../../../../services/ZavorthMemoryPlaneService.js";
import { LlmRuntimeService } from "../../../../services/llm/LlmRuntimeService.js";
import { config } from "../../../../config/index.js";

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
} {
  const url = new URL(request.url);
  return {
    sessionId: url.searchParams.get("sessionId"),
    workspace: url.searchParams.get("workspace"),
    activeRunId: url.searchParams.get("runId"),
    activeTraceId: url.searchParams.get("traceId"),
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

export function buildExperienceCommand(body: Record<string, unknown>): Partial<ExperienceCommand> & { text: string } {
  return {
    contractVersion: "ExperienceCommand/v1",
    text: String(body.text || body.message || body.prompt || "").trim(),
    intent: typeof body.intent === "string" ? body.intent as ExperienceCommand["intent"] : "ask",
    surface: body.surface === "cli" || body.surface === "telegram" || body.surface === "discord" || body.surface === "api"
      ? body.surface
      : "web",
    userId: String(body.userId || body.requestedBy || "control-ui").trim() || "control-ui",
    sessionId: typeof body.sessionId === "string" ? body.sessionId : null,
    workspace: typeof body.workspace === "string" ? body.workspace : null,
    trustMode: typeof body.trustMode === "string" ? body.trustMode as ExperienceCommand["trustMode"] : "protected",
    metadata: {
      requestedBy: body.requestedBy || "control-ui",
      source: "api/experience",
    },
  };
}

export async function resolveRouteParams<T extends Record<string, string>>(
  params: T | Promise<T>,
): Promise<T> {
  return await Promise.resolve(params);
}
