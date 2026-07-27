import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import { logger } from '../logger.js';

export type ZavorthGitWorkflowAction = 'status' | 'branch' | 'commit' | 'pr';

export type ZavorthGitWorkflowCommandResult = {
  command: string;
  args: string[];
  stdout: string;
  stderr: string;
  exitCode: number;
};

export type ZavorthGitWorkflowCommandRunner = (
  command: string,
  args: string[],
  options?: { cwd?: string | null },
) => Promise<ZavorthGitWorkflowCommandResult>;

export type ZavorthGitWorkflowReceipt = {
  receiptId: string;
  action: Exclude<ZavorthGitWorkflowAction, 'status'>;
  appliedAt: string;
  approvedBy: string;
  workspaceRoot: string;
  command: {
    command: string;
    args: string[];
  };
  stdoutPreview: string;
  stderrPreview: string;
};

export type ZavorthGitWorkflowSnapshot = {
  contractVersion: 'zavorth-git-workflow/v1';
  source: 'ZavorthGitWorkflowService';
  generatedAt: string;
  action: ZavorthGitWorkflowAction;
  status: 'ready' | 'preview' | 'applied' | 'approval-required' | 'blocked' | 'failed';
  workspaceRoot: string;
  branch: string | null;
  dirtyFiles: number;
  statusOutput: string;
  summary: string;
  requested: {
    branchName: string | null;
    commitMessage: string | null;
    prTitle: string | null;
    prBody: string | null;
    baseRef: string | null;
    headRef: string | null;
  };
  approval: {
    required: boolean;
    satisfied: boolean;
    approvalId: string | null;
    reason: string | null;
  };
  plannedCommands: Array<{
    command: string;
    args: string[];
    mutates: boolean;
  }>;
  commands: Array<{
    command: string;
    args: string[];
    exitCode: number;
  }>;
  receipt: ZavorthGitWorkflowReceipt | null;
  safety: {
    previewBeforeMutation: true;
    approvalRequiredForMutation: true;
    shellInterpolationUsed: false;
    arbitraryCommandExecution: false;
  };
};

type RunInput = {
  action: ZavorthGitWorkflowAction;
  workspaceRoot?: string | null;
  args?: string | string[] | null;
  apply?: boolean | null;
  approvalId?: string | null;
  approvedBy?: string | null;
};

type ParsedArgs = {
  tokens: string[];
  apply: boolean;
  approvalId: string | null;
  branchName: string | null;
  commitMessage: string | null;
  prTitle: string | null;
  prBody: string | null;
  baseRef: string | null;
  headRef: string | null;
};

export class ZavorthGitWorkflowService {
  private readonly runner: ZavorthGitWorkflowCommandRunner;
  private readonly now: () => Date;

  public constructor(runtime: {
    runner?: ZavorthGitWorkflowCommandRunner;
    now?: () => Date;
  } = {}) {
    this.runner = runtime.runner || defaultGitWorkflowRunner;
    this.now = runtime.now || (() => new Date());
  }

