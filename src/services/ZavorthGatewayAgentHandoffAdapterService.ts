import {
  ZAVORTH_AGENT_GATEWAY_HANDOFF_VERSION,
  type ZavorthAgentGatewayConvergenceChecklistItem,
  type ZavorthAgentGatewayHandoffContext,
  type ZavorthAgentGatewayHandoffSnapshot,
  type ZavorthAgentGatewayPlaneHandoff,
  type ZavorthAgentGatewayPlaneStatus,
} from '../contracts/ZavorthAgentGatewayHandoffContract.js';
import type {
  ZavorthGatewayService,
  ZavorthGatewaySnapshot,
  ZavorthGatewayShellSnapshot,
} from './ZavorthGatewayService.js';
import type {
  ZavorthGatewayRuntimeHealthSnapshot,
  ZavorthGatewayRuntimeService,
  ZavorthGatewayRuntimeSnapshot,
} from './ZavorthGatewayRuntimeService.js';

export type ZavorthGatewayAgentHandoffGatewayReader =
  Pick<ZavorthGatewayService, 'buildShellSnapshot'>
  & Partial<Pick<ZavorthGatewayService, 'buildHydratedSnapshot' | 'buildSnapshot'>>;

export type ZavorthGatewayAgentHandoffRuntimeReader =
  Pick<ZavorthGatewayRuntimeService, 'buildHealthSnapshot'>
  & Partial<Pick<ZavorthGatewayRuntimeService, 'buildCanonicalSnapshot'>>;

export type ZavorthGatewayAgentHandoffAdapterInput = {
  gateway?: ZavorthGatewayAgentHandoffGatewayReader | null;
  runtime?: ZavorthGatewayAgentHandoffRuntimeReader | null;
  now?: () => Date;
};

type GatewayHandoffSnapshot = ZavorthGatewaySnapshot | ZavorthGatewayShellSnapshot | null;

const DEFAULT_GUARDRAILS = [
  'Do not fuse ingress, reply, or context ownership into the new agent loop in this wave.',
  'Do not replace ZavorthGatewayRuntimeService ownership while the larger agent loop refactor is pending.',
  'Keep legacy compatibility bounded to existing compat adapters; do not make it the new canonical surface.',
  'Preserve useful provider, storage, proxy, SSE, and session capabilities during convergence.',
  'Keep CoreOrchestrator and SurfaceTaskDispatchService as legacy pass-through boundaries until one ingress is migrated behind the existing ZavorthAgentGateway.',
];

const DEFAULT_NEXT_INTEGRATION_STEPS = [
  'Wire ZavorthAgentGateway against this handoff snapshot during the larger agent loop refactor.',
  'Map agent-loop ingress and reply contracts to GatewayContract without changing the gateway transport surface in this wave.',
  'Use CoreOrchestrator -> SurfaceTaskDispatchService as the current legacy pass-through equivalent; migrate only one guarded entrypoint into the existing ZavorthAgentGateway.',
  'Decide final ownership for session context, tool replies, and runtime health in the agent loop architecture patch train.',
  'Replace temporary handoff adapter usage after ZavorthAgentGateway becomes the canonical runtime integration point.',
];

export class ZavorthGatewayAgentHandoffAdapterService {
  private readonly gateway: ZavorthGatewayAgentHandoffGatewayReader | null;
  private readonly runtime: ZavorthGatewayAgentHandoffRuntimeReader | null;
  private readonly now: () => Date;

  constructor(input: ZavorthGatewayAgentHandoffAdapterInput = {}) {
    this.gateway = input.gateway || null;
    this.runtime = input.runtime || null;
    this.now = input.now || (() => new Date());
  }

