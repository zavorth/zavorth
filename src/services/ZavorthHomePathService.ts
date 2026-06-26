import fs from 'node:fs';
import path from 'node:path';

import type {
  ZavorthHomeMigrationEntry,
  ZavorthHomeResolvedPaths,
  ZavorthHomeSnapshot,
  ZavorthHomeSource,
} from '../contracts/ZavorthHomeContract.js';
import { getInstanceName, resolveInstanceHome } from './ZavorthInstanceService.js';

type ZavorthHomePathServiceOptions = {
  projectRoot: string;
  explicitHome?: string | null;
  env?: Record<string, string | undefined>;
  now?: () => Date;
};

type MigrationApplyInput = {
  approvalId?: string | null;
  overwrite?: boolean;
};

type HomeSwitchInput = {
  home: string;
};

const MIGRATION_CANDIDATES = [
  { relativePath: 'data', kind: 'directory' as const, sensitive: true, risk: 'high' as const },
  { relativePath: '.zavorth', kind: 'directory' as const, sensitive: true, risk: 'high' as const },
  { relativePath: '.agents', kind: 'directory' as const, sensitive: true, risk: 'medium' as const },
  { relativePath: 'tmp', kind: 'directory' as const, sensitive: false, risk: 'low' as const },
];

export class ZavorthHomePathService {
  private readonly projectRoot: string;
  private readonly explicitHome: string | null;
  private readonly env: Record<string, string | undefined>;
  private readonly now: () => Date;

  constructor(options: ZavorthHomePathServiceOptions) {
    this.projectRoot = path.resolve(options.projectRoot || process.cwd());
    this.explicitHome = this.normalizeOptionalPath(options.explicitHome);
    this.env = options.env || process.env;
    this.now = options.now || (() => new Date());
  }

  public resolveSnapshot(): ZavorthHomeSnapshot {
    const source = this.resolveSource();
    const root = this.resolveHomeRoot(source);
    const paths = this.resolvePaths(root);
    const entries = this.buildMigrationEntries(paths);
    const isolated = source !== 'compat';
    const warnings: string[] = [];

    if (isolated && isSamePath(root, this.projectRoot)) {
      warnings.push('ZAVORTH_HOME resolves to the project root; physical isolation is disabled.');
    }
    if (path.parse(root).root === root) {
      warnings.push('ZAVORTH_HOME resolves to a filesystem root; choose a dedicated directory.');
    }

    return {
      contractVersion: 'zavorth-home/1',
      generatedAt: this.now().toISOString(),
      projectRoot: this.projectRoot,
      root,
      source,
      isolated,
      resolvedPaths: paths,
      dailyUse: this.buildDailyUseCommands(root),
      migration: {
        status: isolated && entries.some((entry) => entry.exists) ? 'available' : 'not_needed',
        entries,
        approvalRequired: true,
        approvalId: null,
        writesPerformed: false,
        rollback: this.buildRollbackPlan(paths, entries),
      },
      safety: {
        preventsPathTraversal: true,
        secretsRedacted: true,
        noAutomaticMigration: true,
        approvalRequiredForApply: true,
        compatibleFallback: true,
      },
      warnings,
    };
  }

  public resolvePaths(root = this.resolveHomeRoot(this.resolveSource())): ZavorthHomeResolvedPaths {
    const homeRoot = path.resolve(root);
    return {
      homeRoot,
      projectRoot: this.projectRoot,
      dataDir: path.join(homeRoot, 'data'),
      runtimeDir: path.join(homeRoot, 'runtime'),
      configDir: path.join(homeRoot, 'config'),
      tmpDir: path.join(homeRoot, 'tmp'),
      logsDir: path.join(homeRoot, 'logs'),
      cacheDir: path.join(homeRoot, 'cache'),
      credentialsDir: path.join(homeRoot, 'credentials'),
      receiptsDir: path.join(homeRoot, 'receipts'),
      dbPath: path.join(homeRoot, 'data', 'zavorth.db'),
      legacyDataDir: path.join(this.projectRoot, 'data'),
      legacyStateDir: path.join(this.projectRoot, '.zavorth'),
    };
  }

