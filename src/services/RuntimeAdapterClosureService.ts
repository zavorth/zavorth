import type { ChannelMeshParityEntry } from '../contracts/ChannelMeshParityContract.js';
import type {
  RuntimeAdapterClosureEntry,
  RuntimeAdapterClosureSnapshot,
  RuntimeAdapterClosureStatus,
  RuntimeAdapterClosureStrategy,
} from '../contracts/RuntimeAdapterClosureContract.js';
import { ZAVORTH_RUNTIME_ADAPTER_CLOSURE_CONTRACT_VERSION } from '../contracts/RuntimeAdapterClosureContract.js';
import type { ProviderMeshParityProviderEntry } from '../contracts/ProviderMeshParityContract.js';
import { ChannelMeshParityService } from './ChannelMeshParityService.js';
import { ParityCertificationService } from './ParityCertificationService.js';
import { ProviderMeshParityService } from './ProviderMeshParityService.js';

type RuntimeAdapterClosureRuntime = {
  now?: () => Date;
  providerMeshParityService?: ProviderMeshParityService;
  channelMeshParityService?: ChannelMeshParityService;
  parityCertificationService?: ParityCertificationService;
};

const CHANNEL_RUNTIME_STRATEGIES = new Set([
  'webhook-runtime',
  'generic-webhook-template',
  'bot-api-template',
  'local-bridge',
]);

export class RuntimeAdapterClosureService {
  private readonly now: () => Date;
  private readonly providerMesh: ProviderMeshParityService;
  private readonly channelMesh: ChannelMeshParityService;
  private readonly certification: ParityCertificationService;

  constructor(runtime: RuntimeAdapterClosureRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.providerMesh = runtime.providerMeshParityService || new ProviderMeshParityService({
      now: this.now,
    });
    this.channelMesh = runtime.channelMeshParityService || new ChannelMeshParityService({
      now: this.now,
    });
    this.certification = runtime.parityCertificationService || new ParityCertificationService({
      now: this.now,
    });
  }

  public buildSnapshot(): RuntimeAdapterClosureSnapshot {
    const providerSnapshot = this.providerMesh.buildSnapshot();
    const channelSnapshot = this.channelMesh.buildSnapshot();
    const certificationSnapshot = this.certification.buildSnapshot();
    const providerEntries = providerSnapshot.entries
      .filter((entry) => entry.generatedProviderManifest && entry.status === 'generic-compatible' && entry.runtimeSupported)
      .map((entry) => this.buildProviderEntry(entry));
    const channelEntries = channelSnapshot.entries
      .filter((entry) => !entry.gatewayStatus && entry.status === 'adapter-backed' && CHANNEL_RUNTIME_STRATEGIES.has(entry.route.transportStrategy))
      .map((entry) => this.buildChannelEntry(entry));
    const remainingProviderTemplates = providerSnapshot.summary.templateReady + providerSnapshot.summary.unmapped;
    const remainingChannelTemplates = channelSnapshot.summary.webhookTemplates
      + channelSnapshot.summary.bridgeTemplates
      + channelSnapshot.summary.templateReady
      + channelSnapshot.summary.unmapped;
    const status: RuntimeAdapterClosureStatus = remainingProviderTemplates === 0
      && providerSnapshot.summary.unsupported === 0
      && remainingChannelTemplates === 0
      ? 'closed'
      : 'attention';

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_RUNTIME_ADAPTER_CLOSURE_CONTRACT_VERSION,
      status,
      summary: {
        providerTemplatesClosed: providerEntries.length,
        channelTemplatesClosed: channelEntries.length,
        remainingProviderTemplates,
        remainingProviderUnsupported: providerSnapshot.summary.unsupported,
        remainingChannelTemplates,
        remainingChannelUnsupported: channelSnapshot.summary.unsupported,
        certificationP1Gaps: certificationSnapshot.summary.sourceP1Gaps,
        certificationStatus: certificationSnapshot.status,
        releaseReady: certificationSnapshot.summary.releaseReady,
        liveExternalCallRequired: false,
        liveChannelSendRequired: false,
        secretValuesSerialized: false,
      },
      entries: [...providerEntries, ...channelEntries].sort((left, right) =>
        `${left.surface}:${left.id}`.localeCompare(`${right.surface}:${right.id}`),
      ),
      providerSnapshot: {
        contractVersion: providerSnapshot.contractVersion,
        summary: providerSnapshot.summary,
      },
      channelSnapshot: {
        contractVersion: channelSnapshot.contractVersion,
        summary: channelSnapshot.summary,
      },
      certification: {
        contractVersion: certificationSnapshot.contractVersion,
        profile: certificationSnapshot.profile,
        status: certificationSnapshot.status,
        summary: certificationSnapshot.summary,
      },
      commands: {
        check: 'npm run runtime-adapter-closure:check --silent',
        providerParity: 'npm run provider-mesh-parity:check --silent',
        channelParity: 'npm run channel-mesh-parity:check --silent',
        certify: 'npm run parity-certify --silent',
        nextStage: 'Etapa 12 - Native Capability Closure',
      },
      policy: {
        closureIsRuntimeClassificationOnly: true,
        noProviderCalls: true,
        noLiveChannelSends: true,
        noSecretsSerialized: true,
        unsupportedChannelsStayVisible: true,
      },
    };
  }

  private buildProviderEntry(entry: ProviderMeshParityProviderEntry): RuntimeAdapterClosureEntry {
    return {
      surface: 'provider.call',
      id: entry.normalizedSourceName,
      previousTier: 'p1-provider-template',
      closureStrategy: this.providerStrategy(entry),
      status: 'generic-compatible',
      remainingTier: 'none',
      runtimeSupported: true,
      liveExternalCallRequired: false,
      liveChannelSendRequired: false,
      receipt: `runtime-adapter-closure.provider.${entry.normalizedSourceName}.receipt`,
    };
  }

  private buildChannelEntry(entry: ChannelMeshParityEntry): RuntimeAdapterClosureEntry {
    return {
      surface: 'channel.message',
      id: entry.normalizedSourceName,
      previousTier: entry.route.transportStrategy === 'local-bridge'
        ? 'p1-channel-bridge-template'
        : entry.route.transportStrategy === 'bot-api-template'
          ? 'p1-channel-bot-template'
          : 'p1-channel-webhook-template',
      closureStrategy: this.channelStrategy(entry),
      status: 'adapter-backed',
      remainingTier: 'none',
      runtimeSupported: true,
      liveExternalCallRequired: false,
      liveChannelSendRequired: false,
      receipt: `runtime-adapter-closure.channel.${entry.normalizedSourceName}.receipt`,
    };
  }

  private providerStrategy(entry: ProviderMeshParityProviderEntry): RuntimeAdapterClosureStrategy {
    if (entry.adapterStrategy === 'local-openai-compatible-runtime') {
      return 'local-provider-runtime';
    }
    if (entry.adapterStrategy === 'anthropic-compatible-runtime') {
      return 'anthropic-provider-runtime';
    }
    return 'generic-provider-runtime';
  }

  private channelStrategy(entry: ChannelMeshParityEntry): RuntimeAdapterClosureStrategy {
    if (entry.route.transportStrategy === 'local-bridge') {
      return 'local-bridge-channel-runtime';
    }
    if (entry.route.transportStrategy === 'bot-api-template') {
      return 'bot-api-channel-runtime';
    }
    return 'webhook-channel-runtime';
  }
}
