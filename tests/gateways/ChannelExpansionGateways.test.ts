import fs from 'fs';
import os from 'os';
import path from 'path';

describe('Expanded channel gateways', () => {
  const originalEnv = process.env;
  const tempDirs: string[] = [];

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

  it('writes Signal, iMessage, Teams and Email envelopes with runtime status', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-channel-expansion-'));
    tempDirs.push(root);
    jest.resetModules();
    process.env = { ...originalEnv };
    process.env.SIGNAL_ENABLED = 'true';
    process.env.SIGNAL_CLI_PATH = 'signal-cli';
    process.env.SIGNAL_ACCOUNT_NUMBER = '+5511999999999';
    process.env.SIGNAL_ALLOWED_RECIPIENTS = '+5511888888888';
    process.env.SIGNAL_OUTBOX_DIR = path.join(root, 'signal-outbox');
    process.env.SIGNAL_STATUS_FILE = path.join(root, 'signal-status.json');
    process.env.IMESSAGE_ENABLED = 'true';
    process.env.IMESSAGE_NODE_ID = 'mac-node-1';
    process.env.IMESSAGE_ALLOWED_RECIPIENTS = 'alice@example.com';
    process.env.IMESSAGE_READ_ONLY = 'false';
    process.env.IMESSAGE_OUTBOX_DIR = path.join(root, 'imessage-outbox');
    process.env.IMESSAGE_STATUS_FILE = path.join(root, 'imessage-status.json');
    process.env.TEAMS_ENABLED = 'true';
    process.env.TEAMS_APP_ID = 'teams-app';
    process.env.TEAMS_APP_PASSWORD = 'teams-secret';
    process.env.TEAMS_TENANT_ID = 'tenant-1';
    process.env.TEAMS_ALLOWED_CONVERSATION_IDS = 'conversation-1';
    process.env.TEAMS_OUTBOX_DIR = path.join(root, 'teams-outbox');
    process.env.TEAMS_STATUS_FILE = path.join(root, 'teams-status.json');
    process.env.EMAIL_ENABLED = 'true';
    process.env.EMAIL_SMTP_HOST = 'smtp.example.test';
    process.env.EMAIL_ALLOWED_RECIPIENTS = 'ops@example.test';
    process.env.EMAIL_OUTBOX_DIR = path.join(root, 'email-outbox');
    process.env.EMAIL_STATUS_FILE = path.join(root, 'email-status.json');

    let SignalGateway: any;
    let IMessageGateway: any;
    let TeamsGateway: any;
    let EmailGateway: any;
    jest.isolateModules(() => {
      ({ SignalGateway } = require('../../src/gateways/SignalGateway.stub'));
      ({ IMessageGateway } = require('../../src/gateways/IMessageGateway.stub'));
      ({ TeamsGateway } = require('../../src/gateways/TeamsGateway.stub'));
      ({ EmailGateway } = require('../../src/gateways/EmailGateway.stub'));
    });

    const signalGateway = new SignalGateway();
    jest.spyOn((signalGateway as any).liveClient, 'isConfigured').mockReturnValue(false);
    const imessageGateway = new IMessageGateway();
    const teamsGateway = new TeamsGateway();
    jest.spyOn((teamsGateway as any).graphClient, 'sendText').mockImplementation(async (input: any) => {
      (teamsGateway as any).writeEnvelope({
        recipients: [input.conversationId],
        message: input.message,
        kind: 'broadcast',
      });
      return {} as any;
    });
    const emailGateway = new EmailGateway();

    await signalGateway.start();
    await signalGateway.broadcast('signal ping');
    await imessageGateway.start();
    await imessageGateway.broadcast('imessage ping');
    await teamsGateway.start();
    await teamsGateway.broadcast('teams ping');
    await emailGateway.start();
    await emailGateway.broadcast('email ping');

    const signalEnvelope = JSON.parse(
      fs.readFileSync(path.join(process.env.SIGNAL_OUTBOX_DIR!, fs.readdirSync(process.env.SIGNAL_OUTBOX_DIR!)[0]), 'utf8'),
    );
    const imessageEnvelope = JSON.parse(
      fs.readFileSync(path.join(process.env.IMESSAGE_OUTBOX_DIR!, fs.readdirSync(process.env.IMESSAGE_OUTBOX_DIR!)[0]), 'utf8'),
    );
    const teamsEnvelope = JSON.parse(
      fs.readFileSync(path.join(process.env.TEAMS_OUTBOX_DIR!, fs.readdirSync(process.env.TEAMS_OUTBOX_DIR!)[0]), 'utf8'),
    );
    const emailEnvelope = JSON.parse(
      fs.readFileSync(path.join(process.env.EMAIL_OUTBOX_DIR!, fs.readdirSync(process.env.EMAIL_OUTBOX_DIR!)[0]), 'utf8'),
    );

    expect(signalEnvelope).toEqual(expect.objectContaining({
      platform: 'signal',
      transport: 'signal-cli-configured',
      recipients: ['+5511888888888'],
    }));
    expect(imessageEnvelope).toEqual(expect.objectContaining({
      platform: 'imessage',
      transport: 'mac-bridge-configured',
      recipients: ['alice@example.com'],
      approved: true,
    }));
    expect(teamsEnvelope).toEqual(expect.objectContaining({
      platform: 'teams',
      transport: 'graph-bot-configured',
      recipients: ['conversation-1'],
    }));
    expect(emailEnvelope).toEqual(expect.objectContaining({
      platform: 'email',
      transport: 'smtp-configured',
      recipients: ['ops@example.test'],
    }));

    const teamsStatus = JSON.parse(fs.readFileSync(process.env.TEAMS_STATUS_FILE!, 'utf8'));
    const emailStatus = JSON.parse(fs.readFileSync(process.env.EMAIL_STATUS_FILE!, 'utf8'));
    expect(teamsStatus).toEqual(expect.objectContaining({
      started: true,
      providerConfigured: true,
      recipientsConfigured: 1,
    }));
    expect(emailStatus).toEqual(expect.objectContaining({
      started: true,
      providerConfigured: true,
      recipientsConfigured: 1,
    }));
  });
});
