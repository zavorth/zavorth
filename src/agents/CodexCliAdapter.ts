import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { ExecutionResult } from '../contracts/ExecutionContract.js';
import { Task } from '../contracts/TaskContract.js';
import { config } from '../config/index.js';
import { buildChildProcessEnv } from '../security/ChildProcessEnv.js';
import { WorkspaceResolver } from '../security/WorkspaceResolver.js';
import {
  CodexRemoteProfileRegistryService,
  type CodexRemoteExecutionProfile,
} from '../services/CodexRemoteProfileRegistryService.js';
import { CodexRemotePowerShellBrokerClientService } from '../services/CodexRemotePowerShellBrokerClientService.js';
import { logger } from '../logger.js';

type CodexExecOptions = {
  dryRun?: boolean;
  timeoutSeconds?: number;
  sandbox?: 'read-only' | 'workspace-write' | 'danger-full-access';
  profileId?: string | null;
};

export function buildCodexCliChildEnv(
  profile: Pick<CodexRemoteExecutionProfile, 'codexHome'>,
  hostEnv: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  return buildChildProcessEnv({
    explicitEnv: profile.codexHome ? { CODEX_HOME: profile.codexHome } : {},
    hostEnv,
  });
}

export class CodexCliAdapter {
  constructor(
    private readonly profileRegistry: Pick<CodexRemoteProfileRegistryService, 'resolveExecutionProfile'>
      = new CodexRemoteProfileRegistryService(),
    private readonly powerShellBroker: Pick<CodexRemotePowerShellBrokerClientService, 'probe'>
      = new CodexRemotePowerShellBrokerClientService(),
  ) {}

  public async isAvailable(timeoutSeconds = 15): Promise<boolean> {
    try {
      const profile = this.profileRegistry.resolveExecutionProfile();
      if (process.platform === 'win32') {
        const probe = await this.powerShellBroker.probe({
          codexCliPath: profile.codexCliPath,
          codexHome: profile.codexHome,
          workspaceRoot: config.defaultWorkspace,
        });
        return probe.available;
      }
      await this.runCodex(['--version'], config.defaultWorkspace, timeoutSeconds, profile);
      return true;
    } catch (error: any) { const err = error; const e = error; logger.warn('[Codex Cli Adapter] operation failed', error); return false; }
  }

  public async executeDirect(task: Task, instructions: string[], workspaceHint: string): Promise<ExecutionResult> {
    const prompt = this.buildPromptFromInstructions(instructions);
    return this.executePrompt(task, prompt, workspaceHint);
  }

  public async executePrompt(
    task: Task,
    prompt: string,
    workspaceHint: string | null | undefined,
    options: CodexExecOptions = {},
  ): Promise<ExecutionResult> {
    const workspace = WorkspaceResolver.validate(workspaceHint);
    const profile = this.profileRegistry.resolveExecutionProfile(options.profileId);
    const startedAt = new Date().toISOString();
    const result: ExecutionResult = {
      execution_id: uuidv4(),
      task_id: task.task_id,
      executor: 'codex_cli',
      success: false,
      started_at: startedAt,
      finished_at: startedAt,
      actions_executed: [],
      files_read: [],
      files_written: [],
      files_deleted: [],
      commands_executed: [],
      stdout: null,
      stderr: null,
      diff_summary: null,
      artifacts: [],
      rollback_available: false,
      error_code: null,
      error_message: null,
      metadata: {
        workspace,
        prompt,
        cli_path: profile.codexCliPath,
        codex_profile_id: profile.id,
        codex_home: profile.codexHome,
      },
    };

    const timeoutSeconds = options.timeoutSeconds ?? config.codexTimeoutSeconds;
    const sandbox = options.sandbox ?? (options.dryRun ? 'read-only' : (config.codexSandbox as CodexExecOptions['sandbox']));
    const outputFile = path.join(config.tmpDir, `codex-last-message-${task.task_id}.txt`);

    await fs.promises.mkdir(config.tmpDir, { recursive: true });
    await fs.promises.rm(outputFile, { force: true });

    const args = [
      'exec',
      '--skip-git-repo-check',
      '--cd',
      workspace,
      '--sandbox',
      sandbox || 'workspace-write',
      prompt,
    ];

    result.commands_executed.push(`${profile.codexCliPath} ${args.join(' ')}`);
    result.actions_executed.push('Invoked real Codex CLI');

    try {
      const { stdout, stderr } = await this.runCodex(args, workspace, timeoutSeconds, profile);
      const finalMessage = await this.readOutputFile(outputFile);
      const derivedOutput = finalMessage || this.extractLastMeaningfulLine(stdout);

      result.success = true;
      result.stdout = (derivedOutput || stdout || '').trim() || null;
      result.stderr = stderr?.trim() || null;
    } catch (err: any) { const error = err; const e = err;
      const finalMessage = await this.readOutputFile(outputFile);
      const derivedOutput = finalMessage || this.extractLastMeaningfulLine(this.cleanOutput(err?.stdout));
      result.success = false;
      result.stdout = derivedOutput || this.cleanOutput(err?.stdout) || null;
      result.stderr = this.cleanOutput(err?.stderr) || this.cleanOutput(err?.message) || null;
      result.error_code = 'CODEX_CLI_FAILED';
      result.error_message = err?.message || 'Codex CLI failed';
    } finally {
      result.finished_at = new Date().toISOString();
      await fs.promises.rm(outputFile, { force: true }).catch(() => undefined);
    }

    return result;
  }

  private buildPromptFromInstructions(instructions: string[]): string {
    if (instructions.length === 1) {
      return instructions[0];
    }

    return [
      'Execute the following task instructions in order and return a concise completion summary.',
      '',
      ...instructions.map((instruction, index) => `${index + 1}. ${instruction}`),
    ].join('\n');
  }

  private runCodex(
    args: string[],
    workspace: string,
    timeoutSeconds: number,
    profile: CodexRemoteExecutionProfile,
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      execFile(
        profile.codexCliPath,
        args,
        {
          cwd: workspace,
          env: buildCodexCliChildEnv(profile),
          timeout: timeoutSeconds * 1000,
          maxBuffer: 10 * 1024 * 1024,
          windowsHide: true,
        },
        (error, stdout, stderr) => {
          if (error) {
            const err = error as Error & { stdout?: string; stderr?: string };
            err.stdout = stdout;
            err.stderr = stderr;
            reject(err);
            return;
          }

          resolve({ stdout, stderr });
        },
      );
    });
  }

  private async readOutputFile(outputFile: string): Promise<string> {
    try {
      const content = await fs.promises.readFile(outputFile, 'utf8');
      return content.trim();
    } catch (error: any) { const err = error; const e = error; logger.warn('[Codex Cli Adapter] filesystem operation failed', error); return ''; }
  }

  private cleanOutput(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private extractLastMeaningfulLine(value: string): string {
    const lines = String(value || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    return lines[lines.length - 1] || '';
  }
}
