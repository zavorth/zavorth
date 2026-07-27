
import type { ChildProcess } from 'child_process';
import { spawnShellCommand } from '../core/CommandSpawn.js';
import type { WorkspaceHook, WorkspaceProfile } from './WorkspaceProfileService.js';
import { logger } from '../logger.js';
import { asErrorLike, errorMessage } from '../utils/errorLike.js';
type WorkspaceHookSource = WorkspaceProfile | Record<string, unknown> | null | undefined;

type WorkspaceHookRuntime = {
  spawnShellCommand?: typeof spawnShellCommand;
};

export type WorkspaceHookCommandResult = {
  command: string;
  status: 'dry_run' | 'completed' | 'failed' | 'failed_to_start';
  exitCode: number | null;
  error: string | null;
};

export type WorkspaceHookExecution = {
  event: string;
  workspace: string;
  hooks: WorkspaceHook[];
  dryRun: boolean;
  ok: boolean;
  results: WorkspaceHookCommandResult[];
};

export class WorkspaceHookService {
  private readonly spawnShellImpl: typeof spawnShellCommand;

  constructor(runtime: WorkspaceHookRuntime = {}) {
    this.spawnShellImpl = runtime.spawnShellCommand || spawnShellCommand;
  }

  public listHooks(source: WorkspaceHookSource): WorkspaceHook[] {
    const record = this.toRecord(source);
    const hooks = Array.isArray(record.workspace_hooks) ? record.workspace_hooks : [];
    return hooks
      .map((entry) => this.normalizeHook(entry))
      .filter((entry): entry is WorkspaceHook => Boolean(entry));
  }

  public getHooksForEvent(source: WorkspaceHookSource, event: string): WorkspaceHook[] {
    const normalizedEvent = this.normalizeEvent(event);
    if (!normalizedEvent) {
      return [];
    }

    return this.listHooks(source).filter((hook) => hook.event === normalizedEvent);
  }

  public buildNotes(source: WorkspaceHookSource, event?: string): string[] {
    const hooks = event ? this.getHooksForEvent(source, event) : this.listHooks(source);
    return hooks.map((hook) => `Hook ${hook.event}: ${hook.command}`);
  }

  public async runHooksForEvent(input: {
    workspace: string;
    source: WorkspaceHookSource;
    event: string;
    dryRun?: boolean;
  }): Promise<WorkspaceHookExecution> {
    const hooks = this.getHooksForEvent(input.source, input.event);
    const dryRun = input.dryRun === true;
    const results: WorkspaceHookCommandResult[] = [];

    for (const hook of hooks) {
      if (dryRun) {
        results.push({
          command: hook.command,
          status: 'dry_run',
          exitCode: null,
          error: null,
        });
        continue;
      }

      results.push(await this.executeHookCommand(input.workspace, hook.command));
    }

    return {
      event: this.normalizeEvent(input.event),
      workspace: input.workspace,
      hooks,
      dryRun,
      ok: results.every((entry) => ['dry_run', 'completed'].includes(entry.status)),
      results,
    };
  }

  private async executeHookCommand(workspace: string, command: string): Promise<WorkspaceHookCommandResult> {
    let child: ChildProcess;
    try {
      child = this.spawnShellImpl(command, {
        cwd: workspace,
        env: process.env,
        stdio: 'inherit',
      });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Workspace Hook] process execution failed', error);
    return {
        command,
        status: 'failed_to_start',
        exitCode: null,
        error: errorMessage(error),
      };
  }

    return new Promise<WorkspaceHookCommandResult>((resolve) => {
      let settled = false;
      child.once('error', (error) => {
        if (settled) {
          return;
        }
        settled = true;
        resolve({
          command,
          status: 'failed',
          exitCode: null,
          error: errorMessage(error),
        });
      });
      child.once('close', (code) => {
        if (settled) {
          return;
        }
        settled = true;
        resolve({
          command,
          status: code === 0 ? 'completed' : 'failed',
          exitCode: typeof code === 'number' ? code : null,
          error: code === 0 ? null : `Hook saiu with code ${String(code)}`,
        });
      });
    });
  }

  private normalizeHook(value: unknown): WorkspaceHook | null {
    const record = this.toRecord(value);
    const event = this.normalizeEvent(record.event);
    const command = String(record.command || '').trim();
    if (!event || !command) {
      return null;
    }

    return {
      event,
      command,
    };
  }

  private normalizeEvent(value: unknown): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-');
  }

  private toRecord(value: unknown): Record<string, any> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as Record<string, any>;
  }
}
