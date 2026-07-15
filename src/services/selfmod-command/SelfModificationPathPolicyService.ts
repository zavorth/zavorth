/**
 * Path policy for self-modification.
 * Loads config/selfmod-path-policy.json — skills/plugins/docs/config standard;
 * src/** requires BUILD + owner/trusted.
 */

import fs from 'node:fs';
import path from 'node:path';

export type SelfmodPathTier = 'standard' | 'core' | 'blocked';

export type SelfmodPathRule = {
  id?: string;
  pattern: string;
  tier: SelfmodPathTier | string;
  requiresBuildMode?: boolean;
  requiresOwnerOrTrusted?: boolean;
  description?: string;
};

export type SelfmodPathPolicyFile = {
  schemaVersion?: string;
  allowedExtensions?: string[];
  rules?: SelfmodPathRule[];
  blocked?: string[];
  validationCommands?: string[];
  requireValidationCommandsOnApply?: boolean;
  skipDeepBuildValidationForTiers?: string[];
  promoteHintOnApply?: boolean;
};

export type SelfmodPathCheckContext = {
  /** BUILD mode active (core paths). */
  buildMode?: boolean;
  /** Owner or trusted operator. */
  ownerOrTrusted?: boolean;
};

export type SelfmodPathCheckResult = {
  allowed: boolean;
  reason: string;
  tier: SelfmodPathTier;
  ruleId: string | null;
  requiresBuildMode: boolean;
  requiresOwnerOrTrusted: boolean;
  relativePath: string;
};

const DEFAULT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.ps1',
  '.yml',
  '.yaml',
]);

const FALLBACK_RULES: SelfmodPathRule[] = [
  { id: 'skills', pattern: 'skills/**', tier: 'standard' },
  { id: 'plugins', pattern: 'plugins/**', tier: 'standard' },
  { id: 'docs', pattern: 'docs/**', tier: 'standard' },
  { id: 'config-sources', pattern: 'config/*sources*', tier: 'standard' },
  { id: 'config', pattern: 'config/**', tier: 'standard' },
  { id: 'tests', pattern: 'tests/**', tier: 'standard' },
  { id: 'scripts', pattern: 'scripts/**', tier: 'standard' },
  {
    id: 'src-core',
    pattern: 'src/**',
    tier: 'core',
    requiresBuildMode: true,
    requiresOwnerOrTrusted: true,
  },
];

const FALLBACK_BLOCKED = ['node_modules/**', '.git/**', '.env', '.env.*', 'data/secrets/**', 'dist/**'];

export class SelfModificationPathPolicyService {
  private readonly projectRoot: string;
  private readonly policyPath: string;
  private cache: SelfmodPathPolicyFile | null = null;

  constructor(options: { projectRoot?: string; policyPath?: string } = {}) {
    this.projectRoot = path.resolve(options.projectRoot || process.cwd());
    this.policyPath = options.policyPath || path.join(this.projectRoot, 'config', 'selfmod-path-policy.json');
  }

  public load(): SelfmodPathPolicyFile {
    if (this.cache) return this.cache;
    try {
      if (fs.existsSync(this.policyPath)) {
        this.cache = JSON.parse(fs.readFileSync(this.policyPath, 'utf8')) as SelfmodPathPolicyFile;
        return this.cache;
      }
    } catch {
      /* soft fallback */
    }
    this.cache = {
      schemaVersion: 'zavorth.selfmod-path-policy.v1',
      allowedExtensions: [...DEFAULT_EXTENSIONS],
      rules: FALLBACK_RULES,
      blocked: FALLBACK_BLOCKED,
      validationCommands: [],
      requireValidationCommandsOnApply: false,
      skipDeepBuildValidationForTiers: ['standard'],
      promoteHintOnApply: true,
    };
    return this.cache;
  }

  public invalidate(): void {
    this.cache = null;
  }

  public getValidationCommands(): string[] {
    const policy = this.load();
    return Array.isArray(policy.validationCommands) ? policy.validationCommands.map(String).filter(Boolean) : [];
  }

  public requireValidationOnApply(): boolean {
    return this.load().requireValidationCommandsOnApply === true;
  }

  public shouldSkipDeepBuild(tier: SelfmodPathTier): boolean {
    const skip = this.load().skipDeepBuildValidationForTiers || [];
    return skip.map(String).includes(tier);
  }

