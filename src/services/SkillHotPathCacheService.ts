/**
 * Process-local hot-path caches for SkillIR normalize + tool binds + install digests.
 * Invalidated on install/import. Optional env ZAVORTH_SKILL_HOT_PATH_CACHE=0 disables.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import type { ZavorthSkillIrNormalizeResult } from '../contracts/skill/ZavorthSkillIrContract.js';
import type { SkillExecutorBindingReport } from './SkillExecutorBindingService.js';

export type SkillHotPathMetricsSnapshot = {
  irHits: number;
  irMisses: number;
  bindHits: number;
  bindMisses: number;
  digestShortCircuits: number;
  searchCalls: number;
  searchTotalMs: number;
  installPreviewCalls: number;
  installApplyCalls: number;
  cacheEnabled: boolean;
};

export type SkillHotPathCacheRuntime = {
  enabled?: boolean;
  existsSync?: typeof fs.existsSync;
  statSync?: typeof fs.statSync;
};

type IrCacheEntry = {
  mtimeMs: number;
  result: ZavorthSkillIrNormalizeResult;
};

type DigestIndexEntry = {
  skillId: string;
  skillIrDigest: string;
  targetDir: string | null;
  recordedAt: string;
};

const globalStore: {
  ir: Map<string, IrCacheEntry>;
  binds: Map<string, SkillExecutorBindingReport>;
  digests: Map<string, DigestIndexEntry>;
  metrics: SkillHotPathMetricsSnapshot;
} = {
  ir: new Map(),
  binds: new Map(),
  digests: new Map(),
  metrics: emptyMetrics(true),
};

function emptyMetrics(cacheEnabled: boolean): SkillHotPathMetricsSnapshot {
  return {
    irHits: 0,
    irMisses: 0,
    bindHits: 0,
    bindMisses: 0,
    digestShortCircuits: 0,
    searchCalls: 0,
    searchTotalMs: 0,
    installPreviewCalls: 0,
    installApplyCalls: 0,
    cacheEnabled,
  };
}

function envCacheEnabled(): boolean {
  const raw = String(process.env.ZAVORTH_SKILL_HOT_PATH_CACHE ?? '1')
    .trim()
    .toLowerCase();
  if (!raw) return true;
  return !(raw === '0' || raw === 'false' || raw === 'off' || raw === 'no');
}

/**
 * Process-local SkillIR + bind + install-digest cache.
 */
export class SkillHotPathCacheService {
  private readonly enabled: boolean;
  private readonly existsSync: typeof fs.existsSync;
  private readonly statSync: typeof fs.statSync;

  constructor(runtime: SkillHotPathCacheRuntime = {}) {
    this.enabled = runtime.enabled !== undefined ? runtime.enabled : envCacheEnabled();
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.statSync = runtime.statSync || fs.statSync.bind(fs);
    globalStore.metrics.cacheEnabled = this.enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public getMetrics(): SkillHotPathMetricsSnapshot {
    return { ...globalStore.metrics, cacheEnabled: this.enabled };
  }

  public resetMetrics(): void {
    globalStore.metrics = emptyMetrics(this.enabled);
  }

  /** Clear all process caches (tests / after bulk install). */
  public invalidateAll(): void {
    globalStore.ir.clear();
    globalStore.binds.clear();
    // Keep digests for short-circuit across invalidations of IR/bind only... Clear digests too for safety.
    globalStore.digests.clear();
  }

  public invalidateSkillDir(skillDir: string): void {
    const key = path.resolve(skillDir);
    globalStore.ir.delete(key);
    // bind keys may include skill id — clear all binds on dir invalidation (cheap)
    globalStore.binds.clear();
  }

  public recordSearchLatency(ms: number): void {
    globalStore.metrics.searchCalls += 1;
    globalStore.metrics.searchTotalMs += Math.max(0, ms);
  }

  public recordInstallPreview(): void {
    globalStore.metrics.installPreviewCalls += 1;
  }

  public recordInstallApply(): void {
    globalStore.metrics.installApplyCalls += 1;
  }

  /**
   * SkillIR normalize with mtime-based process cache.
   */
  public getOrNormalizeIr(
    skillDir: string,
    load: () => ZavorthSkillIrNormalizeResult,
  ): ZavorthSkillIrNormalizeResult & { cacheHit: boolean } {
    const key = path.resolve(skillDir);
    if (!this.enabled) {
      globalStore.metrics.irMisses += 1;
      return { ...load(), cacheHit: false };
    }
    let mtimeMs = 0;
    try {
      if (this.existsSync(key)) {
        mtimeMs = this.statSync(key).mtimeMs;
      }
    } catch {
      mtimeMs = 0;
    }
    const hit = globalStore.ir.get(key);
    if (hit && hit.mtimeMs === mtimeMs) {
      globalStore.metrics.irHits += 1;
      return { ...hit.result, cacheHit: true };
    }
    const result = load();
    globalStore.ir.set(key, { mtimeMs, result });
    globalStore.metrics.irMisses += 1;
    return { ...result, cacheHit: false };
  }

  /**
   * Tool bind report cache keyed by skillId + declared tool names + alias digest.
   */
  public getOrBind(
    cacheKey: string,
    load: () => SkillExecutorBindingReport,
  ): SkillExecutorBindingReport & { cacheHit: boolean } {
    const key = String(cacheKey || '').trim();
    if (!this.enabled || !key) {
      globalStore.metrics.bindMisses += 1;
      const report = load();
      return Object.assign(report, { cacheHit: false });
    }
    const hit = globalStore.binds.get(key);
    if (hit) {
      globalStore.metrics.bindHits += 1;
      return Object.assign(hit, { cacheHit: true as const });
    }
    const report = load();
    globalStore.binds.set(key, report);
    globalStore.metrics.bindMisses += 1;
    return Object.assign(report, { cacheHit: false as const });
  }

  public static buildBindCacheKey(input: {
    skillId?: string | null;
    declaredTools: string[];
    aliasVersion?: string;
  }): string {
    const tools = [...input.declaredTools]
      .map((t) => t.toLowerCase())
      .sort()
      .join('|');
    const payload = `${input.skillId || ''}|${tools}|${input.aliasVersion || 'v1'}`;
    return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 32);
  }

