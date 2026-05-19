import type { SurfaceResponse } from '../domain/surface/application/surface-response/index.js';
import type { ZavorthPerceptionInvocationPlan } from './ZavorthPerceptionInvocationContract.js';

export const ZAVORTH_PERCEPTION_CROSS_SURFACE_CERTIFICATION_VERSION =
  '2026-05-11.perception-cross-surface-checkpoint-6' as const;

export type ZavorthPerceptionCrossSurfaceStatus = 'passed' | 'attention' | 'blocked';

export type ZavorthPerceptionCrossSurfaceName =
  | 'cli'
  | 'web'
  | 'telegram'
  | 'discord'
  | 'whatsapp'
  | 'signal'
  | 'imessage';

export type ZavorthPerceptionProjectionTargetKind =
  | 'pc'
  | 'browser'
  | 'android'
  | 'device'
  | 'subagent';

export type ZavorthPerceptionCertificationScenarioId =
  | 'pc-screenshot'
  | 'browser-dom'
  | 'browser-screenshot'
  | 'adb-screenshot'
  | 'adb-ui-dump'
  | 'blocked-terminal-automation'
  | 'blocked-secrets-screen'
  | 'approval-required-tap-type-click'
  | 'cancel-pause'
  | 'receipts-retention';

export type ZavorthPerceptionSurfaceProjection = {
  surface: ZavorthPerceptionCrossSurfaceName;
  status: ZavorthPerceptionCrossSurfaceStatus;
  fallbackTextAvailable: true;
  interactiveActionsAvailable: boolean;
  commandCount: number;
  primaryCommands: string[];
  evidence: string;
};

export type ZavorthPerceptionCommandCenterTarget = {
  id: string;
  kind: ZavorthPerceptionProjectionTargetKind;
  label: string;
  status: ZavorthPerceptionCrossSurfaceStatus;
  activeObservation: boolean;
  pendingPlan: boolean;
  approvalRequired: boolean;
  artifactCount: number;
  lastScreenshotRef: string | null;
  commandHint: string;
};

export type ZavorthPerceptionCommandCenterProjection = {
  contractVersion: typeof ZAVORTH_PERCEPTION_CROSS_SURFACE_CERTIFICATION_VERSION;
  generatedAt: string;
  source: 'ZavorthPerceptionCrossSurfaceCertificationService';
  status: ZavorthPerceptionCrossSurfaceStatus;
  targets: ZavorthPerceptionCommandCenterTarget[];
  activeObservation: {
    route: string;
    targetKind: string;
    summary: string;
    readOnly: true;
  };
  pendingPlans: Array<{
    id: string;
    targetId: string;
    status: 'approval-required' | 'blocked' | 'planned';
    approvalRequired: boolean;
    commandHint: string;
  }>;
  approvals: Array<{
    id: string;
    targetId: string;
    reason: string;
    commandHint: string;
  }>;
  artifacts: Array<{
    id: string;
    targetId: string;
    kind: 'screenshot' | 'ui-dump' | 'dom' | 'pdf' | 'vision' | 'receipt';
    redacted: true;
    rawContentStored: false;
    retentionTtlMs: number;
    commandHint: string;
  }>;
  liveSafetyStatus: {
    liveCanaryDisabledByDefault: true;
    explicitApprovalRequired: true;
    mutationRequiresApproval: true;
    hardBlocksPreserved: true;
    noVisualMutationWithoutOwnerApproval: true;
  };
  surface: {
    apiPath: '/api/command-center/perception-control';
    commandCenterPath: '/control?sector=perception';
    channelCommand: '/vision status';
    cliCommand: 'node scripts/zavorth-perception-certification.ts';
    visualMutationApplied: false;
  };
  receipts: Array<{
    id: string;
    kind: 'target' | 'policy' | 'artifact' | 'surface' | 'certification';
    status: ZavorthPerceptionCrossSurfaceStatus;
    reason: string;
    rawSecretSerialized: false;
  }>;
};

export type ZavorthPerceptionCertificationMatrixRow = {
  id: ZavorthPerceptionCertificationScenarioId;
  label: string;
  status: ZavorthPerceptionCrossSurfaceStatus;
  evidence: string;
  commandHint: string;
};

export type ZavorthPerceptionCrossSurfaceCertificationSnapshot = {
  contractVersion: typeof ZAVORTH_PERCEPTION_CROSS_SURFACE_CERTIFICATION_VERSION;
  generatedAt: string;
  source: 'ZavorthPerceptionCrossSurfaceCertificationService';
  status: ZavorthPerceptionCrossSurfaceStatus;
  naturalPlan: ZavorthPerceptionInvocationPlan;
  surfaceResponse: SurfaceResponse;
  surfaceProjections: ZavorthPerceptionSurfaceProjection[];
  commandCenterProjection: ZavorthPerceptionCommandCenterProjection;
  certificationMatrix: ZavorthPerceptionCertificationMatrixRow[];
  liveCanary: {
    enabled: false;
    requiresExplicitFlag: true;
    requiresOwnerApproval: true;
    safeMockUsedForPhaseGate: true;
  };
  safety: {
    noWorkspaceMutation: true;
    noExternalIo: true;
    noRawSecretsSerialized: true;
    visualChangesRequireOwnerApproval: true;
    mutationStillRequiresApproval: true;
    canaryLiveOnlyWithExplicitApproval: true;
  };
  nextSafeAction: string;
};
