import type { ZavorthUniversalSkillIntakeStatus } from '../ZavorthUniversalSkillIntakeContract.js';

export const MCP_ECOSYSTEM_INTAKE_VERSION = 'mcp-ecosystem-intake/v1' as const;

export type McpEcosystemItem = {
  id: string;
  name: string;
  status: 'candidate' | 'blocked' | 'quarantined';
  risk: 'low' | 'medium' | 'high';
  toolNames: string[];
  sourceProfileId: string;
  permissionProfileId: string;
  installCommand: string;
  reviewCommand: string;
  reasons: string[];
};

export type McpEcosystemIntakeSnapshot = {
  generatedAt: string;
  version: typeof MCP_ECOSYSTEM_INTAKE_VERSION;
  status: ZavorthUniversalSkillIntakeStatus;
  sourcePath: string;
  items: McpEcosystemItem[];
  summary: {
    scannedCandidates: number;
    mcpCandidates: number;
    blocked: number;
    quarantined: number;
    executableToolsExposed: 0;
  };
  policy: {
    previewOnly: true;
    noInstallPerformed: true;
    noExecutionPerformed: true;
    externalMcpNeverTrustedAutomatically: true;
    quarantineBeforeToolExposure: true;
    approvalRequiredForPromotion: true;
    rawSecretsSerialized: false;
  };
  commands: {
    preview: string;
    review: string;
    promote: string;
    forget: string;
  };
};
