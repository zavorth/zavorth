import { asErrorLike } from '../utils/errorLike';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { config } from '../config/index.js';
import { logger } from '../logger.js';

type CodexRemotePowerShellBrokerRuntime = {
  now?: () => Date;
  setTimeoutImpl?: typeof setTimeout;
  clearTimeoutImpl?: typeof clearTimeout;
};

type BrokerRequestEnvelope = {
  requestId: string;
  action: 'probe' | 'start-session' | 'inspect-session' | 'stop-session';
  createdAt: string;
  payload: Record<string, unknown>;
};

type BrokerResponseEnvelope<T> = {
  requestId: string;
  action: string;
  ok: boolean;
  handledAt: string;
  data?: T;
  error?: string | null;
};

export type CodexRemotePowerShellBrokerProbeResult = {
  available: boolean;
  brokerReady: boolean;
  version: string | null;
  note: string | null;
};

export type CodexRemotePowerShellBrokerStartResult = {
  pid: number | null;
  startedAt: string;
  statusFilePath: string;
};

export type CodexRemotePowerShellBrokerInspectResult = {
  alive: boolean;
  pid: number | null;
  state: 'running' | 'completed' | 'failed' | 'stopped' | 'lost';
  startedAt: string | null;
  finishedAt: string | null;
  lastHeartbeatAt: string | null;
  lastOutput: string | null;
  lastError: string | null;
  exitCode: number | null;
};

export type CodexRemotePowerShellBrokerStopResult = {
  stopped: boolean;
  pid: number | null;
  state: 'stopped';
  finishedAt: string;
  lastError: string | null;
  lastOutput: string | null;
  exitCode: number | null;
};

export class CodexRemotePowerShellBrokerClientService {
  private readonly now: () => Date;
  private readonly setTimeoutImpl: typeof setTimeout;
  private readonly clearTimeoutImpl: typeof clearTimeout;
  private readonly brokerRoot: string;
  private readonly requestsDir: string;
  private readonly responsesDir: string;
  private readonly lockFilePath: string;

  constructor(runtime: CodexRemotePowerShellBrokerRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.setTimeoutImpl = runtime.setTimeoutImpl || setTimeout;
    this.clearTimeoutImpl = runtime.clearTimeoutImpl || clearTimeout;
    this.brokerRoot = path.join(config.dataDir, 'runtime', 'codex-remote-broker');
    this.requestsDir = path.join(this.brokerRoot, 'requests');
    this.responsesDir = path.join(this.brokerRoot, 'responses');
    this.lockFilePath = path.join(this.brokerRoot, 'codex-remote-broker.lock.json');
  }

  public async probe(input: {
    codexCliPath: string;
    codexHome?: string | null;
    workspaceRoot?: string | null;
  }): Promise<CodexRemotePowerShellBrokerProbeResult> {
    const brokerState = this.readBrokerLockState();
    if (!brokerState.running) {
      return {
        available: false,
        brokerReady: false,
        version: null,
        note: brokerState.note,
      };
    }

    try {
      return await this.request('probe', {
        codexCliPath: String(input.codexCliPath || '').trim(),
        codexHome: String(input.codexHome || '').trim() || null,
        workspaceRoot: String(input.workspaceRoot || '').trim() || null,
      }, 10000);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const message = error instanceof Error ? err.message : String(error);
      return {
        available: false,
        brokerReady: false,
        version: null,
        note: message || 'Failure ao consultar o broker PowerShell do Codex Remote.',
      };
    }
  }

  public async startSession(input: {
    sessionId: string;
    codexCliPath: string;
    codexHome?: string | null;
    workspaceRoot: string;
    prompt: string;
    sandbox: string;
    logFilePath: string;
    outputFilePath: string;
    statusFilePath: string;
    maxRuntimeSeconds?: number | null;
  }): Promise<CodexRemotePowerShellBrokerStartResult> {
    this.assertBrokerReady();
    return this.request('start-session', {
      sessionId: String(input.sessionId || '').trim(),
      codexCliPath: String(input.codexCliPath || '').trim(),
      codexHome: String(input.codexHome || '').trim() || null,
      workspaceRoot: String(input.workspaceRoot || '').trim(),
      prompt: String(input.prompt || '').trim(),
      sandbox: String(input.sandbox || '').trim() || 'workspace-write',
      logFilePath: String(input.logFilePath || '').trim(),
      outputFilePath: String(input.outputFilePath || '').trim(),
      statusFilePath: String(input.statusFilePath || '').trim(),
      maxRuntimeSeconds:
        typeof input.maxRuntimeSeconds === 'number' && Number.isFinite(input.maxRuntimeSeconds)
          ? Math.max(1, Math.trunc(input.maxRuntimeSeconds))
          : null,
    }, 15000);
  }

  public async inspectSession(input: {
    sessionId: string;
    pid?: number | null;
    statusFilePath: string;
  }): Promise<CodexRemotePowerShellBrokerInspectResult> {
    this.assertBrokerReady();
    return this.request('inspect-session', {
      sessionId: String(input.sessionId || '').trim(),
      pid:
        typeof input.pid === 'number' && Number.isFinite(input.pid)
          ? Math.trunc(input.pid)
          : null,
      statusFilePath: String(input.statusFilePath || '').trim(),
    }, 10000);
  }

