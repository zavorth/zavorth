import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_BATCH_WORKLOAD_CONTRACT_VERSION,
  type ZavorthBatchWorkloadInput,
  type ZavorthBatchWorkloadItem,
  type ZavorthBatchWorkloadReceipt,
  type ZavorthBatchWorkloadSnapshot,
  type ZavorthBatchWorkloadStatus,
} from '../contracts/ZavorthBatchWorkloadContract.js';
import { redactSensitiveText } from '../security/SensitiveDataGuard.js';

type Runtime = {
  projectRoot?: string;
  now?: () => Date;
  worker?: (prompt: string, index: number) => Promise<string> | string;
};

const DEFAULT_MAX_ITEMS = 50;
const HARD_MAX_ITEMS = 1_000;
const DEFAULT_CONCURRENCY = 4;
const HARD_MAX_CONCURRENCY = 32;

export class ZavorthBatchWorkloadService {
  private readonly projectRoot: string;
  private readonly now: () => Date;
  private readonly worker: (prompt: string, index: number) => Promise<string> | string;

  public constructor(runtime: Runtime = {}) {
    this.projectRoot = path.resolve(runtime.projectRoot || process.cwd());
    this.now = runtime.now || (() => new Date());
    this.worker = runtime.worker || defaultWorker;
  }

  public async buildSnapshot(input: ZavorthBatchWorkloadInput = {}): Promise<ZavorthBatchWorkloadSnapshot> {
    const projectRoot = path.resolve(input.projectRoot || this.projectRoot);
    const objective = clean(input.objective || 'Zavorth governed batch workload');
    const maxItems = normalizeMax(input.maxItems, DEFAULT_MAX_ITEMS, HARD_MAX_ITEMS);
    const concurrency = normalizeMax(input.concurrency, DEFAULT_CONCURRENCY, HARD_MAX_CONCURRENCY);
    const prompts = normalizeItems(input.items, objective).slice(0, maxItems);
    const live = input.live === true;
    const approvalId = String(input.approvalId || '').trim();
    const outputPath = this.resolveOutputPath(projectRoot, input.outputPath);
    const runId = `batch-${hash(`${objective}:${this.now().toISOString()}`)}`;
    const approvalRequired = live;
    const receipts: ZavorthBatchWorkloadReceipt[] = [
      receipt('plan', 'done', `Prepared ${prompts.length} batch item(s) with concurrency ${concurrency}.`),
      receipt('redaction', 'done', 'Prompts and outputs are redacted before persistence.'),
    ];

    let items = prompts.map((prompt, index) => queuedItem(prompt, index));
    let status: ZavorthBatchWorkloadStatus = items.length === 0 ? 'empty' : 'preview';
    if (live && !approvalId) {
      status = 'approval-required';
      receipts.push(receipt('policy', 'approval-required', 'Live batch workloads require an approval id.'));
    } else if (live && approvalId) {
      items = await this.runItems(items, concurrency);
      status = items.some((item) => item.status === 'failed') ? 'failed' : 'completed';
      receipts.push(receipt('execution', status === 'completed' ? 'done' : 'failed', `${items.length} item(s) processed by governed batch worker.`));
      if (outputPath) {
        this.writeOutput(outputPath, this.snapshotPayload({
          runId,
          objective,
          items,
          approvalId,
        }));
        receipts.push(receipt('write', 'done', `Batch workload written to ${relative(projectRoot, outputPath)}.`));
      }
    } else {
      receipts.push(receipt('policy', 'skipped', 'Preview mode created no live work and no external IO.'));
    }

    return {
      contractVersion: ZAVORTH_BATCH_WORKLOAD_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      source: 'ZavorthBatchWorkloadService',
      status,
      runId,
      objective,
      plan: {
        live,
        willExecute: live && Boolean(approvalId),
        maxItems,
        concurrency,
        outputPath,
        approvalRequired,
      },
      summary: {
        items: items.length,
        completed: items.filter((item) => item.status === 'completed').length,
        failed: items.filter((item) => item.status === 'failed').length,
        skipped: items.filter((item) => item.status === 'skipped').length,
      },
      items,
      receipts,
      safety: {
        liveRequiresApproval: true,
        noShellExecution: true,
        noNetworkByDefault: true,
        outputsRedacted: true,
        receiptsRequired: true,
      },
      commands: {
        preview: 'zavorth batch workload --objective "<goal>"',
        run: 'zavorth batch workload --live --approval-id <id>',
        check: 'npm run zavorth:batch-workload:check',
      },
    };
  }