  public async buildHandoffSnapshot(
    context: ZavorthAgentGatewayHandoffContext = {},
  ): Promise<ZavorthAgentGatewayHandoffSnapshot> {
    const blockers: string[] = [];
    const normalizedContext = this.normalizeContext(context);
    const runtimeHealth = this.readRuntimeHealth(blockers);
    const runtime = await this.readRuntimeSnapshot(normalizedContext, blockers);
    const gateway = await this.readGatewaySnapshot(normalizedContext, runtime?.gateway || null, blockers);
    const planes = this.buildPlaneHandoffs({
      gateway,
      runtime,
      runtimeHealth,
    });
    const checklist = this.buildChecklist({
      gateway,
      runtime,
      runtimeHealth,
      planes,
    });
    const allBlockers = this.unique([
      ...blockers,
      ...planes.flatMap((plane) => plane.status === 'blocked' ? plane.risks : []),
      ...checklist.flatMap((item) => item.status === 'blocked' ? [item.description] : []),
    ].filter(Boolean));

    return {
      version: ZAVORTH_AGENT_GATEWAY_HANDOFF_VERSION,
      generatedAt: this.now().toISOString(),
      phase: allBlockers.length > 0 ? 'blocked' : 'prepared',
      context: normalizedContext,
      gateway,
      runtime,
      runtimeHealth,
      planes,
      checklist,
      blockers: allBlockers,
      nextIntegrationSteps: DEFAULT_NEXT_INTEGRATION_STEPS.slice(),
      guardrails: DEFAULT_GUARDRAILS.slice(),
    };
  }

  private readRuntimeHealth(blockers: string[]): ZavorthGatewayRuntimeHealthSnapshot | null {
    if (!this.runtime) {
      blockers.push('ZavorthGatewayRuntimeService reader was not provided for the handoff adapter.');
      return null;
    }

    try {
      const health = this.runtime.buildHealthSnapshot();
      if (Array.isArray(health.issues) && health.issues.length > 0) {
        blockers.push(...health.issues);
      }
      return health;
    } catch (error) {
      blockers.push(`Unable to read gateway runtime health: ${this.errorMessage(error)}`);
      return null;
    }
  }

  private async readRuntimeSnapshot(
    context: ZavorthAgentGatewayHandoffContext,
    blockers: string[],
  ): Promise<ZavorthGatewayRuntimeSnapshot | null> {
    if (!this.runtime?.buildCanonicalSnapshot) {
      return null;
    }

    try {
      return await this.runtime.buildCanonicalSnapshot({
        sessionId: context.sessionId,
        chatId: context.chatId,
        userId: context.userId,
        workspaceHint: context.workspaceHint,
        hydrated: context.hydrated,
      });
    } catch (error) {
      blockers.push(`Unable to read canonical gateway runtime snapshot: ${this.errorMessage(error)}`);
      return null;
    }
  }

  private async readGatewaySnapshot(
    context: ZavorthAgentGatewayHandoffContext,
    fallback: GatewayHandoffSnapshot,
    blockers: string[],
  ): Promise<GatewayHandoffSnapshot> {
    if (!this.gateway) {
      if (fallback) {
        return fallback;
      }
      blockers.push('ZavorthGatewayService reader was not provided for the handoff adapter.');
      return null;
    }

    try {
      if (context.hydrated && this.hasSessionContext(context) && this.gateway.buildHydratedSnapshot) {
        return await this.gateway.buildHydratedSnapshot(context);
      }

      if (this.gateway.buildShellSnapshot) {
        return this.gateway.buildShellSnapshot(context);
      }

      if (this.gateway.buildSnapshot) {
        return this.gateway.buildSnapshot(context);
      }

      return fallback;
    } catch (error) {
      blockers.push(`Unable to read gateway snapshot: ${this.errorMessage(error)}`);
      return fallback;
    }
  }

