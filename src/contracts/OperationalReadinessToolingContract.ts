export * from './core/OperationalReadinessToolingContract.js';

export const ZAVORTH_OPERATIONAL_READINESS_TOOLING_CONTRACT_VERSION_PUBLIC_MARKER =
  'ZAVORTH_OPERATIONAL_READINESS_TOOLING_CONTRACT_VERSION';

export type OperationalReadinessPublicAuditVocabulary = {
  phaseId: 'OperationalReadinessPhaseId';
  gate: 'OperationalReadinessGate';
  gap: 'OperationalReadinessGap';
  pluginInventoryItem: 'OperationalReadinessPluginInventoryItem';
  snapshot: 'OperationalReadinessSnapshot';
  checkpoint: 'gate-8-operational-tooling';
  policy: {
    liveExternalCallRequired: false;
    liveChannelSendRequired: false;
    liveDeviceRequired: false;
    liveMemoryWriteRequired: false;
    filesystemReadRequired: false;
    secretValuesSerialized: false;
  };
};