  public async run(input: RunInput): Promise<ZavorthGitWorkflowSnapshot> {
    const workspaceRoot = path.resolve(String(input.workspaceRoot || '').trim() || process.cwd());
    const parsed = parseWorkflowArgs(input.args);
    const status = await this.collectStatus(workspaceRoot);
    if (input.action === 'status') {
      return this.snapshot({
        action: 'status',
        workspaceRoot,
        status,
        parsed,
        state: 'ready',
        summary: status.summary,
        plannedCommands: [
          { command: 'git', args: ['status', '--short', '--branch'], mutates: false },
        ],
        commands: status.commands,
      });
    }

    const shouldApply = input.apply === true || parsed.apply;
    const approvalId = clean(input.approvalId) || parsed.approvalId || null;
    const approvalSatisfied = Boolean(approvalId);
    const plan = this.planMutation(input.action, parsed, status.branch);
    if (plan.blocker) {
      return this.snapshot({
        action: input.action,
        workspaceRoot,
        status,
        parsed,
        state: 'blocked',
        summary: plan.blocker,
        plannedCommands: plan.commands,
        commands: status.commands,
      });
    }

    if (!shouldApply) {
      return this.snapshot({
        action: input.action,
        workspaceRoot,
        status,
        parsed,
        state: 'preview',
        summary: plan.previewSummary,
        plannedCommands: plan.commands,
        commands: status.commands,
        approvalId,
      });
    }

    if (!approvalSatisfied) {
      return this.snapshot({
        action: input.action,
        workspaceRoot,
        status,
        parsed,
        state: 'approval-required',
        summary: `${plan.previewSummary} Apply requested, but approval id is missing.`,
        plannedCommands: plan.commands,
        commands: status.commands,
        approvalId,
      });
    }

    const execution = await this.applyPlan(workspaceRoot, input.action, plan.commands);
    const receipt = this.writeReceipt({
      action: input.action,
      workspaceRoot,
      approvedBy: clean(input.approvedBy) || approvalId || 'operator',
      command: execution.appliedCommand,
      stdout: execution.stdout,
      stderr: execution.stderr,
    });
    return this.snapshot({
      action: input.action,
      workspaceRoot,
      status: await this.collectStatus(workspaceRoot),
      parsed,
      state: execution.ok ? 'applied' : 'failed',
      summary: execution.ok ? `${input.action} applied through governed Git workflow.`
        : `${input.action} failed: ${firstLine(execution.stderr) || `exit ${execution.exitCode}`}`,
      plannedCommands: plan.commands,
      commands: [...status.commands, ...execution.commands],
      receipt,
      approvalId,
    });
  }

  private async collectStatus(workspaceRoot: string): Promise<{
    branch: string | null;
    dirtyFiles: number;
    statusOutput: string;
    summary: string;
    commands: ZavorthGitWorkflowSnapshot['commands'];
  }> {
    const commands: ZavorthGitWorkflowSnapshot['commands'] = [];
    const run = async (args: string[]) => {
      const result = await this.runner('git', args, { cwd: workspaceRoot });
      commands.push({ command: result.command, args: result.args, exitCode: result.exitCode });
      return result;
    };
    const [branch, status] = await Promise.all([
      run(['branch', '--show-current']),
      run(['status', '--short', '--branch']),
    ]);
    const branchName = branch.exitCode === 0 ? clean(branch.stdout) || null : null;
    const dirtyFiles = status.exitCode === 0
      ? status.stdout.split(/\r...\n/).filter((line) => line.trim() && !line.startsWith('##')).length
      : 0;
    const statusOutput = status.exitCode === 0 ? status.stdout : '';
    return {
      branch: branchName,
      dirtyFiles,
      statusOutput,
      summary: `Git status: branch ${branchName || 'unknown'}, ${dirtyFiles} changed file(s).`,
      commands,
    };
  }

  private planMutation(
    action: Exclude<ZavorthGitWorkflowAction, 'status'>,
    parsed: ParsedArgs,
    currentBranch: string | null,
  ): {
    blocker: string | null;
    previewSummary: string;
    commands: ZavorthGitWorkflowSnapshot['plannedCommands'];
  } {
    if (action === 'branch') {
      const branchName = parsed.branchName;
      if (!isSafeBranchName(branchName)) {
        return {
          blocker: 'Branch name is required and must be a safe git ref fragment.',
          previewSummary: 'Branch preview blocked.',
          commands: [],
        };
      }
      return {
        blocker: null,
        previewSummary: `Ready to create and switch to branch ${branchName}.`,
        commands: [{ command: 'git', args: ['switch', '-c', branchName], mutates: true }],
      };
    }

    if (action === 'commit') {
      const message = parsed.commitMessage;
      if (!message) {
        return { blocker: 'Commit message is required.', previewSummary: 'Commit preview blocked.', commands: [] };
      }
      return {
        blocker: null,
        previewSummary: `Ready to stage all changes and commit: ${message}`,
        commands: [
          { command: 'git', args: ['add', '--all'], mutates: true },
          { command: 'git', args: ['commit', '-m', message], mutates: true },
        ],
      };
    }

    const title = parsed.prTitle || parsed.commitMessage;
    if (!title) {
      return { blocker: 'PR title is required.', previewSummary: 'PR preview blocked.', commands: [] };
    }
    const args = ['pr', 'create', '--title', title, '--body', parsed.prBody || 'Created by Zavorth governed PR command.'];
    if (parsed.baseRef) args.push('--base', parsed.baseRef);
    if (parsed.headRef || currentBranch) args.push('--head', parsed.headRef || currentBranch || '');
    return {
      blocker: null,
      previewSummary: `Ready to create GitHub PR: ${title}`,
      commands: [{ command: 'gh', args, mutates: true }],
    };
  }

