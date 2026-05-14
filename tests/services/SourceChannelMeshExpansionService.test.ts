import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SlackChannelPack } from '../../src/adapters/channels/SlackChannelPack.js';
import { WhatsAppChannelPack } from '../../src/adapters/channels/WhatsAppChannelPack.js';
import { SourceChannelMeshExpansionService } from '../../src/services/SourceChannelMeshExpansionService.js';
import { SourceChannelSecretPolicyService } from '../../src/services/SourceChannelSecretPolicyService.js';
import { SourceChannelSimulatorService } from '../../src/services/SourceChannelSimulatorService.js';

describe('SourceChannelMeshExpansionService Phase 4', () => {
  const now = () => new Date('2026-05-05T16:00:00.000Z');
  let tempRoot: string;
  let sourceRoot: string;
  let zavorthRoot: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-source-channel-mesh-'));
    sourceRoot = path.join(tempRoot, 'source');
    zavorthRoot = path.join(tempRoot, 'zavorth');
    createFixtureSource(sourceRoot);
    createFixtureZavorth(zavorthRoot);
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('enforces SecretRef-only channel auth without serializing values', () => {
    const receipt = new SourceChannelSecretPolicyService().buildReceipt({
      channelId: 'slack',
      requiredSecretRefs: ['SLACK_BOT_TOKEN'],
      optionalSecretRefs: ['SLACK_SIGNING_SECRET'],
      allowlistRefs: ['SLACK_ALLOWED_CHANNEL_IDS'],
      env: {
        SLACK_BOT_TOKEN: 'xoxb-secret',
        SLACK_SIGNING_SECRET: 'signing-secret',
        SLACK_ALLOWED_CHANNEL_IDS: 'C123',
      },
    });

    expect(receipt.status).toBe('passed');
    expect(receipt.rawSecretValuesAccepted).toBe(false);
    expect(receipt.secretValuesSerialized).toBe(false);
    expect(JSON.stringify(receipt)).not.toContain('xoxb-secret');
    expect(JSON.stringify(receipt)).not.toContain('signing-secret');
  });

  it('runs an offline ChannelRuntime simulator covering core actions', () => {
    const snapshot = new SourceChannelSimulatorService({
      now,
    }).runScenario('slack');

    expect(snapshot.status).toBe('passed');
    expect(snapshot.actionsCovered.sort()).toEqual([
      'attachment',
      'delete',
      'edit',
      'reaction',
      'receive',
      'send',
      'thread',
    ]);
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        receipts: 7,
        liveIoPerformed: false,
        secretValuesSerialized: false,
      }),
    );
  });

  it('keeps Slack live smoke opt-in and allowlisted', async () => {
    const blocked = await new SlackChannelPack({
      now,
      botToken: 'xoxb-secret',
      allowedChannelIds: ['C123'],
      client: {
        chat: {
          postMessage: async () => ({ ts: '1710000000.0001' }),
        },
      },
    }).runLiveSmoke({
      channelId: 'C123',
      confirmLiveIo: false,
    });
    const applied = await new SlackChannelPack({
      now,
      botToken: 'xoxb-secret',
      allowedChannelIds: ['C123'],
      client: {
        chat: {
          postMessage: async () => ({ ts: '1710000000.0001' }),
        },
      },
    }).runLiveSmoke({
      channelId: 'C123',
      confirmLiveIo: true,
    });

    expect(blocked).toEqual(
      expect.objectContaining({
        status: 'blocked',
        liveIoPerformed: false,
      }),
    );
    expect(applied).toEqual(
      expect.objectContaining({
        status: 'applied',
        messageId: '1710000000.0001',
        liveIoPerformed: true,
        secretValuesSerialized: false,
      }),
    );
  });

  it('requires owner decision for WhatsApp Baileys patch risk', () => {
    const receipt = new WhatsAppChannelPack().buildBaileysPatchRiskReceipt({
      sourcePatchPresent: true,
      packageInstalledInZavorth: false,
      patchEvidencePath: 'patches/@whiskeysockets__baileys@7.0.0-rc.9.patch',
    });

    expect(receipt).toEqual(
      expect.objectContaining({
        channelId: 'whatsapp-baileys',
        status: 'owner_decision_required',
        packageName: '@whiskeysockets/baileys',
        patchPresentInSource: true,
        packageInstalledInZavorth: false,
        ownerDecisionRequired: true,
      }),
    );
  });

  it('emits a passing Phase 4 Channel Mesh expansion snapshot', () => {
    const service = new SourceChannelMeshExpansionService({
      now,
      sourceRoot,
      zavorthRoot,
    });
    const snapshot = service.buildSnapshot();
    const text = service.formatSnapshotText(snapshot);

    expect(snapshot.status).toBe('passed');
    expect(snapshot.phase).toBe(4);
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        packagesTracked: 8,
        packagesPresentInSource: 8,
        packagesImplementedInZavorth: 4,
        packs: 8,
        packsReadyOrReplaced: 8,
        ownerGatedPacks: 1,
        simulatorReceipts: 7,
        actionsCovered: 7,
        liveIoPerformed: false,
        enabledByDefault: false,
        secretValuesSerialized: false,
      }),
    );
    expect(snapshot.packs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          channelId: 'slack',
          status: 'ready',
          decision: 'implemented',
        }),
        expect.objectContaining({
          channelId: 'whatsapp-baileys',
          status: 'owner_decision_required',
          decision: 'implemented-owner-gated',
          patchRiskReceipt: expect.objectContaining({
            status: 'owner_decision_required',
            patchPresentInSource: true,
          }),
        }),
        expect.objectContaining({
          channelId: 'telegram',
          status: 'replaced-by-existing-channel',
        }),
      ]),
    );
    expect(snapshot.policy).toEqual(
      expect.objectContaining({
        noSourceSourceCopy: true,
        optionalPacksOnly: true,
        noLiveIoDuringPhase4Check: true,
        secretRefOnlyChannelAuth: true,
        whatsappBaileysRequiresPatchRiskOwnerDecision: true,
      }),
    );
    expect(snapshot.commands.nextPhase).toBe('Phase 5 - Memory, Document, Search And Terminal Pack');
    expect(text).toContain('Zavorth Source Channel Mesh Expansion - Phase 4');
    expect(text).toContain('Next: Phase 5 - Memory, Document, Search And Terminal Pack');
  });
});

