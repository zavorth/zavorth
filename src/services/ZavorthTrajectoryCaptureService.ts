import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_TRAJECTORY_EXPORT_CONTRACT_VERSION,
  type ZavorthTrajectoryCaptureSnapshot,
  type ZavorthTrajectoryCaptureStats,
  type ZavorthTrajectoryCaptureTurn,
  type ZavorthTrajectoryExportFormat,
  type ZavorthTrajectoryToolStat,
} from '@zavorth/contracts/ZavorthTrajectoryExportContract.js';
import { redactSensitiveText } from '@zavorth/security/SensitiveDataGuard.js';

type Runtime = {
  projectRoot?: string;
  now?: () => Date;
};

const TRAJECTORIES_DIR = '.zavorth/trajectories';
const MAX_TURNS = 5_000;

export class ZavorthTrajectoryCaptureService {
  private readonly projectRoot: string;
  private readonly now: () => Date;
  private readonly turns: ZavorthTrajectoryCaptureTurn[] = [];

  public constructor(runtime: Runtime = {}) {
    this.projectRoot = path.resolve(runtime.projectRoot || process.cwd());
    this.now = runtime.now || (() => new Date());
  }

  public captureTurn(turn: ZavorthTrajectoryCaptureTurn): void {
    if (this.turns.length >= MAX_TURNS) return;
    this.turns.push({
      ...turn,
      turnId: safe(turn.turnId) || `turn-${hash(this.now().toISOString())}`,
      runId: safe(turn.runId),
      sessionId: safe(turn.sessionId),
      userId: safe(turn.userId),
      channel: safe(turn.channel),
      timestamp: turn.timestamp || this.now().toISOString(),
      userMessage: safeText(turn.userMessage),
      assistantResponse: safeText(turn.assistantResponse),
      reasoning: safeText(turn.reasoning),
      toolCalls: (turn.toolCalls || []).map((tc) => ({
        name: safe(tc.name),
        args: safeText(tc.args),
        result: safeText(tc.result),
        success: Boolean(tc.success),
        durationMs: Number(tc.durationMs) || 0,
      })),
      approvals: (turn.approvals || []).map(safe).filter(Boolean),
      status: turn.status || 'completed',
      metadata: turn.metadata || {},
    });
  }

  public buildSnapshot(format: ZavorthTrajectoryExportFormat = 'jsonl'): ZavorthTrajectoryCaptureSnapshot {
    return {
      contractVersion: ZAVORTH_TRAJECTORY_EXPORT_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      source: 'ZavorthTrajectoryCaptureService',
      turns: this.turns.slice(),
      stats: this.getStats(),
      format,
      outputPath: null,
      safety: {
        requiresApprovalForWrite: true,
        noRawSecretsSerialized: true,
        sourceContentRedacted: true,
      },
    };
  }

  public exportToFile(
    outputPath: string,
    format: ZavorthTrajectoryExportFormat = 'jsonl',
    approvalId?: string,
  ): ZavorthTrajectoryCaptureSnapshot {
    if (!approvalId || !String(approvalId).trim()) {
      throw new Error('Trajectory capture export requires an approval id.');
    }
    const resolved = path.resolve(this.projectRoot, outputPath);
    if (!isInside(this.projectRoot, resolved)) {
      throw new Error('Trajectory capture output path must stay inside the Zavorth project root.');
    }
    const extension = format === 'jsonl' ? '.jsonl' : '.json';
    const filePath = path.extname(resolved) ? resolved : `${resolved}${extension}`;
    const snapshot = this.buildSnapshot(format);

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const content = renderCapture(format, snapshot);
    fs.writeFileSync(filePath, `${content}\n`, 'utf8');

    return { ...snapshot, outputPath: relative(this.projectRoot, filePath) };
  }

