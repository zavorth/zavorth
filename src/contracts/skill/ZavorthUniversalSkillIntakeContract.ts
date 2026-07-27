export const ZAVORTH_UNIVERSAL_SKILL_INTAKE_CONTRACT_VERSION = '2026-05-10.gate-1' as const;

export type ZavorthUniversalSkillIntakeStatus = 'pass' | 'warn' | 'fail';

export type ZavorthUniversalSkillSourceKind = 'directory' | 'zip';

export type ZavorthUniversalSkillSourceProfileId =
  | 'skill-md'
  | 'codex-skill'
  | 'omni-skill'
  | 'agent-skill'
  | 'plugin-manifest'
  | 'mcp-tool-pack'
  | 'agent-extension'
  | 'json-yaml-catalog'
  | 'generic-markdown';

export type ZavorthUniversalSkillPermissionProfileId =
  | 'local-readonly'
  | 'workspace-read'
  | 'workspace-write-approval'
  | 'network-read-approval'
  | 'tool-execution-approval'
  | 'connector-live-secretref'
  | 'blocked';

export type ZavorthUniversalSkillCapabilityTag =
  | 'app-connector'
  | 'automation'
  | 'browser'
  | 'code'
  | 'data'
  | 'document'
  | 'mcp'
  | 'plugin'
  | 'research'
  | 'security'
  | 'workflow';

export type ZavorthUniversalSkillIntakeIssueSeverity = 'info' | 'warn' | 'error';

export type ZavorthUniversalSkillIntakeIssueCode =
  | 'archive-too-large'
  | 'binary-like-file'
  | 'catalog-entry-invalid'
  | 'duplicate-skill'
  | 'file-too-large'
  | 'invalid-manifest'
  | 'missing-entrypoint'
  | 'path-traversal'
  | 'script-auto-executable'
  | 'suspicious-external-link'
  | 'symlink-escape'
  | 'unsupported-file'
  | 'zip-entry-limit'
  | 'zip-slip';

export type ZavorthUniversalSkillIntakeIssue = {
  severity: ZavorthUniversalSkillIntakeIssueSeverity;
  code: ZavorthUniversalSkillIntakeIssueCode;
  message: string;
  relativePath: string | null;
  sourcePath?: string | null;
};

export type ZavorthUniversalSkillCatalogProjection = {
  name: string;
  description: string;
  searchText: string;
  bundleTags: string[];
  supportFileCount: number;
};

export type ZavorthUniversalSkillManifest = {
  id: string;
  name: string;
  description: string;
  version: string | null;
  sourceProfileId: ZavorthUniversalSkillSourceProfileId;
  sourceKind: ZavorthUniversalSkillSourceKind;
  sourceRootPath: string;
  relativeSkillPath: string;
  entrypointPath: string | null;
  manifestPath: string | null;
  supportFiles: string[];
  declaredTools: string[];
  permissionProfileId: ZavorthUniversalSkillPermissionProfileId;
  capabilityTags: ZavorthUniversalSkillCapabilityTag[];
  contentHash: string;
  catalogProjection: ZavorthUniversalSkillCatalogProjection;
  notes: string[];
};

export type ZavorthUniversalSkillCandidate = {
  id: string;
  status: 'candidate' | 'blocked';
  blockedReason: string | null;
  manifest: ZavorthUniversalSkillManifest;
  issues: ZavorthUniversalSkillIntakeIssue[];
};

export type ZavorthUniversalSkillSourceProfile = {
  id: ZavorthUniversalSkillSourceProfileId;
  label: string;
  priority: number;
  description: string;
  entrypointPatterns: string[];
  notes: string[];
};

export type ZavorthUniversalSkillIntakePreview = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_UNIVERSAL_SKILL_INTAKE_CONTRACT_VERSION;
  status: ZavorthUniversalSkillIntakeStatus;
  source: {
    kind: ZavorthUniversalSkillSourceKind;
    path: string;
    label: string;
    exists: boolean;
    archiveBytes: number | null;
  };
  limits: {
    maxArchiveBytes: number;
    maxFileBytes: number;
    maxFiles: number;
  };
  profiles: ZavorthUniversalSkillSourceProfile[];
  summary: {
    filesScanned: number;
    textFilesAccepted: number;
    filesSkipped: number;
    candidates: number;
    blockedCandidates: number;
    sourceIssues: number;
    candidateIssues: number;
    errors: number;
    warnings: number;
    previewOnly: true;
    importPerformed: false;
    executionPerformed: false;
  };
  issues: ZavorthUniversalSkillIntakeIssue[];
  candidates: ZavorthUniversalSkillCandidate[];
  policy: {
    previewOnly: true;
    denyByDefault: true;
    noImportPerformed: true;
    noExecutionPerformed: true;
    noUpstreamRuntimeTrust: true;
    pathTraversalBlocked: true;
    zipSlipBlocked: true;
    symlinkEscapeBlocked: true;
    binaryAndScriptFilesSkipped: true;
  };
  commands: {
    inspect: 'npm run zavorth:universal-skill-intake -- --source <path>';
    inspectJson: 'npm run zavorth:universal-skill-intake:json -- --source <path>';
    check: 'npm run zavorth:universal-skill-intake:check --silent';
    nextAction: 'Preview engine - Trust-Governed Import Pipeline';
  };
};
