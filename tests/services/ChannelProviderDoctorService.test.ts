import fs from 'fs';
import os from 'os';
import path from 'path';

describe('ChannelProviderDoctorService', () => {
  const originalEnv = process.env;
  const tempDirs: string[] = [];

  function loadService() {
    let ChannelProviderDoctorService: any;

    jest.isolateModules(() => {
      ({ ChannelProviderDoctorService } = require('../../src/services/ChannelProviderDoctorService'));
    });

    return ChannelProviderDoctorService;
  }

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    process.env.SLACK_ENABLED = '';
    process.env.SLACK_BOT_TOKEN = '';
    process.env.SLACK_SIGNING_SECRET = '';
    process.env.SLACK_TRANSPORT = '';
    process.env.SLACK_API_BASE_URL = '';
    process.env.SLACK_WORKSPACE_ID = '';
    process.env.SLACK_ALLOWED_CHANNEL_IDS = '';
    process.env.SLACK_STATUS_FILE = '';
    process.env.DISCORD_BOT_TOKEN = '';
    process.env.DISCORD_ALLOWED_GUILD_IDS = '';
    process.env.DISCORD_OWNER_USER_IDS = '';
    process.env.DISCORD_PUBLIC_SERVER_MODE = '';
    process.env.DISCORD_REQUIRED_ON_BOOT = '';
    process.env.DISCORD_BRIDGE_STATUS_FILE = '';
    process.env.TELEGRAM_BOT_TOKEN = '';
    process.env.TELEGRAM_ALLOWED_USER_IDS = '';
    process.env.WHATSAPP_ENABLED = '';
    process.env.WHATSAPP_PROVIDER = '';
    process.env.WHATSAPP_CLOUD_API_VERSION = '';
    process.env.WHATSAPP_PHONE_NUMBER_ID = '';
    process.env.WHATSAPP_ACCESS_TOKEN = '';
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = '';
    process.env.WHATSAPP_ALLOWED_CHAT_IDS = '';
    process.env.WHATSAPP_STATUS_FILE = '';
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
    process.env.ZAVORTH_CHANNEL_PROVIDER_DOCTOR_REPORT_FILE = '';
    process.env.ZAVORTH_CAPABILITY_LIFECYCLE_STATE_FILE = '';
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

  it('validates Slack native and WhatsApp Cloud API and persists the doctor report', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-channel-doctor-'));
    tempDirs.push(root);
    const slackStatusFile = path.join(root, 'slack-status.json');
    const discordStatusFile = path.join(root, 'discord-status.json');
    const whatsAppStatusFile = path.join(root, 'whatsapp-status.json');
    const reportFile = path.join(root, 'channel-provider-doctor-last.json');

    fs.writeFileSync(
      slackStatusFile,
      JSON.stringify({
        mode: 'native',
        enabled: true,
        started: true,
        workspaceId: 'T-ops',
        lastError: null,
      }),
      'utf8',
    );
    fs.writeFileSync(
      discordStatusFile,
      JSON.stringify({
        mode: 'native',
        enabled: true,
        started: true,
        lastError: null,
      }),
      'utf8',
    );
    fs.writeFileSync(
      whatsAppStatusFile,
      JSON.stringify({
        mode: 'cloud-api',
        provider: 'cloud-api',
        enabled: true,
        started: true,
        webhookConfigured: true,
        lastError: null,
      }),
      'utf8',
    );

    process.env.TELEGRAM_BOT_TOKEN = 'telegram-bot-token';
    process.env.TELEGRAM_ALLOWED_USER_IDS = '12345';
    process.env.DISCORD_BOT_TOKEN = 'discord-bot-token';
    process.env.DISCORD_ALLOWED_GUILD_IDS = 'G-ops';
    process.env.DISCORD_OWNER_USER_IDS = 'U-owner';
    process.env.DISCORD_BRIDGE_STATUS_FILE = discordStatusFile;
    process.env.SLACK_TRANSPORT = 'native';
    process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
    process.env.SLACK_SIGNING_SECRET = 'slack-signing-secret';
    process.env.SLACK_API_BASE_URL = 'https://slack.test/api';
    process.env.SLACK_ALLOWED_CHANNEL_IDS = 'C-ops';
    process.env.SLACK_STATUS_FILE = slackStatusFile;
    process.env.WHATSAPP_ENABLED = 'true';
    process.env.WHATSAPP_PROVIDER = 'cloud-api';
    process.env.WHATSAPP_CLOUD_API_VERSION = 'v20.0';
    process.env.WHATSAPP_PHONE_NUMBER_ID = '1234567890';
    process.env.WHATSAPP_ACCESS_TOKEN = 'wa-access-token';
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'verify-me';
    process.env.WHATSAPP_ALLOWED_CHAT_IDS = '5511999999999';
    process.env.WHATSAPP_STATUS_FILE = whatsAppStatusFile;
    process.env.ZAVORTH_CHANNEL_PROVIDER_DOCTOR_REPORT_FILE = reportFile;

    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, result: { id: 12345 } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'discord-user-id' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, team: 'T-ops' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: '1234567890' }),
      });

    const ChannelProviderDoctorService = loadService();
    const service = new ChannelProviderDoctorService({ fetchImpl });

    const report = await service.run();

    expect(report.status).toBe('passed');
    expect(report.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          channelId: 'telegram',
          status: 'passed',
          mode: 'native',
        }),
        expect.objectContaining({
          channelId: 'discord',
          status: 'passed',
          mode: 'native',
        }),
        expect.objectContaining({
          channelId: 'slack',
          status: 'passed',
          mode: 'native',
        }),
        expect.objectContaining({
          channelId: 'whatsapp',
          status: 'passed',
          mode: 'cloud-api',
        }),
      ]),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      'https://api.telegram.org/bottelegram-bot-token/getMe',
      expect.objectContaining({
        method: 'GET',
      }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      'https://discord.com/api/v10/users/@me',
      expect.objectContaining({
        method: 'GET',
      }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      3,
      'https://slack.test/api/auth.test',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      4,
      'https://graph.facebook.com/v20.0/1234567890?fields=id',
      expect.objectContaining({
        method: 'GET',
      }),
    );

    const persisted = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
    expect(persisted.status).toBe('passed');
    expect(persisted.command).toBe('npm run test:channels:smoke');
  });

  it('skips Discord native when the capability is dormant in the current profile', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-channel-doctor-discord-dormant-'));
    tempDirs.push(root);
    const discordStatusFile = path.join(root, 'discord-status.json');
    const lifecycleFile = path.join(root, 'capability-lifecycle.json');

    fs.writeFileSync(
      discordStatusFile,
      JSON.stringify({
        mode: 'native',
        enabled: true,
        started: false,
        lastError: null,
      }),
      'utf8',
    );
    fs.writeFileSync(
      lifecycleFile,
      JSON.stringify({
        capabilities: {
          discord: {
            state: 'dormant',
            notes: 'Perfil core nao preaquece Discord.',
          },
        },
      }),
      'utf8',
    );

    process.env.DISCORD_BOT_TOKEN = 'discord-bot-token';
    process.env.DISCORD_ALLOWED_GUILD_IDS = 'G-ops';
    process.env.DISCORD_OWNER_USER_IDS = 'U-owner';
    process.env.DISCORD_REQUIRED_ON_BOOT = 'false';
    process.env.DISCORD_BRIDGE_STATUS_FILE = discordStatusFile;
    process.env.ZAVORTH_CAPABILITY_LIFECYCLE_STATE_FILE = lifecycleFile;

    const ChannelProviderDoctorService = loadService();
    const service = new ChannelProviderDoctorService();

    const report = await service.run({ localOnly: true });
    const discord = report.items.find((entry: any) => entry.channelId === 'discord');

    expect(discord).toEqual(
      expect.objectContaining({
        channelId: 'discord',
        status: 'skipped',
        summary: expect.stringContaining('dormente no perfil atual'),
      }),
    );
  });

  it('skips Discord native when it is configured but optional on boot', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-channel-doctor-discord-optional-'));
    tempDirs.push(root);
    const discordStatusFile = path.join(root, 'discord-status.json');

    fs.writeFileSync(
      discordStatusFile,
      JSON.stringify({
        mode: 'native',
        enabled: true,
        started: false,
        lastError: null,
      }),
      'utf8',
    );

    process.env.DISCORD_BOT_TOKEN = 'discord-bot-token';
    process.env.DISCORD_ALLOWED_GUILD_IDS = 'G-ops';
    process.env.DISCORD_OWNER_USER_IDS = 'U-owner';
    process.env.DISCORD_REQUIRED_ON_BOOT = 'false';
    process.env.DISCORD_BRIDGE_STATUS_FILE = discordStatusFile;

    const ChannelProviderDoctorService = loadService();
    const service = new ChannelProviderDoctorService();

    const report = await service.run({ localOnly: true });
    const discord = report.items.find((entry: any) => entry.channelId === 'discord');

    expect(discord).toEqual(
      expect.objectContaining({
        channelId: 'discord',
        status: 'skipped',
        summary: expect.stringContaining('opcional no perfil atual'),
      }),
    );
  });

  it('fails honestly when Slack native is enabled without the operational prerequisites', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-channel-doctor-fail-'));
    tempDirs.push(root);
    const reportFile = path.join(root, 'channel-provider-doctor-last.json');

    process.env.SLACK_TRANSPORT = 'native';
    process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
    process.env.ZAVORTH_CHANNEL_PROVIDER_DOCTOR_REPORT_FILE = reportFile;

    const ChannelProviderDoctorService = loadService();
    const service = new ChannelProviderDoctorService();

    const report = await service.run({ localOnly: true });

    expect(report.status).toBe('failed');
    expect(report.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          channelId: 'slack',
          status: 'failed',
          error: expect.stringContaining('SLACK_SIGNING_SECRET'),
        }),
      ]),
    );
    expect(JSON.parse(fs.readFileSync(reportFile, 'utf8')).status).toBe('failed');
  });

  it('recognizes Slack and WhatsApp stub mode from fresh config even without a runtime status snapshot', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-channel-doctor-stub-'));
    tempDirs.push(root);
    const reportFile = path.join(root, 'channel-provider-doctor-last.json');

    process.env.SLACK_ENABLED = 'true';
    process.env.SLACK_TRANSPORT = 'stub';
    process.env.SLACK_ALLOWED_CHANNEL_IDS = 'C-ops';
    process.env.WHATSAPP_ENABLED = 'true';
    process.env.WHATSAPP_PROVIDER = 'stub';
    process.env.WHATSAPP_ALLOWED_CHAT_IDS = '5511999999999';
    process.env.ZAVORTH_CHANNEL_PROVIDER_DOCTOR_REPORT_FILE = reportFile;

    const ChannelProviderDoctorService = loadService();
    const service = new ChannelProviderDoctorService();

    const report = await service.run({ localOnly: true });

    expect(report.status).toBe('passed');
    expect(report.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          channelId: 'slack',
          status: 'passed',
          mode: 'stub',
        }),
        expect.objectContaining({
          channelId: 'whatsapp',
          status: 'passed',
          mode: 'stub',
        }),
      ]),
    );
  });

  it('fails honestly when Telegram and Discord are enabled without operational scope', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-channel-doctor-scope-'));
    tempDirs.push(root);
    process.env.TELEGRAM_BOT_TOKEN = 'telegram-bot-token';
    process.env.DISCORD_BOT_TOKEN = 'discord-bot-token';
    process.env.ZAVORTH_CHANNEL_PROVIDER_DOCTOR_REPORT_FILE = path.join(root, 'report.json');

    const ChannelProviderDoctorService = loadService();
    const service = new ChannelProviderDoctorService();

    const report = await service.run({ localOnly: true });

    expect(report.status).toBe('failed');
    expect(report.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          channelId: 'telegram',
          status: 'failed',
          error: expect.stringContaining('TELEGRAM_ALLOWED_USER_IDS'),
        }),
        expect.objectContaining({
          channelId: 'discord',
          status: 'failed',
          error: expect.stringContaining('DISCORD_ALLOWED_GUILD_IDS'),
        }),
      ]),
    );
  });

  it('skips Discord when the configured gateway is intentionally dormant in the current profile', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-channel-doctor-dormant-discord-'));
    tempDirs.push(root);
    const discordStatusFile = path.join(root, 'discord-status.json');
    const lifecycleFile = path.join(root, 'capability-lifecycle-state.json');

    fs.writeFileSync(
      discordStatusFile,
      JSON.stringify({
        mode: 'native',
        enabled: true,
        started: false,
        lastError: null,
      }),
      'utf8',
    );
    fs.writeFileSync(
      lifecycleFile,
      JSON.stringify({
        version: 1,
        profile: 'core',
        capabilities: {
          discord: {
            state: 'dormant',
            notes: 'Perfil core nao preaquece Discord.',
          },
        },
      }),
      'utf8',
    );

    process.env.DISCORD_BOT_TOKEN = 'discord-bot-token';
    process.env.DISCORD_PUBLIC_SERVER_MODE = 'true';
    process.env.DISCORD_REQUIRED_ON_BOOT = 'false';
    process.env.DISCORD_BRIDGE_STATUS_FILE = discordStatusFile;
    process.env.ZAVORTH_CAPABILITY_LIFECYCLE_STATE_FILE = lifecycleFile;
    process.env.SLACK_STATUS_FILE = path.join(root, 'missing-slack-status.json');
    process.env.WHATSAPP_STATUS_FILE = path.join(root, 'missing-whatsapp-status.json');

    const ChannelProviderDoctorService = loadService();
    const service = new ChannelProviderDoctorService();

    const report = await service.run({ localOnly: true });

    expect(report.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          channelId: 'discord',
          mode: 'native',
          status: 'skipped',
          summary: expect.stringContaining('dormente'),
        }),
      ]),
    );
  });

  it('validates Slack stub and WhatsApp stub locally when the runtime snapshots are healthy', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-channel-doctor-stubs-'));
    tempDirs.push(root);
    const slackStatusFile = path.join(root, 'slack-status.json');
    const whatsAppStatusFile = path.join(root, 'whatsapp-status.json');

    fs.writeFileSync(
      slackStatusFile,
      JSON.stringify({
        mode: 'stub',
        enabled: true,
        started: true,
        recipientsConfigured: 0,
        workspaceId: null,
        lastError: null,
      }),
      'utf8',
    );
    fs.writeFileSync(
      whatsAppStatusFile,
      JSON.stringify({
        mode: 'stub',
        provider: 'stub',
        enabled: true,
        started: true,
        recipientsConfigured: 0,
        providerConfigured: true,
        providerDecision: 'Stub local mantido enquanto o provider oficial do WhatsApp nao e conectado.',
        lastError: null,
      }),
      'utf8',
    );

    process.env.SLACK_STATUS_FILE = slackStatusFile;
    process.env.WHATSAPP_STATUS_FILE = whatsAppStatusFile;

    const ChannelProviderDoctorService = loadService();
    const service = new ChannelProviderDoctorService();

    const report = await service.run({ localOnly: true });

    expect(report.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          channelId: 'slack',
          mode: 'stub',
          status: 'passed',
        }),
        expect.objectContaining({
          channelId: 'whatsapp',
          mode: 'stub',
          status: 'passed',
        }),
      ]),
    );
  });

  it('supports WhatsApp Baileys with honest local doctor rules', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-channel-doctor-baileys-'));
    tempDirs.push(root);
    const whatsAppStatusFile = path.join(root, 'whatsapp-status.json');

    process.env.WHATSAPP_PROVIDER = 'baileys';
    process.env.WHATSAPP_STATUS_FILE = whatsAppStatusFile;

    const ChannelProviderDoctorService = loadService();
    const service = new ChannelProviderDoctorService();

    const failedReport = await service.run({ localOnly: true });
    expect(failedReport.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          channelId: 'whatsapp',
          mode: 'baileys',
          status: 'failed',
          error: expect.stringContaining('WHATSAPP_SESSION_DIR'),
        }),
      ]),
    );

    fs.writeFileSync(
      whatsAppStatusFile,
      JSON.stringify({
        mode: 'baileys',
        provider: 'baileys',
        enabled: true,
        started: true,
        providerConfigured: true,
        providerDecision: 'Baileys escolhido como provider-alvo; falta plugar sessao nativa persistente.',
        lastError: null,
      }),
      'utf8',
    );
    process.env.WHATSAPP_SESSION_DIR = path.join(root, 'wa-session');

    const passedReport = await service.run({ localOnly: true });
    expect(passedReport.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          channelId: 'whatsapp',
          mode: 'baileys',
          status: 'passed',
        }),
      ]),
    );
  });

  it('validates Signal, iMessage, Teams and Email with honest local rules', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-channel-doctor-extra-'));
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

    const ChannelProviderDoctorService = loadService();
    const service = new ChannelProviderDoctorService({ platform: 'win32' });

    const report = await service.run({ localOnly: true });

    expect(report.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ channelId: 'signal', mode: 'signal-cli', status: 'passed' }),
      expect.objectContaining({ channelId: 'imessage', mode: 'mac-bridge', status: 'passed' }),
      expect.objectContaining({ channelId: 'teams', mode: 'graph-bot', status: 'passed' }),
      expect.objectContaining({ channelId: 'email', mode: 'smtp-imap', status: 'passed' }),
    ]));
  });

  it('skips scaffolded external channels until they are explicitly enabled', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-channel-doctor-extra-disabled-'));
    tempDirs.push(root);
    const signalStatusFile = path.join(root, 'signal-status.json');
    fs.writeFileSync(signalStatusFile, JSON.stringify({ enabled: true, started: true }), 'utf8');

    process.env.SIGNAL_ENABLED = 'false';
    process.env.SIGNAL_CLI_PATH = 'signal-cli';
    process.env.SIGNAL_STATUS_FILE = signalStatusFile;
    process.env.IMESSAGE_ENABLED = 'false';
    process.env.IMESSAGE_READ_ONLY = 'true';
    process.env.IMESSAGE_STATUS_FILE = path.join(root, 'imessage-status.json');
    process.env.TEAMS_ENABLED = 'false';
    process.env.TEAMS_TRANSPORT = 'graph-bot';
    process.env.TEAMS_STATUS_FILE = path.join(root, 'teams-status.json');
    process.env.EMAIL_ENABLED = 'false';
    process.env.EMAIL_SMTP_HOST = 'smtp.example.test';
    process.env.EMAIL_STATUS_FILE = path.join(root, 'email-status.json');

    const ChannelProviderDoctorService = loadService();
    const service = new ChannelProviderDoctorService({ platform: 'win32' });

    const report = await service.run({ localOnly: true });

    expect(report.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ channelId: 'signal', status: 'skipped', enabled: false }),
      expect.objectContaining({ channelId: 'imessage', status: 'skipped', enabled: false }),
      expect.objectContaining({ channelId: 'teams', status: 'skipped', enabled: false }),
      expect.objectContaining({ channelId: 'email', status: 'skipped', enabled: false }),
    ]));
  });

  it('fails iMessage honestly when no macOS node host is available', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-channel-doctor-imessage-fail-'));
    tempDirs.push(root);

    process.env.IMESSAGE_ENABLED = 'true';
    process.env.IMESSAGE_NODE_ID = 'mac-node-1';
    process.env.IMESSAGE_ALLOWED_RECIPIENTS = 'alice@example.com';
    process.env.ZAVORTH_CHANNEL_PROVIDER_DOCTOR_REPORT_FILE = path.join(root, 'report.json');

    const ChannelProviderDoctorService = loadService();
    const service = new ChannelProviderDoctorService({ platform: 'win32' });

    const report = await service.run({ localOnly: true });

    expect(report.status).toBe('failed');
    expect(report.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        channelId: 'imessage',
        mode: 'mac-bridge',
        status: 'failed',
        error: expect.stringContaining('Node Host macOS'),
      }),
    ]));
  });

  it('reports email local-outbox explicitly when SMTP is not configured', async () => {
    process.env.EMAIL_ENABLED = 'true';
    process.env.EMAIL_ALLOWED_RECIPIENTS = 'ops@example.com';

    const ChannelProviderDoctorService = loadService();
    const service = new ChannelProviderDoctorService();
    const report = await service.run({ localOnly: true });
    const email = report.items.find((item: any) => item.channelId === 'email');

    expect(email).toMatchObject({
      channelId: 'email',
      mode: 'local-outbox',
      status: 'passed',
    });
  });
});
