import fs from 'fs';
import os from 'os';
import path from 'path';
import { ChannelInstallScaffoldService } from '../../src/services/ChannelInstallScaffoldService.js';

describe('ChannelInstallScaffoldService', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('builds a mode-scoped plan for Slack native', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-channel-install-'));
    tempDirs.push(root);
    const envFilePath = path.join(root, '.env');
    fs.writeFileSync(envFilePath, 'SLACK_TRANSPORT=stub\n');

    const service = new ChannelInstallScaffoldService({
      envFilePath,
      projectRoot: root,
      localBaseUrl: 'http://127.0.0.1:33333',
      publicBaseUrl: 'https://example.test',
    });

    const plan = service.buildPlanForChannel('slack', 'native');

    expect(plan.channelId).toBe('slack');
    expect(plan.currentMode).toBe('stub');
    expect(plan.recommendedMode).toBe('stub');
    expect(plan.requiredEnvKeys).toEqual(
      expect.arrayContaining(['SLACK_BOT_TOKEN', 'SLACK_SIGNING_SECRET', 'SLACK_ALLOWED_CHANNEL_IDS']),
    );
    expect(plan.localWebhookUrl).toContain('/api/webhooks/slack');
    expect(plan.scaffoldEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'SLACK_TRANSPORT', value: 'native' }),
        expect.objectContaining({ key: 'SLACK_BOT_TOKEN' }),
      ]),
    );
  });

  it('builds a mode-scoped plan for WhatsApp cloud-api', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-channel-install-wa-'));
    tempDirs.push(root);
    const envFilePath = path.join(root, '.env');
    fs.writeFileSync(envFilePath, 'WHATSAPP_PROVIDER=stub\n');

    const service = new ChannelInstallScaffoldService({
      envFilePath,
      projectRoot: root,
      localBaseUrl: 'http://127.0.0.1:33333',
      publicBaseUrl: 'https://example.test',
    });

    const plan = service.buildPlanForChannel('whatsapp', 'cloud-api');

    expect(plan.channelId).toBe('whatsapp');
    expect(plan.currentMode).toBe('stub');
    expect(plan.requiredEnvKeys).toEqual(
      expect.arrayContaining([
        'WHATSAPP_PROVIDER',
        'WHATSAPP_PHONE_NUMBER_ID',
        'WHATSAPP_ACCESS_TOKEN',
        'WHATSAPP_WEBHOOK_VERIFY_TOKEN',
      ]),
    );
    expect(plan.localWebhookUrl).toContain('/api/webhooks/whatsapp');
    expect(plan.scaffoldEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'WHATSAPP_PROVIDER', value: 'cloud-api' }),
        expect.objectContaining({ key: 'WHATSAPP_PHONE_NUMBER_ID' }),
      ]),
    );
  });

  it('builds setup plans for Signal, iMessage, Teams and Email', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-channel-install-extra-'));
    tempDirs.push(root);
    const envFilePath = path.join(root, '.env');
    fs.writeFileSync(envFilePath, '');

    const service = new ChannelInstallScaffoldService({
      envFilePath,
      projectRoot: root,
      localBaseUrl: 'http://127.0.0.1:33333',
      publicBaseUrl: 'https://example.test',
    });

    const signal = service.buildPlanForChannel('signal', 'signal-cli');
    const imessage = service.buildPlanForChannel('imessage', 'mac-bridge');
    const teams = service.buildPlanForChannel('teams', 'graph-bot');
    const email = service.buildPlanForChannel('email', 'smtp-imap');

    expect(signal.scaffoldEntries).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'SIGNAL_ENABLED', value: 'false' }),
      expect.objectContaining({ key: 'SIGNAL_TRANSPORT', value: 'signal-cli' }),
      expect.objectContaining({ key: 'ZAVORTH_CHANNEL_POLICY_SIGNAL_OPEN', value: 'false' }),
    ]));
    expect(imessage.scaffoldEntries).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'IMESSAGE_ENABLED', value: 'false' }),
      expect.objectContaining({ key: 'IMESSAGE_BRIDGE_MODE', value: 'mac-bridge' }),
      expect.objectContaining({ key: 'IMESSAGE_READ_ONLY', value: 'true' }),
    ]));
    expect(teams.webhookPath).toBe('/api/webhooks/teams');
    expect(teams.publicWebhookUrl).toBe('https://example.test/api/webhooks/teams');
    expect(teams.scaffoldEntries).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'TEAMS_ENABLED', value: 'false' }),
    ]));
    expect(email.scaffoldEntries).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'EMAIL_ENABLED', value: 'true' }),
      expect.objectContaining({ key: 'EMAIL_TRANSPORT', value: 'local-outbox' }),
      expect.objectContaining({ key: 'EMAIL_SMTP_PORT', value: '587' }),
    ]));
  });

  it('builds mode-scoped Instagram setup plans for local stub and Meta Messaging API', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-channel-install-instagram-'));
    tempDirs.push(root);
    const envFilePath = path.join(root, '.env');
    fs.writeFileSync(envFilePath, 'INSTAGRAM_PROVIDER=stub\n');

    const service = new ChannelInstallScaffoldService({
      envFilePath,
      projectRoot: root,
      localBaseUrl: 'http://127.0.0.1:33333',
      publicBaseUrl: 'https://example.test',
    });

    const stub = service.buildPlanForChannel('instagram', 'stub');
    const meta = service.buildPlanForChannel('instagram', 'meta-messaging');

    expect(stub.currentMode).toBe('stub');
    expect(stub.scaffoldEntries).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'INSTAGRAM_PROVIDER', value: 'stub' }),
      expect.objectContaining({ key: 'INSTAGRAM_OUTBOX_DIR' }),
    ]));
    expect(meta.requiredEnvKeys).toEqual(expect.arrayContaining([
      'INSTAGRAM_PROVIDER',
      'INSTAGRAM_BUSINESS_ACCOUNT_ID',
      'INSTAGRAM_ACCESS_TOKEN',
      'INSTAGRAM_WEBHOOK_VERIFY_TOKEN',
      'INSTAGRAM_ALLOWED_RECIPIENT_IDS',
    ]));
    expect(meta.localWebhookUrl).toBe('http://127.0.0.1:33333/api/webhooks/instagram');
    expect(meta.publicWebhookUrl).toBe('https://example.test/api/webhooks/instagram');
    expect(meta.scaffoldEntries).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'INSTAGRAM_PROVIDER', value: 'meta-messaging' }),
      expect.objectContaining({ key: 'ZAVORTH_CHANNEL_POLICY_INSTAGRAM_OPEN', value: 'false' }),
    ]));
  });
});
