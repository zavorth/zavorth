
import fs from 'fs';
import path from 'path';


const GATEWAYS_DIR = path.resolve(__dirname, '../../src/gateways');
const CHANNELS_DIR = path.resolve(__dirname, '../../src/channels');
const ADAPTERS_DIR = path.resolve(__dirname, '../../src/adapters/channels');
const CHANNEL_ADAPTERS_DIR = ADAPTERS_DIR;
const CHANNEL_CONTRACTS_DIR = path.join(CHANNELS_DIR, 'contracts');
const CHANNEL_POLICIES_DIR = path.join(CHANNELS_DIR, 'policies');
const CHANNEL_GATEWAYS_DIR = path.join(GATEWAYS_DIR, 'channels');

function resolveGatewayPath(filename: string): string {
  const direct = path.join(GATEWAYS_DIR, filename);
  if (fs.existsSync(direct)) return direct;
  const channelNames = ['telegram', 'discord', 'whatsapp', 'slack', 'signal', 'email', 'imessage', 'teams', 'instagram', 'matrix', 'irc', 'line', 'feishu', 'google-chat', 'qq', 'zalo', 'wecom', 'weixin', 'yuanbao', 'sms', 'home-assistant', 'voice-call', 'google-meet', 'twitch', 'nextcloud-talk', 'mattermost', 'synology-chat', 'nostr', 'clickclack', 'simple'];
  for (const ch of channelNames) {
    const candidate = path.join(CHANNEL_GATEWAYS_DIR, ch, filename);
    if (fs.existsSync(candidate)) return candidate;
    const deepCandidate = path.join(CHANNEL_GATEWAYS_DIR, ch, ch + '-gateway', filename);
    if (fs.existsSync(deepCandidate)) return deepCandidate;
  }
  return direct;
}

function readGatewayFile(filename: string): string {
  return fs.readFileSync(resolveGatewayPath(filename), 'utf-8');
}

function gatewayFileExists(filename: string): boolean {
  return fs.existsSync(resolveGatewayPath(filename));
}

const GATEWAY_FILES = [
  'ZaloGateway.ts',
  'YuanbaoGateway.ts',
  'WhatsAppGateway.ts',
  'WeixinGateway.ts',
  'WebhookGateway.ts',
  'WeComGateway.ts',
  'VoiceCallGateway.ts',
  'TwitchGateway.ts',
  'TelegramGateway.ts',
  'TeamsGateway.ts',
  'SynologyChatGateway.ts',
  'SmsGateway.ts',
  'SlackGateway.ts',
  'SignalGateway.ts',
  'QQGateway.ts',
  'NostrGateway.ts',
  'NextcloudTalkGateway.ts',
  'MattermostGateway.ts',
  'MatrixGateway.ts',
  'LineGateway.ts',
  'IrcGateway.ts',
  'InstagramGateway.ts',
  'IMessageGateway.ts',
  'HomeAssistantGateway.ts',
  'GoogleMeetGateway.ts',
  'GoogleChatGateway.ts',
  'GatewaySurfaceTemplate.ts',
  'FeishuGateway.ts',
  'EmailGateway.ts',
  'DiscordGatewayTypes.ts',
  'DiscordGatewayMessageHelpers.ts',
  'DiscordGateway.ts',
  'DiscordBridgeGateway.ts',
  'ClickClackGateway.ts',
  'ChannelGatewayFactory.ts',
  'ChannelGatewayBridge.ts',
  'ChannelGatewayRegistry.ts',
  'index.ts',
];

const STUB_GATEWAY_FILES: string[] = [];

const DISCORD_SUBDIR_FILES = [
  'DiscordGatewayPersistence.ts',
  'DiscordGatewayLifecycleService.ts',
  'DiscordGatewayInboundService.ts',
  'DiscordGatewayReplyService.ts',
];

function resolveAdapterPath(filename: string): string {
  const direct = path.join(CHANNEL_ADAPTERS_DIR, filename);
  if (fs.existsSync(direct)) return direct;
  const channelNames = ['telegram', 'discord', 'whatsapp', 'slack', 'signal', 'email', 'imessage', 'teams', 'instagram', 'matrix', 'irc', 'line', 'feishu', 'google-chat', 'qq', 'zalo', 'wecom', 'weixin', 'yuanbao', 'sms', 'home-assistant', 'voice-call', 'google-meet', 'twitch', 'nextcloud-talk', 'mattermost', 'synology-chat', 'nostr', 'clickclack', 'simple'];
  for (const ch of channelNames) {
    const candidate = path.join(CHANNEL_GATEWAYS_DIR, ch, filename);
    if (fs.existsSync(candidate)) return candidate;
  }
  return direct;
}