function createFixtureSource(root: string): void {
  fs.mkdirSync(path.join(root, 'extensions', 'channels'), { recursive: true });
  fs.mkdirSync(path.join(root, 'patches'), { recursive: true });
  writeJson(path.join(root, 'package.json'), {
    name: 'source-fixture',
    dependencies: {
      '@slack/web-api': '^7.15.1',
      '@slack/bolt': '^4.7.2',
      'discord.js': '^14.18.0',
      grammy: '^1.42.0',
      qrcode: '1.5.4',
      'signal-utils': '0.21.1',
    },
    optionalDependencies: {
      '@whiskeysockets/baileys': '7.0.0-rc.9',
      '@matrix-org/matrix-sdk-crypto-nodejs': '^0.3.0',
    },
  });
  fs.writeFileSync(path.join(root, 'extensions', 'channels', 'channels.ts'), [
    "import { WebClient } from '@slack/web-api';",
    "import { App } from '@slack/bolt';",
    "import { Client } from 'discord.js';",
    "import { Bot } from 'grammy';",
    "import makeWASocket from '@whiskeysockets/baileys';",
    "import QRCode from 'qrcode';",
    "import 'signal-utils';",
    "import '@matrix-org/matrix-sdk-crypto-nodejs';",
    'export const channels = { WebClient, App, Client, Bot, makeWASocket, QRCode };',
  ].join('\n'));
  fs.writeFileSync(
    path.join(root, 'patches', '@whiskeysockets__baileys@7.0.0-rc.9.patch'),
    'fixture patch\n',
  );
}

function createFixtureZavorth(root: string): void {
  const files = [
    'src/adapters/channels/SlackChannelPack.ts',
    'src/adapters/channels/WhatsAppChannelPack.ts',
    'src/gateways/WhatsAppGateway.ts',
    'src/gateways/DiscordGateway.ts',
    'src/adapters/telegram/BotGateway.ts',
    'src/adapters/channels/SignalLiveClient.ts',
    'src/services/ChannelLongTailActivationService.ts',
    'src/adapters/channels/TeamsGraphBotClient.ts',
  ];
  for (const file of files) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), 'export {};');
  }
  writeJson(path.join(root, 'package.json'), {
    name: 'zavorth-fixture',
    dependencies: {
      '@slack/web-api': '^7.15.1',
      'discord.js': '^14.18.0',
      grammy: '^1.35.0',
      qrcode: '^1.5.4',
    },
  });
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}
