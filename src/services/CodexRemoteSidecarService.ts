import { spawnCommand } from '../core/CommandSpawn.js';
import { CodexRemoteProfileRegistryService } from './CodexRemoteProfileRegistryService.js';
import { CodexRemoteNotificationService } from './CodexRemoteNotificationService.js';
import {
  CodexRemotePowerShellBrokerClientService,
  type CodexRemotePowerShellBrokerInspectResult,
} from './CodexRemotePowerShellBrokerClientService.js';
import {
  CodexRemoteSessionStoreService,
  type CodexRemoteSessionRecord,
} from './CodexRemoteSessionStoreService.js';
import {
  CodexRemoteSidecarMetadataSupport,
  type CodexRemoteRuntimeGuardrailMetadata,
  type CodexRemoteRuntimePresenceMetadata,
} from './codex-remote-sidecar/CodexRemoteSidecarMetadataSupport.js';
import { CodexRemoteSidecarProcessSupport } from './codex-remote-sidecar/CodexRemoteSidecarProcessSupport.js';
import { CodexRemoteSidecarStartSupport } from './codex-remote-sidecar/CodexRemoteSidecarStartSupport.js';
import { CodexRemoteSidecarTerminalSupport } from './codex-remote-sidecar/CodexRemoteSidecarTerminalSupport.js';

type SpawnCommandLike = typeof spawnCommand;

type CodexRemoteSidecarRuntime = {
  now?: () => Date;
  profileRegistryService?: Pick<CodexRemoteProfileRegistryService, 'resolveExecutionProfile'>;
  notificationService?: Pick<CodexRemoteNotificationService, 'notifySessionEvent'>;
  sessionStoreService?: Pick<
    CodexRemoteSessionStoreService,
    'getSession' | 'updateSession' | 'appendEvent'
  >;
  powerShellBrokerClient?: Pick<
    CodexRemotePowerShellBrokerClientService,
    'startSession' | 'inspectSession' | 'stopSession'
  >;
  spawnCommand?: SpawnCommandLike;
  setIntervalImpl?: typeof setInterval;
  clearIntervalImpl?: typeof clearInterval;
  usePowerShellBroker?: boolean;
};

export type CodexRemoteSessionTailSnapshot = {
  sessionId: string;
  status: string;
  logLines: string[];
  lastOutput: string | null;
  lastError: string | null;
};

export class CodexRemoteSidecarService {
  private readonly now: () => Date;
  private readonly profiles: Pick<CodexRemoteProfileRegistryService, 'resolveExecutionProfile'>;
  private readonly notificationService: Pick<CodexRemoteNotificationService, 'notifySessionEvent'>;
  private readonly sessions: Pick<
    CodexRemoteSessionStoreService,
    'getSession' | 'updateSession' | 'appendEvent'
  >;
  private readonly powerShellBroker: Pick<
    CodexRemotePowerShellBrokerClientService,
    'startSession' | 'inspectSession' | 'stopSession'
  >;
  private readonly spawn: SpawnCommandLike;
  private readonly setIntervalImpl: typeof setInterval;
  private readonly clearIntervalImpl: typeof clearInterval;
  private readonly usePowerShellBroker: boolean;
  private readonly metadata: CodexRemoteSidecarMetadataSupport;
  private readonly processSupport: CodexRemoteSidecarProcessSupport;
  private readonly startSupport: CodexRemoteSidecarStartSupport;
  private readonly terminalSupport: CodexRemoteSidecarTerminalSupport;

