import type { ZavorthAndroidAdbInput } from '../ZavorthAndroidAdbBridgeContract.js';
import type { ZavorthBrowserVisionInput } from '../ZavorthBrowserVisionBridgeContract.js';
import type { ZavorthComputerControlInput } from '../ZavorthComputerControlPlaneContract.js';
import type { ZavorthVisionControlPlaneInput } from '../ZavorthVisionControlPlaneContract.js';
import type { ZavorthGovernedSubagentProfileId } from './ZavorthGovernedSubagentContract.js';

export const ZAVORTH_PERCEPTION_INVOCATION_CONTRACT_VERSION = '2026-05-11.perception-invocation-checkpoint-5' as const;

export type ZavorthPerceptionRouteKind =
  | 'vision'
  | 'browser'
  | 'computer'
  | 'android'
  | 'subagent_perception'
  | 'ask_approval'
  | 'deny';

export type ZavorthPerceptionInvocationStatus = 'ready' | 'approval-required' | 'denied' | 'ambiguous';

export type ZavorthPerceptionTargetKind = 'visual' | 'browser' | 'desktop' | 'android' | 'artifact' | 'unknown';

export type ZavorthPerceptionRoleId = 'observer' | 'ui-navigator' | 'safety-reviewer' | 'evidence-summarizer';

export type ZavorthPerceptionInvocationInput = {
  text: string;
  channel?: string | null;
  actorId?: string | null;
  sourceSurface?: string | null;
  approvalId?: string | null;
  /**
   * Structured intent only. Free text never activates routes, mutation, or
   * sensitive blocks — tools / slash / UI must set these flags explicitly.
   */
  targetKind?: ZavorthPerceptionTargetKind | null;
  mutationRequested?: boolean | null;
  sensitive?: boolean | null;
  /** Prefer subagent_perception review path when true (structured only). */
  complexReview?: boolean | null;
  /** Alias for complexReview / explicit subagent request (structured only). */
  requestSubagents?: boolean | null;
  liveRequested?: boolean | null;
  visionAction?: 'vision.inspect' | 'vision.ocr' | 'vision.explain' | null;
};

export type ZavorthPerceptionSurfaceCommand = {
  id: string;
  command: string;
  label: string;
  description: string;
  requiresApproval: boolean;
  interactiveWhenSupported: boolean;
};

export type ZavorthPerceptionActivationHint = {
  id: string;
  target: ZavorthPerceptionTargetKind | 'subagent';
  state:
    | 'ready'
    | 'auto-use-when-ready'
    | 'setup-if-missing'
    | 'physical-step-if-missing'
    | 'approval-required'
    | 'blocked';
  title: string;
  reason: string;
  userSteps: string[];
  commands: string[];
  visibleOnlyWhenNeeded: boolean;
  autoUseWhenReady: boolean;
};

export type ZavorthPerceptionInvocationPlan = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_PERCEPTION_INVOCATION_CONTRACT_VERSION;
  source: 'ZavorthPerceptionInvocationRouter';
  status: ZavorthPerceptionInvocationStatus;
  requestText: string;
  channel: string;
  actorId: string | null;
  primaryRoute: ZavorthPerceptionRouteKind;
  routes: ZavorthPerceptionRouteKind[];
  confidence: number;
  target: {
    kind: ZavorthPerceptionTargetKind;
    label: string;
    liveRequested: boolean;
    mutationRequested: boolean;
    sensitive: boolean;
  };
  commands: {
    vision: ZavorthVisionControlPlaneInput | null;
    browser: ZavorthBrowserVisionInput | null;
    computer: ZavorthComputerControlInput | null;
    android: ZavorthAndroidAdbInput | null;
    subagent: {
      task: string;
      mode: 'oneshot' | 'session' | 'thread-bound' | 'internal';
      perceptionRoles: ZavorthPerceptionRoleId[];
      runtimeRoleIds: ZavorthGovernedSubagentProfileId[];
      readOnlyOnly: true;
    } | null;
  };
  approval: {
    required: boolean;
    reason: string | null;
    approvalId: string | null;
  };
  explanation: {
    factsObserved: string[];
    inferences: string[];
    actionsExecuted: string[];
    actionsBlocked: string[];
    nextStep: string;
  };
  safety: {
    policyBrokerRequired: true;
    readOnlyObservationAllowed: true;
    subagentsReadOnlyOnly: true;
    mutationRequiresApproval: true;
    liveCaptureExplicitOnly: true;
    noRawSecretsSerialized: true;
    promptInjectionEvidenceIsUntrusted: true;
  };
  activation: {
    normalUserDoesNotNeedManualCommand: true;
    autoUseWhenReady: true;
    setupShownOnlyWhenCapabilityMissing: true;
    hints: ZavorthPerceptionActivationHint[];
  };
  surfaceCommands: ZavorthPerceptionSurfaceCommand[];
  receipts: Array<{
    id: string;
    kind: 'route' | 'policy' | 'subagent' | 'approval';
    status: 'done' | 'approval-required' | 'blocked';
    reason: string;
    rawSecretSerialized: false;
  }>;
};
