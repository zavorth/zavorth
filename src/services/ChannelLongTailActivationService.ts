import { ZAVORTH_CHANNEL_LONG_TAIL_ACTIVATION_CONTRACT_VERSION } from '../contracts/ChannelLongTailActivationContract.js';

import {
  BotHttpChannelLiveClient,
  LocalBridgeChannelLiveClient,
  WebhookChannelLiveClient,
  type ChannelLongTailAdapterFamily,
  type ChannelLongTailExecFileImpl,
} from '../adapters/channels/ChannelLongTailLiveClients.js';
import type {
  ChannelLongTailActivationConfigSchema,
  ChannelLongTailActivationEntry,
  ChannelLongTailActivationGate,
  ChannelLongTailActivationGateStatus,
  ChannelLongTailActivationId,
  ChannelLongTailActivationSnapshot,
  ChannelLongTailConfiguredDoctorReceipt,
  ChannelLongTailStagingLiveReceipt,
} from '../contracts/ChannelLongTailActivationContract.js';

import type { LiveReadinessEntry } from '../contracts/LiveReadinessContract.js';
import { LiveReadinessService } from './LiveReadinessService.js';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';

type ChannelLongTailActivationRuntime = {
  now?: () => Date;
  liveReadinessService?: LiveReadinessService;
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  execFileImpl?: ChannelLongTailExecFileImpl;
};

type LongTailDescriptor = {
  channelId: ChannelLongTailActivationId;
  family: ChannelLongTailAdapterFamily;
  runtimeTarget: string;
  adapterTarget: string;
  configSchema: ChannelLongTailActivationConfigSchema;
  capabilities: ChannelLongTailActivationEntry['capabilities'];
  gaps: string[];
};

