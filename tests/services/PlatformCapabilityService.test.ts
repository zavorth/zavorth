import fs from 'fs';
import os from 'os';
import path from 'path';

describe('PlatformCapabilityService', () => {
  const originalEnv = process.env;
  const tempDirs: string[] = [];

  function loadService() {
    let PlatformCapabilityService: any;

    jest.isolateModules(() => {
      ({ PlatformCapabilityService } = require('../../src/services/PlatformCapabilityService'));
    });

    return PlatformCapabilityService;
  }

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    process.env.TELEGRAM_BOT_TOKEN = '';
    process.env.TELEGRAM_ALLOWED_USER_IDS = '';
    process.env.DISCORD_BOT_TOKEN = '';
    process.env.DISCORD_ALLOWED_GUILD_IDS = '';
    process.env.DISCORD_ALLOWED_CHANNEL_IDS = '';
    process.env.DISCORD_GUILD_ID = '';
    process.env.DISCORD_ALLOW_DMS = '';
    process.env.DISCORD_PUBLIC_SERVER_MODE = '';
    process.env.DISCORD_OWNER_USER_IDS = '';
    process.env.DISCORD_REQUIRE_OWNER_FOR_OPERATIONAL = '';
    process.env.DISCORD_COMMAND_EXPOSURE = '';
    process.env.DISCORD_OPERATOR_USER_IDS = '';
    process.env.DISCORD_ALLOW_ATTACHMENTS_IN_PUBLIC_SERVER_MODE = '';
    process.env.DISCORD_MAX_MESSAGE_CHARS = '';
    process.env.DISCORD_RATE_LIMIT_WINDOW_MS = '';
    process.env.DISCORD_RATE_LIMIT_MAX_REQUESTS = '';
    process.env.DISCORD_BRIDGE_ENABLED = '';
    process.env.DISCORD_BRIDGE_ALLOW_DMS = '';
    process.env.DISCORD_BRIDGE_SECRET = '';
    process.env.DISCORD_BRIDGE_SECRET_FILE = '';
    process.env.DISCORD_BRIDGE_STATUS_FILE = '';
    process.env.WHATSAPP_ENABLED = '';
    process.env.WHATSAPP_BOT_TOKEN = '';
    process.env.WHATSAPP_PROVIDER = '';
    process.env.WHATSAPP_CLOUD_API_VERSION = '';
    process.env.WHATSAPP_PHONE_NUMBER_ID = '';
    process.env.WHATSAPP_ACCESS_TOKEN = '';
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = '';
    process.env.WHATSAPP_ALLOWED_CHAT_IDS = '';
    process.env.WHATSAPP_SESSION_DIR = '';
    process.env.WHATSAPP_OUTBOX_DIR = '';
    process.env.WHATSAPP_STATUS_FILE = '';
    process.env.INSTAGRAM_ENABLED = '';
    process.env.INSTAGRAM_PROVIDER = '';
    process.env.INSTAGRAM_GRAPH_API_VERSION = '';
    process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID = '';
    process.env.INSTAGRAM_ACCESS_TOKEN = '';
    process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN = '';
    process.env.INSTAGRAM_ALLOWED_RECIPIENT_IDS = '';
    process.env.INSTAGRAM_OUTBOX_DIR = '';
    process.env.INSTAGRAM_STATUS_FILE = '';
    process.env.SLACK_ENABLED = '';
    process.env.SLACK_BOT_TOKEN = '';
    process.env.SLACK_SIGNING_SECRET = '';
    process.env.SLACK_TRANSPORT = '';
    process.env.SLACK_API_BASE_URL = '';
    process.env.SLACK_WORKSPACE_ID = '';
    process.env.SLACK_ALLOWED_CHANNEL_IDS = '';
    process.env.SLACK_OUTBOX_DIR = '';
    process.env.SLACK_STATUS_FILE = '';
    process.env.SIGNAL_ENABLED = '';
    process.env.SIGNAL_CLI_PATH = '';
    process.env.SIGNAL_JSONRPC_URL = '';
    process.env.SIGNAL_ACCOUNT_NUMBER = '';
    process.env.SIGNAL_ALLOWED_RECIPIENTS = '';
    process.env.SIGNAL_STATUS_FILE = '';
    process.env.IMESSAGE_ENABLED = '';
    process.env.IMESSAGE_NODE_ID = '';
    process.env.IMESSAGE_BRIDGE_SCRIPT = '';
    process.env.IMESSAGE_ALLOWED_RECIPIENTS = '';
    process.env.IMESSAGE_READ_ONLY = '';
    process.env.IMESSAGE_STATUS_FILE = '';
    process.env.TEAMS_ENABLED = '';
    process.env.TEAMS_APP_ID = '';
    process.env.TEAMS_APP_PASSWORD = '';
    process.env.TEAMS_CLIENT_SECRET = '';
    process.env.TEAMS_TENANT_ID = '';
    process.env.TEAMS_ALLOWED_CONVERSATION_IDS = '';
    process.env.TEAMS_STATUS_FILE = '';
    process.env.EMAIL_ENABLED = '';
    process.env.EMAIL_SMTP_HOST = '';
    process.env.EMAIL_IMAP_HOST = '';
    process.env.EMAIL_ALLOWED_RECIPIENTS = '';
    process.env.EMAIL_STATUS_FILE = '';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('marks Telegram as ready when token and allowed users are configured', () => {
    process.env.TELEGRAM_BOT_TOKEN = 'telegram-token';
    process.env.TELEGRAM_ALLOWED_USER_IDS = '123,456';

    const PlatformCapabilityService = loadService();
    const service = new PlatformCapabilityService();

    expect(service.describe('telegram')).toMatchObject({
      platform: 'telegram',
      readiness: 'ready',
      implementationState: 'full',
      transport: 'native',
      configured: true,
    });
    expect(service.getSummary().ready).toContain('telegram');
  });

  it('keeps Discord, WhatsApp and Slack as planned when no runtime hints exist', () => {
    process.env.TELEGRAM_BOT_TOKEN = 'telegram-token';
    process.env.TELEGRAM_ALLOWED_USER_IDS = '123';

    const PlatformCapabilityService = loadService();
    const service = new PlatformCapabilityService();

    expect(service.describe('discord').readiness).toBe('planned');
    expect(service.describe('whatsapp').readiness).toBe('planned');
    expect(service.describe('instagram').readiness).toBe('planned');
    expect(service.describe('slack').readiness).toBe('planned');
    expect(service.describe('discord').notes.join(' ')).toContain('Discord ja possui trilha de runtime no Zavorth');
    expect(service.describe('whatsapp').notes.join(' ')).toContain('WhatsApp ja possui trilha de runtime no Zavorth');
    expect(service.describe('instagram').notes.join(' ')).toContain('Instagram agora possui trilha de runtime no Zavorth');
    expect(service.describe('slack').notes.join(' ')).toContain('Slack ja possui trilha de runtime no Zavorth');
    expect(service.describe('signal').readiness).toBe('planned');
    expect(service.describe('imessage').readiness).toBe('planned');
    expect(service.describe('teams').readiness).toBe('planned');
    expect(service.describe('email').readiness).toBe('planned');
  });

  it('promotes Discord, WhatsApp and Slack to partial when their configuration hints exist', () => {
    process.env.DISCORD_BRIDGE_ENABLED = 'true';
    process.env.DISCORD_BRIDGE_SECRET = 'discord-secret';
    process.env.WHATSAPP_ENABLED = 'true';
    process.env.WHATSAPP_SESSION_DIR = 'C:/tmp/whatsapp-session';
    process.env.INSTAGRAM_ENABLED = 'true';
    process.env.INSTAGRAM_ALLOWED_RECIPIENT_IDS = 'ig-user-1';
    process.env.SLACK_ENABLED = 'true';
    process.env.SLACK_WORKSPACE_ID = 'workspace-1';

    const PlatformCapabilityService = loadService();
    const service = new PlatformCapabilityService();

    expect(service.describe('discord')).toMatchObject({
      readiness: 'partial',
      implementationState: 'partial',
      transport: 'local',
      configured: true,
    });
    expect(service.describe('whatsapp')).toMatchObject({
      readiness: 'partial',
      implementationState: 'partial',
      transport: 'local',
      configured: true,
    });
    expect(service.describe('slack')).toMatchObject({
      readiness: 'partial',
      implementationState: 'partial',
      transport: 'local',
      configured: true,
    });
    expect(service.describe('instagram')).toMatchObject({
      readiness: 'partial',
      implementationState: 'partial',
      transport: 'local',
      configured: true,
    });
    expect(service.getSummary().partial).toEqual(expect.arrayContaining(['discord', 'whatsapp', 'instagram', 'slack']));
  });

  it('marks WhatsApp as ready when the local stub status snapshot is healthy and chats are allowed', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-platform-capability-whatsapp-'));
    tempDirs.push(root);
    const statusFile = path.join(root, 'whatsapp-status.json');
    fs.writeFileSync(
      statusFile,
      JSON.stringify({
        mode: 'stub',
        enabled: true,
        started: true,
        recipientsConfigured: 2,
        sessionDirConfigured: true,
        lastError: null,
      }),
      'utf8',
    );

    process.env.WHATSAPP_ENABLED = 'true';
    process.env.WHATSAPP_ALLOWED_CHAT_IDS = 'chat-1,chat-2';
    process.env.WHATSAPP_SESSION_DIR = 'C:/tmp/whatsapp-session';
    process.env.WHATSAPP_STATUS_FILE = statusFile;

    const PlatformCapabilityService = loadService();
    const service = new PlatformCapabilityService();
    const capability = service.describe('whatsapp');

    expect(capability).toMatchObject({
      readiness: 'ready',
      implementationState: 'partial',
      transport: 'local',
      configured: true,
    });
    expect(capability.notes.join(' ')).toContain('WhatsApp runtime local supervisionado esta saudavel');
    expect(service.getSummary().ready).toContain('whatsapp');
  });

  it('marks Slack as ready when the local stub status snapshot is healthy and channels are allowed', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-platform-capability-slack-'));
    tempDirs.push(root);
    const statusFile = path.join(root, 'slack-status.json');
    fs.writeFileSync(
      statusFile,
      JSON.stringify({
        mode: 'stub',
        enabled: true,
        started: true,
        recipientsConfigured: 2,
        workspaceConfigured: true,
        lastError: null,
      }),
      'utf8',
    );

    process.env.SLACK_ENABLED = 'true';
    process.env.SLACK_ALLOWED_CHANNEL_IDS = 'ops,alerts';
    process.env.SLACK_WORKSPACE_ID = 'workspace-1';
    process.env.SLACK_STATUS_FILE = statusFile;

    const PlatformCapabilityService = loadService();
    const service = new PlatformCapabilityService();
    const capability = service.describe('slack');

    expect(capability).toMatchObject({
      readiness: 'ready',
      implementationState: 'partial',
      transport: 'local',
      configured: true,
    });
    expect(capability.notes.join(' ')).toContain('Slack runtime local supervisionado esta saudavel');
    expect(service.getSummary().ready).toContain('slack');
  });

  it('marks Slack as native/full when the bot token exists and the runtime snapshot is healthy', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-platform-capability-slack-native-'));
    tempDirs.push(root);
    const statusFile = path.join(root, 'slack-native-status.json');
    fs.writeFileSync(
      statusFile,
      JSON.stringify({
        mode: 'native',
        enabled: true,
        started: true,
        recipientsConfigured: 2,
        transport: 'native',
        nativeConfigured: true,
        apiBaseUrl: 'https://slack.test/api',
        workspaceConfigured: true,
        lastError: null,
      }),
      'utf8',
    );

    process.env.SLACK_ENABLED = 'true';
    process.env.SLACK_TRANSPORT = 'native';
    process.env.SLACK_BOT_TOKEN = 'xoxb-slack-native';
    process.env.SLACK_ALLOWED_CHANNEL_IDS = 'ops,alerts';
    process.env.SLACK_WORKSPACE_ID = 'workspace-1';
    process.env.SLACK_STATUS_FILE = statusFile;
    process.env.SLACK_API_BASE_URL = 'https://slack.test/api';

    const PlatformCapabilityService = loadService();
    const service = new PlatformCapabilityService();
    const capability = service.describe('slack');

    expect(capability).toMatchObject({
      readiness: 'ready',
      implementationState: 'full',
      transport: 'native',
      configured: true,
    });
    expect(capability.notes.join(' ')).toContain('Slack nativo esta configurado');
    expect(capability.notes.join(' ')).toContain('Slack Web API apontando para https://slack.test/api.');
    expect(service.getSummary().ready).toContain('slack');
  });

  it('surfaces WhatsApp provider decision when Cloud API is chosen as the target provider', () => {
    process.env.WHATSAPP_ENABLED = 'true';
    process.env.WHATSAPP_PROVIDER = 'cloud-api';
    process.env.WHATSAPP_PHONE_NUMBER_ID = '1234567890';
    process.env.WHATSAPP_ACCESS_TOKEN = 'wa-access-token';
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'verify-me';
    process.env.WHATSAPP_ALLOWED_CHAT_IDS = 'chat-1';

    const PlatformCapabilityService = loadService();
    const service = new PlatformCapabilityService();
    const capability = service.describe('whatsapp');

    expect(capability).toMatchObject({
      readiness: 'partial',
      implementationState: 'full',
      transport: 'webhook',
      configured: true,
    });
    expect(capability.notes.join(' ')).toContain('WhatsApp Cloud API foi escolhida como provider-alvo');
    expect(capability.envKeys).toEqual(
      expect.arrayContaining([
        'WHATSAPP_PROVIDER',
        'WHATSAPP_PHONE_NUMBER_ID',
        'WHATSAPP_ACCESS_TOKEN',
        'WHATSAPP_WEBHOOK_VERIFY_TOKEN',
      ]),
    );
  });

  it('marks WhatsApp as ready/full when the Cloud API runtime snapshot is healthy', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-platform-capability-whatsapp-cloud-'));
    tempDirs.push(root);
    const statusFile = path.join(root, 'whatsapp-cloud-status.json');
    fs.writeFileSync(
      statusFile,
      JSON.stringify({
        mode: 'cloud-api',
        enabled: true,
        started: true,
        recipientsConfigured: 1,
        provider: 'cloud-api',
        providerConfigured: true,
        webhookConfigured: true,
        lastError: null,
      }),
      'utf8',
    );

    process.env.WHATSAPP_ENABLED = 'true';
    process.env.WHATSAPP_PROVIDER = 'cloud-api';
    process.env.WHATSAPP_PHONE_NUMBER_ID = '1234567890';
    process.env.WHATSAPP_ACCESS_TOKEN = 'wa-access-token';
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'verify-me';
    process.env.WHATSAPP_ALLOWED_CHAT_IDS = 'chat-1';
    process.env.WHATSAPP_STATUS_FILE = statusFile;

    const PlatformCapabilityService = loadService();
    const service = new PlatformCapabilityService();
    const capability = service.describe('whatsapp');

    expect(capability).toMatchObject({
      readiness: 'ready',
      implementationState: 'full',
      transport: 'webhook',
      configured: true,
    });
    expect(capability.notes.join(' ')).toContain('WhatsApp Cloud API esta saudavel');
    expect(service.getSummary().ready).toContain('whatsapp');
  });

  it('surfaces Instagram provider decision when Meta Messaging API is chosen', () => {
    process.env.INSTAGRAM_ENABLED = 'true';
    process.env.INSTAGRAM_PROVIDER = 'meta-messaging';
    process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID = 'ig-business-1';
    process.env.INSTAGRAM_ACCESS_TOKEN = 'ig-access-token';
    process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN = 'ig-verify';
    process.env.INSTAGRAM_ALLOWED_RECIPIENT_IDS = 'ig-user-1';

    const PlatformCapabilityService = loadService();
    const service = new PlatformCapabilityService();
    const capability = service.describe('instagram');

    expect(capability).toMatchObject({
      readiness: 'partial',
      implementationState: 'full',
      transport: 'webhook',
      configured: true,
    });
    expect(capability.notes.join(' ')).toContain('Instagram Messaging API foi escolhida como provider-alvo');
    expect(capability.envKeys).toEqual(expect.arrayContaining([
      'INSTAGRAM_PROVIDER',
      'INSTAGRAM_BUSINESS_ACCOUNT_ID',
      'INSTAGRAM_ACCESS_TOKEN',
      'INSTAGRAM_WEBHOOK_VERIFY_TOKEN',
    ]));
  });

  it('marks Instagram as ready/full when the Meta Messaging runtime snapshot is healthy', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-platform-capability-instagram-meta-'));
    tempDirs.push(root);
    const statusFile = path.join(root, 'instagram-meta-status.json');
    fs.writeFileSync(
      statusFile,
      JSON.stringify({
        mode: 'meta-messaging',
        enabled: true,
        started: true,
        recipientsConfigured: 1,
        provider: 'meta-messaging',
        providerConfigured: true,
        webhookConfigured: true,
        lastError: null,
      }),
      'utf8',
    );

    process.env.INSTAGRAM_ENABLED = 'true';
    process.env.INSTAGRAM_PROVIDER = 'meta-messaging';
    process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID = 'ig-business-1';
    process.env.INSTAGRAM_ACCESS_TOKEN = 'ig-access-token';
    process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN = 'ig-verify';
    process.env.INSTAGRAM_ALLOWED_RECIPIENT_IDS = 'ig-user-1';
    process.env.INSTAGRAM_STATUS_FILE = statusFile;

    const PlatformCapabilityService = loadService();
    const service = new PlatformCapabilityService();
    const capability = service.describe('instagram');

    expect(capability).toMatchObject({
      readiness: 'ready',
      implementationState: 'full',
      transport: 'webhook',
      configured: true,
    });
    expect(capability.notes.join(' ')).toContain('Instagram Messaging API esta configurada');
    expect(service.getSummary().ready).toContain('instagram');
  });

  it('marks Discord as native/full when the bot token exists and the runtime snapshot is healthy', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-platform-capability-native-'));
    tempDirs.push(root);
    const statusFile = path.join(root, 'discord-status.json');
    fs.writeFileSync(
      statusFile,
      JSON.stringify({
        mode: 'native',
        enabled: true,
        started: true,
        lastError: null,
      }),
      'utf8',
    );

    process.env.DISCORD_BOT_TOKEN = 'discord-native-token';
    process.env.DISCORD_ALLOWED_GUILD_IDS = 'guild-native';
    process.env.DISCORD_BRIDGE_STATUS_FILE = statusFile;

    const PlatformCapabilityService = loadService();
    const service = new PlatformCapabilityService();

    expect(service.describe('discord')).toMatchObject({
      readiness: 'ready',
      implementationState: 'full',
      transport: 'native',
      configured: true,
    });
    expect(service.getSummary().ready).toContain('discord');
  });

  it('reports channel rollout and command exposure hints for Discord public-server policy', () => {
    process.env.DISCORD_BOT_TOKEN = 'discord-native-token';
    process.env.DISCORD_ALLOWED_GUILD_IDS = 'guild-native';
    process.env.DISCORD_ALLOWED_CHANNEL_IDS = 'channel-1,channel-2';
    process.env.DISCORD_PUBLIC_SERVER_MODE = 'true';
    process.env.DISCORD_COMMAND_EXPOSURE = 'minimal';

    const PlatformCapabilityService = loadService();
    const service = new PlatformCapabilityService();
    const capability = service.describe('discord');

    expect(capability.envKeys).toEqual(expect.arrayContaining(['DISCORD_ALLOWED_CHANNEL_IDS', 'DISCORD_COMMAND_EXPOSURE']));
    expect(capability.notes.join(' ')).toContain('Rollout por canal ativo para 2 canal(is) do Discord.');
    expect(capability.notes.join(' ')).toContain('Exposicao atual de slash commands: minimal.');
  });

  it('keeps Discord as partial in public-server mode until channel allowlists are configured', () => {
    process.env.DISCORD_BOT_TOKEN = 'discord-native-token';
    process.env.DISCORD_ALLOWED_GUILD_IDS = 'guild-native';
    process.env.DISCORD_PUBLIC_SERVER_MODE = 'true';
    process.env.DISCORD_COMMAND_EXPOSURE = 'minimal';

    const PlatformCapabilityService = loadService();
    const service = new PlatformCapabilityService();
    const capability = service.describe('discord');

    expect(capability.readiness).toBe('partial');
    expect(capability.notes.join(' ')).toContain('Modo de servidor publico ativo');
  });

  it('marks Discord bridge as ready only when the relay runtime snapshot is healthy', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-platform-capability-'));
    tempDirs.push(root);
    const statusFile = path.join(root, 'discord-bridge-status.json');
    fs.writeFileSync(
      statusFile,
      JSON.stringify({
        mode: 'bridge',
        enabled: true,
        started: true,
        lastError: null,
      }),
      'utf8',
    );

    process.env.DISCORD_BRIDGE_ENABLED = 'true';
    process.env.DISCORD_BRIDGE_SECRET = 'discord-secret';
    process.env.DISCORD_ALLOWED_GUILD_IDS = 'guild-1';
    process.env.DISCORD_BRIDGE_STATUS_FILE = statusFile;

    const PlatformCapabilityService = loadService();
    const service = new PlatformCapabilityService();

    expect(service.describe('discord')).toMatchObject({
      readiness: 'ready',
      implementationState: 'partial',
      transport: 'local',
      configured: true,
    });
    expect(service.getSummary().ready).toContain('discord');
  });

  it('keeps Discord native as partial when the status snapshot still belongs to bridge mode', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-platform-capability-mismatch-'));
    tempDirs.push(root);
    const statusFile = path.join(root, 'discord-status.json');
    fs.writeFileSync(
      statusFile,
      JSON.stringify({
        mode: 'bridge',
        enabled: true,
        started: true,
        lastError: null,
      }),
      'utf8',
    );

    process.env.DISCORD_BOT_TOKEN = 'discord-native-token';
    process.env.DISCORD_ALLOWED_GUILD_IDS = 'guild-native';
    process.env.DISCORD_BRIDGE_STATUS_FILE = statusFile;

    const PlatformCapabilityService = loadService();
    const service = new PlatformCapabilityService();
    const capability = service.describe('discord');

    expect(capability).toMatchObject({
      readiness: 'partial',
      implementationState: 'full',
      transport: 'native',
      configured: true,
    });
    expect(capability.notes.join(' ')).toContain('Discord status snapshot belongs to bridge mode');
  });

  it('promotes Signal, iMessage, Teams and Email when their setup snapshots are healthy', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-platform-capability-extra-'));
    tempDirs.push(root);
    const signalStatusFile = path.join(root, 'signal-status.json');
    const imessageStatusFile = path.join(root, 'imessage-status.json');
    const teamsStatusFile = path.join(root, 'teams-status.json');
    const emailStatusFile = path.join(root, 'email-status.json');

    fs.writeFileSync(signalStatusFile, JSON.stringify({ enabled: true, started: true, providerConfigured: true }), 'utf8');
    fs.writeFileSync(imessageStatusFile, JSON.stringify({ enabled: true, started: true, platform: 'darwin' }), 'utf8');
    fs.writeFileSync(teamsStatusFile, JSON.stringify({ enabled: true, started: true, providerConfigured: true }), 'utf8');
    fs.writeFileSync(emailStatusFile, JSON.stringify({ enabled: true, started: true }), 'utf8');

    process.env.SIGNAL_ENABLED = 'true';
    process.env.SIGNAL_CLI_PATH = 'signal-cli';
    process.env.SIGNAL_ACCOUNT_NUMBER = '+5511999999999';
    process.env.SIGNAL_ALLOWED_RECIPIENTS = '+5511888888888';
    process.env.SIGNAL_STATUS_FILE = signalStatusFile;
    process.env.IMESSAGE_ENABLED = 'true';
    process.env.IMESSAGE_NODE_ID = 'mac-node-1';
    process.env.IMESSAGE_ALLOWED_RECIPIENTS = 'alice@example.com';
    process.env.IMESSAGE_STATUS_FILE = imessageStatusFile;
    process.env.TEAMS_ENABLED = 'true';
    process.env.TEAMS_APP_ID = 'teams-app';
    process.env.TEAMS_APP_PASSWORD = 'teams-secret';
    process.env.TEAMS_TENANT_ID = 'tenant-1';
    process.env.TEAMS_ALLOWED_CONVERSATION_IDS = 'conversation-1';
    process.env.TEAMS_STATUS_FILE = teamsStatusFile;
    process.env.EMAIL_ENABLED = 'true';
    process.env.EMAIL_SMTP_HOST = 'smtp.example.test';
    process.env.EMAIL_ALLOWED_RECIPIENTS = 'ops@example.test';
    process.env.EMAIL_STATUS_FILE = emailStatusFile;

    const PlatformCapabilityService = loadService();
    const service = new PlatformCapabilityService();

    expect(service.describe('signal')).toMatchObject({ readiness: 'ready', transport: 'bridge' });
    expect(service.describe('imessage')).toMatchObject({ readiness: 'ready', transport: 'bridge' });
    expect(service.describe('teams')).toMatchObject({ readiness: 'ready', transport: 'webhook' });
    expect(service.describe('email')).toMatchObject({ readiness: 'ready', transport: 'native' });
    expect(service.getSummary().ready).toEqual(expect.arrayContaining(['signal', 'imessage', 'teams', 'email']));
  });
});
