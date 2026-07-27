import {
  ZAVORTH_CHANNEL_DEEPENING_CONTRACT_VERSION,
  type ZavorthChannelDeepeningCapabilities,
  type ZavorthChannelDeepeningFamily,
  type ZavorthChannelDeepeningItem,
  type ZavorthChannelDeepeningRisk,
  type ZavorthChannelDeepeningSnapshot,
  type ZavorthChannelDeepeningStatus,
} from '../contracts/ZavorthChannelDeepeningContract.js';

type Runtime = {
  now?: () => Date;
  env?: Record<string, string | undefined>;
};

type Descriptor = {
  id: string;
  label: string;
  aliases?: string[];
  family: ZavorthChannelDeepeningFamily;
  risk: ZavorthChannelDeepeningRisk;
  source: ZavorthChannelDeepeningItem['source'];
  adapterTarget: string;
  runtimeTarget: string;
  requiredEnvKeys?: string[];
  optionalEnvKeys?: string[];
  allowlistEnvKeys?: string[];
  secretEnvKeys?: string[];
  liveProofSignals?: string[];
  setupMode?: 'native' | 'bridge' | 'catalog' | 'internal' | 'outbox';
  read?: boolean;
  send?: boolean;
  pairing?: boolean;
  allowlist?: boolean;
  safeOutbox?: boolean;
  rateLimit?: boolean;
  attachments?: boolean;
  threads?: boolean;
  qr?: boolean;
  missingForFullNative?: string[];
};

const CORE_OUTBOX = 'data/channel-outbox';

