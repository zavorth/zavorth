import type { ExperienceCommand } from '../../../../services/experience/ExperienceContracts';
import { ExperienceCoreService } from '../../../../services/experience/ExperienceCoreService';
import {
  ZavorthAgentGateway,
  createDefaultAgentRunStore,
  createDefaultAgentWorkflowQueueStore,
} from '../../../../runtime/agent';
import { RuntimeAccessReadinessService } from '../../../../runtime/access/RuntimeAccessReadinessService';

import { ZavorthLearningPlaneService } from '../../../../services/ZavorthLearningPlaneService';
import { ZavorthMemoryPlaneService } from '../../../../services/ZavorthMemoryPlaneService';
import { ZavorthNativeAutonomySpineService } from '../../../../services/ZavorthNativeAutonomySpineService';
import { LlmRuntimeService } from '../../../../services/llm/LlmRuntimeService';
import { config } from '../../../../config';
import { logger } from '@/shared/utils/logger';
import { createBootstrapToolRuntime } from '../../../../bootstrap/bootstrapToolRuntime';
import { LogRepository } from '../../../../storage/LogRepository';
import { waitForPluginOsReady } from '../../../../services/PluginOsAgentReadiness';

let experienceCore: ExperienceCoreService | null = null;
let experienceReady: Promise<void> | null = null;

/**
 * P0: experience/control chat uses the same tool harness as CLI/foundation.
 */
export function getExperienceCoreService(): ExperienceCoreService {
  if (experienceCore) return experienceCore;
  const runStore = createDefaultAgentRunStore();
  let toolRuntime: any = null;
  try {
    const logRepo = new LogRepository();
    const toolRuntimeServices = createBootstrapToolRuntime(logRepo as any);
    toolRuntime = toolRuntimeServices.toolRuntime;
    experienceReady = waitForPluginOsReady({
      timeoutMs: Number(process.env.ZAVORTH_PLUGIN_OS_READY_TIMEOUT_MS) || 15000,
    })
      .then(() => undefined)
      .catch(() => undefined);
  } catch (error: unknown) {
    logger.warn('[experience] toolRuntime bootstrap soft-failed; agent will run without tools', error);
    experienceReady = Promise.resolve();
  }
  if (!process.env.ZAVORTH_TOOL_EXPOSURE_PROFILE) {
    process.env.ZAVORTH_TOOL_EXPOSURE_PROFILE = 'daily-ops';
  }
  const agentGateway = new ZavorthAgentGateway({
    defaultProviderLabel: config.llmProvider || 'Zavorth',
    defaultModelLabel: config.geminiModel || config.geminiDefaultModel || config.openaiModel || 'modelo atual',
    llmRuntime: new LlmRuntimeService(),
    toolRuntime,
    runStore,
    workflowQueueStore: createDefaultAgentWorkflowQueueStore(),
    nativeAutonomySpine: new ZavorthNativeAutonomySpineService(),
  });
  experienceCore = new ExperienceCoreService({
    agentGateway,
    memoryPlane: new ZavorthMemoryPlaneService(),
    learningPlane: new ZavorthLearningPlaneService({
      nativeRunStore: runStore,
    }),
    runtimeAccessReadiness: new RuntimeAccessReadinessService(),
  });
  return experienceCore;
}

/** Await Plugin OS wire before experience agent runs (P0). */
export async function ensureExperienceAgentReady(): Promise<void> {
  getExperienceCoreService();
  if (experienceReady) {
    await experienceReady;
  }
}

export function readExperienceQuery(request: Request): {
  sessionId: string | null;
  workspace: string | null;
  activeRunId: string | null;
  activeTraceId: string | null;
  userId: string | null;
  responseProfile: ExperienceCommand['responseProfile'];
} {
  const url = new URL(request.url);
  const responseProfile = url.searchParams.get('responseProfile');
  return {
    sessionId: url.searchParams.get('sessionId'),
    workspace: url.searchParams.get('workspace'),
    activeRunId: url.searchParams.get('runId'),
    activeTraceId: url.searchParams.get('traceId'),
    userId: url.searchParams.get('userId') || 'control-ui',
    responseProfile:
      responseProfile === 'short' ||
      responseProfile === 'dev' ||
      responseProfile === 'executive' ||
      responseProfile === 'mentor'
        ? responseProfile
        : null,
  };
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  } catch (error: unknown) {
    logger.warn('[experience] process execution failed', error);
    return {};
  }
}