  private async runItems(items: ZavorthBatchWorkloadItem[], concurrency: number): Promise<ZavorthBatchWorkloadItem[]> {
    const results = items.slice();
    let cursor = 0;
    const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (cursor < results.length) {
        const index = cursor;
        cursor += 1;
        const item = results[index]!;
        const startedAt = this.now().toISOString();
        try {
          const output = await this.worker(item.prompt, item.index);
          results[index] = {
            ...item,
            status: 'completed',
            output: clean(output),
            error: null,
            startedAt,
            finishedAt: this.now().toISOString(),
          };
        } catch (error: unknown) {
          results[index] = {
            ...item,
            status: 'failed',
            output: null,
            error: clean(error instanceof Error ? error.message : String(error)),
            startedAt,
            finishedAt: this.now().toISOString(),
          };
        }
      }
    });
    await Promise.all(workers);
    return results;
  }

  private resolveOutputPath(projectRoot: string, requestedPath: string | null | undefined): string | null {
    if (!requestedPath) return null;
    const resolved = path.resolve(projectRoot, requestedPath);
    if (!isInside(projectRoot, resolved)) {
      throw new Error('Batch workload output path must stay inside the Zavorth project root.');
    }
    return path.extname(resolved) ? resolved : `${resolved}.json`;
  }

  private writeOutput(filePath: string, payload: unknown): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  }

  private snapshotPayload(input: {
    runId: string;
    objective: string;
    approvalId: string;
    items: ZavorthBatchWorkloadItem[];
  }): Record<string, unknown> {
    return {
      contractVersion: ZAVORTH_BATCH_WORKLOAD_CONTRACT_VERSION,
      runId: input.runId,
      objective: input.objective,
      approvalId: clean(input.approvalId),
      items: input.items,
    };
  }
}

function normalizeItems(items: string[] | null | undefined, objective: string): string[] {
  const normalized = Array.isArray(items)
    ? items.map(clean).filter(Boolean)
    : [];
  if (normalized.length > 0) return normalized;
  return objective
    .split(/\n|;/u)
    .map(clean)
    .filter(Boolean);
}

function queuedItem(prompt: string, index: number): ZavorthBatchWorkloadItem {
  return {
    id: `batch-item-${index + 1}-${hash(prompt)}`,
    index,
    prompt,
    status: 'queued',
    output: null,
    error: null,
    startedAt: null,
    finishedAt: null,
  };
}

function defaultWorker(prompt: string, index: number): string {
  return `Processed batch item ${index + 1}: ${prompt}`;
}

function normalizeMax(value: unknown, fallback: number, hardMax: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(hardMax, Math.max(1, Math.floor(parsed)));
}

function clean(value: unknown): string {
  return redactSensitiveText(String(value || '')).replace(/\s+/g, ' ').trim();
}

function hash(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function receipt(
  kind: ZavorthBatchWorkloadReceipt['kind'],
  status: ZavorthBatchWorkloadReceipt['status'],
  summary: string,
): ZavorthBatchWorkloadReceipt {
  return {
    id: `batch-${kind}-${hash(`${kind}:${status}:${summary}`)}`,
    kind,
    status,
    summary,
    rawSecretSerialized: false,
  };
}

function isInside(root: string, candidate: string): boolean {
  const relativePath = path.relative(root, candidate);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

function relative(root: string, candidate: string): string {
  return path.relative(root, candidate).replace(/\\/g, '/') || '.';
}
