import {
  GATEWAY_SESSION_ROUTE_PATHS,
  LEGACY_GATEWAY_SESSION_ROUTE_ALIASES,
} from '../../../../../contracts/GatewayContract.js';
import {
  HYBRID_MEMORY_CONTRACT_VERSION,
  HYBRID_MEMORY_DEFAULT_CONTEXT_TOKEN_BUDGET,
  HYBRID_MEMORY_DEFAULT_TOP_K,
} from '../../../../../contracts/HybridMemoryContract.js';
import type { HybridMemoryRecallResult } from '../../../../../contracts/HybridMemoryContract.js';
import type { GatewayCanonicalStatePayload } from '../../../../../contracts/GatewayContract.js';
import { config } from '../../../../../config/index.js';
import { buildZavorthProductModeSnapshot } from '../../../../../services/ProductModeService.js';
import { ProductChannelExperienceService } from '../../../../../services/ProductChannelExperienceService.js';

const productChannelExperience = new ProductChannelExperienceService();

export type WebAppRuntimeLightweightState = {
  snapshot: Record<string, any> | null;
  agentRuntime: GatewayCanonicalStatePayload['agentRuntime'];
  productMode: GatewayCanonicalStatePayload['productMode'];
  modeEscalation: GatewayCanonicalStatePayload['modeEscalation'];
  uiSurfaceHints: GatewayCanonicalStatePayload['uiSurfaceHints'];
  gateway:
    | {
        generatedAt?: string;
        summary?: Record<string, any>;
        narrative?: Record<string, any>;
      }
    | null;
  session: GatewayCanonicalStatePayload['session'];
  memoryPlane:
    | {
        generatedAt?: string;
        summary?: Record<string, any>;
        narrative?: Record<string, any>;
      }
    | null;
  memoryRecall: GatewayCanonicalStatePayload['memoryRecall'];
  layeredMemory:
    | {
        generatedAt?: string;
        summary?: Record<string, any>;
        narrative?: Record<string, any>;
      }
    | null;
  layeredMemoryMetrics:
    | {
        generatedAt?: string;
        summary?: Record<string, any>;
        budgets?: Record<string, any>;
        procedures?: Record<string, any>;
      }
    | null;
  learningPlane:
    | {
        generatedAt?: string;
        summary?: Record<string, any>;
        narrative?: Record<string, any>;
      }
    | null;
  learningMetrics:
    | {
        generatedAt?: string;
        summary?: Record<string, any>;
        counts?: Record<string, any>;
      }
    | null;
  opsQuality:
    | {
        generatedAt?: string;
        score?: number;
        healthy?: boolean;
        summary?: Record<string, any>;
        operations?: Record<string, any>;
        learning?: Record<string, any>;
        memory?: Record<string, any>;
        platform?: Record<string, any>;
      }
    | null;
  controlPlane:
    | {
        generatedAt?: string;
        summary?: Record<string, any>;
        narrative?: Record<string, any>;
      }
    | null;
  sessionPlane: GatewayCanonicalStatePayload['sessionPlane'];
  gatewayRuntime: {
    generatedAt: string;
    auth: Record<string, any>;
    health: Record<string, any>;
    sessionBus: Record<string, any> | null;
  } | null;
};