const LONG_TAIL_CHANNELS: LongTailDescriptor[] = [
  botHttp('clickclack', 'ClickClack Bot API', ['CLICKCLACK_BOT_TOKEN', 'CLICKCLACK_TARGET_IDS']),
  webhook('feishu', 'Feishu incoming webhook', ['FEISHU_WEBHOOK_URL'], ['FEISHU_WEBHOOK_SECRET']),
  webhook('googlechat', 'Google Chat incoming webhook', ['GOOGLECHAT_WEBHOOK_URL'], []),
  webhook('mattermost', 'Mattermost incoming webhook', ['MATTERMOST_WEBHOOK_URL'], ['MATTERMOST_WEBHOOK_TOKEN']),
  webhook('nextcloud-talk', 'Nextcloud Talk webhook', ['NEXTCLOUD_TALK_WEBHOOK_URL'], ['NEXTCLOUD_TALK_WEBHOOK_TOKEN']),
  webhook('synology-chat', 'Synology Chat incoming webhook', ['SYNOLOGY_CHAT_WEBHOOK_URL'], ['SYNOLOGY_CHAT_WEBHOOK_TOKEN']),
  webhook('webhooks', 'generic webhook target', ['WEBHOOKS_TARGET_URL'], ['WEBHOOKS_AUTH_TOKEN']),
  botHttp('line', 'LINE Messaging API', ['LINE_CHANNEL_ACCESS_TOKEN', 'LINE_TARGET_IDS']),
  botHttp('qqbot', 'QQ Bot HTTP API', ['QQBOT_BOT_TOKEN', 'QQBOT_TARGET_IDS']),
  botHttp('twitch', 'Twitch chat/send API', ['TWITCH_OAUTH_TOKEN', 'TWITCH_CHANNELS']),
  botHttp('zalo', 'Zalo Official Account API', ['ZALO_ACCESS_TOKEN', 'ZALO_RECIPIENT_IDS']),
  botHttp('zalouser', 'Zalo user messaging API', ['ZALOUSER_ACCESS_TOKEN', 'ZALOUSER_RECIPIENT_IDS']),
  botHttp('sms', 'SMS provider send API', ['SMS_API_BASE_URL', 'SMS_PROVIDER_TOKEN', 'SMS_ALLOWED_RECIPIENTS']),
  relay('irc', 'IRC relay HTTP bridge', ['IRC_BRIDGE_URL or IRC_BRIDGE_SCRIPT', 'IRC_ALLOWED_CHANNELS']),
  relay('matrix', 'Matrix homeserver client API', ['MATRIX_HOMESERVER_URL', 'MATRIX_ACCESS_TOKEN', 'MATRIX_ROOM_IDS']),
  relay('nostr', 'Nostr relay publisher', ['NOSTR_RELAY_URL', 'NOSTR_SIGNING_KEY_REF', 'NOSTR_ALLOWED_RECIPIENTS']),
  relay('tlon', 'Tlon/Groups relay bridge', ['TLON_BRIDGE_URL', 'TLON_ALLOWED_RECIPIENTS']),
  relay('yuanbao', 'Tencent Yuanbao relay bridge', ['YUANBAO_BRIDGE_URL or YUANBAO_BRIDGE_SCRIPT', 'YUANBAO_ALLOWED_RECIPIENTS']),
  relay('voice-call', 'Voice call bridge via telephony provider', ['VOICE_CALL_BRIDGE_URL or VOICE_CALL_BRIDGE_SCRIPT', 'VOICE_CALL_ALLOWED_NUMBERS']),
  relay('google-meet', 'Google Meet meeting bridge', ['GOOGLE_MEET_BRIDGE_URL or GOOGLE_MEET_BRIDGE_SCRIPT', 'GOOGLE_MEET_ALLOWED_MEETING_IDS']),
  webhook('wecom', 'WeCom enterprise messaging webhook', ['WECOM_WEBHOOK_URL'], ['WECOM_BOT_SECRET']),
  webhook('home-assistant', 'Home Assistant governed webhook', ['HOME_ASSISTANT_WEBHOOK_URL'], ['HOME_ASSISTANT_TOKEN']),
  relay('weixin', 'Weixin/WeChat personal QR bridge', ['WEIXIN_BRIDGE_URL or WEIXIN_BRIDGE_SCRIPT', 'WEIXIN_ALLOWED_RECIPIENTS']),
  apple('bluebubbles', 'BlueBubbles server bridge', ['BLUEBUBBLES_SERVER_URL', 'BLUEBUBBLES_PASSWORD', 'BLUEBUBBLES_ALLOWED_CHAT_IDS']),
  apple('imessage', 'macOS Node Mesh iMessage bridge', ['IMESSAGE_NODE_ID or IMESSAGE_BRIDGE_SCRIPT', 'IMESSAGE_ALLOWED_RECIPIENTS']),
];

export class ChannelLongTailActivationService {
  private readonly now: () => Date;
  private readonly liveReadiness: LiveReadinessService;
  private readonly env: Record<string, string | undefined>;
  private readonly fetchImpl: typeof fetch | undefined;
  private readonly execFileImpl: ChannelLongTailExecFileImpl | undefined;

  constructor(runtime: ChannelLongTailActivationRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.liveReadiness = runtime.liveReadinessService || new LiveReadinessService({ now: this.now });
    this.env = runtime.env || process.env;
    this.fetchImpl = runtime.fetchImpl;
    this.execFileImpl = runtime.execFileImpl;
  }

