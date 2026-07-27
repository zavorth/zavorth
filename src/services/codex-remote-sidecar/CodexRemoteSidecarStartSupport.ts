import fs from 'fs';
import path from 'path';
import type { ChildProcess, SpawnOptions } from 'child_process';
import { config } from '../../config/index.js';
import { buildChildProcessEnv } from '../../security/ChildProcessEnv.js';
import type { CodexRemoteNotificationService } from '../CodexRemoteNotificationService.js';
import type { CodexRemotePowerShellBrokerClientService } from '../CodexRemotePowerShellBrokerClientService.js';
import type { CodexRemoteProfileRegistryService } from '../CodexRemoteProfileRegistryService.js';
import type {
  CodexRemoteSessionRecord,
  CodexRemoteSessionStoreService,
} from '../CodexRemoteSessionStoreService.js';
import type { CodexRemoteSidecarMetadataSupport } from './CodexRemoteSidecarMetadataSupport.js';
import type { CodexRemoteSidecarProcessSupport } from './CodexRemoteSidecarProcessSupport.js';
import type { CodexRemoteSidecarTerminalSupport } from './CodexRemoteSidecarTerminalSupport.js';

type SpawnCommandLike = (command: string, args: string[], options?: SpawnOptions) => ChildProcess;

type CodexRemoteSidecarStartRuntime = {
  now: () => Date;
  profiles: Pick<CodexRemoteProfileRegistryService, 'resolveExecutionProfile'>;
  notificationService: Pick<CodexRemoteNotificationService, 'notifySessionEvent'>;
  sessions: Pick<CodexRemoteSessionStoreService, 'updateSession' | 'appendEvent'>;
  powerShellBroker: Pick<CodexRemotePowerShellBrokerClientService, 'startSession'>;
  spawn: SpawnCommandLike;
  metadata: CodexRemoteSidecarMetadataSupport;
  processSupport: CodexRemoteSidecarProcessSupport;
  terminalSupport: CodexRemoteSidecarTerminalSupport;
  requireSession: (sessionId: string) => CodexRemoteSessionRecord;
  shouldUsePowerShellBroker: () => boolean;
};

export class CodexRemoteSidecarStartSupport {
  constructor(private readonly runtime: CodexRemoteSidecarStartRuntime) {}

