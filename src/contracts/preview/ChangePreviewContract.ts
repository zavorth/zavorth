/**
 * Change Preview / counterfactual product UX contract (Trust Loop face).
 *
 * Productizes ImpactSimulatorService, FutureComparatorService, and
 * UniversalPreviewModeService — does not replace them.
 * Honesty: never claim a full world twin when data is insufficient.
 */

export const CHANGE_PREVIEW_CONTRACT_VERSION =
  '2026-07-11.trust-loop-change-preview-v1' as const;

export type ChangePreviewConfidence =
  | 'full'
  | 'partial'
  | 'limited'
  | 'unavailable';

export type ChangePreviewBullet = {
  id: string;
  text: string;
  severity: 'info' | 'warning' | 'risk';
  dimension?: 'disk' | 'shell' | 'network' | 'memory' | 'other';
};

export type ChangePreviewDiffLine = {
  path: string;
  kind: 'create' | 'edit' | 'delete' | 'exec' | 'network' | 'unknown';
  note?: string;
};

export type ChangePreviewCard = {
  contractVersion: typeof CHANGE_PREVIEW_CONTRACT_VERSION;
  id: string;
  /** Default product title: "If you approve, what changes?" */
  title: string;
  confidence: ChangePreviewConfidence;
  /** Honest reason when confidence is limited / partial / unavailable */
  confidenceReason: string;
  /** Prefer 3; max 6 */
  bullets: ChangePreviewBullet[];
  diffs: ChangePreviewDiffLine[];
  requiresApproval: boolean;
  requiresSandbox: boolean;
  rollbackAvailable: boolean | null;
  /** e.g. ImpactSimulatorService, UniversalPreviewModeService */
  sourceServices: string[];
  generatedAt: string;
  runId: string | null;
  approvalCardId: string | null;
  metadata?: Record<string, unknown>;
};
