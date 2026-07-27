import { EventEmitter } from 'events';
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import os from 'os';
import { type AgentState, type AgentStatus, type SessionEventMap } from './AgentState.js';
import { randomUUID } from 'crypto';
import { createRequire } from 'module';
import type { RegisterSessionOwnershipInput } from './SessionOwnershipContract.js';
import type { SessionRegistryService } from './SessionRegistryService.js';
import { buildChildProcessEnv } from '../../../security/ChildProcessEnv.js';
import { redactSensitiveText } from '../../../security/SensitiveDataGuard.js';
import { asErrorLike, errorMessage } from '../../../utils/errorLike.js';
type NodePtyProcess = {
  write(data: string): void;
  kill(signal?: string): void;
  onData(listener: (event: string | { data?: string }) => void): void;
  onExit(listener: (event: number | { exitCode?: number | null; code?: number | null }) => void): void;
};

type NodePtyModule = {
  spawn(
    file: string,
    args: string[],
    options: {
      cwd: string;
      env: Record<string, string>;
      name: string;
    },
  ): NodePtyProcess;
};

export type SessionManagerOptions = {
  loadNodePty?: () => NodePtyModule | null;
  spawnProcess?: (
    command: string,
    args: string[],
    options: {
      cwd: string;
      env: Record<string, string>;
    },
  ) => ChildProcessWithoutNullStreams;
  sessionRegistry?: SessionRegistryService;
  ownership?: Omit<RegisterSessionOwnershipInput, 'sessionId'>;
};

export type SessionManagerProfile = {
  sessionId: string;
  cwd: string;
  command?: string | null;
  args?: string[] | null;
  ownership?: Omit<RegisterSessionOwnershipInput, 'sessionId'>;
};

export class TypedEventEmitter extends EventEmitter {
  public override on<K extends keyof SessionEventMap>(event: K, listener: SessionEventMap[K]): this {
    return super.on(event, listener);
  }
  public override emit<K extends keyof SessionEventMap>(event: K, ...args: Parameters<SessionEventMap[K]>): boolean {
    return super.emit(event, ...args);
  }
}

export class SessionManager {
  private childProcess: ChildProcessWithoutNullStreams | null = null;
  private ptyProcess: NodePtyProcess | null = null;
  private readonly events = new TypedEventEmitter();
  private state: AgentState;

  constructor(
    private readonly sessionId: string = randomUUID(),
    private readonly initialCwd: string = process.cwd(),
    private readonly options: SessionManagerOptions = {},
  ) {
    this.state = {
      id: this.sessionId,
      status: 'IDLE',
      startedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      context: {
        cwd: this.initialCwd,
        env: buildChildProcessEnv(),
        activeTool: null,
      },
      logs: [],
    };
    this.registerOwnership();
  }

  public static fromProfile(
    profile: SessionManagerProfile,
    options: Omit<SessionManagerOptions, 'ownership'> = {},
  ): SessionManager {
    return new SessionManager(profile.sessionId, profile.cwd, {
      ...options,
      ownership: profile.ownership,
    });
  }

  public startProfile(profile: Pick<SessionManagerProfile, 'command' | 'args'>): void {
    this.startProcess(
      String(profile.command || '').trim() || undefined,
      Array.isArray(profile.args) ? profile.args.filter((entry) => typeof entry === 'string') : undefined,
    );
  }

  public getEvents(): TypedEventEmitter {
    return this.events;
  }

  public getState(): AgentState {
    return {
      ...this.state,
      context: {
        ...this.state.context,
        env: { ...this.state.context.env },
      },
      logs: [...this.state.logs],
    };
  }

  public startProcess(command?: string, args?: string[]) {
    if (this.childProcess || this.ptyProcess) {
      return;
    }

    this.registerOwnership();
    const shell = command || (os.platform() === 'win32' ? 'cmd.exe' : 'bash');
    const shellArgs = args || [];
    const nodePty = this.resolveNodePty();

    if (nodePty) {
      this.startNodePtyProcess(nodePty.spawn(shell, shellArgs, {
        cwd: this.state.context.cwd,
        env: this.state.context.env,
        name: os.platform() === 'win32' ? 'xterm-color' : 'xterm-256color',
      }));
      return;
    }

    try {
      const spawnProcess = this.options.spawnProcess || spawn;
      this.childProcess = spawnProcess(shell, shellArgs, {
        cwd: this.state.context.cwd,
        env: this.state.context.env,
      });
    } catch (error: unknown) {const output = this.formatSpawnError(shell, shellArgs, error);
      this.appendLog(`[spawn:error] ${output}`);
      this.events.emit('pty:error', output);
      this.events.emit('pty:exit', null);
      this.setStatus('ERROR');
      this.childProcess = null;
      return;
    }

    this.setStatus('PROCESSING');

    this.childProcess.stdout.on('data', (data: Buffer) => {
      const output = this.redactTerminalText(data.toString());
      this.appendLog(output);
      this.events.emit('pty:data', output);
      this.updateActivity();
    });

    this.childProcess.stderr.on('data', (data: Buffer) => {
      const output = this.redactTerminalText(data.toString());
      this.appendLog(`[stderr] ${output}`);
      this.events.emit('pty:error', output);
      this.updateActivity();
    });

    this.childProcess.on('error', (error: Error) => {
      const output = this.formatSpawnError(shell, shellArgs, error);
      this.appendLog(`[spawn:error] ${output}`);
      this.events.emit('pty:error', output);
      this.events.emit('pty:exit', null);
      this.setStatus('ERROR');
      this.childProcess = null;
    });

    this.childProcess.on('exit', (code) => {
      this.events.emit('pty:exit', code);
      this.setStatus(code === 0 ? 'IDLE' : 'ERROR');
      this.childProcess = null;
    });
  }