  public buildSnapshot(): ChannelLongTailActivationSnapshot {
    const readinessSnapshot = this.liveReadiness.buildSnapshot();
    const readinessByName = new Map(readinessSnapshot.entries.map((entry) => [entry.normalizedSourceName, entry]));
    const entries = LONG_TAIL_CHANNELS.map((descriptor) =>
      this.buildEntry(descriptor, readinessByName.get(descriptor.channelId) || null));
    const receipts = entries.map((entry) => entry.receipt);
    const blocked = entries.filter((entry) => entry.status === 'blocked').length;

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_CHANNEL_LONG_TAIL_ACTIVATION_CONTRACT_VERSION,
      phase: 'Approval gate - Channel Live Activation Long Tail',
      status: blocked > 0 ? 'blocked' : 'closed',
      summary: {
        channels: entries.length,
        partialLive: entries.filter((entry) => entry.status === 'partial-live').length,
        configuredOnly: entries.filter((entry) => entry.status === 'configured-only').length,
        blocked,
        templateOnlyRemaining: false,
        plannedRemaining: false,
        webhookFamily: this.countFamily(entries, 'webhook'),
        botHttpFamily: this.countFamily(entries, 'bot-http'),
        relayHttpFamily: this.countFamily(entries, 'relay-http'),
        localBridgeFamily: this.countFamily(entries, 'local-bridge'),
        appleBridgeFamily: this.countFamily(entries, 'apple-bridge'),
        configSchemas: entries.filter((entry) => entry.configSchema.requiredEnv.length > 0).length,
        configuredDoctors: entries.filter((entry) => this.hasGate(entry, 'configured-doctor')).length,
        stagingLiveSmokeCommands: entries.filter((entry) => this.hasGate(entry, 'staging-live-smoke')).length,
        redactedReceipts: receipts.filter((receipt) => receipt.secretValuesSerialized === false).length,
        liveIoRequiredByStage3Check: false,
        secretValuesSerialized: false,
      },
      entries,
      receipts,
      policy: {
        noLiveIoDuringStage3Check: true,
        stagingLiveRequiresExplicitOperatorCommand: true,
        familyAdaptersPreferredOverOneOffCopies: true,
        allowlistsRequiredBeforeLiveSend: true,
        noSecretsSerialized: true,
      },
      commands: {
        check: 'npm run channel-long-tail-activation:check --silent',
        doctor: 'npm run channel-long-tail-activation -- --profile configured',
        stagingLiveSmoke: 'npm run channel-long-tail-activation -- --profile staging-live --channel <channel> --confirm-live-io',
        focusedTests: ['npx jest tests/services/ChannelLongTailActivationService.test.ts --runInBand'],
        typecheck: 'npm run runtime:check --silent',
        nextStage: 'Connector registry - Provider Runtime Activation P0',
      },
    };
  }

  public buildEntry(
    descriptor: LongTailDescriptor,
    readinessEntry: LiveReadinessEntry | null = null,
  ): ChannelLongTailActivationEntry {
    const channelId = descriptor.channelId;
    const stagingLiveSmokeCommand =
      `npm run channel-long-tail-activation -- --profile staging-live --channel ${channelId} --confirm-live-io`;
    return {
      channelId,
      family: descriptor.family,
      status: 'partial-live',
      previousStatus: readinessEntry?.status || 'template-only',
      runtimeTarget: descriptor.runtimeTarget,
      adapterTarget: descriptor.adapterTarget,
      doctorCommand: `npm run channel-long-tail-activation -- --profile configured --channel ${channelId}`,
      stagingLiveSmokeCommand,
      configSchema: descriptor.configSchema,
      capabilities: descriptor.capabilities,
      gates: this.buildGates(descriptor, stagingLiveSmokeCommand),
      gaps: descriptor.gaps,
      receipt: {
        id: `channel-long-tail-activation.${channelId}.receipt`,
        channelId,
        status: 'partial-live',
        family: descriptor.family,
        liveIoPerformed: false,
        stagingLiveRequiresExplicitCommand: true,
        secretValuesSerialized: false,
      },
    };
  }

  public runConfiguredDoctor(input: { channelId: ChannelLongTailActivationId }): ChannelLongTailConfiguredDoctorReceipt {
    const descriptor = this.getDescriptor(input.channelId);
    const missingRequiredEnv = this.missingRequiredEnv(descriptor.configSchema.requiredEnv);
    const missingRuntimeConfig = this.missingRuntimeConfig(descriptor);
    const allowlistConfigured = this.resolveRecipients(descriptor, []).length > 0;
    const configured = missingRequiredEnv.length === 0 && missingRuntimeConfig.length === 0 && allowlistConfigured;
    return {
      id: `channel-long-tail-activation.${descriptor.channelId}.doctor.receipt`,
      channelId: descriptor.channelId,
      family: descriptor.family,
      status: configured ? 'configured' : 'missing-config',
      configured,
      missingRequiredEnv,
      missingRuntimeConfig,
      allowlistConfigured,
      requiredEnvChecked: descriptor.configSchema.requiredEnv,
      optionalEnvChecked: descriptor.configSchema.optionalEnv,
      secretEnvChecked: descriptor.configSchema.secretEnv,
      liveIoPerformed: false,
      secretValuesSerialized: false,
    };
  }

  public async runStagingLiveSmoke(input: {
    channelId: ChannelLongTailActivationId;
    confirmLiveIo?: boolean;
    message?: string;
    recipients?: string[];
  }): Promise<ChannelLongTailStagingLiveReceipt> {
    const descriptor = this.getDescriptor(input.channelId);
    const doctor = this.runConfiguredDoctor({ channelId: descriptor.channelId });
    const id = `channel-long-tail-activation.${descriptor.channelId}.staging-live.receipt`;
    if (input.confirmLiveIo !== true) {
      return {
        id,
        channelId: descriptor.channelId,
        family: descriptor.family,
        status: 'blocked',
        confirmed: false,
        blockedReason: 'staging-live smoke requires explicit --confirm-live-io.',
        doctor,
        sendReceipt: null,
        liveIoPerformed: false,
        secretValuesSerialized: false,
      };
    }
    if (!doctor.configured) {
      return {
        id,
        channelId: descriptor.channelId,
        family: descriptor.family,
        status: 'blocked',
        confirmed: true,
        blockedReason: 'channel is missing required config, runtime endpoint/script, or allowlisted recipients.',
        doctor,
        sendReceipt: null,
        liveIoPerformed: false,
        secretValuesSerialized: false,
      };
    }

    try {
      const recipients = this.resolveRecipients(descriptor, input.recipients || []);
      const message = String(input.message || `Zavorth Approval gate staging smoke for ${descriptor.channelId}`).trim();
      const client = this.buildClient(descriptor, recipients);
      const sendReceipt = await client.sendText({
        channelId: descriptor.channelId,
        message,
        recipients,
        metadata: {
          phase: 'Approval gate - Channel Live Activation Long Tail',
          receiptId: id,
        },
      });
      return {
        id,
        channelId: descriptor.channelId,
        family: descriptor.family,
        status: 'sent',
        confirmed: true,
        blockedReason: null,
        doctor,
        sendReceipt,
        liveIoPerformed: true,
        secretValuesSerialized: false,
      };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Channel Long Tail Activation] filesystem check failed', error);
    return {
        id,
        channelId: descriptor.channelId,
        family: descriptor.family,
        status: 'blocked',
        confirmed: true,
        blockedReason: error instanceof Error ? err.message : String(error),
        doctor,
        sendReceipt: null,
        liveIoPerformed: false,
        secretValuesSerialized: false,
      };
  }
  }

  private buildGates(
    descriptor: LongTailDescriptor,
    stagingLiveSmokeCommand: string,
  ): ChannelLongTailActivationGate[] {
    const channelId = descriptor.channelId;
    return [
      this.gate('family-adapter', 'passed', descriptor.adapterTarget, null),
      this.gate('config-schema', 'passed', descriptor.configSchema.requiredEnv.join(', '), null),
      this.gate(
        'configured-doctor',
        'passed',
        `${channelId} has a configured-profile doctor command.`,
        `npm run channel-long-tail-activation -- --profile configured --channel ${channelId}`,
      ),
      this.gate(
        'inbound-mock',
        descriptor.capabilities.inbound ? 'passed' : 'partial',
        `${channelId} inbound envelope can be mocked without external IO.`,
        'npx jest tests/services/ChannelLongTailActivationService.test.ts --runInBand',
      ),
      this.gate(
        'outbound-mock',
        descriptor.capabilities.outbound ? 'passed' : 'partial',
        `${channelId} outbound envelope can be mocked without external IO.`,
        'npx jest tests/services/ChannelLongTailActivationService.test.ts --runInBand',
      ),
      this.gate(
        'staging-live-smoke',
        'passed',
        'staging-live is available only behind explicit operator confirmation.',
        stagingLiveSmokeCommand,
      ),
      this.gate('allowlist-policy', 'passed', descriptor.configSchema.allowlistEnv.join(', '), null),
      this.gate('redacted-receipt', 'passed', 'receipt excludes tokens, secrets and recipient bodies', null),
    ];
  }

  private hasGate(entry: ChannelLongTailActivationEntry, kind: ChannelLongTailActivationGate['kind']): boolean {
    return entry.gates.some((gate) => gate.kind === kind && gate.status !== 'missing' && gate.status !== 'blocked');
  }

  private countFamily(entries: ChannelLongTailActivationEntry[], family: ChannelLongTailAdapterFamily): number {
    return entries.filter((entry) => entry.family === family).length;
  }

  private getDescriptor(channelId: ChannelLongTailActivationId): LongTailDescriptor {
    const descriptor = LONG_TAIL_CHANNELS.find((entry) => entry.channelId === channelId);
    if (!descriptor) {
      throw new Error(`Unknown long-tail channel: ${channelId}`);
    }
    return descriptor;
  }

  private buildClient(descriptor: LongTailDescriptor, recipients: string[]) {
    const prefix = envPrefix(descriptor.channelId);
    if (descriptor.family === 'webhook') {
      const authToken = this.readFirstEnv(descriptor.configSchema.secretEnv);
      return new WebhookChannelLiveClient({
        webhookUrl: this.readUrl(descriptor, ['WEBHOOK_URL', 'TARGET_URL']),
        authHeaderName: this.readEnv(`${prefix}_AUTH_HEADER_NAME`) || (authToken ? 'Authorization' : null),
        authToken,
        defaultRecipients: recipients,
      }, {
        now: this.now,
        fetchImpl: this.fetchImpl,
      });
    }
    if (descriptor.family === 'bot-http') {
      return new BotHttpChannelLiveClient({
        endpointUrl: this.readEnv(`${prefix}_API_BASE_URL`) || this.readUrl(descriptor, ['API_BASE_URL', 'ENDPOINT_URL']),
        bearerToken: this.readFirstEnv(descriptor.configSchema.secretEnv),
        apiKeyHeaderName: this.readEnv(`${prefix}_API_KEY_HEADER_NAME`),
        apiKey: this.readEnv(`${prefix}_API_KEY`),
        defaultRecipients: recipients,
      }, {
        now: this.now,
        fetchImpl: this.fetchImpl,
      });
    }
    return new LocalBridgeChannelLiveClient(descriptor.family, {
      endpointUrl: this.readBridgeEndpoint(descriptor),
      scriptPath: this.readBridgeScript(descriptor),
      bridgeToken: this.readFirstEnv(descriptor.configSchema.secretEnv) || this.readEnv(`${prefix}_BRIDGE_TOKEN`),
      defaultRecipients: recipients,
    }, {
      now: this.now,
      fetchImpl: this.fetchImpl,
      execFileImpl: this.execFileImpl,
    });
  }

  private missingRequiredEnv(expressions: string[]): string[] {
    return expressions.filter((expression) => !this.isEnvExpressionSatisfied(expression));
  }

  private missingRuntimeConfig(descriptor: LongTailDescriptor): string[] {
    const prefix = envPrefix(descriptor.channelId);
    if (descriptor.family === 'bot-http' && !this.readEnv(`${prefix}_API_BASE_URL`) && !this.readUrl(descriptor, ['ENDPOINT_URL'])) {
      return [`${prefix}_API_BASE_URL`];
    }
    if ((descriptor.family === 'relay-http' || descriptor.family === 'local-bridge' || descriptor.family === 'apple-bridge')
      && !this.readBridgeEndpoint(descriptor)
      && !this.readBridgeScript(descriptor)) {
      return [`${prefix}_BRIDGE_URL or ${prefix}_BRIDGE_SCRIPT`];
    }
    return [];
  }

  private resolveRecipients(descriptor: LongTailDescriptor, inputRecipients: string[]): string[] {
    const direct = normalizeList(inputRecipients);
    if (direct.length > 0) {
      return direct;
    }
    for (const envName of descriptor.configSchema.allowlistEnv) {
      const recipients = this.readEnvList(envName);
      if (recipients.length > 0) {
        return recipients;
      }
    }
    for (const expression of descriptor.configSchema.requiredEnv) {
      if (/TARGET|RECIPIENT|CHANNEL|ROOM|CHAT/i.test(expression)) {
        const recipients = this.readExpressionList(expression);
        if (recipients.length > 0) {
          return recipients;
        }
      }
    }
    return [];
  }

  private readBridgeEndpoint(descriptor: LongTailDescriptor): string | null {
    const prefix = envPrefix(descriptor.channelId);
    return this.readEnv(`${prefix}_BRIDGE_URL`)
      || this.readEnv(`${prefix}_ENDPOINT_URL`)
      || this.readUrl(descriptor, ['SERVER_URL', 'HOMESERVER_URL', 'RELAY_URL', 'BRIDGE_URL']);
  }

  private readBridgeScript(descriptor: LongTailDescriptor): string | null {
    const prefix = envPrefix(descriptor.channelId);
    return this.readEnv(`${prefix}_BRIDGE_SCRIPT`)
      || this.readEnv(`${prefix}_SCRIPT`)
      || this.readExpressionValue(descriptor.configSchema.requiredEnv, /SCRIPT$/i);
  }

  private readUrl(descriptor: LongTailDescriptor, suffixes: string[]): string {
    const value = this.readExpressionValue(
      descriptor.configSchema.requiredEnv.concat(descriptor.configSchema.optionalEnv),
      new RegExp(`(${suffixes.map((suffix) => escapeRegExp(suffix)).join('|')})$`, 'i'),
    );
    return value || '';
  }

  private readFirstEnv(envNames: string[]): string | null {
    for (const envName of envNames) {
      const value = this.readExpressionValue([envName], /./);
      if (value) {
        return value;
      }
    }
    return null;
  }

  private readExpressionValue(expressions: string[], namePattern: RegExp): string | null {
    for (const expression of expressions) {
      for (const candidate of this.envCandidates(expression)) {
        if (!namePattern.test(candidate.name)) {
          continue;
        }
        const value = this.readEnv(candidate.name);
        if (value && (!candidate.expectedValue || value === candidate.expectedValue)) {
          return value;
        }
      }
    }
    return null;
  }

  private readExpressionList(expression: string): string[] {
    for (const candidate of this.envCandidates(expression)) {
      const values = this.readEnvList(candidate.name);
      if (values.length > 0) {
        return values;
      }
    }
    return [];
  }

  private isEnvExpressionSatisfied(expression: string): boolean {
    return this.envCandidates(expression).some((candidate) => {
      const value = this.readEnv(candidate.name);
      return Boolean(value && (!candidate.expectedValue || value === candidate.expectedValue));
    });
  }

  private envCandidates(expression: string): Array<{ name: string; expectedValue: string | null }> {
    return String(expression || '')
      .split(/\s+or\s+/i)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [name, ...expected] = part.split('=');
        return {
          name: String(name || '').trim(),
          expectedValue: expected.length > 0 ? expected.join('=').trim() : null,
        };
      })
      .filter((candidate) => /^[A-Z0-9_]+$/.test(candidate.name));
  }

  private readEnvList(envName: string): string[] {
    return normalizeList(String(this.env[envName] || '').split(/[,;\n]/g));
  }

  private readEnv(envName: string): string | null {
    const value = String(this.env[envName] || '').trim();
    return value || null;
  }

  private gate(
    kind: ChannelLongTailActivationGate['kind'],
    status: ChannelLongTailActivationGateStatus,
    evidence: string,
    command: string | null,
  ): ChannelLongTailActivationGate {
    return {
      kind,
      status,
      evidence,
      command,
    };
  }
}