const CHANNELS: Descriptor[] = [
  internal('cli', 'Terminal CLI', ['terminal']),
  internal('web', 'ZavorthControl Web', ['zavorthControl', 'control']),
  internal('api', 'Runtime API', ['http']),
  bot('telegram', 'Telegram', {
    requiredEnvKeys: ['TELEGRAM_BOT_TOKEN'],
    allowlistEnvKeys: ['TELEGRAM_ALLOWED_USER_IDS', 'TELEGRAM_ALLOWED_CHAT_IDS'],
    secretEnvKeys: ['TELEGRAM_BOT_TOKEN'],
    attachments: true,
    threads: true,
    risk: 'medium',
    adapterTarget: 'src/telegram',
    runtimeTarget: 'Telegram Bot API',
  }),
  bot('discord', 'Discord', {
    requiredEnvKeys: ['DISCORD_BOT_TOKEN'],
    allowlistEnvKeys: ['DISCORD_ALLOWED_CHANNEL_IDS', 'DISCORD_ALLOWED_USER_IDS'],
    secretEnvKeys: ['DISCORD_BOT_TOKEN'],
    attachments: true,
    threads: true,
    risk: 'medium',
    adapterTarget: 'src/channels/adapters/discord',
    runtimeTarget: 'Discord Bot API',
  }),
  bot('slack', 'Slack', {
    requiredEnvKeys: ['SLACK_BOT_TOKEN'],
    allowlistEnvKeys: ['SLACK_ALLOWED_CHANNEL_IDS', 'SLACK_ALLOWED_USER_IDS'],
    secretEnvKeys: ['SLACK_BOT_TOKEN', 'SLACK_SIGNING_SECRET'],
    attachments: true,
    threads: true,
    risk: 'medium',
    adapterTarget: 'src/channels/adapters/slack',
    runtimeTarget: 'Slack Web API / Socket Mode',
  }),
  descriptor('whatsapp', 'WhatsApp', {
    aliases: ['whatsapp-cloud', 'whatsapp-baileys', 'whatsapp-qr'],
    family: 'social',
    source: 'channel-mesh',
    setupMode: 'catalog',
    read: true,
    send: true,
    safeOutbox: true,
    rateLimit: true,
    attachments: true,
    qr: true,
    risk: 'high',
    adapterTarget: 'src/channels/adapters/whatsapp',
    runtimeTarget: 'WhatsApp Cloud API or local QR bridge',
    missingForFullNative: ['choose Cloud API or local bridge mode', 'run provider-specific pairing proof'],
  }),
  bot('whatsapp-cloud', 'WhatsApp Cloud', {
    aliases: ['whatsapp'],
    requiredEnvKeys: ['WHATSAPP_CLOUD_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID'],
    allowlistEnvKeys: ['WHATSAPP_ALLOWED_RECIPIENTS'],
    secretEnvKeys: ['WHATSAPP_CLOUD_TOKEN', 'WHATSAPP_APP_SECRET'],
    attachments: true,
    risk: 'high',
    adapterTarget: 'src/channels/adapters/whatsapp',
    runtimeTarget: 'Meta WhatsApp Cloud API',
  }),
  bridge('whatsapp-baileys', 'WhatsApp Baileys', {
    aliases: ['whatsapp-qr'],
    family: 'local-bridge',
    requiredEnvKeys: ['WHATSAPP_BAILEYS_SESSION_DIR'],
    allowlistEnvKeys: ['WHATSAPP_BAILEYS_ALLOWED_RECIPIENTS'],
    optionalEnvKeys: ['WHATSAPP_BAILEYS_BRIDGE_URL', 'WHATSAPP_BAILEYS_BRIDGE_SCRIPT'],
    attachments: true,
    qr: true,
    risk: 'high',
    adapterTarget: 'src/adapters/channels/ChannelLongTailLiveClients.ts#LocalBridgeChannelLiveClient',
    runtimeTarget: 'Baileys local bridge',
  }),
  bot('instagram', 'Instagram', {
    requiredEnvKeys: ['INSTAGRAM_ACCESS_TOKEN', 'INSTAGRAM_BUSINESS_ACCOUNT_ID'],
    allowlistEnvKeys: ['INSTAGRAM_ALLOWED_RECIPIENTS'],
    secretEnvKeys: ['INSTAGRAM_ACCESS_TOKEN', 'INSTAGRAM_APP_SECRET'],
    attachments: true,
    risk: 'medium',
    adapterTarget: 'src/channels/adapters/instagram',
    runtimeTarget: 'Meta Instagram Messaging API',
  }),
  bridge('signal', 'Signal', {
    family: 'local-bridge',
    requiredEnvKeys: ['SIGNAL_CLI_ACCOUNT', 'SIGNAL_BRIDGE_URL or SIGNAL_BRIDGE_SCRIPT'],
    allowlistEnvKeys: ['SIGNAL_ALLOWED_RECIPIENTS'],
    optionalEnvKeys: ['SIGNAL_JSON_RPC_URL'],
    attachments: true,
    risk: 'high',
    adapterTarget: 'src/channels/adapters/signal',
    runtimeTarget: 'signal-cli JSON-RPC / local bridge',
  }),
  bridge('imessage', 'iMessage', {
    family: 'apple-bridge',
    requiredEnvKeys: ['IMESSAGE_NODE_ID or IMESSAGE_BRIDGE_SCRIPT'],
    allowlistEnvKeys: ['IMESSAGE_ALLOWED_RECIPIENTS'],
    optionalEnvKeys: ['IMESSAGE_READ_ONLY'],
    attachments: true,
    threads: true,
    risk: 'experimental',
    adapterTarget: 'src/channels/adapters/imessage',
    runtimeTarget: 'macOS Node Host iMessage bridge',
  }),
  bridge('bluebubbles', 'BlueBubbles', {
    family: 'apple-bridge',
    requiredEnvKeys: ['BLUEBUBBLES_SERVER_URL', 'BLUEBUBBLES_PASSWORD'],
    allowlistEnvKeys: ['BLUEBUBBLES_ALLOWED_CHAT_IDS'],
    secretEnvKeys: ['BLUEBUBBLES_PASSWORD'],
    attachments: true,
    threads: true,
    qr: true,
    risk: 'experimental',
    adapterTarget: 'src/adapters/channels/ChannelLongTailLiveClients.ts#LocalBridgeChannelLiveClient',
    runtimeTarget: 'BlueBubbles server bridge',
  }),
  email('email', 'Email'),
  bot('msteams', 'Microsoft Teams', {
    aliases: ['teams', 'microsoft-teams'],
    requiredEnvKeys: ['MSTEAMS_BOT_TOKEN', 'MSTEAMS_TENANT_ID'],
    allowlistEnvKeys: ['MSTEAMS_ALLOWED_CONVERSATION_IDS'],
    secretEnvKeys: ['MSTEAMS_BOT_TOKEN', 'MSTEAMS_CLIENT_SECRET'],
    attachments: true,
    threads: true,
    risk: 'medium',
    adapterTarget: 'src/channels/adapters/teams',
    runtimeTarget: 'Microsoft Graph / Bot Framework',
  }),
  relay('matrix', 'Matrix', {
    requiredEnvKeys: ['MATRIX_HOMESERVER_URL', 'MATRIX_ACCESS_TOKEN'],
    allowlistEnvKeys: ['MATRIX_ROOM_IDS'],
    secretEnvKeys: ['MATRIX_ACCESS_TOKEN'],
    threads: true,
    risk: 'medium',
    runtimeTarget: 'Matrix homeserver client API',
  }),
  webhook('mattermost', 'Mattermost', {
    requiredEnvKeys: ['MATTERMOST_WEBHOOK_URL'],
    allowlistEnvKeys: ['MATTERMOST_ALLOWED_RECIPIENTS'],
    secretEnvKeys: ['MATTERMOST_WEBHOOK_TOKEN'],
    runtimeTarget: 'Mattermost incoming webhook',
  }),
  webhook('nextcloud-talk', 'Nextcloud Talk', {
    requiredEnvKeys: ['NEXTCLOUD_TALK_WEBHOOK_URL'],
    allowlistEnvKeys: ['NEXTCLOUD_TALK_ALLOWED_RECIPIENTS'],
    secretEnvKeys: ['NEXTCLOUD_TALK_WEBHOOK_TOKEN'],
    runtimeTarget: 'Nextcloud Talk webhook',
  }),
  webhook('feishu', 'Feishu', {
    aliases: ['lark'],
    requiredEnvKeys: ['FEISHU_WEBHOOK_URL'],
    allowlistEnvKeys: ['FEISHU_ALLOWED_RECIPIENTS'],
    secretEnvKeys: ['FEISHU_WEBHOOK_SECRET'],
    runtimeTarget: 'Feishu/Lark enterprise webhook',
  }),
  webhook('lark', 'Lark', {
    aliases: ['feishu-lark'],
    requiredEnvKeys: ['LARK_WEBHOOK_URL'],
    allowlistEnvKeys: ['LARK_ALLOWED_RECIPIENTS'],
    secretEnvKeys: ['LARK_WEBHOOK_SECRET'],
    runtimeTarget: 'Lark enterprise webhook',
  }),
  webhook('googlechat', 'Google Chat', {
    requiredEnvKeys: ['GOOGLECHAT_WEBHOOK_URL'],
    allowlistEnvKeys: ['GOOGLECHAT_ALLOWED_SPACES'],
    runtimeTarget: 'Google Chat incoming webhook',
  }),
  bridge('irc', 'IRC', {
    family: 'local-bridge',
    requiredEnvKeys: ['IRC_BRIDGE_URL or IRC_BRIDGE_SCRIPT'],
    allowlistEnvKeys: ['IRC_ALLOWED_CHANNELS'],
    risk: 'medium',
    runtimeTarget: 'IRC relay bridge',
  }),
  bot('line', 'LINE', {
    requiredEnvKeys: ['LINE_CHANNEL_ACCESS_TOKEN'],
    allowlistEnvKeys: ['LINE_TARGET_IDS'],
    secretEnvKeys: ['LINE_CHANNEL_ACCESS_TOKEN'],
    attachments: true,
    risk: 'medium',
    runtimeTarget: 'LINE Messaging API',
  }),
  bot('zalo', 'Zalo Official Account', {
    requiredEnvKeys: ['ZALO_ACCESS_TOKEN'],
    allowlistEnvKeys: ['ZALO_RECIPIENT_IDS'],
    secretEnvKeys: ['ZALO_ACCESS_TOKEN'],
    risk: 'medium',
    runtimeTarget: 'Zalo Official Account API',
  }),
  bridge('zalouser', 'Zalo Personal Account', {
    family: 'local-bridge',
    requiredEnvKeys: ['ZALOUSER_ACCESS_TOKEN or ZALOUSER_BRIDGE_URL'],
    allowlistEnvKeys: ['ZALOUSER_RECIPIENT_IDS'],
    secretEnvKeys: ['ZALOUSER_ACCESS_TOKEN'],
    qr: true,
    risk: 'high',
    runtimeTarget: 'Zalo personal account bridge',
  }),
  bridge('wecom', 'WeCom', {
    family: 'relay',
    requiredEnvKeys: ['WECOM_WEBHOOK_URL or WECOM_BRIDGE_URL'],
    allowlistEnvKeys: ['WECOM_ALLOWED_RECIPIENTS'],
    secretEnvKeys: ['WECOM_BOT_SECRET'],
    attachments: true,
    risk: 'medium',
    runtimeTarget: 'WeCom enterprise messaging bridge',
  }),
  bridge('weixin', 'Weixin', {
    aliases: ['wechat'],
    family: 'local-bridge',
    requiredEnvKeys: ['WEIXIN_BRIDGE_URL or WEIXIN_QR_SESSION_DIR'],
    allowlistEnvKeys: ['WEIXIN_ALLOWED_RECIPIENTS'],
    qr: true,
    risk: 'experimental',
    runtimeTarget: 'Weixin personal QR bridge',
  }),
  bot('qqbot', 'QQ Bot', {
    requiredEnvKeys: ['QQBOT_BOT_TOKEN'],
    allowlistEnvKeys: ['QQBOT_TARGET_IDS'],
    secretEnvKeys: ['QQBOT_BOT_TOKEN'],
    risk: 'medium',
    runtimeTarget: 'QQ Bot HTTP API',
  }),
  bot('twitch', 'Twitch', {
    requiredEnvKeys: ['TWITCH_OAUTH_TOKEN'],
    allowlistEnvKeys: ['TWITCH_CHANNELS'],
    secretEnvKeys: ['TWITCH_OAUTH_TOKEN'],
    threads: true,
    risk: 'medium',
    runtimeTarget: 'Twitch chat/send API',
  }),
  relay('nostr', 'Nostr', {
    requiredEnvKeys: ['NOSTR_RELAY_URL', 'NOSTR_SIGNING_KEY_REF'],
    allowlistEnvKeys: ['NOSTR_ALLOWED_RECIPIENTS'],
    secretEnvKeys: ['NOSTR_SIGNING_KEY_REF'],
    risk: 'high',
    runtimeTarget: 'Nostr relay publisher',
  }),
  webhook('synology-chat', 'Synology Chat', {
    requiredEnvKeys: ['SYNOLOGY_CHAT_WEBHOOK_URL'],
    allowlistEnvKeys: ['SYNOLOGY_CHAT_ALLOWED_RECIPIENTS'],
    secretEnvKeys: ['SYNOLOGY_CHAT_WEBHOOK_TOKEN'],
    runtimeTarget: 'Synology Chat incoming webhook',
  }),
  relay('tlon', 'Tlon', {
    requiredEnvKeys: ['TLON_BRIDGE_URL'],
    allowlistEnvKeys: ['TLON_ALLOWED_RECIPIENTS'],
    risk: 'medium',
    runtimeTarget: 'Tlon/Urbit relay bridge',
  }),
  bot('clickclack', 'ClickClack', {
    requiredEnvKeys: ['CLICKCLACK_BOT_TOKEN'],
    allowlistEnvKeys: ['CLICKCLACK_TARGET_IDS'],
    secretEnvKeys: ['CLICKCLACK_BOT_TOKEN'],
    risk: 'medium',
    runtimeTarget: 'ClickClack Bot API',
  }),
  webhook('webhooks', 'Generic Webhooks', {
    requiredEnvKeys: ['WEBHOOKS_TARGET_URL'],
    allowlistEnvKeys: ['WEBHOOKS_ALLOWED_TARGETS'],
    secretEnvKeys: ['WEBHOOKS_AUTH_TOKEN'],
    runtimeTarget: 'Generic signed webhook target',
  }),
  bridge('yuanbao', 'Yuanbao', {
    family: 'relay',
    requiredEnvKeys: ['YUANBAO_BRIDGE_URL'],
    allowlistEnvKeys: ['YUANBAO_ALLOWED_RECIPIENTS'],
    risk: 'experimental',
    runtimeTarget: 'Yuanbao assistant relay bridge',
    setupMode: 'catalog',
    missingForFullNative: ['provider-specific bridge proof', 'read support proof', 'delivery receipt proof'],
  }),
  bridge('sms', 'SMS', {
    family: 'relay',
    requiredEnvKeys: ['SMS_BRIDGE_URL or SMS_PROVIDER_TOKEN'],
    allowlistEnvKeys: ['SMS_ALLOWED_RECIPIENTS'],
    secretEnvKeys: ['SMS_PROVIDER_TOKEN'],
    risk: 'high',
    runtimeTarget: 'SMS provider or local phone bridge',
    missingForFullNative: ['carrier/provider adapter selection', 'country-specific rate-limit proof'],
  }),
  webhook('home-assistant', 'Home Assistant', {
    requiredEnvKeys: ['HOME_ASSISTANT_URL', 'HOME_ASSISTANT_TOKEN'],
    allowlistEnvKeys: ['HOME_ASSISTANT_ALLOWED_ENTITIES'],
    secretEnvKeys: ['HOME_ASSISTANT_TOKEN'],
    runtimeTarget: 'Home Assistant webhook/API',
    risk: 'high',
  }),
];

