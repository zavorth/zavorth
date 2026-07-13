import {
  setPluginOsReadyPromise,
  waitForPluginOsReady,
  isPluginOsReady,
  getPluginOsReadyPromise,
} from '../../src/services/PluginOsAgentReadiness.js';
import { createPluginOsWireAdapterStores } from '../../src/services/PluginOsWireAdapterStores.js';
import {
  formatCredentialReadinessBlock,
  hasAnyLlmProviderCredential,
  buildProviderCredentialHints,
} from '../../src/services/AgentHarnessCredentialHints.js';
import { resolveDefaultAgentToolSecurityDefinition } from '../../src/security/AgentToolSecurityCatalog.js';

describe('P0/P1 agent harness readiness wiring', () => {
  afterEach(() => {
    setPluginOsReadyPromise(Promise.resolve(null));
  });

  it('waitForPluginOsReady resolves ready promise', async () => {
    let released = false;
    setPluginOsReadyPromise(
      new Promise((resolve) => {
        setTimeout(() => {
          released = true;
          resolve({ ok: true });
        }, 20);
      }),
    );
    expect(isPluginOsReady()).toBe(false);
    const result = await waitForPluginOsReady({ timeoutMs: 5000 });
    expect(released).toBe(true);
    expect(result.timedOut).toBe(false);
    expect(isPluginOsReady()).toBe(true);
    await getPluginOsReadyPromise();
  });

  it('waitForPluginOsReady soft-times out without throwing', async () => {
    setPluginOsReadyPromise(new Promise(() => { /* never */ }));
    const result = await waitForPluginOsReady({ timeoutMs: 30 });
    expect(result.timedOut).toBe(true);
    expect(result.waitedMs).toBeGreaterThanOrEqual(20);
  });

  it('wire adapter stores capture channel/memory/provider bindings', () => {
    const stores = createPluginOsWireAdapterStores();
    stores.channelAdapters.register({
      pluginId: 'platform-telegram',
      id: 'telegram',
      capabilityId: 'platform.telegram.send',
      send: async () => ({ ok: true }),
    });
    stores.memoryBackends.register({
      pluginId: 'memory-local',
      id: 'memory-local',
      capabilityId: 'memory.get',
      read: async () => ({ ok: true }),
    });
    stores.providers.register({
      pluginId: 'provider-xai',
      id: 'xai',
      capabilityId: 'provider.xai.complete',
      name: 'xai',
      complete: async () => ({ ok: true }),
    });
    const snap = stores.snapshot();
    expect(snap.channels).toHaveLength(1);
    expect(snap.memoryBackends).toHaveLength(1);
    expect(snap.providers).toHaveLength(1);
  });

  it('plugin_recommend and plugin_suggest are not security fallback', () => {
    for (const name of ['plugin_recommend', 'plugin_suggest']) {
      const def = resolveDefaultAgentToolSecurityDefinition(name);
      expect(def.source).not.toBe('fallback');
      expect(def.defaultRisk).not.toBe('forbidden');
    }
  });

  it('dynamic plugin.* tools get inferred/explicit security not forbidden fallback', () => {
    const def = resolveDefaultAgentToolSecurityDefinition('plugin.web-search.search.query', 'query');
    expect(def.source).not.toBe('fallback');
    expect(def.defaultRisk).toBe('review');
    expect(def.requiresConfirmation).toBe(true);
  });

  it('credential hints never echo secret values', () => {
    const prev = process.env.OPENAI_API_KEY;
    const fakeCredential = ['sk', 'should-never-appear-in-output'].join('-');
    process.env.OPENAI_API_KEY = fakeCredential;
    try {
      const block = formatCredentialReadinessBlock();
      expect(block).not.toContain(fakeCredential);
      expect(block).toMatch(/Skill trust profile|Tool exposure profile|skill marketplace|agent_manager/i);
      const hints = buildProviderCredentialHints();
      expect(hints.some((h) => h.id === 'openai' && h.present)).toBe(true);
      expect(hasAnyLlmProviderCredential()).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = prev;
    }
  });
});