export function buildWebAppRuntimeLightweightStateResponse(
  state: WebAppRuntimeLightweightState,
): Record<string, any> {
  const snapshot = state.snapshot
    ? {
        sessionId: state.snapshot.sessionId,
        chatId: state.snapshot.chatId,
        continuity: state.snapshot.continuity || null,
        tasks: Array.isArray(state.snapshot.tasks) ? state.snapshot.tasks : [],
        workflowRuns: Array.isArray(state.snapshot.workflowRuns) ? state.snapshot.workflowRuns : [],
        toolRuns: Array.isArray((state.snapshot as any).toolRuns) ? (state.snapshot as any).toolRuns : [],
        filesTouched: Array.from(new Set(
          Array.isArray((state.snapshot as any).toolRuns)
            ? (state.snapshot as any).toolRuns.flatMap((run: any) => Array.isArray(run?.filesTouched) ? run.filesTouched : [])
            : [],
        )),
        taskCount: Array.isArray(state.snapshot.tasks) ? state.snapshot.tasks.length : 0,
        toolRunCount: Array.isArray((state.snapshot as any).toolRuns) ? (state.snapshot as any).toolRuns.length : 0,
        pendingPermissions: Array.isArray(state.snapshot.permissions)
          ? state.snapshot.permissions.filter((entry: any) => entry?.status === 'pending').length
          : 0,
      }
    : null;
  const session = state.session
    ? {
        generatedAt: state.session.generatedAt,
        sessionId: state.session.sessionId,
        chatId: state.session.chatId,
        platform: state.session.platform,
        runtimeUserId: state.session.runtimeUserId,
        sourceUserId: state.session.sourceUserId,
        continuity: state.session.continuity || null,
        tasksCount: Array.isArray(state.session.tasks) ? state.session.tasks.length : 0,
        permissionsCount: Array.isArray(state.session.permissions) ? state.session.permissions.length : 0,
      }
    : null;
  return {
    ok: true,
    snapshot,
    agentRuntime: state.agentRuntime,
    productMode: state.productMode,
    modeEscalation: state.modeEscalation,
    uiSurfaceHints: state.uiSurfaceHints,
    gateway: state.gateway
      ? {
          generatedAt: state.gateway.generatedAt,
          summary: state.gateway.summary,
          narrative: state.gateway.narrative,
        }
      : null,
    session,
    controlPlane: state.controlPlane
      ? {
          generatedAt: state.controlPlane.generatedAt,
          summary: state.controlPlane.summary,
          narrative: state.controlPlane.narrative,
        }
      : null,
    learningPlane: state.learningPlane
      ? {
          generatedAt: state.learningPlane.generatedAt,
          summary: state.learningPlane.summary,
          narrative: state.learningPlane.narrative,
        }
      : null,
    learningMetrics: state.learningMetrics
      ? {
          generatedAt: state.learningMetrics.generatedAt,
          summary: state.learningMetrics.summary,
          counts: state.learningMetrics.counts,
        }
      : null,
    layeredMemory: state.layeredMemory
      ? {
          generatedAt: state.layeredMemory.generatedAt,
          summary: state.layeredMemory.summary,
          narrative: state.layeredMemory.narrative,
        }
      : null,
    layeredMemoryMetrics: state.layeredMemoryMetrics
      ? {
          generatedAt: state.layeredMemoryMetrics.generatedAt,
          summary: state.layeredMemoryMetrics.summary,
          budgets: state.layeredMemoryMetrics.budgets,
          procedures: state.layeredMemoryMetrics.procedures,
        }
      : null,
    opsQuality: state.opsQuality
      ? {
          generatedAt: state.opsQuality.generatedAt,
          score: state.opsQuality.score,
          healthy: state.opsQuality.healthy,
          summary: state.opsQuality.summary,
          operations: state.opsQuality.operations,
          learning: state.opsQuality.learning,
          memory: state.opsQuality.memory,
          platform: state.opsQuality.platform,
        }
      : null,
    memoryPlane: state.memoryPlane
      ? {
          generatedAt: state.memoryPlane.generatedAt,
          summary: state.memoryPlane.summary,
          narrative: state.memoryPlane.narrative,
        }
      : null,
    memoryRecall: state.memoryRecall,
    sessionPlane: state.sessionPlane,
    gatewayRuntime: state.gatewayRuntime
      ? {
          generatedAt: state.gatewayRuntime.generatedAt,
          auth: state.gatewayRuntime.auth,
          health: state.gatewayRuntime.health,
          sessionBus: state.gatewayRuntime.sessionBus,
        }
      : null,
  };
}

