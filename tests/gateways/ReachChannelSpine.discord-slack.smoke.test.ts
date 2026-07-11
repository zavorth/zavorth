import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';

describe('Reach Channel Spine Discord/Slack mock I/O smoke', () => {
  const originalEnv = process.env;
  const tempDirs: string[] = [];

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function loadDiscordGateway() {
    let DiscordGateway: any;
    jest.isolateModules(() => {
      ({ DiscordGateway } = require('../../src/gateways/channels/discord/DiscordGateway.stub'));
    });
    return DiscordGateway;
  }

  function loadSlackGateway() {
    let SlackGateway: any;
    jest.isolateModules(() => {
      ({ SlackGateway } = require('../../src/gateways/channels/slack/SlackGateway.stub'));
    });
    return SlackGateway;
  }

  it('Discord spine: inbound parse, allowlist, outbound outbox, doctor snapshot without network', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-discord-spine-'));
    tempDirs.push(root);
    process.env.DISCORD_ALLOWED_GUILD_IDS = 'guild-ops';
    process.env.DISCORD_ALLOWED_CHANNEL_IDS = 'channel-ops';
    process.env.DISCORD_ALLOW_DMS = 'false';
    process.env.DISCORD_OUTBOX_DIR = path.join(root, 'outbox');
    process.env.DISCORD_STATUS_FILE = path.join(root, 'status.json');

    const DiscordGateway = loadDiscordGateway();
    const broker = {
      processMessage: jest.fn(async (ctx: any) => {
        await ctx.reply('pong from discord spine token=super-secret');
      }),
    };
    const gateway = new DiscordGateway(broker, {
      outboxDir: process.env.DISCORD_OUTBOX_DIR,
      statusFile: process.env.DISCORD_STATUS_FILE,
      allowedGuildIds: ['guild-ops'],
      allowedChannelIds: ['channel-ops'],
      allowDirectMessages: false,
    });

    await gateway.start();
    await gateway.simulateIncomingMessage({
      userId: 'user-1',
      channelId: 'channel-ops',
      guildId: 'guild-ops',
      rawText: 'ping spine',
      isGroup: true,
    });

    const outboxFiles = fs.readdirSync(process.env.DISCORD_OUTBOX_DIR!);
    expect(outboxFiles.length).toBeGreaterThanOrEqual(1);
    const envelope = JSON.parse(
      fs.readFileSync(path.join(process.env.DISCORD_OUTBOX_DIR!, outboxFiles[0]), 'utf8'),
    );
    expect(envelope).toEqual(expect.objectContaining({
      platform: 'discord',
      transport: 'stub',
      kind: 'reply',
      secretValuesSerialized: false,
    }));
    expect(String(envelope.message)).toContain('[redacted]');
    expect(String(envelope.message)).not.toContain('super-secret');

    await gateway.broadcast('broadcast spine');
    const status = gateway.readStatus();
    expect(status).toEqual(expect.objectContaining({
      mode: 'stub',
      started: true,
      allowedGuildIds: ['guild-ops'],
      allowedChannelIds: ['channel-ops'],
    }));
    expect(status?.lastInboundAt).toBeTruthy();
    expect(status?.lastOutboundAt).toBeTruthy();

    const doctor = gateway.doctorSnapshot();
    expect(doctor).toEqual(expect.objectContaining({
      channelId: 'discord',
      mode: 'stub',
      allowlistConfigured: true,
    }));

    await expect(
      gateway.simulateIncomingMessage({
        userId: 'user-1',
        channelId: 'not-allowed',
        guildId: 'guild-ops',
        rawText: 'blocked',
      }),
    ).rejects.toThrow(/not allowlisted/i);

    expect(broker.processMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: 'discord',
        userId: 'user-1',
        rawText: 'ping spine',
      }),
    );
  });

  it('Slack spine: signed inbound, allowlist recipients, native mock outbound without live network', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-slack-spine-'));
    tempDirs.push(root);
    process.env.SLACK_ENABLED = 'true';
    process.env.SLACK_TRANSPORT = 'native';
    process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
    process.env.SLACK_SIGNING_SECRET = 'slack-signing-secret';
    process.env.SLACK_API_BASE_URL = 'https://slack.test/api';
    process.env.SLACK_ALLOWED_CHANNEL_IDS = 'C-ops';
    process.env.SLACK_OUTBOX_DIR = path.join(root, 'outbox');
    process.env.SLACK_STATUS_FILE = path.join(root, 'status.json');
    process.env.SLACK_WORKSPACE_ID = 'T-workspace';

    const SlackGateway = loadSlackGateway();
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, ts: '1712345.0009' }),
    }));
    const broker = {
      processMessage: jest.fn(async (ctx: any) => {
        await ctx.reply('pong slack spine');
      }),
    };
    const gateway = new SlackGateway(broker, { fetchImpl });

    await gateway.start();

    const rawBody = JSON.stringify({
      type: 'event_callback',
      event: {
        type: 'app_mention',
        user: 'U-ops',
        channel: 'C-ops',
        text: '<@bot> spine ping',
        ts: '1712345.0008',
      },
    });
    const timestamp = `${Math.floor(Date.now() / 1000)}`;
    const signature = `v0=${crypto
      .createHmac('sha256', 'slack-signing-secret')
      .update(`v0:${timestamp}:${rawBody}`)
      .digest('hex')}`;

    const result = await gateway.handleWebhookEvent({
      headers: {
        'x-slack-request-timestamp': timestamp,
        'x-slack-signature': signature,
      },
      rawBody,
      body: JSON.parse(rawBody),
    });

    expect(result).toEqual({
      statusCode: 200,
      body: { ok: true, accepted: true },
    });
    expect(broker.processMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: 'slack',
        userId: 'U-ops',
        chatId: 'C-ops',
        rawText: '<@bot> spine ping',
      }),
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://slack.test/api/chat.postMessage',
      expect.objectContaining({ method: 'POST' }),
    );

    const status = gateway.readStatus();
    expect(status).toEqual(expect.objectContaining({
      mode: 'native',
      recipientsConfigured: 1,
      allowedChannelIds: ['C-ops'],
      nativeConfigured: true,
    }));
    expect(status?.lastInboundAt).toBeTruthy();
    expect(status?.lastOutboundAt).toBeTruthy();
  });

  it('Slack spine stub outbox works as fallback without network', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-slack-spine-stub-'));
    tempDirs.push(root);
    process.env.SLACK_ENABLED = 'true';
    process.env.SLACK_TRANSPORT = 'stub';
    process.env.SLACK_BOT_TOKEN = '';
    process.env.SLACK_ALLOWED_CHANNEL_IDS = 'ops';
    process.env.SLACK_OUTBOX_DIR = path.join(root, 'outbox');
    process.env.SLACK_STATUS_FILE = path.join(root, 'status.json');

    const SlackGateway = loadSlackGateway();
    const gateway = new SlackGateway();
    await gateway.start();
    await gateway.broadcast('stub spine broadcast');

    const files = fs.readdirSync(process.env.SLACK_OUTBOX_DIR!);
    expect(files.length).toBe(1);
    const envelope = JSON.parse(
      fs.readFileSync(path.join(process.env.SLACK_OUTBOX_DIR!, files[0]), 'utf8'),
    );
    expect(envelope).toEqual(expect.objectContaining({
      transport: 'stub',
      recipients: ['ops'],
      message: 'stub spine broadcast',
    }));

    const doctor = gateway.doctorSnapshot();
    expect(doctor).toEqual(expect.objectContaining({
      channelId: 'slack',
      mode: 'stub',
      allowlistConfigured: true,
    }));
  });

  it('continuity handoff remains approval-required and long-tail stays outside the spine', async () => {
    jest.resetModules();
    const {
      ReachChannelSpineService,
    } = require('../../src/services/ReachChannelSpineService') as typeof import('../../src/services/ReachChannelSpineService.js');

    const service = new ReachChannelSpineService({
      now: () => new Date('2026-07-10T12:00:00.000Z'),
      env: {
        TELEGRAM_BOT_TOKEN: 'tg-token',
        DISCORD_BOT_TOKEN: 'discord-token',
        SLACK_BOT_TOKEN: 'xoxb-token',
        SLACK_ALLOWED_CHANNEL_IDS: 'C1',
      },
    });
    const snapshot = service.buildSnapshot({
      userId: 'ops',
      sessionId: 'spine-handoff',
    });

    expect(snapshot.continuity.approvalRequiredForChannelSwitch).toBe(true);
    expect(snapshot.continuity.handoffs.every((h) => h.requiresApproval)).toBe(true);
    expect(snapshot.longTailPolicy.separateFromSpine).toBe(true);
    expect(snapshot.longTailPolicy.telegramParityRequired).toBe(false);
    expect(snapshot.summary.longTailChannelsExcluded).toBe(true);
    expect(snapshot.members.map((m) => m.id)).not.toEqual(
      expect.arrayContaining(['matrix', 'qq', 'nostr']),
    );
  });
});
