import { BUILTIN_CAPABILITIES } from '../../src/capabilities/BuiltinCapabilities';
import { CapabilityRegistry } from '../../src/capabilities/CapabilityRegistry';

describe('builtin capability public identity', () => {
  it('publishes native Zavorth ids and labels for the external executor surface', () => {
    const serialized = JSON.stringify(BUILTIN_CAPABILITIES);
    const ids = BUILTIN_CAPABILITIES.map((capability) => capability.id);

    expect(serialized).not.toMatch(/external legacy residue/i);
    expect(ids).toEqual(expect.arrayContaining([
      'executor.external',
      'command.external-review',
      'route-external-code-review',
    ]));
    expect(ids.every((id) => id.startsWith('executor.external') || id !== 'executor.external')).toBe(true);
  });

  it('keeps only native external executor commands in the public registry', () => {
    const registry = new CapabilityRegistry({ builtins: BUILTIN_CAPABILITIES });
    const aliases = registry.getAliasMap();

    expect(registry.findByCommand('external')?.id).toBe('executor.external');
    expect(registry.findByCommand('external_review')?.id).toBe('command.external-review');
    expect(aliases['/external-review']).toBe('/external_review');
  });
});
