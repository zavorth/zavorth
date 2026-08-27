import fs from 'fs';
import os from 'os';
import path from 'path';
import { ProviderCatalogRegistry } from '../../../../src/services/providers/catalog/ProviderCatalogRegistry';
import { UNIVERSAL_PROVIDER_CATALOG } from '../../../../src/services/providers/catalog/UniversalProviderCatalog';

describe('ProviderCatalogRegistry', () => {
  let tempDir: string;
  let registryPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-registry-'));
    registryPath = path.join(tempDir, 'providers.json');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('seeds curated providers as non-custom entries', () => {
    const registry = new ProviderCatalogRegistry({ filePath: registryPath });

    expect(registry.getAll()).toHaveLength(UNIVERSAL_PROVIDER_CATALOG.length);
    expect(registry.get('openai')?.custom).toBe(false);
    expect(registry.getCustomProviders()).toHaveLength(0);
  });

  it('registers a custom provider and persists it to disk', () => {
    const registry = new ProviderCatalogRegistry({ filePath: registryPath });

    const entry = registry.register({
      id: 'acme-ai',
      name: 'Acme AI',
      baseUrl: 'https://acme.example.com/v1',
      apiKeyEnv: 'ACME_API_KEY',
      defaultModel: 'acme-1',
    });

    expect(entry.custom).toBe(true);
    expect(entry.apiKeyEnv).toBe('ACME_API_KEY');
    expect(registry.get('acme-ai')?.baseUrl).toBe('https://acme.example.com/v1');
    expect(fs.existsSync(registryPath)).toBe(true);

    const persisted = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    expect(persisted.schemaVersion).toBe(1);
    expect(persisted.providers).toHaveLength(1);
    expect(persisted.providers[0].id).toBe('acme-ai');
    expect(persisted.providers[0].custom).toBeUndefined();
  });

  it('reloads persisted custom providers from disk on a new instance', () => {
    const first = new ProviderCatalogRegistry({ filePath: registryPath });
    first.register({
      id: 'corp-gw',
      name: 'Corp Gateway',
      baseUrl: 'https://gw.corp.example/v1',
      apiKeyEnv: 'CORP_API_KEY',
    });

    const second = new ProviderCatalogRegistry({ filePath: registryPath });

    expect(second.get('corp-gw')).not.toBeNull();
    expect(second.get('corp-gw')?.custom).toBe(true);
    expect(second.get('corp-gw')?.apiKeyEnv).toBe('CORP_API_KEY');
    expect(second.get('openai')?.custom).toBe(false);
  });

  it('unregisters a custom provider and removes it from disk', () => {
    const registry = new ProviderCatalogRegistry({ filePath: registryPath });
    registry.register({
      id: 'acme-ai',
      name: 'Acme AI',
      baseUrl: 'https://acme.example.com/v1',
      apiKeyEnv: 'ACME_API_KEY',
    });

    expect(registry.unregister('acme-ai')).toBe(true);
    expect(registry.get('acme-ai')).toBeNull();
    expect(fs.existsSync(registryPath)).toBe(true);

    const persisted = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    expect(persisted.providers).toHaveLength(0);
  });

  it('surfaces ids and names through knownKeys', () => {
    const registry = new ProviderCatalogRegistry({ filePath: registryPath });
    registry.register({
      id: 'acme-ai',
      name: 'Acme AI',
      baseUrl: 'https://acme.example.com/v1',
      apiKeyEnv: 'ACME_API_KEY',
    });

    const keys = registry.knownKeys();
    expect(keys.has('acme-ai')).toBe(true);
    expect(keys.has('acme ai')).toBe(true);
    expect(keys.has('openai')).toBe(true);
  });

  it('validates registration input at the boundary', () => {
    const registry = new ProviderCatalogRegistry({ filePath: registryPath });

    expect(() => registry.register({ id: '', name: 'Acme', baseUrl: 'https://x.example', apiKeyEnv: 'ACME_API_KEY' }))
      .toThrow(/id/i);
    expect(() => registry.register({ id: 'acme', name: '', baseUrl: 'https://x.example', apiKeyEnv: 'ACME_API_KEY' }))
      .toThrow(/name/i);
  });

  it('treats a missing providers file as an empty custom set', () => {
    const registry = new ProviderCatalogRegistry({ filePath: path.join(tempDir, 'missing.json') });

    expect(registry.getCustomProviders()).toHaveLength(0);
    expect(registry.getAll().length).toBe(UNIVERSAL_PROVIDER_CATALOG.length);
  });

  it('persists discovered models alongside the provider', () => {
    const registry = new ProviderCatalogRegistry({ filePath: registryPath });

    registry.register({
      id: 'acme-ai',
      name: 'Acme AI',
      baseUrl: 'https://acme.example.com/v1',
      apiKeyEnv: 'ACME_API_KEY',
      models: ['acme-1', 'acme-2', ''],
    });

    expect(registry.get('acme-ai')?.models).toEqual(['acme-1', 'acme-2']);

    const reloaded = new ProviderCatalogRegistry({ filePath: registryPath });
    expect(reloaded.get('acme-ai')?.models).toEqual(['acme-1', 'acme-2']);
  });

  it('updates an existing custom provider without losing untouched fields', () => {
    const registry = new ProviderCatalogRegistry({ filePath: registryPath });
    registry.register({
      id: 'acme-ai',
      name: 'Acme AI',
      baseUrl: 'https://acme.example.com/v1',
      apiKeyEnv: 'ACME_API_KEY',
      defaultModel: 'acme-1',
      models: ['acme-1'],
    });

    const updated = registry.update('acme-ai', { defaultModel: 'acme-2', models: ['acme-1', 'acme-2'] });

    expect(updated).not.toBeNull();
    expect(updated?.defaultModel).toBe('acme-2');
    expect(updated?.baseUrl).toBe('https://acme.example.com/v1');
    expect(updated?.apiKeyEnv).toBe('ACME_API_KEY');
    expect(updated?.models).toEqual(['acme-1', 'acme-2']);

    expect(registry.update('missing-id', { defaultModel: 'x' })).toBeNull();
  });

  it('reports readiness from runtime support, base URL, and credentials', () => {
    const registry = new ProviderCatalogRegistry({ filePath: registryPath });
    registry.register({
      id: 'acme-ai',
      name: 'Acme AI',
      baseUrl: 'https://acme.example.com/v1',
      apiKeyEnv: 'ACME_API_KEY',
    });
    registry.register({
      id: 'no-key',
      name: 'No Key',
      baseUrl: 'http://localhost:1234/v1',
    });
    registry.register({
      id: 'no-url',
      name: 'No URL',
      baseUrl: '',
      apiKeyEnv: 'NO_URL_API_KEY',
    });
    registry.register({
      id: 'disabled',
      name: 'Disabled',
      baseUrl: 'https://x.example/v1',
      runtimeSupported: false,
    });

    expect(registry.readiness('acme-ai')?.kind).toBe('awaiting_credentials');
    process.env.ACME_API_KEY = 'present';
    expect(registry.readiness('acme-ai')?.kind).toBe('ready');
    delete process.env.ACME_API_KEY;

    expect(registry.readiness('no-key')?.kind).toBe('ready');
    expect(registry.readiness('no-url')?.kind).toBe('missing_configuration');
    expect(registry.readiness('disabled')?.kind).toBe('unsupported');
    expect(registry.readiness('openai')?.kind).toBe('ready');
    expect(registry.readiness('missing-provider')).toBeNull();
  });
});