  private async applyPlan(
    workspaceRoot: string,
    action: Exclude<ZavorthGitWorkflowAction, 'status'>,
    plannedCommands: ZavorthGitWorkflowSnapshot['plannedCommands'],
  ): Promise<{
    ok: boolean;
    exitCode: number;
    stdout: string;
    stderr: string;
    commands: ZavorthGitWorkflowSnapshot['commands'];
    appliedCommand: { command: string; args: string[] };
  }> {
    const commands: ZavorthGitWorkflowSnapshot['commands'] = [];
    let stdout = '';
    let stderr = '';
    let exitCode = 0;
    let appliedCommand = { command: plannedCommands[0]?.command || action, args: plannedCommands[0]?.args || [] };
    for (const planned of plannedCommands) {
      const result = await this.runner(planned.command, planned.args, { cwd: workspaceRoot });
      commands.push({ command: result.command, args: result.args, exitCode: result.exitCode });
      stdout += result.stdout;
      stderr += result.stderr;
      exitCode = result.exitCode;
      appliedCommand = { command: result.command, args: result.args };
      if (result.exitCode !== 0) {
        return { ok: false, exitCode, stdout, stderr, commands, appliedCommand };
      }
    }
    return { ok: true, exitCode, stdout, stderr, commands, appliedCommand };
  }

  private writeReceipt(input: {
    action: Exclude<ZavorthGitWorkflowAction, 'status'>;
    workspaceRoot: string;
    approvedBy: string;
    command: { command: string; args: string[] };
    stdout: string;
    stderr: string;
  }): ZavorthGitWorkflowReceipt {
    const appliedAt = this.now().toISOString();
    const receipt: ZavorthGitWorkflowReceipt = {
      receiptId: `gitwf-${hash(`${input.action}:${appliedAt}:${input.command.command}:${input.command.args.join('\0')}`).slice(0, 16)}`,
      action: input.action,
      appliedAt,
      approvedBy: input.approvedBy,
      workspaceRoot: input.workspaceRoot,
      command: input.command,
      stdoutPreview: input.stdout.slice(0, 2000),
      stderrPreview: input.stderr.slice(0, 2000),
    };
    const receiptPath = path.join(input.workspaceRoot, '.zavorth', 'receipts', 'git-workflow.json');
    let current: ZavorthGitWorkflowReceipt[] = [];
    try {
      const parsed = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
      current = Array.isArray(parsed?.receipts) ? parsed.receipts : [];
    } catch (error: unknown) {logger.warn('[Zavorth Git Workflow] JSON parse failed', error);
    current = [];
  }
    fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
    fs.writeFileSync(receiptPath, `${JSON.stringify({
      contractVersion: 'zavorth-git-workflow/v1',
      updatedAt: appliedAt,
      receipts: [...current, receipt].slice(-250),
    }, null, 2)}\n`, 'utf8');
    return receipt;
  }

