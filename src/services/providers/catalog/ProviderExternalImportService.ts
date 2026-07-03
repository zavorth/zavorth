import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import type { ProviderIntegrationManifest } from './ProviderIntegrationManifest.js';
import { createMinimalProviderIntegrationManifest } from './ProviderIntegrationManifest.js';
import { sanitizeModelId, sanitizeProviderId, sanitizeLabel } from './ModelIdSanitizer.js';
import type { ModelCapabilityKind, ModelModality } from './ProviderCatalogContracts.js';

export type ExternalProviderFormat = 'auto' | 'json' | 'yaml' | 'env' | 'external-json' | 'generic';

export interface RawProviderModel {
  id?: string;
  name?: string;
  label?: string;
  model?: string;
  primary?: boolean;
}

export interface RawProviderConfig {
  id?: string;
  name?: string;
  provider?: string;
  label?: string;
  baseUrl?: string;
  base_url?: string;
  baseURL?: string;
  apiKeyEnv?: string;
  api_key_env?: string;
  apiKey?: string;
  api_key?: string;
  models?: Array<string | RawProviderModel>;
  kind?: 'openai_compatible' | 'anthropic_compatible' | 'custom';
  compatibility?: 'openai_compatible' | 'anthropic_compatible' | 'custom';
  capabilities?: ModelCapabilityKind[];
  modalities?: ModelModality[];
  aliases?: string[];
  website?: string;
  url?: string;
}

export type ExternalProviderConfig = {
  id: string;
  label?: string;
  baseUrl?: string;
  apiKeyEnv?: string;
  apiKey?: string;
  models?: Array<{ id: string; name?: string; primary?: boolean }>;
  kind?: 'openai_compatible' | 'anthropic_compatible' | 'custom';
  capabilities?: ModelCapabilityKind[];
  modalities?: ModelModality[];
  aliases?: string[];
  website?: string;
};

export type ExternalImportInput = {
  source: string;
  format?: ExternalProviderFormat;
  projectRoot?: string;
};

export type ExternalImportResult = {
  success: boolean;
  providers: ExternalProviderConfig[];
  manifests: ProviderIntegrationManifest[];
  warnings: string[];
  errors: string[];
};

function detectFormat(source: string): ExternalProviderFormat {
  if (source.endsWith('.json')) return 'json';
  if (source.endsWith('.yaml') || source.endsWith('.yml')) return 'yaml';
  if (source.endsWith('.env') || source.includes('.env')) return 'env';
  return 'generic';
}

function parseJsonConfig(content: string): ExternalProviderConfig[] {
  try {
    const data = JSON.parse(content);
    if (Array.isArray(data)) {
      return data.map(normalizeConfig);
    }
    if (data.providers && Array.isArray(data.providers)) {
      return data.providers.map(normalizeConfig);
    }
    if (data.id) {
      return [normalizeConfig(data)];
    }
    return [];
  } catch {
    return [];
  }
}

function parseEnvConfig(content: string): ExternalProviderConfig[] {
  const providers: ExternalProviderConfig[] = [];
  const lines = content.split('\n');
  const providerMap = new Map<string, Partial<ExternalProviderConfig>>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^([A-Z_]+)\s*=\s*(.+)$/);
    if (!match) continue;

    const [, key, value] = match;
    const cleanValue = value.replace(/^["']|["']$/g, '');

    if (key.endsWith('_API_KEY')) {
      const providerId = key.replace(/_API_KEY$/, '').toLowerCase().replace(/_/g, '-');
      const existing = providerMap.get(providerId) || {};
      existing.id = providerId;
      existing.apiKeyEnv = key;
      existing.apiKey = cleanValue;
      providerMap.set(providerId, existing);
    } else if (key.endsWith('_BASE_URL')) {
      const providerId = key.replace(/_BASE_URL$/, '').toLowerCase().replace(/_/g, '-');
      const existing = providerMap.get(providerId) || {};
      existing.id = providerId;
      existing.baseUrl = cleanValue;
      providerMap.set(providerId, existing);
    } else if (key.endsWith('_MODEL')) {
      const providerId = key.replace(/_MODEL$/, '').toLowerCase().replace(/_/g, '-');
      const existing = providerMap.get(providerId) || {};
      existing.id = providerId;
      if (!existing.models) existing.models = [];
      existing.models.push({ id: cleanValue, primary: existing.models.length === 0 });
      providerMap.set(providerId, existing);
    }
  }

  for (const config of Array.from(providerMap.values())) {
    if (config.id) {
      providers.push(normalizeConfig(config));
    }
  }

  return providers;
}