export function buildWebAppRuntimeProductMode(
  deps: {
    capabilityLifecycle?: {
      buildProductModeSnapshot?: () => GatewayCanonicalStatePayload['productMode'];
    } | null;
  },
): GatewayCanonicalStatePayload['productMode'] {
  if (deps.capabilityLifecycle?.buildProductModeSnapshot) {
    return deps.capabilityLifecycle.buildProductModeSnapshot();
  }
  return buildZavorthProductModeSnapshot(config.zavorthProductMode, config.zavorthProfile);
}

export function buildWebAppRuntimeRecallQueryFromSnapshot(snapshot: Record<string, any> | null | undefined): string {
  if (!snapshot || typeof snapshot !== 'object') {
    return '';
  }
  const messages = Array.isArray(snapshot.messages) ? snapshot.messages : [];
  for (const message of messages.slice().reverse()) {
    const role = String(message?.role || message?.source || message?.sender || '').trim().toLowerCase();
    const body = String(message?.text || message?.message || message?.content || message?.body || '').trim();
    if (body && (!role || role === 'user' || role === 'operator' || role === 'human')) {
      return body.slice(0, 500);
    }
  }
  const tasks = Array.isArray(snapshot.tasks) ? snapshot.tasks : [];
  const latestTask = tasks.slice().reverse().find((task: any) =>
    String(task?.summary || task?.title || task?.objective || task?.command || '').trim(),
  );
  if (latestTask) {
    return String(
      latestTask.summary
      || latestTask.title
      || latestTask.objective
      || latestTask.command
      || '',
    ).trim().slice(0, 500);
  }
  return String(
    snapshot.continuity?.suggestedAction?.prompt
    || snapshot.handoff?.handoffPrompt
    || snapshot.continuity?.summary
    || '',
  ).trim().slice(0, 500);
}

export function buildWebAppRuntimeEmptyMemoryRecall(
  sessionId: string,
  query: string,
  warnings: string[],
): HybridMemoryRecallResult {
  return {
    ok: true,
    contractVersion: HYBRID_MEMORY_CONTRACT_VERSION,
    generatedAt: new Date().toISOString(),
    sessionId,
    query,
    mode: 'ledger_only',
    embeddingStatus: 'not_configured',
    budget: {
      topK: HYBRID_MEMORY_DEFAULT_TOP_K,
      contextTokenBudget: HYBRID_MEMORY_DEFAULT_CONTEXT_TOKEN_BUDGET,
      estimatedTokens: 0,
    },
    summary: {
      total: 0,
      ledger: 0,
      recall: 0,
      returned: 0,
      ledgerAuthoritative: true,
    },
    sources: [],
    context: '',
    warnings,
    commands: {
      preview: 'memory.recall.preview',
      sources: 'memory.sources.list',
      httpPreview: '/api/web/memory/recall',
      httpSources: '/api/web/memory/sources',
    },
  };
}

export function buildWebAppRuntimeUiSurfaceHints(
  productMode: GatewayCanonicalStatePayload['productMode'],
  input: {
    localControlEntry: string;
    localControlReady: boolean;
    telegramReady: boolean;
    discordReady: boolean;
    cliReady: boolean;
  },
): GatewayCanonicalStatePayload['uiSurfaceHints'] {
  return productChannelExperience.buildSnapshot({
    productMode,
    controlEntry: input.localControlEntry,
    controlReady: input.localControlReady,
    telegramReady: input.telegramReady,
    discordReady: input.discordReady,
    cliEntry: 'npm run cli -- status',
    cliReady: input.cliReady,
  });
}

export function readWebAppRuntimeChannelReadiness(
  companionPlane: Record<string, any> | null,
  resourcePlane: Record<string, any> | null,
  channelId: 'telegram' | 'discord',
): boolean {
  const companionWarnings = Array.isArray(companionPlane?.warnings) ? companionPlane.warnings : [];
  const resourceWarnings = Array.isArray(resourcePlane?.warnings) ? resourcePlane.warnings : [];
  if (channelId === 'telegram') {
    return !companionWarnings.some((entry) => String(entry || '').toLowerCase().includes('telegram'));
  }
  return !resourceWarnings.some((entry) => String(entry || '').toLowerCase().includes('discord'))
    && !companionWarnings.some((entry) => String(entry || '').toLowerCase().includes('discord'));
}

