/**
 * Brand-agnostic workspace migration profiles.
 *
 * Profile ids are generic structural labels, not product names.
 * Universal structural import always remains available without a profile.
 */

export const WORKSPACE_MIGRATION_PROFILE_CONTRACT_VERSION =
  '2026-07-11.trust-loop-migration-v2' as const;

export type WorkspaceMigrationProfileId =
  | 'auto'
  | 'agent-home'
  | 'unknown';

/** CLI / operator-facing profile request. */
export type WorkspaceMigrationProfileRequest =
  | 'auto'
  | 'generic'
  | 'agent-home';

export type MigrationRiskFinding = {
  id: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  title: string;
  detail: string;
  secretLike?: boolean;
};

export type WorkspaceMigrationSignal = {
  id: string;
  present: boolean;
  weight?: number;
};

export type WorkspaceMigrationReport = {
  contractVersion: typeof WORKSPACE_MIGRATION_PROFILE_CONTRACT_VERSION;
  profileId: WorkspaceMigrationProfileId;
  detectedProfileId: WorkspaceMigrationProfileId;
  confidence: number;
  sourcePath: string;
  signals: WorkspaceMigrationSignal[];
  findings: MigrationRiskFinding[];
  itemCounts: {
    total: number;
    secretLike: number;
    skills: number;
    memory: number;
    config: number;
    other: number;
  };
  summaryBullets: string[];
  secretLikePresent: boolean;
  safeToPreview: true;
  applyBlockedWithoutConsent: true;
  nextSafeAction: string;
  generatedAt: string;
};
