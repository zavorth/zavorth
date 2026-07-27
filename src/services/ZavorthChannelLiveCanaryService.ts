import {
  ZAVORTH_CHANNEL_LIVE_CANARY_VERSION,
  type ZavorthChannelLiveCanaryItem,
  type ZavorthChannelLiveCanaryItemStatus,
  type ZavorthChannelLiveCanarySnapshot,
  type ZavorthChannelLiveCanaryStatus,
} from '../contracts/ZavorthChannelLiveCanaryContract.js';
import { ZavorthChannelDeepeningService } from './ZavorthChannelDeepeningService.js';

type Runtime = {
  now?: () => Date;
  env?: Record<string, string | undefined>;
};

export class ZavorthChannelLiveCanaryService {
  private readonly now: () => Date;
  private readonly env: Record<string, string | undefined>;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.env = runtime.env || process.env;
  }

  public buildSnapshot(): ZavorthChannelLiveCanarySnapshot {
    const readiness = new ZavorthChannelDeepeningService({
      now: this.now,
      env: this.env,
    }).buildSnapshot();
    const items = readiness.items.map((item): ZavorthChannelLiveCanaryItem => {
      const status = this.resolveStatus(item);
      return {
        id: item.id,
        label: item.label,
        status,
        canRunLiveProof: status === 'configured_pending_proof',
        safeDefaultRoute: item.safeDefaultRoute,
        configuredRequiredEnvKeys: item.configuration.configuredRequiredEnvKeys,
        missingRequiredEnvKeys: item.configuration.missingRequiredEnvKeys,
        allowlistConfigured: item.configuration.allowlistConfigured,
        requiredEnvKeys: item.configuration.requiredEnvKeys,
        allowlistEnvKeys: item.configuration.allowlistEnvKeys,
        canaryCommand: item.commands.liveProof,
        nextAction: this.nextAction(status, item.nextAction),
      };
    });
    const summary = summarize(items);
    const status: ZavorthChannelLiveCanaryStatus = summary.blocked > 0
      ? 'blocked'
      : summary.liveReady > 0 || summary.canRunLiveProof > 0
        ? 'ready'
        : 'attention';

    return {
      contractVersion: ZAVORTH_CHANNEL_LIVE_CANARY_VERSION,
      generatedAt: this.now().toISOString(),
      surface: 'channel-live-canary',
      status,
      summary,
      items,
      guarantees: {
        noExternalIoDuringCheck: true,
        liveProofRequiresCredentials: true,
        outboundRequiresAllowlist: true,
        defaultRoutingRequiresProofReceipt: true,
        secretsRedacted: true,
      },
      commands: {
        inspect: 'npm run zavorth:channel-live-canary --silent',
        inspectJson: 'npm run zavorth:channel-live-canary:json --silent',
        check: 'npm run zavorth:channel-live-canary:check --silent',
      },
    };
  }

  public renderText(snapshot: ZavorthChannelLiveCanarySnapshot): string {
    return [
      'Zavorth Channel Live Canary',
      `status: ${snapshot.status}`,
      `summary: live=${snapshot.summary.liveReady}, canary-ready=${snapshot.summary.canRunLiveProof}, needs-credentials=${snapshot.summary.needsCredentials}, needs-allowlist=${snapshot.summary.needsAllowlist}, needs-bridge=${snapshot.summary.needsBridge}`,
      '',
      ...snapshot.items.slice(0, 12).map((item) =>
        `- ${item.label} [${item.status}] ${item.nextAction}`,
      ),
      snapshot.items.length > 12 ? `- ? ${snapshot.items.length - 12} more channel(s)` : '',
      '',
      `Check: ${snapshot.commands.check}`,
    ].filter(Boolean).join('\n');
  }

  private resolveStatus(item: ReturnType<ZavorthChannelDeepeningService['buildSnapshot']>['items'][number]): ZavorthChannelLiveCanaryItemStatus {
    if (item.family === 'internal') return 'internal_ready';
    if (item.status === 'live_ready') return 'live_ready';
    if (item.status === 'cataloged') return 'catalog_only';
    if (item.status === 'requires_bridge') return 'needs_bridge';
    if (item.configuration.missingRequiredEnvKeys.length > 0) return 'needs_credentials';
    if (!item.configuration.allowlistConfigured) return 'needs_allowlist';
    if (item.status === 'outbox_ready') return 'safe_outbox';
    return 'configured_pending_proof';
  }

  private nextAction(status: ZavorthChannelLiveCanaryItemStatus, fallback: string): string {
    if (status === 'live_ready') return 'Live proof exists; keep routing through policy, receipts and rate limits.';
    if (status === 'configured_pending_proof') return 'Run the live proof command after reviewing recipients and policy.';
    if (status === 'needs_allowlist') return 'Configure recipient/channel allowlist before live proof.';
    if (status === 'needs_credentials') return 'Configure the required channel credential or local bridge reference.';
    if (status === 'needs_bridge') return 'Start or configure the local bridge before live proof.';
    if (status === 'safe_outbox') return 'Outbound remains in safand outbox until credentials, allowlist and proof are ready.';
    if (status === 'catalog_only') return 'Choose and configure the concrete native route before live use.';
    return fallback;
  }
}

function summarize(items: ZavorthChannelLiveCanaryItem[]): ZavorthChannelLiveCanarySnapshot['summary'] {
  const count = (status: ZavorthChannelLiveCanaryItemStatus) => items.filter((item) => item.status === status).length;
  return {
    total: items.length,
    external: items.filter((item) => item.status !== 'internal_ready').length,
    liveReady: count('live_ready'),
    configuredPendingProof: count('configured_pending_proof'),
    needsCredentials: count('needs_credentials'),
    needsAllowlist: count('needs_allowlist'),
    needsBridge: count('needs_bridge'),
    safeOutbox: count('safe_outbox'),
    catalogOnly: count('catalog_only'),
    canRunLiveProof: items.filter((item) => item.canRunLiveProof).length,
    blocked: 0,
  };
}
