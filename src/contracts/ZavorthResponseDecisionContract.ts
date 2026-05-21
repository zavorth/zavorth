export type ZavorthResponseDecisionMode =
  | 'conversation'
  | 'operation'
  | 'approval'
  | 'file-inspection'
  | 'artifact-result';

export type ZavorthResponseDecisionConfidence = 'low' | 'medium' | 'high';

export type ZavorthResponseDecisionTargetType =
  | 'none'
  | 'file'
  | 'folder'
  | 'web'
  | 'shell'
  | 'media'
  | 'workflow';

export type ZavorthResponseDecisionPath =
  | 'fast-chat'
  | 'agent-runtime'
  | 'local-inspector'
  | 'approval-gate';

export type ZavorthResponseDecisionArtifactPolicy = {
  shouldCreateArtifact: boolean;
  shouldShowArtifactInChat: boolean;
  reason: string;
};

export type ZavorthResponseDecisionTarget = {
  type: ZavorthResponseDecisionTargetType;
  value?: string | null;
};

export type ZavorthResponseDecisionDiagnostics = {
  surface?: string;
  shouldExecute: boolean;
  semantic: boolean;
  uxIntent?: {
    kind: string;
    confidence: string;
    shouldUseTools: boolean;
    shouldAskApproval: boolean;
    reason: string;
  } | null;
  universalIntent?: {
    intent: string;
    risk: string;
    nextSafeAction: string;
    requiresClarification: boolean;
    requiresPermission: boolean;
  } | null;
  trustSlider?: {
    level: string;
    decision: string;
    sandboxTier: string;
    permissionBoundary: string;
    permissionScope: string;
    hostAllowed: boolean;
    blocked: boolean;
  } | null;
};

export type ZavorthResponseDecision = {
  schemaVersion: 1;
  mode: ZavorthResponseDecisionMode;
  confidence: ZavorthResponseDecisionConfidence;
  reason: string;
  sourceReason: string;
  target: ZavorthResponseDecisionTarget;
  requestedTools: string[];
  responsePath: ZavorthResponseDecisionPath;
  shouldCreateArtifact: boolean;
  shouldShowArtifactInChat: boolean;
  artifactPolicy: ZavorthResponseDecisionArtifactPolicy;
  diagnostics: ZavorthResponseDecisionDiagnostics;
};

export function createZavorthResponseArtifactPolicy(input: {
  shouldCreateArtifact?: boolean | null;
  shouldShowArtifactInChat?: boolean | null;
  reason: string;
}): ZavorthResponseDecisionArtifactPolicy {
  return {
    shouldCreateArtifact: Boolean(input.shouldCreateArtifact),
    shouldShowArtifactInChat: Boolean(input.shouldShowArtifactInChat),
    reason: String(input.reason || 'not-required'),
  };
}

export function resolveZavorthResponseDecisionFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): ZavorthResponseDecision | null {
  const candidate = metadata?.responseDecision;
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }
  const decision = candidate as Partial<ZavorthResponseDecision>;
  if (decision.schemaVersion !== 1 || !decision.responsePath || !decision.artifactPolicy) {
    return null;
  }
  return decision as ZavorthResponseDecision;
}

export function resolveZavorthArtifactPolicyFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): ZavorthResponseDecisionArtifactPolicy | null {
  const direct = metadata?.artifactPolicy;
  if (direct && typeof direct === 'object') {
    const policy = direct as Partial<ZavorthResponseDecisionArtifactPolicy>;
    return createZavorthResponseArtifactPolicy({
      shouldCreateArtifact: policy.shouldCreateArtifact,
      shouldShowArtifactInChat: policy.shouldShowArtifactInChat,
      reason: String(policy.reason || 'metadata-artifact-policy'),
    });
  }

  const decision = resolveZavorthResponseDecisionFromMetadata(metadata);
  if (decision?.artifactPolicy) {
    return decision.artifactPolicy;
  }

  return null;
}

export function shouldPersistZavorthArtifacts(
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  const policy = resolveZavorthArtifactPolicyFromMetadata(metadata);
  if (!policy) {
    return true;
  }
  return policy.shouldCreateArtifact === true;
}

export function shouldExposeZavorthArtifactsInChat(
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  const policy = resolveZavorthArtifactPolicyFromMetadata(metadata);
  if (!policy) {
    return true;
  }
  return policy.shouldShowArtifactInChat === true;
}
