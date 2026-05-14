import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ZavorthSemanticChannelMeshCertificationService } from '../../src/services/ZavorthSemanticChannelMeshCertificationService.js';

describe('ZavorthSemanticChannelMeshCertificationService S4', () => {
  const now = () => new Date('2026-05-05T17:00:00.000Z');
  let tempRoot: string;
  let sourceRoot: string;
  let zavorthRoot: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-semantic-channel-mesh-'));
    sourceRoot = path.join(tempRoot, 'source');
    zavorthRoot = path.join(tempRoot, 'zavorth');
    createFixtureSource(sourceRoot);
    createFixtureZavorth(zavorthRoot);
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('certifies S4 Channel Mesh semantics without live IO or secret serialization', () => {
    const snapshot = new ZavorthSemanticChannelMeshCertificationService({
      now,
      sourceRoot,
      zavorthRoot,
    }).buildSnapshot();

    expect(snapshot.status).toBe('passed');
    expect(snapshot.semanticPhase).toBe('S4');
    expect(snapshot.channelMeshStatus).toBe('passed');
    expect(snapshot.summary).toEqual(expect.objectContaining({
      semanticClaims: 48,
      gaps: 0,
      packagesCertified: 8,
      packsCertified: 8,
      secretPoliciesCertified: 11,
      allowlistPoliciesCertified: 8,
      simulatorActionsCertified: 7,
      secretScenariosPassed: 3,
      liveIoPerformed: false,
      enabledByDefault: false,
      secretValuesSerialized: false,
      sourceCodeCopied: false,
    }));
    expect(snapshot.summary.receiptBackedClaims).toBe(snapshot.summary.semanticClaims);
    expect(snapshot.summary.packStatuses).toEqual(expect.objectContaining({
      slack: 'ready',
      'whatsapp-baileys': 'owner_decision_required',
      telegram: 'replaced-by-existing-channel',
      msteams: 'replaced-by-existing-channel',
    }));
    expect(snapshot.policy).toEqual(expect.objectContaining({
      optionalPacksOnly: true,
      secretRefOnlyChannelAuth: true,
      allowlistRequiredBeforeLiveSend: true,
      webhookAndInboundRequireReceipts: true,
      simulatorMustCoverCoreActions: true,
      whatsappBaileysRequiresPatchRiskOwnerDecision: true,
      noLiveIoDuringCertification: true,
      rawSecretValuesRejected: true,
      unallowlistedLiveSendRejected: true,
    }));
  });

  it('keeps channel package and pack decisions explicit by semantic status', () => {
    const snapshot = new ZavorthSemanticChannelMeshCertificationService({
      now,
      sourceRoot,
      zavorthRoot,
    }).buildSnapshot();

    expect(packageClaim(snapshot, '@slack/web-api')).toEqual(expect.objectContaining({
      status: 'covered',
      priority: 'P0',
    }));
    expect(packageClaim(snapshot, '@slack/bolt')).toEqual(expect.objectContaining({
      status: 'replaced',
    }));
    expect(packageClaim(snapshot, '@whiskeysockets/baileys')).toEqual(expect.objectContaining({
      status: 'owner-gated',
      priority: 'P0',
    }));
    expect(packClaim(snapshot, 'slack')).toEqual(expect.objectContaining({
      status: 'covered',
      runtimeStatus: 'ready',
    }));
    expect(packClaim(snapshot, 'whatsapp-baileys')).toEqual(expect.objectContaining({
      status: 'owner-gated',
      runtimeStatus: 'owner_decision_required',
    }));
    expect(packClaim(snapshot, 'telegram')).toEqual(expect.objectContaining({
      status: 'replaced',
      runtimeStatus: 'replaced-by-existing-channel',
    }));
    expect(snapshot.claims).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'unsafe-channel-policy',
        status: 'rejected',
        expectedBehavior: 'The architecture must reject raw secret value channel auth.',
      }),
      expect.objectContaining({
        kind: 'unsafe-channel-policy',
        status: 'rejected',
        expectedBehavior: 'The architecture must reject unallowlisted live channel sends.',
      }),
    ]));
  });

  it('certifies simulator actions and inbound webhook-style receipts', () => {
    const snapshot = new ZavorthSemanticChannelMeshCertificationService({
      now,
      sourceRoot,
      zavorthRoot,
    }).buildSnapshot();

    expect(snapshot.claims.filter((claim) => claim.kind === 'simulator-action')).toHaveLength(7);
    for (const action of ['send', 'receive', 'thread', 'edit', 'delete', 'reaction', 'attachment']) {
      expect(actionClaim(snapshot, action)).toEqual(expect.objectContaining({
        status: 'covered',
        channelId: 'slack',
      }));
    }
    expect(snapshot.claims).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'webhook-policy',
        status: 'covered',
        action: 'receive',
      }),
    ]));
  });

  it('certifies SecretRef scenarios and Baileys patch-risk gate', () => {
    const snapshot = new ZavorthSemanticChannelMeshCertificationService({
      now,
      sourceRoot,
      zavorthRoot,
    }).buildSnapshot();
    const scenarios = Object.fromEntries(snapshot.secretScenarios.map((scenario) => [scenario.id, scenario]));

    expect(scenarios['missing-required-secret']).toEqual(expect.objectContaining({
      status: 'passed',
      secretValuesSerialized: false,
    }));
    expect(scenarios['configured-secret-redacted']).toEqual(expect.objectContaining({
      status: 'passed',
      secretValuesSerialized: false,
    }));
    expect(JSON.stringify(scenarios['configured-secret-redacted'])).not.toContain('xoxb-secret');
    expect(scenarios['missing-allowlist']).toEqual(expect.objectContaining({
      status: 'passed',
    }));
    expect(snapshot.claims).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'patch-risk-policy',
        status: 'owner-gated',
        channelId: 'whatsapp-baileys',
      }),
    ]));
  });

  it('formats a readable S4 operator summary', () => {
    const service = new ZavorthSemanticChannelMeshCertificationService({
      now,
      sourceRoot,
      zavorthRoot,
    });
    const text = service.formatSnapshotText(service.buildSnapshot());

    expect(text).toContain('Zavorth Semantic Channel Mesh Certification - S4');
    expect(text).toContain('Status: passed');
    expect(text).toContain('Next: S5 - Memory, Document, Search And Terminal Semantics');
  });
});

type Snapshot = ReturnType<ZavorthSemanticChannelMeshCertificationService['buildSnapshot']>;

function packageClaim(snapshot: Snapshot, packageName: string) {
  const claim = snapshot.claims.find((entry) =>
    entry.kind === 'package-coverage' && entry.packageName === packageName,
  );
  if (!claim) {
    throw new Error(`missing package claim ${packageName}`);
  }
  return claim;
}

function packClaim(snapshot: Snapshot, channelId: string) {
  const claim = snapshot.claims.find((entry) =>
    entry.kind === 'pack-runtime' && entry.channelId === channelId,
  );
  if (!claim) {
    throw new Error(`missing pack claim ${channelId}`);
  }
  return claim;
}

function actionClaim(snapshot: Snapshot, action: string) {
  const claim = snapshot.claims.find((entry) =>
    entry.kind === 'simulator-action' && entry.action === action,
  );
  if (!claim) {
    throw new Error(`missing action claim ${action}`);
  }
  return claim;
}

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
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
