import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { config } from '../config/index.js';
import type { MnemosEventType, MnemosSessionEvent } from '../contracts/MnemosEventContract.js';
import type { WebRealtimeEvent, WebChatMessage } from './WebRealtimeService.js';
import { logger } from '../logger.js';


type MnemosFsRuntime = Pick<
  typeof fs,
  'existsSync' | 'readFileSync' | 'writeFileSync' | 'mkdirSync'
>;

export type ZavorthMnemosCompilerRuntime = Partial<MnemosFsRuntime> & {
  now?: () => Date;
};

export class ZavorthMnemosCompilerService {
  private readonly fsRuntime: MnemosFsRuntime;
  private readonly now: () => Date;

  constructor(runtime: ZavorthMnemosCompilerRuntime = {}) {
    this.fsRuntime = {
      existsSync: runtime.existsSync || fs.existsSync.bind(fs),
      readFileSync: runtime.readFileSync || fs.readFileSync.bind(fs),
      writeFileSync: runtime.writeFileSync || fs.writeFileSync.bind(fs),
      mkdirSync: runtime.mkdirSync || fs.mkdirSync.bind(fs),
    };
    this.now = runtime.now || (() => new Date());
  }

  public ingestEvent(workspaceRoot: string, sessionId: string, event: WebRealtimeEvent): MnemosSessionEvent | null {
    const root = this.resolveWorkspaceRoot(workspaceRoot);
    const type = event.type;
    if (type === 'ping') return null;

    const payload = this.extractPayload(event);
    if (!payload) return null;

    const sessionEvent: MnemosSessionEvent = {
      id: event.id || `acp-evt-${crypto.randomUUID()}`,
      timestamp: event.createdAt || this.now().toISOString(),
      sessionId,
      type,
      payload: this.sanitizePayload(payload),
    };

    this.persistEvent(root, sessionEvent);
    return sessionEvent;
  }

  public ingestSessionEvent(workspaceRoot: string, event: MnemosSessionEvent): MnemosSessionEvent {
    const root = this.resolveWorkspaceRoot(workspaceRoot);
    const sessionEvent: MnemosSessionEvent = {
      ...event,
      id: event.id || `mnemos-evt-${crypto.randomUUID()}`,
      timestamp: event.timestamp || this.now().toISOString(),
      sessionId: String(event.sessionId || 'default'),
      type: event.type as MnemosEventType,
      payload: this.sanitizePayload(event.payload || {}),
      source: event.source,
      trust: event.trust,
    };
    this.persistEvent(root, sessionEvent);
    return sessionEvent;
  }

  public readEvents(workspaceRoot: string): MnemosSessionEvent[] {
    const root = this.resolveWorkspaceRoot(workspaceRoot);
    const filePath = this.sessionEventsPath(root);
    if (!this.fsRuntime.existsSync(filePath)) {
      return [];
    }
    try {
      const parsed = JSON.parse(String(this.fsRuntime.readFileSync(filePath, 'utf8') || '{}'));
      return Array.isArray(parsed?.events) ? parsed.events as MnemosSessionEvent[] : [];
    } catch (error: unknown) {logger.warn('[Zavorth Mnemos Compiler] JSON parse failed', error); return []; }
  }

  public clearEvents(workspaceRoot: string): void {
    const root = this.resolveWorkspaceRoot(workspaceRoot);
    const filePath = this.sessionEventsPath(root);
    if (this.fsRuntime.existsSync(filePath)) {
      this.fsRuntime.writeFileSync(filePath, JSON.stringify({ version: 'mnemos-events/v1', events: [] }, null, 2), 'utf8');
    }
  }

  private extractPayload(event: WebRealtimeEvent): Record<string, any> | null {
    if (event.type === 'snapshot') {
      return {
        continuity: event.payload.continuity,
        tasksCount: event.payload.tasks.length,
        permissionsCount: event.payload.permissions.length,
        toolRunsCount: event.payload.toolRuns.length,
      };
    }
    if (event.type === 'message') {
      return {
        id: event.payload.id,
        role: event.payload.role,
        content: event.payload.content,
        taskId: event.payload.taskId,
        kind: event.payload.kind,
      };
    }
    if (event.type === 'task') {
      return {
        taskId: event.payload.task_id,
        commandType: event.payload.command_type,
        status: event.payload.status,
        resultSummary: event.payload.result_summary,
        errorSummary: event.payload.error_summary,
      };
    }
    if (event.type === 'tool') {
      return {
        runId: event.payload.runId,
        taskId: event.payload.taskId,
        toolName: event.payload.toolName,
        status: event.payload.status,
        filesTouched: event.payload.filesTouched,
      };
    }
    if (event.type === 'workflow') {
      return {
        workflowRunId: event.payload.workflow_run_id,
        workflowName: event.payload.workflow_name,
        objective: event.payload.objective,
        status: event.payload.status,
      };
    }
    if (event.type === 'permission') {
      return {
        permissionId: event.payload.permission_id,
        taskId: event.payload.task_id,
        kind: event.payload.kind,
        status: event.payload.status,
        reason: event.payload.reason,
        scope: event.payload.scope,
      };
    }
    if (event.type === 'agent-stream') {
      return {
        eventType: event.payload.eventType,
        sessionId: event.payload.sessionId,
        runId: event.payload.runId,
        phase: event.payload.phase,
        delta: event.payload.delta,
        accumulated: event.payload.accumulated,
        streamId: event.payload.streamId,
        streamStatus: event.payload.streamStatus,
        done: event.payload.done,
        summary: event.payload.summary,
        title: event.payload.title,
      };
    }
    return null;
  }

  private persistEvent(workspaceRoot: string, event: MnemosSessionEvent): void {
    const filePath = this.sessionEventsPath(workspaceRoot);
    const current = this.readEvents(workspaceRoot);
    this.fsRuntime.mkdirSync(path.dirname(filePath), { recursive: true });
    this.fsRuntime.writeFileSync(
      filePath,
      `${JSON.stringify({
        version: 'mnemos-events/v1',
        updatedAt: event.timestamp,
        events: [...current, event].slice(-1000),
      }, null, 2)}\n`,
      'utf8',
    );
  }

  private sanitizePayload<T>(value: T): T {
    if (value === null || value === undefined) return value;
    if (typeof value === 'string') {
      return redactSecrets(value) as unknown as T;
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizePayload(item)) as unknown as T;
    }
    if (typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        const sanitizedKey = redactSecrets(key);
        result[sanitizedKey] = this.sanitizePayload(val);
      }
      return result as unknown as T;
    }
    return value;
  }

  private sessionEventsPath(workspaceRoot: string): string {
    return path.join(workspaceRoot, '.zavorth', 'memory', 'session-events.json');
  }

  private resolveWorkspaceRoot(workspaceRoot: string): string {
    return path.resolve(String(workspaceRoot || '').trim() || config.projectRoot);
  }
}

function redactSecrets(value: string): string {
  return String(value || '')
    .replace(/\b(token|api[_ -]?key|secret|senha|password|chave)\s*[:=]\s*([^\s,;]+)/gi, '$1=[redacted-secret]')
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, '[redacted-secret]')
    .replace(/\bgh[pousr]_[A-Za-z0-9_]{8,}\b/g, '[redacted-secret]')
    .replace(/\bxox[baprs]-[A-Za-z0-9-]{8,}\b/g, '[redacted-secret]')
    .replace(/\bAIza[0-9A-Za-z_-]{16,}\b/g, '[redacted-secret]')
    .replace(/\b[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\b/g, '[redacted-secret]');
}
