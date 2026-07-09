import fs from 'node:fs';
import path from 'node:path';
import type {
  SourceSurfaceCategory,
  SourceSurfaceDecision,
  SourceSurfaceLedgerDocument,
  SourceSurfaceLedgerEntry,
  SourceSurfaceLedgerReceipt,
  SourceSurfaceLedgerSummary,
  SourceSurfacePriority,
  SourceSurfaceValidationIssue,
} from '../contracts/SourceSurfaceLedgerContract.js';
import {
  SOURCE_SURFACE_CATEGORIES,
  SOURCE_SURFACE_DECISIONS,
  SOURCE_SURFACE_PRIORITIES,
  ZAVORTH_SOURCE_SURFACE_LEDGER_CONTRACT_VERSION,
} from '../contracts/SourceSurfaceLedgerContract.js';
import { SourceAbsorptionPlannerService } from './SourceAbsorptionPlannerService.js';


import { SourceSurfaceDiffService } from './SourceSurfaceDiffService.js';
import { SourceSurfaceScannerService } from './SourceSurfaceScannerService.js';

type RawSourceSurfaceLedgerDocument = Omit<SourceSurfaceLedgerDocument, 'entries'> & {
  entries?: SourceSurfaceLedgerEntry[];
  items?: SourceSurfaceLedgerEntry[];
};

export type SourceSurfaceLedgerRuntime = {
  now?: () => Date;
  zavorthRoot?: string;
  ledgerPath?: string;
  sourceRoot?: string;
  scannerService?: SourceSurfaceScannerService;
  diffService?: SourceSurfaceDiffService;
  plannerService?: SourceAbsorptionPlannerService;
};

export class SourceSurfaceLedgerService {
  private readonly now: () => Date;
  private readonly zavorthRoot: string;
  private readonly defaultLedgerPath: string;
  private readonly defaultSourceRoot?: string;
  private readonly scannerService: SourceSurfaceScannerService;
  private readonly diffService: SourceSurfaceDiffService;
  private readonly plannerService: SourceAbsorptionPlannerService;

  constructor(runtime: SourceSurfaceLedgerRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.zavorthRoot = path.resolve(runtime.zavorthRoot || process.cwd());
    this.defaultLedgerPath = path.resolve(
      runtime.ledgerPath || path.join(this.zavorthRoot, 'docs', '400-zavorth-source-full-surface-ledger-private.json'),
    );
    this.defaultSourceRoot = runtime.sourceRoot;
    this.scannerService = runtime.scannerService || new SourceSurfaceScannerService();
    this.diffService = runtime.diffService || new SourceSurfaceDiffService();
    this.plannerService = runtime.plannerService || new SourceAbsorptionPlannerService({
      now: this.now,
    });
  }

  public loadLedger(ledgerPath = this.defaultLedgerPath): SourceSurfaceLedgerDocument {
    const raw = JSON.parse(fs.readFileSync(ledgerPath, 'utf8')) as RawSourceSurfaceLedgerDocument;
    const entries = raw.entries || raw.items || [];
    return {
      ...raw,
      entries,
      summary: raw.summary || this.summarizeEntries(entries),
    };
  }