/**
 * Explicit response profile only — never free-text keyword routing.
 * Accepts body.responseProfile id, or standalone token / --profile <id> in text.
 */
function parseResponseProfileToken(value: unknown): ExperienceCommand['responseProfile'] {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const tokens = raw.split(/\s+/).filter(Boolean);
  const flagIdx = tokens.findIndex((t) => t === '--profile' || t === '-p' || t === '--style');
  const candidate =
    flagIdx >= 0
      ? String(tokens[flagIdx + 1] || '').toLowerCase()
      : tokens.length === 1
        ? String(tokens[0] || '').toLowerCase()
        : '';
  if (candidate === 'short' || candidate === 'dev' || candidate === 'executive' || candidate === 'mentor') {
    return candidate;
  }
  if (candidate === 'curto' || candidate === 'objetivo') return 'short';
  if (candidate === 'developer' || candidate === 'technical' || candidate === 'tecnico') return 'dev';
  if (candidate === 'executivo' || candidate === 'manager') return 'executive';
  if (candidate === 'teacher' || candidate === 'didatico') return 'mentor';
  return null;
}

export function buildExperienceCommand(body: Record<string, unknown>): Partial<ExperienceCommand> & { text: string } {
  const text = String(body.text || body.message || body.prompt || '').trim();
  const requestMetadata =
    body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
      ? (body.metadata as Record<string, unknown>)
      : {};
  const responseProfile =
    body.responseProfile === 'short' ||
    body.responseProfile === 'dev' ||
    body.responseProfile === 'executive' ||
    body.responseProfile === 'mentor'
      ? body.responseProfile
      : parseResponseProfileToken(text);
  const actionCardDecision =
    body.actionCardDecision && typeof body.actionCardDecision === 'object' && !Array.isArray(body.actionCardDecision)
      ? (body.actionCardDecision as ExperienceCommand['actionCardDecision'])
      : null;
  const diffDecision =
    body.diffDecision && typeof body.diffDecision === 'object' && !Array.isArray(body.diffDecision)
      ? (body.diffDecision as ExperienceCommand['diffDecision'])
      : null;
  const contextRecoveryDecision =
    body.contextRecoveryDecision &&
    typeof body.contextRecoveryDecision === 'object' &&
    !Array.isArray(body.contextRecoveryDecision)
      ? (body.contextRecoveryDecision as ExperienceCommand['contextRecoveryDecision'])
      : null;
  return {
    contractVersion: 'ExperienceCommand/v1',
    text,
    intent: typeof body.intent === 'string' ? (body.intent as ExperienceCommand['intent']) : 'ask',
    surface:
      body.surface === 'cli' || body.surface === 'telegram' || body.surface === 'discord' || body.surface === 'api'
        ? body.surface
        : 'web',
    userId: String(body.userId || body.requestedBy || 'control-ui').trim() || 'control-ui',
    sessionId: typeof body.sessionId === 'string' ? body.sessionId : null,
    workspace: typeof body.workspace === 'string' ? body.workspace : null,
    trustMode: typeof body.trustMode === 'string' ? (body.trustMode as ExperienceCommand['trustMode']) : 'protected',
    autonomyMode:
      body.autonomyMode === 'manual' || body.autonomyMode === 'speculative' || body.autonomyMode === 'governed'
        ? body.autonomyMode
        : 'governed',
    actionCardDecision,
    diffDecision,
    contextRecoveryDecision,
    responseProfile,
    metadata: {
      ...requestMetadata,
      requestedBy: body.requestedBy || 'control-ui',
      source: 'api/experience',
      responseProfile: responseProfile || undefined,
    },
  };
}

export async function resolveRouteParams<T extends Record<string, string>>(params: T | Promise<T>): Promise<T> {
  return await Promise.resolve(params);
}
