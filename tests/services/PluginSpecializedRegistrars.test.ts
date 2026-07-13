import { createSpecializedRegistrars } from '../../src/services/PluginSpecializedRegistrars.js';

describe('PluginSpecializedRegistrars (Wave 0)', () => {
  function host() {
    const capabilities = new Map<string, Function>();
    const findings: string[] = [];
    const specializedBindings: any[] = [];
    const hooks: any[] = [];
    const channels: any[] = [];
    return {
      capabilities,
      findings,
      specializedBindings,
      hooks,
      channels,
      api: createSpecializedRegistrars({
        bindCapability(id, handler) {
          capabilities.set(id, handler);
        },
        bindChannel(adapter) {
          channels.push(adapter);
        },
        registerHook(event, callback) {
          hooks.push({ event, callback });
        },
        findings,
        specializedBindings,
      }),
    };
  }

  it('registerSkill binds capability and records specialized kind', async () => {
    const h = host();
    h.api.registerSkill({
      kind: 'skill',
      id: 'demo-skill',
      capabilityId: 'skill.demo',
      handler: async (input) => ({ ok: true, echo: input?.q }),
    });
    expect(h.capabilities.has('skill.demo')).toBe(true);
    expect(h.specializedBindings[0].kind).toBe('skill');
    const result = await h.capabilities.get('skill.demo')!({ input: { q: 'hi' } });
    expect(result.output.ok).toBe(true);
    expect(result.output.echo).toBe('hi');
  });

  it('registerMiddleware attaches a hook', () => {
    const h = host();
    h.api.registerMiddleware('tool.after_execute', async () => {});
    expect(h.hooks).toHaveLength(1);
    expect(h.hooks[0].event).toBe('tool.after_execute');
    expect(h.specializedBindings.some((b) => b.kind === 'middleware')).toBe(true);
  });

  it('registerImageGenProvider soft-fails missing handler', () => {
    const h = host();
    h.api.registerImageGenProvider({
      kind: 'image_gen',
      id: 'img',
      capabilityId: 'media.image',
      // @ts-expect-error intentional
      handler: null,
    });
    expect(h.findings.length).toBeGreaterThan(0);
    expect(h.capabilities.size).toBe(0);
  });

  it('registerPlatform delegates to bindChannel', () => {
    const h = host();
    h.api.registerPlatform({
      id: 'telegram',
      capabilityId: 'channel.telegram',
      async send() {
        return { ok: true };
      },
    });
    expect(h.channels).toHaveLength(1);
    expect(h.specializedBindings[0].kind).toBe('platform');
  });
});
