export const ZAVORTH_MNEMOS_INGEST_VERSION = 'zavorth-mnemos-ingest-v1';

export type ZavorthMnemosIngestStatus =
  | 'preview-ready'
  | 'applied'
  | 'blocked';

export type ZavorthMnemosIngestTargetPage =
  | 'architecture'
  | 'dependencies'
  | 'memory'
  | 'operations'
  | 'providers'
  | 'skills';

export type ZavorthMnemosIngestSource = {
  path: string;
  bytes: number;
  kind: 'markdown' | 'json' | 'text';
  title: string;
  excerpt: string;
  signals: string[];
};

export type ZavorthMnemosIngestPatch = {
  pageId: ZavorthMnemosIngestTargetPage;
  pagePath: string;
  action: 'append-source-note';
  summary: string;
  preview: string;
};

export type ZavorthMnemosIngestSnapshot = {
  version: typeof ZAVORTH_MNEMOS_INGEST_VERSION;
  generatedAt: string;
  status: ZavorthMnemosIngestStatus;
  mode: 'preview' | 'apply';
  sources: ZavorthMnemosIngestSource[];
  patches: ZavorthMnemosIngestPatch[];
  apply: {
    requested: boolean;
    applied: boolean;
    approvalRequired: boolean;
    approvalSatisfied: boolean;
    approvalId: string | null;
    mutatedFiles: string[];
    blockers: string[];
  };
  safety: {
    workspaceConfined: true;
    maxSourceBytes: number;
    providerCall: false;
    networkCall: false;
    secretsRedacted: true;
    patchPreviewOnlyByDefault: true;
  };
  receipt: {
    id: string;
    providerCall: false;
    durableMutation: boolean;
    approvalId: string | null;
  };
};