  public promoteHintEnabled(): boolean {
    return this.load().promoteHintOnApply !== false;
  }

  /**
   * Validate a relative workspace path against policy + optional auth context.
   */
  public check(rawFilePath: string, context: SelfmodPathCheckContext = {}): SelfmodPathCheckResult {
    const input = String(rawFilePath || '').trim();
    if (!input) {
      return fail('Provide a relative target file path.', 'blocked', null);
    }
    if (path.isAbsolute(input)) {
      return fail('Path blocked. Use relative paths inside the Zavorth workspace root only.', 'blocked', null);
    }

    const relativePath = input.replace(/\\/g, '/').replace(/^\.\//, '');
    if (relativePath.includes('..') || relativePath.startsWith('/')) {
      return fail('Path traversal blocked.', 'blocked', null, relativePath);
    }

    const policy = this.load();
    const blocked = policy.blocked || FALLBACK_BLOCKED;
    for (const pattern of blocked) {
      if (matchGlob(relativePath, pattern)) {
        return fail(`Path blocked by policy (${pattern}).`, 'blocked', null, relativePath);
      }
    }

    const extensions = new Set(
      (policy.allowedExtensions || [...DEFAULT_EXTENSIONS]).map((e) =>
        e.startsWith('.') ? e.toLowerCase() : `.${e.toLowerCase()}`,
      ),
    );
    const extension = path.extname(relativePath).toLowerCase();
    if (!extensions.has(extension)) {
      return fail(`Extension not allowed for selfmod: ${extension || '[none]'}.`, 'blocked', null, relativePath);
    }

    const rules = policy.rules?.length ? policy.rules : FALLBACK_RULES;
    // Prefer more specific rules: longer pattern first
    const ordered = [...rules].sort((a, b) => String(b.pattern).length - String(a.pattern).length);
    let matched: SelfmodPathRule | null = null;
    for (const rule of ordered) {
      if (matchGlob(relativePath, rule.pattern)) {
        matched = rule;
        break;
      }
    }

    if (!matched) {
      return fail(
        'Path not in selfmod allow list. Allowed: skills/, plugins/, docs/, config/, tests/, scripts/; src/ needs BUILD + owner.',
        'blocked',
        null,
        relativePath,
      );
    }

    const tier = (matched.tier === 'core' ? 'core' : 'standard') as SelfmodPathTier;
    const requiresBuildMode = matched.requiresBuildMode === true || tier === 'core';
    const requiresOwnerOrTrusted = matched.requiresOwnerOrTrusted === true || tier === 'core';

    if (requiresBuildMode && context.buildMode === false) {
      return fail(
        `Core path ${relativePath} requires BUILD mode for selfmod.`,
        'core',
        matched.id || null,
        relativePath,
        requiresBuildMode,
        requiresOwnerOrTrusted,
      );
    }
    if (requiresOwnerOrTrusted && context.ownerOrTrusted === false) {
      return fail(
        `Core path ${relativePath} requires owner or trusted operator for selfmod apply/preview.`,
        'core',
        matched.id || null,
        relativePath,
        requiresBuildMode,
        requiresOwnerOrTrusted,
      );
    }

    return {
      allowed: true,
      reason: 'ok',
      tier,
      ruleId: matched.id || null,
      requiresBuildMode,
      requiresOwnerOrTrusted,
      relativePath,
    };
  }
}

function fail(
  reason: string,
  tier: SelfmodPathTier,
  ruleId: string | null,
  relativePath = '',
  requiresBuildMode = false,
  requiresOwnerOrTrusted = false,
): SelfmodPathCheckResult {
  return {
    allowed: false,
    reason,
    tier,
    ruleId,
    requiresBuildMode,
    requiresOwnerOrTrusted,
    relativePath,
  };
}

/**
 * Minimal glob: `**` multi-segment, `*` single path segment.
 */
export function matchGlob(value: string, pattern: string): boolean {
  const v = String(value || '').replace(/\\/g, '/');
  const p = String(pattern || '').replace(/\\/g, '/');
  if (!p) return false;
  if (p === v) return true;
  const escaped = p
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '<<<DS>>>')
    .replace(/\*/g, '[^/]*')
    .replace(/<<<DS>>>/g, '.*');
  try {
    return new RegExp(`^${escaped}$`).test(v);
  } catch {
    return false;
  }
}