  constructor(runtime: CodexRemoteSidecarRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.profiles = runtime.profileRegistryService || new CodexRemoteProfileRegistryService();
    this.notificationService = runtime.notificationService || new CodexRemoteNotificationService();
    this.sessions = runtime.sessionStoreService || new CodexRemoteSessionStoreService();
    this.powerShellBroker = runtime.powerShellBrokerClient || new CodexRemotePowerShellBrokerClientService();
    this.spawn = runtime.spawnCommand || spawnCommand;
    this.setIntervalImpl = runtime.setIntervalImpl || setInterval;
    this.clearIntervalImpl = runtime.clearIntervalImpl || clearInterval;
    this.metadata = new CodexRemoteSidecarMetadataSupport(this.now);
    this.processSupport = new CodexRemoteSidecarProcessSupport({
      now: this.now,
      sessions: this.sessions,
      buildPresenceMetadata: (session, observedAt, stateOverride) =>
        this.buildPresenceMetadata(session, observedAt, stateOverride),
      buildGuardrailMetadata: (session, observedAt, stateOverride, presenceOverride) =>
        this.buildGuardrailMetadata(session, observedAt, stateOverride, presenceOverride),
      setIntervalImpl: this.setIntervalImpl,
      clearIntervalImpl: this.clearIntervalImpl,
    });
    this.terminalSupport = new CodexRemoteSidecarTerminalSupport();
    this.usePowerShellBroker =
      typeof runtime.usePowerShellBroker === 'boolean'
        ? runtime.usePowerShellBroker
        : process.platform === 'win32';
    this.startSupport = new CodexRemoteSidecarStartSupport({
      now: this.now,
      profiles: this.profiles,
      notificationService: this.notificationService,
      sessions: this.sessions,
      powerShellBroker: this.powerShellBroker,
      spawn: this.spawn,
      metadata: this.metadata,
      processSupport: this.processSupport,
      terminalSupport: this.terminalSupport,
      requireSession: (sessionId) => this.requireSession(sessionId),
      shouldUsePowerShellBroker: () => this.shouldUsePowerShellBroker(),
    });
  }

  public async startSession(input: {
    sessionId: string;
    prompt?: string | null;
    requestedBy?: string | null;
  }): Promise<CodexRemoteSessionRecord> {
    return this.startSupport.startSession(input);
  }

  public async stopSession(sessionId: string): Promise<CodexRemoteSessionRecord> {
    const current = this.requireSession(sessionId);
    if (current.status !== 'running') {
      return current;
    }

    const brokerStatusFilePath = this.readBrokerStatusFilePath(current);
    if (brokerStatusFilePath) {
      const stopped = await this.powerShellBroker.stopSession({
        sessionId: current.sessionId,
        pid: current.pid,
        statusFilePath: brokerStatusFilePath,
        reason: 'Sessao interrompida pelo operador.',
      });
      const finishedAt = stopped.finishedAt || this.now().toISOString();
      const next = this.sessions.updateSession(current.sessionId, {
        status: 'stopped',
        finishedAt,
        lastHeartbeatAt: finishedAt,
        pid: null,
        lastOutput: stopped.lastOutput || current.lastOutput || null,
        lastError: stopped.lastError || 'Sessao interrompida pelo operador.',
        lastExitCode: typeof stopped.exitCode === 'number' ? stopped.exitCode : current.lastExitCode,
        metadata: {
          codexRemotePresence: this.buildPresenceMetadata({
            ...current,
            status: 'stopped',
            finishedAt,
            lastHeartbeatAt: finishedAt,
            pid: null,
          }, finishedAt),
          codexRemoteGuardrails: this.buildGuardrailMetadata({
            ...current,
            status: 'stopped',
            finishedAt,
            lastHeartbeatAt: finishedAt,
            pid: null,
          }, finishedAt),
          codexRemoteNotifications: {
            ...this.buildNotificationMetadata(current.metadata),
            lastTerminalEventAt: finishedAt,
            lastTerminalState: 'stopped',
          },
        },
      });
      this.sessions.appendEvent(current.sessionId, {
        type: 'stopped',
        message: 'Sessao interrompida pelo operador.',
      });
      await this.notificationService.notifySessionEvent(next, {
        headline: 'Codex Remote stopped',
        status: 'stopped',
        summary: next.lastError || 'Sessao interrompida pelo operador.',
      });
      return next;
    }

    this.processSupport.markFinalized(current.sessionId, 'Sessao interrompida pelo operador.');
    this.processSupport.clearHeartbeat(current.sessionId);
    const child = this.processSupport.getProcess(current.sessionId);
    const finishedAt = this.now().toISOString();
    if (child) {
      await this.processSupport.terminateChild(child);
      this.processSupport.untrackProcess(current.sessionId);
    } else if (current.pid) {
      await this.processSupport.killProcessByPid(current.pid);
    }
    const next = this.sessions.updateSession(current.sessionId, {
      status: 'stopped',
      finishedAt,
      lastHeartbeatAt: finishedAt,
      pid: null,
      lastError: 'Sessao parada fora do sidecar local.',
      metadata: {
        codexRemotePresence: this.buildPresenceMetadata({
          ...current,
          status: 'stopped',
          finishedAt,
          lastHeartbeatAt: finishedAt,
          pid: null,
        }, finishedAt),
        codexRemoteGuardrails: this.buildGuardrailMetadata({
          ...current,
          status: 'stopped',
          finishedAt,
          lastHeartbeatAt: finishedAt,
          pid: null,
        }, finishedAt),
        codexRemoteNotifications: {
          ...this.buildNotificationMetadata(current.metadata),
          lastTerminalEventAt: finishedAt,
          lastTerminalState: 'stopped',
        },
      },
    });
    this.sessions.appendEvent(current.sessionId, {
      type: 'stopped',
      message: 'Sessao parada fora do sidecar local.',
    });
    await this.notificationService.notifySessionEvent(next, {
      headline: 'Codex Remote stopped',
      status: 'stopped',
      summary: 'Sessao parada fora do sidecar local.',
    });
    return next;
  }

