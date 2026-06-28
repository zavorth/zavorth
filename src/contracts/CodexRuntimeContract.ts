export * from './runtime/CodexRuntimeContract.js';

export const ZAVORTH_CODEX_RUNTIME_CONTRACT_VERSION_PUBLIC_MARKER =
  'ZAVORTH_CODEX_RUNTIME_CONTRACT_VERSION';

export type CodexRuntimePublicAuditVocabulary = {
  transportKind: 'CodexRuntimeTransportKind';
  transports: ['stdio-app-server', 'websocket-app-server'];
  rpcMethod: 'CodexRuntimeRpcMethod';
  turnStart: 'thread/turn/start';
  approvalBridge: 'CodexRuntimeApprovalBridge';
  eventProjection: 'CodexRuntimeEventProjection';
  mediaUnderstandingJob: 'CodexRuntimeMediaUnderstandingJob';
  migrationPlan: 'CodexRuntimeMigrationPlan';
  receiptEvent: 'agent.runtime.receipt';
  policy: {
    secretValuesSerialized: false;
  };
};