  public async stopSession(input: {
    sessionId: string;
    pid?: number | null;
    statusFilePath: string;
    reason?: string | null;
  }): Promise<CodexRemotePowerShellBrokerStopResult> {
    this.assertBrokerReady();
    return this.request('stop-session', {
      sessionId: String(input.sessionId || '').trim(),
      pid:
        typeof input.pid === 'number' && Number.isFinite(input.pid)
          ? Math.trunc(input.pid)
          : null,
      statusFilePath: String(input.statusFilePath || '').trim(),
      reason: String(input.reason || '').trim() || null,
    }, 10000);
  }

  public brokerLockExists(): boolean {
    return fs.existsSync(this.lockFilePath);
  }

  private assertBrokerReady(): void {
    const brokerState = this.readBrokerLockState();
    if (!brokerState.running) {
      throw new Error(brokerState.note);
    }
  }

  private readBrokerLockState(): {
    running: boolean;
    pid: number | null;
    note: string;
  } {
    if (!fs.existsSync(this.lockFilePath)) {
      return {
        running: false,
        pid: null,
        note: 'Codex Remote PowerShell broker is not running yet. Start the supervised launcher to enable the remote broker.',
      };
    }

    try {
      const raw = fs.readFileSync(this.lockFilePath, 'utf8');
      const parsed = JSON.parse(raw) as { pid?: unknown };
      const pid = typeof parsed.pid === 'number' && Number.isFinite(parsed.pid)
        ? Math.trunc(parsed.pid)
        : null;
      if (!pid || pid <= 0) {
        return {
          running: false,
          pid: null,
          note: 'The Codex Remote PowerShell broker lock is invalid. Restart the supervised launcher.',
        };
      }

      try {
        process.kill(pid, 0);
        return {
          running: true,
          pid,
          note: 'Broker PowerShell active.',
        };
      } catch (error: unknown) {logger.warn('[Codex Remote Power Shell Broker Client] validation failed', error);
    return {
          running: false,
          pid,
          note: 'The Codex Remote PowerShell broker became stale. Restart the supervised launcher.',
        };
  }
    } catch (error: unknown) {logger.warn('[Codex Remote Power Shell Broker Client] operation failed', error);
    return {
        running: false,
        pid: null,
        note: 'Could not read the Codex Remote PowerShell broker lock. Restart the supervised launcher.',
      };
  }
  }

  private async request<T>(
    action: BrokerRequestEnvelope['action'],
    payload: Record<string, unknown>,
    timeoutMs: number,
  ): Promise<T> {
    await this.ensureDirectories();
    const requestId = `codex-broker-${randomUUID()}`;
    const requestPath = path.join(this.requestsDir, `${requestId}.json`);
    const requestTempPath = path.join(this.requestsDir, `${requestId}.tmp.json`);
    const responsePath = path.join(this.responsesDir, `${requestId}.json`);
    const envelope: BrokerRequestEnvelope = {
      requestId,
      action,
      createdAt: this.now().toISOString(),
      payload,
    };
    await fs.promises.writeFile(requestTempPath, JSON.stringify(envelope, null, 2), 'utf8');
    await fs.promises.rename(requestTempPath, requestPath);

    try {
      const response = await this.waitForResponse<T>(responsePath, timeoutMs);
      if (!response.ok) {
        throw new Error(String(response.error || 'Failure no broker PowerShell do Codex Remote.'));
      }
      return response.data as T;
    } finally {
      await fs.promises.rm(requestTempPath, { force: true }).catch(() => undefined);
      await fs.promises.rm(requestPath, { force: true }).catch(() => undefined);
      await fs.promises.rm(responsePath, { force: true }).catch(() => undefined);
    }
  }

  private async waitForResponse<T>(
    responsePath: string,
    timeoutMs: number,
  ): Promise<BrokerResponseEnvelope<T>> {
    const deadline = this.now().getTime() + timeoutMs;

    while (this.now().getTime() < deadline) {
      try {
        const raw = await fs.promises.readFile(responsePath, 'utf8');
        return JSON.parse(raw) as BrokerResponseEnvelope<T>;
      } catch (error: unknown) {
        const err = asErrorLike(error);
        logger.warn("[auto-fix] Empty catch block", err); }
      await this.sleep(250);
    }

    throw new Error(
      'Codex Remote PowerShell broker did not respond in time. Start the supervised launcher or remote broker.',
    );
  }

  private async ensureDirectories(): Promise<void> {
    await fs.promises.mkdir(this.requestsDir, { recursive: true });
    await fs.promises.mkdir(this.responsesDir, { recursive: true });
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise<void>((resolve) => {
      const timer = this.setTimeoutImpl(() => {
        this.clearTimeoutImpl(timer);
        resolve();
      }, ms);
    });
  }
}