export function isWebAppRuntimeCanonicalSessionPlaneRoute(pathname: string): boolean {
  return pathname === GATEWAY_SESSION_ROUTE_PATHS.plane
    || LEGACY_GATEWAY_SESSION_ROUTE_ALIASES.plane.includes(pathname as typeof LEGACY_GATEWAY_SESSION_ROUTE_ALIASES.plane[number]);
}

export function isWebAppRuntimeCanonicalSessionSendRoute(pathname: string): boolean {
  return pathname === GATEWAY_SESSION_ROUTE_PATHS.send
    || LEGACY_GATEWAY_SESSION_ROUTE_ALIASES.send.includes(pathname as typeof LEGACY_GATEWAY_SESSION_ROUTE_ALIASES.send[number]);
}

export function isWebAppRuntimeCanonicalSessionSpawnRoute(pathname: string): boolean {
  return pathname === GATEWAY_SESSION_ROUTE_PATHS.spawn
    || LEGACY_GATEWAY_SESSION_ROUTE_ALIASES.spawn.includes(pathname as typeof LEGACY_GATEWAY_SESSION_ROUTE_ALIASES.spawn[number]);
}

export function isWebAppRuntimeCanonicalSessionCompactRoute(pathname: string): boolean {
  return pathname === GATEWAY_SESSION_ROUTE_PATHS.compact
    || LEGACY_GATEWAY_SESSION_ROUTE_ALIASES.compact.includes(pathname as typeof LEGACY_GATEWAY_SESSION_ROUTE_ALIASES.compact[number]);
}

export function resolveWebAppRuntimeCanonicalSessionCommand(pathname: string): string | null {
  const commandRoutes: Array<[string, readonly string[]]> = [
    ['command', LEGACY_GATEWAY_SESSION_ROUTE_ALIASES.command],
    ['status', LEGACY_GATEWAY_SESSION_ROUTE_ALIASES.status],
    ['usage', LEGACY_GATEWAY_SESSION_ROUTE_ALIASES.usage],
    ['model', LEGACY_GATEWAY_SESSION_ROUTE_ALIASES.model],
    ['models', LEGACY_GATEWAY_SESSION_ROUTE_ALIASES.models],
    ['profile', LEGACY_GATEWAY_SESSION_ROUTE_ALIASES.profile],
    ['tools', LEGACY_GATEWAY_SESSION_ROUTE_ALIASES.tools],
    ['skills', LEGACY_GATEWAY_SESSION_ROUTE_ALIASES.skills],
    ['agents', LEGACY_GATEWAY_SESSION_ROUTE_ALIASES.agents],
    ['whoami', LEGACY_GATEWAY_SESSION_ROUTE_ALIASES.whoami],
    ['context', LEGACY_GATEWAY_SESSION_ROUTE_ALIASES.context],
    ['plan-review', LEGACY_GATEWAY_SESSION_ROUTE_ALIASES['plan-review']],
    ['brief-reply', LEGACY_GATEWAY_SESSION_ROUTE_ALIASES['brief-reply']],
    ['test-loop', LEGACY_GATEWAY_SESSION_ROUTE_ALIASES['test-loop']],
  ];
  for (const [command, aliases] of commandRoutes) {
    const canonicalPath = (GATEWAY_SESSION_ROUTE_PATHS as Record<string, string>)[command];
    if (pathname === canonicalPath || aliases.includes(pathname)) {
      return command;
    }
  }
  return null;
}

export function isWebAppRuntimeFullDetailRequested(url: URL): boolean {
  const detail = String(url.searchParams.get('detail') || '').trim().toLowerCase();
  return detail === 'full' || detail === 'resolved' || detail === 'hydrated';
}

