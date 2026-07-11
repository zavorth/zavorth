/**
 * Optional named migration profiles on top of universal workspace import.
 *
 * Profile ids are structure labels (fingerprints), not import requirements.
 * Universal structural import always remains available without a profile.
 */

export const WORKSPACE_MIGRATION_PROFILE_CONTRACT_VERSION =
  '2026-07-11.trust-loop-migration-v1' as const;

export type WorkspaceMigrationProfileId =
  | 'auto'
  | 'generic-agent-home'
  | 'openclaw-home'
  | 'hermes-home'
  | 'unknown';

/** CLI / operator-facing profile request (aliases allowed). */
export type WorkspaceMigrationProfileRequest =
  | 'auto'
  | 'generic'
  | 'generic-agent-home'
  | 'openclaw-home'
  | 'hermes-home';

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
  confidence: number; // 0..1
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
