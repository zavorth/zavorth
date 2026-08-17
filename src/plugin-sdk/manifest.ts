/**
 * Zavorth Plugin SDK - Manifest Specification.
 * Defines the standard declarative schema, permissions, capabilities, and validator for Zavorth plugins.
 * Strictly typed (Zero any) and EN-First.
 */

export type PluginPermission =
  | 'filesystem.read'
  | 'filesystem.write'
  | 'network.http'
  | 'network.websocket'
  | 'shell.exec'
  | 'audio.capture'
  | 'audio.playback'
  | 'screen.capture'
  | 'memory.read'
  | 'memory.write'
  | 'session.read';

export type PluginCapability =
  | 'tools'
  | 'llm_provider'
  | 'speech_stt'
  | 'speech_tts'
  | 'channel_adapter'
  | 'memory_adapter'
  | 'media_generation'
  | 'lifecycle_hook';

export interface PluginSettingField {
  type: 'string' | 'number' | 'boolean' | 'select' | 'secret';
  label: string;
  description?: string;
  defaultValue?: string | number | boolean;
  options?: Array<{ label: string; value: string }>;
  required?: boolean;
}

export interface PluginManifest {
  name: string;
  version: string;
  displayName?: string;
  description: string;
  author?: string;
  license?: string;
  homepage?: string;
  main: string;
  capabilities: PluginCapability[];
  permissions: PluginPermission[];
  settingsSchema?: Record<string, PluginSettingField>;
  minZavorthVersion?: string;
}

export interface ManifestValidationResult {
  valid: boolean;
  errors: string[];
  manifest?: PluginManifest;
}

export class PluginManifestValidator {
  /**
   * Validates a raw JSON object against the standard PluginManifest contract.
   */
  static validate(raw: Record<string, unknown>): ManifestValidationResult {
    const errors: string[] = [];

    if (!raw || typeof raw !== 'object') {
      return { valid: false, errors: ['Manifest must be a non-null JSON object'] };
    }

    if (typeof raw.name !== 'string' || !raw.name.trim()) {
      errors.push('Manifest "name" is required and must be a non-empty string');
    } else if (!/^[a-z0-9-_@/]+$/.test(raw.name)) {
      errors.push('Manifest "name" can only contain lowercase alphanumeric characters, dashes, and underscores');
    }

    if (typeof raw.version !== 'string' || !raw.version.trim()) {
      errors.push('Manifest "version" is required (semver format)');
    }

    if (typeof raw.description !== 'string') {
      errors.push('Manifest "description" is required and must be a string');
    }

    if (typeof raw.main !== 'string' || !raw.main.trim()) {
      errors.push('Manifest "main" entrypoint file is required (e.g. "index.js" or "dist/index.js")');
    }

    if (!Array.isArray(raw.capabilities)) {
      errors.push('Manifest "capabilities" must be an array of PluginCapability');
    }

    if (!Array.isArray(raw.permissions)) {
      errors.push('Manifest "permissions" must be an array of PluginPermission');
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    const manifest: PluginManifest = {
      name: String(raw.name).trim(),
      version: String(raw.version).trim(),
      displayName: typeof raw.displayName === 'string' ? raw.displayName : undefined,
      description: String(raw.description).trim(),
      author: typeof raw.author === 'string' ? raw.author : undefined,
      license: typeof raw.license === 'string' ? raw.license : 'MIT',
      homepage: typeof raw.homepage === 'string' ? raw.homepage : undefined,
      main: String(raw.main).trim(),
      capabilities: (raw.capabilities as PluginCapability[]) || [],
      permissions: (raw.permissions as PluginPermission[]) || [],
      settingsSchema: typeof raw.settingsSchema === 'object' && raw.settingsSchema !== null
        ? (raw.settingsSchema as Record<string, PluginSettingField>)
        : undefined,
      minZavorthVersion: typeof raw.minZavorthVersion === 'string' ? raw.minZavorthVersion : undefined,
    };

    return { valid: true, errors: [], manifest };
  }
}
