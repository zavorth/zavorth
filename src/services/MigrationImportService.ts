import type {
  MigrationImportFinding,
  MigrationImportRequest,
  MigrationImportResult,
} from '../contracts/MigrationContract.js';
import { MIGRATION_CONTRACT_VERSION } from '../contracts/MigrationContract.js';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { config } from '../config/index.js';
import { logger } from '../logger.js';

type MigrationImportServiceOptions = {
  artifactDir?: string;
  workspaceRoots?: string[];
  now?: () => Date;
};

export type MigrationImportLiveRequest = MigrationImportRequest & {
  allowedRoots?: string[];
  outputDir?: string | null;
  confirmApply?: boolean;
};

type MigrationInventoryItem = {
  id: string;
  sourcePath: string;
  kind: 'json' | 'text';
  summary: string;
  redactedData: unknown;
};

export class MigrationImportService {
  private readonly artifactDir: string;
  private readonly workspaceRoots: string[];
  private readonly now: () => Date;

  constructor(options: MigrationImportServiceOptions = {}) {
    this.artifactDir = options.artifactDir || path.join(config.dataDir, 'artifacts', 'migration-import');
    this.workspaceRoots = options.workspaceRoots || [process.cwd(), config.dataDir];
    this.now = options.now || (() => new Date());
  }

  public planImport(request: MigrationImportRequest): MigrationImportResult {
    const processedAt = this.now().toISOString();
    const sourceId = this.normalizeId(request.source.ref);
    return {
      ok: true,
      contractVersion: MIGRATION_CONTRACT_VERSION,
      status: request.dryRun ? 'dry_run' : 'planned',
      findings: [
        {
          id: `migration.${sourceId}.inventory`,
          severity: 'info',
          summary: `Migration source ${request.source.kind} is mapped into ${request.targetNamespace}.`,
          targetPrimitive: 'migration.import',
        },
      ],
      generatedManifestIds: [`zavorth.migration.${sourceId}`],
      reportArtifactId: `migration.report.${sourceId}`,
      receiptId: `migration.import.${sourceId}.receipt`,
      processedAt,
      error: null,
    };
  }