  private buildPlaneHandoffs(input: {
    gateway: GatewayHandoffSnapshot;
    runtime: ZavorthGatewayRuntimeSnapshot | null;
    runtimeHealth: ZavorthGatewayRuntimeHealthSnapshot | null;
  }): ZavorthAgentGatewayPlaneHandoff[] {
    const runtimeHealth = input.runtimeHealth;
    const gatewayReady = Boolean(input.gateway);
    const runtimeReady = runtimeHealth?.status === 'ready';
    const runtimePartial = runtimeHealth?.status === 'partial';
    const runtimeAvailable = Boolean(runtimeHealth);
    const apiSurfaceStatus: ZavorthAgentGatewayPlaneStatus = input.runtime?.controlPlane
      ? 'ready'
      : runtimeAvailable
        ? 'partial'
        : 'blocked';

    return [
      {
        id: 'gateway-core',
        label: 'Gateway core snapshots',
        status: gatewayReady ? 'ready' : 'blocked',
        owner: 'ai-gateway',
        sourceFiles: [
          'src/services/ZavorthGatewayService.ts',
          'src/contracts/GatewayContract.ts',
        ],
        capabilities: [
          'Gateway shell and hydrated snapshots',
          'Domain summary snapshots',
          'Control-plane narrative for web and runtime surfaces',
        ],
        integrationContract: 'ZavorthGatewaySnapshot | ZavorthGatewayShellSnapshot',
        compatibilityBoundary: null,
        nextIntegrationSteps: [
          'Let ZavorthAgentGateway consume gateway snapshots through this handoff contract.',
          'Keep snapshot composition in ZavorthGatewayService until the agent loop refactor owns runtime orchestration.',
        ],
        risks: gatewayReady ? [] : ['Gateway snapshot source is unavailable.'],
      },
      {
        id: 'legacy-pass-through-plane',
        label: 'Legacy pass-through ingress',
        status: 'ready',
        owner: 'shared',
        sourceFiles: [
          'src/core/CoreOrchestrator.ts',
          'src/services/SurfaceTaskDispatchService.ts',
          'src/telegram/bot-gateway/support/BotGatewayMessageProcessing.ts',
          'src/runtime/agent/ZavorthAgentGateway.ts',
        ],
        capabilities: [
          'CoreOrchestrator preserves the existing shared dispatcher path for legacy text ingress',
          'SurfaceTaskDispatchService owns task-controller delegation and identity linking',
          'Telegram natural requests can already enter the existing ZavorthAgentGateway before legacy fallback',
        ],
        integrationContract: 'IMessageContext + SurfaceTaskDispatcherLike + ZavorthAgentGateway.handle',
        compatibilityBoundary: 'Legacy pass-through remains a boundary; do not create a second agent gateway to bridge it.',
        nextIntegrationSteps: [
          'Choose one legacy ingress before adapting CoreOrchestrator or SurfaceTaskDispatchService.',
          'Route that ingress behind the existing ZavorthAgentGateway only after behavior parity is covered by tests.',
        ],
        risks: [],
      },
      {
        id: 'compatible-api-surface',
        label: 'Compatible API and session routes',
        status: apiSurfaceStatus,
        owner: 'shared',
        sourceFiles: [
          'src/contracts/GatewayContract.ts',
          'src/services/ZavorthGatewayRuntimeService.ts',
          'src/services/ZavorthGatewayControlSocketService.ts',
        ],
        capabilities: [
          'Canonical web state route names',
          'Send, spawn, history, SSE, and websocket path descriptors',
          'Reconnect policy for reusable session state',
        ],
        integrationContract: 'GatewayContract + ZavorthGatewayRuntimeSnapshot.controlPlane',
        compatibilityBoundary: 'Legacy route aliases remain aliases only, not canonical agent loop contracts.',
        nextIntegrationSteps: [
          'Map agent-loop transport selection to GatewayContract route constants.',
          'Keep route alias handling below the gateway API surface.',
        ],
        risks: apiSurfaceStatus === 'blocked' ? ['Runtime control-plane routes are unavailable.'] : [],
      },
      {
        id: 'provider-auth-plane',
        label: 'Provider auth plane',
        status: runtimeHealth?.authEnabled ? 'ready' : runtimeAvailable ? 'partial' : 'blocked',
        owner: 'ai-gateway',
        sourceFiles: [
          'src/services/DashboardAuthService.ts',
          'src/ai-gateway/lib/oauth/authPlane.ts',
        ],
        capabilities: [
          'Dashboard auth status',
          'Provider OAuth handoff boundaries',
          'Zavorth-native auth environment naming',
        ],
        integrationContract: 'ZavorthGatewayRuntimeSnapshot.auth',
        compatibilityBoundary: 'Legacy OAuth aliases are isolated in the auth plane adapter.',
        nextIntegrationSteps: [
          'Have ZavorthAgentGateway depend on runtime auth status, not provider-specific legacy names.',
        ],
        risks: runtimeHealth?.authEnabled
          ? []
          : ['Auth status is disabled or unavailable for the runtime handoff.'],
      },
      {
        id: 'storage-plane',
        label: 'Storage plane',
        status: 'ready',
        owner: 'ai-gateway',
        sourceFiles: [
          'src/ai-gateway/lib/db/storagePlane.ts',
          'src/ai-gateway/lib/db/jsonBackupAdapters.ts',
        ],
        capabilities: [
          'Zavorth migration ledger naming',
          'Zavorth JSON backup metadata',
          'Legacy storage compatibility isolated behind adapters',
        ],
        integrationContract: 'Storage remains behind gateway service snapshots during convergence.',
        compatibilityBoundary: 'Old migration and backup identifiers are compatibility aliases only.',
        nextIntegrationSteps: [
          'Keep storage reads behind gateway services until the agent loop architecture defines ownership.',
        ],
        risks: [],
      },
      {
        id: 'proxy-transport-plane',
        label: 'Proxy and SSE transport plane',
        status: 'ready',
        owner: 'ai-gateway',
        sourceFiles: [
          'src/ai-gateway/mitm/proxyPlane.cjs',
          'src/ai-gateway/sse/transportPlane.ts',
          'src/ai-gateway/sse/compat/openSseCompat.ts',
        ],
        capabilities: [
          'Zavorth-native proxy environment names',
          'Zavorth no-cache and request-source headers',
          'Bounded SSE compatibility import boundary',
        ],
        integrationContract: 'Gateway runtime exposes transport paths; transport internals remain below ai-gateway.',
        compatibilityBoundary: 'Open SSE compatibility is isolated in src/ai-gateway/sse/compat/openSseCompat.ts.',
        nextIntegrationSteps: [
          'Let the agent loop select transport through runtime control-plane descriptors instead of MITM internals.',
        ],
        risks: [],
      },
      {
        id: 'session-control-plane',
        label: 'Session control plane',
        status: runtimeReady || runtimePartial
          ? runtimeHealth?.sessionPlaneAvailable ? 'ready' : 'partial'
          : 'blocked',
        owner: 'shared',
        sourceFiles: [
          'src/services/ZavorthGatewayRuntimeService.ts',
          'src/services/ZavorthGatewayControlSocketService.ts',
          'src/runtime/sessions/GatewaySessionService.ts',
        ],
        capabilities: [
          'Session bus snapshot',
          'Gateway session send and spawn descriptors',
          'Control websocket event stream',
        ],
        integrationContract: 'ZavorthGatewayRuntimeSnapshot.sessionBus + GatewayCanonicalStatePayload',
        compatibilityBoundary: 'Do not move ingress/reply/context ownership in Wave 5.',
        nextIntegrationSteps: [
          'During the agent loop refactor, map session ownership to ZavorthAgentGateway before moving reply routing.',
        ],
        risks: runtimeHealth?.sessionPlaneAvailable
          ? []
          : ['Session plane is not fully attached to the gateway runtime yet.'],
      },
      {
        id: 'observability-plane',
        label: 'Runtime health and observability plane',
        status: runtimeHealth?.operationsAttached ? 'ready' : runtimeAvailable ? 'partial' : 'blocked',
        owner: 'shared',
        sourceFiles: [
          'src/services/ZavorthGatewayRuntimeService.ts',
          'src/observability/OperationsHealthService.ts',
        ],
        capabilities: [
          'Runtime attachment health',
          'Gateway availability health',
          'Operations readiness issues for convergence gating',
        ],
        integrationContract: 'ZavorthGatewayRuntimeHealthSnapshot',
        compatibilityBoundary: null,
        nextIntegrationSteps: [
          'Use runtime health blockers as explicit gates for ZavorthAgentGateway convergence.',
        ],
        risks: runtimeHealth?.operationsAttached
          ? []
          : ['Operations health is not attached to the gateway runtime handoff.'],
      },
    ];
  }

