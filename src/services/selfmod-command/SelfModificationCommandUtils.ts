import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { DiffManager } from '../../execution/DiffManager.js';
import { logger } from '../../logger.js';
import {
ALLOWED_EXTENSIONS,
  ALLOWED_TOP_LEVEL_DIRS,
  type SelfmodResourceImpact,
} from './SelfModificationCommandTypes.js';

export function hashSelfModificationContent(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

export function toSelfModificationRelativePath(projectRoot: string, targetPath: string): string {
  const absolute = path.isAbsolute(targetPath)
    ? targetPath
    : path.resolve(projectRoot, targetPath);
  return path.relative(projectRoot, absolute).replace(/\\/g, '/');
}

export function tryGenerateSelfModificationDiff(
  oldContent: string,
  newContent: string,
  fileName: string,
): string | undefined {
  try {
    return DiffManager.generateDiff(oldContent, newContent, fileName);
  } catch (error: any) { logger.warn('[Self Modification Command Utils] creation failed', error); return undefined; }
}

export function formatSelfModificationResourceImpact(resourceImpact: SelfmodResourceImpact): string {
  const base =
    `${resourceImpact.ramIdleMb} MB RAM | ` +
    `${resourceImpact.diskMb} MB disco | ` +
    `${resourceImpact.processCount} proc`;
  return resourceImpact.notes ? `${base} (${resourceImpact.notes})` : base;
}

export function tryParseSelfModificationJson(rawValue: string): Record<string, any> | null {
  const normalized = String(rawValue || '').trim();
  if (!normalized) {
    return null;
  }

  try {
    return JSON.parse(normalized) as Record<string, any>;
  } catch (error: any) {
    const fencedMatch = normalized.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (!fencedMatch) {
      return null;
    }

    try {
      return JSON.parse(String(fencedMatch[1] || '').trim()) as Record<string, any>;
    } catch (error: any) { logger.warn('[Self Modification Command Utils] JSON parse failed', error); return null; }
  }
}

export function extractSelfModificationPathFromGoal(goal: string): string | null {
  const match = String(goal || '').match(/\b(?:src|tests|config|scripts)\/[A-Za-z0-9._/\-]+\b/);
  return match ? match[0].replace(/\\/g, '/') : null;
}

export function validateSelfModificationTarget(rawFilePath: string): { allowed: boolean; reason: string } {
  const input = String(rawFilePath || '').trim();
  if (!input) {
    return { allowed: false, reason: 'Informe o arquivo relativo alvo.' };
  }

  if (path.isAbsolute(input)) {
    return {
      allowed: false,
      reason: 'Path bloqueado. Use apenas arquivos relativos dentro da raiz do Zavorth.',
    };
  }

  const normalized = input.replace(/\\/g, '/');
  const topLevel = normalized.split('/')[0];
  if (!ALLOWED_TOP_LEVEL_DIRS.has(topLevel)) {
    return {
      allowed: false,
      reason: 'Path bloqueado. Use apenas arquivos relativos em src/, tests/, config/ ou scripts/.',
    };
  }

  const extension = path.extname(normalized).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return {
      allowed: false,
      reason: `Extensao nao suportada para /selfmod: ${extension || '[sem extensao]'}.`,
    };
  }

  return { allowed: true, reason: 'ok' };
}

export function findSelfModificationProjectRoot(startDir = process.cwd()): string {
  let dir = startDir;
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return startDir;
}
