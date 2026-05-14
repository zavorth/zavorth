export const MIGRATION_CONTRACT_VERSION = 'migration-v1' as const;
export const MIGRATION_IMPORT_CAPABILITY_ID = 'migration.import' as const;

export type MigrationImportSource = {
  kind: 'directory' | 'manifest' | 'config-file';
  ref: string;
};

export type MigrationImportStatus = 'planned' | 'dry_run' | 'applied' | 'failed' | 'blocked';

export type MigrationImportRequest = {
  source: MigrationImportSource;
  targetNamespace: string;
  dryRun: boolean;
  sessionId?: string | null;
  correlationId?: string | null;
};

export type MigrationImportFinding = {
  id: string;
  severity: 'info' | 'warning' | 'blocked';
  summary: string;
  targetPrimitive: string | null;
};

export type MigrationImportResult = {
  ok: boolean;
  contractVersion: typeof MIGRATION_CONTRACT_VERSION;
  status: MigrationImportStatus;
  findings: MigrationImportFinding[];
  generatedManifestIds: string[];
  reportArtifactId: string | null;
  receiptId: string;
  processedAt: string;
  error: string | null;
};