  private buildChecklist(input: {
    gateway: GatewayHandoffSnapshot;
    runtime: ZavorthGatewayRuntimeSnapshot | null;
    runtimeHealth: ZavorthGatewayRuntimeHealthSnapshot | null;
    planes: ZavorthAgentGatewayPlaneHandoff[];
  }): ZavorthAgentGatewayConvergenceChecklistItem[] {
    const hasBlockedPlane = input.planes.some((plane) => plane.status === 'blocked');

    return [
      {
        id: 'handoff-contract-defined',
        status: 'ready',
        owner: 'gateway',
        description: 'Typed handoff contract exists for ZavorthAgentGateway consumption.',
        evidence: [
          'src/contracts/ZavorthAgentGatewayHandoffContract.ts',
          ZAVORTH_AGENT_GATEWAY_HANDOFF_VERSION,
        ],
      },
      {
        id: 'temporary-adapter-defined',
        status: 'ready',
        owner: 'gateway',
        description: 'Temporary adapter can assemble convergence handoff snapshots without wiring the agent loop.',
        evidence: [
          'src/services/ZavorthGatewayAgentHandoffAdapterService.ts',
        ],
      },
      {
        id: 'gateway-snapshot-available',
        status: input.gateway ? 'ready' : 'blocked',
        owner: 'gateway',
        description: 'Gateway snapshot source is available to the handoff adapter.',
        evidence: input.gateway
          ? ['ZavorthGatewayService snapshot returned successfully.']
          : ['No gateway snapshot was returned.'],
      },
      {
        id: 'runtime-health-gated',
        status: input.runtimeHealth ? input.runtimeHealth.status === 'degraded' ? 'blocked' : 'ready' : 'blocked',
        owner: 'shared',
        description: 'Runtime health is visible and can gate the larger convergence work.',
        evidence: input.runtimeHealth
          ? [input.runtimeHealth.summary]
          : ['No runtime health snapshot was returned.'],
      },
      {
        id: 'canonical-runtime-snapshot-visible',
        status: input.runtime ? 'ready' : 'pending',
        owner: 'shared',
        description: 'Canonical runtime snapshot is visible for the agent loop architecture patch train.',
        evidence: input.runtime
          ? ['ZavorthGatewayRuntimeService.buildCanonicalSnapshot returned a snapshot.']
          : ['Runtime snapshot can remain pending when only the static handoff contract is being prepared.'],
      },
      {
        id: 'compat-boundaries-isolated',
        status: hasBlockedPlane ? 'blocked' : 'ready',
        owner: 'gateway',
        description: 'Compatibility boundaries are named and isolated before the larger loop refactor starts.',
        evidence: [
          'src/ai-gateway/lib/oauth/authPlane.ts',
          'src/ai-gateway/lib/db/storagePlane.ts',
          'src/ai-gateway/mitm/proxyPlane.cjs',
          'src/ai-gateway/sse/compat/openSseCompat.ts',
        ],
      },
      {
        id: 'agent-loop-fusion-deferred',
        status: 'pending',
        owner: 'agent-loop',
        description: 'Deep ZavorthAgentGateway fusion is intentionally deferred to the larger agent loop architecture plan.',
        evidence: [
          'zavorth_defork_plan.md Wave 5 forbids refactoring ingress/reply/context in this wave.',
        ],
      },
      {
        id: 'legacy-pass-through-equivalents-mapped',
        status: 'ready',
        owner: 'shared',
        description: 'P0-003b mapped the current legacy pass-through equivalents before any gateway wiring change.',
        evidence: [
          'src/core/CoreOrchestrator.ts',
          'src/services/SurfaceTaskDispatchService.ts',
          'src/telegram/bot-gateway/support/BotGatewayMessageProcessing.ts',
          'src/runtime/agent/ZavorthAgentGateway.ts',
        ],
      },
      {
        id: 'single-entrypoint-wiring-gate',
        status: 'pending',
        owner: 'shared',
        description: 'P0-003c keeps real wiring pending until one legacy entrypoint is explicitly selected and parity-tested.',
        evidence: [
          'CoreOrchestrator and SurfaceTaskDispatchService remain legacy pass-through boundaries.',
          'Telegram natural requests already use the existing ZavorthAgentGateway selectively before legacy fallback.',
          'No second gateway or runtime bridge should be created to satisfy this gate.',
        ],
      },
    ];
  }

  private normalizeContext(context: ZavorthAgentGatewayHandoffContext): ZavorthAgentGatewayHandoffContext {
    return {
      sessionId: this.cleanOptional(context.sessionId),
      chatId: this.cleanOptional(context.chatId),
      userId: this.cleanOptional(context.userId),
      workspaceHint: this.cleanOptional(context.workspaceHint),
      hydrated: Boolean(context.hydrated),
    };
  }

  private hasSessionContext(context: ZavorthAgentGatewayHandoffContext): boolean {
    return Boolean(
      this.cleanOptional(context.sessionId)
      && this.cleanOptional(context.chatId)
      && this.cleanOptional(context.userId),
    );
  }

  private cleanOptional(value: string | null | undefined): string | null {
    const normalized = String(value || '').trim();
    return normalized || null;
  }

  private unique(values: string[]): string[] {
    return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
