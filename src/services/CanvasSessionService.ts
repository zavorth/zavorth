import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  CanvasAttemptSnapshot,
  CanvasEgressEvent,
  CanvasFileSnapshot,
  CanvasPreviewDiagnostics,
  CanvasSessionSnapshot,
  ExecutionEngineId,
} from '../contracts/ExecutionEngineContract';
import { CanvasPreviewServer } from './CanvasPreviewServer';
import { GlassBoxTraceService } from './GlassBoxTraceService';
import { logger } from '../logger.js';
import type {
ZavorthSpeculativeAttempt,
  ZavorthSpeculativeAutonomyResult,
} from './ZavorthSpeculativeAutonomyService';

export type CanvasSessionCreateInput = {
  engineId?: ExecutionEngineId;
  sandboxRunId?: string | null;
  files?: CanvasFileSnapshot[];
  diffs?: string[];
  logs?: string[];
  summary?: string;
};

export type CanvasAttemptCreateInput = {
  sessionId: string;
  sandboxRunId?: string | null;
  files?: CanvasFileSnapshot[];
  diffs?: string[];
  logs?: string[];
  summary?: string;
  status?: CanvasAttemptSnapshot['status'];
};

function defaultFiles(): CanvasFileSnapshot[] {
  return [{
    path: 'index.html',
    mimeType: 'text/html',
    content: `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Z-Canvas</title></head>
<body style="margin:0;font-family:system-ui;background:#07140f;color:#effaf3;display:grid;place-items:center;min-height:100vh">
  <main style="max-width:640px;padding:32px;text-align:center">
    <p style="color:#00e88f;text-transform:uppercase;letter-spacing:.12em;font-size:12px">Sandbox preview</p>
    <h1>Z-Canvas is ready</h1>
    <p>Sandbox attempts, diffs and logs appear here before anything can touch the host workspace.</p>
  </main>
</body>
</html>`,
  }];
}

function mimeForSnapshot(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.html' || extension === '.htm') return 'text/html';
  if (extension === '.css') return 'text/css';
  if (extension === '.js' || extension === '.mjs') return 'text/javascript';
  if (extension === '.json') return 'application/json';
  if (extension === '.svg') return 'image/svg+xml';
  if (extension === '.md') return 'text/markdown';
  return 'text/plain';
}

const SENSITIVE_CANVAS_FILE_PATTERN = /(^|\/)(\.env(?:\.|$)|\.ssh|\.aws|\.gnupg|secrets?|credentials?|private[-_]?key|id_rsa|id_ed25519)(\/|$)/i;

