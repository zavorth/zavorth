import { resolveNaturalOperationalStatusCommand } from '../../../src/domain/surface/presentation/shared-surface/SharedSurfaceNaturalOperationalStatus.js';

describe('resolveNaturalOperationalStatusCommand', () => {
  it('maps provider readiness questions to the shared models command', () => {
    expect(resolveNaturalOperationalStatusCommand('quais providers estao prontos?')).toBe('/models');
    expect(resolveNaturalOperationalStatusCommand('show available models')).toBe('/models');
  });

  it('maps channel availability questions to the shared channels command', () => {
    expect(resolveNaturalOperationalStatusCommand('quais canais eu posso usar agora?')).toBe('/channels');
    expect(resolveNaturalOperationalStatusCommand('what channels are ready?')).toBe('/channels');
  });

  it('maps runtime health questions to the shared status command', () => {
    expect(resolveNaturalOperationalStatusCommand('tem algo quebrado?')).toBe('/status');
    expect(resolveNaturalOperationalStatusCommand('me mostre um resumo do runtime')).toBe('/status');
  });

  it('does not hijack provider mutation or selection requests', () => {
    expect(resolveNaturalOperationalStatusCommand('use o provider openai')).toBeNull();
    expect(resolveNaturalOperationalStatusCommand('trocar para ollama')).toBeNull();
  });
});
