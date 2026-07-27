import { ExtensionDocumentationService } from '../../../src/services/documentation/ExtensionDocumentationService.js';
import type { ExtensionDocumentationManifest } from '../../../src/contracts/documentation/ExtensionDocumentationContract.js';
import { ZAVORTH_EXTENSION_API_VERSION, type ZavorthExtensionManifest } from '../../../src/contracts/core/ZavorthExtensionContract.js';

const manifest = (): ExtensionDocumentationManifest => ({
  id: 'sample-extension', contractVersion: 'sample.v1', status: 'available', capabilities: ['chat'],
  title: { 'en-US': 'Sample extension', 'pt-BR': 'Sample extension' },
  summary: { 'en-US': 'Runs only when configured.', 'pt-BR': 'Runs only when configured.' },
  examples: [{ id: 'doctor', command: 'npm', args: ['run', 'doctor', '--silent'], expectedExitCode: 0 }],
});

describe('ExtensionDocumentationService', () => {
  it('adapts identity, contract and capabilities only from the canonical extension manifest', () => {
    const canonical = {
      schemaVersion: ZAVORTH_EXTENSION_API_VERSION, id: 'canonical-extension', label: 'Canonical extension', version: '1.0.0', summary: 'Canonical summary.',
      source: { kind: 'local', locator: '.', trusted: true }, contributions: [{ id: 'chat', kind: 'provider', exportName: 'provider', capabilityIds: ['chat', 'tools'] }],
      permissions: [], policy: { defaultTrust: 'review', sandboxProfile: 'metadata-only', requiresApproval: true, allowNetworkByDefault: false, allowFilesystemWriteByDefault: false, allowProcessSpawnByDefault: false },
      compatibility: { zavorthVersion: '*', extensionApiVersion: ZAVORTH_EXTENSION_API_VERSION },
    } as ZavorthExtensionManifest;
    const adapted = new ExtensionDocumentationService().fromExtensionManifest(canonical, { status: 'experimental', title: { 'pt-BR': 'Canonical extension' }, examples: [] });
    expect(adapted).toMatchObject({ id: canonical.id, contractVersion: canonical.schemaVersion, capabilities: ['chat', 'tools'], status: 'experimental' });
    expect(adapted.title['en-US']).toBe(canonical.label);
  });
  it('uses the device locale and falls back to truthful English copy', () => {
    const service = new ExtensionDocumentationService();
    expect(service.generate([manifest()], 'pt-PT')[0]?.markdown).toContain('Sample extension');
    const noTranslation = manifest(); delete noTranslation.title['pt-BR']; delete noTranslation.summary['pt-BR'];
    expect(service.generate([noTranslation], 'ja-JP')[0]?.markdown).toContain('Sample extension');
  });
  it('detects stale, missing and orphan documentation artifacts', () => {
    const service = new ExtensionDocumentationService(); const artifacts = service.generate([manifest()]);
    expect(service.verifyNoDrift([manifest()], artifacts).ok).toBe(true);
    expect(service.verifyNoDrift([{ ...manifest(), capabilities: ['chat', 'tools'] }], artifacts).findings).toContain('stale-artifact:sample-extension');
    expect(service.verifyNoDrift([], artifacts).findings).toContain('orphan-artifact:sample-extension');
  });
  it('executes examples with separated command arguments and verifies exit status', async () => {
    const service = new ExtensionDocumentationService(); const calls: unknown[] = [];
    const result = await service.verifyExamples(service.generate([manifest()]), async (command, args) => { calls.push([command, args]); return { exitCode: 0 }; });
    expect(result.ok).toBe(true); expect(calls).toEqual([['npm', ['run', 'doctor', '--silent']]]);
  });
  it('rejects shell-like or malformed examples before execution', () => {
    const bad = manifest(); bad.examples[0] = { id: 'bad', command: 'npm', args: ['run\ndoctor'], expectedExitCode: 0 };
    expect(() => new ExtensionDocumentationService().generate([bad])).toThrow(/Unsafe example arguments/);
  });
  it('rejects invalid runtime status and duplicuntil examples/artifacts', () => {
    const service = new ExtensionDocumentationService();
    const duplicuntil = manifest(); duplicate.examples.push({ ...duplicate.examples[0]! });
    expect(() => service.generate([duplicate])).toThrow(/Duplicate documentation example/);
    expect(() => service.generate([{ ...manifest(), status: 'live' as never }])).toThrow(/Invalid documentation status/);
    const artifacts = service.generate([manifest()]);
    expect(service.verifyNoDrift([manifest()], [...artifacts, ...artifacts]).findings).toContain('duplicate-artifact:sample-extension');
  });
  it('reports runner exceptions, invalid results and timeouts deterministically', async () => {
    const service = new ExtensionDocumentationService(); const artifacts = service.generate([manifest()]);
    expect((await service.verifyExamples(artifacts, async () => { throw new Error('secret detail'); })).findings).toEqual(['sample-extension:doctor:runner-error']);
    expect((await service.verifyExamples(artifacts, async () => ({ exitCode: Number.NaN }))).findings).toEqual(['sample-extension:doctor:invalid-result']);
    expect((await service.verifyExamples(artifacts, () => new Promise(() => undefined), 5)).findings).toEqual(['sample-extension:doctor:timeout']);
  });
});