  public buildMigrationPreview(): ZavorthHomeSnapshot {
    const snapshot = this.resolveSnapshot();
    return {
      ...snapshot,
      migration: {
        ...snapshot.migration,
        status: snapshot.isolated ? 'preview' : snapshot.migration.status,
        writesPerformed: false,
      },
    };
  }

  public applyMigration(input: MigrationApplyInput = {}): ZavorthHomeSnapshot {
    const approvalId = String(input.approvalId || '').trim();
    const preview = this.buildMigrationPreview();
    if (!preview.isolated || !preview.migration.entries.some((entry) => entry.exists)) {
      return {
        ...preview,
        migration: {
          ...preview.migration,
          status: 'not_needed',
          approvalId: approvalId || null,
          writesPerformed: false,
        },
      };
    }
    if (!approvalId) {
      return {
        ...preview,
        migration: {
          ...preview.migration,
          status: 'blocked',
          approvalId: null,
          writesPerformed: false,
        },
        warnings: [...preview.warnings, 'Migration apply requires --approval-id.'],
      };
    }

    this.ensureHomeDirectories(preview.resolvedPaths);
    for (const entry of preview.migration.entries.filter((candidate) => candidate.exists)) {
      assertChildOf(entry.source, this.projectRoot, 'migration source');
      assertChildOf(entry.destination, preview.root, 'migration destination');
      fs.mkdirSync(path.dirname(entry.destination), { recursive: true });
      fs.cpSync(entry.source, entry.destination, {
        recursive: true,
        force: Boolean(input.overwrite),
        errorOnExist: false,
      });
    }

    return {
      ...preview,
      migration: {
        ...preview.migration,
        status: 'applied',
        approvalId,
        writesPerformed: true,
      },
    };
  }

  public rollbackMigration(input: MigrationApplyInput = {}): ZavorthHomeSnapshot {
    const approvalId = String(input.approvalId || '').trim();
    const preview = this.buildMigrationPreview();
    if (!preview.isolated) {
      return {
        ...preview,
        migration: {
          ...preview.migration,
          status: 'not_needed',
          approvalId: approvalId || null,
          writesPerformed: false,
        },
      };
    }
    if (!approvalId) {
      return {
        ...preview,
        migration: {
          ...preview.migration,
          status: 'blocked',
          approvalId: null,
          writesPerformed: false,
        },
        warnings: [...preview.warnings, 'Migration rollback requires --approval-id.'],
      };
    }

    for (const entry of preview.migration.entries.filter((candidate) => candidate.exists)) {
      assertChildOf(entry.destination, preview.root, 'migration rollback target');
      if (fs.existsSync(entry.destination)) {
        fs.rmSync(entry.destination, { recursive: true, force: true });
      }
    }

    return {
      ...preview,
      migration: {
        ...preview.migration,
        status: 'rolled_back',
        approvalId,
        writesPerformed: true,
      },
    };
  }

  public previewSwitch(input: HomeSwitchInput): ZavorthHomeSnapshot {
    const nextHome = this.normalizeOptionalPath(input.home);
    if (!nextHome) {
      return {
        ...this.resolveSnapshot(),
        warnings: [...this.resolveSnapshot().warnings, 'Home switch requires --home <path>.'],
      };
    }
    return new ZavorthHomePathService({
      projectRoot: this.projectRoot,
      explicitHome: nextHome,
      env: this.env,
      now: this.now,
    }).resolveSnapshot();
  }