const CHANNEL_ADAPTER_FILES = [
  'WhatsAppChannelPack.ts',
  'TeamsChannelAdapter.ts',
  'SlackChannelPack.ts',
  'SignalChannelAdapter.ts',
  'IMessageMacBridgeAdapter.ts',
  'EmailChannelAdapter.ts',
];

const CHANNEL_CONTRACT_FILES = ['ChannelMessageContract.ts'];
const CHANNEL_POLICY_FILES = ['ChannelPolicyManager.ts'];

const REGISTERED_GATEWAY_IDS = [
  'matrix',
  'line',
  'google-chat',
  'feishu',
  'irc',
  'qq',
  'zalo',
  'wecom',
  'weixin',
  'yuanbao',
  'sms',
  'home-assistant',
  'voice-call',
  'google-meet',
  'twitch',
  'nextcloud-talk',
  'mattermost',
  'synology-chat',
  'clickclack',
  'nostr',
  'telegram',
  'discord',
  'slack',
  'whatsapp',
  'signal',
  'imessage',
  'teams',
  'email',
  'instagram',
];

const REGISTRY_ALIASES: Array<{ alias: string; target: string }> = [
  { alias: 'lark', target: 'feishu' },
  { alias: 'gchat', target: 'google-chat' },
  { alias: 'googlechat', target: 'google-chat' },
  { alias: 'microsoft-teams', target: 'teams' },
  { alias: 'msteams', target: 'teams' },
  { alias: 'wechat', target: 'weixin' },
  { alias: 'nc', target: 'nextcloud-talk' },
  { alias: 'nc-talk', target: 'nextcloud-talk' },
  { alias: 'qqbot', target: 'qq' },
  { alias: 'zlu', target: 'zalo' },
  { alias: 'yb', target: 'yuanbao' },
  { alias: 'tencent-yuanbao', target: 'yuanbao' },
  { alias: 'qywx', target: 'wecom' },
  { alias: 'wework', target: 'wecom' },
];

describe('Gateway file catalog', () => {
  it('gateways directory exists', () => {
    expect(fs.existsSync(GATEWAYS_DIR)).toBe(true);
  });

  it('channels directory exists', () => {
    expect(fs.existsSync(CHANNELS_DIR)).toBe(true);
  });

  it('channel adapters directory exists', () => {
    expect(fs.existsSync(CHANNEL_ADAPTERS_DIR)).toBe(true);
  });

  it('discord-gateway subdirectory exists', () => {
    const discordDir = path.join(CHANNEL_GATEWAYS_DIR, 'discord', 'discord-gateway');
    const legacyDir = path.join(GATEWAYS_DIR, 'discord-gateway');
    expect(fs.existsSync(discordDir) || fs.existsSync(legacyDir)).toBe(true);
  });

    GATEWAY_FILES.forEach((filename) => {
    it(`gateway file exists: ${filename}`, () => {
      expect(gatewayFileExists(filename)).toBe(true);
    });
  });

  STUB_GATEWAY_FILES.forEach((filename) => {
    it(`stub gateway file exists: ${filename}`, () => {
      expect(gatewayFileExists(filename)).toBe(true);
    });
  });

  DISCORD_SUBDIR_FILES.forEach((filename) => {
    it(`discord subdir file exists: ${filename}`, () => {
      expect(gatewayFileExists(filename)).toBe(true);
    });
  });

  CHANNEL_ADAPTER_FILES.forEach((filename) => {
    it(`channel adapter file exists: ${filename}`, () => {
      expect(fs.existsSync(resolveAdapterPath(filename))).toBe(true);
    });
  });

  CHANNEL_CONTRACT_FILES.forEach((filename) => {
    it(`channel contract file exists: ${filename}`, () => {
      expect(fs.existsSync(path.join(CHANNEL_CONTRACTS_DIR, filename))).toBe(true);
    });
  });

  CHANNEL_POLICY_FILES.forEach((filename) => {
    it(`channel policy file exists: ${filename}`, () => {
      expect(fs.existsSync(path.join(CHANNEL_POLICIES_DIR, filename))).toBe(true);
    });
  });
});