export class ZavorthChannelDeepeningService {
  private readonly now: () => Date;
  private readonly env: Record<string, string | undefined>;

  public constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.env = runtime.env || process.env;
  }

  public buildSnapshot(): ZavorthChannelDeepeningSnapshot {
    const items = CHANNELS.map((descriptor) => this.buildItem(descriptor));
    const summary = summarize(items);
    const status = summary.blocked > 0
      ? 'blocked'
      : summary.liveReady + summary.nativeReady + summary.outboxReady < items.length ? 'attention'
        : 'passed';

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_CHANNEL_DEEPENING_CONTRACT_VERSION,
      source: 'ZavorthChannelDeepeningService',
      focus: 'Channel Live Readiness',
      status,
      summary,
      guarantees: {
        catalogIsNotLiveProof: true,
        liveProofRequiresCredentialsAndAllowlist: true,
        remoteChannelsRequirePairingOrAllowlist: true,
        nonLiveOutboundUsesSafeOutbox: true,
        callbacksAndReceiptsNeverSerializeSecrets: true,
        noExternalIoDuringCheck: true,
      },
      items,
      commands: {
        inspect: 'npm run zavorth:channel-deepening',
        inspectJson: 'npm run zavorth:channel-deepening:json',
        check: 'npm run zavorth:channel-deepening:check --silent',
        next: 'zavorth channels doctor',
      },
    };
  }

  public formatSnapshotText(snapshot: ZavorthChannelDeepeningSnapshot): string {
    const lines = [
      'Zavorth Channel Deepening',
      '',
      `Status: ${snapshot.status}`,
      `Channels: ${snapshot.summary.total}`,
      `Live ready: ${snapshot.summary.liveReady}`,
      `Native ready: ${snapshot.summary.nativeReady}`,
      `Outbox ready: ${snapshot.summary.outboxReady}`,
      `Needs credentials: ${snapshot.summary.requiresCredentials}`,
      `Needs bridge: ${snapshot.summary.requiresBridge}`,
      `Cataloged: ${snapshot.summary.cataloged}`,
      '',
      'All-channel map:',
    ];

    for (const item of snapshot.items) {
      lines.push(`- ${item.label} (${item.id}): ${item.status}`);
      lines.push(`  setup: ${item.commands.setup}`);
      lines.push(`  doctor: ${item.commands.doctor}`);
      lines.push(`  pairing: ${item.commands.pairing}`);
      lines.push(`  proof: ${item.commands.liveProof}`);
      if (item.commands.safeOutbox) lines.push(`  outbox: ${item.commands.safeOutbox}`);
      if (item.configuration.missingRequiredEnvKeys.length > 0) {
        lines.push(`  missing env: ${item.configuration.missingRequiredEnvKeys.join(', ')}`);
      }
      if (item.missingForFullNative.length > 0) {
        lines.push(`  missing for full native: ${item.missingForFullNative.join('; ')}`);
      }
    }

    lines.push('');
    lines.push('Policy: catalog support is not live proof. Remote channels need credentials, pairing/allowlist and proof receipts before live routing.');
    lines.push(`Next: ${snapshot.commands.next}`);
    return lines.join('\n');
  }

  public listChannelIds(): string[] {
    return CHANNELS.map((entry) => entry.id);
  }

  private buildItem(descriptor: Descriptor): ZavorthChannelDeepeningItem {
    const requiredEnvKeys = descriptor.requiredEnvKeys || [];
    const allowlistEnvKeys = descriptor.allowlistEnvKeys || [];
    const configuredRequiredEnvKeys = requiredEnvKeys.filter((key) => this.isEnvExpressionSatisfied(key));
    const missingRequiredEnvKeys = requiredEnvKeys.filter((key) => !this.isEnvExpressionSatisfied(key));
    const allowlistConfigured = allowlistEnvKeys.length === 0 || allowlistEnvKeys.some((key) => this.hasEnvList(key));
    const proofEnv = `ZAVORTH_CHANNEL_LIVE_PROOF_${envPrefix(descriptor.id)}`;
    const hasLiveProof = this.hasEnv(proofEnv);
    const status = this.resolveStatus(descriptor, missingRequiredEnvKeys, allowlistConfigured, hasLiveProof);
    const safeDefaultRoute = status === 'live_ready';
    const defaultBlockReason = safeDefaultRoute
      ? null
      : this.defaultBlockReason(status, missingRequiredEnvKeys, allowlistConfigured);
    const safeOutboxPath = descriptor.safeOutbox !== false && descriptor.family !== 'internal'
      ? `${CORE_OUTBOX}/${descriptor.id}`
      : null;

    return {
      id: descriptor.id,
      label: descriptor.label,
      aliases: descriptor.aliases || [],
      family: descriptor.family,
      status,
      risk: descriptor.risk,
      source: descriptor.source,
      adapterTarget: descriptor.adapterTarget,
      runtimeTarget: descriptor.runtimeTarget,
      capabilities: this.capabilities(descriptor),
      commands: {
        setup: `zavorth channels ${descriptor.id} setup`,
        doctor: `zavorth channels ${descriptor.id} doctor`,
        pairing: `zavorth channels ${descriptor.id} pair`,
        liveProof: `zavorth channels ${descriptor.id} proof --live`,
        safeOutbox: safeOutboxPath ? `zavorth channels ${descriptor.id} outbox` : null,
        inspect: `zavorth channels ${descriptor.id} inspect`,
      },
      configuration: {
        requiredEnvKeys,
        optionalEnvKeys: descriptor.optionalEnvKeys || [],
        allowlistEnvKeys,
        secretEnvKeys: descriptor.secretEnvKeys || requiredEnvKeys.filter((key) => /TOKEN|SECRET|PASSWORD|KEY/i.test(key)),
        configuredRequiredEnvKeys,
        missingRequiredEnvKeys,
        allowlistConfigured,
        rawSecretsSerialized: false,
      },
      liveProofSignals: [
        ...(descriptor.liveProofSignals || []),
        proofEnv,
        'recent health receipt',
        'delivery receipt with redacted destination',
      ],
      safeDefaultRoute,
      defaultBlockReason,
      missingForFullNative: this.missingForFullNative(descriptor, status, missingRequiredEnvKeys, allowlistConfigured),
      nextAction: this.nextAction(descriptor, status, missingRequiredEnvKeys, allowlistConfigured),
    };
  }

  private resolveStatus(
    descriptor: Descriptor,
    missingRequiredEnvKeys: string[],
    allowlistConfigured: boolean,
    hasLiveProof: boolean,
  ): ZavorthChannelDeepeningStatus {
    if (descriptor.family === 'internal') return 'native_ready';
    if (hasLiveProof && missingRequiredEnvKeys.length === 0 && allowlistConfigured) return 'live_ready';
    if (missingRequiredEnvKeys.length === 0 && allowlistConfigured) return 'native_ready';
    if (descriptor.setupMode === 'catalog') return 'cataloged';
    if (descriptor.family === 'local-bridge' || descriptor.family === 'apple-bridge' || descriptor.family === 'relay') {
      return missingRequiredEnvKeys.length > 0 ? 'requires_bridge' : 'requires_credentials';
    }
    if (descriptor.safeOutbox !== false) return 'outbox_ready';
    return 'setup_ready';
  }

  private capabilities(descriptor: Descriptor): ZavorthChannelDeepeningCapabilities {
    return {
      setup: true,
      doctor: true,
      pairing: descriptor.pairing !== false && descriptor.family !== 'internal',
      allowlist: descriptor.allowlist !== false && descriptor.family !== 'internal',
      read: descriptor.read === true,
      send: descriptor.send !== false && descriptor.family !== 'internal',
      liveProof: true,
      safeOutbox: descriptor.safeOutbox !== false && descriptor.family !== 'internal',
      receipts: true,
      policy: true,
      rateLimit: descriptor.rateLimit !== false && descriptor.family !== 'internal',
      attachments: Boolean(descriptor.attachments),
      threads: Boolean(descriptor.threads),
      qr: Boolean(descriptor.qr),
    };
  }

  private missingForFullNative(
    descriptor: Descriptor,
    status: ZavorthChannelDeepeningStatus,
    missingRequiredEnvKeys: string[],
    allowlistConfigured: boolean,
  ): string[] {
    const missing = new Set<string>(descriptor.missingForFullNative || []);
    if (descriptor.family !== 'internal') {
      if (missingRequiredEnvKeys.length > 0) missing.add(`configure ${missingRequiredEnvKeys.join(', ')}`);
      if (!allowlistConfigured) missing.add(`configure one allowlist: ${(descriptor.allowlistEnvKeys || []).join(', ')}`);
      if (status !== 'live_ready') missing.add('run live proof and store a redacted receipt');
      if (descriptor.safeOutbox !== false) missing.add('keep safand outbox fallback enabled until live proof passes');
    }
    return Array.from(missing);
  }

  private nextAction(
    descriptor: Descriptor,
    status: ZavorthChannelDeepeningStatus,
    missingRequiredEnvKeys: string[],
    allowlistConfigured: boolean,
  ): string {
    if (status === 'live_ready') return `Use ${descriptor.label} only through governed routing and receipts.`;
    if (missingRequiredEnvKeys.length > 0) return `Configure ${missingRequiredEnvKeys[0]} with zavorth channels ${descriptor.id} setup.`;
    if (!allowlistConfigured) return `Add an allowlist with zavorth channels ${descriptor.id} pair.`;
    return `Run zavorth channels ${descriptor.id} proof --live after reviewing policy and recipients.`;
  }

  private defaultBlockReason(
    status: ZavorthChannelDeepeningStatus,
    missingRequiredEnvKeys: string[],
    allowlistConfigured: boolean,
  ): string {
    if (status === 'cataloged') return 'Channel is cataloged but still needs a native bridge or provider proof.';
    if (missingRequiredEnvKeys.length > 0) return `Missing required configuration: ${missingRequiredEnvKeys.join(', ')}.`;
    if (!allowlistConfigured) return 'Recipient/channel allowlist is not configured.';
    return 'Live proof receipt has not been created yet.';
  }

  private isEnvExpressionSatisfied(expression: string): boolean {
    return envCandidates(expression).some((candidate) => this.hasEnv(candidate));
  }

  private hasEnvList(expression: string): boolean {
    return envCandidates(expression).some((candidate) => {
      const value = String(this.env[candidate] || '').trim();
      return value.split(/[,;\n]/g).map((entry) => entry.trim()).filter(Boolean).length > 0;
    });
  }

  private hasEnv(name: string): boolean {
    return Boolean(String(this.env[name] || '').trim());
  }
}

