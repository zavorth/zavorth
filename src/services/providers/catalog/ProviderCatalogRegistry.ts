import * as fs from 'fs';
import * as path from 'path';
import { UNIVERSAL_PROVIDER_CATALOG, type ProviderCatalogEntry } from './UniversalProviderCatalog.js';
import { resolveZavorthLocalStateFile } from '../../../config/localStatePaths.js';
import { logger } from '../../../logger.js';
import { asErrorLike } from '../../../utils/errorLike.js';

export type RegisteredProvider = ProviderCatalogEntry & {
  baseUrl?: string | null;
  apiKeyEnv?: string | null;
  custom: boolean;
};

export type ProviderCatalogRegistration = {
  id: string;
  name: string;
  baseUrl?: string | null;
  apiKeyEnv?: string | null;
  defaultModel?: string | null;
  category?: ProviderCatalogEntry['category'];
  envKey?: string;
  protocol?: ProviderCatalogEntry['protocol'];
  runtimeSupported?: boolean;
};

type PersistedProvidersFile = {
  schemaVersion: 1;
  providers: Array<Omit<RegisteredProvider, 'custom'>>;
};

const DEFAULT_CATEGORY: ProviderCatalogEntry['category'] = 'cloud';
const DEFAULT_PROTOCOL: ProviderCatalogEntry['protocol'] = 'openai_compatible';

function normalizeId(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function normalizeEnvKey(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export class ProviderCatalogRegistry {
  private readonly entries = new Map<string, RegisteredProvider>();
  private filePath: string | null = null;

  constructor(runtime?: { filePath?: string | null; seed?: readonly ProviderCatalogEntry[] }) {
    this.filePath = runtime?.filePath ?? null;
    for (const entry of runtime?.seed ?? UNIVERSAL_PROVIDER_CATALOG) {
      this.entries.set(entry.id.toLowerCase(), { ...entry, custom: false });
    }
    this.loadPersisted();
  }

  configure(options: { filePath?: string | null }): void {
    this.filePath = options.filePath ?? null;
    this.loadPersisted();
  }

  getProvidersFilePath(): string {
    if (this.filePath) {
      return this.filePath;
    }
    return process.env.ZAVORTH_PROVIDERS_FILE || resolveZavorthLocalStateFile('providers.json');
  }

  register(input: ProviderCatalogRegistration): RegisteredProvider {
    const id = normalizeId(input.id);
    if (!id) {
      throw new Error('Provider registration requires an id.');
    }
    if (!input.name?.trim()) {
      throw new Error('Provider registration requires a name.');
    }
    const apiKeyEnv = input.apiKeyEnv ? normalizeEnvKey(input.apiKeyEnv) : null;
    const entry: RegisteredProvider = {
      id,
      name: input.name.trim(),
      category: input.category || DEFAULT_CATEGORY,
      envKey: apiKeyEnv || normalizeEnvKey(input.envKey || `${id}_API_KEY`),
      defaultModel: input.defaultModel || undefined,
      protocol: input.protocol || DEFAULT_PROTOCOL,
      runtimeSupported: input.runtimeSupported ?? true,
      baseUrl: input.baseUrl?.trim() || null,
      apiKeyEnv,
      custom: true,
    };
    this.entries.set(id, entry);
    this.persist();
    return entry;
  }

  unregister(id: string): boolean {
    const key = normalizeId(id);
    const existed = this.entries.delete(key);
    if (existed) {
      this.persist();
    }
    return existed;
  }

  get(id: string): RegisteredProvider | null {
    return this.entries.get(normalizeId(id)) || null;
  }

  has(id: string): boolean {
    return this.entries.has(normalizeId(id));
  }

  getAll(): RegisteredProvider[] {
    return Array.from(this.entries.values());
  }

  getCustomProviders(): RegisteredProvider[] {
    return this.getAll().filter((entry) => entry.custom);
  }

  knownKeys(): Set<string> {
    const keys = new Set<string>();
    for (const entry of this.entries.values()) {
      keys.add(entry.id.toLowerCase());
      keys.add(entry.name.toLowerCase());
    }
    return keys;
  }

  reload(): void {
    this.loadPersisted();
  }

  private loadPersisted(): void {
    const filePath = this.getProvidersFilePath();
    if (!fs.existsSync(filePath)) {
      return;
    }
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(raw) as Partial<PersistedProvidersFile>;
      const providers = Array.isArray(data?.providers) ? data.providers : [];
      for (const provider of providers) {
        const id = normalizeId(provider.id);
        if (!id || !provider.name?.trim()) {
          continue;
        }
        const apiKeyEnv = provider.apiKeyEnv ? normalizeEnvKey(provider.apiKeyEnv) : null;
        this.entries.set(id, {
          id,
          name: provider.name.trim(),
          category: provider.category || DEFAULT_CATEGORY,
          envKey: provider.envKey || apiKeyEnv || normalizeEnvKey(`${id}_API_KEY`),
          defaultModel: provider.defaultModel || undefined,
          protocol: provider.protocol || DEFAULT_PROTOCOL,
          runtimeSupported: provider.runtimeSupported ?? true,
          baseUrl: provider.baseUrl || null,
          apiKeyEnv,
          custom: true,
        });
      }
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[ProviderCatalogRegistry] Failed to load persisted providers; using curated catalog only.', {
        filePath,
        error: err.message,
      });
    }
  }

  private persist(): void {
    const filePath = this.getProvidersFilePath();
    const providers = this.getCustomProviders().map(({ custom: _custom, ...rest }) => rest);
    const payload: PersistedProvidersFile = { schemaVersion: 1, providers };
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.error('[ProviderCatalogRegistry] Failed to persist providers.', { filePath, error: err.message });
    }
  }
}

export const providerCatalogRegistry = new ProviderCatalogRegistry();