function normalizeList(values: string[] | null | undefined): string[] {
  return (values || [])
    .flatMap((entry) => String(entry || '').split(/[,;\n]/g))
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function webhook(
  channelId: ChannelLongTailActivationId,
  runtimeTarget: string,
  requiredEnv: string[],
  secretEnv: string[],
): LongTailDescriptor {
  return descriptor(channelId, 'webhook', runtimeTarget, 'src/adapters/channels/ChannelLongTailLiveClients.ts#WebhookChannelLiveClient', {
    requiredEnv,
    optionalEnv: [`${envPrefix(channelId)}_HEADERS_JSON`, `${envPrefix(channelId)}_STATUS_FILE`],
    allowlistEnv: [`${envPrefix(channelId)}_ALLOWED_RECIPIENTS`],
    secretEnv,
  }, {
    inbound: true,
    outbound: true,
    replies: false,
    attachments: false,
    threads: false,
    webhookValidation: true,
    localProcess: false,
  });
}

function botHttp(
  channelId: ChannelLongTailActivationId,
  runtimeTarget: string,
  requiredEnv: string[],
): LongTailDescriptor {
  return descriptor(channelId, 'bot-http', runtimeTarget, 'src/adapters/channels/ChannelLongTailLiveClients.ts#BotHttpChannelLiveClient', {
    requiredEnv,
    optionalEnv: [`${envPrefix(channelId)}_API_BASE_URL`, `${envPrefix(channelId)}_STATUS_FILE`],
    allowlistEnv: requiredEnv.filter((entry) => entry.includes('TARGET') || entry.includes('RECIPIENT') || entry.includes('CHANNEL')),
    secretEnv: requiredEnv.filter((entry) => entry.includes('TOKEN') || entry.includes('KEY')),
  }, {
    inbound: true,
    outbound: true,
    replies: true,
    attachments: false,
    threads: channelId === 'twitch',
    webhookValidation: true,
    localProcess: false,
  });
}

function relay(
  channelId: ChannelLongTailActivationId,
  runtimeTarget: string,
  requiredEnv: string[],
): LongTailDescriptor {
  const localBridgeChannels = new Set<ChannelLongTailActivationId>([
    'irc',
    'weixin',
    'voice-call',
    'google-meet',
  ]);
  return descriptor(channelId, localBridgeChannels.has(channelId) ? 'local-bridge' : 'relay-http', runtimeTarget, 'src/adapters/channels/ChannelLongTailLiveClients.ts#LocalBridgeChannelLiveClient', {
    requiredEnv,
    optionalEnv: [`${envPrefix(channelId)}_BRIDGE_TOKEN`, `${envPrefix(channelId)}_STATUS_FILE`],
    allowlistEnv: requiredEnv.filter((entry) => entry.includes('ALLOWED') || entry.includes('ROOM')),
    secretEnv: requiredEnv.filter((entry) => entry.includes('TOKEN') || entry.includes('KEY')),
  }, {
    inbound: true,
    outbound: true,
    replies: true,
    attachments: false,
    threads: channelId === 'matrix',
    webhookValidation: false,
    localProcess: localBridgeChannels.has(channelId),
  });
}

function apple(
  channelId: ChannelLongTailActivationId,
  runtimeTarget: string,
  requiredEnv: string[],
): LongTailDescriptor {
  return descriptor(channelId, 'apple-bridge', runtimeTarget, 'src/adapters/channels/ChannelLongTailLiveClients.ts#LocalBridgeChannelLiveClient', {
    requiredEnv,
    optionalEnv: [`${envPrefix(channelId)}_READ_ONLY`, `${envPrefix(channelId)}_STATUS_FILE`],
    allowlistEnv: requiredEnv.filter((entry) => entry.includes('ALLOWED')),
    secretEnv: requiredEnv.filter((entry) => entry.includes('PASSWORD') || entry.includes('TOKEN')),
  }, {
    inbound: true,
    outbound: true,
    replies: true,
    attachments: true,
    threads: true,
    webhookValidation: false,
    localProcess: true,
  });
}

function descriptor(
  channelId: ChannelLongTailActivationId,
  family: ChannelLongTailAdapterFamily,
  runtimeTarget: string,
  adapterTarget: string,
  configSchema: Omit<ChannelLongTailActivationConfigSchema, 'secretValuesSerialized'>,
  capabilities: ChannelLongTailActivationEntry['capabilities'],
): LongTailDescriptor {
  return {
    channelId,
    family,
    runtimeTarget,
    adapterTarget,
    configSchema: {
      ...configSchema,
      secretValuesSerialized: false,
    },
    capabilities,
    gaps: [
      'operator must provide credentials and controlled recipients before staging-live smoke',
      'advanced provider-specific media or admin features remain post-text-live hardening',
    ],
  };
}

function envPrefix(channelId: string): string {
  return channelId.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