function summarize(items: ZavorthChannelDeepeningItem[]): ZavorthChannelDeepeningSnapshot['summary'] {
  const count = (status: ZavorthChannelDeepeningStatus) => items.filter((item) => item.status === status).length;
  const external = items.filter((item) => item.family !== 'internal');
  const nonLiveSenders = external.filter((item) => item.capabilities.send && item.status !== 'live_ready');
  return {
    total: items.length,
    liveReady: count('live_ready'),
    nativeReady: count('native_ready'),
    outboxReady: count('outbox_ready'),
    setupReady: count('setup_ready'),
    requiresCredentials: count('requires_credentials'),
    requiresBridge: count('requires_bridge'),
    cataloged: count('cataloged'),
    blocked: count('blocked'),
    readCapable: items.filter((item) => item.capabilities.read).length,
    sendCapable: items.filter((item) => item.capabilities.send).length,
    pairingCapable: items.filter((item) => item.capabilities.pairing).length,
    outboxCapable: items.filter((item) => item.capabilities.safeOutbox).length,
    liveProofCommands: items.filter((item) => Boolean(item.commands.liveProof)).length,
    allChannelsHaveSetupDoctorPairingProof: items.every((item) =>
      Boolean(item.commands.setup && item.commands.doctor && item.commands.pairing && item.commands.liveProof)),
    allExternalChannelsHavePolicyAndReceipts: external.every((item) => item.capabilities.policy && item.capabilities.receipts),
    nonLiveSendersUseOutboxOrBlock: nonLiveSenders.every((item) => item.capabilities.safeOutbox || item.status === 'blocked'),
    rawSecretsSerialized: false,
    externalIoPerformed: false,
    workspaceMutationPerformed: false,
  };
}

