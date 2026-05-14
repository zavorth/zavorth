import fs from 'fs';
import os from 'os';
import path from 'path';
import { ChannelSetupGuideService } from '../../src/services/ChannelSetupGuideService.js';

describe('ChannelSetupGuideService', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('includes all expanded channels in the catalog', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-channel-setup-catalog-'));
    tempDirs.push(root);
    const envFilePath = path.join(root, '.env');

    const service = new ChannelSetupGuideService({
      envFilePath,
      projectRoot: root,
    });

    const report = service.buildCatalog();
    const channelIds = report.entries.map((entry) => entry.channelId);

    expect(channelIds).toEqual(expect.arrayContaining([
      'telegram',
      'discord',
      'slack',
      'whatsapp',
      'instagram',
      'signal',
      'imessage',
      'teams',
      'email',
    ]));
  });

  it('applies setup presets for instagram, signal, imessage, teams and email', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-channel-setup-apply-'));
    tempDirs.push(root);
    const envFilePath = path.join(root, '.env');

    const service = new ChannelSetupGuideService({
      envFilePath,
      projectRoot: root,
    });

    const instagram = service.apply({
      channelId: 'instagram',
      mode: 'meta-messaging',
      values: {
        businessAccountId: 'ig-business-1',
        accessToken: 'ig-access-token',
        webhookVerifyToken: 'ig-verify',
        allowedRecipientIds: 'ig-user-1',
        outboxDir: path.join(root, 'data', 'instagram-bridge', 'outbox'),
        statusFile: path.join(root, 'data', 'runtime', 'instagram-status.json'),
      },
    });
    const signal = service.apply({
      channelId: 'signal',
      mode: 'signal-cli',
      values: {
        accountNumber: '+5511999999999',
        allowedRecipients: '+5511888888888',
        outboxDir: path.join(root, 'data', 'signal-bridge', 'outbox'),
        statusFile: path.join(root, 'data', 'runtime', 'signal-bridge-status.json'),
      },
    });
    const imessage = service.apply({
      channelId: 'imessage',
      mode: 'mac-bridge',
      values: {
        nodeId: 'mac-node-1',
        allowedRecipients: 'user@example.com',
        readOnly: 'true',
        outboxDir: path.join(root, 'data', 'imessage-bridge', 'outbox'),
        statusFile: path.join(root, 'data', 'runtime', 'imessage-bridge-status.json'),
      },
    });
    const teams = service.apply({
      channelId: 'teams',
      mode: 'graph-bot',
      values: {
        appId: 'teams-app-id',
        tenantId: 'tenant-id',
        allowedConversationIds: 'conversation-1',
      },
    });
    const email = service.apply({
      channelId: 'email',
      mode: 'local-outbox',
      values: {
        allowedRecipients: 'ops@example.com',
        outboxDir: path.join(root, 'data', 'email-bridge', 'outbox'),
        statusFile: path.join(root, 'data', 'runtime', 'email-status.json'),
      },
    });

    const envText = fs.readFileSync(envFilePath, 'utf8');

    expect(signal.envKeysWritten).toEqual(expect.arrayContaining([
      'SIGNAL_ENABLED',
      'SIGNAL_ACCOUNT_NUMBER',
      'SIGNAL_ALLOWED_RECIPIENTS',
    ]));
    expect(instagram.envKeysWritten).toEqual(expect.arrayContaining([
      'INSTAGRAM_ENABLED',
      'INSTAGRAM_PROVIDER',
      'INSTAGRAM_BUSINESS_ACCOUNT_ID',
      'INSTAGRAM_ALLOWED_RECIPIENT_IDS',
    ]));
    expect(imessage.envKeysWritten).toEqual(expect.arrayContaining([
      'IMESSAGE_ENABLED',
      'IMESSAGE_NODE_ID',
      'IMESSAGE_ALLOWED_RECIPIENTS',
    ]));
    expect(teams.envKeysWritten).toEqual(expect.arrayContaining([
      'TEAMS_ENABLED',
      'TEAMS_APP_ID',
      'TEAMS_ALLOWED_CONVERSATION_IDS',
    ]));
    expect(email.envKeysWritten).toEqual(expect.arrayContaining([
      'EMAIL_ENABLED',
      'EMAIL_TRANSPORT',
      'EMAIL_ALLOWED_RECIPIENTS',
    ]));

    expect(envText).toContain('SIGNAL_ENABLED=true');
    expect(envText).toContain('INSTAGRAM_PROVIDER=meta-messaging');
    expect(envText).toContain('IMESSAGE_BRIDGE_MODE=mac-bridge');
    expect(envText).toContain('TEAMS_TRANSPORT=graph-bot');
    expect(envText).toContain('EMAIL_TRANSPORT=local-outbox');
    expect(fs.existsSync(path.join(root, 'data', 'instagram-bridge', 'outbox'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'data', 'signal-bridge', 'outbox'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'data', 'imessage-bridge', 'outbox'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'data', 'email-bridge', 'outbox'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'data', 'runtime'))).toBe(true);
  });
});