  public async startSession(input: {
    sessionId: string;
    prompt?: string | null;
    requestedBy?: string | null;
  }): Promise<CodexRemoteSessionRecord> {
    const current = this.runtime.requireSession(input.sessionId);
    if (
      current.status === 'running'
      && await this.runtime.processSupport.isSessionAlive(current)
    ) {
      return current;
    }

    const prompt = String(input.prompt || current.prompt || '').trim();
    if (!prompt) {
      throw new Error(`Session ${current.sessionId} has no prompt for execution.`);
    }

    const profile = this.runtime.profiles.resolveExecutionProfile(current.profileId);
    const workspace = String(current.workspaceRoot || profile.workspaceRoot || config.defaultWorkspace).trim()
      || config.defaultWorkspace;
    const runtimeDir = path.join(config.dataDir, 'runtime', 'codex-remote-sessions', current.sessionId);
    const logFilePath = path.join(runtimeDir, 'session.log');
    const outputFilePath = path.join(runtimeDir, 'last-message.txt');
    const brokerStatusFilePath = path.join(runtimeDir, 'broker-status.json');
    await fs.promises.mkdir(runtimeDir, { recursive: true });
    await fs.promises.rm(outputFilePath, { force: true }).catch(() => undefined);

    const args = [
      'exec',
      '--skip-git-repo-check',
      '--cd',
      workspace,
      '--sandbox',
      String(config.codexSandbox || 'workspace-write'),
      prompt,
    ];

    if (this.runtime.shouldUsePowerShellBroker()) {
      const brokerStarted = await this.runtime.powerShellBroker.startSession({
        sessionId: current.sessionId,
        codexCliPath: profile.codexCliPath,
        codexHome: profile.codexHome,
        workspaceRoot: workspace,
        prompt,
        sandbox: String(config.codexSandbox || 'workspace-write'),
        logFilePath,
        outputFilePath,
        statusFilePath: brokerStatusFilePath,
        maxRuntimeSeconds:
          typeof current.maxRuntimeSeconds === 'number' && Number.isFinite(current.maxRuntimeSeconds)
            ? current.maxRuntimeSeconds
            : config.codexRemoteSessionTimeoutSeconds,
      });
      const startedAt = String(brokerStarted.startedAt || this.runtime.now().toISOString());
      const runCount = Number(current.runCount || 0) + 1;
      const maxRuntimeSeconds =
        typeof current.maxRuntimeSeconds === 'number' && Number.isFinite(current.maxRuntimeSeconds)
          ? current.maxRuntimeSeconds
          : config.codexRemoteSessionTimeoutSeconds;
      const runtimeMetadata = this.runtime.metadata.buildRuntimeMetadata({
        ...current,
        status: 'running',
        startedAt,
        finishedAt: null,
        lastHeartbeatAt: startedAt,
        pid: brokerStarted.pid || null,
        maxRuntimeSeconds,
      }, startedAt);
      const next = this.runtime.sessions.updateSession(current.sessionId, {
        prompt,
        profileId: profile.id,
        workspaceRoot: workspace,
        status: 'running',
        startedAt,
        finishedAt: null,
        lastHeartbeatAt: startedAt,
        pid: brokerStarted.pid || null,
        runCount,
        maxRuntimeSeconds,
        logFilePath,
        outputFilePath,
        lastOutput: null,
        lastError: null,
        lastExitCode: null,
        metadata: {
          codexRemotePresence: runtimeMetadata.presence,
          codexRemoteGuardrails: runtimeMetadata.guardrails,
          codexRemoteNotifications: this.runtime.metadata.buildNotificationMetadata(current.metadata),
          codexRemoteBroker: {
            mode: 'powershell',
            statusFilePath: brokerStarted.statusFilePath || brokerStatusFilePath,
          },
        },
      });
      this.runtime.sessions.appendEvent(current.sessionId, {
        type: runCount > 1 ? 'resumed' : 'started',
        message: runCount > 1
          ? `Session resumed by ${String(input.requestedBy || current.requestedBy || 'unknown').trim() || 'unknown'}.`
          : `Session started with profile ${profile.label} through the PowerShell broker.`,
        at: startedAt,
      });
      this.runtime.processSupport.clearHeartbeat(current.sessionId);
      return next;
    }

    const child = this.runtime.spawn(profile.codexCliPath, args, {
      cwd: workspace,
      env: buildChildProcessEnv({
        explicitEnv: profile.codexHome ? { CODEX_HOME: profile.codexHome } : {},
      }),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    this.runtime.processSupport.trackProcess(current.sessionId, child);
    const startedAt = this.runtime.now().toISOString();
    const runCount = Number(current.runCount || 0) + 1;
    const maxRuntimeSeconds =
      typeof current.maxRuntimeSeconds === 'number' && Number.isFinite(current.maxRuntimeSeconds)
        ? current.maxRuntimeSeconds
        : config.codexRemoteSessionTimeoutSeconds;
    const runningRecord: CodexRemoteSessionRecord = {
      ...current,
      prompt,
      profileId: profile.id,
      workspaceRoot: workspace,
      status: 'running',
      startedAt,
      finishedAt: null,
      lastHeartbeatAt: startedAt,
      pid: child.pid || null,
      runCount,
      maxRuntimeSeconds,
      logFilePath,
      outputFilePath,
      lastOutput: null,
      lastError: null,
      lastExitCode: null,
    };
    const runtimeMetadata = this.runtime.metadata.buildRuntimeMetadata(runningRecord, startedAt);
    const next = this.runtime.sessions.updateSession(current.sessionId, {
      prompt,
      profileId: profile.id,
      workspaceRoot: workspace,
      status: 'running',
      startedAt,
      finishedAt: null,
      lastHeartbeatAt: startedAt,
      pid: child.pid || null,
      runCount,
      maxRuntimeSeconds,
      logFilePath,
      outputFilePath,
      lastOutput: null,
      lastError: null,
      lastExitCode: null,
      metadata: {
        codexRemotePresence: runtimeMetadata.presence,
        codexRemoteGuardrails: runtimeMetadata.guardrails,
        codexRemoteNotifications: this.runtime.metadata.buildNotificationMetadata(current.metadata),
      },
    });
    this.runtime.sessions.appendEvent(current.sessionId, {
      type: runCount > 1 ? 'resumed' : 'started',
      message: runCount > 1
        ? `Session resumed by ${String(input.requestedBy || current.requestedBy || 'unknown').trim() || 'unknown'}.`
        : `Session started with profile ${profile.label}.`,
      at: startedAt,
    });
    this.runtime.processSupport.clearHeartbeat(current.sessionId);
    this.runtime.processSupport.startHeartbeat(current.sessionId);

    const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });
    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];
    child.stdout?.on('data', (chunk) => {
      logStream.write(chunk);
      stdoutChunks.push(this.runtime.terminalSupport.normalizeChunk(chunk));
      this.runtime.processSupport.touchHeartbeat(current.sessionId);
    });
    child.stderr?.on('data', (chunk) => {
      logStream.write(chunk);
      stderrChunks.push(this.runtime.terminalSupport.normalizeChunk(chunk));
      this.runtime.processSupport.touchHeartbeat(current.sessionId);
    });
    child.on('error', (error) => {
      logStream.write(`[error] ${error.message}\n`);
      stderrChunks.push(String(error.message || '').trim());
      this.runtime.processSupport.touchHeartbeat(current.sessionId);
    });
    child.on('exit', async (code, signal) => {
      this.runtime.processSupport.markTerminalizing(current.sessionId);
      logStream.end();
      this.runtime.processSupport.untrackProcess(current.sessionId);
      this.runtime.processSupport.clearHeartbeat(current.sessionId);

      try {
        if (this.runtime.processSupport.consumeFinalized(current.sessionId)) {
          return;
        }

        const stopReason = this.runtime.processSupport.consumeStopReason(current.sessionId);
        const fileOutput = await this.runtime.terminalSupport.readTextFile(outputFilePath);
        const derivedOutput = fileOutput
          || this.runtime.terminalSupport.extractLastMeaningfulOutput(stdoutChunks)
          || null;
        if (derivedOutput) {
          await fs.promises.writeFile(outputFilePath, derivedOutput, 'utf8').catch(() => undefined);
        }
        const logLines = await this.runtime.terminalSupport.readTailFromFile(logFilePath, 20);
        const finishedAt = this.runtime.now().toISOString();
        const derivedError = this.runtime.terminalSupport.extractLastMeaningfulOutput(stderrChunks);
        const lastError = stopReason
          ? stopReason
          : code === 0
            ? null
            : (derivedError || logLines.slice(-6).join('\n').trim() || null);
        const status = stopReason ? 'stopped'
          : code === 0
            ? 'completed'
            : 'failed';
        const terminalRecord: CodexRemoteSessionRecord = {
          ...current,
          status,
          finishedAt,
          lastHeartbeatAt: finishedAt,
          pid: null,
          lastOutput: derivedOutput,
          lastError,
          lastExitCode: typeof code === 'number' ? code : null,
        };
        const terminalMetadata = this.runtime.metadata.buildRuntimeMetadata({
          ...terminalRecord,
          metadata: current.metadata,
        } as CodexRemoteSessionRecord, finishedAt);
        const updated = this.runtime.sessions.updateSession(current.sessionId, {
          status,
          finishedAt,
          lastHeartbeatAt: finishedAt,
          pid: null,
          lastOutput: derivedOutput,
          lastError,
          lastExitCode: typeof code === 'number' ? code : null,
          metadata: {
            codexRemotePresence: terminalMetadata.presence,
            codexRemoteGuardrails: terminalMetadata.guardrails,
            codexRemoteNotifications: {
              ...this.runtime.metadata.buildNotificationMetadata(current.metadata),
              lastTerminalEventAt: finishedAt,
              lastTerminalState: status,
            },
          },
        });
        const message = stopReason
          ? stopReason
          : code === 0
            ? 'Session finished successfully.'
            : `Session exited with code=${code} signal=${signal}.`;
        this.runtime.sessions.appendEvent(current.sessionId, {
          type: stopReason ? 'stopped'
            : code === 0
              ? 'completed'
              : 'failed',
          message,
        });
        await this.runtime.notificationService.notifySessionEvent(updated, {
          headline: stopReason ? 'Codex Remote stopped'
            : code === 0
              ? 'Codex Remote completed'
              : 'Codex Remote failed',
          status,
          summary: updated.lastOutput || updated.lastError || terminalMetadata.guardrails.summary || message,
        });
      } finally {
        this.runtime.processSupport.clearTerminalizing(current.sessionId);
      }
    });

    return next;
  }
}
