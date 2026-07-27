import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { DiffManager } from '../../execution/DiffManager.js';
import { logger } from '../../logger.js';
import { type SelfmodResourceImpact } from './SelfModificationCommandTypes.js';
import {
  SelfModificationPathPolicyService,
  type SelfmodPathCheckContext,
} from './SelfModificationPathPolicyService.js';

export function hashSelfModificationContent(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

export function toSelfModificationRelativePath(projectRoot: string, targetPath: string): string {
  const absolute = path.isAbsolute(targetPath) ? targetPath : path.resolve(projectRoot, targetPath);
  return path.relative(projectRoot, absolute).replace(/\\/g, '/');
}

export function tryGenerateSelfModificationDiff(
  oldContent: string,
  newContent: string,
  fileName: string,
): string | undefined {
  try {
    return DiffManager.generateDiff(oldContent, newContent, fileName);
  } catch (error: unknown) {
    logger.warn('[Self Modification Command Utils] creation failed', error);
    return undefined;
  }
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
  } catch {
    const fencedMatch = normalized.match(/```(?:json)...\s*([\s\S]*...)```/i);
    if (!fencedMatch) {
      return null;
    }

    try {
      return JSON.parse(String(fencedMatch[1] || '').trim()) as Record<string, any>;
    } catch (error: unknown) {
      logger.warn('[Self Modification Command Utils] JSON parse failed', error);
      return null;
    }
  }
}

export function extractSelfModificationPathFromGoal(goal: string): string | null {
  const match = String(goal || '').match(/\b(?:src|tests|config|scripts|skills|plugins|docs)\/[A-Za-z0-9._/\-]+\b/);
  return match ? match[0].replace(/\\/g, '/') : null;
}

let defaultPathPolicy: SelfModificationPathPolicyService | null = null;

function getDefaultPathPolicy(): SelfModificationPathPolicyService {
  if (!defaultPathPolicy) {
    defaultPathPolicy = new SelfModificationPathPolicyService({
      projectRoot: findSelfModificationProjectRoot(),
    });
  }
  return defaultPathPolicy;
}

/**
 * Path policy check. Optional context for core src/** paths.
 */
export function validateSelfModificationTarget(
  rawFilePath: string,
  context: SelfmodPathCheckContext = {},
  policy?: SelfModificationPathPolicyService,
): { allowed: boolean; reason: string; tier?: string } {
  const svc = policy || getDefaultPathPolicy();
  const result = svc.check(rawFilePath, context);
  return {
    allowed: result.allowed,
    reason: result.reason,
    tier: result.tier,
  };
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