  private snapshot(input: {
    action: ZavorthGitWorkflowAction;
    workspaceRoot: string;
    status: { branch: string | null; dirtyFiles: number; statusOutput: string; summary: string; commands: ZavorthGitWorkflowSnapshot['commands'] };
    parsed: ParsedArgs;
    state: ZavorthGitWorkflowSnapshot['status'];
    summary: string;
    plannedCommands: ZavorthGitWorkflowSnapshot['plannedCommands'];
    commands: ZavorthGitWorkflowSnapshot['commands'];
    receipt?: ZavorthGitWorkflowReceipt | null;
    approvalId?: string | null;
  }): ZavorthGitWorkflowSnapshot {
    return {
      contractVersion: 'zavorth-git-workflow/v1',
      source: 'ZavorthGitWorkflowService',
      generatedAt: this.now().toISOString(),
      action: input.action,
      status: input.state,
      workspaceRoot: input.workspaceRoot,
      branch: input.status.branch,
      dirtyFiles: input.status.dirtyFiles,
      statusOutput: input.status.statusOutput,
      summary: input.summary,
      requested: {
        branchName: input.parsed.branchName,
        commitMessage: input.parsed.commitMessage,
        prTitle: input.parsed.prTitle,
        prBody: input.parsed.prBody,
        baseRef: input.parsed.baseRef,
        headRef: input.parsed.headRef,
      },
      approval: {
        required: input.action !== 'status',
        satisfied: Boolean(input.approvalId),
        approvalId: input.approvalId || null,
        reason: input.action === 'status' ? null : 'Git branch/commit/PR mutations require explicit approval id or CLI --yes.',
      },
      plannedCommands: input.plannedCommands,
      commands: input.commands,
      receipt: input.receipt || null,
      safety: {
        previewBeforeMutation: true,
        approvalRequiredForMutation: true,
        shellInterpolationUsed: false,
        arbitraryCommandExecution: false,
      },
    };
  }
}

function parseWorkflowArgs(input: string | string[] | null | undefined): ParsedArgs {
  const tokens = Array.isArray(input) ? input.map(String) : tokenize(String(input || ''));
  const positional = tokens.filter((token, index) => {
    if (token.startsWith('--') || token === '-m') return false;
    const previous = tokens[index - 1] || '';
    return !previous.startsWith('--') && previous !== '-m';
  });
  return {
    tokens,
    apply: hasFlag(tokens, 'apply') || hasFlag(tokens, 'yes'),
    approvalId: readFlag(tokens, 'approval-id') || readFlag(tokens, 'approval') || (hasFlag(tokens, 'yes') ? 'cli-local-owner' : null),
    branchName: readFlag(tokens, 'name') || readFlag(tokens, 'branch') || positional[0] || null,
    commitMessage: readFlag(tokens, 'message') || readFlag(tokens, 'msg') || readShortFlag(tokens, 'm') || positional.join(' ').trim() || null,
    prTitle: readFlag(tokens, 'title') || positional.join(' ').trim() || null,
    prBody: readFlag(tokens, 'body'),
    baseRef: readFlag(tokens, 'base'),
    headRef: readFlag(tokens, 'head'),
  };
}

function tokenize(value: string): string[] {
  const tokens: string[] = [];
  const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value))) {
    tokens.push(match[1] ?? match[2] ?? match[3] ?? '');
  }
  return tokens;
}

function readFlag(tokens: string[], name: string): string | null {
  const prefix = `--${name}=`;
  const inline = tokens.find((token) => token.startsWith(prefix));
  if (inline) return clean(inline.slice(prefix.length));
  const index = tokens.indexOf(`--${name}`);
  return index >= 0 ? clean(tokens[index + 1]) : null;
}

function readShortFlag(tokens: string[], name: string): string | null {
  const index = tokens.indexOf(`-${name}`);
  return index >= 0 ? clean(tokens[index + 1]) : null;
}

function hasFlag(tokens: string[], name: string): boolean {
  return tokens.includes(`--${name}`) || tokens.some((token) => token === `--${name}=true`);
}

function isSafeBranchName(value: string | null): value is string {
  const branch = clean(value);
  return Boolean(branch)
    && branch.length <= 120
    && /^[A-Za-z0-9._/-]+$/.test(branch)
    && !branch.includes('..')
    && !branch.includes('@{')
    && !branch.endsWith('/')
    && !branch.startsWith('/')
    && !branch.endsWith('.lock');
}

function clean(value: unknown): string {
  return String(value || '').trim();
}

function firstLine(value: string): string {
  return clean(String(value || '').split(/\r...\n/)[0]);
}

function hash(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function defaultGitWorkflowRunner(
  command: string,
  args: string[],
  options: { cwd?: string | null } = {},
): Promise<ZavorthGitWorkflowCommandResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd || process.cwd(),
      windowsHide: true,
      shell: false,
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', (error) => {
      resolve({ command, args, stdout, stderr: error.message, exitCode: 1 });
    });
    child.on('close', (code) => {
      resolve({ command, args, stdout, stderr, exitCode: code ?? 1 });
    });
  });
}