  public async executeLive(request: MigrationImportLiveRequest): Promise<MigrationImportResult> {
    const processedAt = this.now().toISOString();
    const sourceId = this.normalizeId(path.basename(request.source.ref) || request.source.ref);
    const roots = this.allowedRoots(request.allowedRoots);
    const outputDir = path.resolve(request.outputDir || this.artifactDir);
    const sourcePath = this.resolveSourcePath(request.source.ref, roots);

    if (!sourcePath || !this.isWithinRoots(sourcePath, roots) || !this.isWithinRoots(outputDir, roots)) {
      return this.result({
        ok: false,
        status: 'blocked',
        sourceId,
        processedAt,
        findings: [{
          id: `migration.${sourceId}.blocked`,
          severity: 'blocked',
          summary: 'migration.import live execution requires approved source and output roots.',
          targetPrimitive: 'migration.import',
        }],
        generatedManifestIds: [],
        reportArtifactId: null,
        error: 'migration.import source/output path is outside approved roots.',
      });
    }
    if (!fs.existsSync(sourcePath)) {
      return this.result({
        ok: false,
        status: 'failed',
        sourceId,
        processedAt,
        findings: [{
          id: `migration.${sourceId}.missing`,
          severity: 'blocked',
          summary: 'migration.import source path does not exist.',
          targetPrimitive: 'migration.import',
        }],
        generatedManifestIds: [],
        reportArtifactId: null,
        error: 'migration.import source path does not exist.',
      });
    }
    if (!request.dryRun && !request.confirmApply) {
      return this.result({
        ok: false,
        status: 'blocked',
        sourceId,
        processedAt,
        findings: [{
          id: `migration.${sourceId}.approval`,
          severity: 'blocked',
          summary: 'migration.import apply requires confirmApply.',
          targetPrimitive: 'migration.import',
        }],
        generatedManifestIds: [],
        reportArtifactId: null,
        error: 'migration.import apply requires confirmApply.',
      });
    }

    try {
      await fs.promises.mkdir(outputDir, { recursive: true });
      const inventory = await this.readInventory(request.source.kind, sourcePath);
      const manifestId = `zavorth.migration.${request.targetNamespace}.${sourceId}.${randomUUID()}`;
      const diffArtifactId = `migration.diff.${sourceId}.${randomUUID()}`;
      const reportArtifactId = `migration.report.${sourceId}.${randomUUID()}`;
      const generatedManifest = {
        id: manifestId,
        targetNamespace: request.targetNamespace,
        source: {
          kind: request.source.kind,
          name: path.basename(sourcePath),
          redactedPath: path.basename(sourcePath),
        },
        inventory,
        plannedChanges: inventory.map((item) => ({
          sourceId: item.id,
          action: 'upsert-manifest-entry',
          targetPrimitive: this.inferTargetPrimitive(item),
        })),
        generatedAt: processedAt,
        secretValuesSerialized: false,
      };
      await fs.promises.writeFile(
        path.join(outputDir, `${diffArtifactId}.json`),
        JSON.stringify({
          manifestId,
          dryRun: request.dryRun,
          plannedChanges: generatedManifest.plannedChanges,
          redactedInventory: inventory,
          inventoryCount: inventory.length,
          generatedAt: processedAt,
          secretValuesSerialized: false,
        }, null, 2),
        'utf8',
      );
      if (!request.dryRun) {
        await fs.promises.writeFile(
          path.join(outputDir, `${manifestId}.json`),
          JSON.stringify(generatedManifest, null, 2),
          'utf8',
        );
      }
      await fs.promises.writeFile(
        path.join(outputDir, `${reportArtifactId}.json`),
        JSON.stringify({
          sourceId,
          status: request.dryRun ? 'dry_run' : 'applied',
          manifestId,
          diffArtifactId,
          findings: this.findingsForInventory(sourceId, inventory, request.dryRun),
          generatedAt: processedAt,
          secretValuesSerialized: false,
        }, null, 2),
        'utf8',
      );

      return this.result({
        ok: true,
        status: request.dryRun ? 'dry_run' : 'applied',
        sourceId,
        processedAt,
        findings: this.findingsForInventory(sourceId, inventory, request.dryRun),
        generatedManifestIds: [manifestId, diffArtifactId],
        reportArtifactId,
        error: null,
      });
    } catch (error: unknown) {
      logger.warn('[Migration Import] creation failed', error);
    return this.result({
        ok: false,
        status: 'failed',
        sourceId,
        processedAt,
        findings: [{
          id: `migration.${sourceId}.failed`,
          severity: 'blocked',
          summary: error instanceof Error ? error.message : String(error),
          targetPrimitive: 'migration.import',
        }],
        generatedManifestIds: [],
        reportArtifactId: null,
        error: error instanceof Error ? error.message : String(error),
      });
  }
  }

  private async readInventory(
    sourceKind: MigrationImportRequest['source']['kind'],
    sourcePath: string,
  ): Promise<MigrationInventoryItem[]> {
    const stats = await fs.promises.stat(sourcePath);
    const files = stats.isDirectory()
      ? await this.collectInventoryFiles(sourcePath)
      : [sourcePath];
    return Promise.all(files.map((filePath, index) => this.readInventoryFile(sourceKind, filePath, index)));
  }

  private async collectInventoryFiles(root: string): Promise<string[]> {
    const pending = [root];
    const files: string[] = [];
    while (pending.length > 0 && files.length < 50) {
      const current = pending.shift()!;
      const entries = await fs.promises.readdir(current, { withFileTypes: true });
      for (const entry of entries) {
        const target = path.join(current, entry.name);
        if (entry.isDirectory()) {
          if (!/node_modules|\.git|dist|build/i.test(entry.name)) {
            pending.push(target);
          }
        } else if (/\.(json|md|txt|ya?ml)$/i.test(entry.name) || /^package\.json$/i.test(entry.name)) {
          files.push(target);
        }
      }
    }
    return files;
  }

