/**
 * Generic external-agent capability descriptors + import receipts.
 * Transport-agnostic (cli | http | acp | mcp); no product brand enums.
 */

import type { ZavorthExternalAgentAdapterKind } from './ZavorthExternalAgentGatewayContract.js';

export const ZAVORTH_EXTERNAL_AGENT_CAPABILITY_IMPORT_CONTRACT_VERSION =
  'zavorth-external-agent-capability-import/1' as const;

/** Generic declared capability from an external runtime profile. */
export type ExternalAgentCapabilityDescriptor = {
  id: string;
  name: string;
  summary?: string;
  /** Optional tool-style name for SkillIR declaredTools. */
  toolName?: string;
  kind?: 'tool' | 'skill' | 'resource' | 'prompt' | 'unknown';
  /** Adapter that discovered this capability. */
  adapter: ZavorthExternalAgentAdapterKind;
  /** Source of the descriptor (declared list, file, probe). */
  source: 'profile-declared' | 'capabilities-file' | 'adapter-probe' | 'fixture';
  permissions?: string[];
  metadata?: Record<string, unknown>;
};

export type ExternalAgentListCapabilitiesResult = {
  contractVersion: typeof ZAVORTH_EXTERNAL_AGENT_CAPABILITY_IMPORT_CONTRACT_VERSION;
  ok: boolean;
  profileId: string;
  adapter: ZavorthExternalAgentAdapterKind | null;
  capabilities: ExternalAgentCapabilityDescriptor[];
  /** True when no external process/network was used. */
  offline: boolean;
  processExecuted: false;
  findings: string[];
  formatText(): string;
};

export type ExternalAgentCapabilityImportReceipt = {
  schemaVersion: 'zavorth.external-agent-capability-import-receipt.v1';
  contractVersion: typeof ZAVORTH_EXTERNAL_AGENT_CAPABILITY_IMPORT_CONTRACT_VERSION;
  id: string;
  generatedAt: string;
  profileId: string;
  adapter: ZavorthExternalAgentAdapterKind | null;
  consent: boolean;
  status: 'preview' | 'applied' | 'blocked' | 'failed';
  skillId: string | null;
  skillPath: string | null;
  skillIrDigest: string | null;
  capabilityIds: string[];
  declaredTools: string[];
  autoImport: false;
  liveInvokeStillApprovalGated: true;
  processExecutedDuringImport: false;
  findings: string[];
  nextCommands: string[];
};

export type ExternalAgentCapabilityImportResult = {
  ok: boolean;
  autoImport: false;
  consentRequired: boolean;
  receipt: ExternalAgentCapabilityImportReceipt;
  list: ExternalAgentListCapabilitiesResult | null;
  formatText(): string;
};
