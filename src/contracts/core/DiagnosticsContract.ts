export const DIAGNOSTICS_CONTRACT_VERSION = 'diagnostics-v1' as const;
export const DIAGNOSTICS_TRACE_CAPABILITY_ID = 'diagnostics.trace' as const;

export type DiagnosticsSignalKind = 'trace' | 'metric' | 'log' | 'health';
export type DiagnosticsStatus = 'healthy' | 'degraded' | 'failed' | 'unknown';

export type DiagnosticsSignal = {
  kind: DiagnosticsSignalKind;
  name: string;
  value: number | string | boolean | null;
  unit: string | null;
  observedAt: string;
  attributes: Record<string, unknown>;
};

export type DiagnosticsSnapshotRequest = {
  scope: 'runtime' | 'provider' | 'channel' | 'node' | 'workspace';
  includeLogs?: boolean;
  sessionId?: string | null;
  correlationId?: string | null;
};

export type DiagnosticsSnapshotResult = {
  ok: boolean;
  contractVersion: typeof DIAGNOSTICS_CONTRACT_VERSION;
  status: DiagnosticsStatus;
  signals: DiagnosticsSignal[];
  reportArtifactId: string | null;
  receiptId: string;
  processedAt: string;
  error: string | null;
};
