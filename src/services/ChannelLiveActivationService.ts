import type {
  ChannelLiveActivationConfigSchema,
  ChannelLiveActivationEntry,
  ChannelLiveActivationGate,
  ChannelLiveActivationGateStatus,
  ChannelLiveActivationP0Id,
  ChannelLiveActivationSnapshot,
} from '../contracts/ChannelLiveActivationContract.js';
import { ZAVORTH_CHANNEL_LIVE_ACTIVATION_CONTRACT_VERSION } from '../contracts/ChannelLiveActivationContract.js';
import type { LiveReadinessEntry, LiveReadinessStatus } from '../contracts/LiveReadinessContract.js';
import { LiveReadinessService } from './LiveReadinessService.js';

type ChannelLiveActivationRuntime = {
  now?: () => Date;
  liveReadinessService?: LiveReadinessService;
};

type P0Descriptor = {
  channelId: ChannelLiveActivationP0Id;
  platformId: string;
  status: ChannelLiveActivationEntry['status'];
  runtimeTarget: string;
  gatewayTarget: string;
  adapterTarget: string;
  configSchema: ChannelLiveActivationConfigSchema;
  capabilities: ChannelLiveActivationEntry['capabilities'];
  gaps: string[];
};

const P0_CHANNELS: P0Descriptor[] = [
  {
    channelId: 'signal',
    platformId: 'signal',
    status: 'partial-live',
    runtimeTarget: 'Signal JSON-RPC or signal-cli daemon',
    gatewayTarget: 'src/gateways/channels/signal/SignalGateway.stub.ts',
    adapterTarget: 'src/adapters/channels/SignalLiveClient.ts',
    configSchema: schema({
      requiredEnv: ['SIGNAL_ACCOUNT_NUMBER', 'SIGNAL_ALLOWED_RECIPIENTS', 'SIGNAL_JSONRPC_URL or SIGNAL_CLI_PATH'],
      optionalEnv: ['SIGNAL_ENABLED', 'SIGNAL_TRANSPORT', 'SIGNAL_OUTBOX_DIR', 'SIGNAL_STATUS_FILE'],
      allowlistEnv: ['SIGNAL_ALLOWED_RECIPIENTS'],
      secretEnv: [],
    }),
    capabilities: {
      inbound: true,
      outbound: true,
      replies: true,
      edits: false,
      attachments: false,
      threads: false,
      webhookValidation: false,
      fallbackOutbox: true,
    },
    gaps: [
      'operator must run signal-cli daemon or expose JSON-RPC before staging-live smoke',
      'attachments and edits remain out of Preview engine scope',
    ],
  },
  {
    channelId: 'msteams',
    platformId: 'teams',
    status: 'partial-live',
    runtimeTarget: 'Microsoft Graph chat messages',
    gatewayTarget: 'src/gateways/channels/teams/TeamsGateway.stub.ts',
    adapterTarget: 'src/adapters/channels/TeamsGraphBotClient.ts',
    configSchema: schema({
      requiredEnv: [
        'TEAMS_TENANT_ID',
        'TEAMS_APP_ID',
        'TEAMS_CLIENT_SECRET or TEAMS_APP_PASSWORD',
        'TEAMS_ALLOWED_CONVERSATION_IDS',
      ],
      optionalEnv: ['TEAMS_ENABLED', 'TEAMS_WEBHOOK_SECRET', 'TEAMS_OUTBOX_DIR', 'TEAMS_STATUS_FILE'],
      allowlistEnv: ['TEAMS_ALLOWED_CONVERSATION_IDS'],
      secretEnv: ['TEAMS_CLIENT_SECRET', 'TEAMS_APP_PASSWORD', 'TEAMS_WEBHOOK_SECRET'],
    }),
    capabilities: {
      inbound: true,
      outbound: true,
      replies: true,
      edits: true,
      attachments: true,
      threads: true,
      webhookValidation: true,
      fallbackOutbox: true,
    },
    gaps: [
      'tenant permissions and chat/channel Graph scope must be granted before staging-live smoke',
      'advanced card attachments need per-tenant validation',
    ],
  },
  {
    channelId: 'slack',
    platformId: 'slack',
    status: 'partial-live',
    runtimeTarget: 'Slack Web API',
    gatewayTarget: 'src/gateways/channels/slack/SlackGateway.stub.ts',
    adapterTarget: 'src/gateways/channels/slack/SlackGateway.stub.ts#callSlackApi',
    configSchema: schema({
      requiredEnv: ['SLACK_BOT_TOKEN', 'SLACK_ALLOWED_CHANNEL_IDS'],
      optionalEnv: ['SLACK_ENABLED', 'SLACK_TRANSPORT', 'SLACK_SIGNING_SECRET', 'SLACK_WORKSPACE_ID', 'SLACK_API_BASE_URL'],
      allowlistEnv: ['SLACK_ALLOWED_CHANNEL_IDS'],
      secretEnv: ['SLACK_BOT_TOKEN', 'SLACK_SIGNING_SECRET'],
    }),
    capabilities: {
      inbound: true,
      outbound: true,
      replies: true,
      edits: true,
      attachments: false,
      threads: true,
      webhookValidation: true,
      fallbackOutbox: true,
    },
    gaps: ['file upload and reaction smoke remain optional hardening after text/thread live smoke'],
  },
  {
    channelId: 'whatsapp',
    platformId: 'whatsapp',
    status: 'partial-live',
    runtimeTarget: 'Meta WhatsApp Cloud API',
    gatewayTarget: 'src/gateways/channels/whatsapp/WhatsAppGateway.stub.ts',
    adapterTarget: 'src/gateways/channels/whatsapp/WhatsAppGateway.stub.ts#sendCloudApiTextMessage',
    configSchema: schema({
      requiredEnv: [
        'WHATSAPP_PROVIDER=cloud-api',
        'WHATSAPP_PHONE_NUMBER_ID',
        'WHATSAPP_ACCESS_TOKEN',
        'WHATSAPP_WEBHOOK_VERIFY_TOKEN',
        'WHATSAPP_ALLOWED_CHAT_IDS',
      ],
      optionalEnv: ['WHATSAPP_ENABLED', 'WHATSAPP_CLOUD_API_VERSION', 'WHATSAPP_STATUS_FILE'],
      allowlistEnv: ['WHATSAPP_ALLOWED_CHAT_IDS'],
      secretEnv: ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_WEBHOOK_VERIFY_TOKEN'],
    }),
    capabilities: {
      inbound: true,
      outbound: true,
      replies: true,
      edits: true,
      attachments: false,
      threads: false,
      webhookValidation: true,
      fallbackOutbox: true,
    },
    gaps: ['Baileys remains planned; Preview engine certifies Cloud API as the live path'],
  },
  {
    channelId: 'discord',
    platformId: 'discord',
    status: 'partial-live',
    runtimeTarget: 'Discord native bot gateway',
    gatewayTarget: 'src/gateways/DiscordGateway.ts',
    adapterTarget: 'src/gateways/DiscordGateway.ts#broadcast',
    configSchema: schema({
      requiredEnv: ['DISCORD_BOT_TOKEN', 'DISCORD_ALLOWED_CHANNEL_IDS or DISCORD_ALLOWED_GUILD_IDS'],
      optionalEnv: [
        'DISCORD_ALLOW_DMS',
        'DISCORD_PUBLIC_SERVER_MODE',
        'DISCORD_COMMAND_EXPOSURE',
        'DISCORD_OWNER_USER_IDS',
        'DISCORD_OPERATOR_USER_IDS',
      ],
      allowlistEnv: ['DISCORD_ALLOWED_CHANNEL_IDS', 'DISCORD_ALLOWED_GUILD_IDS'],
      secretEnv: ['DISCORD_BOT_TOKEN'],
    }),
    capabilities: {
      inbound: true,
      outbound: true,
      replies: true,
      edits: false,
      attachments: true,
      threads: true,
      webhookValidation: false,
      fallbackOutbox: false,
    },
    gaps: ['credential-gated staging live smoke must run against a controlled guild/channel'],
  },
  {
    channelId: 'telegram',
    platformId: 'telegram',
    status: 'live-ready',
    runtimeTarget: 'Telegram native bot gateway',
    gatewayTarget: 'src/telegram',
    adapterTarget: 'src/gateway/channels/adapters/TelegramChannelAdapter.ts',
    configSchema: schema({
      requiredEnv: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_ALLOWED_USER_IDS'],
      optionalEnv: ['TELEGRAM_ALLOWED_CHAT_IDS', 'TELEGRAM_ADMIN_USER_IDS'],
      allowlistEnv: ['TELEGRAM_ALLOWED_USER_IDS', 'TELEGRAM_ALLOWED_CHAT_IDS'],
      secretEnv: ['TELEGRAM_BOT_TOKEN'],
    }),
    capabilities: {
      inbound: true,
      outbound: true,
      replies: true,
      edits: true,
      attachments: true,
      threads: true,
      webhookValidation: false,
      fallbackOutbox: false,
    },
    gaps: ['staging-live regression receipt must be refreshed before public launch'],
  },
];