  public ensureHomeDirectories(paths = this.resolvePaths()): void {
    for (const dir of [
      paths.homeRoot,
      paths.dataDir,
      paths.runtimeDir,
      paths.configDir,
      paths.tmpDir,
      paths.logsDir,
      paths.cacheDir,
      paths.credentialsDir,
      paths.receiptsDir,
    ]) {
      assertChildOf(dir, paths.homeRoot, 'home directory');
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private resolveSource(): ZavorthHomeSource {
    if (this.explicitHome) {
      return 'explicit';
    }
    if (this.normalizeOptionalPath(this.env.ZAVORTH_HOME)) {
      return 'env';
    }
    return 'compat';
  }

  private resolveHomeRoot(source: ZavorthHomeSource): string {
    let baseRoot: string;
    if (source === 'explicit' && this.explicitHome) {
      baseRoot = path.resolve(this.explicitHome);
    } else if (source === 'env') {
      baseRoot = path.resolve(String(this.env.ZAVORTH_HOME || ''));
    } else {
      baseRoot = this.projectRoot;
    }

    const instanceName = getInstanceName(this.env);
    if (instanceName !== 'default') {
      return resolveInstanceHome(baseRoot, instanceName);
    }
    return baseRoot;
  }

  private buildMigrationEntries(paths: ZavorthHomeResolvedPaths): ZavorthHomeMigrationEntry[] {
    return MIGRATION_CANDIDATES.map((candidate) => {
      const source = path.join(this.projectRoot, candidate.relativePath);
      const destination = path.join(paths.homeRoot, candidate.relativePath);
      const exists = fs.existsSync(source);
      return {
        source,
        destination,
        exists,
        kind: exists ? candidate.kind : 'missing',
        sensitive: candidate.sensitive,
        redactedSource: redactPath(source, candidate.sensitive),
        redactedDestination: redactPath(destination, candidate.sensitive),
        risk: candidate.risk,
      };
    });
  }

  private buildRollbackPlan(paths: ZavorthHomeResolvedPaths, entries: ZavorthHomeMigrationEntry[]): string[] {
    if (isSamePath(paths.homeRoot, this.projectRoot)) {
      return ['No isolated migration target selected.'];
    }
    return entries
      .filter((entry) => entry.exists)
      .map((entry) => `Remove copied ${path.basename(entry.destination)} from ${redactPath(paths.homeRoot, entry.sensitive)} after verifying legacy data remains intact.`);
  }

  private buildDailyUseCommands(root: string): ZavorthHomeSnapshot['dailyUse'] {
    const quoted = quoteCliPath(root);
    return {
      setupPrompt: 'Where should Zavorth store this instance home?',
      statusCommand: 'zavorth home status',
      switchCommand: `zavorth home switch --home ${quoted} --apply`,
      migratePreviewCommand: `zavorth home migrate --home ${quoted} --preview`,
      migrateApplyCommand: `zavorth home migrate --home ${quoted} --apply --approval-id <approval-id>`,
      rollbackCommand: `zavorth home migrate --home ${quoted} --rollback --approval-id <approval-id>`,
    };
  }

  private normalizeOptionalPath(value: unknown): string | null {
    const normalized = String(value || '').trim();
    return normalized ? normalized : null;
  }
}

function redactPath(input: string, sensitive: boolean): string {
  if (!sensitive) {
    return input;
  }
  const parsed = path.parse(input);
  const relative = input.slice(parsed.root.length)
    .split(/[\\/]+/u)
    .map((segment, index, segments) => (index >= Math.max(0, segments.length - 2) ? '[redacted]' : segment))
    .join(path.sep);
  return `${parsed.root}${relative}`;
}

function assertChildOf(candidate: string, parent: string, label: string): void {
  const resolvedCandidate = path.resolve(candidate);
  const resolvedParent = path.resolve(parent);
  const relative = path.relative(resolvedParent, resolvedCandidate);
  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
    return;
  }
  throw new Error(`${label} escapes its allowed root: ${resolvedCandidate}`);
}

function isSamePath(a: string, b: string): boolean {
  return path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
}

function quoteCliPath(value: string): string {
  return /\s/u.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
}
