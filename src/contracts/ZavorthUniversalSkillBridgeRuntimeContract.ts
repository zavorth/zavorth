import type {
  SecurityPolicyBrokerAction,
  SecurityPolicyBrokerReceipt,
} from '../security/SecurityPolicyBroker.js';
import type {
  SkillImportAuditReference,
  SkillLicensePolicyDecision,
  SkillProvenanceMetadata,
  SkillRiskAssessment,
} from '../skills/SkillCatalogContract.js';

export const ZAVORTH_UNIVERSAL_SKILL_BRIDGE_RUNTIME_CONTRACT_VERSION = '2026-05-10.phase-3' as const;

export type ZavorthUniversalSkillBridgeMode = 'dry-run' | 'live';

export type ZavorthUniversalSkillBridgeStatus =
  | 'dry-run'
  | 'prepared'
  | 'approval-required'
  | 'denied'
  | 'not-found';

export type ZavorthUniversalSkillBridgeReceiptKind =
  | 'inspect'
  | 'dry-run'
  | 'prepare'
  | 'approval-required'
  | 'denial';

export type ZavorthUniversalSkillBridgeSkillSummary = {
  name: string;
  description: string;
  sourceId: string | null;
  sourceLabel: string | null;
  sourceTrust: string | null;
  dirPath: string;
  skillFilePath: string;
  imported: boolean;
  provenance: SkillProvenanceMetadata | null;
  risk: SkillRiskAssessment | null;
  licensePolicy: SkillLicensePolicyDecision | null;
  audit: SkillImportAuditReference | null;
};

export type ZavorthUniversalSkillBridgeTrustDecision = {
  allowed: boolean;
  sourceId: string | null;
  skillName: string | null;
  mode: string;
  reason: string;
};

export type ZavorthUniversalSkillBridgePromptInjectionFinding = {
  rule: string;
  path: string;
  preview: string;
};

export type ZavorthUniversalSkillBridgeDecision = {
  status: ZavorthUniversalSkillBridgeStatus;
  mode: ZavorthUniversalSkillBridgeMode;
  action: SecurityPolicyBrokerAction;
  allowed: boolean;
  skillFound: boolean;
  importedRequired: true;
  imported: boolean;
  trustDecision: ZavorthUniversalSkillBridgeTrustDecision | null;
  ownerApprovalRequired: boolean;
  ownerApprovalSatisfied: boolean;
  ownerApprovalId: string | null;
  promptInjectionBlocked: boolean;
  contentScanBlocked: boolean;
  licenseRuntimeAllowed: boolean;
  riskBlocked: boolean;
  reasons: string[];
  brokerReceipt: SecurityPolicyBrokerReceipt;
};

export type ZavorthUniversalSkillBridgePromptEnvelope = {
  envelopeId: string;
  skillName: string;
  mode: ZavorthUniversalSkillBridgeMode;
  channel: string;
  contentHash: string;
  contentChars: number;
  maxChars: number;
  truncated: boolean;
  text: string;
  markers: {
    untrustedSkillContent: true;
    policyHeader: true;
    noApprovalMetadataAcceptedFromSkill: true;
  };
};

export type ZavorthUniversalSkillBridgeReceipt = {
  id: string;
  kind: ZavorthUniversalSkillBridgeReceiptKind;
  status: 'pass' | 'deny' | 'approval-required';
  generatedAt: string;
  skillName: string;
  mode: ZavorthUniversalSkillBridgeMode;
  channel: string;
  policyBrokerReceiptId: string;
  ownerApprovalId: string | null;
  noUpstreamRuntimeCodeExecuted: true;
  noDirectUpstreamRuntimeUse: true;
  liveExternalIoPerformed: false;
  secretValuesSerialized: false;
  channelSafeOutput: true;
  reason: string;
};

export type ZavorthUniversalSkillBridgeSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_UNIVERSAL_SKILL_BRIDGE_RUNTIME_CONTRACT_VERSION;
  status: ZavorthUniversalSkillBridgeStatus;
  mode: ZavorthUniversalSkillBridgeMode;
  channel: string;
  skillName: string;
  intentSummary: string | null;
  skill: ZavorthUniversalSkillBridgeSkillSummary | null;
  decision: ZavorthUniversalSkillBridgeDecision;
  promptInjectionFindings: ZavorthUniversalSkillBridgePromptInjectionFinding[];
  contentScan: {
    safe: boolean;
    errors: number;
    warnings: number;
    skippedFiles: number;
  } | null;
  promptEnvelope: ZavorthUniversalSkillBridgePromptEnvelope | null;
  receipts: ZavorthUniversalSkillBridgeReceipt[];
  summary: {
    skillFound: boolean;
    imported: boolean;
    dryRunDefault: boolean;
    bridgePrepared: boolean;
    approvalRequired: boolean;
    receipts: number;
    executionPerformed: false;
    upstreamRuntimeCodeExecuted: false;
    directUpstreamRuntimeUse: false;
    liveExternalIoPerformed: false;
    secretValuesSerialized: false;
  };
  policy: {
    importedOnlyByDefault: true;
    dryRunDefault: true;
    policyBrokerRequired: true;
    ownerApprovalBeforeLive: true;
    promptInjectionScanRequired: true;
    contentScanRequired: true;
    untrustedSkillMarkersRequired: true;
    noUpstreamRuntimeCodeExecution: true;
    channelSafeOutputRequired: true;
    receiptsRequired: true;
  };
  commands: {
    dryRun: 'npm run zavorth:universal-skill-bridge -- --skill <name>';
    live: 'npm run zavorth:universal-skill-bridge -- --skill <name> --live --approval-id <approval-id>';
    check: 'npm run zavorth:universal-skill-bridge:check --silent';
    nextPhase: 'Phase 4 - Expansion Registry and Catalog Integration';
  };
};