  public async readTail(sessionId: string, maxLines = 20): Promise<CodexRemoteSessionTailSnapshot> {
    const current = this.requireSession(sessionId);
    return {
      sessionId: current.sessionId,
      status: current.status,
      logLines: await this.readTailFromFile(current.logFilePath, maxLines),
      lastOutput: current.lastOutput || await this.readTextFile(current.outputFilePath),
      lastError: current.lastError,
    };
  }

  public async ensureSessionFresh(sessionId: string): Promise<CodexRemoteSessionRecord> {
    const current = this.requireSession(sessionId);
    const brokerStatusFilePath = this.readBrokerStatusFilePath(current);
    if (brokerStatusFilePath) {
      return this.ensureBrokerSessionFresh(current, brokerStatusFilePath);
    }

    if (current.status !== 'running' || !current.pid) {
      return current;
    }

    if (this.isTimedOut(current)) {
      return this.stopSessionForGuardrail(current, 'Sessao interrompida pelo guardrail de tempo do Codex Remote.');
    }

    if (await this.processSupport.isSessionAlive(current)) {
      const fresh = this.processSupport.touchHeartbeat(current.sessionId);
      const live = fresh || this.requireSession(current.sessionId);
      const presence = this.buildPresenceMetadata(live);
      if (presence.stale && this.shouldNotifyStaleSession(live)) {
        const alerted = this.sessions.updateSession(current.sessionId, {
          metadata: {
            codexRemoteNotifications: {
              ...this.buildNotificationMetadata(live.metadata),
              lastStaleHeartbeatAt: live.lastHeartbeatAt,
              lastStaleNotificationAt: this.now().toISOString(),
            },
          },
        });
        this.sessions.appendEvent(current.sessionId, {
          type: 'note',
          message: `Sessao ainda responde, mas o heartbeat ficou stale ha ${Math.round((presence.heartbeatAgeMs || 0) / 1000)}s.`,
        });
        await this.notificationService.notifySessionEvent(alerted, {
          headline: 'Codex Remote stale',
          status: 'stale',
          summary: this.buildStaleSummary(alerted, presence),
        });
        return alerted;
      }
      return live;
    }

    if (this.processSupport.hasProcess(current.sessionId) || this.processSupport.isTerminalizing(current.sessionId)) {
      return current;
    }

    const finishedAt = this.now().toISOString();
    const next = this.sessions.updateSession(current.sessionId, {
      status: 'stopped',
      finishedAt,
      lastHeartbeatAt: finishedAt,
      pid: null,
      lastError: current.lastError || 'O processo nao foi encontrado no host; a sessao foi marcada como parada.',
      metadata: {
        codexRemotePresence: this.buildPresenceMetadata({
          ...current,
          status: 'stopped',
          finishedAt,
          lastHeartbeatAt: finishedAt,
          pid: null,
        }, finishedAt, 'lost'),
        codexRemoteGuardrails: this.buildGuardrailMetadata({
          ...current,
          status: 'stopped',
          finishedAt,
          lastHeartbeatAt: finishedAt,
          pid: null,
        }, finishedAt),
        codexRemoteNotifications: {
          ...this.buildNotificationMetadata(current.metadata),
          lastTerminalEventAt: finishedAt,
          lastTerminalState: 'stopped',
        },
      },
    });
    this.sessions.appendEvent(current.sessionId, {
      type: 'stopped',
      message: 'O sidecar marcou a sessao como parada apos perder o processo.',
    });
    await this.notificationService.notifySessionEvent(next, {
      headline: 'Codex Remote stopped',
      status: 'stopped',
      summary: next.lastError || 'O processo nao foi encontrado no host.',
    });
    return next;
  }