function isInside(parent: string, child: string): boolean {
  const resolvedParent = path.resolve(parent);
  const resolvedChild = path.resolve(child);
  const comparableParent = process.platform === 'win32' ? resolvedParent.toLowerCase() : resolvedParent;
  const comparableChild = process.platform === 'win32' ? resolvedChild.toLowerCase() : resolvedChild;
  const relative = path.relative(comparableParent, comparableChild);
  return relative === '' || (!!relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

function statusFromSpeculative(status: ZavorthSpeculativeAttempt['status']): CanvasAttemptSnapshot['status'] {
  if (status === 'needs_correction') return 'needs-correction';
  return status;
}

export class CanvasSessionService {
  private readonly sessions = new Map<string, CanvasSessionSnapshot>();

  public constructor(
    private readonly previewServer: CanvasPreviewServer,
    private readonly trace: GlassBoxTraceService,
  ) {}

  public list(): CanvasSessionSnapshot[] {
    return Array.from(this.sessions.values());
  }

  public async getOrCreate(sessionId?: string | null): Promise<CanvasSessionSnapshot> {
    if (sessionId && this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId) as CanvasSessionSnapshot;
    }
    const latest = this.list()
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0];
    if (latest) return latest;
    return this.create({ engineId: 'lite' });
  }

  public async create(input: CanvasSessionCreateInput = {}): Promise<CanvasSessionSnapshot> {
    const sessionId = `canvas:${randomUUID()}`;
    const now = new Date().toISOString();
    const attempt = this.createAttemptSnapshot({
      round: 1,
      sandboxRunId: input.sandboxRunId ?? null,
      files: input.files && input.files.length > 0 ? input.files : defaultFiles(),
      diffs: input.diffs ?? [],
      logs: input.logs ?? ['Canvas session created.'],
      summary: input.summary ?? 'Initial sandbox preview',
      status: 'ready',
    });

    const snapshot: CanvasSessionSnapshot = {
      sessionId,
      engineId: input.engineId ?? 'lite',
      sandboxRunId: input.sandboxRunId ?? null,
      attempts: [attempt],
      activeAttemptId: attempt.id,
      files: attempt.files,
      diffs: attempt.diffs,
      logs: attempt.logs,
      previewUrl: null,
      egressEvents: [],
      createdAt: now,
      updatedAt: now,
    };
    this.sessions.set(sessionId, snapshot);
    await this.refreshPreview(snapshot);
    this.trace.append({
      kind: 'canvas',
      title: 'Canvas session created',
      detail: `${snapshot.engineId} canvas session is ready with one sandbox attempt.`,
      engineId: snapshot.engineId,
      status: 'success',
      metadata: { sessionId },
    });
    return snapshot;
  }

  public async createFromSpeculativeAutonomyResult(
    result: ZavorthSpeculativeAutonomyResult,
    engineId: ExecutionEngineId = 'shield',
  ): Promise<CanvasSessionSnapshot> {
    const sessionId = `canvas:${randomUUID()}`;
    const now = new Date().toISOString();
    const attempts = result.attempts.length > 0
      ? result.attempts.map((attempt) => this.createAttemptSnapshot({
        id: `attempt:${attempt.id}`,
        round: attempt.round,
        sandboxRunId: result.id,
        sandboxWorkspace: attempt.sandboxWorkspace,
        files: this.isAttemptWorkspaceAllowed(result, attempt.sandboxWorkspace)
          ? this.readAttemptFiles(attempt)
          : defaultFiles(),
        diffs: attempt.diffText ? [attempt.diffText] : [],
        logs: this.isAttemptWorkspaceAllowed(result, attempt.sandboxWorkspace)
          ? this.renderAttemptLogs(attempt)
          : [`Sandbox workspace was outside the recorded run root and was not exposed: ${attempt.id}`],
        summary: attempt.summary || `Sandbox attempt ${attempt.round}`,
        status: statusFromSpeculative(attempt.status),
      }))
      : [this.createAttemptSnapshot({
        round: 1,
        sandboxRunId: result.id,
        sandboxWorkspace: result.runRoot,
        files: defaultFiles(),
        diffs: [],
        logs: [result.summary],
        summary: result.summary || 'Speculative sandbox prepared',
        status: statusFromSpeculative(result.status),
      })];

    const finalAttemptId = result.finalAttempt
      ? `attempt:${result.finalAttempt.id}`
      : attempts[attempts.length - 1]?.id ?? null;
    const activeAttemptId = attempts.some((attempt) => attempt.id === finalAttemptId)
      ? finalAttemptId
      : attempts[0]?.id ?? null;
    const active = attempts.find((attempt) => attempt.id === activeAttemptId) ?? attempts[0];
    const snapshot: CanvasSessionSnapshot = {
      sessionId,
      engineId,
      sandboxRunId: result.id,
      attempts,
      activeAttemptId,
      files: active?.files ?? defaultFiles(),
      diffs: active?.diffs ?? [],
      logs: active?.logs ?? [result.summary],
      previewUrl: null,
      egressEvents: [],
      createdAt: now,
      updatedAt: now,
    };
    this.sessions.set(sessionId, snapshot);
    await this.refreshPreview(snapshot);
    this.trace.append({
      kind: 'canvas',
      title: 'Speculative sandbox synced to Canvas',
      detail: `${attempts.length} sandbox attempt${attempts.length === 1 ? '' : 's'} are available in Z-Canvas.`,
      engineId,
      status: result.status === 'approved' ? 'success' : (result.status === 'blocked' ? 'blocked' : 'warning'),
      metadata: {
        sessionId,
        sandboxRunId: result.id,
        status: result.status,
        attemptCount: attempts.length,
      },
    });
    return snapshot;
  }

  public async addAttempt(input: CanvasAttemptCreateInput): Promise<CanvasSessionSnapshot | null> {
    const session = this.sessions.get(input.sessionId);
    if (!session) return null;
    const attempt = this.createAttemptSnapshot({
      round: session.attempts.length + 1,
      sandboxRunId: input.sandboxRunId ?? session.sandboxRunId,
      files: input.files && input.files.length > 0 ? input.files : defaultFiles(),
      diffs: input.diffs ?? [],
      logs: input.logs ?? ['Sandbox attempt recorded.'],
      summary: input.summary ?? `Sandbox attempt ${session.attempts.length + 1}`,
      status: input.status ?? 'ready',
    });
    session.attempts.push(attempt);
    session.activeAttemptId = attempt.id;
    session.sandboxRunId = input.sandboxRunId ?? session.sandboxRunId;
    session.updatedAt = new Date().toISOString();
    await this.refreshPreview(session);
    return session;
  }

  public async selectAttempt(sessionId: string, attemptId: string): Promise<CanvasSessionSnapshot | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    const attempt = session.attempts.find((candidate) => candidate.id === attemptId);
    if (!attempt) return null;
    session.activeAttemptId = attempt.id;
    session.updatedAt = new Date().toISOString();
    await this.refreshPreview(session);
    this.trace.append({
      kind: 'canvas',
      title: 'Canvas attempt selected',
      detail: `Attempt ${attempt.round} is now active.`,
      engineId: session.engineId,
      status: 'info',
      metadata: { sessionId, attemptId },
    });
    return session;
  }

  public recordEgress(sessionId: string, event: CanvasEgressEvent): CanvasSessionSnapshot | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    session.egressEvents.unshift(event);
    session.updatedAt = new Date().toISOString();
    this.trace.append({
      kind: 'egress-blocked',
      title: 'Canvas egress blocked',
      detail: event.reason,
      engineId: session.engineId,
      status: 'blocked',
      metadata: { sessionId, url: event.url },
    });
    return session;
  }

  public diagnostics(): {
    sessions: number;
    preview: CanvasPreviewDiagnostics;
  } {
    return {
      sessions: this.sessions.size,
      preview: this.previewServer.getDiagnostics(),
    };
  }

  private createAttemptSnapshot(input: {
    id?: string;
    round: number;
    sandboxRunId: string | null;
    sandboxWorkspace?: string | null;
    files: CanvasFileSnapshot[];
    diffs: string[];
    logs: string[];
    summary: string;
    status: CanvasAttemptSnapshot['status'];
  }): CanvasAttemptSnapshot {
    return {
      id: input.id ?? `attempt:${randomUUID()}`,
      round: input.round,
      status: input.status,
      summary: input.summary,
      sandboxWorkspace: input.sandboxWorkspace ?? (input.sandboxRunId ? `sandbox:${input.sandboxRunId}` : null),
      files: input.files,
      diffs: input.diffs,
      logs: input.logs,
      previewUrl: null,
      createdAt: new Date().toISOString(),
    };
  }

  private async refreshPreview(session: CanvasSessionSnapshot): Promise<void> {
    const active = session.attempts.find((attempt) => attempt.id === session.activeAttemptId) ?? session.attempts[0];
    if (!active) return;
    session.files = active.files;
    session.diffs = active.diffs;
    session.logs = active.logs;
    session.previewUrl = await this.previewServer.registerSession(session);
    active.previewUrl = this.previewServer.getAttemptUrl(session.sessionId, active.id);
  }

  private readAttemptFiles(attempt: ZavorthSpeculativeAttempt): CanvasFileSnapshot[] {
    const sandboxRoot = path.resolve(attempt.sandboxWorkspace);
    const files: CanvasFileSnapshot[] = [];
    for (const touchedFile of attempt.touchedFiles.slice(0, 32)) {
      const relativePath = String(touchedFile || '').replace(/\\/g, '/').replace(/^\/+/, '');
      if (!relativePath || relativePath.includes('..')) continue;
      if (SENSITIVE_CANVAS_FILE_PATTERN.test(relativePath)) continue;
      const absolutePath = path.resolve(sandboxRoot, relativePath);
      if (!isInside(sandboxRoot, absolutePath)) continue;
      try {
        const stats = fs.statSync(absolutePath);
        if (!stats.isFile() || stats.size > 256 * 1024) continue;
        files.push({
          path: relativePath,
          content: fs.readFileSync(absolutePath, 'utf8'),
          mimeType: mimeForSnapshot(relativePath),
        });
      } catch (error: unknown) {// The sandbox may report a touched file that was removed by a failed attempt.
      logger.warn('[Canvas Session] filesystem operation failed', error);
    }
    }
    return files.length > 0 ? files : defaultFiles();
  }

  private isAttemptWorkspaceAllowed(
    result: ZavorthSpeculativeAutonomyResult,
    sandboxWorkspace: string,
  ): boolean {
    const runRoot = path.resolve(result.runRoot || result.workspaceRoot);
    const sandboxRoot = path.resolve(sandboxWorkspace);
    return isInside(runRoot, sandboxRoot);
  }

  private renderAttemptLogs(attempt: ZavorthSpeculativeAttempt): string[] {
    const logs = [
      attempt.summary,
      ...attempt.validationResults.map((result) => {
        const detail = result.stderr || result.stdout || `exit ${result.exitCode ?? 'n/a'}`;
        return `${result.status}: ${result.command} (${result.durationMs}ms) ${detail}`.slice(0, 600);
      }),
      ...attempt.blockedReasons.map((reason) => `blocked: ${reason}`),
      ...attempt.critic.findings.map((finding) => `${finding.severity}: ${finding.summary}`),
    ].filter((value) => String(value || '').trim());
    return logs.length > 0 ? logs : ['Sandbox attempt recorded.'];
  }
}
