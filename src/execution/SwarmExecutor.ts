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
        systemPrompt: 'Você é um Agente de Pesquisa Especialista. Seu foco é buscar, listar, extrair informações de APIs, ler arquivos do sistema ou pesquisar na internet para montar uma base sólida do objetivo.',
        command: baseCommand,
        args: [zavorthCliPath, '--platform', 'web', '--session', 'swarm-researcher', objectiveText],
      },
      {
        id: 'swarm-actor',
        label: 'Actor (Coder & Operator)',
        systemPrompt: 'Você é um Agente de Ação Especialista. Seu foco é escrever código, rodar scripts no shell local e alterar o sistema. Trabalhe a partir do objetivo e use as ferramentas ativamente.',
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
          role.command,
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
          role.command,
          ...(role.args || []),
        ],
        cwd,
      }));
    }

    const orchestrator = new SwarmOrchestrator(
      `Objetivo: "${request.objective}"\nInstruções Específicas:\n${request.instructions.join('\n')}`,
      roles,
      { llmRuntime: this.llmRuntime, roleTimeoutMs: 120000 }
    );

    let outputSummary = '';
    let success = false;
    let errorCode: string | undefined = undefined;

    try {
      const snapshot = await orchestrator.execute();
      success = snapshot.status === 'completed';
      outputSummary = snapshot.synthesizedOutput || 'Síntese não gerada devido a falha interna.';
    } catch (err: any) {
      outputSummary = `Falha crítica durante a execução do Swarm Orchestrator: ${err.message || err}`;
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
      error_message: success ? null : 'A execução do swarm falhou ou pelo menos um agente reportou erro severo.',
      metadata: {
        roles_count: roles.length,
        orchestrationType: 'v2-isolated-subprocess',
      },
    };
  }
}