  private async stopSessionForGuardrail(
    current: CodexRemoteSessionRecord,
    reason: string,
  ): Promise<CodexRemoteSessionRecord> {
    const brokerStatusFilePath = this.readBrokerStatusFilePath(current);
    if (brokerStatusFilePath) {
      const stopped = await this.powerShellBroker.stopSession({
        sessionId: current.sessionId,
        pid: current.pid,
        statusFilePath: brokerStatusFilePath,
        reason,
      });
      const finishedAt = stopped.finishedAt || this.now().toISOString();
      const updated = this.sessions.updateSession(current.sessionId, {
        status: 'stopped',
        finishedAt,
        lastHeartbeatAt: finishedAt,
        pid: null,
        lastOutput: stopped.lastOutput || current.lastOutput || null,
        lastError: reason,
        lastExitCode: typeof stopped.exitCode === 'number' ? stopped.exitCode : current.lastExitCode,
        metadata: {
          codexRemotePresence: this.buildPresenceMetadata({
            ...current,
            status: 'stopped',
            finishedAt,
            lastHeartbeatAt: finishedAt,
            pid: null,
          }, finishedAt, 'timed-out'),
          codexRemoteGuardrails: this.buildGuardrailMetadata({
            ...current,
            status: 'stopped',
            finishedAt,
            lastHeartbeatAt: finishedAt,
            pid: null,
          }, finishedAt, 'timed-out'),
          codexRemoteNotifications: {
            ...this.buildNotificationMetadata(current.metadata),
            lastTerminalEventAt: finishedAt,
            lastTerminalState: 'timed-out',
          },
        },
      });
      this.sessions.appendEvent(current.sessionId, {
        type: 'stopped',
        message: reason,
      });
      await this.notificationService.notifySessionEvent(updated, {
        headline: 'Codex Remote guardrail',
        status: 'timed-out',
        summary: `${reason} ${this.buildGuardrailMetadata(updated, finishedAt, 'timed-out').summary}`,
      });
      return updated;
    }

    const child = this.processSupport.getProcess(current.sessionId);
    this.processSupport.markFinalized(current.sessionId, reason);
    this.processSupport.clearHeartbeat(current.sessionId);
    if (child) {
      await this.processSupport.terminateChild(child);
      this.processSupport.untrackProcess(current.sessionId);
    } else if (current.pid) {
      await this.processSupport.killProcessByPid(current.pid);
    }
    const finishedAt = this.now().toISOString();
    const updated = this.sessions.updateSession(current.sessionId, {
      status: 'stopped',
      finishedAt,
      lastHeartbeatAt: finishedAt,
      pid: null,
      lastError: reason,
      metadata: {
        codexRemotePresence: this.buildPresenceMetadata({
          ...current,
          status: 'stopped',
          finishedAt,
          lastHeartbeatAt: finishedAt,
          pid: null,
        }, finishedAt, 'timed-out'),
        codexRemoteGuardrails: this.buildGuardrailMetadata({
          ...current,
          status: 'stopped',
          finishedAt,
          lastHeartbeatAt: finishedAt,
          pid: null,
        }, finishedAt, 'timed-out'),
        codexRemoteNotifications: {
          ...this.buildNotificationMetadata(current.metadata),
          lastTerminalEventAt: finishedAt,
          lastTerminalState: 'timed-out',
        },
      },
    });
    this.sessions.appendEvent(current.sessionId, {
      type: 'stopped',
      message: reason,
    });
    await this.notificationService.notifySessionEvent(updated, {
      headline: 'Codex Remote guardrail',
      status: 'timed-out',
      summary: `${reason} ${this.buildGuardrailMetadata(updated, finishedAt, 'timed-out').summary}`,
    });
    return updated;
  }

