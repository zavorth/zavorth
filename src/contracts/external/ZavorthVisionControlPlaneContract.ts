export const ZAVORTH_VISION_CONTROL_PLANE_CONTRACT_VERSION =
  '2026-05-11.vision-control-plane-gate-1' as const;

export type ZavorthVisionControlPlaneAction =
  | 'vision.status'
  | 'vision.inspect'
  | 'vision.explain'
  | 'vision.capture'
  | 'vision.ocr'
  | 'vision.redact'
  | 'vision.summarize';

export type ZavorthVisionTargetKind =
  | 'desktop'
  | 'browser'
  | 'android'
  | 'device'
  | 'artifact'
  | 'unknown';

export type ZavorthVisionSensitivity =
  | 'low'
  | 'medium'
  | 'high'
  | 'secret';

export type ZavorthVisionPolicyDecision =
  | 'allow_readonly'
  | 'allow_with_redaction'
  | 'require_user_confirmation'
  | 'require_owner_approval'
  | 'require_admin_policy'
  | 'deny';

export type ZavorthVisionControlPlaneInput = {
  action?: ZavorthVisionControlPlaneAction;
  targetKind?: ZavorthVisionTargetKind;
  targetRef?: string | null;
  sourceSurface?: string | null;
  actorId?: string | null;
  observationText?: string | null;
  ocrText?: string | null;
  artifactPath?: string | null;
  artifactMime?: string | null;
  requestedByNaturalLanguage?: boolean;
  retentionTtlMs?: number | null;
};

export type ZavorthVisionArtifactRef = {
  id: string;
  kind: ZavorthVisionTargetKind;
  mime: string;
  displayName: string;
  hash: string;
  rawContentStored: false;
  redactedBeforeProvider: true;
  retentionTtlMs: number;
};

export type ZavorthVisionObservation = {
  id: string;
  kind: 'observation' | 'ocr' | 'summary' | 'risk';
  text: string;
  untrustedContentWrapped: true;
  rawContentStored: false;
  promptInjectionDetected: boolean;
};

export type ZavorthVisionReceipt = {
  id: string;
  kind: 'policy' | 'redaction' | 'capture' | 'explain';
  status: ZavorthVisionPolicyDecision | 'done' | 'blocked';
  reason: string;
  artifactRefId: string | null;
  rawSecretSerialized: false;
};

export type ZavorthVisionControlPlaneSnapshot = {
  contractVersion: typeof ZAVORTH_VISION_CONTROL_PLANE_CONTRACT_VERSION;
  generatedAt: string;
  source: 'ZavorthVisionControlPlaneService';
  status: 'ready' | 'redacted' | 'blocked';
  action: ZavorthVisionControlPlaneAction;
  target: {
    kind: ZavorthVisionTargetKind;
    label: string;
    sourceSurface: string;
  };
  sensitivity: ZavorthVisionSensitivity;
  summary: string;
  observations: ZavorthVisionObservation[];
  artifacts: ZavorthVisionArtifactRef[];
  redaction: {
    applied: boolean;
    count: number;
    categories: string[];
    mode: 'safe-default';
  };
  policy: {
    decision: ZavorthVisionPolicyDecision;
    profile: 'vision-readonly-gate-1';
    reason: string;
    mutationAllowed: false;
    externalIoAllowed: false;
    providerPayloadMinimized: true;
  };
  receipts: ZavorthVisionReceipt[];
  commands: {
    status: '/vision status';
    inspect: '/vision inspect';
    explain: '/vision explain';
    nextAction: 'Preview engine - Browser Vision And Structured Web Control';
  };
  safety: {
    readOnlyOnly: true;
    noClickOrType: true;
    noWorkspaceMutation: true;
    noExternalIo: true;
    noRawImageSerialized: true;
    noRawSecretsSerialized: true;
    promptInjectionQuarantined: boolean;
    liveActionApplied: false;
  };
  nextSafeAction: string;
};
