/**
 * Migration UX — thin presentation layer over UniversalWorkspaceImportService.
 * Structural / brand-agnostic only.
 */

import fs from 'fs';
import path from 'path';
import { logger } from '../../logger.js';
import {
  UniversalWorkspaceImportService,
  type UniversalWorkspaceImportInput,
} from '../UniversalWorkspaceImportService.js';
import type {
  UniversalWorkspaceImportSnapshot,
  UniversalWorkspaceProfileId,
} from '../../contracts/UniversalCapabilityFabricContract.js';

export interface AgentDetection {
  name: string;
  path: string;
  /** Structural profile id — never a third-party product name. */
  type: UniversalWorkspaceProfileId;
  configFiles: string[];
  skills: number;
  providers: number;
  confidence: number;
}

export interface MigrationPlan {
  source: AgentDetection;
  items: MigrationItem[];
  warnings: string[];
  estimatedTime: string;
  snapshot: UniversalWorkspaceImportSnapshot;
}

export interface MigrationItem {
  type: 'config' | 'skill' | 'provider' | 'memory' | 'preference' | 'identity' | 'plugin' | 'unknown';
  name: string;
  sourcePath: string;
  targetPath: string;
  status: 'pending' | 'migrating' | 'done' | 'skipped' | 'error';
  reason?: string;
}

const PROFILE_ALIASES: Record<string, UniversalWorkspaceProfileId | 'auto'> = {
  auto: 'auto' as 'auto',
  generic: 'mixed-agent-home',
  mixed: 'mixed-agent-home',
  'mixed-agent-home': 'mixed-agent-home',
  identity: 'identity-markdown-home',
  'identity-markdown-home': 'identity-markdown-home',
  skills: 'skill-centric-home',
  'skill-centric-home': 'skill-centric-home',
  memory: 'memory-centric-home',
  'memory-centric-home': 'memory-centric-home',
  config: 'config-centric-home',
  'config-centric-home': 'config-centric-home',
  plugins: 'plugin-centric-home',
  'plugin-centric-home': 'plugin-centric-home',
  opaque: 'opaque-or-empty',
  'opaque-or-empty': 'opaque-or-empty',
  // legacy structural aliases kept for CLI compatibility (not product brands)
  'legacy-python': 'mixed-agent-home',
  'legacy-typescript': 'mixed-agent-home',
  community: 'mixed-agent-home',
  'community-agent': 'mixed-agent-home',
  workspace: 'mixed-agent-home',
};

export class MigrationUXService {
  private readonly storageDir: string;
  private readonly importer: UniversalWorkspaceImportService;