  private shouldUsePowerShellBroker(): boolean {
    return this.usePowerShellBroker;
  }

  private readBrokerStatusFilePath(session: CodexRemoteSessionRecord): string | null {
    const metadata = session.metadata && typeof session.metadata === 'object' ? session.metadata : {};
    const broker = metadata.codexRemoteBroker;
    if (!broker || typeof broker !== 'object') {
      return null;
    }
    const mode = String((broker as Record<string, any>).mode || '').trim();
    const statusFilePath = String((broker as Record<string, any>).statusFilePath || '').trim();
    if (mode !== 'powershell' || !statusFilePath) {
      return null;
    }
    return statusFilePath;
  }

  private async ensureBrokerSessionFresh(
    current: CodexRemoteSessionRecord,
    statusFilePath: string,
  ): Promise<CodexRemoteSessionRecord> {
    if (current.status !== 'running') {
      return current;
    }

    if (this.isTimedOut(current)) {
      return this.stopSessionForGuardrail(current, 'Sessao interrompida pelo guardrail de tempo do Codex Remote.');
    }

    const inspected = await this.powerShellBroker.inspectSession({
      sessionId: current.sessionId,
      pid: current.pid,
      statusFilePath,
    });
    const observedAt = inspected.lastHeartbeatAt || this.now().toISOString();

    if (inspected.alive) {
      return this.sessions.updateSession(current.sessionId, {
        pid: inspected.pid,
        lastHeartbeatAt: observedAt,
        metadata: {
          codexRemotePresence: this.buildPresenceMetadata({
            ...current,
            lastHeartbeatAt: observedAt,
            pid: inspected.pid,
          }, observedAt),
          codexRemoteGuardrails: this.buildGuardrailMetadata({
            ...current,
            lastHeartbeatAt: observedAt,
            pid: inspected.pid,
          }, observedAt),
        },
      });
    }

    const finishedAt = inspected.finishedAt || observedAt;
    const terminalStatus = inspected.state === 'completed'
      ? 'completed'
      : inspected.state === 'failed'
        ? 'failed'
        : 'stopped';
    const next = this.sessions.updateSession(current.sessionId, {
      status: terminalStatus,
      finishedAt,
      lastHeartbeatAt: observedAt,
      pid: null,
      lastOutput: inspected.lastOutput || current.lastOutput || null,
      lastError: inspected.lastError || current.lastError || null,
      lastExitCode: typeof inspected.exitCode === 'number' ? inspected.exitCode : current.lastExitCode,
      metadata: {
        codexRemotePresence: this.buildPresenceMetadata({
          ...current,
          status: terminalStatus,
          finishedAt,
          lastHeartbeatAt: observedAt,
          pid: null,
        }, observedAt, terminalStatus === 'stopped' ? 'lost' : undefined),
        codexRemoteGuardrails: this.buildGuardrailMetadata({
          ...current,
          status: terminalStatus,
          finishedAt,
          lastHeartbeatAt: observedAt,
          pid: null,
        }, observedAt),
        codexRemoteNotifications: {
          ...this.buildNotificationMetadata(current.metadata),
          lastTerminalEventAt: finishedAt,
          lastTerminalState: terminalStatus,
        },
      },
    });

    if (current.status === 'running') {
      this.sessions.appendEvent(current.sessionId, {
        type: terminalStatus === 'completed'
          ? 'completed'
          : terminalStatus === 'failed'
            ? 'failed'
            : 'stopped',
        message: terminalStatus === 'completed'
          ? 'Sessao finalizada com sucesso.'
          : terminalStatus === 'failed'
            ? (next.lastError || 'Sessao falhou no broker PowerShell.')
            : (next.lastError || 'O processo nao foi encontrado no host; a sessao foi marcada como parada.'),
      });
      await this.notificationService.notifySessionEvent(next, {
        headline: terminalStatus === 'completed'
          ? 'Codex Remote completed'
          : terminalStatus === 'failed'
            ? 'Codex Remote failed'
            : 'Codex Remote stopped',
        status: terminalStatus,
        summary: next.lastOutput || next.lastError || this.buildGuardrailMetadata(next, observedAt).summary,
      });
    }

    return next;
  }

