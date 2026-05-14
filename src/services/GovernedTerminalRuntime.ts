import { spawn } from 'node:child_process';
import path from 'node:path';
import type {
  GovernedTerminalReceipt,
  ShellSafetyReceipt,
} from '../contracts/SourceMemoryDocumentTerminalPackContract.js';
import { ShellSafetyClassifier } from './ShellSafetyClassifier.js';

type Runtime = {
  now?: () => Date;
  classifier?: ShellSafetyClassifier;
  allowedRoots?: string[];
  enabledByDefault?: boolean;
  ptyAvailable?: boolean;
  runner?: (input: { command: string; cwd: string; timeoutMs: number }) => Promise<{
    exitCode: number | null;
    stdout: string | null;
    stderr: string | null;
  }>;
};

export class GovernedTerminalRuntime {
  private readonly now: () => Date;
  private readonly classifier: ShellSafetyClassifier;
  private readonly enabledByDefault: boolean;
  private readonly runner: NonNullable<Runtime['runner']>;
  private readonly ptyAvailableOverride?: boolean;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.classifier = runtime.classifier || new ShellSafetyClassifier({
      now: this.now,
      allowedRoots: runtime.allowedRoots,
    });
    this.enabledByDefault = runtime.enabledByDefault === true;
    this.runner = runtime.runner || runShellCommand;
    this.ptyAvailableOverride = runtime.ptyAvailable;
  }

  public async run(input: {
    command: string;
    cwd?: string | null;
    approvalId?: string | null;
    allowExecution?: boolean;
    timeoutMs?: number;
    pty?: boolean;
  }): Promise<GovernedTerminalReceipt> {
    const cwd = path.resolve(input.cwd || process.cwd());
    const classification = this.classifier.classify({
      command: input.command,
      cwd,
      approvalId: input.approvalId || null,
    });
    const ptyAvailable = this.ptyAvailableOverride ?? hasPty();
    const allowExecution = this.enabledByDefault || input.allowExecution === true;
    const approvalId = input.approvalId || null;
    const blockedReason = this.blockedReason({
      classification,
      allowExecution,
      approvalId,
    });

    if (blockedReason) {
      return this.receipt({
        status: 'blocked',
        command: input.command,
        cwd,
        classification,
        approvalId,
        ptyRequested: input.pty === true,
        ptyAvailable,
        liveProcessSpawned: false,
        exitCode: null,
        stdout: null,
        stderr: null,
        reason: blockedReason,
      });
    }

    try {
      const result = await this.runner({
        command: input.command,
        cwd,
        timeoutMs: Math.max(1000, Math.min(input.timeoutMs || 10_000, 120_000)),
      });
      return this.receipt({
        status: result.exitCode === 0 ? 'applied' : 'failed',
        command: input.command,
        cwd,
        classification,
        approvalId,
        ptyRequested: input.pty === true,
        ptyAvailable,
        liveProcessSpawned: true,
        exitCode: result.exitCode,
        stdout: truncate(result.stdout),
        stderr: truncate(result.stderr),
        reason: result.exitCode === 0
          ? 'Governed terminal command executed with explicit policy allowance.'
          : 'Governed terminal command executed but returned a non-zero exit.',
      });
    } catch (error) {
      return this.receipt({
        status: 'failed',
        command: input.command,
        cwd,
        classification,
        approvalId,
        ptyRequested: input.pty === true,
        ptyAvailable,
        liveProcessSpawned: true,
        exitCode: null,
        stdout: null,
        stderr: truncate(error instanceof Error ? error.message : String(error)),
        reason: 'Governed terminal command failed during process execution.',
      });
    }
  }

  private blockedReason(input: {
    classification: ShellSafetyReceipt;
    allowExecution: boolean;
    approvalId: string | null;
  }): string | null {
    if (!input.allowExecution) {
      return 'Terminal execution is disabled until policy explicitly allows it.';
    }
    if (input.classification.blocked) {
      return input.classification.reason;
    }
    if (input.classification.approvalRequired && !input.approvalId) {
      return 'Command requires an approvalId before execution.';
    }
    return null;
  }

  private receipt(input: {
    status: GovernedTerminalReceipt['status'];
    command: string;
    cwd: string;
    classification: ShellSafetyReceipt;
    approvalId: string | null;
    ptyRequested: boolean;
    ptyAvailable: boolean;
    liveProcessSpawned: boolean;
    exitCode: number | null;
    stdout: string | null;
    stderr: string | null;
    reason: string;
  }): GovernedTerminalReceipt {
    return {
      id: `phase5.terminal.${hashText(`${input.command}:${input.cwd}:${this.now().toISOString()}`)}`,
      status: input.status,
      command: input.command,
      cwd: input.cwd,
      exitCode: input.exitCode,
      stdout: input.stdout,
      stderr: input.stderr,
      approvalId: input.approvalId,
      ptyRequested: input.ptyRequested,
      ptyAvailable: input.ptyAvailable,
      liveProcessSpawned: input.liveProcessSpawned,
      artifactFirst: true,
      secretValuesSerialized: false,
      classification: input.classification,
      reason: input.reason,
    };
  }
}

async function runShellCommand(input: {
  command: string;
  cwd: string;
  timeoutMs: number;
}): Promise<{
  exitCode: number | null;
  stdout: string | null;
  stderr: string | null;
}> {
  return await new Promise((resolve, reject) => {
    const child = spawn(input.command, {
      cwd: input.cwd,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (value: { exitCode: number | null; stdout: string | null; stderr: string | null }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(value);
    };
    const timeout = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {}
      finish({
        exitCode: null,
        stdout: stdout.trim() || null,
        stderr: stderr.trim() || 'process timeout',
      });
    }, input.timeoutMs);
    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      finish({
        exitCode: typeof code === 'number' ? code : null,
        stdout: stdout.trim() || null,
        stderr: stderr.trim() || null,
      });
    });
  });
}

function hasPty(): boolean {
  try {
    require.resolve('node-pty');
    return true;
  } catch {
    try {
      require.resolve('@lydell/node-pty');
      return true;
    } catch {
      return false;
    }
  }
}

function truncate(value: string | null): string | null {
  if (!value) return null;
  return value.length > 4000 ? `${value.slice(0, 4000)}...[truncated]` : value;
}

function hashText(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}
