import fs from 'fs';
import path from 'path';
import { asErrorLike } from '../utils/errorLike.js';

export type ZavorthProfile = 'core' | 'ops' | 'full';
export type ZavorthProductMode = 'chat' | 'assistant' | 'builder' | 'operator';

export const WINDOWS_HOME_FALLBACK = `${process.env.HOMEDRIVE || 'C:'}${process.env.HOMEPATH || '\\Users\\Public'}`;
export const USERPROFILE_FALLBACK = (process.env.USERPROFILE as string) || WINDOWS_HOME_FALLBACK;
export const LOCALAPPDATA_FALLBACK =
  (process.env.LOCALAPPDATA as string) || path.join(USERPROFILE_FALLBACK, 'AppData', 'Local');
export const APPDATA_FALLBACK =
  (process.env.APPDATA as string) || path.join(USERPROFILE_FALLBACK, 'AppData', 'Roaming');

export function parseList(rawValue: string, delimiters: RegExp = /[,;\n]/): string[] {
  return String(rawValue || '')
    .split(delimiters)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function normalizeUrl(rawValue: string): string {
  return String(rawValue || '').trim().replace(/\/+$/, '');
}

export function parseStringMap(rawValue: string): Record<string, string> {
  const normalized = String(rawValue || '').trim();
  if (!normalized) {
    return {};
  }

  try {
    const parsed = JSON.parse(normalized);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    const entries = Object.entries(parsed).filter(([key, value]) => key && value !== undefined && value !== null);
    return Object.fromEntries(entries.map(([key, value]) => [String(key), String(value)]));
  } catch (error: unknown) {
    const err = asErrorLike(error);
    console.warn(
      `[config] Ignorando mapa JSON invalido no .env: ${error instanceof Error ? err.message : String(error)}`,
    );
    return {};
  }
}

export function readZavorthEnv(canonicalKey: string, fallbackValue = ''): string {
  return String(process.env[canonicalKey] || '').trim() || fallbackValue;
}

export function normalizeBearerToken(rawValue: string): string {
  const normalized = String(rawValue || '').trim();
  if (!normalized) {
    return '';
  }

  return /^bearer\s+/i.test(normalized) ? normalized : `Bearer ${normalized}`;
}

export function readJsonStringField(filePath: string, fieldNames: string[]): string {
  const normalizedPath = String(filePath || '').trim();
  if (!normalizedPath || !fs.existsSync(normalizedPath)) {
    return '';
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(normalizedPath, 'utf8')) as Record<string, unknown>;
    for (const fieldName of fieldNames) {
      const value = String(parsed?.[fieldName] || '').trim();
      if (value) {
        return value;
      }
    }
  } catch (error: unknown) {return '';
  }

  return '';
}

export function buildCloudflareAiGatewayBaseUrl(
  explicitBaseUrl: string,
  accountId: string,
  gatewayId: string,
): string {
  const normalizedExplicit = normalizeUrl(explicitBaseUrl);
  if (normalizedExplicit) {
    return normalizedExplicit;
  }

  const normalizedAccountId = String(accountId || '').trim();
  const normalizedGatewayId = String(gatewayId || '').trim();
  if (!normalizedAccountId || !normalizedGatewayId) {
    return '';
  }

  return `https://gateway.ai.cloudflare.com/v1/${normalizedAccountId}/${normalizedGatewayId}/google-ai-studio`;
}

export function parseTelegramUserRoles(rawValue: string, allowedUserIds: string[]): Record<string, string[]> {
  const assignments: Record<string, string[]> = {};

  for (const userId of allowedUserIds) {
    assignments[userId] = ['admin'];
  }

  for (const chunk of (rawValue || '').split(';')) {
    const entry = chunk.trim();
    if (!entry) {
      continue;
    }

    const [userIdPart, rolesPart] = entry.split(':');
    const userId = (userIdPart || '').trim();
    if (!userId) {
      continue;
    }

    const roles = (rolesPart || '')
      .split('|')
      .map((role) => role.trim().toLowerCase())
      .filter(Boolean);

    assignments[userId] = roles.length > 0 ? Array.from(new Set(roles)) : ['admin'];
  }

  return assignments;
}

export function resolveDefaultZavorthProfile(rawValue: string): ZavorthProfile {
  const normalized = String(rawValue || '').trim().toLowerCase();
  if (normalized === 'ops' || normalized === 'full') {
    return normalized;
  }
  return 'core';
}

export function resolveDefaultZavorthProductMode(
  rawValue: string,
  fallbackProfile: ZavorthProfile,
): ZavorthProductMode {
  const normalized = String(rawValue || '').trim().toLowerCase();
  if (normalized === 'chat' || normalized === 'assistant' || normalized === 'builder' || normalized === 'operator') {
    return normalized;
  }
  return fallbackProfile === 'ops' || fallbackProfile === 'full'
    ? 'operator'
    : 'builder';
}

export function resolveDefaultHostMemoryMb(profile: ZavorthProfile): number {
  switch (profile) {
    case 'ops':
      return 1536;
    case 'full':
      return 2048;
    case 'core':
    default:
      return 1024;
  }
}

export function findProjectRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return process.cwd();
}

export function deriveExternalExecutorAgentId(workspacePath: string): string {
  const baseName = path.basename(String(workspacePath || '').replace(/[\\/]+$/, '')).trim().toLowerCase();
  const sanitized = baseName.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return sanitized || 'main';
}