function internal(id: string, label: string, aliases: string[] = []): Descriptor {
  return {
    id,
    label,
    aliases,
    family: 'internal',
    risk: 'low',
    source: 'zavorth-native',
    adapterTarget: 'src/cli + src/ai-gateway',
    runtimeTarget: 'Zavorth local runtime',
    setupMode: 'internal',
    read: true,
    send: true,
    pairing: false,
    allowlist: false,
    safeOutbox: false,
    rateLimit: false,
    liveProofSignals: ['local runtime health', 'gateway token presence'],
  };
}

function bot(id: string, label: string, input: Partial<Descriptor>): Descriptor {
  return descriptor(id, label, {
    family: 'bot-api',
    source: 'channel-mesh',
    setupMode: 'native',
    read: true,
    send: true,
    rateLimit: true,
    ...input,
  });
}

function webhook(id: string, label: string, input: Partial<Descriptor>): Descriptor {
  return descriptor(id, label, {
    family: 'webhook',
    source: 'long-tail',
    setupMode: 'native',
    read: false,
    send: true,
    rateLimit: true,
    ...input,
  });
}

function relay(id: string, label: string, input: Partial<Descriptor>): Descriptor {
  return bridge(id, label, {
    family: 'relay',
    ...input,
  });
}

function bridge(id: string, label: string, input: Partial<Descriptor>): Descriptor {
  return descriptor(id, label, {
    family: 'local-bridge',
    source: 'long-tail',
    setupMode: 'bridge',
    read: true,
    send: true,
    rateLimit: true,
    ...input,
  });
}

