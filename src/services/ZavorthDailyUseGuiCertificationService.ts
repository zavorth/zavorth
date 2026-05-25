import type { CanonicalPublicApiService } from '../api/public/CanonicalPublicApiService.js';
import type {
  ZavorthDailyUseGuiCapabilityCheck,
  ZavorthDailyUseGuiCapabilityId,
  ZavorthDailyUseGuiCertificationSnapshot,
} from '../contracts/ZavorthDailyUseGuiCertificationContract.js';

type CertificationInput = {
  publicApi: CanonicalPublicApiService;
  sessionId?: string | null;
  request?: string | null;
};

type CheckBuilder = () => Promise<ZavorthDailyUseGuiCapabilityCheck>;

function nonEmpty(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return Boolean(value && typeof value === 'object');
}

function ready(
  id: ZavorthDailyUseGuiCapabilityId,
  label: string,
  evidence: string[],
): ZavorthDailyUseGuiCapabilityCheck {
  return {
    id,
    label,
    status: 'ready',
    authority: 'runtime-api-v1',
    evidence,
    nextAction: null,
  };
}

function blocked(
  id: ZavorthDailyUseGuiCapabilityId,
  label: string,
  error: unknown,
): ZavorthDailyUseGuiCapabilityCheck {
  return {
    id,
    label,
    status: 'blocked',
    authority: 'runtime-api-v1',
    evidence: [error instanceof Error ? error.message : String(error)],
    nextAction: 'Repair this Runtime API v1 surface before wiring Desktop or Tauri clients.',
  };
}

export class ZavorthDailyUseGuiCertificationService {
  public async certify(input: CertificationInput): Promise<ZavorthDailyUseGuiCertificationSnapshot> {
    const sessionId = String(input.sessionId || 'gui-certification').trim() || 'gui-certification';
    const request = String(input.request || 'Daily-use GUI certification preview.').trim()
      || 'Daily-use GUI certification preview.';
    const publicApi = input.publicApi;
    const checks = await Promise.all([
      this.guard('status', 'Runtime status', async () => {
        const status = publicApi.readRuntimeStatus();
        return ready('status', 'Runtime status', [
          `surface=${status.surface}`,
          `status=${status.status}`,
          `executionAuthority=${status.runtime.executionAuthority}`,
        ]);
      }),
      this.guard('health', 'Runtime health', async () => {
        const health = publicApi.readRuntimeHealth('fast');
        return ready('health', 'Runtime health', [
          `surface=${health.surface}`,
          `healthy=${health.healthy}`,
          `dashboardCanExecute=${health.safety.dashboardCanExecute}`,
        ]);
      }),
      this.guard('providers', 'Provider matrix', async () => {
        const providers = publicApi.readProviders();
        return ready('providers', 'Provider matrix', [
          `surface=${providers.surface}`,
          `providers=${providers.summary.total}`,
          `rawSecretsSerialized=${providers.safety.rawSecretsSerialized}`,
        ]);
      }),
      this.guard('channels', 'Channel mesh', async () => {
        const channels = publicApi.readChannels();
        return ready('channels', 'Channel mesh', [
          `surface=${channels.surface}`,
          `channels=${Array.isArray((channels as any).channels) ? (channels as any).channels.length : 0}`,
          `telegramPrivileged=${(channels as any).safety?.telegramPrivileged}`,
        ]);
      }),
      this.guard('approvals', 'Approvals inbox', async () => {
        const approvals = await publicApi.readApprovals({ status: 'pending', limit: 5 });
        return ready('approvals', 'Approvals inbox', [
          `surface=${approvals.surface}`,
          `total=${approvals.total}`,
          `scoped=${approvals.safety.approvalScopedToExactAction}`,
        ]);
      }),
      this.guard('receipts', 'Visual receipts', async () => {
        const receipts = publicApi.readReceipts({ includeAdvanced: false });
        return ready('receipts', 'Visual receipts', [
          `surface=${receipts.apiSurface}`,
          `cards=${Array.isArray((receipts as any).cards) ? (receipts as any).cards.length : 0}`,
          'projection=visual',
        ]);
      }),
      this.guard('missions', 'Mission projection', async () => {
        const missions = publicApi.readMissions({ request, source: 'web' });
        return ready('missions', 'Mission projection', [
          `surface=${missions.surface}`,
          `total=${missions.total}`,
          `sourceOfTruth=${missions.projection.sourceOfTruth}`,
        ]);
      }),
      this.guard('chat', 'Preview-first chat', async () => {
        const chat = await publicApi.submitChat({ message: request, sessionId, live: false });
        return ready('chat', 'Preview-first chat', [
          `surface=${chat.surface}`,
          `accepted=${chat.accepted}`,
          `live=${chat.live}`,
          `dryRunByDefault=${chat.safety.dryRunByDefault}`,
        ]);
      }),
      this.guard('events', 'Runtime events', async () => {
        const events = await publicApi.readRuntimeEvents({ sessionId });
        return ready('events', 'Runtime events', [
          `surface=${events.surface}`,
          `events=${Array.isArray(events.data) ? events.data.length : 0}`,
          `ssePath=${events.streaming?.ssePath || 'unavailable'}`,
        ]);
      }),
      this.certifyGovernedActions(publicApi),
    ]);

    const summary = {
      ready: checks.filter((check) => check.status === 'ready').length,
      attention: checks.filter((check) => check.status === 'attention').length,
      blocked: checks.filter((check) => check.status === 'blocked').length,
      total: checks.length,
    };
    return {
      schemaVersion: 1,
      surface: 'daily-use-gui-certification-v1',
      generatedAt: new Date().toISOString(),
      summary: {
        ...summary,
        status: summary.blocked > 0 ? 'blocked' : summary.attention > 0 ? 'attention' : 'ready',
      },
      checks,
      safety: {
        dashboardCanExecute: false,
        desktopCanBypassRuntime: false,
        policyBrokerRequiredForMutableActions: true,
        previewFirstChat: true,
        rawSecretsSerialized: false,
      },
    };
  }

  private async guard(
    id: ZavorthDailyUseGuiCapabilityId,
    label: string,
    builder: CheckBuilder,
  ): Promise<ZavorthDailyUseGuiCapabilityCheck> {
    try {
      const check = await builder();
      return nonEmpty(check.evidence) ? check : {
        ...check,
        status: 'attention',
        nextAction: 'Add stronger readiness evidence for this GUI surface.',
      };
    } catch (error) {
      return blocked(id, label, error);
    }
  }

  private async certifyGovernedActions(
    publicApi: CanonicalPublicApiService,
  ): Promise<ZavorthDailyUseGuiCapabilityCheck> {
    const requiredMethods = [
      'approveApproval',
      'denyApproval',
      'cancelMission',
      'testProvider',
      'executeChannelAction',
    ];
    const missing = requiredMethods.filter((method) => typeof (publicApi as any)[method] !== 'function');
    return {
      id: 'actions',
      label: 'Governed actions',
      status: missing.length > 0 ? 'blocked' : 'ready',
      authority: 'runtime-api-v1',
      evidence: missing.length > 0
        ? [`missing=${missing.join(',')}`]
        : [
            'approval.approve',
            'approval.deny',
            'mission.cancel',
            'provider.test',
            'channel.action',
          ],
      nextAction: missing.length > 0
        ? 'Restore missing governed action methods before GUI clients can operate safely.'
        : null,
    };
  }
}
