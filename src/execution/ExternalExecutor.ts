import { execFile } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import { ExecutionRequest, ExecutionResult } from '../contracts/ExecutionContract.js';
import { IExecutor } from '../contracts/IExecutor.js';
import { WorkspaceResolver } from '../security/WorkspaceResolver.js';

type ExternalExecutorTransport = 'wsl' | 'direct';

type ExternalExecutorSettings = {
  cliPath: string;
  transport: ExternalExecutorTransport;
  command: string;
  agentId: string;
  thinking: string;
  wslDistro?: string;
  wslUser?: string;
  timeoutSeconds: number;
};

type ExternalExecutorRunOptions = {
  cwd?: string;
  timeout: number;
  maxBuffer: number;
  windowsHide: boolean;
};

type ExternalExecutorProcessError = Error & {
  stdout?: string;
  stderr?: string;
  code?: unknown;
};

type ExternalExecutorCommandRunner = (
  file: string,
  args: string[],
  options: ExternalExecutorRunOptions,
) => Promise<unknown>;

type ExternalExecutorOptions = {
  settings?: Partial<ExternalExecutorSettings>;
  runner?: ExternalExecutorCommandRunner;
};

type ExternalExecutorInvocation = {
  file: string;
  args: string[];
  cwd?: string;
};

type ExternalExecutorGatewayHealth = {
  ok: boolean;
  detail: string;
};

type ExternalExecutorCommandResult = {
  stdout: string;
  stderr: string;
};

type ExternalPathPolicy = {
  path: string;
  accessLevel: 'read_write' | 'read_only';
};

type ExternalCommandPolicy = {
  command: string;
  matchType: 'prefix' | 'exact';
};

export const EXTERNAL_EXECUTOR_ID = 'external_executor';

const EXTERNAL_EXECUTOR_DISPLAY_NAME = 'external runner';
const EXTERNAL_EXECUTOR_ERROR_PREFIX = 'EXTERNAL_EXECUTOR';
const EXTERNAL_EXECUTOR_GATEWAY_SERVICE_NAME = 'external-executor-gateway.service';

function stringifyProcessOutput(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (Buffer.isBuffer(value)) {
    return value.toString('utf8');
  }

  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }

  return '';
}

const defaultRunner: ExternalExecutorCommandRunner = (file, args, options) =>
  new Promise((resolve, reject) => {
    execFile(file, args, options, (error, stdout, stderr) => {
      if (error) {
        reject(Object.assign(error, {
          stdout: stringifyProcessOutput(stdout),
          stderr: stringifyProcessOutput(stderr),
        }) as ExternalExecutorProcessError);
        return;
      }

      resolve({
        stdout: stringifyProcessOutput(stdout),
        stderr: stringifyProcessOutput(stderr),
      });
    });
  });

function normalizeTransport(value: string): ExternalExecutorTransport {
  return value === 'direct' ? 'direct' : 'wsl';
}

function readRuntimeString(canonicalKey: string, fallback = ''): string {
  const runtimeConfig = config as Record<string, unknown>;
  const canonical = String(runtimeConfig[canonicalKey] || '').trim();
  if (canonical) {
    return canonical;
  }

  return fallback;
}

function readRuntimeNumber(canonicalKey: string, fallback: number): number {
  const runtimeConfig = config as Record<string, unknown>;
  const canonical = Number(runtimeConfig[canonicalKey]);
  if (Number.isFinite(canonical) && canonical > 0) {
    return canonical;
  }

  return fallback;
}

/**
 * ExternalExecutor - executor real para external runner (WSL/direct).
 *
 * O Zavorth delega uma tarefa ja validada pelo Gateway para um cliente ACP.
 * O agente deve respeitar o workspace aprovado e retornar um resumo curto da
 * execucao.
 */
export class ExternalExecutor implements IExecutor {
  public readonly name = EXTERNAL_EXECUTOR_ID;
  private readonly settings: ExternalExecutorSettings;
  private readonly runner: ExternalExecutorCommandRunner;
  private resolvedWslDistro: string | null | undefined;

