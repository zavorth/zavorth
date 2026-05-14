import type {
  CanonicalApprovalsDTO,
  CanonicalChannelMeshDTO,
  CanonicalMissionsDTO,
  CanonicalProviderMeshDTO,
  CanonicalReceiptsDTO,
  CanonicalRuntimeHealthDTO,
  CanonicalRuntimeStatusDTO,
} from './public/rest/runtime-api-v1-dto.js';

export const COMMAND_CENTER_CONTRACT_ADAPTER_VERSION = 'command-center-contract-adapter/v1' as const;

export type CommandCenterContractAdapterSnapshot = {
  contractVersion: typeof COMMAND_CENTER_CONTRACT_ADAPTER_VERSION;
  schemaVersion: 1;
  surface: 'command-center-contract-adapter';
  generatedAt: string;
  source: {
    authority: 'runtime-api-v1';
    commandCenterExecutionAuthority: false;
    controllerMutationAuthority: false;
  };
  runtime: CanonicalRuntimeStatusDTO;
  health: CanonicalRuntimeHealthDTO;
  providers: CanonicalProviderMeshDTO;
  channels: CanonicalChannelMeshDTO;
  approvals: CanonicalApprovalsDTO;
  receipts: CanonicalReceiptsDTO;
  missions: CanonicalMissionsDTO;
  parity: {
    providersFromCanonicalApi: true;
    channelsFromCanonicalApi: true;
    approvalsFromCanonicalApi: true;
    receiptsFromCanonicalApi: true;
    missionsFromCanonicalApi: true;
    webCliApiShareProjection: true;
  };
  endpoints: {
    runtime: '/api/v1/status';
    health: '/api/v1/health';
    providers: '/api/v1/providers';
    channels: '/api/v1/channels';
    approvals: '/api/v1/approvals';
    receipts: '/api/v1/receipts';
    missions: '/api/v1/missions';
    approvalApprove: '/api/v1/approvals/:id/approve';
    approvalDeny: '/api/v1/approvals/:id/deny';
    missionCancel: '/api/v1/missions/:id/cancel';
    providerTest: '/api/v1/providers/:id/test';
    channelAction: '/api/v1/channels/:id/action';
  };
  safety: {
    projectionOnly: true;
    rawSecretsSerialized: false;
    policyBrokerRequiredForActions: true;
    telegramPrivileged: false;
  };
};
