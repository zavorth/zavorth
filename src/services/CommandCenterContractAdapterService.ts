import type { CanonicalPublicApiService } from '../api/public/CanonicalPublicApiService.js';
import {
  COMMAND_CENTER_CONTRACT_ADAPTER_VERSION,
  type CommandCenterContractAdapterSnapshot,
} from '../contracts/CommandCenterContractAdapterContract.js';
import type { PermissionStatus } from '../contracts/PermissionRequest.js';

export type CommandCenterContractAdapterInput = {
  includeAdvanced?: boolean;
  providerId?: string | null;
  selectedProviderId?: string | null;
  approvalStatus?: PermissionStatus | 'all';
  approvalLimit?: number;
  missionRequest?: string | null;
  missionTemplateId?: string | null;
};

export class CommandCenterContractAdapterService {
  constructor(private readonly publicApi: CanonicalPublicApiService) {}

  public async buildSnapshot(input: CommandCenterContractAdapterInput = {}): Promise<CommandCenterContractAdapterSnapshot> {
    const generatedAt = new Date().toISOString();
    const [approvals] = await Promise.all([
      this.publicApi.readApprovals({
        status: input.approvalStatus || 'pending',
        limit: input.approvalLimit || 20,
      }),
    ]);

    return {
      contractVersion: COMMAND_CENTER_CONTRACT_ADAPTER_VERSION,
      schemaVersion: 1,
      surface: 'command-center-contract-adapter',
      generatedAt,
      source: {
        authority: 'runtime-api-v1',
        commandCenterExecutionAuthority: false,
        controllerMutationAuthority: false,
      },
      runtime: this.publicApi.readRuntimeStatus(),
      health: this.publicApi.readRuntimeHealth('fast'),
      providers: this.publicApi.readProviders({
        includeAdvanced: input.includeAdvanced === true,
        selectedTarget: input.selectedProviderId || input.providerId || null,
      }),
      channels: this.publicApi.readChannels({
        selectedId: null,
      }),
      approvals,
      receipts: this.publicApi.readReceipts({
        includeAdvanced: input.includeAdvanced === true,
      }),
      missions: this.publicApi.readMissions({
        request: input.missionRequest || 'Review the current Zavorth mission.',
        selectedTemplateId: input.missionTemplateId || null,
        source: 'web',
      }),
      parity: {
        providersFromCanonicalApi: true,
        channelsFromCanonicalApi: true,
        approvalsFromCanonicalApi: true,
        receiptsFromCanonicalApi: true,
        missionsFromCanonicalApi: true,
        webCliApiShareProjection: true,
      },
      endpoints: {
        runtime: '/api/v1/status',
        health: '/api/v1/health',
        providers: '/api/v1/providers',
        channels: '/api/v1/channels',
        approvals: '/api/v1/approvals',
        receipts: '/api/v1/receipts',
        missions: '/api/v1/missions',
        approvalApprove: '/api/v1/approvals/:id/approve',
        approvalDeny: '/api/v1/approvals/:id/deny',
        missionCancel: '/api/v1/missions/:id/cancel',
        providerTest: '/api/v1/providers/:id/test',
        channelAction: '/api/v1/channels/:id/action',
      },
      safety: {
        projectionOnly: true,
        rawSecretsSerialized: false,
        policyBrokerRequiredForActions: true,
        telegramPrivileged: false,
      },
    };
  }
}