  constructor(options: ExternalExecutorOptions = {}) {
    this.settings = {
      cliPath: options.settings?.cliPath || readRuntimeString('externalExecutorCliPath'),
      transport: normalizeTransport(
        options.settings?.transport || readRuntimeString('externalExecutorTransport', 'direct'),
      ),
      command: options.settings?.command || readRuntimeString('externalExecutorCommand', 'external-executor'),
      agentId: options.settings?.agentId || readRuntimeString('externalExecutorAgentId', 'main'),
      thinking: options.settings?.thinking || readRuntimeString('externalExecutorThinking', 'low'),
      wslDistro: options.settings?.wslDistro || readRuntimeString('externalExecutorWslDistro'),
      wslUser: options.settings?.wslUser || readRuntimeString('externalExecutorWslUser'),
      timeoutSeconds: options.settings?.timeoutSeconds || readRuntimeNumber('externalExecutorTimeoutSeconds', 240),
    };
    this.runner = options.runner || defaultRunner;
  }

  public async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const startedAt = new Date().toISOString();
    const workspace = WorkspaceResolver.validate(request.workspace);
    const workspaceWsl = this.toWslPath(workspace);
    const executionId = request.execution_id || uuidv4();
    const effectiveAgentId = this.resolveAgentId(request);
    const prompt = this.buildPrompt(request, workspace);
    const invocation = await this.buildAgentInvocation(prompt, workspace, effectiveAgentId);
    const result: ExecutionResult = {
      execution_id: executionId,
      task_id: request.task_id,
      executor: this.name,
      success: false,
      started_at: startedAt,
      finished_at: startedAt,
      actions_executed: [],
      files_read: [],
      files_written: [],
      files_deleted: [],
      commands_executed: [this.formatCommand(invocation.file, invocation.args)],
      stdout: null,
      stderr: null,
      diff_summary: null,
      artifacts: [],
      rollback_available: false,
      error_code: null,
      error_message: 'External runner (WSL/direct) ainda nao esta instalado ou configurado. Use o executor local por enquanto.',
      metadata: {
        workspace,
        workspace_wsl: workspaceWsl,
        cli_path: this.settings.cliPath,
        transport: this.settings.transport,
        external_executor_command: this.settings.command,
        agent_id: effectiveAgentId,
        thinking: this.settings.thinking,
        instructions: 'Para ativar o external runner, configure a CLI local ou a ponte WSL.',
      },
    };
    result.error_message = null;
    delete (result.metadata as Record<string, unknown>).instructions;

    if (request.dry_run) {
      result.success = true;
      result.error_message = null;
      result.finished_at = new Date().toISOString();
      result.stdout = [
        'Simulacao do external runner pronta.',
        `Workspace aprovado: ${workspace}`,
        `Workspace WSL esperado: ${workspaceWsl}`,
        '',
        prompt,
      ].join('\n');
      result.metadata.dry_run = true;
      return result;
    }