  private async readInventoryFile(
    sourceKind: MigrationImportRequest['source']['kind'],
    filePath: string,
    index: number,
  ): Promise<MigrationInventoryItem> {
    const raw = (await fs.promises.readFile(filePath, 'utf8')).replace(/^\uFEFF/, '');
    let redactedData: unknown = raw.slice(0, 2_000);
    let kind: MigrationInventoryItem['kind'] = 'text';
    if (/\.json$/i.test(filePath) || sourceKind === 'manifest' || sourceKind === 'config-file') {
      try {
        redactedData = this.redactSecrets(JSON.parse(raw));
        kind = 'json';
      } catch (error: unknown) {logger.warn('[Migration Import] JSON parse failed', error);
    redactedData = this.redactText(raw);
  }
    } else {
      redactedData = this.redactText(raw);
    }
    return {
      id: `inventory.${index + 1}.${this.normalizeId(path.basename(filePath))}`,
      sourcePath: path.basename(filePath),
      kind,
      summary: `${path.basename(filePath)} imported as redacted ${kind} inventory.`,
      redactedData,
    };
  }

  private findingsForInventory(
    sourceId: string,
    inventory: MigrationInventoryItem[],
    dryRun: boolean,
  ): MigrationImportFinding[] {
    return [
      {
        id: `migration.${sourceId}.inventory`,
        severity: inventory.length > 0 ? 'info' : 'warning',
        summary: `Read ${inventory.length} source inventory item(s).`,
        targetPrimitive: 'migration.import',
      },
      {
        id: `migration.${sourceId}.${dryRun ? 'dry-run-diff' : 'apply'}`,
        severity: 'info',
        summary: dryRun
          ? 'Generated Zavorth-native migration dry-run diff artifact.'
          : 'Applied Zavorth-native migration manifest with operator approval.',
        targetPrimitive: 'migration.import',
      },
    ];
  }

  private inferTargetPrimitive(item: MigrationInventoryItem): string {
    const serialized = JSON.stringify(item.redactedData).toLowerCase();
    if (serialized.includes('provider') || serialized.includes('model')) return 'provider.call';
    if (serialized.includes('channel') || serialized.includes('telegram') || serialized.includes('signal')) return 'channel.message';
    return 'migration.import';
  }

  private result(input: {
    ok: boolean;
    status: MigrationImportResult['status'];
    sourceId: string;
    processedAt: string;
    findings: MigrationImportFinding[];
    generatedManifestIds: string[];
    reportArtifactId: string | null;
    error: string | null;
  }): MigrationImportResult {
    return {
      ok: input.ok,
      contractVersion: MIGRATION_CONTRACT_VERSION,
      status: input.status,
      findings: input.findings,
      generatedManifestIds: input.generatedManifestIds,
      reportArtifactId: input.reportArtifactId,
      receiptId: `migration.import.${input.sourceId}.receipt`,
      processedAt: input.processedAt,
      error: input.error,
    };
  }

  private resolveSourcePath(ref: string, roots: string[]): string | null {
    const normalized = String(ref || '').trim();
    if (!normalized || /^https?:\/\//i.test(normalized)) return null;
    const root = roots[0] || process.cwd();
    return path.resolve(path.isAbsolute(normalized) ? normalized : path.join(root, normalized));
  }

  private allowedRoots(extraRoots: string[] | undefined): string[] {
    return [...this.workspaceRoots, this.artifactDir, ...(extraRoots || [])]
      .map((root) => path.resolve(root));
  }

  private isWithinRoots(candidate: string, roots: string[]): boolean {
    const resolved = path.resolve(candidate);
    return roots.some((root) => {
      const normalizedRoot = path.resolve(root);
      const relative = path.relative(normalizedRoot, resolved);
      return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
    });
  }

  private redactSecrets(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.redactSecrets(item));
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => [
        key,
        /token|secret|password|api[_-]?key|credential/i.test(key) ? '<redacted>' : this.redactSecrets(entryValue),
      ]));
    }
    if (typeof value === 'string') {
      return this.redactText(value);
    }
    return value;
  }

  private redactText(value: string): string {
    return value
      .replace(/([A-Za-z0-9_]*?(?:token|secret|password|api[_-]?key)[A-Za-z0-9_]*?\s*[:=]\s*)["']?[^"',\s}]+/gi, '$1<redacted>')
      .slice(0, 2_000);
  }

  private normalizeId(value: string): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_.:-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'source';
  }
}
