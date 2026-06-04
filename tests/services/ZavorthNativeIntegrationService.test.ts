import { ZavorthNativeIntegrationService } from '../../src/services/ZavorthNativeIntegrationService.js';

describe('ZavorthNativeIntegrationService', () => {
  it('builds a Zavorth-native catalog without requiring runtime adapter code at runtime', () => {
    const snapshot = new ZavorthNativeIntegrationService({
      now: () => new Date('2026-05-23T12:00:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe('zavorth-native-integration/1');
    expect(snapshot.catalogId).toBe('zavorth-native');
    expect(snapshot.status).toBe('ready');
    expect(snapshot.summary.providers).toBeGreaterThan(80);
    expect(snapshot.summary.channels).toBeGreaterThanOrEqual(23);
    expect(snapshot.summary.capabilities).toBeGreaterThan(100);
    expect(snapshot.summary.needsAdapter).toBe(0);
    expect(snapshot.summary.missingConfigurationOnly).toBe(true);
    expect(snapshot.safety).toEqual(expect.objectContaining({
      noRuntimeAdapterCodeExecuted: true,
      noSecretsRead: true,
      noLiveNetworkCalls: true,
      zavorthNativeActivationRequiresConfigAndProof: true,
    }));

    const byId = new Map(snapshot.entries.map((entry) => [`${entry.kind}:${entry.id}`, entry]));
    for (const id of ['openai', 'anthropic', 'gemini', 'openrouter', 'grok', 'qwen', 'dashscope', 'brave', 'duckduckgo', 'firecrawl']) {
      expect(byId.get(`provider:${id}`)).toEqual(expect.objectContaining({
        source: 'zavorth-native-catalog',
        status: 'ready-for-configuration',
      }));
    }
    for (const id of ['telegram', 'discord', 'slack', 'whatsapp', 'signal', 'msteams', 'clickclack', 'matrix', 'line']) {
      expect(byId.get(`channel:${id}`)).toEqual(expect.objectContaining({
        source: 'zavorth-native-catalog',
        status: 'ready-for-configuration',
      }));
    }
    expect(byId.get('capability:codex')).toBeTruthy();
    expect(byId.get('capability:media-understanding-core')).toBeTruthy();
    expect(byId.get('capability:browser')).toBeTruthy();
    expect(snapshot.entries.every((entry) => entry.nativeSurface.startsWith('zavorth-native:'))).toBe(true);
  });
});
