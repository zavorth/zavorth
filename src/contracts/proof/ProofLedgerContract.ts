/**
 * Trust Loop unified receipt ledger contract.
 *
 * Facade/projection over existing receipt systems (desktop receipts,
 * agent run evidence, AI-first runtime ledger, etc.). Does not replace them.
 */

export const PROOF_LEDGER_CONTRACT_VERSION = '2026-07-11.trust-loop-v1' as const;

export type ProofRiskLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

export type ProofEventKind =
  | 'chat'
  | 'approval'
  | 'runtime'
  | 'system'
  | 'channel'
  | 'memory'
  | 'marketplace'
  | 'workboard'
  | 'action'
  | 'evidence'
  | 'unknown';

export type ProofEventStatus = 'ok' | 'failed' | 'pending' | 'info';

export type ProofArtifactRef = {
  id: string;
  type: string;
  label?: string;
};

export type ProofEvent = {
  id: string;
  runId: string | null;
  kind: ProofEventKind;
  /** Originating surface, e.g. 'desktop' | 'cli' | 'runtime' | 'control' */
  surface: string;
  title: string;
  summary: string;
  status: ProofEventStatus;
  riskLevel: ProofRiskLevel;
  approvalId: string | null;
  artifacts: ProofArtifactRef[];
  /** ISO-8601 timestamp */
  createdAt: string;
  /** Originating system id */
  source: string;
  metadata?: Record<string, unknown>;
};

export type ProofLedgerSnapshot = {
  contractVersion: typeof PROOF_LEDGER_CONTRACT_VERSION;
  source: 'proof-ledger';
  generatedAt: string;
  ledgerId: string;
  events: ProofEvent[];
  summary: {
    total: number;
    byKind: Record<string, number>;
    byStatus: Record<string, number>;
    highRiskOrAbove: number;
  };
};

export type ProofLedgerListFilter = {
  kind?: ProofEventKind | string;
  status?: ProofEventStatus | string;
  runId?: string | null;
  query?: string;
  limit?: number;
};

export type ProofDesktopReceiptShape = {
  id: string;
  kind: string;
  title: string;
  summary: string;
  status: 'ok' | 'failed' | 'pending' | 'info' | string;
  at: string;
  sessionId?: string | null;
  source?: string | null;
  metadata?: Record<string, unknown>;
};

export type ProofEvidenceRecordShape = {
  id: string;
  key: string;
  runId: string;
  status: string | null;
  generatedAt: string | null;
  material?: boolean;
  snapshot?: Record<string, unknown>;
  sequence?: number;
};

export const PROOF_EVENT_KINDS: readonly ProofEventKind[] = [
  'chat',
  'approval',
  'runtime',
  'system',
  'channel',
  'memory',
  'marketplace',
  'workboard',
  'action',
  'evidence',
  'unknown',
] as const;

export const PROOF_EVENT_STATUSES: readonly ProofEventStatus[] = [
  'ok',
  'failed',
  'pending',
  'info',
] as const;

export const PROOF_RISK_LEVELS: readonly ProofRiskLevel[] = [
  'none',
  'low',
  'medium',
  'high',
  'critical',
] as const;