  public validateLedger(ledger: SourceSurfaceLedgerDocument): SourceSurfaceValidationIssue[] {
    const issues: SourceSurfaceValidationIssue[] = [];
    const ids = new Set<string>();
    const surfaces = new Set<string>();

    if (!Array.isArray(ledger.entries)) {
      issues.push({
        severity: 'error',
        message: 'Ledger entries must be an array.',
      });
      return issues;
    }

    for (const entry of ledger.entries) {
      if (!entry.id) {
        issues.push({
          severity: 'error',
          sourcePath: entry.sourcePath,
          category: entry.category,
          message: 'Ledger entry is missing id.',
        });
      } else if (ids.has(entry.id)) {
        issues.push({
          severity: 'error',
          entryId: entry.id,
          sourcePath: entry.sourcePath,
          category: entry.category,
          message: 'Ledger entry id is duplicated.',
        });
      }
      ids.add(entry.id);

      if (!isSurfaceCategory(entry.category)) {
        issues.push({
          severity: 'error',
          entryId: entry.id,
          sourcePath: entry.sourcePath,
          category: entry.category,
          message: `Unknown surface category: ${entry.category}`,
        });
      }

      if (!isSurfaceDecision(entry.decision)) {
        issues.push({
          severity: 'error',
          entryId: entry.id,
          sourcePath: entry.sourcePath,
          category: entry.category,
          message: `Unknown surface decision: ${entry.decision}`,
        });
      }

      if (!isSurfacePriority(entry.priority)) {
        issues.push({
          severity: 'error',
          entryId: entry.id,
          sourcePath: entry.sourcePath,
          category: entry.category,
          message: `Unknown surface priority: ${entry.priority}`,
        });
      }

      const surface = surfaceKey(entry.category, entry.sourcePath);
      if (surfaces.has(surface)) {
        issues.push({
          severity: 'error',
          entryId: entry.id,
          sourcePath: entry.sourcePath,
          category: entry.category,
          message: 'Ledger contains a duplicated category/path surface.',
        });
      }
      surfaces.add(surface);

      if (entry.ownerDecisionRequired && entry.decision === 'implemented') {
        issues.push({
          severity: 'warning',
          entryId: entry.id,
          sourcePath: entry.sourcePath,
          category: entry.category,
          message: 'Implemented entries should not still require owner decision.',
        });
      }
    }

    const calculatedSummary = this.summarizeEntries(ledger.entries);
    if (ledger.summary?.total !== calculatedSummary.total) {
      issues.push({
        severity: 'warning',
        message: `Ledger summary total is ${ledger.summary?.total}; calculated ${calculatedSummary.total}.`,
      });
    }

    return issues;
  }

  public summarizeEntries(entries: SourceSurfaceLedgerEntry[]): SourceSurfaceLedgerSummary {
    return {
      total: entries.length,
      byDecision: countByKnown(entries, SOURCE_SURFACE_DECISIONS, (entry) => entry.decision),
      byCategory: countByKnown(entries, SOURCE_SURFACE_CATEGORIES, (entry) => entry.category),
      byPriority: countByKnown(entries, SOURCE_SURFACE_PRIORITIES, (entry) => entry.priority),
      ownerDecisionRequired: entries.filter((entry) => entry.ownerDecisionRequired).length,
      provisional: entries.filter((entry) => entry.decisionFinality === 'provisional').length,
    };
  }

  public buildReceipt(input: {
    ledgerPath?: string;
    sourceRoot?: string;
  } = {}): SourceSurfaceLedgerReceipt {
    const ledgerPath = path.resolve(input.ledgerPath || this.defaultLedgerPath);
    const ledger = this.loadLedger(ledgerPath);
    const sourceRoot = path.resolve(
      input.sourceRoot
        || this.defaultSourceRoot
        || readEnv('ZAVORTH_SOURCE_ROOT', 'SOURCE_ROOT')
        || ledger.sourceRoot,
    );
    const validationIssues = this.validateLedger(ledger);
    const scan = this.scannerService.scan(sourceRoot);
    const drift = this.diffService.diff(ledger.entries, scan.discovered);
    const planner = this.plannerService.buildPlan(ledger.entries);
    const validationErrors = validationIssues.filter((issue) => issue.severity === 'error').length;
    const validationWarnings = validationIssues.length - validationErrors;
    const status = validationErrors === 0 && drift.unclassified.length === 0 ? 'passed' : 'failed';
    const summary = this.summarizeEntries(ledger.entries);

    return {
      id: `source-surface-ledger:${this.now().toISOString()}`,
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_SOURCE_SURFACE_LEDGER_CONTRACT_VERSION,
      status,
      phase: 0,
      statement: 'Source full-surface ledger is executable Zavorth governance infrastructure.',
      paths: {
        ledgerPath: normalizePath(ledgerPath),
        sourceRoot: normalizePath(sourceRoot),
        zavorthRoot: normalizePath(this.zavorthRoot),
      },
      summary: {
        ...summary,
        discoveredSurfaces: scan.discovered.length,
        classifiedSurfaces: drift.classified,
        unclassifiedSurfaces: drift.unclassified.length,
        missingLedgerSurfaces: drift.missingFromCheckout.length,
        evidenceChangedSurfaces: drift.evidenceChanged.length,
        validationErrors,
        validationWarnings,
        ignoredSurfaces: scan.ignored.length,
      },
      validation: {
        issues: validationIssues,
      },
      drift,
      planner,
      ignoredSurfaces: scan.ignored,
      policy: {
        noLiveProviderCalls: true,
        noLiveChannelSends: true,
        noFilesystemWritesToSource: true,
        noSecretValuesSerialized: true,
        failOnUnclassifiedSurfaces: true,
        missingExistingLedgerSurfacesAreWarnings: true,
      },
      commands: {
        inspect: 'npm run source-surface-ledger --silent',
        inspectJson: 'npm run source-surface-ledger:json --silent',
        check: 'npm run source-surface-ledger:check --silent',
        qa: 'npm run qa:source-surface-ledger --silent',
        nextStage: 'Intent model - Plugin OS And Package SDK Absorption',
      },
    };
  }