function normalizeConfig(raw: RawProviderConfig): ExternalProviderConfig {
  const id = sanitizeProviderId(raw.id || raw.name || raw.provider || '');
  return {
    id,
    label: sanitizeLabel(raw.label || raw.name || id),
    baseUrl: raw.baseUrl || raw.base_url || raw.baseURL || undefined,
    apiKeyEnv: raw.apiKeyEnv || raw.api_key_env || undefined,
    apiKey: raw.apiKey || raw.api_key || undefined,
    models: Array.isArray(raw.models)
      ? raw.models.map((m) => ({
          id: sanitizeModelId(typeof m === 'string' ? m : m.id || m.model || ''),
          name: typeof m === 'string' ? undefined : m.name || m.label || undefined,
          primary: typeof m === 'string' ? false : m.primary || false,
        }))
      : undefined,
    kind: raw.kind || raw.compatibility || 'openai_compatible',
    capabilities: raw.capabilities || undefined,
    modalities: raw.modalities || undefined,
    aliases: raw.aliases || undefined,
    website: raw.website || raw.url || undefined,
  };
}

function configToManifest(config: ExternalProviderConfig): ProviderIntegrationManifest {
  const id = sanitizeProviderId(config.id);
  const label = sanitizeLabel(config.label || id);

  const models = (config.models || []).map((m) => ({
    modelId: sanitizeModelId(m.id),
    label: m.name || m.id,
    primary: m.primary || false,
  }));

  const defaultModel = models.find((m) => m.primary)?.modelId || models[0]?.modelId || 'default';

  return createMinimalProviderIntegrationManifest({
    id,
    label,
    vendorId: id,
    providerId: id,
    providerName: id,
    aliases: config.aliases || [id],
    website: config.website,
    routeKind: 'custom_compatible',
    mode: 'cloud',
    authKind: 'api_key',
    credentialRefs: [config.apiKeyEnv || `${id.toUpperCase().replace(/-/g, '_')}_API_KEY`],
    capabilities: config.capabilities || ['chat', 'streaming'],
    modalities: config.modalities || ['text'],
    defaultModelName: defaultModel,
    source: 'custom',
  });
}

export class ProviderExternalImportService {
  public async import(input: ExternalImportInput): Promise<ExternalImportResult> {
    const warnings: string[] = [];
    const errors: string[] = [];
    const providers: ExternalProviderConfig[] = [];

    const format = input.format === 'auto' || !input.format
      ? detectFormat(input.source)
      : input.format;

    let content: string;

    try {
      if (input.source.startsWith('{') || input.source.startsWith('[') || format === 'env' || input.source.includes('=')) {
        content = input.source;
      } else {
        const filePath = input.projectRoot
          ? join(input.projectRoot, input.source)
          : input.source;

        if (!existsSync(filePath)) {
          return {
            success: false,
            providers: [],
            manifests: [],
            warnings,
            errors: [`File not found: ${filePath}`],
          };
        }

        content = readFileSync(filePath, 'utf-8');
      }
    } catch (error) {
      return {
        success: false,
        providers: [],
        manifests: [],
        warnings,
        errors: [`Failed to read source: ${error instanceof Error ? error.message : 'Unknown error'}`],
      };
    }

    try {
      switch (format) {
        case 'json':
        case 'external-json':
        case 'generic':
          providers.push(...parseJsonConfig(content));
          break;
        case 'env':
          providers.push(...parseEnvConfig(content));
          break;
        case 'yaml':
          warnings.push('YAML parsing not yet implemented. Convert to JSON first.');
          break;
        default:
          providers.push(...parseJsonConfig(content));
      }
    } catch (error) {
      errors.push(`Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    if (providers.length === 0) {
      warnings.push('No providers found in source.');
    }

    const manifests = providers.map(configToManifest);

    return {
      success: errors.length === 0 && providers.length > 0,
      providers,
      manifests,
      warnings,
      errors,
    };
  }

  public async importFromDirectory(dirPath: string): Promise<ExternalImportResult> {
    const warnings: string[] = [];
    const errors: string[] = [];
    const allProviders: ExternalProviderConfig[] = [];

    try {
      const files = ['providers.json', 'providers.env', '.env', 'config.json'];

      for (const file of files) {
        const filePath = join(dirPath, file);
        if (existsSync(filePath)) {
          const result = await this.import({ source: filePath, projectRoot: dirPath });
          allProviders.push(...result.providers);
          warnings.push(...result.warnings);
          errors.push(...result.errors);
        }
      }
    } catch (error) {
      errors.push(`Directory scan error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const manifests = allProviders.map(configToManifest);

    return {
      success: errors.length === 0 && allProviders.length > 0,
      providers: allProviders,
      manifests,
      warnings,
      errors,
    };
  }
}
