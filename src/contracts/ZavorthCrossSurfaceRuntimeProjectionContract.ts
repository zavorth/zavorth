import type {
  ZavorthToolOrchestrationVerificationInput,
  ZavorthToolOrchestrationVerificationSnapshot,
  ZavorthToolOrchestrationVerificationStatus,
  ZavorthToolRouteKind,
} from './ZavorthToolOrchestrationVerificationContract.js';

export const ZAVORTH_CROSS_SURFACE_RUNTIME_PROJECTION_CONTRACT_VERSION =
  '2026-05-11.cross-surface-runtime-projection-phase-5' as const;

export type ZavorthCrossSurfaceProjectionSurface =
  | 'cli'
  | 'telegram'
  | 'discord'
  | 'whatsapp'
  | 'signal'
  | 'imessage'
  | 'web'
  | 'api'
  | 'command_center';

export type ZavorthCrossSurfaceInteractionMode =
  | 'text'
  | 'buttons'
  | 'menu'
  | 'table'
  | 'json'
  | 'dashboard_projection';

export type ZavorthCrossSurfaceProjectionTone =
  | 'neutral'
  | 'success'
  | 'attention'
  | 'danger'
  | 'blocked';

export type ZavorthCrossSurfaceActionKind =
  | 'primary'
  | 'secondary'
  | 'approval'
  | 'setup'
  | 'verification'
  | 'blocked';

export type ZavorthCrossSurfaceRuntimeProjectionInput =
  ZavorthToolOrchestrationVerificationInput & {
    projectionSurfaces?: ZavorthCrossSurfaceProjectionSurface[] | null;
    compact?: boolean | null;
  };

export type ZavorthCrossSurfaceActionProjection = {
  id: string;
  surface: ZavorthCrossSurfaceProjectionSurface;
  kind: ZavorthCrossSurfaceActionKind;
  label: string;
  command: string;
  routeKinds: ZavorthToolRouteKind[];
  enabled: boolean;
  requiresApproval: boolean;
  reason: string;
};

export type ZavorthCrossSurfaceProjectionCard = {
  id: string;
  surface: ZavorthCrossSurfaceProjectionSurface;
  title: string;
  status: ZavorthToolOrchestrationVerificationStatus;
  tone: ZavorthCrossSurfaceProjectionTone;
  modes: ZavorthCrossSurfaceInteractionMode[];
  summary: string;
  metrics: Array<{
    label: string;
    value: string;
    tone: ZavorthCrossSurfaceProjectionTone;
  }>;
  lines: string[];
  actions: ZavorthCrossSurfaceActionProjection[];
  fallbackText: string;
  sameSemanticStatusAsRuntime: true;
};

export type ZavorthCrossSurfaceApiProjection = {
  jsonReady: true;
  noLiveActionExecuted: true;
  endpoints: Array<{
    method: 'GET' | 'POST';
    path: string;
    purpose: string;
    requiresApproval: boolean;
  }>;
  payloadShape: {
    status: ZavorthToolOrchestrationVerificationStatus;
    cards: 'ZavorthCrossSurfaceProjectionCard[]';
    receipts: 'ZavorthCrossSurfaceProjectionReceipt[]';
    safety: 'ZavorthCrossSurfaceProjectionSafety';
  };
};

export type ZavorthCommandCenterRuntimeProjection = {
  projectionId: string;
  title: string;
  statusPill: ZavorthToolOrchestrationVerificationStatus;
  visualMutationApplied: false;
  requiresOwnerApprovalForVisualChange: true;
  suggestedSlots: Array<'header_summary' | 'route_table' | 'actions_panel' | 'receipts_timeline' | 'channel_fallbacks'>;
  safeViewModelOnly: true;
};

export type ZavorthCrossSurfaceProjectionReceipt = {
  id: string;
  kind:
    | 'phase-5-cross-surface-projection'
    | 'surface-card'
    | 'channel-fallback'
    | 'api-projection'
    | 'command-center-view-model'
    | 'visual-change-boundary';
  surface: ZavorthCrossSurfaceProjectionSurface | 'all';
  status: 'recorded' | 'requires-verification' | 'requires-approval' | 'blocked';
  summary: string;
};

export type ZavorthCrossSurfaceProjectionSafety = {
  noDashboardVisualMutation: true;
  commandCenterIsViewModelOnly: true;
  noLiveActionExecuted: true;
  sameSemanticsAcrossSurfaces: true;
  telegramNotPrivileged: true;
  channelFallbacksRequired: true;
  rawSecretsSerialized: false;
};

export type ZavorthCrossSurfaceRuntimeProjectionSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_CROSS_SURFACE_RUNTIME_PROJECTION_CONTRACT_VERSION;
  source: 'ZavorthCrossSurfaceRuntimeProjectionService';
  phase: 'phase-5-cross-surface-runtime-projection';
  status: ZavorthToolOrchestrationVerificationStatus;
  request: {
    surface: string;
    actorId: string | null;
    textPreview: string;
    rawSecretsSerialized: false;
  };
  toolOrchestration: ZavorthToolOrchestrationVerificationSnapshot;
  surfaceCards: ZavorthCrossSurfaceProjectionCard[];
  apiProjection: ZavorthCrossSurfaceApiProjection;
  commandCenterProjection: ZavorthCommandCenterRuntimeProjection;
  channelFallbacks: Record<ZavorthCrossSurfaceProjectionSurface, string>;
  receipts: ZavorthCrossSurfaceProjectionReceipt[];
  safety: ZavorthCrossSurfaceProjectionSafety;
  summary: {
    surfaces: number;
    buttonSurfaces: number;
    fallbackSurfaces: number;
    actionCount: number;
    approvalActions: number;
    disabledActions: number;
    commandCenterVisualMutation: false;
  };
  commands: {
    report: 'npx tsx scripts/zavorth-cross-surface-runtime-projection.ts --text "<request>"';
    json: 'npx tsx scripts/zavorth-cross-surface-runtime-projection.ts --json --text "<request>"';
    check: 'node scripts/zavorth-cross-surface-runtime-projection-check.mjs';
    nextPhase: 'Phase 6 - Operational Rollout And Continuous Eval Assimilation';
  };
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
};
