import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { logger } from '../logger.js';
import type {
TrustedWorkspacePolicy,
  TrustedWorkspaceState,
} from '../contracts/ExecutionEngineContract';

export type TrustedWorkspaceEvaluation = {
  state: TrustedWorkspaceState;
  policy: TrustedWorkspacePolicy | null;
  path: string | null;
  allowedForVelocity: boolean;
  reason: string;
};

export type TrustedWorkspaceWriteRisk = {
  allowed: boolean;
  reason: string;
};

export type TrustedWorkspacePolicyValidation = {
  ok: boolean;
  path: string;
  reason: string | null;
};

const SENSITIVE_PATH_PATTERN = /(^|[\\/])(\.env(?:\.|$)|\.ssh|\.aws|\.gnupg|secrets...|credentials...|private[-_]...key|id_rsa|id_ed25519)([\\/]|$)/i;
const DESTRUCTIVE_PATTERN = /\b(rm\s+-rf|del\s+\/s|remove-item\s+.*-recurse|format\s+[a-z]:|git\s+reset\s+--hard|git\s+clean\s+-fd)\b/i;
const BROAD_WINDOWS_ROOT_PATTERN = /^[a-z]:[\\/]...$/i;
const SYSTEM_PATH_PATTERN = /(^[a-z]:[\\/](windows|program files|program files \(x86\)|programdata)([\\/]|$)|^[\\/]...(etc|bin|usr|var|root)([\\/]|$))/i;

function normalizePath(input: string): string {
  return path.resolve(input.trim());
}

function isUnder(parent: string, child: string): boolean {
  const parentResolved = normalizePath(parent).toLowerCase();
  const childResolved = normalizePath(child).toLowerCase();
  const relative = path.relative(parentResolved, childResolved);
  return relative === '' || (!!relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

function stateRank(state: TrustedWorkspaceState): number {
  if (state === 'sensitive') return 3;
  if (state === 'trusted') return 2;
  return 1;
}

export class TrustedWorkspacePolicyService {
  private readonly policies: TrustedWorkspacePolicy[] = [];

  public list(): TrustedWorkspacePolicy[] {
    return this.policies.slice();
  }

  public add(input: {
    path: string;
    label?: string;
    state?: TrustedWorkspaceState;
  }): TrustedWorkspacePolicy {
    const validation = this.validatePolicyInput(input.path);
    if (!validation.ok) {
      throw new Error(validation.reason || 'Trusted workspace path is not allowed.');
    }
    const normalized = normalizePath(input.path);
    const now = new Date().toISOString();
    const existing = this.policies.find((policy) => policy.path.toLowerCase() === normalized.toLowerCase());
    if (existing) {
      existing.label = input.label?.trim() || existing.label;
      existing.state = input.state ?? existing.state;
      existing.updatedAt = now;
      return existing;
    }

    const policy: TrustedWorkspacePolicy = {
      id: `tw:${randomUUID()}`,
      path: normalized,
      label: input.label?.trim() || path.basename(normalized) || normalized,
      state: input.state ?? 'trusted',
      createdAt: now,
      updatedAt: now,
    };
    this.policies.push(policy);
    return policy;
  }

  public validatePolicyInput(inputPath: string): TrustedWorkspacePolicyValidation {
    const normalized = normalizePath(inputPath);
    const root = path.parse(normalized).root;
    if (!inputPath.trim()) {
      return { ok: false, path: normalized, reason: 'A trusted workspace path is required.' };
    }
    if (normalized === root || BROAD_WINDOWS_ROOT_PATTERN.test(normalized)) {
      return { ok: false, path: normalized, reason: 'Filesystem roots cannot be trusted workspaces.' };
    }
    if (normalized.toLowerCase() === path.resolve(os.homedir()).toLowerCase()) {
      return { ok: false, path: normalized, reason: 'The whole user home folder is too broad for Velocity.' };
    }
    if (SYSTEM_PATH_PATTERN.test(normalized)) {
      return { ok: false, path: normalized, reason: 'System folders cannot be trusted workspaces.' };
    }
    if (SENSITIVE_PATH_PATTERN.test(normalized)) {
      return { ok: false, path: normalized, reason: 'Sensitive folders cannot be trusted workspaces.' };
    }
    try {
      const stat = fs.statSync(normalized);
      if (!stat.isDirectory()) {
        return { ok: false, path: normalized, reason: 'Trusted workspace path must be an existing directory.' };
      }
    } catch (error: unknown) {logger.warn('[Trusted Workspace] filesystem operation failed', error);
    return { ok: false, path: normalized, reason: 'Trusted workspace path must exist before it can be trusted.' };
  }
    return { ok: true, path: normalized, reason: null };
  }

  public remove(id: string): boolean {
    const index = this.policies.findIndex((policy) => policy.id === id);
    if (index < 0) return false;
    this.policies.splice(index, 1);
    return true;
  }

  public evaluate(targetPath?: string | null): TrustedWorkspaceEvaluation {
    if (!targetPath || !targetPath.trim()) {
      return {
        state: 'untrusted',
        policy: null,
        path: null,
        allowedForVelocity: false,
        reason: 'No target path was provided.',
      };
    }

    const normalized = normalizePath(targetPath);
    const matching = this.policies
      .filter((policy) => isUnder(policy.path, normalized))
      .sort((a, b) => stateRank(b.state) - stateRank(a.state) || b.path.length - a.path.length)[0] ?? null;

    if (SENSITIVE_PATH_PATTERN.test(normalized)) {
      return {
        state: 'sensitive',
        policy: matching,
        path: normalized,
        allowedForVelocity: false,
        reason: 'Sensitive files require Shield, even inside a trusted workspace.',
      };
    }

    if (!matching) {
      return {
        state: 'untrusted',
        policy: null,
        path: normalized,
        allowedForVelocity: false,
        reason: 'Path is outside trusted workspaces.',
      };
    }

    return {
      state: matching.state,
      policy: matching,
      path: normalized,
      allowedForVelocity: matching.state === 'trusted',
      reason: matching.state === 'trusted'
        ? 'Path is inside a trusted workspace.'
        : 'Path is marked sensitive and requires Shield.',
    };
  }

  public assertVelocityWrite(input: {
    targetPath?: string | null;
    command?: string | null;
    operation?: string | null;
    content?: string | null;
  }): TrustedWorkspaceWriteRisk {
    const evaluation = this.evaluate(input.targetPath);
    if (!evaluation.allowedForVelocity) {
      return { allowed: false, reason: evaluation.reason };
    }
    const command = input.command || '';
    if (DESTRUCTIVE_PATTERN.test(command) || input.operation === 'delete') {
      return {
        allowed: false,
        reason: 'Destructive operations require Shield approval.',
      };
    }
    const content = input.content || '';
    if (/(api[_-]...key|token|secret|private key|password)\s*[:=]/i.test(content)) {
      return {
        allowed: false,
        reason: 'Potential secret material requires Shield review.',
      };
    }
    return {
      allowed: true,
      reason: 'Simple write is allowed in this trusted workspace.',
    };
  }
}