  public getStats(): ZavorthTrajectoryCaptureStats {
    const turns = this.turns;
    const turnsWithReasoning = turns.filter((t) => Boolean(t.reasoning)).length;
    const totalToolCalls = turns.reduce((sum, t) => sum + t.toolCalls.length, 0);
    const approvalCount = turns.filter((t) => t.approvals.length > 0).length;
    const toolMap = new Map<string, { count: number; success: number; failure: number; totalDuration: number }>();

    for (const turn of turns) {
      for (const tc of turn.toolCalls) {
        const existing = toolMap.get(tc.name) || { count: 0, success: 0, failure: 0, totalDuration: 0 };
        existing.count += 1;
        if (tc.success) existing.success += 1;
        else existing.failure += 1;
        existing.totalDuration += tc.durationMs;
        toolMap.set(tc.name, existing);
      }
    }

    const toolStats: ZavorthTrajectoryToolStat[] = [];
    for (const [toolName, data] of toolMap) {
      toolStats.push({
        toolName,
        count: data.count,
        success: data.success,
        failure: data.failure,
        avgDurationMs: data.count > 0 ? Math.round(data.totalDuration / data.count) : 0,
      });
    }
    toolStats.sort((left, right) => right.count - left.count);

    const firstTimestamp = turns.length > 0 ? new Date(turns[0]!.timestamp).getTime() : 0;
    const lastTimestamp = turns.length > 0 ? new Date(turns[turns.length - 1]!.timestamp).getTime() : 0;
    const totalDurationMs = firstTimestamp && lastTimestamp ? lastTimestamp - firstTimestamp : 0;

    return {
      totalTurns: turns.length,
      turnsWithReasoning,
      reasoningCoverage: turns.length > 0 ? Math.round((turnsWithReasoning / turns.length) * 100) / 100 : 0,
      toolStats,
      avgToolsPerTurn: turns.length > 0 ? Math.round((totalToolCalls / turns.length) * 100) / 100 : 0,
      approvalRate: turns.length > 0 ? Math.round((approvalCount / turns.length) * 100) / 100 : 0,
      totalDurationMs,
    };
  }

  public getTurns(): ZavorthTrajectoryCaptureTurn[] {
    return this.turns.slice();
  }

  public clear(): void {
    this.turns.length = 0;
  }

  public persistToProjectDir(format: ZavorthTrajectoryExportFormat = 'jsonl'): string | null {
    if (this.turns.length === 0) return null;
    const dir = path.join(this.projectRoot, TRAJECTORIES_DIR);
    fs.mkdirSync(dir, { recursive: true });
    const filename = `trajectory-${this.now().toISOString().replace(/[:.]/g, '-')}.${format === 'jsonl' ? 'jsonl' : 'json'}`;
    const filePath = path.join(dir, filename);
    const snapshot = this.buildSnapshot(format);
    const content = renderCapture(format, snapshot);
    fs.writeFileSync(filePath, `${content}\n`, 'utf8');
    return relative(this.projectRoot, filePath);
  }
}

function renderCapture(format: ZavorthTrajectoryExportFormat, snapshot: ZavorthTrajectoryCaptureSnapshot): string {
  if (format === 'jsonl') {
    return snapshot.turns.map((turn) => JSON.stringify({
      turnId: turn.turnId,
      runId: turn.runId,
      sessionId: turn.sessionId,
      userId: turn.userId,
      channel: turn.channel,
      timestamp: turn.timestamp,
      conversations: [
        { from: 'human', value: turn.userMessage },
        { from: 'gpt', value: turn.assistantResponse },
      ],
      reasoning: turn.reasoning || undefined,
      toolCalls: turn.toolCalls.length > 0 ? turn.toolCalls : undefined,
      approvals: turn.approvals.length > 0 ? turn.approvals : undefined,
      status: turn.status,
      metadata: turn.metadata,
    })).join('\n');
  }
  if (format === 'sharegpt') {
    return JSON.stringify(snapshot.turns.map((turn) => ({
      id: turn.turnId,
      conversations: [
        { from: 'human', value: turn.userMessage },
        { from: 'gpt', value: turn.assistantResponse },
      ],
      metadata: { ...turn.metadata, reasoning: turn.reasoning, toolCalls: turn.toolCalls },
    })), null, 2);
  }
  return JSON.stringify(snapshot.turns.map((turn) => ({
    instruction: turn.userMessage,
    input: turn.reasoning || '',
    output: turn.assistantResponse,
    metadata: { ...turn.metadata, turnId: turn.turnId, toolCalls: turn.toolCalls },
  })), null, 2);
}

function safe(value: string): string {
  return redactSensitiveText(String(value || '')).replace(/\s+/g, ' ').trim();
}

function safeText(value: string): string {
  return redactSensitiveText(String(value || '')).trim();
}

function hash(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function isInside(root: string, candidate: string): boolean {
  const relativePath = path.relative(root, candidate);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

function relative(root: string, candidate: string): string {
  return path.relative(root, candidate).replace(/\\/g, '/') || '.';
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
