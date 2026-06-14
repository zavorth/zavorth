import { ProviderModelRegistry, ProviderCapability } from '../../src/services/ProviderModelRegistry.js';

describe('ProviderModelRegistry', () => {
  it('should return default capabilities if unknown', () => {
    const caps = ProviderModelRegistry.getCapabilities('unknown_type', 'unknown_model');
    expect(caps.supportsChat).toBe(false);
    expect(caps.supportsToolCalling).toBe(false);
  });

  it('should return chat support for generic openai-compatible', () => {
    const caps = ProviderModelRegistry.getCapabilities('openai-compatible', 'my-custom-llm');
    expect(caps.supportsChat).toBe(true);
    expect(caps.supportsToolCalling).toBe(false); // conservative
  });

  it('should resolve tool calling for gpt-4', () => {
    const caps = ProviderModelRegistry.getCapabilities('openai', 'gpt-4-turbo');
    expect(caps.supportsToolCalling).toBe(true);
    expect(caps.supportsChat).toBe(true);
    expect(caps.supportsVision).toBe(false);
  });

  it('should resolve vision for gpt-4o', () => {
    const caps = ProviderModelRegistry.getCapabilities('openai', 'gpt-4o');
    expect(caps.supportsVision).toBe(true);
  });

  it('hasCapability should map correctly', () => {
    const caps = ProviderModelRegistry.getCapabilities('anthropic', 'claude-3-opus');
    expect(ProviderModelRegistry.hasCapability(caps, 'chat')).toBe(true);
    expect(ProviderModelRegistry.hasCapability(caps, 'tool_calling')).toBe(true);
    expect(ProviderModelRegistry.hasCapability(caps, 'reasoning')).toBe(false);
    expect(ProviderModelRegistry.hasCapability(caps, 'embedding')).toBe(false);
  });
});