describe('ChannelGatewayFactory structure', () => {
  const content = readGatewayFile('ChannelGatewayFactory.ts');

  it('exports ChannelGatewayFactory class', () => {
    expect(content).toMatch(/export\s+class\s+ChannelGatewayFactory/);
  });

  it('has static createFromId method', () => {
    expect(content).toMatch(/static\s+createFromId\s*\(/);
  });

  it('has static createAll method', () => {
    expect(content).toMatch(/static\s+createAll\s*\(/);
  });

  it('has static createConfigured method', () => {
    expect(content).toMatch(/static\s+createConfigured\s*\(/);
  });

  it('has static listSupportedChannelIds method', () => {
    expect(content).toMatch(/static\s+listSupportedChannelIds\s*\(/);
  });

  it('has GATEWAY_REGISTRATIONS array', () => {
    expect(content).toMatch(/GATEWAY_REGISTRATIONS\s*[:=]/);
  });

  it('imports GatewayEventBus', () => {
    expect(content).toMatch(/import.*GatewayEventBus/);
  });

  it('imports ChannelPolicyManager', () => {
    expect(content).toMatch(/import.*ChannelPolicyManager/);
  });

  it('imports SecurityAuditLogger', () => {
    expect(content).toMatch(/import.*SecurityAuditLogger/);
  });

  it('imports ChannelGatewayRegistry', () => {
    expect(content).toMatch(/import.*ChannelGatewayRegistry/);
  });

  REGISTERED_GATEWAY_IDS.forEach((id) => {
    it(`registers gateway id: ${id}`, () => {
      expect(content).toContain(`id: '${id}'`);
    });
  });
});

describe('ChannelGatewayRegistry structure', () => {
  const content = readGatewayFile('ChannelGatewayRegistry.ts');

  it('exports ChannelGatewayRegistry class', () => {
    expect(content).toMatch(/export\s+class\s+ChannelGatewayRegistry/);
  });

  it('has registerGateway method', () => {
    expect(content).toMatch(/registerGateway\s*\(/);
  });

  it('has resolveGateway method', () => {
    expect(content).toMatch(/resolveGateway\s*\(/);
  });

  it('has listGateways method', () => {
    expect(content).toMatch(/listGateways\s*\(/);
  });

  it('has hasGateway method', () => {
    expect(content).toMatch(/hasGateway\s*\(/);
  });

  it('has size getter', () => {
    expect(content).toMatch(/get\s+size\s*\(\)/);
  });

  REGISTRY_ALIASES.forEach(({ alias, target }) => {
    it(`resolves alias "${alias}" to "${target}"`, () => {
      expect(content).toContain(alias);
      expect(content).toContain(target);
    });
  });
});

describe('ChannelGatewayBridge structure', () => {
  const content = readGatewayFile('ChannelGatewayBridge.ts');

  it('exports ChannelGatewayBridge class or function', () => {
    expect(content).toMatch(/export\s+(class|function|const)/);
  });
});

describe('Gateway index exports', () => {
  const content = readGatewayFile('index.ts');

  it('exports WebhookGateway', () => {
    expect(content).toMatch(/export.*WebhookGateway/);
  });

  it('exports ChannelGatewayRegistry', () => {
    expect(content).toMatch(/export.*ChannelGatewayRegistry/);
  });

  it('exports ChannelGatewayFactory', () => {
    expect(content).toMatch(/export.*ChannelGatewayFactory/);
  });

  it('exports ChannelGatewayBridge', () => {
    expect(content).toMatch(/export.*ChannelGatewayBridge/);
  });

  it('re-exports channels index', () => {
    expect(content).toMatch(/export\s+\*\s+from.*channels/);
  });

  const channelExports: Array<{ channel: string; className: string }> = [
    { channel: 'telegram', className: 'TelegramGateway' },
    { channel: 'discord', className: 'DiscordGateway' },
    { channel: 'slack', className: 'SlackGateway' },
    { channel: 'whatsapp', className: 'WhatsAppGateway' },
    { channel: 'signal', className: 'SignalGateway' },
    { channel: 'email', className: 'EmailGateway' },
    { channel: 'teams', className: 'TeamsGateway' },
    { channel: 'instagram', className: 'InstagramGateway' },
    { channel: 'simple', className: 'MatrixGateway' },
    { channel: 'imessage', className: 'IMessageGateway' },
  ];

  channelExports.forEach(({ channel, className }) => {
    it(`channel ${channel} exports ${className}`, () => {
      const channelIndex = path.join(CHANNEL_GATEWAYS_DIR, channel, 'index.ts');
      expect(fs.existsSync(channelIndex)).toBe(true);
      const channelContent = fs.readFileSync(channelIndex, 'utf-8');
      expect(channelContent).toMatch(new RegExp(`export.*${className}`));
    });
  });
});

describe('Individual gateway files structure', () => {
  const mainGateways = [
    'TelegramGateway.ts',
    'DiscordGateway.ts',
    'SlackGateway.ts',
    'WhatsAppGateway.ts',
    'SignalGateway.ts',
    'EmailGateway.ts',
    'TeamsGateway.ts',
    'InstagramGateway.ts',
    'MatrixGateway.ts',
    'IMessageGateway.ts',
  ];

  mainGateways.forEach((filename) => {
    const content = readGatewayFile(filename);
    const className = filename.replace('.ts', '');

    it(`${className} exports a class`, () => {
      expect(content).toMatch(/export\s+class\s+/);
    });
  });
});

describe('WebhookGateway base structure', () => {
  const content = readGatewayFile('WebhookGateway.ts');

  it('exports WebhookGateway', () => {
    expect(content).toMatch(/export.*WebhookGateway/);
  });

  it('exports WebhookGatewayOptions type', () => {
    expect(content).toMatch(/export.*WebhookGatewayOptions/);
  });

  it('exports WebhookGatewayMode type', () => {
    expect(content).toMatch(/export.*WebhookGatewayMode/);
  });

  it('exports WebhookGatewayStatusSnapshot type', () => {
    expect(content).toMatch(/export.*WebhookGatewayStatusSnapshot/);
  });
});

describe('DiscordGateway types and helpers', () => {
  it('DiscordGatewayTypes.ts exports types', () => {
    const content = readGatewayFile('DiscordGatewayTypes.ts');
    expect(content).toMatch(/export\s+(type|interface)/);
  });

  it('DiscordGatewayMessageHelpers.ts exports helpers', () => {
    const content = readGatewayFile('DiscordGatewayMessageHelpers.ts');
    expect(content).toMatch(/export\s+(function|const|class)/);
  });
});

describe('GatewaySurfaceTemplate structure', () => {
  const content = readGatewayFile('GatewaySurfaceTemplate.ts');

  it('exports something', () => {
    expect(content).toMatch(/export\s+(class|function|const|type|interface)/);
  });
});

describe('Channel adapters structure', () => {
  CHANNEL_ADAPTER_FILES.forEach((filename) => {
    const content = fs.readFileSync(resolveAdapterPath(filename), 'utf-8');
    const adapterName = filename.replace('.ts', '');

    it(`${adapterName} exports a class or function`, () => {
      expect(content).toMatch(/export\s+(class|function|const)/);
    });
  });
});

describe('Channel contracts and policies', () => {
  it('ChannelMessageContract exports types', () => {
    const content = fs.readFileSync(path.join(CHANNEL_CONTRACTS_DIR, 'ChannelMessageContract.ts'), 'utf-8');
    expect(content).toMatch(/export\s+(type|interface)/);
  });

  it('ChannelPolicyManager exports a class', () => {
    const content = fs.readFileSync(path.join(CHANNEL_POLICIES_DIR, 'ChannelPolicyManager.ts'), 'utf-8');
    expect(content).toMatch(/export\s+class\s+ChannelPolicyManager/);
  });
});

describe('Channel index exports', () => {
  const content = fs.readFileSync(path.join(CHANNELS_DIR, 'index.ts'), 'utf-8');

  it('exports SlackChannelAdapter', () => {
    expect(content).toMatch(/SlackChannelAdapter/);
  });

  it('exports WhatsAppChannelAdapter', () => {
    expect(content).toMatch(/WhatsAppChannelAdapter/);
  });

  it('exports SignalChannelAdapter', () => {
    expect(content).toMatch(/SignalChannelAdapter/);
  });

  it('exports IMessageMacBridgeAdapter', () => {
    expect(content).toMatch(/IMessageMacBridgeAdapter/);
  });

  it('exports TeamsChannelAdapter', () => {
    expect(content).toMatch(/TeamsChannelAdapter/);
  });

  it('exports EmailChannelAdapter', () => {
    expect(content).toMatch(/EmailChannelAdapter/);
  });

  it('exports ChannelMessageContract', () => {
    expect(content).toMatch(/ChannelMessageContract/);
  });

  it('exports ChannelPolicyManager', () => {
    expect(content).toMatch(/ChannelPolicyManager/);
  });
});

describe('Stub gateway files', () => {
  STUB_GATEWAY_FILES.forEach((filename) => {
    const content = readGatewayFile(filename);

    it(`${filename} is a valid TypeScript file`, () => {
      expect(content.length).toBeGreaterThan(0);
    });

    it(`${filename} exports something`, () => {
      expect(content).toMatch(/export/);
    });
  });
});

describe('ChannelGatewayFactory gateway count', () => {
  const content = readGatewayFile('ChannelGatewayFactory.ts');

  it('registers exactly 29 gateways', () => {
    const matches = content.match(/id:\s*'[^']+'/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(29);
  });

  it('each registration has GatewayClass', () => {
    const matches = content.match(/GatewayClass:\s*(?!GatewayClass;)\w+/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(29);
  });

  it('each registration has isConfigured callback', () => {
    const matches = content.match(/isConfigured:\s*\(\)\s*=>\s*Boolean/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(29);
  });
});

describe('ChannelGatewayFactory gateway imports', () => {
  const content = readGatewayFile('ChannelGatewayFactory.ts');

  const importedGateways = [
    'MatrixGateway',
    'LineGateway',
    'GoogleChatGateway',
    'FeishuGateway',
    'IrcGateway',
    'QQGateway',
    'ZaloGateway',
    'WeComGateway',
    'WeixinGateway',
    'YuanbaoGateway',
    'SmsGateway',
    'HomeAssistantGateway',
    'VoiceCallGateway',
    'GoogleMeetGateway',
    'TwitchGateway',
    'NextcloudTalkGateway',
    'MattermostGateway',
    'SynologyChatGateway',
    'ClickClackGateway',
    'NostrGateway',
    'TelegramGateway',
    'DiscordGateway',
    'SlackGateway',
    'WhatsAppGateway',
    'SignalGateway',
    'IMessageGateway',
    'TeamsGateway',
    'EmailGateway',
    'InstagramGateway',
  ];

  importedGateways.forEach((gateway) => {
    it(`imports ${gateway}`, () => {
      expect(content).toMatch(new RegExp(`import.*${gateway}`));
    });
  });
});

describe('ChannelGatewayFactory buildBaseOptions', () => {
  const content = readGatewayFile('ChannelGatewayFactory.ts');

  it('has private buildBaseOptions method', () => {
    expect(content).toMatch(/private\s+static\s+buildBaseOptions/);
  });

  it('buildBaseOptions creates GatewayEventBus', () => {
    expect(content).toMatch(/new\s+GatewayEventBus\s*\(\s*\)/);
  });

  it('buildBaseOptions creates ChannelPolicyManager', () => {
    expect(content).toMatch(/new\s+ChannelPolicyManager\s*\(\s*\)/);
  });

  it('buildBaseOptions creates SecurityAuditLogger', () => {
    expect(content).toMatch(/new\s+SecurityAuditLogger\s*\(/);
  });

  it('buildBaseOptions creates LogRepository', () => {
    expect(content).toMatch(/new\s+LogRepository\s*\(\s*\)/);
  });
});

describe('ChannelGatewayRegistry internals', () => {
  const content = readGatewayFile('ChannelGatewayRegistry.ts');

  it('uses Map for gateway storage', () => {
    expect(content).toMatch(/new\s+Map\s*</);
  });

  it('has private normalizeId method', () => {
    expect(content).toMatch(/private\s+normalizeId\s*\(/);
  });

  it('has private resolveAlias method', () => {
    expect(content).toMatch(/private\s+resolveAlias\s*\(/);
  });

  it('normalizeId lowercases input', () => {
    expect(content).toMatch(/\.toLowerCase\s*\(\s*\)/);
  });

  it('resolveGateway checks normalized id first', () => {
    expect(content).toMatch(/this\.gates?\w*\.get\s*\(\s*normalized\s*\)/);
  });
});

describe('WebhookGateway base class', () => {
  const content = readGatewayFile('WebhookGateway.ts');

  it('has id property or getter', () => {
    expect(content).toMatch(/(?:readonly\s+|get\s+)id\b/);
  });

  it('has start or initialize method', () => {
    expect(content).toMatch(/(?:start|initialize)\s*\(/);
  });

  it('has stop or shutdown method', () => {
    expect(content).toMatch(/(?:stop|shutdown)\s*\(/);
  });

  it('WebhookGatewayOptions has eventBus field', () => {
    expect(content).toMatch(/eventBus/);
  });

  it('WebhookGatewayOptions has policyManager field', () => {
    expect(content).toMatch(/policyManager/);
  });

  it('WebhookGatewayOptions has auditLogger field', () => {
    expect(content).toMatch(/auditLogger/);
  });
});

describe('Individual gateway details', () => {
  it('TelegramGateway has Telegram-specific config', () => {
    const content = readGatewayFile('TelegramGateway.ts');
    expect(content).toMatch(/telegram|Telegram|bot/i);
  });

  it('DiscordGateway has Discord-specific config', () => {
    const content = readGatewayFile('DiscordGateway.ts');
    expect(content).toMatch(/discord|Discord/i);
  });

  it('SlackGateway has Slack-specific config', () => {
    const content = readGatewayFile('SlackGateway.ts');
    expect(content).toMatch(/slack|Slack/i);
  });

  it('WhatsAppGateway has WhatsApp-specific config', () => {
    const content = readGatewayFile('WhatsAppGateway.ts');
    expect(content).toMatch(/whatsapp|WhatsApp/i);
  });

  it('SignalGateway has Signal-specific config', () => {
    const content = readGatewayFile('SignalGateway.ts');
    expect(content).toMatch(/signal|Signal/i);
  });

  it('EmailGateway has email-specific config', () => {
    const content = readGatewayFile('EmailGateway.ts');
    expect(content).toMatch(/email|Email|smtp|imap/i);
  });

  it('TeamsGateway has Teams-specific config', () => {
    const content = readGatewayFile('TeamsGateway.ts');
    expect(content).toMatch(/teams|Teams/i);
  });

  it('InstagramGateway has Instagram-specific config', () => {
    const content = readGatewayFile('InstagramGateway.ts');
    expect(content).toMatch(/instagram|Instagram/i);
  });

  it('MatrixGateway has Matrix-specific config', () => {
    const content = readGatewayFile('MatrixGateway.ts');
    expect(content).toMatch(/matrix|Matrix/i);
  });

  it('LineGateway has Line-specific config', () => {
    const content = readGatewayFile('LineGateway.ts');
    expect(content).toMatch(/line|Line/i);
  });

  it('GoogleChatGateway has Google Chat config', () => {
    const content = readGatewayFile('GoogleChatGateway.ts');
    expect(content).toMatch(/google.*chat|GoogleChat/i);
  });

  it('FeishuGateway has Feishu config', () => {
    const content = readGatewayFile('FeishuGateway.ts');
    expect(content).toMatch(/feishu|Feishu/i);
  });

  it('IrcGateway has IRC config', () => {
    const content = readGatewayFile('IrcGateway.ts');
    expect(content).toMatch(/irc|IRC/i);
  });

  it('QQGateway has QQ config', () => {
    const content = readGatewayFile('QQGateway.ts');
    expect(content).toMatch(/qq|QQ/i);
  });

  it('ZaloGateway has Zalo config', () => {
    const content = readGatewayFile('ZaloGateway.ts');
    expect(content).toMatch(/zalo|Zalo/i);
  });

  it('WeComGateway has WeCom config', () => {
    const content = readGatewayFile('WeComGateway.ts');
    expect(content).toMatch(/wecom|WeCom/i);
  });

  it('WeixinGateway has Weixin config', () => {
    const content = readGatewayFile('WeixinGateway.ts');
    expect(content).toMatch(/weixin|Weixin/i);
  });

  it('YuanbaoGateway has Yuanbao config', () => {
    const content = readGatewayFile('YuanbaoGateway.ts');
    expect(content).toMatch(/yuanbao|Yuanbao/i);
  });

  it('SmsGateway has SMS config', () => {
    const content = readGatewayFile('SmsGateway.ts');
    expect(content).toMatch(/sms|SMS/i);
  });

  it('HomeAssistantGateway has Home Assistant config', () => {
    const content = readGatewayFile('HomeAssistantGateway.ts');
    expect(content).toMatch(/home.*assistant|HomeAssistant/i);
  });

  it('VoiceCallGateway has voice call config', () => {
    const content = readGatewayFile('VoiceCallGateway.ts');
    expect(content).toMatch(/voice|Voice/i);
  });

  it('GoogleMeetGateway has Google Meet config', () => {
    const content = readGatewayFile('GoogleMeetGateway.ts');
    expect(content).toMatch(/google.*meet|GoogleMeet/i);
  });

  it('TwitchGateway has Twitch config', () => {
    const content = readGatewayFile('TwitchGateway.ts');
    expect(content).toMatch(/twitch|Twitch/i);
  });

  it('NextcloudTalkGateway has Nextcloud config', () => {
    const content = readGatewayFile('NextcloudTalkGateway.ts');
    expect(content).toMatch(/nextcloud|Nextcloud/i);
  });

  it('MattermostGateway has Mattermost config', () => {
    const content = readGatewayFile('MattermostGateway.ts');
    expect(content).toMatch(/mattermost|Mattermost/i);
  });

  it('SynologyChatGateway has Synology config', () => {
    const content = readGatewayFile('SynologyChatGateway.ts');
    expect(content).toMatch(/synology|Synology/i);
  });

  it('ClickClackGateway has ClickClack config', () => {
    const content = readGatewayFile('ClickClackGateway.ts');
    expect(content).toMatch(/clickclack|ClickClack/i);
  });

  it('NostrGateway has Nostr config', () => {
    const content = readGatewayFile('NostrGateway.ts');
    expect(content).toMatch(/nostr|Nostr/i);
  });

  it('IMessageGateway has iMessage config', () => {
    const content = readGatewayFile('IMessageGateway.ts');
    expect(content).toMatch(/imessage|iMessage/i);
  });
});

describe('Discord gateway subdirectory services', () => {
  it('DiscordGatewayPersistence exports a class or function', () => {
    const content = fs.readFileSync(resolveGatewayPath('DiscordGatewayPersistence.ts'), 'utf-8');
    expect(content).toMatch(/export\s+(class|function|const)/);
  });

  it('DiscordGatewayLifecycleService exports a class or function', () => {
    const content = fs.readFileSync(resolveGatewayPath('DiscordGatewayLifecycleService.ts'), 'utf-8');
    expect(content).toMatch(/export\s+(class|function|const)/);
  });

  it('DiscordGatewayInboundService exports a class or function', () => {
    const content = fs.readFileSync(resolveGatewayPath('DiscordGatewayInboundService.ts'), 'utf-8');
    expect(content).toMatch(/export\s+(class|function|const)/);
  });

  it('DiscordGatewayReplyService exports a class or function', () => {
    const content = fs.readFileSync(resolveGatewayPath('DiscordGatewayReplyService.ts'), 'utf-8');
    expect(content).toMatch(/export\s+(class|function|const)/);
  });
});

describe('Channel adapter details', () => {
  it('SlackChannelPack handles Slack messages', () => {
    const content = fs.readFileSync(resolveAdapterPath('SlackChannelPack.ts'), 'utf-8');
    expect(content).toMatch(/slack|Slack/i);
  });

  it('WhatsAppChannelPack handles WhatsApp messages', () => {
    const content = fs.readFileSync(resolveAdapterPath('WhatsAppChannelPack.ts'), 'utf-8');
    expect(content).toMatch(/whatsapp|WhatsApp/i);
  });

  it('SignalChannelAdapter handles Signal messages', () => {
    const content = fs.readFileSync(resolveAdapterPath('SignalChannelAdapter.ts'), 'utf-8');
    expect(content).toMatch(/signal|Signal/i);
  });

  it('TeamsChannelAdapter handles Teams messages', () => {
    const content = fs.readFileSync(resolveAdapterPath('TeamsChannelAdapter.ts'), 'utf-8');
    expect(content).toMatch(/teams|Teams/i);
  });

  it('EmailChannelAdapter handles email messages', () => {
    const content = fs.readFileSync(resolveAdapterPath('EmailChannelAdapter.ts'), 'utf-8');
    expect(content).toMatch(/email|Email/i);
  });

  it('IMessageMacBridgeAdapter handles iMessage', () => {
    const content = fs.readFileSync(resolveAdapterPath('IMessageMacBridgeAdapter.ts'), 'utf-8');
    expect(content).toMatch(/imessage|iMessage/i);
  });
});

describe('ChannelMessageContract structure', () => {
  const content = fs.readFileSync(path.join(CHANNEL_CONTRACTS_DIR, 'ChannelMessageContract.ts'), 'utf-8');

  it('defines message contract interface or type', () => {
    expect(content).toMatch(/export\s+(type|interface)/);
  });

  it('has content or body field', () => {
    expect(content).toMatch(/(?:content|body|text|message)\s*[:?]/);
  });
});

describe('ChannelPolicyManager structure', () => {
  const content = fs.readFileSync(path.join(CHANNEL_POLICIES_DIR, 'ChannelPolicyManager.ts'), 'utf-8');

  it('exports ChannelPolicyManager class', () => {
    expect(content).toMatch(/export\s+class\s+ChannelPolicyManager/);
  });

  it('has policy-related methods', () => {
    expect(content).toMatch(/(?:check|evaluate|allow|validate|isAllowed|canSend|canReceive|verify|setPolicy|getPolicy)\s*\(/);
  });
});

describe('Gateway file sizes are non-trivial', () => {
  const significantGateways = [
    'TelegramGateway.ts',
    'DiscordGateway.ts',
    'SlackGateway.ts',
    'WhatsAppGateway.ts',
    'SignalGateway.ts',
    'EmailGateway.ts',
    'TeamsGateway.ts',
    'InstagramGateway.ts',
    'MatrixGateway.ts',
  ];

  significantGateways.forEach((filename) => {
    it(`${filename} has substantial content (>500 bytes)`, () => {
      const resolvedPath = resolveGatewayPath(filename);
      expect(fs.existsSync(resolvedPath)).toBe(true);
      const stats = fs.statSync(resolvedPath);
      expect(stats.size).toBeGreaterThan(500);
    });
  });
});

describe('GatewayFactory method return types', () => {
  const content = readGatewayFile('ChannelGatewayFactory.ts');

  it('createFromId returns WebhookGateway or null', () => {
    expect(content).toMatch(/createFromId\s*\([^)]*\)\s*:\s*WebhookGateway\s*\|\s*null/);
  });

  it('createAll returns ChannelGatewayRegistry', () => {
    expect(content).toMatch(/createAll\s*\([^)]*\)\s*:\s*ChannelGatewayRegistry/);
  });

  it('createConfigured returns ChannelGatewayRegistry', () => {
    expect(content).toMatch(/createConfigured\s*\([^)]*\)\s*:\s*ChannelGatewayRegistry/);
  });

  it('listSupportedChannelIds returns string array', () => {
    expect(content).toMatch(/listSupportedChannelIds\s*\([^)]*\)\s*:\s*string\[\]/);
  });
});

describe('Gateway configuration checks use config object', () => {
  const content = readGatewayFile('ChannelGatewayFactory.ts');

  it('telegram checks telegramBotToken', () => {
    expect(content).toMatch(/telegramBotToken/);
  });

  it('discord checks discordWebhookUrl', () => {
    expect(content).toMatch(/discordWebhookUrl/);
  });

  it('slack checks slackWebhookUrl', () => {
    expect(content).toMatch(/slackWebhookUrl/);
  });

  it('whatsapp checks whatsappBridgeUrl or whatsappWebhookUrl', () => {
    expect(content).toMatch(/whatsapp(?:Bridge|Webhook)Url/);
  });

  it('signal checks signalJsonRpcUrl or signalCliPath', () => {
    expect(content).toMatch(/signal(?:JsonRpcUrl|CliPath)/);
  });

  it('email checks emailSmtpHost or emailImapHost', () => {
    expect(content).toMatch(/email(?:SmtpHost|ImapHost)/);
  });

  it('teams checks teamsWebhookUrl', () => {
    expect(content).toMatch(/teamsWebhookUrl/);
  });

  it('instagram checks instagramAccessToken', () => {
    expect(content).toMatch(/instagramAccessToken/);
  });

  it('matrix checks matrixBaseUrl and matrixAccessToken', () => {
    expect(content).toMatch(/matrixBaseUrl/);
    expect(content).toMatch(/matrixAccessToken/);
  });

  it('line checks lineChannelAccessToken', () => {
    expect(content).toMatch(/lineChannelAccessToken/);
  });
});

describe('GatewayChannelAdapter files have content', () => {
  CHANNEL_ADAPTER_FILES.forEach((filename) => {
    const filePath = resolveAdapterPath(filename);
    const stats = fs.statSync(filePath);

    it(`${filename} has non-zero size`, () => {
      expect(stats.size).toBeGreaterThan(0);
    });
  });
});
