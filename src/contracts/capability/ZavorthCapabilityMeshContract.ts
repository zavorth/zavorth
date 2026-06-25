export const ZAVORTH_CAPABILITY_MESH_CONTRACT_VERSION =
  'zavorth-capability-mesh/1' as const;

export type ZavorthCapabilityMeshStatus =
  | 'ready'
  | 'approval-required'
  | 'needs-capability'
  | 'blocked';

export type ZavorthCapabilityMeshCandidateKind =
  | 'internal-skill'
  | 'skill-composition'
  | 'create-zavorth-skill'
  | 'external-agent'
  | 'adapt-external-capability';

export type ZavorthCapabilityMeshRisk = 'low' | 'medium' | 'high';

export type ZavorthCapabilityMeshCoverage =
  | 'exact'
  | 'strong'
  | 'partial'
  | 'fallback';

export type ZavorthCapabilityMeshDecision =
  | 'use-internal-skill'
  | 'compose-internal-skills'
  | 'create-skill-draft'
  | 'delegate-external-agent'
  | 'adapt-or-import-external-capability'
  | 'ask-for-more-context';

export type ZavorthCapabilityMeshCandidate = {
  id: string;
  kind: ZavorthCapabilityMeshCandidateKind;
  label: string;
  sourceRef: string;
  score: number;
  coverage: ZavorthCapabilityMeshCoverage;
  risk: ZavorthCapabilityMeshRisk;
  requiresApproval: boolean;
  canExecuteNow: boolean;
  reasons: string[];
  evidence: string[];
  command: string | null;
  metadata: {
    skillName?: string | null;
    skillNames?: string[];
    externalProfileId?: string | null;
    externalAdapter?: string | null;
    liveEnabled?: boolean | null;
    isolationKind?: string | null;
    imported?: boolean | null;
  };
};

export type ZavorthCapabilityMeshSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_CAPABILITY_MESH_CONTRACT_VERSION;
  surface: 'capability-mesh';
  status: ZavorthCapabilityMeshStatus;
  request: {
    text: string;
    requestedBy: string;
    channel: string;
    normalizedTokens: string[];
  };
  inventory: {
    internalSkills: number;
    externalProfiles: number;
    enabledExternalProfiles: number;
    liveExternalProfiles: number;
    stronglyIsolatedExternalProfiles: number;
  };
  selected: {
    decision: ZavorthCapabilityMeshDecision;
    candidateId: string | null;
    summary: string;
    nextCommand: string | null;
  };
  candidates: ZavorthCapabilityMeshCandidate[];
  orchestration: {
    checkedInternalSkillsFirst: true;
    consideredSkillComposition: true;
    consideredSkillCreation: true;
    consideredConnectedExternalAgents: true;
    consideredExternalAdaptation: true;
    noExternalAgentInvokedDuringArbitration: true;
    noSkillInstalledDuringArbitration: true;
  };
  policy: {
    zavorthNativePreferred: true;
    exactInternalSkillWinsByDefault: true;
    externalAgentRequiresConnectedProfile: true;
    externalDelegationRequiresApproval: true;
    skillCreationStartsAsDraft: true;
    externalCapabilityImportRequiresReview: true;
  };
  safety: {
    readOnlyInventory: true;
    noNetworkProbe: true;
    noProcessStarted: true;
    noCredentialSerialization: true;
    noToolExposure: true;
    perRunApprovalStillRequired: true;
  };
  commands: {
    inspect: string;
    json: string;
    check: string;
  };
};