  /** Record install digest for short-circuit on re-apply of same content. */
  public recordInstallDigest(input: { skillId: string; skillIrDigest: string; targetDir?: string | null }): void {
    const skillId = String(input.skillId || '').trim();
    const digest = String(input.skillIrDigest || '')
      .trim()
      .toLowerCase();
    if (!skillId || !digest) return;
    const entry: DigestIndexEntry = {
      skillId,
      skillIrDigest: digest,
      targetDir: input.targetDir || null,
      recordedAt: new Date().toISOString(),
    };
    globalStore.digests.set(digest, entry);
    globalStore.digests.set(`id:${skillId}`, entry);
  }

  /**
   * If digest already installed, return existing target (skip re-fetch/clone).
   */
  public findByDigest(skillIrDigest: string | null | undefined): DigestIndexEntry | null {
    const digest = String(skillIrDigest || '')
      .trim()
      .toLowerCase();
    if (!digest) return null;
    return globalStore.digests.get(digest) || null;
  }

  public markDigestShortCircuit(): void {
    globalStore.metrics.digestShortCircuits += 1;
  }

  /** Load digests from existing skill.ir.json under skills/ (optional warm-up). */
  public warmFromSkillsDir(skillsDir: string): number {
    if (!this.enabled || !this.existsSync(skillsDir)) return 0;
    let count = 0;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(skillsDir, { withFileTypes: true });
    } catch {
      return 0;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dir = path.join(skillsDir, entry.name);
      const irPath = path.join(dir, 'skill.ir.json');
      if (!this.existsSync(irPath)) continue;
      try {
        const raw = JSON.parse(fs.readFileSync(irPath, 'utf8')) as {
          skillIrDigest?: string;
          skillIr?: { id?: string };
        };
        const digest = String(raw.skillIrDigest || '').trim();
        const skillId = String(raw.skillIr?.id || entry.name).trim();
        if (digest && skillId) {
          this.recordInstallDigest({ skillId, skillIrDigest: digest, targetDir: dir });
          count += 1;
        }
      } catch {
        /* skip */
      }
    }
    return count;
  }
}

/** Shared process singleton for hot path. */
let shared: SkillHotPathCacheService | null = null;

export function getSkillHotPathCache(): SkillHotPathCacheService {
  if (!shared) shared = new SkillHotPathCacheService();
  return shared;
}

/** Test helper: reset singleton + global maps. */
export function resetSkillHotPathCacheForTests(runtime?: SkillHotPathCacheRuntime): SkillHotPathCacheService {
  globalStore.ir.clear();
  globalStore.binds.clear();
  globalStore.digests.clear();
  globalStore.metrics = emptyMetrics(runtime?.enabled !== false);
  shared = new SkillHotPathCacheService(runtime);
  return shared;
}
