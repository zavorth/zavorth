import { registerSurfaceProfile, resetSurfaceProfileRegistryForTests } from '../../../src/domain/surface/application/surface-affordance/SurfaceProfileRegistry.js';
import {
  certifyChannelAdapter,
  listChannelFabricAdapters,
  probeChannelConnection,
  registerChannelFabricAdapter,
  renderChannelGovernancePresentation,
  resetChannelFabricForTests,
} from '../../../src/domain/surface/application/channel-fabric/index.js';

describe('ChannelFabricService', () => {
  beforeEach(() => {
    resetSurfaceProfileRegistryForTests();
    resetChannelFabricForTests();
  });

  test('certifies any registered profile without channel-specific branches', async () => {
    registerSurfaceProfile({
      id: 'partner-inbox',
      channel: 'plain',
      label: 'Partner inbox',
      preset: 'chat-interactive',
    });
    const adapter = registerChannelFabricAdapter({
      profileId: 'partner-inbox',
      probe: async () => ({ state: 'connected', latencyMs: 3, detail: null }),
    });
    const report = await certifyChannelAdapter(adapter.descriptor.id);
    expect(report.certified).toBe(true);
    expect(report.checks.map((check) => check.id)).toEqual(
      expect.arrayContaining(['descriptor', 'natural-slash', 'identity', 'receipt', 'approval', 'connection']),
    );
  });

  test('renders interactive approvals and structured receipts from affordances', () => {
    registerChannelFabricAdapter({ profileId: 'telegram' });
    const projection = renderChannelGovernancePresentation('telegram', { title: 'Deploy', reason: 'Writes production state.' });
    expect(projection.receipt.intent).toBe('receipt');
    expect(projection.approval.actions?.map((action) => action.id)).toEqual(['approve', 'deny']);
  });

  test('uses Natural Slash approval fallback when interactions are unavailable', () => {
    registerChannelFabricAdapter({ profileId: 'plain' });
    const projection = renderChannelGovernancePresentation('plain', { title: 'Delete', reason: 'Destructive action.', receiptId: 'r1' });
    expect(projection.approval.actions).toEqual([]);
    expect(projection.approval.blocks).toContainEqual(expect.objectContaining({ kind: 'text', text: expect.stringContaining('/approve r1') }));
  });

  test('reports unavailable and failed connections without claiming health', async () => {
    expect((await probeChannelConnection('missing')).state).toBe('unavailable');
    registerChannelFabricAdapter({ profileId: 'plain', probe: async () => { throw new Error('offline'); } });
    expect(await probeChannelConnection('plain')).toEqual(expect.objectContaining({ state: 'disconnected', detail: 'offline' }));
  });

  test('rejects duplicates unless replacement is explicit and normalizes lookups', async () => {
    registerChannelFabricAdapter({ profileId: 'plain', probe: async () => ({ state: 'connected', latencyMs: 1, detail: null }) });
    expect(() => registerChannelFabricAdapter({ profileId: 'plain' })).toThrow('already registered');
    registerChannelFabricAdapter({ profileId: 'plain', replace: true, probe: async () => ({ state: 'connected', latencyMs: 2, detail: null }) });
    expect(await probeChannelConnection('  PLAIN ')).toEqual(expect.objectContaining({ channelId: 'plain', latencyMs: 2 }));
  });

  test.each([
    [{ state: 'invented', latencyMs: 1, detail: null }, 'invalid state'],
    [{ state: 'connected', latencyMs: Number.NaN, detail: null }, 'invalid latency'],
    [{ state: 'connected', latencyMs: -1, detail: null }, 'invalid latency'],
  ])('fails closed for invalid probe payload %#', async (payload, expected) => {
    registerChannelFabricAdapter({ profileId: 'plain', probe: async () => payload as never });
    expect(await probeChannelConnection('plain')).toEqual(expect.objectContaining({ state: 'disconnected', detail: expect.stringContaining(expected) }));
  });

  test('times out stalled probes and certifies after replacement', async () => {
    registerChannelFabricAdapter({ profileId: 'plain', probeTimeoutMs: 10, probe: async () => new Promise(() => undefined) });
    expect(await probeChannelConnection('plain')).toEqual(expect.objectContaining({ state: 'disconnected', detail: 'Connection probe timed out.' }));
    registerChannelFabricAdapter({ profileId: 'plain', replace: true });
    expect((await certifyChannelAdapter('plain')).certified).toBe(true);
  });

  test('sanitizes and limits probe detail and keeps supplied receipt ids deterministic', async () => {
    registerChannelFabricAdapter({ profileId: 'plain', probe: async () => ({ state: 'connected', latencyMs: 1, detail: `ok\n${'x'.repeat(700)}` }) });
    const health = await probeChannelConnection('plain');
    expect(health.detail).not.toContain('\n');
    expect(health.detail?.length).toBeLessThanOrEqual(500);
    const first = renderChannelGovernancePresentation('plain', { title: 'Run', reason: 'Reason', receiptId: 'Stable-Receipt' });
    const second = renderChannelGovernancePresentation('plain', { title: 'Run', reason: 'Reason', receiptId: 'stable-receipt' });
    expect(first.receipt.id).toBe(second.receipt.id);
  });

  test('protects registered adapter state from caller mutation', async () => {
    const registered = registerChannelFabricAdapter({
      profileId: 'plain',
      probe: async () => ({ state: 'connected', latencyMs: 4, detail: null }),
    });
    registered.descriptor.id = 'mutated';
    registered.probeTimeoutMs = 1;
    const listed = listChannelFabricAdapters();
    listed[0]!.descriptor.affordances.length = 0;
    expect(await probeChannelConnection('plain')).toEqual(expect.objectContaining({ state: 'connected', latencyMs: 4 }));
    expect((await certifyChannelAdapter('plain')).checks.find((check) => check.id === 'descriptor')?.passed).toBe(true);
  });

  test('uses device locale with English fallback and validates visible text boundaries', () => {
    registerChannelFabricAdapter({ profileId: 'telegram' });
    const pt = renderChannelGovernancePresentation('telegram', { title: 'Publicar', reason: 'Alteraction approved.', locale: 'pt-BR' });
    expect(pt.approval.actions?.map((action) => action.label)).toEqual(['Aprovar', 'Negar']);
    const fallback = renderChannelGovernancePresentation('telegram', { title: 'Publish', reason: 'Approved change.', locale: 'de-DE' });
    expect(fallback.approval.actions?.map((action) => action.label)).toEqual(['Approve', 'Deny']);
    expect(() => renderChannelGovernancePresentation('telegram', { title: '', reason: 'Reason' })).toThrow(/title is required/);
    expect(() => renderChannelGovernancePresentation('telegram', { title: 'Title', reason: 'x'.repeat(4_001) })).toThrow(/exceeds/);
  });
});
