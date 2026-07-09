/**
 * Universal Capability Fabric
 *
 * One governed intake plane for any external capability source:
 * skills, plugins, and MCP packs. Sources may be local paths, archives,
 * or remote HTTPS URLs. Nothing becomes live without preview + approval.
 *
 * This contract is intentionally brand-agnostic. It never encodes a
 * third-party product name as a required profile.
 */

export const UNIVERSAL_CAPABILITY_FABRIC_CONTRACT_VERSION =
  'zavorth-universal-capability-fabric/v1' as const;

export type CapabilityFabricKind = 'skill' | 'plugin' | 'mcp' | 'unknown';

export type CapabilityFabricSourceKind =
  | 'path'
  | 'archive'
  | 'https-url'
  | 'git-url'
  | 'inline-text'
  | 'auto';

export type CapabilityFabricTrustState =
  | 'discovered'
  | 'quarantined'
  | 'previewed'
  | 'approved'
  | 'enabled'
  | 'denied'
  | 'revoked';

export type CapabilityFabricRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type CapabilityFabricSourceRef = {
  raw: string;
  kind: CapabilityFabricSourceKind;
  label: string;
  resolvedLocalPath: string | null;
  remoteUrl: string | null;
  contentHash: string | null;
};

export type CapabilityFabricCandidate = {
  id: string;
  kind: CapabilityFabricKind;
  name: string;
  title: string;
  description: string;
  relativeEntry: string | null;
  trustState: CapabilityFabricTrustState;
  risk: CapabilityFabricRiskLevel;
  reasons: string[];
  tags: string[];
  executableCodeDetected: boolean;
  instructionOnly: boolean;
  targetDirHint: string;
};

export type CapabilityFabricIssue = {
  severity: 'info' | 'warn' | 'error' | 'blocked';
  code: string;
  message: string;
  candidateId?: string;
};

export type CapabilityFabricReceipt = {
  id: string;
  kind: 'preview' | 'quarantine' | 'materialize' | 'deny' | 'enable-hold';
  candidateId: string | null;
  capabilityKind: CapabilityFabricKind;
  status: 'pass' | 'deny' | 'hold' | 'skip';
  summary: string;
  targetPath: string | null;
  noLiveExecution: true;
  rawSecretsSerialized: false;
  createdAt: string;
};

export type CapabilityFabricPolicy = {
  previewBeforeMutate: true;
  approvalRequiredForEnable: true;
  executablePluginsHigherTrust: true;
  mcpStartsDisabled: true;
  instructionSkillsDefault: true;
  catalogIsNotLive: true;
  rawSecretsSerialized: false;
  brandAgnostic: true;
};

export type CapabilityFabricSummary = {
  sources: number;
  candidates: number;
  skills: number;
  plugins: number;
  mcp: number;
  unknown: number;
  highRisk: number;
  executableCode: number;
  materialized: number;
  denied: number;
  heldForApproval: number;
};

export type CapabilityFabricSnapshot = {
  contractVersion: typeof UNIVERSAL_CAPABILITY_FABRIC_CONTRACT_VERSION;
  generatedAt: string;
  status: 'preview-only' | 'partial' | 'passed' | 'blocked';
  apply: boolean;
  source: CapabilityFabricSourceRef;
  candidates: CapabilityFabricCandidate[];
  issues: CapabilityFabricIssue[];
  receipts: CapabilityFabricReceipt[];
  summary: CapabilityFabricSummary;
  policy: CapabilityFabricPolicy;
  quarantineRoot: string;
  narrative: {
    headline: string;
    operatorSummary: string;
    nextSafeAction: string;
  };
};

export type UniversalWorkspaceSignalId =
  | 'identity_markdown'
  | 'soul_markdown'
  | 'user_markdown'
  | 'agents_markdown'
  | 'memory_markdown'
  | 'memory_directory'
  | 'skills_directory'
  | 'skill_library_directory'
  | 'plugins_directory'
  | 'config_directory'
  | 'config_json'
  | 'config_yaml'
  | 'workspace_json'
  | 'tools_markdown'
  | 'rules_markdown'
  | 'dot_agent_home'
  | 'package_manifest'
  | 'mcp_manifest';

export type UniversalWorkspaceProfileId =
  | 'identity-markdown-home'
  | 'skill-centric-home'
  | 'memory-centric-home'
  | 'config-centric-home'
  | 'plugin-centric-home'
  | 'mixed-agent-home'
  | 'opaque-or-empty';

export type UniversalWorkspaceSignal = {
  id: UniversalWorkspaceSignalId;
  present: boolean;
  path: string | null;
  weight: number;
};

export type UniversalWorkspaceImportItemKind =
  | 'identity'
  | 'memory'
  | 'skill'
  | 'plugin'
  | 'config'
  | 'preference'
  | 'tool-policy'
  | 'unknown';

export type UniversalWorkspaceImportItem = {
  id: string;
  kind: UniversalWorkspaceImportItemKind;
  name: string;
  sourcePath: string;
  targetPath: string;
  risk: CapabilityFabricRiskLevel;
  secretLike: boolean;
  status: 'pending' | 'previewed' | 'copied' | 'skipped' | 'denied' | 'error';
  reason?: string;
};

export type UniversalWorkspaceImportReceipt = {
  id: string;
  kind: 'preview' | 'import' | 'deny' | 'skip';
  itemId: string | null;
  status: 'pass' | 'deny' | 'skip' | 'hold';
  summary: string;
  createdAt: string;
  rawSecretsSerialized: false;
};

export type UniversalWorkspaceImportSnapshot = {
  contractVersion: 'zavorth-universal-workspace-import/v1';
  generatedAt: string;
  status: 'preview-only' | 'partial' | 'passed' | 'blocked';
  apply: boolean;
  sourcePath: string;
  profileId: UniversalWorkspaceProfileId;
  confidence: number;
  signals: UniversalWorkspaceSignal[];
  items: UniversalWorkspaceImportItem[];
  receipts: UniversalWorkspaceImportReceipt[];
  warnings: string[];
  summary: {
    items: number;
    secretLike: number;
    skills: number;
    memory: number;
    config: number;
    plugins: number;
    copied: number;
    skipped: number;
    denied: number;
  };
  policy: {
    brandAgnostic: true;
    structuralDetectionOnly: true;
    previewBeforeApply: true;
    secretLikeNeverAutoImported: true;
    rawSecretsSerialized: false;
  };
  narrative: {
    headline: string;
    operatorSummary: string;
    nextSafeAction: string;
  };
};
