/**
 * Absorb Risk Report contract.
 *
 * Operator-facing risk preview for capability absorb / quarantine flows.
 * Complements UniversalCapabilityFabric without replacing its trust model.
 */

export const ABSORB_RISK_REPORT_CONTRACT_VERSION =
  '2026-07-11.proof-os-absorb-v1' as const;

export type AbsorbRiskDimension =
  | 'files'
  | 'executable'
  | 'network'
  | 'permissions'
  | 'secrets'
  | 'unknown';

export type AbsorbRiskFinding = {
  id: string;
  dimension: AbsorbRiskDimension;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  title: string;
  detail: string;
};

export type AbsorbRiskReport = {
  contractVersion: typeof ABSORB_RISK_REPORT_CONTRACT_VERSION;
  sourceLabel: string;
  kind: string;
  overallRisk: 'low' | 'medium' | 'high' | 'critical' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  findings: AbsorbRiskFinding[];
  /** 3–6 operator bullets */
  summaryBullets: string[];
  quarantineRoot: string | null;
  candidateCount: number;
  executableDetected: boolean;
  secretLikeDetected: boolean;
  /** false if blocked / high without a consent path */
  promoteReady: boolean;
  nextSafeAction: string;
  generatedAt: string;
};

export type AbsorbRiskProofAction = 'preview' | 'promote' | 'reject';

export const ABSORB_RISK_DIMENSIONS: readonly AbsorbRiskDimension[] = [
  'files',
  'executable',
  'network',
  'permissions',
  'secrets',
  'unknown',
] as const;

export const ABSORB_RISK_SEVERITIES = [
  'info',
  'low',
  'medium',
  'high',
  'critical',
] as const;
