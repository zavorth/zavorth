import fs from 'fs';
import { config } from '../../config/index.js';
import { logger } from '../../logger.js';
import type {
DiscordBridgeRuntimeStatus,
  PlannedChannelRuntimeStatus,
  SlackRuntimeStatus,
  WhatsAppRuntimeStatus,
} from './PlatformCapabilityTypes.js';

export function readDiscordBridgeRuntimeStatus(): DiscordBridgeRuntimeStatus | null {
  try {
    if (!fs.existsSync(config.discordBridgeStatusFile)) {
      return null;
    }

    const parsed = JSON.parse(fs.readFileSync(config.discordBridgeStatusFile, 'utf8')) as Record<string, unknown>;
    const mode =
      parsed.mode === 'native' || parsed.mode === 'bridge'
        ? parsed.mode
        : Boolean(config.discordBotToken)
          ? 'native'
          : config.discordBridgeEnabled
            ? 'bridge'
            : 'unknown';
    const expectedMode = Boolean(config.discordBotToken) ? 'native' : config.discordBridgeEnabled ? 'bridge' : mode;
    const modeMismatch = expectedMode !== 'unknown' && mode !== expectedMode;
    return {
      mode: expectedMode,
      enabled: parsed.enabled === true,
      started: !modeMismatch && parsed.started === true,
      lastError: modeMismatch
        ? `Discord status snapshot belongs to ${mode} mode, but ${expectedMode} mode is configured.`
        : typeof parsed.lastError === 'string'
          ? parsed.lastError
          : null,
    };
  } catch (error: unknown) {logger.warn('[Platform Capability Runtime Readers] parsing failed', error); return null; }
}

export function readWhatsAppRuntimeStatus(): WhatsAppRuntimeStatus | null {
  try {
    if (!fs.existsSync(config.whatsappStatusFile)) {
      return null;
    }

    const parsed = JSON.parse(fs.readFileSync(config.whatsappStatusFile, 'utf8')) as Record<string, unknown>;
    return {
      mode:
        parsed.mode === 'stub' || parsed.mode === 'cloud-api' || parsed.mode === 'baileys'
          ? parsed.mode
          : 'unknown',
      enabled: parsed.enabled === true,
      started: parsed.started === true,
      recipientsConfigured:
        typeof parsed.recipientsConfigured === 'number'
          ? parsed.recipientsConfigured
          : parseInt(String(parsed.recipientsConfigured || '0'), 10) || 0,
      provider:
        parsed.provider === 'cloud-api' || parsed.provider === 'baileys' || parsed.provider === 'stub'
          ? parsed.provider
          : 'unknown',
      providerConfigured: parsed.providerConfigured === true,
      providerDecision: typeof parsed.providerDecision === 'string' ? parsed.providerDecision : null,
      webhookConfigured: parsed.webhookConfigured === true,
      sessionDirConfigured: parsed.sessionDirConfigured === true,
      lastError: typeof parsed.lastError === 'string' ? parsed.lastError : null,
    };
  } catch (error: unknown) {logger.warn('[Platform Capability Runtime Readers] parsing failed', error); return null; }
}

export function readSlackRuntimeStatus(): SlackRuntimeStatus | null {
  try {
    if (!fs.existsSync(config.slackStatusFile)) {
      return null;
    }

    const parsed = JSON.parse(fs.readFileSync(config.slackStatusFile, 'utf8')) as Record<string, unknown>;
    return {
      mode: parsed.mode === 'native' || parsed.mode === 'stub' ? parsed.mode : 'unknown',
      enabled: parsed.enabled === true,
      started: parsed.started === true,
      recipientsConfigured:
        typeof parsed.recipientsConfigured === 'number'
          ? parsed.recipientsConfigured
          : parseInt(String(parsed.recipientsConfigured || '0'), 10) || 0,
      transport:
        parsed.transport === 'native' || parsed.transport === 'local' || parsed.transport === 'stub'
          ? parsed.transport
          : 'unknown',
      nativeConfigured: parsed.nativeConfigured === true,
      apiBaseUrl: typeof parsed.apiBaseUrl === 'string' ? parsed.apiBaseUrl : null,
      workspaceConfigured: parsed.workspaceConfigured === true,
      lastError: typeof parsed.lastError === 'string' ? parsed.lastError : null,
    };
  } catch (error: unknown) {logger.warn('[Platform Capability Runtime Readers] parsing failed', error); return null; }
}

export function readPlannedChannelRuntimeStatus(filePath: string): PlannedChannelRuntimeStatus | null {
  try {
    const normalizedPath = String(filePath || '').trim();
    if (!normalizedPath || !fs.existsSync(normalizedPath)) {
      return null;
    }

    const parsed = JSON.parse(fs.readFileSync(normalizedPath, 'utf8')) as Record<string, unknown>;
    return {
      enabled: parsed.enabled === true,
      started: parsed.started === true,
      recipientsConfigured:
        typeof parsed.recipientsConfigured === 'number'
          ? parsed.recipientsConfigured
          : parseInt(String(parsed.recipientsConfigured || '0'), 10) || 0,
      mode: typeof parsed.mode === 'string' ? parsed.mode : 'unknown',
      transport:
        parsed.transport === 'native'
        || parsed.transport === 'webhook'
        || parsed.transport === 'local'
        || parsed.transport === 'stub'
        || parsed.transport === 'bridge'
        || parsed.transport === 'virtual'
        || parsed.transport === 'planned'
          ? parsed.transport
          : 'unknown',
      providerConfigured: parsed.providerConfigured === true,
      platform: typeof parsed.platform === 'string' ? parsed.platform : null,
      lastError: typeof parsed.lastError === 'string' ? parsed.lastError : null,
    };
  } catch (error: unknown) {logger.warn('[Platform Capability Runtime Readers] parsing failed', error); return null; }
}

export function envValue(key: string): string {
  return String(process.env[key] || '').trim();
}

export function envList(key: string): string[] {
  return envValue(key)
    .split(/[,\n;]/g)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function envBoolean(key: string, fallback = false): boolean {
  const normalized = envValue(key).toLowerCase();
  if (!normalized) {
    return fallback;
  }
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}
