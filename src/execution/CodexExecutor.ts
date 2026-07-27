import { v4 as uuidv4 } from 'uuid';
import { CodexCliAdapter } from '../agents/CodexCliAdapter.js';
import { ExecutionRequest, ExecutionResult } from '../contracts/ExecutionContract.js';
import { IExecutor } from '../contracts/IExecutor.js';

export class CodexExecutor implements IExecutor {
  public readonly name = 'codex';
  private readonly adapter: CodexCliAdapter;

  constructor(adapter?: CodexCliAdapter) {
    this.adapter = adapter || new CodexCliAdapter();
  }

  public async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const prompt = this.buildPrompt(request);
    const task = this.toTaskShape(request);

    return this.adapter.executePrompt(task, prompt, request.workspace, {
      dryRun: request.dry_run,
      timeoutSeconds: request.timeout_seconds,
      profileId: String(request.metadata?.codex_profile_id || request.metadata?.codex_remote_profile_id || '').trim() || null,
    });
  }

  public async isAvailable(): Promise<boolean> {
    return this.adapter.isAvailable();
  }

  private buildPrompt(request: ExecutionRequest): string {
    const extraAllowedPaths = request.allowed_paths.slice(1);
    const extraAllowedCommands = request.allowed_commands;
    const allowedPathPolicies = Array.isArray(request.metadata?.allowed_path_policies)
      ? request.metadata.allowed_path_policies
      : [];
    if (request.instructions.length === 0) {
      return this.composePrompt(
        request.objective,
        request.workspace,
        extraAllowedPaths,
        extraAllowedCommands,
        allowedPathPolicies,
      );
    }

    if (request.instructions.length === 1) {
      return this.composePrompt(
        request.instructions[0],
        request.workspace,
        extraAllowedPaths,
        extraAllowedCommands,
        allowedPathPolicies,
      );
    }

    return this.composePrompt([
      request.objective || 'Execute the requested task in the indicated workspace.',
      '',
      ...request.instructions.map((instruction, index) => `${index + 1}. ${instruction}`),
    ].join('\n'), request.workspace, extraAllowedPaths, extraAllowedCommands, allowedPathPolicies);
  }

  private composePrompt(
    prompt: string,
    workspace: string,
    extraAllowedPaths: string[],
    extraAllowedCommands: string[],
    allowedPathPolicies: Array<Record<string, unknown>>,
  ): string {
    const policyLines: string[] = [];
    const writeScopePaths = allowedPathPolicies
      .map((policy) => {
        const pathValue = String(policy?.path || '').trim();
        const accessLevel = String(policy?.access_level || '').trim().toLowerCase();
        return pathValue && accessLevel === 'read_write' ? pathValue : null;
      })
      .filter((value): value is string => Boolean(value));

    if (extraAllowedPaths.length > 0) {
      policyLines.push(`Extra folders approved by Zavorth: ${extraAllowedPaths.join(', ')}`);
    }

    if (writeScopePaths.length > 0) {
      policyLines.push(`Approved base workspace: ${workspace}`);
      policyLines.push('Zavorth write rule: treat the rest of the workspace as read-only.');
      policyLines.push(`Write approved scope by Zavorth: ${writeScopePaths.join(', ')}`);
    }

    if (extraAllowedCommands.length > 0) {
      policyLines.push(`Extra commands approved by Zavorth: ${extraAllowedCommands.join(', ')}`);
    }

    if (policyLines.length === 0) {
      return prompt;
    }

    return [
      prompt,
      '',
      'Approved persistent permissions:',
      ...policyLines,
    ].join('\n');
  }

  private toTaskShape(request: ExecutionRequest): any {
    const now = new Date().toISOString();

    return {
      task_id: request.task_id || uuidv4(),
      created_at: now,
      updated_at: now,
      source: 'system',
      chat_id: 'gateway',
      user_id: 'gateway',
      raw_message: request.objective,
      normalized_message: request.objective.toLowerCase(),
      command_type: '/codex',
      intent: 'code_execution',
      target: null,
      workspace: request.workspace,
      risk_level: 2,
      status: 'running',
      requires_planning: false,
      requires_approval: false,
      approval_status: 'not_required',
      planner_used: null,
      executor_used: 'codex',
      fallback_used: false,
      parent_task_id: null,
      actions_planned: [],
      actions_executed: [],
      target_files: [],
      artifacts: [],
      stdout_summary: null,
      stderr_summary: null,
      diff_summary: null,
      result_summary: null,
      error_summary: null,
      rollback_available: false,
      metadata: request.metadata || {},
    };
  }
}
