import { redactSensitiveText } from '../security/SensitiveDataGuard.js';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_TRAJECTORY_EXPORT_CONTRACT_VERSION,
  type ZavorthTrajectoryExportFormat,
  type ZavorthTrajectoryExportInput,
  type ZavorthTrajectoryExportReceipt,
  type ZavorthTrajectoryExportRecord,
  type ZavorthTrajectoryExportSnapshot,
  type ZavorthTrajectoryExportStatus,
} from '../contracts/ZavorthTrajectoryExportContract.js';

import { logger } from '../logger.js';

type Runtime = {
  projectRoot?: string;
  now?: () => Date;
};

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 2_000;
const SOURCE_DIRS = [
  ['.zavorth', 'receipts'],
  ['.zavorth', 'runtime'],
  ['.zavorth', 'memory'],
  ['.zavorth', 'mnemos'],
  ['.zavorth', 'state'],
];

export class ZavorthTrajectoryExportService {
  private readonly projectRoot: string;
  private readonly now: () => Date;

  public constructor(runtime: Runtime = {}) {
    this.projectRoot = path.resolve(runtime.projectRoot || process.cwd());
    this.now = runtime.now || (() => new Date());
  }

  public buildSnapshot(input: ZavorthTrajectoryExportInput = {}): ZavorthTrajectoryExportSnapshot {
    const projectRoot = path.resolve(input.projectRoot || this.projectRoot);
    const format = normalizeFormat(input.format);
    const limit = normalizeLimit(input.limit);
    const includeReceipts = input.includeReceipts !== false;
    const includeMemory = input.includeMemory !== false;
    const sourceFiles = this.collectSourceFiles(projectRoot, includeReceipts, includeMemory);
    const records = sourceFiles
      .flatMap((filePath) => this.recordsFromFile(projectRoot, filePath))
      .slice(0, limit);
    const exportPath = this.resolveExportPath(projectRoot, input.exportPath, format);
    const hasWriteTarget = Boolean(input.exportPath);
    const hasApproval = Boolean(String(input.approvalId || '').trim());
    const receipts: ZavorthTrajectoryExportReceipt[] = [
      receipt('scan', 'done', `Scanned ${sourceFiles.length} local trajectory source file(s).`),
      receipt('redaction', 'done', 'All exported fields are redacted before serialization.'),
    ];

    let status: ZavorthTrajectoryExportStatus = records.length === 0 ? 'empty' : 'preview';
    if (hasWriteTarget && !hasApproval) {
      status = 'approval-required';
      receipts.push(receipt('policy', 'approval-required', 'Writing a trajectory export requires an approval id.'));
    } else if (hasWriteTarget && hasApproval && records.length > 0 && exportPath) {
      this.writeExport(exportPath, format, records);
      status = 'exported';
      receipts.push(receipt('write', 'done', `Wrote ${records.length} trajectory record(s) to ${this.relative(projectRoot, exportPath)}.`));
    } else {
      receipts.push(receipt('policy', 'skipped', 'Preview mode does not write trajectory data.'));
    }

    const toolSet = new Set(records.flatMap((record) => record.tools));
    const approvalCount = records.reduce((count, record) => count + record.approvals.length, 0);
    return {
      contractVersion: ZAVORTH_TRAJECTORY_EXPORT_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      source: 'ZavorthTrajectoryExportService',
      status,
      format,
      exportPath: hasWriteTarget ? exportPath : null,
      summary: {
        scannedFiles: sourceFiles.length,
        records: records.length,
        receipts: records.filter((record) => record.sourceKind === 'receipt').length,
        memoryRecords: records.filter((record) => record.sourceKind === 'memory').length,
        approvals: approvalCount,
        tools: toolSet.size,
      },
      records,
      receipts,
      safety: {
        requiresApprovalForWrite: true,
        noRawSecretsSerialized: true,
        exportPathConfinedToProject: true,
        sourceContentRedacted: true,
      },
      commands: {
        preview: 'zavorth trajectory export --format jsonl',
        apply: 'zavorth trajectory export --format jsonl --export-path <path> --approval-id <id>',
        check: 'npm run zavorth:trajectory-export:check',
      },
    };
  }

  private collectSourceFiles(projectRoot: string, includeReceipts: boolean, includeMemory: boolean): string[] {
    const dirs = SOURCE_DIRS
      .filter((parts) => includeReceipts || parts[1] !== 'receipts')
      .filter((parts) => includeMemory || !['memory', 'mnemos'].includes(parts[1]))
      .map((parts) => path.join(projectRoot, ...parts));
    return dirs.flatMap((dir) => walkJsonLikeFiles(dir)).sort((left, right) => left.localeCompare(right));
  }

  private recordsFromFile(projectRoot: string, filePath: string): ZavorthTrajectoryExportRecord[] {
    const values = readJsonLikeValues(filePath);
    return values.map((value, index) => this.recordFromValue(projectRoot, filePath, value, index));
  }