    try {
      const { stdout, stderr, recoveredGateway } = await this.runAgentInvocationWithRecovery(
        invocation,
        request.timeout_seconds || this.settings.timeoutSeconds,
      );

      result.success = true;
      result.error_message = null;
      result.stdout = this.cleanOutput(stdout) || null;
      result.stderr = this.cleanOutput(stderr) || null;
      result.actions_executed.push(`Agente do ${EXTERNAL_EXECUTOR_DISPLAY_NAME} ${effectiveAgentId} acionado`);
      if (recoveredGateway) {
        result.actions_executed.push('Gateway do external runner reiniciado automaticamente antes da execucao.');
        result.metadata.gateway_recovered = true;
      }

      if ((result.stdout || '').includes('WORKSPACE_MISMATCH')) {
        result.success = false;
        result.error_code = `${EXTERNAL_EXECUTOR_ERROR_PREFIX}_WORKSPACE_MISMATCH`;
        result.error_message = 'O cliente ACP esta preso a um workspace diferente do workspace aprovado pelo Zavorth.';
      } else {
        const requestedPath = this.parsePathAccessRequest(result.stdout || '');
        if (requestedPath) {
          result.success = false;
          result.error_code = `${EXTERNAL_EXECUTOR_ERROR_PREFIX}_PATH_ACCESS_REQUIRED`;
          result.error_message = `O external runner precisa de acesso adicional ao caminho ${requestedPath.windowsPath || requestedPath.rawPath} para concluir a tarefa atual.`;
          result.metadata = {
            ...(result.metadata || {}),
            requested_access_path_raw: requestedPath.rawPath,
            requested_access_path_windows: requestedPath.windowsPath,
            requested_access_path_wsl: requestedPath.wslPath,
            requested_access_reason: requestedPath.reason,
          };
        }
      }
    } catch (error: unknown) {
      const executionError = this.normalizeProcessError(error);
      result.success = false;
      result.stdout = this.cleanOutput(executionError.stdout) || null;
      result.stderr = this.cleanOutput(executionError.stderr) || this.cleanOutput(executionError.message) || null;
      result.error_code = `${EXTERNAL_EXECUTOR_ERROR_PREFIX}_AGENT_FAILED`;
      result.error_message = executionError.message || 'External runner CLI falhou ao executar a tarefa.';
    }

