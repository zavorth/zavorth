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
});
