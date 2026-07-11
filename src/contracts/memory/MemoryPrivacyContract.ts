/**
 * Memory Privacy OS contract (Mnemos product narrative).
 *
 * Product UX layer over existing Mnemos / dream / forget surfaces.
 * Answers: What does it remember? Why? Forget it.
 * Does not replace MnemosDreamCycleService or memory storage engines.
 */

export const MEMORY_PRIVACY_CONTRACT_VERSION = '2026-07-11.proof-os-memory-privacy-v1' as const;

export type MemoryPrivacyOrigin =
  | 'conversation'
  | 'skill'
  | 'import'
  | 'dream-cycle'
  | 'user-stated'
  | 'system'
  | 'unknown';

export type MemoryPrivacyConsentState = 'granted' | 'implied' | 'review' | 'unknown';

export type MemoryPrivacyItemView = {
  id: string;
  title: string;
  summary: string;
  origin: MemoryPrivacyOrigin;
  originLabel: string;
  /** Human explanation of why this memory exists. */
  whyIKnowThis: string;
  proofEventId: string | null;
  consentState: MemoryPrivacyConsentState;
  canForget: boolean;
  secretLike: boolean;
  createdAt: string | null;
  metadata?: Record<string, unknown>;
};

export type MemoryPrivacyDreamCandidateView = {
  id: string;
  title: string;
  lane?: string;
  needsReview: boolean;
};

export type MemoryPrivacySnapshot = {
  contractVersion: typeof MEMORY_PRIVACY_CONTRACT_VERSION;
  generatedAt: string;
  items: MemoryPrivacyItemView[];
  dreamCandidates: MemoryPrivacyDreamCandidateView[];
  summary: {
    total: number;
    forgettable: number;
    reviewQueue: number;
    secretLike: number;
  };
  nextSafeAction: string;
};

export const MEMORY_PRIVACY_ORIGINS: readonly MemoryPrivacyOrigin[] = [
  'conversation',
  'skill',
  'import',
  'dream-cycle',
  'user-stated',
  'system',
  'unknown',
] as const;

export const MEMORY_PRIVACY_CONSENT_STATES: readonly MemoryPrivacyConsentState[] = [
  'granted',
  'implied',
  'review',
  'unknown',
] as const;
