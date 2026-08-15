import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../logger.js';
import { asErrorLike } from '../../utils/errorLike';
import { defaultRoleLibrary, normalizeKey } from './SwarmV2Planner.js';
import type {
  RawRoleLibraryEntry,
  SwarmV2RoleLibraryEntry,
} from './SwarmV2Types.js';

export function resolveRoleLibraryPath(roleLibraryPath?: string | null): string {
  return roleLibraryPath || path.resolve(process.cwd(), 'data', 'runtime', 'swarm-role-library.json');
}

export function normalizeRoleLibraryEntry(raw: unknown): SwarmV2RoleLibraryEntry | null {
  const entry = raw as RawRoleLibraryEntry | undefined | null;
  const id = normalizeKey(entry?.id, '');
  const systemPrompt = String(entry?.systemPrompt || '').trim();
  if (!id || !systemPrompt) {
    return null;
  }
  const now = new Date().toISOString();
  return {
    id,
    label: String(entry?.label || id).trim(),
    kind: ['planner', 'researcher', 'implementer', 'verifier', 'critic', 'synthesizer', 'operator', 'custom'].includes(String(entry?.kind || ''))
      ? (entry?.kind as SwarmV2RoleLibraryEntry['kind'])
      : 'custom',
    systemPrompt,
    defaultTools: Array.isArray(entry?.defaultTools) ? entry.defaultTools.map(String) : [],
    risk: ['safe', 'attention', 'danger', 'unknown'].includes(String(entry?.risk || ''))
      ? (entry?.risk as SwarmV2RoleLibraryEntry['risk'])
      : 'unknown',
    scope: ['read_only', 'tool_limited', 'workspace_patch'].includes(String(entry?.scope || ''))
      ? (entry?.scope as SwarmV2RoleLibraryEntry['scope'])
      : 'tool_limited',
    tags: Array.isArray(entry?.tags) ? entry.tags.map(String) : [],
    createdAt: String(entry?.createdAt || now),
    updatedAt: String(entry?.updatedAt || now),
  };
}

export function writeRoleLibrary(filePath: string, entries: SwarmV2RoleLibraryEntry[]): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(entries, null, 2), 'utf8');
}

export function readRoleLibrary(roleLibraryPath?: string | null): SwarmV2RoleLibraryEntry[] {
  const filePath = resolveRoleLibraryPath(roleLibraryPath);
  if (!fs.existsSync(filePath)) {
    const seeded = defaultRoleLibrary();
    writeRoleLibrary(filePath, seeded);
    return seeded;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (Array.isArray(parsed)) {
      return parsed.map((entry) => normalizeRoleLibraryEntry(entry)).filter(Boolean) as SwarmV2RoleLibraryEntry[];
    }
  } catch (error: unknown) {
    // fall through to defaults
    logger.warn('[Swarm V2] JSON parse failed', error);
  }
  const seeded = defaultRoleLibrary();
  writeRoleLibrary(filePath, seeded);
  return seeded;
}
