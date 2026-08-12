import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { UniversalReachFabricService } from '../../src/services/UniversalReachFabricService.js';
import { ChannelSynthesisService } from '../../src/services/reach/ChannelSynthesisService.js';
import { buildProtocolPackDoctor, BUILTIN_PROTOCOL_PACKS } from '../../src/services/reach/ProtocolPackBase.js';

function tempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe('ProtocolPackBase', () => {
  it('never marks Tier B packs live-ready from configuration alone', () => {
    const pack = BUILTIN_PROTOCOL_PACKS.find((p) => p.id === 'matrix')!;
    const doctor = buildProtocolPackDoctor(pack, {
      MATRIX_BASE_URL: 'https://example.invalid',
      MATRIX_ACCESS_TOKEN: 'token-ref',
    });
    expect(doctor.configured).toBe(true);
    expect(doctor.liveReady).toBe(false);
    expect(doctor.proof).toBe('configuration');
  });
});

describe('ChannelSynthesisService', () => {
  let root: string;

  beforeEach(() => {
    root = tempDir('zavorth-synth-');
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('previews synthesis without writing files', () => {
    const service = new ChannelSynthesisService({ projectRoot: root });
    const out = service.synthesize({
      channelId: 'ops-chat',
      notes: 'webhook based team chat with WEBHOOK_URL',
      apply: false,
    });
    expect(out.draft.liveReady).toBe(false);
    expect(out.draft.trustState).toBe('draft');
    expect(out.filesWritten).toEqual([]);
    expect(out.receipt.kind).toBe('channel-synthesis-preview');
  });

  it('materializes Tier C pack into quarantine with allowlist and stub', () => {
    const service = new ChannelSynthesisService({ projectRoot: root });
    const out = service.synthesize({
      channelId: 'custom-relay',
      label: 'Custom Relay',
      notes: 'Use a relay bridge with BRIDGE_URL',
      family: 'relay',
      apply: true,
    });
    expect(out.draft.trustState).toBe('quarantined');
    expect(out.draft.liveReady).toBe(false);
    expect(fs.existsSync(path.join(out.draft.packDir, 'SYNTHESIS.json'))).toBe(true);
    expect(fs.existsSync(path.join(out.draft.packDir, 'adapter.stub.ts'))).toBe(true);
    expect(fs.existsSync(path.join(out.draft.packDir, 'allowlist.policy.json'))).toBe(true);
    const listed = service.listDrafts();
    expect(listed.some((d) => d.channelId === 'custom-relay')).toBe(true);
  });
});

describe('UniversalReachFabricService', () => {
  let root: string;

  beforeEach(() => {
    root = tempDir('zavorth-reach-');
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('classifies Tier A local surfaces as live-ready and external as not live without proof', () => {
    const service = new UniversalReachFabricService({
      projectRoot: root,
      env: {},
      nodeRegistry: { listNodes: () => [], getNode: () => null },
      nodePairing: null as any,
      nodeInvoke: null as any,
    });
    const snap = service.buildSnapshot({ includeSynthesisDrafts: false });
    expect(snap.policy.catalogIsNotLive).toBe(true);
    expect(snap.policy.brandAgnostic).toBe(true);
    expect(snap.summary.tierA).toBeGreaterThan(0);
    expect(snap.summary.tierB).toBeGreaterThan(0);

    const cli = snap.channels.find((c) => c.id === 'cli');
    const web = snap.channels.find((c) => c.id === 'web');
    const telegram = snap.channels.find((c) => c.id === 'telegram');
    expect(cli?.liveReady).toBe(true);
    expect(web?.liveReady).toBe(true);
    expect(telegram?.liveReady).toBe(false);
    expect(telegram?.readiness).toBe('needs-setup');

    // Tier B never live-ready from catalog
    const matrix = snap.channels.find((c) => c.id === 'matrix');
    expect(matrix?.tier).toBe('B');
    expect(matrix?.liveReady).toBe(false);
    expect(matrix?.defaultRouteAllowed).toBe(false);
  });

  it('synthesizes Tier C and keeps defaultRouteAllowed false', () => {
    const service = new UniversalReachFabricService({
      projectRoot: root,
      env: {},
      nodeRegistry: { listNodes: () => [], getNode: () => null },
      nodePairing: null as any,
      nodeInvoke: null as any,
      synthesis: new ChannelSynthesisService({ projectRoot: root }),
    });
    service.synthesizeChannel({
      channelId: 'factory-bot',
      notes: 'bot token style pack',
      family: 'bot-api',
      apply: true,
    });
    const snap = service.buildSnapshot({ includeSynthesisDrafts: true });
    const entry = snap.channels.find((c) => c.id === 'factory-bot');
    expect(entry?.tier).toBe('C');
    expect(entry?.liveReady).toBe(false);
    expect(entry?.defaultRouteAllowed).toBe(false);
    expect(entry?.readiness).toBe('synthesized');
  });

  it('creates pairing draft and capability taxonomy without product brands', () => {
    const service = new UniversalReachFabricService({
      projectRoot: root,
      env: {},
      nodeRegistry: { listNodes: () => [], getNode: () => null },
      nodePairing: null as any,
      nodeInvoke: null as any,
    });
    const pair = service.createNodePairingDraft({
      nodeId: 'desk-1',
      profileId: 'desktop-companion',
      capabilityIds: ['device.info', 'files.read'],
    });
    expect(pair.draft.nodeId).toBe('desk-1');
    expect(pair.draft.pairingCode.length).toBeGreaterThan(3);
    expect(pair.draft.bootstrapCommand).toContain('desk-1');
    expect(pair.draft.companionCommand).toContain('companion');

    const caps = service.listNodeCapabilities();
    expect(caps.some((c) => c.family === 'files')).toBe(true);
    expect(caps.some((c) => c.family === 'camera')).toBe(true);
    expect(caps.some((c) => c.family === 'shell')).toBe(true);
    for (const cap of caps) {
    }
  });

  it('previews node invoke and reports missing node', () => {
    const service = new UniversalReachFabricService({
      projectRoot: root,
      env: {},
      nodeRegistry: { listNodes: () => [], getNode: () => null },
      nodePairing: null as any,
      nodeInvoke: null as any,
    });
    const preview = service.previewNodeInvoke({
      nodeId: 'missing-node',
      capabilityId: 'files.read',
    });
    expect(preview.preview.allowed).toBe(false);
    expect(preview.preview.reason.toLowerCase()).toMatch(/not registered|n[aã]o encontrado|registry/);
  });
});
