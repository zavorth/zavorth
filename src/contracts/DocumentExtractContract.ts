export const DOCUMENT_EXTRACT_CONTRACT_VERSION = 'document-extract-v1' as const;
export const DOCUMENT_EXTRACT_CAPABILITY_ID = 'document.extract' as const;

export type DocumentExtractMode = 'text' | 'tables' | 'metadata' | 'full';

export type DocumentExtractSource = {
  artifactId?: string | null;
  storageRef: string;
  contentType: string | null;
};

export type DocumentExtractPolicyDecision = {
  allowed: boolean;
  reason: string;
  piiDetected: boolean;
  redactionApplied: boolean;
};

export type DocumentExtractRequest = {
  source: DocumentExtractSource;
  mode?: DocumentExtractMode;
  sessionId?: string | null;
  correlationId?: string | null;
};

export type DocumentExtractTable = {
  tableId: string;
  rows: string[][];
  caption: string | null;
};

export type DocumentExtractResult = {
  ok: boolean;
  contractVersion: typeof DOCUMENT_EXTRACT_CONTRACT_VERSION;
  text: string;
  tables: DocumentExtractTable[];
  metadata: Record<string, unknown>;
  outputArtifactId: string | null;
  policyDecision: DocumentExtractPolicyDecision;
  receiptId: string;
  processedAt: string;
  error: string | null;
};