  private requireSession(sessionId: string): CodexRemoteSessionRecord {
    const current = this.sessions.getSession(String(sessionId || '').trim());
    if (!current) {
      throw new Error(`Sessao Codex Remote nao encontrada: ${sessionId}.`);
    }
    return current;
  }

  private isTimedOut(session: CodexRemoteSessionRecord): boolean {
    if (!session.startedAt || !session.maxRuntimeSeconds) {
      return false;
    }
    const startedAt = Date.parse(session.startedAt);
    if (!Number.isFinite(startedAt)) {
      return false;
    }
    const runtimeMs = this.now().getTime() - startedAt;
    return runtimeMs >= session.maxRuntimeSeconds * 1000;
  }

  private async readTextFile(filePath: string | null): Promise<string> {
    return this.terminalSupport.readTextFile(filePath);
  }

  private async readTailFromFile(filePath: string | null, maxLines: number): Promise<string[]> {
    return this.terminalSupport.readTailFromFile(filePath, maxLines);
  }

  private normalizeChunk(chunk: unknown): string {
    return this.terminalSupport.normalizeChunk(chunk);
  }

  private extractLastMeaningfulOutput(chunks: string[]): string | null {
    return this.terminalSupport.extractLastMeaningfulOutput(chunks);
  }

  private buildRuntimeMetadata(
    session: Pick<
      CodexRemoteSessionRecord,
      'status' | 'startedAt' | 'finishedAt' | 'lastHeartbeatAt' | 'pid' | 'maxRuntimeSeconds'
    >,
    observedAt = this.now().toISOString(),
    presenceStateOverride?: CodexRemoteRuntimePresenceMetadata['state'],
    guardrailStateOverride?: CodexRemoteRuntimeGuardrailMetadata['state'],
  ): {
    presence: CodexRemoteRuntimePresenceMetadata;
    guardrails: CodexRemoteRuntimeGuardrailMetadata;
  } {
    return this.metadata.buildRuntimeMetadata(session, observedAt, presenceStateOverride, guardrailStateOverride);
  }

  private buildPresenceMetadata(
    session: Pick<
      CodexRemoteSessionRecord,
      'status' | 'startedAt' | 'finishedAt' | 'lastHeartbeatAt' | 'pid' | 'maxRuntimeSeconds'
    >,
    observedAt = this.now().toISOString(),
    stateOverride?: CodexRemoteRuntimePresenceMetadata['state'],
  ): CodexRemoteRuntimePresenceMetadata {
    return this.metadata.buildPresenceMetadata(session, observedAt, stateOverride);
  }

  private buildGuardrailMetadata(
    session: Pick<
      CodexRemoteSessionRecord,
      'status' | 'startedAt' | 'finishedAt' | 'lastHeartbeatAt' | 'pid' | 'maxRuntimeSeconds'
    >,
    observedAt = this.now().toISOString(),
    stateOverride?: CodexRemoteRuntimeGuardrailMetadata['state'],
    presenceOverride?: CodexRemoteRuntimePresenceMetadata,
  ): CodexRemoteRuntimeGuardrailMetadata {
    return this.metadata.buildGuardrailMetadata(session, observedAt, stateOverride, presenceOverride);
  }

  private buildNotificationMetadata(metadata: Record<string, any>): Record<string, any> {
    return this.metadata.buildNotificationMetadata(metadata);
  }

  private shouldNotifyStaleSession(session: CodexRemoteSessionRecord): boolean {
    return this.metadata.shouldNotifyStaleSession(session);
  }

  private buildStaleSummary(
    session: CodexRemoteSessionRecord,
    presence?: CodexRemoteRuntimePresenceMetadata,
  ): string {
    return this.metadata.buildStaleSummary(session, presence);
  }
}