  public write(input: string) {
    if (!this.childProcess && !this.ptyProcess) {
      this.startProcess();
    }
    const redactedInput = this.redactTerminalText(input);
    this.setStatus('PROCESSING');
    this.appendLog(`[stdin] ${redactedInput}`);
    this.events.emit('pty:input', redactedInput);
    if (this.ptyProcess) {
      this.ptyProcess.write(input);
      return;
    }
    if (!this.childProcess) {
      const output = 'There is no active process to receive input.';
      this.appendLog(`[stdin:error] ${output}`);
      this.events.emit('pty:error', output);
      this.setStatus('ERROR');
      return;
    }
    try {
      this.childProcess.stdin.write(input);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const output = errorMessage(error);
      this.appendLog(`[stdin:error] ${output}`);
      this.events.emit('pty:error', output);
      this.setStatus('ERROR');
    }
  }

  public kill() {
    this.releaseOwnership('session_killed');
    if (this.ptyProcess) {
      this.ptyProcess.kill();
      this.ptyProcess = null;
      this.events.emit('pty:exit', null);
      this.setStatus('IDLE');
      return;
    }
    if (this.childProcess) {
      this.childProcess.kill();
      this.childProcess = null;
      this.events.emit('pty:exit', null);
      this.setStatus('IDLE');
    }
  }

  private setStatus(status: AgentStatus) {
    if (this.state.status === status) return;
    this.state.status = status;
    this.updateActivity();
    this.events.emit('state:change', this.getState());
  }

  private updateActivity() {
    this.state.lastActiveAt = new Date().toISOString();
    this.options.sessionRegistry?.touchSession(this.sessionId, this.state.lastActiveAt);
  }

  private appendLog(entry: string) {
    const normalized = this.redactTerminalText(entry);
    if (!normalized) {
      return;
    }
    this.state.logs.push(normalized);
    if (this.state.logs.length > 200) {
      this.state.logs.splice(0, this.state.logs.length - 200);
    }
  }

  private formatSpawnError(command: string, args: string[], error: unknown): string {
    const message = error instanceof Error ? error.message : String(error || 'unknown error');
    const commandLine = [command, ...args].filter(Boolean).join(' ');
    const formatted = commandLine && !message.includes(command) ? `${message} (${commandLine})`
      : message;
    return this.redactTerminalText(formatted);
  }

  private startNodePtyProcess(processHandle: NodePtyProcess) {
    this.ptyProcess = processHandle;
    this.setStatus('PROCESSING');

    processHandle.onData((event) => {
      const output = this.redactTerminalText(typeof event === 'string' ? event : String(event?.data || ''));
      if (!output) {
        return;
      }
      this.appendLog(output);
      this.events.emit('pty:data', output);
      this.updateActivity();
    });

    processHandle.onExit((event) => {
      const rawCode = typeof event === 'number'
        ? event
        : event?.exitCode ?? asErrorLike(event).code ?? null;
      const code = typeof rawCode === 'number' ? rawCode : rawCode == null ? null : Number(rawCode);
      const exitCode = Number.isFinite(code as number) ? (code as number) : null;
      this.events.emit('pty:exit', exitCode);
      this.setStatus(exitCode === 0 ? 'IDLE' : 'ERROR');
      this.ptyProcess = null;
    });
  }

  private redactTerminalText(value: unknown): string {
    return redactSensitiveText(value);
  }

  private registerOwnership(): void {
    if (!this.options.sessionRegistry) {
      return;
    }
    this.options.sessionRegistry.registerSession({
      kind: 'standalone',
      surface: 'session-v2',
      ...this.options.ownership,
      sessionId: this.sessionId,
    });
  }

  private releaseOwnership(reason: string): void {
    this.options.sessionRegistry?.releaseSession(this.sessionId, reason, new Date());
  }

  private resolveNodePty(): NodePtyModule | null {
    if (this.options.loadNodePty) {
      return this.options.loadNodePty();
    }
    try {
      const require = createRequire(__filename);
      return require('node-pty') as NodePtyModule;
    } catch (error: unknown) {return null;
    }
  }
}