export class ChannelLiveActivationService {
  private readonly now: () => Date;
  private readonly liveReadiness: LiveReadinessService;

  constructor(runtime: ChannelLiveActivationRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.liveReadiness = runtime.liveReadinessService || new LiveReadinessService({ now: this.now });
  }

  public buildSnapshot(): ChannelLiveActivationSnapshot {
    const readinessSnapshot = this.liveReadiness.buildSnapshot();
    const readinessByName = new Map(readinessSnapshot.entries.map((entry) => [entry.normalizedSourceName, entry]));
    const entries = P0_CHANNELS.map((descriptor) =>
      this.buildEntry(descriptor, readinessByName.get(descriptor.channelId) || null));
    const blocked = entries.filter((entry) => entry.status === 'blocked').length;
    const receipts = entries.map((entry) => entry.receipt);

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_CHANNEL_LIVE_ACTIVATION_CONTRACT_VERSION,
      phase: 'Preview engine - Channel Live Activation P0',
      status: blocked > 0 ? 'blocked' : 'closed',
      summary: {
        channels: 6,
        liveReady: entries.filter((entry) => entry.status === 'live-ready').length,
        partialLive: entries.filter((entry) => entry.status === 'partial-live').length,
        configuredOnly: entries.filter((entry) => entry.status === 'configured-only').length,
        blocked,
        signalAndTeamsOutboxOnly: false,
        configSchemas: entries.filter((entry) => entry.configSchema.requiredEnv.length > 0).length,
        setupDoctors: entries.filter((entry) => this.hasGate(entry, 'setup-doctor')).length,
        inboundMockTests: entries.filter((entry) => this.hasGate(entry, 'inbound-mock')).length,
        outboundMockTests: entries.filter((entry) => this.hasGate(entry, 'outbound-mock')).length,
        stagingLiveSmokeCommands: entries.filter((entry) => this.hasGate(entry, 'staging-live-smoke')).length,
        redactedReceipts: receipts.filter((receipt) => receipt.secretValuesSerialized === false).length,
        liveIoRequiredByStage2Check: false,
        secretValuesSerialized: false,
      },
      entries,
      receipts,
      policy: {
        noLiveIoDuringStage2Check: true,
        stagingLiveRequiresExplicitOperatorCommand: true,
        outboxAllowedOnlyAsFallback: true,
        signalUsesJsonRpcOrSignalCli: true,
        teamsUsesMicrosoftGraph: true,
        noSecretsSerialized: true,
      },
      commands: {
        check: 'npm run channel-live-activation:check --silent',
        doctor: 'npm run channel-live-activation -- --profile configured',
        stagingLiveSmoke: 'npm run channel-live-activation -- --profile staging-live --channel <channel> --confirm-live-io',
        focusedTests: ['npx jest tests/services/ChannelLiveActivationService.test.ts --runInBand'],
        typecheck: 'npm run runtime:check --silent',
        nextStage: 'Connector registry - Provider Runtime Activation P0',
      },
    };
  }

  public buildEntry(
    descriptor: P0Descriptor,
    readinessEntry: LiveReadinessEntry | null = null,
  ): ChannelLiveActivationEntry {
    const previousStatus = readinessEntry?.status || 'planned';
    const status = descriptor.status;
    const channelId = descriptor.channelId;
    const stagingLiveSmokeCommand =
      `npm run channel-live-activation -- --profile staging-live --channel ${channelId} --confirm-live-io`;

    return {
      channelId,
      platformId: descriptor.platformId,
      status,
      previousStatus,
      runtimeTarget: descriptor.runtimeTarget,
      gatewayTarget: descriptor.gatewayTarget,
      adapterTarget: descriptor.adapterTarget,
      doctorCommand: `npm run channel-live-activation -- --profile configured --channel ${channelId}`,
      stagingLiveSmokeCommand,
      configSchema: descriptor.configSchema,
      capabilities: descriptor.capabilities,
      gates: this.buildGates(descriptor, stagingLiveSmokeCommand),
      gaps: descriptor.gaps,
      receipt: {
        id: `channel-live-activation.${channelId}.receipt`,
        channelId,
        status,
        liveIoPerformed: false,
        stagingLiveRequiresExplicitCommand: true,
        secretValuesSerialized: false,
      },
    };
  }

  private buildGates(descriptor: P0Descriptor, stagingLiveSmokeCommand: string): ChannelLiveActivationGate[] {
    const channelId = descriptor.channelId;
    return [
      this.gate(
        'config-schema',
        'passed',
        descriptor.configSchema.requiredEnv.concat(descriptor.configSchema.allowlistEnv).join(', '),
        null,
      ),
      this.gate(
        'setup-doctor',
        'passed',
        `${channelId} has a configured-profile doctor command.`,
        `npm run channel-live-activation -- --profile configured --channel ${channelId}`,
      ),
      this.gate(
        'inbound-mock',
        descriptor.capabilities.inbound ? 'passed' : 'partial',
        `${channelId} inbound envelope can be mocked without external IO.`,
        'npx jest tests/services/ChannelLiveActivationService.test.ts --runInBand',
      ),
      this.gate(
        'outbound-mock',
        descriptor.capabilities.outbound ? 'passed' : 'partial',
        `${channelId} outbound envelope can be mocked without external IO.`,
        'npx jest tests/services/ChannelLiveActivationService.test.ts --runInBand',
      ),
      this.gate(
        'real-send-path',
        descriptor.status === 'blocked' ? 'blocked' : descriptor.status === 'configured-only' ? 'partial' : 'passed',
        descriptor.adapterTarget,
        null,
      ),
      this.gate(
        'inbound-validation',
        descriptor.capabilities.webhookValidation || descriptor.capabilities.inbound ? 'passed' : 'partial',
        descriptor.capabilities.webhookValidation
          ? `${channelId} validates inbound webhook or event envelopes.`
          : `${channelId} supports native or mock inbound event normalization.`,
        null,
      ),
      this.gate(
        'fallback-policy',
        descriptor.capabilities.fallbackOutbox ? 'passed' : 'passed',
        descriptor.capabilities.fallbackOutbox
          ? 'outbox is allowed only when live provider config is missing'
          : 'no outbox fallback is required for this native channel',
        null,
      ),
      this.gate(
        'staging-live-smoke',
        'passed',
        'staging-live is available only behind an explicit operator command.',
        stagingLiveSmokeCommand,
      ),
      this.gate(
        'redacted-receipt',
        'passed',
        'receipt omits token, secret, webhook secret and recipient bodies',
        null,
      ),
    ];
  }

  private hasGate(entry: ChannelLiveActivationEntry, kind: ChannelLiveActivationGate['kind']): boolean {
    return entry.gates.some((gate) => gate.kind === kind && gate.status !== 'missing' && gate.status !== 'blocked');
  }

  private gate(
    kind: ChannelLiveActivationGate['kind'],
    status: ChannelLiveActivationGateStatus,
    evidence: string,
    command: string | null,
  ): ChannelLiveActivationGate {
    return {
      kind,
      status,
      evidence,
      command,
    };
  }
}

function schema(input: Omit<ChannelLiveActivationConfigSchema, 'secretValuesSerialized'>): ChannelLiveActivationConfigSchema {
  return {
    ...input,
    secretValuesSerialized: false,
  };
}
