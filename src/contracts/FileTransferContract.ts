export const FILE_TRANSFER_CONTRACT_VERSION = 'file-transfer-v1' as const;
export const FILE_TRANSFER_CAPABILITY_ID = 'file.transfer' as const;

export type FileTransferDirection = 'import' | 'export' | 'copy' | 'move';
export type FileTransferStatus = 'planned' | 'approved' | 'completed' | 'failed' | 'blocked';

export type FileTransferEndpoint = {
  kind: 'workspace-path' | 'artifact-ref' | 'external-uri';
  ref: string;
  contentType?: string | null;
};

export type FileTransferPolicyDecision = {
  allowed: boolean;
  reason: string;
  requiresApproval: boolean;
  redacted: boolean;
};

export type FileTransferRequest = {
  direction: FileTransferDirection;
  source: FileTransferEndpoint;
  destination: FileTransferEndpoint;
  overwrite?: boolean;
  sessionId?: string | null;
  correlationId?: string | null;
};

export type FileTransferResult = {
  ok: boolean;
  contractVersion: typeof FILE_TRANSFER_CONTRACT_VERSION;
  status: FileTransferStatus;
  artifactId: string | null;
  bytesTransferred: number | null;
  policyDecision: FileTransferPolicyDecision;
  receiptId: string;
  processedAt: string;
  error: string | null;
};
