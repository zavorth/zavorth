import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  type ZavorthTrajectoryCaptureSnapshot,
  type ZavorthTrajectoryCaptureTurn,
  type ZavorthTrajectoryExportFormat,
} from '@zavorth/contracts/ZavorthTrajectoryExportContract.js';
import { redactSensitiveText } from '@zavorth/security/SensitiveDataGuard.js';
import { ZavorthTrajectoryCaptureService } from '@zavorth/services/ZavorthTrajectoryCaptureService.js';

type Runtime = {
  projectRoot?: string;
  now?: () => Date;
  agent?: (prompt: string, index: number) => Promise<AgentResult> | AgentResult;
};

type AgentResult = {
  response: string;
  reasoning?: string;
  toolCalls?: Array<{ name: string; args: string; result: string; success: boolean; durationMs: number }>;
  approvals?: string[];
  metadata?: Record<string, unknown>;
};

type BatchOptions = {
  concurrency?: number;
  runId?: string;
  sessionId?: string;
  userId?: string;
  channel?: string;
  approvalId?: string;
  outputPath?: string;
  format?: ZavorthTrajectoryExportFormat;
};

type BatchItemResult = {
  index: number;
  prompt: string;
  turn: ZavorthTrajectoryCaptureTurn;
  success: boolean;
  error: string | null;
  durationMs: number;
};

type BatchSnapshot = {
  runId: string;
  startedAt: string;
  finishedAt: string;
  totalDurationMs: number;
  items: BatchItemResult[];
  summary: {
    total: number;
    completed: number;
    failed: number;
    avgDurationMs: number;
  };
  trajectory: ZavorthTrajectoryCaptureSnapshot;
};

const DEFAULT_CONCURRENCY = 4;
const HARD_MAX_CONCURRENCY = 32;
const MAX_PROMPTS = 200;

export class ZavorthBatchRunnerService {
  private readonly projectRoot: string;
  private readonly now: () => Date;
  private readonly agent: (prompt: string, index: number) => Promise<AgentResult> | AgentResult;

  public constructor(runtime: Runtime = {}) {
    this.projectRoot = path.resolve(runtime.projectRoot || process.cwd());
    this.now = runtime.now || (() => new Date());
    this.agent = runtime.agent || defaultAgent;
  }