  public formatReceiptText(receipt = this.buildReceipt()): string {
    const lines = [
      'Zavorth Source Surface Ledger - Security contract',
      `Status: ${receipt.status}`,
      `Contract: ${receipt.contractVersion}`,
      `Ledger: ${receipt.paths.ledgerPath}`,
      `Source: ${receipt.paths.sourceRoot}`,
      `Entries: ${receipt.summary.total}`,
      `Discovered: ${receipt.summary.discoveredSurfaces}`,
      `Classified: ${receipt.summary.classifiedSurfaces}`,
      `Unclassified: ${receipt.summary.unclassifiedSurfaces}`,
      `Missing from checkout: ${receipt.summary.missingLedgerSurfaces}`,
      `Evidence changed: ${receipt.summary.evidenceChangedSurfaces}`,
      `Owner decisions required: ${receipt.summary.ownerDecisionRequired}`,
      `Validation errors: ${receipt.summary.validationErrors}`,
      `Validation warnings: ${receipt.summary.validationWarnings}`,
      `Ignored volatile surfaces: ${receipt.summary.ignoredSurfaces}`,
    ];

    if (receipt.drift.unclassified.length > 0) {
      lines.push('Blocking unclassified surfaces:');
      for (const item of receipt.drift.unclassified.slice(0, 20)) {
        lines.push(`- ${item.category} ${item.sourcePath} (${item.reason})`);
      }
    }

    if (receipt.drift.missingFromCheckout.length > 0) {
      lines.push('Ledger surfaces not found in current checkout:');
      for (const item of receipt.drift.missingFromCheckout.slice(0, 20)) {
        lines.push(`- ${item.category} ${item.sourcePath} (${item.decision || 'no-decision'})`);
      }
    }

    if (receipt.drift.evidenceChanged.length > 0) {
      lines.push('Evidence drift observed:');
      for (const item of receipt.drift.evidenceChanged.slice(0, 20)) {
        lines.push(`- ${item.category} ${item.sourcePath} (${item.evidence.join(' | ')})`);
      }
    }

    lines.push(`Next: ${receipt.commands.nextStage}`);
    return lines.join('\n');
  }
}

function countByKnown<T extends string>(
  entries: SourceSurfaceLedgerEntry[],
  knownValues: readonly T[],
  selector: (entry: SourceSurfaceLedgerEntry) => T,
): Record<T, number> {
  const counts = Object.fromEntries(knownValues.map((value) => [value, 0])) as Record<T, number>;
  for (const entry of entries) {
    const value = selector(entry);
    counts[value] = (counts[value] || 0) + 1;
  }
  return counts;
}

function isSurfaceCategory(value: string): value is SourceSurfaceCategory {
  return (SOURCE_SURFACE_CATEGORIES as readonly string[]).includes(value);
}

function isSurfaceDecision(value: string): value is SourceSurfaceDecision {
  return (SOURCE_SURFACE_DECISIONS as readonly string[]).includes(value);
}

function isSurfacePriority(value: string): value is SourceSurfacePriority {
  return (SOURCE_SURFACE_PRIORITIES as readonly string[]).includes(value);
}

function surfaceKey(category: string, sourcePath: string): string {
  return `${category}:${normalizePath(sourcePath)}`;
}

function normalizePath(input: string): string {
  return input.replace(/\\/g, '/');
}

function readEnv(...names: string[]): string | null {
  for (const name of names) {
    const value = String(process.env[name] || '').trim();
    if (value) return value;
  }
  return null;
}
