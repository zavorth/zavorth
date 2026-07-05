import { IExecutor } from '../contracts/IExecutor.js';
import { ExecutionRequest, ExecutionResult } from '../contracts/ExecutionContract.js';
import { SwarmOrchestrator, type SwarmRole } from '../runtime/sessions/v2/SwarmOrchestrator.js';
import { LlmRuntimeService } from '../services/llm/LlmRuntimeService.js';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

export class SwarmExecutor implements IExecutor {
  public readonly name = 'swarm';

  constructor(private readonly llmRuntime: LlmRuntimeService) {}

  public async isAvailable(): Promise<boolean> {
    // The Swarm is local, orchestrating child processes (Zavorth repls), so it's always available
    // as long as we have a working LLM for synthesis.
    return true;
  }

  public async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const startedAt = new Date().toISOString();

    const defaultIsolation = process.env.ZAVORTH_SWARM_DEFAULT_ISOLATION;
    const isIsolated = defaultIsolation === 'docker' || (defaultIsolation === 'wsl' && process.platform === 'win32');

    const zavorthCliPath = isIsolated
      ? './dist/zavorth-cli.js'
      : (process.env.ZAVORTH_CLI_PATH || path.resolve(process.cwd(), 'dist/zavorth-cli.js'));

    const baseCommand = isIsolated ? 'node' : process.execPath;

    const objectiveText = `chat ${request.objective}\n${request.instructions.join('\n')}`.trim();

    // Define standard execution roles for the Swarm
    let roles: SwarmRole[] = [
      {
        id: 'swarm-researcher',
        label: 'Researcher',
        systemPrompt: 'You are a specialist Research Agent. Your focus is searching, listing, extracting API information, reading system files, or searching the internet to build a solid foundation for the objective.',
        command: baseCommand,
        args: [zavorthCliPath, '--platform', 'web', '--session', 'swarm-researcher', objectiveText],
      },
      {
        id: 'swarm-actor',
        label: 'Actor (Coder & Operator)',
        systemPrompt: 'You are a specialist Action Agent. Your focus is writing code, running local shell scripts, and changing the system. Work from the objective and use tools actively.',
        command: baseCommand,
        args: [zavorthCliPath, '--platform', 'web', '--session', 'swarm-actor', objectiveText],
      }
    ];

    if (defaultIsolation === 'docker') {
      const cwd = process.cwd();
      roles = roles.map(role => ({
        ...role,
        command: 'docker',
        args: [
          'run',
          '--rm',
          '--network',
          'none',
          '-v',
          `${cwd}:/workspace`,
          '-w',
          '/workspace',
          'node:22',
          role.command || '',
          ...(role.args || []),
        ],
        cwd,
      }));
    } else if (defaultIsolation === 'wsl' && process.platform === 'win32') {
      const cwd = process.cwd();
      roles = roles.map(role => ({
        ...role,
        command: 'wsl.exe',
        args: [
          '--cd',
          cwd,
          '--',
          role.command || '',
          ...(role.args || []),
        ],
        cwd,
      }));
    }

    const orchestrator = new SwarmOrchestrator(
      `Objective: "${request.objective}"\nSpecific instructions:\n${request.instructions.join('\n')}`,
      roles,
      { llmRuntime: this.llmRuntime, roleTimeoutMs: 120000 }
    );

    let outputSummary = '';
    let success = false;
    let errorCode: string | undefined = undefined;

    try {
      const snapshot = await orchestrator.execute();
      success = snapshot.status === 'completed';
      outputSummary = snapshot.synthesizedOutput || 'Synthesis not generated due to internal failure.';
    } catch (err: any) {
      outputSummary = `Critical failure during Swarm Orchestrator execution: ${err.message || err}`;
      errorCode = 'SWARM_ORCHESTRATOR_FAULT';
    }

    return {
      execution_id: request.execution_id || uuidv4(),
      task_id: request.task_id,
      executor: this.name,
      success,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      actions_executed: [`Swarm Multi-Agent Workflow com ${roles.length} roles`] ,
      files_read: request.allowed_paths || [],
      files_written: request.allowed_paths || [],
      files_deleted: [],
      commands_executed: [],
      stdout: outputSummary,
      stderr: null,
      diff_summary: null,
      artifacts: [],
      rollback_available: false,
      error_code: success ? null : (errorCode || 'SWARM_FAILED'),
      error_message: success ? null : 'Swarm execution failed or at least one agent reported a severe error.',
      metadata: {
        roles_count: roles.length,
        orchestrationType: 'v2-isolated-subprocess',
      },
    };
  }
}