  constructor(options?: { storageDir?: string; projectRoot?: string }) {
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'migration-ux');
    if (!fs.existsSync(this.storageDir)) fs.mkdirSync(this.storageDir, { recursive: true });
    this.importer = new UniversalWorkspaceImportService({
      projectRoot: options?.projectRoot || process.cwd(),
    });
  }

  public detectAgent(sourcePath: string): AgentDetection | null {
    const detected = this.importer.detect(sourcePath);
    if (!detected) return null;

    const skillsDir = this.findSkillsDirectory(detected.path);
    const skills = skillsDir
      ? fs.readdirSync(skillsDir).filter((f) => {
        try {
          return fs.statSync(path.join(skillsDir, f)).isDirectory();
        } catch {
          return false;
        }
      }).length
      : 0;

    return {
      name: path.basename(detected.path),
      path: detected.path,
      type: detected.profileId,
      configFiles: detected.signals.filter((s) => s.present && s.path).map((s) => path.relative(detected.path, s.path!)),
      skills,
      providers: 0,
      confidence: detected.confidence,
    };
  }

  public detectFromName(profileOrHint: string): AgentDetection | null {
    const key = String(profileOrHint || '').trim().toLowerCase();
    const alias = PROFILE_ALIASES[key];
    // Prefer structural home scan using the hint as a directory name fragment.
    const detected = this.importer.detectFromHomeHints(key === 'auto' || !key ? undefined : key);
    if (detected) {
      return this.detectAgent(detected.path);
    }
    if (alias && alias !== 'auto') {
      // No path found; return null — caller should pass a path.
      return null;
    }
    return null;
  }

  public planMigration(detection: AgentDetection, options?: Partial<UniversalWorkspaceImportInput>): MigrationPlan {
    const snapshot = this.importer.buildSnapshot({
      sourcePath: detection.path,
      apply: false,
      projectRoot: process.cwd(),
      targetRoot: path.join(this.storageDir, 'imported', detection.name),
      ...options,
    });

    const items: MigrationItem[] = snapshot.items.map((item) => ({
      type: this.mapKind(item.kind),
      name: item.name,
      sourcePath: item.sourcePath,
      targetPath: item.targetPath,
      status: 'pending',
      reason: item.reason,
    }));

    const fileCount = items.length;
    const estimatedTime = fileCount < 10
      ? '< 1 minute'
      : fileCount < 50
        ? '1-2 minutes'
        : fileCount < 100
          ? '2-5 minutes'
          : '5+ minutes';

    return {
      source: detection,
      items,
      warnings: snapshot.warnings,
      estimatedTime,
      snapshot,
    };
  }

  public executeMigration(plan: MigrationPlan, options?: {
    dryRun?: boolean;
    skipSecrets?: boolean;
    consent?: boolean;
    onProgress?: (item: MigrationItem, index: number, total: number) => void;
  }): { success: number; failed: number; skipped: number; snapshot?: UniversalWorkspaceImportSnapshot } {
    const dryRun = options?.dryRun !== false;

    if (dryRun) {
      for (const item of plan.items) item.status = 'pending';
      return { success: 0, failed: 0, skipped: plan.items.length, snapshot: plan.snapshot };
    }

    const snapshot = this.importer.buildSnapshot({
      sourcePath: plan.source.path,
      apply: true,
      consent: options?.consent === true,
      includeSecretLike: options?.skipSecrets === false,
      targetRoot: path.join(this.storageDir, 'imported', plan.source.name),
    });

    let success = 0;
    let failed = 0;
    let skipped = 0;

    for (let i = 0; i < snapshot.items.length; i++) {
      const src = snapshot.items[i];
      const item = plan.items[i] || {
        type: this.mapKind(src.kind),
        name: src.name,
        sourcePath: src.sourcePath,
        targetPath: src.targetPath,
        status: 'pending' as const,
      };
      options?.onProgress?.(item, i, snapshot.items.length);
      if (src.status === 'copied') {
        item.status = 'done';
        success += 1;
      } else if (src.status === 'skipped') {
        item.status = 'skipped';
        skipped += 1;
      } else {
        item.status = 'error';
        item.reason = src.reason;
        failed += 1;
      }
      plan.items[i] = item;
    }

    try {
      const reportPath = path.join(this.storageDir, 'last-import-report.json');
      fs.writeFileSync(reportPath, JSON.stringify(snapshot, null, 2), 'utf8');
    } catch (error: unknown) {logger.warn('[MigrationUX] failed to write report', error);
    }

    return { success, failed, skipped, snapshot };
  }

  public generateReport(plan: MigrationPlan, result: { success: number; failed: number; skipped: number }): string {
    return [
      '=== Universal Workspace Import Report ===',
      '',
      `Source: ${plan.source.name}`,
      `Path: ${plan.source.path}`,
      `Structural profile: ${plan.source.type}`,
      `Confidence: ${(plan.source.confidence * 100).toFixed(0)}%`,
      '',
      'Items:',
      `  Total: ${plan.items.length}`,
      `  Success: ${result.success}`,
      `  Failed: ${result.failed}`,
      `  Skipped: ${result.skipped}`,
      '',
      ...(plan.warnings.length
        ? ['Warnings:', ...plan.warnings.map((w) => `  ${w}`), '']
        : []),
      `Estimated time: ${plan.estimatedTime}`,
      '',
      'Detection is structural and brand-agnostic.',
      'Secret-like files stay held unless explicitly consented.',
    ].join('\n');
  }

  private mapKind(kind: string): MigrationItem['type'] {
    switch (kind) {
      case 'skill': return 'skill';
      case 'memory': return 'memory';
      case 'config': return 'config';
      case 'plugin': return 'plugin';
      case 'identity': return 'identity';
      case 'preference': return 'preference';
      case 'tool-policy': return 'config';
      default: return 'unknown';
    }
  }

  private findSkillsDirectory(sourcePath: string): string | null {
    for (const candidate of ['skills', 'skill-library', 'agent/skills']) {
      const fullPath = path.join(sourcePath, candidate);
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) return fullPath;
    }
    return null;
  }
}