  private recordFromValue(
    projectRoot: string,
    filePath: string,
    value: unknown,
    index: number,
  ): ZavorthTrajectoryExportRecord {
    const object = value && typeof value === 'object' ? value as Record<string, unknown> : { content: value };
    const sourcePath = this.relative(projectRoot, filePath);
    const instruction = firstText(object, [
      'prompt',
      'objective',
      'instruction',
      'userInput',
      'input',
      'title',
      'summary',
      'content',
    ]) || 'Recovered Zavorth trajectory event.';
    const output = firstText(object, [
      'response',
      'result',
      'output',
      'assistantOutput',
      'finalResponse',
      'status',
      'summary',
    ]) || 'No final output recorded.';
    const input = firstText(object, ['context', 'details', 'metadata', 'arguments']) || '';
    const tools = collectStrings(object, ['tool', 'toolName', 'toolCalls', 'tools', 'actionId', 'command']);
    const approvals = collectStrings(object, ['approvalId', 'approvalIds', 'approvals', 'decision']);
    const receipts = collectStrings(object, ['receiptId', 'receiptIds', 'receipts', 'id']);
    return {
      id: hash(`${sourcePath}:${index}:${JSON.stringify(object).slice(0, 2_000)}`),
      sourcePath,
      sourceKind: inferSourceKind(sourcePath),
      instruction: safe(instruction),
      input: safe(input),
      output: safe(output),
      tools: tools.map(safe).filter(Boolean).slice(0, 16),
      approvals: approvals.map(safe).filter(Boolean).slice(0, 16),
      receipts: receipts.map(safe).filter(Boolean).slice(0, 16),
      metadata: {
        sourcePath,
        sourceKind: inferSourceKind(sourcePath),
        originalKeys: Object.keys(object).slice(0, 20),
      },
    };
  }

  private resolveExportPath(
    projectRoot: string,
    requestedPath: string | null | undefined,
    format: ZavorthTrajectoryExportFormat,
  ): string | null {
    if (!requestedPath) return null;
    const resolved = path.resolve(projectRoot, requestedPath);
    if (!isInside(projectRoot, resolved)) {
      throw new Error('Trajectory export path must stay inside the Zavorth project root.');
    }
    const extension = format === 'jsonl' ? '.jsonl' : '.json';
    return path.extname(resolved) ? resolved : `${resolved}${extension}`;
  }

  private writeExport(filePath: string, format: ZavorthTrajectoryExportFormat, records: ZavorthTrajectoryExportRecord[]): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const content = renderExport(format, records);
    fs.writeFileSync(filePath, `${content}\n`, 'utf8');
  }

  private relative(projectRoot: string, filePath: string): string {
    return path.relative(projectRoot, filePath).replace(/\\/g, '/') || '.';
  }
}

function walkJsonLikeFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkJsonLikeFiles(fullPath);
    return /\.(json|jsonl)$/i.test(entry.name) ? [fullPath] : [];
  });
}

function readJsonLikeValues(filePath: string): unknown[] {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    if (/\.jsonl$/i.test(filePath)) {
      return raw.split(/\r?\n/u)
        .map((line) => line.trim())
        .filter(Boolean)
        .flatMap((line) => {
          try {
            return [JSON.parse(line)];
          } catch (error: unknown) {logger.warn('[Zavorth Trajectory Export] JSON parse failed', error); return []; }
        });
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (error: unknown) {logger.warn('[Zavorth Trajectory Export] JSON parse failed', error); return []; }
}

function renderExport(format: ZavorthTrajectoryExportFormat, records: ZavorthTrajectoryExportRecord[]): string {
  if (format === 'jsonl') {
    return records.map((record) => JSON.stringify(record)).join('\n');
  }
  if (format === 'sharegpt') {
    return JSON.stringify(records.map((record) => ({
      id: record.id,
      conversations: [
        { from: 'human', value: record.instruction },
        { from: 'gpt', value: record.output },
      ],
      metadata: record.metadata,
    })), null, 2);
  }
  return JSON.stringify(records.map((record) => ({
    instruction: record.instruction,
    input: record.input,
    output: record.output,
    metadata: record.metadata,
  })), null, 2);
}

function firstText(object: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = object[key];
    const text = stringifySmall(value);
    if (text) return text;
  }
  return '';
}

function collectStrings(object: Record<string, unknown>, keys: string[]): string[] {
  return keys.flatMap((key) => valuesFromUnknown(object[key]));
}

function valuesFromUnknown(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return [String(value)];
  }
  if (Array.isArray(value)) return value.flatMap(valuesFromUnknown);
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return ['name', 'id', 'toolName', 'actionId', 'command', 'decision']
      .map((key) => stringifySmall(record[key]))
      .filter(Boolean);
  }
  return [];
}

function stringifySmall(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value).slice(0, 1_000);
  } catch (error: unknown) {logger.warn('[Zavorth Trajectory Export] serialization failed', error); return ''; }
}

function inferSourceKind(sourcePath: string): ZavorthTrajectoryExportRecord['sourceKind'] {
  const lower = sourcePath.toLowerCase();
  if (lower.includes('/receipts/')) return 'receipt';
  if (lower.includes('/memory/') || lower.includes('/mnemos/')) return 'memory';
  if (lower.includes('/runtime/')) return 'runtime';
  if (lower.includes('/state/')) return 'event';
  return 'unknown';
}

function normalizeFormat(value: unknown): ZavorthTrajectoryExportFormat {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'sharegpt') return 'sharegpt';
  if (normalized === 'alpaca') return 'alpaca';
  return 'jsonl';
}

function normalizeLimit(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.floor(parsed));
}

function safe(value: string): string {
  return redactSensitiveText(String(value || '')).replace(/\s+/g, ' ').trim();
}

function hash(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 24);
}

function receipt(
  kind: ZavorthTrajectoryExportReceipt['kind'],
  status: ZavorthTrajectoryExportReceipt['status'],
  summary: string,
): ZavorthTrajectoryExportReceipt {
  return {
    id: `trajectory-${kind}-${hash(`${kind}:${status}:${summary}`)}`,
    kind,
    status,
    summary,
    rawSecretSerialized: false,
  };
}

function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