function email(id: string, label: string): Descriptor {
  return descriptor(id, label, {
    family: 'email',
    source: 'channel-mesh',
    adapterTarget: 'src/channels/adapters/email',
    runtimeTarget: 'SMTP/IMAP',
    requiredEnvKeys: ['EMAIL_SMTP_URL or EMAIL_SMTP_HOST', 'EMAIL_FROM'],
    optionalEnvKeys: ['EMAIL_IMAP_URL', 'EMAIL_REPLY_TO'],
    allowlistEnvKeys: ['EMAIL_ALLOWED_RECIPIENTS'],
    secretEnvKeys: ['EMAIL_SMTP_PASSWORD', 'EMAIL_IMAP_PASSWORD'],
    setupMode: 'native',
    read: true,
    send: true,
    attachments: true,
    threads: true,
    rateLimit: true,
    risk: 'medium',
  });
}

function descriptor(id: string, label: string, input: Partial<Descriptor>): Descriptor {
  const family = input.family || 'outbox-only';
  return {
    id,
    label,
    aliases: input.aliases || [],
    family,
    risk: input.risk || 'medium',
    source: input.source || 'catalog',
    adapterTarget: input.adapterTarget || 'src/adapters/channels/ChannelLongTailLiveClients.ts',
    runtimeTarget: input.runtimeTarget || `${label} adapter`,
    requiredEnvKeys: input.requiredEnvKeys || [],
    optionalEnvKeys: input.optionalEnvKeys || [],
    allowlistEnvKeys: input.allowlistEnvKeys || [`${envPrefix(id)}_ALLOWED_RECIPIENTS`],
    secretEnvKeys: input.secretEnvKeys || [],
    liveProofSignals: input.liveProofSignals || [],
    setupMode: input.setupMode || 'catalog',
    read: input.read === true,
    send: input.send !== false,
    pairing: input.pairing !== false,
    allowlist: input.allowlist !== false,
    safeOutbox: input.safeOutbox !== false,
    rateLimit: input.rateLimit !== false,
    attachments: Boolean(input.attachments),
    threads: Boolean(input.threads),
    qr: Boolean(input.qr),
    missingForFullNative: input.missingForFullNative || [],
  };
}

function envCandidates(expression: string): string[] {
  return String(expression || '')
    .split(/\s+or\s+/i)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry) => /^[A-Z0-9_]+$/.test(entry));
}

function envPrefix(channelId: string): string {
  return channelId.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