  public async runBatch(prompts: string[], options: BatchOptions = {}): Promise<BatchSnapshot> {
    const cleanPrompts = prompts.map(cleanText).filter(Boolean).slice(0, MAX_PROMPTS);
    if (cleanPrompts.length === 0) {
      throw new Error('Batch runner requires at least one non-empty prompt.');
    }
    const concurrency = normalizeConcurrency(options.concurrency);
    const runId = options.runId || `batch-capture-${hash(this.now().toISOString())}`;
    const sessionId = options.sessionId || `session-${hash(`session:${runId}`)}`;
    const capture = new ZavorthTrajectoryCaptureService({ projectRoot: this.projectRoot, now: this.now });
    const startedAt = this.now().toISOString();
    const batchStartMs = Date.now();

    const items: BatchItemResult[] = cleanPrompts.map((prompt, index) => ({
      index,
      prompt,
      turn: emptyTurn(runId, sessionId, options, prompt),
      success: false,
      error: null,
      durationMs: 0,
    }));

    let cursor = 0;
    const nextIndex = (): number => { const i = cursor; cursor += 1; return i; };
    const workers = Array.from({ length: Math.min(concurrency, cleanPrompts.length) }, async () => {
      let index: number;
      while ((index = nextIndex()) < items.length) {
        const item = items[index]!;
        const itemStart = Date.now();
        try {
          const result = await this.agent(item.prompt, index);
          const turn: ZavorthTrajectoryCaptureTurn = {
            turnId: `turn-${runId}-${index}-${hash(item.prompt)}`,
            runId,
            sessionId,
            userId: options.userId || 'batch-user',
            channel: options.channel || 'batch',
            timestamp: this.now().toISOString(),
            userMessage: item.prompt,
            assistantResponse: result.response || '',
            reasoning: result.reasoning || '',
            toolCalls: result.toolCalls || [],
            approvals: result.approvals || [],
            status: 'completed',
            metadata: { ...(result.metadata || {}), batchIndex: index },
          };
          capture.captureTurn(turn);
          items[index] = { ...item, turn, success: true, error: null, durationMs: Date.now() - itemStart };
        } catch (error: unknown) {
          const errorMessage = cleanText(error instanceof Error ? error.message : String(error));
          const turn: ZavorthTrajectoryCaptureTurn = {
            turnId: `turn-${runId}-${index}-${hash(item.prompt)}`,
            runId,
            sessionId,
            userId: options.userId || 'batch-user',
            channel: options.channel || 'batch',
            timestamp: this.now().toISOString(),
            userMessage: item.prompt,
            assistantResponse: '',
            reasoning: '',
            toolCalls: [],
            approvals: [],
            status: 'failed',
            metadata: { batchIndex: index, error: errorMessage },
          };
          capture.captureTurn(turn);
          items[index] = { ...item, turn, success: false, error: errorMessage, durationMs: Date.now() - itemStart };
        }
      }
    });

    await Promise.all(workers);

    const finishedAt = this.now().toISOString();
    const totalDurationMs = Date.now() - batchStartMs;
    const trajectory = capture.buildSnapshot(options.format || 'jsonl');
    const completed = items.filter((item) => item.success).length;
    const failed = items.filter((item) => !item.success).length;
    const avgDurationMs = items.length > 0
      ? Math.round(items.reduce((sum, item) => sum + item.durationMs, 0) / items.length)
      : 0;

    if (options.outputPath && options.approvalId) {
      const resolved = path.resolve(this.projectRoot, options.outputPath);
      if (!isInside(this.projectRoot, resolved)) {
        throw new Error('Batch runner output path must stay inside the Zavorth project root.');
      }
      const extension = (options.format || 'jsonl') === 'jsonl' ? '.jsonl' : '.json';
      const filePath = path.extname(resolved) ? resolved : `${resolved}${extension}`;
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, `${JSON.stringify({ runId, startedAt, finishedAt, items, summary: { total: items.length, completed, failed, avgDurationMs } }, null, 2)}\n`, 'utf8');
    }

    return {
      runId,
      startedAt,
      finishedAt,
      totalDurationMs,
      items,
      summary: { total: items.length, completed, failed, avgDurationMs },
      trajectory,
    };
  }

  public async exportBatchResults(
    outputPath: string,
    format: ZavorthTrajectoryExportFormat = 'jsonl',
    approvalId?: string,
  ): Promise<void> {
    if (!approvalId || !String(approvalId).trim()) {
      throw new Error('Batch results export requires an approval id.');
    }
    const resolved = path.resolve(this.projectRoot, outputPath);
    if (!isInside(this.projectRoot, resolved)) {
      throw new Error('Batch results output path must stay inside the Zavorth project root.');
    }
    const extension = format === 'jsonl' ? '.jsonl' : '.json';
    const filePath = path.extname(resolved) ? resolved : `${resolved}${extension}`;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify({ exportedAt: this.now().toISOString(), format }, null, 2)}\n`, 'utf8');
  }
}

function emptyTurn(
  runId: string,
  sessionId: string,
  options: BatchOptions,
  prompt: string,
): ZavorthTrajectoryCaptureTurn {
  return {
    turnId: '',
    runId,
    sessionId,
    userId: options.userId || 'batch-user',
    channel: options.channel || 'batch',
    timestamp: '',
    userMessage: prompt,
    assistantResponse: '',
    reasoning: '',
    toolCalls: [],
    approvals: [],
    status: 'completed',
    metadata: {},
  };
}

function defaultAgent(prompt: string, index: number): AgentResult {
  return {
    response: `Processed batch item ${index + 1}: ${prompt}`,
    reasoning: '',
    toolCalls: [],
    approvals: [],
    metadata: {},
  };
}

function normalizeConcurrency(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_CONCURRENCY;
  return Math.min(HARD_MAX_CONCURRENCY, Math.max(1, Math.floor(parsed)));
}

function cleanText(value: unknown): string {
  return redactSensitiveText(String(value || '')).replace(/\s+/g, ' ').trim();
}

function hash(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function isInside(root: string, candidate: string): boolean {
  const relativePath = path.relative(root, candidate);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}
