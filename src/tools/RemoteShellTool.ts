import { execFile } from 'child_process';
import crypto from 'crypto';
import { promisify } from 'util';
import { RuntimeEphemeralShellAdapter } from '../services/RuntimeEphemeralShellAdapter.js';
import { RuntimeIsolatedShellSidecarService } from '../services/RuntimeIsolatedShellSidecarService.js';
import { RuntimeIsolationGuardService } from '../services/RuntimeIsolationGuardService.js';
import { BaseTool } from './BaseTool.js';

const execFileAsync = promisify(execFile);

const DEFAULT_ALLOWED_BINARIES = [
  'git',
  'node',
  'npm',
  'npm.cmd',
  'pnpm',
  'pnpm.cmd',
  'yarn',
  'yarn.cmd',
  'python',
  'python3',
  'py',
  'tsc',
  'tsc.cmd',
];

const FORBIDDEN_SHELL_TOKENS = /[;&|<>`$]/u;
const FORBIDDEN_BINARIES = new Set([
  'bash',
  'bitsadmin',
  'certutil',
  'cmd',
  'cmd.exe',
  'curl',
  'del',
  'erase',
  'powershell',
  'powershell.exe',
  'pwsh',
  'pwsh.exe',
  'reg',
  'reg.exe',
  'rm',
  'sh',
  'wget',
]);

const HOST_CODE_BINARIES = new Set([
  'node',
  'node.exe',
  'python',
  'python.exe',
  'python3',
  'python3.exe',
  'py',
  'py.exe',
  'npm',
  'npm.cmd',
  'npx',
  'npx.cmd',
  'pnpm',
  'pnpm.cmd',
  'yarn',
  'yarn.cmd',
]);

type ParsedCommand =
  | { ok: true; file: string; args: string[] }
  | { ok: false; error: string };

type PolicyDecision =
  | { ok: true }
  | { ok: false; error: string };

type RemoteShellToolOptions = {
  isolationGuard?: RuntimeIsolationGuardService;
  ephemeralAdapter?: Pick<RuntimeEphemeralShellAdapter, 'execute'> | null;
  sidecarAdapter?: Pick<RuntimeIsolatedShellSidecarService, 'execute' | 'isConfigured'> | null;
};

/**
 * Remote shell is intentionally narrow: no subshell, positive allowlist,
 * and audit hash per invocation. Broader host execution must go through
 * governed execution/sandbox flows instead of this interactive tool.
 */
export class RemoteShellTool extends BaseTool {
  public readonly name = 'remote_shell';
  public readonly description = 'Executa comandos allowlisted no host sem subshell. Shells, pipes, redirecionamento e downloaders sao bloqueados.';
  private readonly isolationGuard: RuntimeIsolationGuardService;
  private readonly ephemeralAdapter: Pick<RuntimeEphemeralShellAdapter, 'execute'> | null;
  private readonly sidecarAdapter: Pick<RuntimeIsolatedShellSidecarService, 'execute' | 'isConfigured'> | null;

  public readonly parameters = {
    type: 'object' as const,
    properties: {
      command: {
        type: 'string',
        description: 'Comando allowlisted sem metacaracteres de shell. Ex: "git status" ou "npm test".',
      },
      timeoutMs: {
        type: 'number',
        description: 'Tempo maximo em ms. Default: 10000. Maximo: 60000.',
      },
      isolationMode: {
        type: 'string',
        enum: ['guarded', 'host', 'ephemeral', 'sidecar'],
        description: 'Modo opcional de isolamento. Use "sidecar" para shell amplo em container/MicroVM; use "ephemeral" para workspace temporario local.',
      },
      requiredIsolation: {
        type: 'string',
        enum: ['auto', 'container', 'microvm'],
        description: 'Quando isolationMode=sidecar, exige container ou MicroVM. MicroVM nunca cai para host/container.',
      },
    },
    required: ['command'],
  };

  constructor(options: RemoteShellToolOptions = {}) {
    super();
    this.isolationGuard = options.isolationGuard || new RuntimeIsolationGuardService();
    this.ephemeralAdapter = options.ephemeralAdapter === null
      ? null
      : options.ephemeralAdapter || new RuntimeEphemeralShellAdapter();
    this.sidecarAdapter = options.sidecarAdapter === null
      ? null
      : options.sidecarAdapter || new RuntimeIsolatedShellSidecarService();
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const command = args.command;
    let timeoutMs = Number(args.timeoutMs || 10000);

    if (timeoutMs > 60000) timeoutMs = 60000;
    if (timeoutMs < 1000) timeoutMs = 1000;

    if (!command || typeof command !== 'string') {
      return 'Erro: o parametro "command" e obrigatorio e deve ser uma string.';
    }

    const parsed = this.parseCommand(command);
    if (!parsed.ok) {
      return parsed.error;
    }

    const requestedIsolationMode = this.resolveRequestedIsolationMode(parsed.file, args.isolationMode);
    const wantsSidecar = String(requestedIsolationMode || process.env.ZAVORTH_REMOTE_SHELL_ISOLATION || '')
      .trim()
      .toLowerCase() === 'sidecar';
    const isolationDecision = this.isolationGuard.guard({
      surface: 'remote_shell',
      action: parsed.file,
      argv: [parsed.file, ...parsed.args],
      requestedMode: requestedIsolationMode,
      ephemeralAdapterAvailable: Boolean(this.ephemeralAdapter),
      sidecarAvailable: wantsSidecar ? Boolean(this.sidecarAdapter?.isConfigured()) : false,
    });
    if (!isolationDecision.ok) {
      return `Erro: ${isolationDecision.reason}`;
    }

    if (isolationDecision.mode === 'sidecar') {
      return this.executeSidecar(command, timeoutMs, args.requiredIsolation);
    }

    const policy = this.validateCommand(parsed.file, parsed.args, command, isolationDecision.mode);
    if (!policy.ok) {
      return policy.error;
    }

    try {
      const auditHash = crypto
        .createHash('sha256')
        .update(`${isolationDecision.mode}:${command}`)
        .digest('hex')
        .slice(0, 16);
      console.log(`[RemoteShell] executing allowlisted binary "${parsed.file}" (audit=${auditHash}, isolation=${isolationDecision.mode})`);

      const { stdout, stderr } =
        isolationDecision.mode === 'ephemeral'
          ? await this.executeEphemeral(parsed.file, parsed.args, timeoutMs, command)
          : await execFileAsync(parsed.file, parsed.args, {
              timeout: timeoutMs,
              cwd: process.cwd(),
              windowsHide: true,
              maxBuffer: 1024 * 1024,
            });

      let output = '';
      if (stdout) output += `[STDOUT]\n${stdout}\n`;
      if (stderr) output += `[STDERR]\n${stderr}\n`;

      if (!output) {
        return 'O comando foi executado com sucesso e nao retornou saida.';
      }

      if (output.length > 5000) {
        output = `${output.substring(0, 5000)}...\n\n[AVISO: saida truncada; excedeu 5000 caracteres.]`;
      }

      return output.trim();
    } catch (error: unknown) {
      const execError = error as {
        code?: unknown;
        stdout?: unknown;
        stderr?: unknown;
        killed?: unknown;
      };
      let errorOutput = `Erro ao executar "${parsed.file}":\n`;
      errorOutput += `Return Code: ${execError.code ?? 'unknown'}\n`;
      if (execError.stdout) errorOutput += `\n[STDOUT PARCIAL]\n${String(execError.stdout)}`;
      if (execError.stderr) errorOutput += `\n[STDERR PARCIAL]\n${String(execError.stderr)}`;
      if (execError.killed) {
        errorOutput += `\n\n[AVISO: comando encerrado por timeout (${timeoutMs}ms).]`;
      }
      return errorOutput.trim();
    }
  }

  private validateCommand(
    file: string,
    args: string[],
    originalCommand: string,
    isolationMode: string,
  ): PolicyDecision {
    const binary = file.toLowerCase();
    const commandForTokenScan = originalCommand.replace(/<SecretRef:[A-Za-z0-9_.:-]+>/g, 'SECRET_REF');
    if (FORBIDDEN_SHELL_TOKENS.test(commandForTokenScan)) {
      return {
        ok: false,
        error: 'Erro: remote_shell bloqueou metacaracteres de shell. Use uma tool estruturada ou comando allowlisted sem ;, &, |, <, >, ` ou $().',
      };
    }
    if (FORBIDDEN_BINARIES.has(binary)) {
      return {
        ok: false,
        error: `Erro: binario "${file}" bloqueado. Shells, downloaders e comandos destrutivos nao sao permitidos.`,
      };
    }
    if (!this.allowedBinaries().has(binary)) {
      return {
        ok: false,
        error: `Erro: binario "${file}" nao esta na allowlist. Configure ZAVORTH_REMOTE_SHELL_ALLOWED_BINARIES para permitir explicitamente.`,
      };
    }
    if (
      HOST_CODE_BINARIES.has(binary)
      && isolationMode === 'ephemeral'
      && process.env.ZAVORTH_REMOTE_SHELL_ALLOW_EPHEMERAL_CODE !== 'true'
    ) {
      return {
        ok: false,
        error:
          `Erro: "${file}" pode executar codigo ou scripts. Use isolationMode="sidecar" ` +
          'ou a tool run_sandbox_code; ephemeral para codigo exige ZAVORTH_REMOTE_SHELL_ALLOW_EPHEMERAL_CODE=true.',
      };
    }
    if (
      HOST_CODE_BINARIES.has(binary)
      && isolationMode !== 'sidecar'
      && isolationMode !== 'ephemeral'
      && !(isolationMode === 'host' && process.env.ZAVORTH_REMOTE_SHELL_HOST_BREAK_GLASS === 'true')
    ) {
      return {
        ok: false,
        error:
          `Erro: "${file}" pode executar codigo ou scripts. Use isolationMode="sidecar" ` +
          'ou a tool run_sandbox_code; execucao direta no host exige isolationMode="host" e ZAVORTH_REMOTE_SHELL_HOST_BREAK_GLASS=true.',
      };
    }
    if (args.some((arg) => arg.length > 2000)) {
      return {
        ok: false,
        error: 'Erro: argumento grande demais para remote_shell.',
      };
    }
    return { ok: true };
  }

  private async executeEphemeral(
    file: string,
    args: string[],
    timeoutMs: number,
    command: string,
  ): Promise<{ stdout: string; stderr: string }> {
    if (!this.ephemeralAdapter) {
      throw new Error('Adapter efemero indisponivel para remote_shell.');
    }

    const result = await this.ephemeralAdapter.execute({
      file,
      args,
      timeoutMs,
      auditSeed: command,
    });
    console.log(`[RemoteShell] ephemeral adapter completed (audit=${result.auditId}, cleanup=${result.workspaceRemoved ? 'completed' : 'unknown'})`);
    return {
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }

  private async executeSidecar(
    command: string,
    timeoutMs: number,
    requiredLevel: unknown,
  ): Promise<string> {
    if (!this.sidecarAdapter) {
      throw new Error('Sidecar isolado indisponivel para remote_shell.');
    }

    const result = await this.sidecarAdapter.execute({
      command,
      timeoutMs,
      requiredLevel: requiredLevel === 'container' || requiredLevel === 'microvm' ? requiredLevel : 'auto',
    });
    console.log(`[RemoteShell] sidecar completed (audit=${result.auditId}, runtime=${result.runtime}, policy=${result.policyLevel})`);

    let output = `Sidecar ${result.policyLevel} (${result.runtime}) - exit code ${result.exitCode} - audit ${result.auditId}\n`;
    output += `Motivo da policy: ${result.policyReason}\n`;
    if (result.stdout) output += `[STDOUT]\n${result.stdout}\n`;
    if (result.stderr) output += `[STDERR]\n${result.stderr}\n`;
    return output.trim();
  }

  private allowedBinaries(): Set<string> {
    const configured = String(process.env.ZAVORTH_REMOTE_SHELL_ALLOWED_BINARIES || '').trim();
    const values = configured
      ? configured.split(',').map((entry) => entry.trim()).filter(Boolean)
      : DEFAULT_ALLOWED_BINARIES;
    return new Set(values.map((entry) => entry.toLowerCase()));
  }

  private resolveRequestedIsolationMode(file: string, requestedMode: unknown): unknown {
    const normalizedRequested = String(requestedMode || '').trim();
    if (normalizedRequested) {
      return normalizedRequested;
    }

    const binary = file.toLowerCase();
    if (
      HOST_CODE_BINARIES.has(binary)
      && process.env.ZAVORTH_REMOTE_SHELL_ALLOW_HOST_CODE_BINARIES !== 'true'
      && this.sidecarAdapter?.isConfigured()
    ) {
      return 'sidecar';
    }

    return requestedMode;
  }

  private parseCommand(command: string): ParsedCommand {
    const tokens: string[] = [];
    let current = '';
    let quote: '"' | "'" | null = null;

    for (let index = 0; index < command.length; index += 1) {
      const char = command[index];
      if ((char === '"' || char === "'") && !quote) {
        quote = char;
        continue;
      }
      if (quote === char) {
        quote = null;
        continue;
      }
      if (!quote && /\s/u.test(char)) {
        if (current) {
          tokens.push(current);
          current = '';
        }
        continue;
      }
      current += char;
    }

    if (quote) {
      return { ok: false, error: 'Erro: aspas nao fechadas no comando.' };
    }
    if (current) {
      tokens.push(current);
    }
    if (tokens.length === 0) {
      return { ok: false, error: 'Erro: comando vazio.' };
    }

    return {
      ok: true,
      file: tokens[0],
      args: tokens.slice(1),
    };
  }
}
