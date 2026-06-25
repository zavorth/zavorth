export const QA_SMOKE_MATRIX_CONTRACT_VERSION = 'qa-smoke-matrix-v1' as const;
export const QA_SCENARIO_CAPABILITY_ID = 'qa.scenario' as const;

export type QaSmokeMatrixScope = 'channel' | 'provider' | 'runtime' | 'synthetic' | 'test-support';
export type QaSmokeMatrixStatus = 'ready' | 'attention' | 'blocked';

export type QaSmokeMatrixEntry = {
  id: string;
  scope: QaSmokeMatrixScope;
  target: string;
  command: string;
  packageScript: string | null;
  status: QaSmokeMatrixStatus;
  evidence: string[];
};

export type QaSmokeMatrixSnapshot = {
  generatedAt: string;
  contractVersion: typeof QA_SMOKE_MATRIX_CONTRACT_VERSION;
  status: QaSmokeMatrixStatus;
  summary: {
    entries: number;
    channel: number;
    provider: number;
    runtime: number;
    synthetic: number;
    testSupport: number;
    ready: number;
    attention: number;
    blocked: number;
    externalIoRequired: false;
    secretValuesSerialized: false;
  };
  entries: QaSmokeMatrixEntry[];
  receiptId: string;
};
