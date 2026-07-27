import { ZAVORTH_EXTENSION_API_VERSION } from '../../src/contracts/ZavorthExtensionContract.js';
import type { ZavorthPluginManifest } from '../../src/contracts/PluginManifestContract.js';
import { ZavorthExtensionRegistryService } from '../../src/services/ZavorthExtensionRegistryService.js';

describe('ZavorthExtensionRegistryService', () => {
  const policy = {
    defaultTrust: 'trusted',
    requiresApproval: false,
    allowNetworkByDefault: false,
    allowFilesystemWriteByDefault: false,
    allowProcessSpawnByDefault: false,
    sandboxProfile: 'restricted',
  } as const;

  it('certifies, registers, filters, and invokes every general extension kind', async () => {
    const registry = new ZavorthExtensionRegistryService({ sourceTrustVerifier: () => true });
    const kinds = ['channel', 'provider', 'tool', 'skill', 'plugin', 'mcp', 'policy', 'health', 'verifier', 'receipt-renderer'] as const;
    const contributions = kinds.map((kind) => ({ id: kind, kind, exportName: kind, capabilityIds: [`${kind}.run`] }));
    const handlers = Object.fromEntries(kinds.map((kind) => [kind, (input: unknown) => ({ kind, input })]));
    const entry = registry.register({
      manifest: {
        schemaVersion: ZAVORTH_EXTENSION_API_VERSION,
        id: 'example.general', label: 'General', version: '1.0.0', summary: 'General extension',
        source: { kind: 'workspace', locator: '.', trusted: true }, contributions, permissions: [], policy,
        compatibility: { zavorthVersion: '>=2', extensionApiVersion: ZAVORTH_EXTENSION_API_VERSION },
      },
      handlers,
    });
    expect(entry.certification.status).toBe('certified');
    expect(registry.list('verifier')).toHaveLength(1);
    await expect(registry.invoke('EXAMPLE.GENERAL', 'health', { probe: true })).resolves.toEqual({ kind: 'health', input: { probe: true } });
  });

  it('rejects unsafe or incomplete manifests before loading handlers', () => {
    const registry = new ZavorthExtensionRegistryService({ sourceTrustVerifier: () => true });
    const certification = registry.certify({ id: '../bad', version: 'latest', contributions: [] });
    expect(certification.status).toBe('rejected');
    expect(certification.findings.map((item) => item.code)).toEqual(expect.arrayContaining(['schema_unsupported', 'policy_required', 'contribution_required']));
  });

  it('adapts the existing plugin manifest without changing the legacy contract', async () => {
    const registry = new ZavorthExtensionRegistryService({ sourceTrustVerifier: () => true });
    const plugin = {
      schemaVersion: 'zavorth.plugin-os.v1', id: 'legacy.provider', label: 'Legacy', version: '1.2.3', moduleKind: 'provider',
      summary: 'Legacy provider', description: 'Legacy provider', tags: [], source: { kind: 'local', locator: '.', trusted: true },
      compatibility: { zavorthVersion: '>=2', pluginApiVersion: 'zavorth.plugin-os.v1' },
      capabilities: [{ id: 'chat', intent: 'chat', label: 'Chat', summary: 'Chat' }], permissions: [],
      entrypoint: { module: './index.js', exportName: 'run', runtime: 'node' },
      lifecycle: { actions: ['install', 'enable', 'invoke'], defaultAction: 'invoke' }, policy, artifactKinds: [], receiptKinds: [],
    } as ZavorthPluginManifest;
    const entry = registry.registerPluginManifest(plugin, { run: (input) => input });
    expect(entry.manifest.legacyPluginManifest).toEqual(plugin);
    expect(entry.manifest.legacyPluginManifest).not.toBe(plugin);
    expect(entry.manifest.contributions[0]?.kind).toBe('provider');
    await expect(registry.invoke('legacy.provider', 'chat', 'hello')).resolves.toBe('hello');
  });

  it('requires every declared runtime export to be present', () => {
    const registry = new ZavorthExtensionRegistryService({ sourceTrustVerifier: () => true });
    expect(() => registry.register({
      manifest: {
        schemaVersion: ZAVORTH_EXTENSION_API_VERSION, id: 'missing.handler', label: 'Missing', version: '1.0.0', summary: 'Missing',
        source: { kind: 'local', locator: '.', trusted: true },
        contributions: [{ id: 'probe', kind: 'health', exportName: 'probe', capabilityIds: ['health.probe'] }],
        permissions: [], policy, compatibility: { zavorthVersion: '>=2', extensionApiVersion: ZAVORTH_EXTENSION_API_VERSION },
      }, handlers: {},
    })).toThrow('handler_missing');
    expect(registry.list()).toHaveLength(0);
  });

  it('rejects duplicuntil registration without replacing the active handler', async () => {
    const registry = new ZavorthExtensionRegistryService({ sourceTrustVerifier: () => true });
    const manifest = {
      schemaVersion: ZAVORTH_EXTENSION_API_VERSION, id: 'stable.extension', label: 'Stable', version: '1.0.0', summary: 'Stable',
      source: { kind: 'local', locator: '.', trusted: true } as const,
      contributions: [{ id: 'probe', kind: 'health' as const, exportName: 'probe', capabilityIds: ['health.probe'] }],
      permissions: [], policy, compatibility: { zavorthVersion: '>=2', extensionApiVersion: ZAVORTH_EXTENSION_API_VERSION },
    };
    registry.register({ manifest, handlers: { probe: () => 'original' } });
    expect(() => registry.register({ manifest, handlers: { probe: () => 'replacement' } })).toThrow('already registered');
    await expect(registry.invoke('stable.extension', 'probe', null)).resolves.toBe('original');
  });

  it('validates source, policy, permissions, capabilities, dependencies, and normalized ids', () => {
    const registry = new ZavorthExtensionRegistryService({ sourceTrustVerifier: () => true });
    const certification = registry.certify({
      schemaVersion: ZAVORTH_EXTENSION_API_VERSION,
      id: 'unsafe.extension', label: 'Unsafe', version: '1.0.0', summary: 'Unsafe',
      source: { kind: 'remote', locator: '', trusted: 'yes' } as never,
      policy: { ...policy, defaultTrust: 'root', sandboxProfile: 'unrestricted', requiresApproval: 'no' } as never,
      permissions: [
        { kind: 'root.access', scope: 'everywhere', reason: '', required: 'yes' },
        { kind: 'root.access', scope: 'everywhere', reason: '', required: 'yes' },
      ] as never,
      compatibility: { zavorthVersion: '>=2', extensionApiVersion: ZAVORTH_EXTENSION_API_VERSION },
      contributions: [{
        id: 'Health Probe', kind: 'health', exportName: 'probe', capabilityIds: ['Health Probe', 'health-probe'],
        dependsOn: ['Core / Probe', 'core/probe', 'bad/path/extra'],
      }],
    });
    expect(certification.status).toBe('rejected');
    expect(certification.findings.map((finding) => finding.code)).toEqual(expect.arrayContaining([
      'source_kind_invalid', 'trust_invalid', 'sandbox_invalid', 'policy_flag_invalid',
      'permission_kind_invalid', 'permission_scope_invalid', 'permission_reason_required',
      'permission_required_invalid', 'permission_duplicate', 'capability_id_duplicate',
      'dependency_duplicate', 'dependency_id_invalid',
    ]));
  });

  it('certifies handler availability without mutating registry state', () => {
    const registry = new ZavorthExtensionRegistryService({ sourceTrustVerifier: () => true });
    const certification = registry.certifyModule({
      manifest: {
        schemaVersion: ZAVORTH_EXTENSION_API_VERSION, id: 'module.check', label: 'Module', version: '1.0.0', summary: 'Module',
        source: { kind: 'local', locator: '.', trusted: true },
        contributions: [{ id: 'verify', kind: 'verifier', exportName: 'verify', capabilityIds: ['verify.run'] }],
        permissions: [], policy, compatibility: { zavorthVersion: '>=2', extensionApiVersion: ZAVORTH_EXTENSION_API_VERSION },
      },
      handlers: {},
    });
    expect(certification.findings).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'handler_missing' })]));
    expect(registry.list()).toEqual([]);
  });

  it('keeps certified state immutable across caller and handler mutation attempts', async () => {
    const registry = new ZavorthExtensionRegistryService({ sourceTrustVerifier: () => true });
    const manifest = {
      schemaVersion: ZAVORTH_EXTENSION_API_VERSION,
      id: 'immutable.extension', label: 'Immutable', version: '1.0.0', summary: 'Immutable registry state',
      source: { kind: 'local', locator: '.', trusted: true } as const,
      contributions: [{ id: 'probe', kind: 'health' as const, exportName: 'probe', capabilityIds: ['health.probe'] }],
      permissions: [], policy, compatibility: { zavorthVersion: '>=2', extensionApiVersion: ZAVORTH_EXTENSION_API_VERSION },
    };
    const entry = registry.register({
      manifest,
      handlers: {
        probe: (_input, context) => {
          context.contribution.capabilityIds.push('unsafe.runtime-mutation');
          return context.contribution.capabilityIds;
        },
      },
    });

    manifest.contributions[0]!.capabilityIds.push('unsafe.source-mutation');
    entry.manifest.contributions[0]!.capabilityIds.push('unsafe.return-mutation');
    registry.get('immutable.extension')!.manifest.policy.allowNetworkByDefault = true;
    registry.list()[0]!.manifest.permissions.push({ kind: 'network', scope: 'external', reason: 'mutation', required: true });

    await expect(registry.invoke('immutable.extension', 'probe', null)).rejects.toThrow();
    expect(registry.get('immutable.extension')!.manifest).toMatchObject({
      policy: { allowNetworkByDefault: false },
      contributions: [{ capabilityIds: ['health.probe'] }],
      permissions: [],
    });
  });

  it('fails closed for blocked, approval-gated, permissioned, and unsandboxed extensions', async () => {
    const approvalVerifier = jest.fn(async (context) => context.approvalId === 'approval-1');
    const permissionVerifier = jest.fn(async () => true);
    const registry = new ZavorthExtensionRegistryService({ approvalVerifier, permissionVerifier, sourceTrustVerifier: () => true });
    const base = {
      schemaVersion: ZAVORTH_EXTENSION_API_VERSION,
      label: 'Guarded', version: '1.0.0', summary: 'Guarded extension',
      source: { kind: 'workspace', locator: '.', trusted: true } as const,
      contributions: [{ id: 'run', kind: 'tool' as const, exportName: 'run', capabilityIds: ['tool.run'] }],
      compatibility: { zavorthVersion: '>=2', extensionApiVersion: ZAVORTH_EXTENSION_API_VERSION },
    };
    registry.register({
      manifest: { ...base, id: 'blocked.extension', permissions: [], policy: { ...policy, defaultTrust: 'blocked' } },
      handlers: { run: () => 'must-not-run' },
    });
    registry.register({
      manifest: { ...base, id: 'approval.extension', permissions: [], policy: { ...policy, requiresApproval: true } },
      handlers: { run: () => 'approved' },
    });
    registry.register({
      manifest: {
        ...base,
        id: 'permission.extension',
        permissions: [{ kind: 'filesystem.write', scope: 'workspace', reason: 'Writes a result.', required: true }],
        policy,
      },
      handlers: { run: () => 'permitted' },
    });
    registry.register({
      manifest: { ...base, id: 'sandbox.extension', permissions: [], policy: { ...policy, sandboxProfile: 'local-exec' } },
      handlers: { run: () => 'unsafe' },
    });

    await expect(registry.invoke('blocked.extension', 'run', null)).rejects.toThrow('extension_policy_blocked');
    await expect(registry.invoke('approval.extension', 'run', { exact: true })).rejects.toThrow('extension_approval_required');
    await expect(registry.invoke('approval.extension', 'run', { exact: true }, { approvalId: 'wrong' })).rejects.toThrow('extension_approval_invalid');
    await expect(registry.invoke('approval.extension', 'run', { exact: true }, { approvalId: 'approval-1' })).resolves.toBe('approved');
    await expect(registry.invoke('approval.extension', 'run', { exact: true }, { approvalId: 'approval-1' })).rejects.toThrow('extension_approval_replayed');
    await expect(registry.invoke('permission.extension', 'run', null)).rejects.toThrow('extension_permission_required');
    await expect(registry.invoke('permission.extension', 'run', null, {
      grantedPermissions: ['filesystem.write:workspace'],
    })).resolves.toBe('permitted');
    await expect(registry.invoke('sandbox.extension', 'run', null)).rejects.toThrow('extension_sandbox_executor_required');
  });

  it('does not trust a manifest self-assertion and rejects undeclared default capabilities', async () => {
    const manifest = {
      schemaVersion: ZAVORTH_EXTENSION_API_VERSION,
      id: 'self-trusted', label: 'Self trusted', version: '1.0.0', summary: 'Self asserted trust',
      source: { kind: 'workspace', locator: '.', trusted: true } as const,
      contributions: [{ id: 'run', kind: 'tool' as const, exportName: 'run', capabilityIds: ['run'] }],
      permissions: [],
      policy,
      compatibility: { zavorthVersion: '>=2', extensionApiVersion: ZAVORTH_EXTENSION_API_VERSION },
    };
    const registry = new ZavorthExtensionRegistryService();
    registry.register({ manifest, handlers: { run: () => 'unsafe' } });
    await expect(registry.invoke('self-trusted', 'run', null)).rejects.toThrow('extension_approval_required');

    const certification = registry.certify({
      ...manifest,
      id: 'undeclared-network',
      policy: { ...policy, allowNetworkByDefault: true, sandboxProfile: 'networked' },
    });
    expect(certification.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'network_permission_required' }),
    ]));
  });
});
