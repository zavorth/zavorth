export type ZavorthHomeSource = 'explicit' | 'env' | 'compat';

export type ZavorthHomeMigrationStatus =
  | 'not_needed'
  | 'available'
  | 'preview'
  | 'applied'
  | 'rolled_back'
  | 'blocked';

export type ZavorthHomeResolvedPaths = {
  homeRoot: string;
  projectRoot: string;
  dataDir: string;
  runtimeDir: string;
  configDir: string;
  tmpDir: string;
  logsDir: string;
  cacheDir: string;
  credentialsDir: string;
  receiptsDir: string;
  dbPath: string;
  legacyDataDir: string;
  legacyStateDir: string;
};

export type ZavorthHomeMigrationEntry = {
  source: string;
  destination: string;
  exists: boolean;
  kind: 'file' | 'directory' | 'missing';
  sensitive: boolean;
  redactedSource: string;
  redactedDestination: string;
  risk: 'low' | 'medium' | 'high';
};

export type ZavorthHomeSnapshot = {
  contractVersion: 'zavorth-home/1';
  generatedAt: string;
  projectRoot: string;
  root: string;
  source: ZavorthHomeSource;
  isolated: boolean;
  resolvedPaths: ZavorthHomeResolvedPaths;
  dailyUse: {
    setupPrompt: string;
    statusCommand: string;
    switchCommand: string;
    migratePreviewCommand: string;
    migrateApplyCommand: string;
    rollbackCommand: string;
  };
  migration: {
    status: ZavorthHomeMigrationStatus;
    entries: ZavorthHomeMigrationEntry[];
    approvalRequired: true;
    approvalId: string | null;
    writesPerformed: boolean;
    rollback: string[];
  };
  safety: {
    preventsPathTraversal: true;
    secretsRedacted: true;
    noAutomaticMigration: true;
    approvalRequiredForApply: true;
    compatibleFallback: true;
  };
  warnings: string[];
};
