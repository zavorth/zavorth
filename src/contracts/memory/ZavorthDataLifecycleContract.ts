export const ZAVORTH_DATA_LIFECYCLE_VERSION = 'zavorth-data-lifecycle.v1' as const;

export type ZavorthDataLifecycleSurface =
  | 'logs'
  | 'media'
  | 'backups'
  | 'transcriptions'
  | 'cache'
  | 'attachments'
  | 'history'
  | 'telemetry'
  | 'approvals'
  | 'skills';

export type ZavorthDataLifecycleClassification =
  | 'public'
  | 'internal'
  | 'user-content'
  | 'sensitive'
  | 'secret-adjacent';

export type ZavorthDataLifecycleRetentionMode =
  | 'time-boxed'
  | 'size-boxed'
  | 'until-user-delete'
  | 'operator-reviewed';

export type ZavorthDataLifecycleCapabilityMode =
  | 'self-service'
  | 'operator-command'
  | 'manual-reviewed'
  | 'not-stored';

export type ZavorthDataLifecycleDataset = {
  id: string;
  label: string;
  surface: ZavorthDataLifecycleSurface;
  classification: ZavorthDataLifecycleClassification;
  retentionMode: ZavorthDataLifecycleRetentionMode;
  defaultRetentionDays: number | null;
  exportMode: ZavorthDataLifecycleCapabilityMode;
  deletionMode: ZavorthDataLifecycleCapabilityMode;
  redaction: 'required' | 'recommended' | 'not-needed';
  encryptionExpected: boolean;
  storageRoots: string[];
  commands: {
    inspect: string;
    export: string;
    delete: string;
  };
  evidence: string[];
  residualRisk: string;
};

export type ZavorthDataLifecycleValidationIssue = {
  datasetId: string;
  field: string;
  message: string;
};

export type ZavorthDataLifecycleSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_DATA_LIFECYCLE_VERSION;
  summary: {
    total: number;
    covered: number;
    exportable: number;
    deletable: number;
    redactionCovered: number;
    releaseReady: boolean;
  };
  datasets: ZavorthDataLifecycleDataset[];
  issues: ZavorthDataLifecycleValidationIssue[];
  defaults: {
    dryRunByDefault: boolean;
    destructiveDeleteRequiresExplicitFlag: boolean;
    rawSecretExportAllowed: false;
    userContentNeedsLifecycle: true;
  };
  commands: {
    report: string;
    json: string;
    check: string;
    dryRunDelete: string;
    nextStep: string;
  };
  narrative: {
    headline: string;
    operatorSummary: string;
  };
};
