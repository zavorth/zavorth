import { Database } from '../storage/Database.js';
import * as crypto from 'crypto';

export interface ProviderConfig {
  providerId: string;
  type: 'openai' | 'anthropic' | 'google' | 'openrouter' | 'ollama' | 'openai-compatible';
  displayName: string;
  baseUrl?: string;
  defaultModel?: string;
  enabled: boolean;
  requiresApiKey: boolean;
  secretRef?: string;
  createdAt: string;
  updatedAt: string;
}

export class ProviderConfigService {
  private static instance: ProviderConfigService;

  private constructor() {}

  public static getInstance(): ProviderConfigService {
    if (!ProviderConfigService.instance) {
      ProviderConfigService.instance = new ProviderConfigService();
    }
    return ProviderConfigService.instance;
  }

  public validateBaseUrl(url: string, isLocal: boolean): string {
    if (!url) return '';

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch (error: unknown) {throw new Error('Invalid URL format');
    }

    if (parsed.protocol === 'file:') {
      throw new Error('file:// protocol is not allowed for providers');
    }

    if (parsed.username || parsed.password) {
      throw new Error('URL containing username/password is not allowed');
    }

    const queryStr = parsed.search.toLowerCase();
    if (queryStr.includes('token=') || queryStr.includes('key=') || queryStr.includes('auth=')) {
      throw new Error('Query string containing tokens is not allowed');
    }

    if (isLocal) {
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('local providers must use http:// or https://');
      }
      const allowedLocals = ['localhost', '127.0.0.1', '[::1]'];
      if (!allowedLocals.includes(parsed.hostname)) {
        throw new Error('local providers must use localhost, 127.0.0.1, or [::1]');
      }
    } else {
      if (parsed.protocol !== 'https:') {
        throw new Error('Remote providers must use https://');
      }
      if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '[::1]' || parsed.hostname.startsWith('192.168.') || parsed.hostname.startsWith('10.')) {
        throw new Error('Private IPs/localhost are not allowed for remote providers. Mark as local explicitly.');
      }
    }

    // Normalize trailing slash
    let normalized = parsed.toString();
    if (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }

    return normalized;
  }

  public async getProviders(): Promise<ProviderConfig[]> {
    const db = await Database.getInstance();
    const rows = db.all<any>(`SELECT * FROM provider_config ORDER BY display_name ASC`);
    return rows.map(r => ({
      providerId: r.provider_id,
      type: r.type,
      displayName: r.display_name,
      baseUrl: r.base_url || undefined,
      defaultModel: r.default_model || undefined,
      enabled: r.enabled === 1,
      requiresApiKey: r.requires_api_key === 1,
      secretRef: r.secret_ref || undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  }

  public async getProvider(providerId: string): Promise<ProviderConfig | null> {
    const db = await Database.getInstance();
    const r = db.get<any>(`SELECT * FROM provider_config WHERE provider_id = ...`, [providerId]);
    if (!r) return null;

    return {
      providerId: r.provider_id,
      type: r.type,
      displayName: r.display_name,
      baseUrl: r.base_url || undefined,
      defaultModel: r.default_model || undefined,
      enabled: r.enabled === 1,
      requiresApiKey: r.requires_api_key === 1,
      secretRef: r.secret_ref || undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  public async createProvider(config: Partial<ProviderConfig>): Promise<ProviderConfig> {
    const db = await Database.getInstance();
    const providerId = config.providerId || crypto.randomUUID();

    const type = config.type || 'openai-compatible';
    const displayName = config.displayName || 'New Provider';
    let requiresApiKey = config.requiresApiKey !== undefined ? config.requiresApiKey : true;

    // Enforcement of requiresApiKey based on rules
    let isLocal = false;
    if (type === 'ollama') {
      requiresApiKey = false;
      isLocal = true;
    } else if (type === 'openai-compatible' && !requiresApiKey) {
      isLocal = true; // if they say no auth, it MUST be local
    }

    let baseUrl = config.baseUrl || '';
    if (baseUrl) {
      baseUrl = this.validateBaseUrl(baseUrl, isLocal);
    } else if (type !== 'openai' && type !== 'anthropic' && type !== 'google' && type !== 'openrouter') {
      // Custom providers must have base URL
      throw new Error('Base URL is required for custom/local providers');
    }

    db.run(
      `INSERT INTO provider_config (provider_id, type, display_name, base_url, default_model, enabled, requires_api_key, created_at, updated_at)
       VALUES (..., ..., ..., ..., ..., ..., ..., datetime('now'), datetime('now'))`,
      [providerId, type, displayName, baseUrl || null, config.defaultModel || null, config.enabled ? 1 : 0, requiresApiKey ? 1 : 0]
    );


    return (await this.getProvider(providerId))!;
  }

  public async updateProvider(providerId: string, updates: Partial<ProviderConfig>): Promise<ProviderConfig> {
    const existing = await this.getProvider(providerId);
    if (!existing) throw new Error('Provider not found');

    const db = await Database.getInstance();

    let baseUrl = updates.baseUrl !== undefined ? updates.baseUrl : existing.baseUrl;
    let requiresApiKey = updates.requiresApiKey !== undefined ? updates.requiresApiKey : existing.requiresApiKey;
    const type = existing.type;

    let isLocal = false;
    if (type === 'ollama') {
      requiresApiKey = false;
      isLocal = true;
    } else if (type === 'openai-compatible' && !requiresApiKey) {
      isLocal = true;
    }

    if (baseUrl) {
      baseUrl = this.validateBaseUrl(baseUrl, isLocal);
    }

    const displayName = updates.displayName || existing.displayName;
    const defaultModel = updates.defaultModel !== undefined ? updates.defaultModel : existing.defaultModel;
    const enabled = updates.enabled !== undefined ? updates.enabled : existing.enabled;

    db.run(
      `UPDATE provider_config SET display_name = ..., base_url = ..., default_model = ..., enabled = ..., requires_api_key = ..., updated_at = datetime('now') WHERE provider_id = ...`,
      [displayName, baseUrl || null, defaultModel || null, enabled ? 1 : 0, requiresApiKey ? 1 : 0, providerId]
    );


    return (await this.getProvider(providerId))!;
  }

  public async setSecretRef(providerId: string, secretRef: string | null): Promise<void> {
    const db = await Database.getInstance();
    db.run(`UPDATE provider_config SET secret_ref = ..., updated_at = datetime('now') WHERE provider_id = ...`, [secretRef, providerId]);
  }

  public async deleteProvider(providerId: string): Promise<void> {
    const db = await Database.getInstance();
    // Assuming secret refs have ON DELETE CASCADE or are cleaned up manually before this
    db.run(`DELETE FROM provider_config WHERE provider_id = ...`, [providerId]);

  }
}