    result.finished_at = new Date().toISOString();
    return result;
  }

  public async isAvailable(): Promise<boolean> {
    const invocation = await this.buildVersionInvocation();

    try {
      await this.runner(invocation.file, invocation.args, {
        cwd: invocation.cwd,
        timeout: this.getAvailabilityTimeoutMs(),
        maxBuffer: 1024 * 1024,
        windowsHide: true,
      });

      if (this.settings.transport === 'wsl') {
        this.scheduleBestEffortGatewayRecovery();
      }

      return true;
    } catch {
      return false;
    }
  }

  private buildPrompt(request: ExecutionRequest, workspace: string): string {
    const workspaceWsl = this.toWslPath(workspace);
    const allowedPathPolicies = this.normalizePathPolicies(request.metadata?.allowed_path_policies);
    const allowedCommandPolicies = this.normalizeCommandPolicies(request.metadata?.allowed_command_policies);
    const instructions = request.instructions.length > 0
      ? request.instructions.map((instruction, index) => `${index + 1}. ${instruction}`)
      : ['1. Execute a tarefa pedida sem ampliar o escopo.'];
    const allowedPaths = request.allowed_paths.length > 0
      ? request.allowed_paths.join(', ')
      : workspace;
    const blockedPaths = request.blocked_paths.length > 0
      ? request.blocked_paths.join(', ')
      : 'nenhum informado';
    const allowedCommands = request.allowed_commands.length > 0
      ? request.allowed_commands.join(', ')
      : 'use apenas as ferramentas necessarias dentro do workspace';
    const blockedCommands = request.blocked_commands.length > 0
      ? request.blocked_commands.join(', ')
      : 'nenhum informado';
    const allowedPathPolicyLines = allowedPathPolicies
      .map((policy) => {
        const accessLevel =
          policy.accessLevel === 'read_write'
            ? 'leitura e escrita'
            : 'somente leitura e listagem';
        return `- ${policy.path} (${accessLevel})`;
      })
      .filter(Boolean);
    const allowedCommandPolicyLines = allowedCommandPolicies
      .map((policy) => {
        const matchType =
          policy.matchType === 'prefix'
            ? 'prefixo aprovado'
            : 'comando exato aprovado';
        return `- ${policy.command} (${matchType})`;
      })
      .filter(Boolean);
    const writeScopePaths = allowedPathPolicies
      .filter((policy) => policy.accessLevel === 'read_write')
      .map((policy) => policy.path);
    const scopedWriteEnforced = writeScopePaths.length > 0;

    return [
      'Voce esta executando uma tarefa delegada pelo Zavorth.',
      `Workspace Windows aprovado: ${workspace}`,
      `Workspace WSL esperado: ${workspaceWsl}`,
      'Se o agente atual estiver preso a outro workspace ou repositorio, pare e responda exatamente: WORKSPACE_MISMATCH.',
      'Se precisar ler uma pasta ou arquivo fora de "Caminhos permitidos", pare e responda com a primeira linha exatamente neste formato: PATH_ACCESS_REQUIRED: <caminho absoluto>.',
      'Use o caminho mais especifico possivel. Pode ser caminho Windows (C:/...) ou WSL (/mnt/c/...). Depois, em outra linha, explique brevemente o motivo em English.',
      'Nao leia, escreva ou execute nada fora do workspace aprovado.',
      ...(scopedWriteEnforced
        ? [
            'Dentro do workspace aprovado, trate todo o restante como somente leitura.',
            'So escreva nos caminhos marcados como leitura e escrita nas permissoes extras aprovadas.',
          ]
        : []),
      '',
      `Objetivo: ${request.objective || 'Executar a tarefa delegada.'}`,
      '',
      'Instrucoes:',
      ...instructions,
      '',
      `Caminhos permitidos: ${allowedPaths}`,
      `Caminhos bloqueados: ${blockedPaths}`,
      `Comandos permitidos: ${allowedCommands}`,
      `Comandos bloqueados: ${blockedCommands}`,
      ...(allowedPathPolicyLines.length > 0
        ? [
            '',
            scopedWriteEnforced
              ? 'Permissoes extras aprovadas pelo operador (escrita apenas onde constar "leitura e escrita"):'
              : 'Permissoes extras aprovadas pelo operador (respeite exatamente estes limites):',
            ...allowedPathPolicyLines,
          ]
        : []),
      ...(allowedCommandPolicyLines.length > 0
        ? ['', 'Comandos extras aprovados pelo operador:', ...allowedCommandPolicyLines]
        : []),
      '',
      'No final, respond in English com um resumo curto do que foi feito, arquivos tocados e proximo risco relevante.',
    ].join('\n');
  }

  private async buildAgentInvocation(
    prompt: string,
    workspace: string,
    agentId: string,
  ): Promise<ExternalExecutorInvocation> {
    const agentArgs = [
      '--no-color',
      'agent',
      '--agent',
      agentId,
      '--thinking',
      this.settings.thinking,
      '--message',
      prompt,
    ];

    if (this.settings.transport === 'direct') {
      return {
        file: this.settings.cliPath,
        args: agentArgs,
        cwd: workspace,
      };
    }

    const args: string[] = [];
    const distro = await this.resolveWslDistro();
    if (distro) {
      args.push('-d', distro);
    }
    if (this.settings.wslUser) {
      args.push('-u', this.settings.wslUser);
    }

    args.push('-e', 'bash', '-lc', this.buildWslShellCommand([this.settings.command, ...agentArgs]));
    return {
      file: this.settings.cliPath,
      args,
    };
  }

  private async buildVersionInvocation(): Promise<ExternalExecutorInvocation> {
    if (this.settings.transport === 'direct') {
      return {
        file: this.settings.cliPath,
        args: ['--version'],
      };
    }

    const args: string[] = [];
    const distro = await this.resolveWslDistro();
    if (distro) {
      args.push('-d', distro);
    }
    if (this.settings.wslUser) {
      args.push('-u', this.settings.wslUser);
    }

    args.push('-e', 'bash', '-lc', this.buildWslShellCommand([this.settings.command, '--version']));
    return {
      file: this.settings.cliPath,
      args,
    };
  }

  private async buildWslGatewayStatusInvocation(): Promise<ExternalExecutorInvocation | null> {
    if (this.settings.transport !== 'wsl') {
      return null;
    }

    const args: string[] = [];
    const distro = await this.resolveWslDistro();
    if (distro) {
      args.push('-d', distro);
    }
    if (this.settings.wslUser) {
      args.push('-u', this.settings.wslUser);
    }

    args.push('-e', 'bash', '-lc', this.buildWslShellCommand([this.settings.command, '--no-color', 'gateway', 'status']));
    return {
      file: this.settings.cliPath,
      args,
    };
  }

  private async buildWslGatewayRestartInvocation(): Promise<ExternalExecutorInvocation | null> {
    if (this.settings.transport !== 'wsl') {
      return null;
    }

    const args: string[] = [];
    const distro = await this.resolveWslDistro();
    if (distro) {
      args.push('-d', distro);
    }
    if (this.settings.wslUser) {
      args.push('-u', this.settings.wslUser);
    }

    args.push('-e', 'systemctl', '--user', 'restart', EXTERNAL_EXECUTOR_GATEWAY_SERVICE_NAME);
    return {
      file: this.settings.cliPath,
      args,
    };
  }

  private async checkWslGatewayHealth(): Promise<ExternalExecutorGatewayHealth> {
    const invocation = await this.buildWslGatewayStatusInvocation();
    if (!invocation) {
      return { ok: true, detail: 'not_wsl' };
    }

    try {
      const { stdout, stderr } = this.normalizeCommandResult(await this.runner(invocation.file, invocation.args, {
        cwd: invocation.cwd,
        timeout: 20_000,
        maxBuffer: 1024 * 1024,
        windowsHide: true,
      }));
      const combined = `${this.cleanOutput(stdout)}\n${this.cleanOutput(stderr)}`.trim();
      return {
        ok: combined.includes('RPC probe: ok'),
        detail: combined || 'gateway_status_empty',
      };
    } catch (error: unknown) {
      const executionError = this.normalizeProcessError(error);
      return {
        ok: false,
        detail:
          this.cleanOutput(executionError.stderr)
          || this.cleanOutput(executionError.stdout)
          || this.cleanOutput(executionError.message)
          || 'gateway_status_failed',
      };
    }
  }

  private async restartWslGateway(): Promise<boolean> {
    const invocation = await this.buildWslGatewayRestartInvocation();
    if (!invocation) {
      return false;
    }

    try {
      await this.runner(invocation.file, invocation.args, {
        cwd: invocation.cwd,
        timeout: 30_000,
        maxBuffer: 1024 * 1024,
        windowsHide: true,
      });
      for (let attempt = 0; attempt < 8; attempt += 1) {
        await this.delay(3_000);
        const health = await this.checkWslGatewayHealth();
        if (health.ok) {
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  private scheduleBestEffortGatewayRecovery(): void {
    void (async () => {
      const gatewayHealth = await this.checkWslGatewayHealth();
      if (!gatewayHealth.ok) {
        await this.restartWslGateway();
      }
    })().catch(() => undefined);
  }

  private async runAgentInvocationWithRecovery(
    invocation: ExternalExecutorInvocation,
    timeoutSeconds: number,
  ): Promise<{ stdout: string; stderr: string; recoveredGateway: boolean }> {
    const runOnce = async (): Promise<ExternalExecutorCommandResult> =>
      this.normalizeCommandResult(await this.runner(invocation.file, invocation.args, {
        cwd: invocation.cwd,
        timeout: timeoutSeconds * 1000,
        maxBuffer: 10 * 1024 * 1024,
        windowsHide: true,
      }));

    try {
      const result = await runOnce();
      return { ...result, recoveredGateway: false };
    } catch (error: unknown) {
      if (!this.shouldRecoverGateway(error)) {
        throw error;
      }

      const restarted = await this.restartWslGateway();
      if (!restarted) {
        throw error;
      }

      const retryResult = await runOnce();
      return { ...retryResult, recoveredGateway: true };
    }
  }

  private shouldRecoverGateway(error: unknown): boolean {
    if (this.settings.transport !== 'wsl') {
      return false;
    }
    const executionError = this.normalizeProcessError(error);

    const haystack = [
      this.cleanOutput(executionError.message),
      this.cleanOutput(executionError.stderr),
      this.cleanOutput(executionError.stdout),
    ]
      .filter(Boolean)
      .join('\n')
      .toLowerCase();

    return (
      haystack.includes('gateway closed') ||
      haystack.includes('gateway timeout') ||
      haystack.includes('rpc probe: failed') ||
      haystack.includes('source: local loopback')
    );
  }

  private toWslPath(workspace: string): string {
    const normalized = workspace.replace(/\\/g, '/');
    const driveMatch = normalized.match(/^([A-Za-z]):\/(.*)$/);
    if (!driveMatch) {
      return normalized;
    }

    return `/mnt/${driveMatch[1].toLowerCase()}/${driveMatch[2]}`;
  }

  private formatCommand(file: string, args: string[]): string {
    return [file, ...args].map((value) => this.quoteForDisplay(value)).join(' ');
  }

  private getAvailabilityTimeoutMs(): number {
    if (this.settings.transport === 'wsl') {
      // Cold WSL boots can exceed 45s even when the external runner is installed and healthy.
      return 75_000;
    }

    return 15_000;
  }

  private buildWslShellCommand(parts: string[]): string {
    return parts.map((value) => this.quoteForShell(value)).join(' ');
  }

  private resolveAgentId(request: ExecutionRequest): string {
    const role = this.resolveAgentRole(request);
    const metadata = request.metadata || {};
    const taskMetadata = metadata.task_metadata || {};
    const bindingMap =
      metadata.external_executor_bindings ||
      metadata.external_executor_agent_bindings ||
      taskMetadata.external_executor_bindings ||
      taskMetadata.external_executor_agent_bindings;
    const roleBoundAgentId =
      bindingMap && typeof bindingMap === 'object'
        ? bindingMap[role] || (role === 'default' ? bindingMap.default : null)
        : null;
    const metadataAgentId =
      roleBoundAgentId ||
      metadata.external_executor_agent_id ||
      taskMetadata.external_executor_agent_id;

    return String(metadataAgentId || (role !== 'default' ? role : this.settings.agentId) || 'main').trim();
  }

  private resolveAgentRole(request: ExecutionRequest): string {
    const metadata = request.metadata || {};
    const taskMetadata = metadata.task_metadata || {};
    const metadataRole =
      metadata.external_executor_agent_role ||
      taskMetadata.external_executor_agent_role ||
      metadata.target_agent ||
      taskMetadata.target_agent;

    return String(metadataRole || 'default').trim().toLowerCase();
  }

  private async resolveWslDistro(): Promise<string | undefined> {
    if (this.settings.wslDistro) {
      return this.settings.wslDistro;
    }

    if (this.resolvedWslDistro !== undefined) {
      return this.resolvedWslDistro || undefined;
    }

    try {
      const { stdout } = this.normalizeCommandResult(await this.runner(this.settings.cliPath, ['-l', '-v'], {
        timeout: 15_000,
        maxBuffer: 1024 * 1024,
        windowsHide: true,
      }));
      const cleaned = stdout.replace(/\u0000/g, '');
      const lines = cleaned
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .filter((line) => !/^NAME\s+STATE\s+VERSION$/i.test(line));

      for (const line of lines) {
        const withoutMarker = line.replace(/^\*\s*/, '').trim();
        const parts = withoutMarker.split(/\s{2,}/);
        const name = parts[0]?.trim();
        if (!name) {
          continue;
        }
        if (/^docker-desktop/i.test(name)) {
          continue;
        }
        this.resolvedWslDistro = name;
        return name;
      }
    } catch {
      this.resolvedWslDistro = null;
      return undefined;
    }

    this.resolvedWslDistro = null;
    return undefined;
  }

  private quoteForDisplay(value: string): string {
    if (!/[\s"]/g.test(value)) {
      return value;
    }

    return `"${value.replace(/"/g, '\\"')}"`;
  }

  private quoteForShell(value: string): string {
    if (!/[\s"'$`\\]/.test(value)) {
      return value;
    }

    return `'${value.replace(/'/g, `'\"'\"'`)}'`;
  }

  private cleanOutput(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private normalizeCommandResult(value: unknown): ExternalExecutorCommandResult {
    if (typeof value === 'string') {
      return {
        stdout: value,
        stderr: '',
      };
    }

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {
        stdout: '',
        stderr: '',
      };
    }

    const record = value as Record<string, unknown>;
    return {
      stdout: stringifyProcessOutput(record.stdout),
      stderr: stringifyProcessOutput(record.stderr),
    };
  }

  private parsePathAccessRequest(output: string): {
    rawPath: string;
    windowsPath: string | null;
    wslPath: string | null;
    reason: string | null;
  } | null {
    const lines = String(output || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const requestLine = lines.find((line) => /^PATH_ACCESS_REQUIRED\s*:/i.test(line));
    if (!requestLine) {
      return null;
    }

    const rawPath = requestLine
      .replace(/^PATH_ACCESS_REQUIRED\s*:/i, '')
      .trim()
      .replace(/^['"`]+|['"`]+$/g, '')
      .replace(/[.,;:!?]+$/g, '');
    if (!rawPath) {
      return null;
    }

    const windowsPath = this.toWindowsPath(rawPath);
    const normalizedWindowsPath = windowsPath ? windowsPath.replace(/\\/g, '/') : null;
    const wslPath = rawPath.startsWith('/mnt/') ? rawPath : null;
    const reason = lines
      .filter((line) => line !== requestLine && !/^PATH_ACCESS_REQUIRED\b/i.test(line))
      .join('\n')
      .trim();

    return {
      rawPath,
      windowsPath: normalizedWindowsPath,
      wslPath,
      reason: reason || null,
    };
  }

  private toWindowsPath(rawPath: string): string | null {
    const trimmed = String(rawPath || '').trim();
    if (!trimmed) {
      return null;
    }

    const wslMatch = trimmed.match(/^\/mnt\/([a-z])\/(.*)$/i);
    if (wslMatch) {
      const drive = wslMatch[1].toUpperCase();
      const rest = String(wslMatch[2] || '').replace(/\\/g, '/');
      return `${drive}:/${rest}`;
    }

    if (/^[A-Za-z]:[\\/]/.test(trimmed)) {
      return trimmed;
    }

    return null;
  }

  private normalizePathPolicies(value: unknown): ExternalPathPolicy[] {
    return this.asRecordArray(value)
      .map((policy) => {
        const path = String(policy.path || '').trim();
        if (!path) {
          return null;
        }

        return {
          path,
          accessLevel: String(policy.access_level || '').trim().toLowerCase() === 'read_write'
            ? 'read_write'
            : 'read_only',
        } satisfies ExternalPathPolicy;
      })
      .filter((policy): policy is ExternalPathPolicy => policy !== null);
  }

  private normalizeCommandPolicies(value: unknown): ExternalCommandPolicy[] {
    return this.asRecordArray(value)
      .map((policy) => {
        const command = String(policy.command || '').trim();
        if (!command) {
          return null;
        }

        return {
          command,
          matchType: String(policy.match_type || '').trim().toLowerCase() === 'prefix'
            ? 'prefix'
            : 'exact',
        } satisfies ExternalCommandPolicy;
      })
      .filter((policy): policy is ExternalCommandPolicy => policy !== null);
  }

  private asRecordArray(value: unknown): Record<string, unknown>[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((entry): entry is Record<string, unknown> =>
      Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry),
    );
  }

  private normalizeProcessError(error: unknown): ExternalExecutorProcessError {
    if (error instanceof Error) {
      const record = error as Error & Record<string, unknown>;
      return Object.assign(error, {
        stdout: stringifyProcessOutput(record.stdout) || undefined,
        stderr: stringifyProcessOutput(record.stderr) || undefined,
        code: record.code,
      }) as ExternalExecutorProcessError;
    }

    if (error && typeof error === 'object' && !Array.isArray(error)) {
      const record = error as Record<string, unknown>;
      const normalized = new Error(String(record.message || 'External runner CLI falhou ao executar a tarefa.'));
      normalized.name = typeof record.name === 'string' ? record.name : normalized.name;
      return Object.assign(normalized, {
        stdout: stringifyProcessOutput(record.stdout) || undefined,
        stderr: stringifyProcessOutput(record.stderr) || undefined,
        code: record.code,
      });
    }

    return new Error(String(error || 'External runner CLI falhou ao executar a tarefa.'));
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
