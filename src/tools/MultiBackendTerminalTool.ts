
import { execFile } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '../providers/ILlmProvider.js';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';

const execFileAsync = promisify(execFile);

type ShellBackend = 'bash' | 'zsh' | 'powershell' | 'cmd' | 'fish' | 'nushell';

interface ShellConfig {
  binary: string;
  argsPrefix: string[];
}

const SHELL_CONFIGS: Record<ShellBackend, ShellConfig> = {
  bash: { binary: 'bash', argsPrefix: ['-c'] },
  zsh: { binary: 'zsh', argsPrefix: ['-c'] },
  powershell: { binary: os.platform() === 'win32' ? 'powershell.exe' : 'pwsh', argsPrefix: ['-Command'] },
  cmd: { binary: 'cmd.exe', argsPrefix: ['/c'] },
  fish: { binary: 'fish', argsPrefix: ['-c'] },
  nushell: { binary: 'nu', argsPrefix: ['-c'] },
};

export class MultiBackendTerminalTool extends BaseTool {
  public readonly name = 'terminal_backend';

  public readonly description =
    'Runs commands across different terminal backends (bash, zsh, powershell, cmd, fish, nushell).';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'Command to execute.',
      },
      backend: {
        type: 'string',
        description: "Terminal backend: 'bash', 'zsh', 'powershell', 'cmd', 'fish', 'nushell'. Default: auto-detected.",
      },
      working_directory: {
        type: 'string',
        description: 'Working directory for execution.',
      },
      timeout_ms: {
        type: 'number',
        description: 'Timeout in milliseconds (1000-120000). Default: 30000.',
      },
    },
    required: ['command'],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const command = String(args.command || '');
    if (!command) {
      return 'Error: the "command" parameter is required.';
    }

    const backend = String(args.backend || this.detectDefaultShell()) as ShellBackend;
    const validBackends: ShellBackend[] = ['bash', 'zsh', 'powershell', 'cmd', 'fish', 'nushell'];
    if (!validBackends.includes(backend)) {
      return `Error: invalid backend "${backend}" is invalid. Use: ${validBackends.join(', ')}.`;
    }

    let timeoutMs = typeof args.timeout_ms === 'number' ? args.timeout_ms : 30000;
    timeoutMs = Math.min(Math.max(timeoutMs, 1000), 120000);

    let cwd = process.cwd();
    if (typeof args.working_directory === 'string' && args.working_directory.trim()) {
      const resolvedCwd = path.resolve(args.working_directory);
      const workspaceRoot = path.resolve(process.cwd());
      const relative = path.relative(workspaceRoot, resolvedCwd);
      const isContained = !relative.startsWith('..') && !path.isAbsolute(relative);
      if (!isContained && resolvedCwd !== workspaceRoot) {
        return `Error: working directory "${args.working_directory}" is outside the allowed workspace root (${workspaceRoot}).`;
      }
      cwd = resolvedCwd;
    }

    const config = SHELL_CONFIGS[backend];

    try {
      const isAvailable = await this.checkShellAvailable(config.binary);
      if (!isAvailable) {
        const fallback = this.detectDefaultShell();
        if (fallback === backend) {
          return `Error: shell "${backend}" is not available on this system and no fallback was found.`;
        }
        return this.executeWithBackend(command, fallback, cwd, timeoutMs, backend);
      }

      return this.executeWithBackend(command, backend, cwd, timeoutMs);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Multi Backend Terminal] process execution failed', error);
    const message = error instanceof Error ? err.message : String(error);
      return `Failed to run command on backend "${backend}": ${message}`;
  }
  }

  private async executeWithBackend(
    command: string,
    backend: ShellBackend,
    cwd: string,
    timeoutMs: number,
    originalBackend?: ShellBackend,
  ): Promise<string> {
    const config = SHELL_CONFIGS[backend];
    const args = [...config.argsPrefix, command];

    try {
      const { stdout, stderr } = await execFileAsync(config.binary, args, {
        timeout: timeoutMs,
        cwd,
        windowsHide: true,
        maxBuffer: 5 * 1024 * 1024,
      });

      let output = '';
      if (originalBackend) {
        output += `[WARNING: backend "${originalBackend}" unavailable. Using "${backend}" as fallback.]\n`;
      }
      output += `[Backend: ${backend}]\n`;
      if (stdout) output += `[STDOUT]\n${stdout}\n`;
      if (stderr) output += `[STDERR]\n${stderr}\n`;

      if (!output.includes('[STDOUT]') && !output.includes('[STDERR]')) {
        output += 'Command completed successfully with no output.';
      }

      return output.trim();
    } catch (error: unknown) {const execError = error as { code?: unknown; stdout?: unknown; stderr?: unknown; killed?: unknown };
      let errorOutput = '';
      if (originalBackend) {
        errorOutput += `[WARNING: backend "${originalBackend}" unavailable. Retrying with "${backend}".]\n`;
      }
      errorOutput += `Error running command on backend "${backend}":\n`;
      errorOutput += `Return Code: ${execError.code ?? 'unknown'}\n`;
      if (execError.stdout) errorOutput += `[STDOUT PARTIAL]\n${String(execError.stdout)}`;
      if (execError.stderr) errorOutput += `[STDERR PARTIAL]\n${String(execError.stderr)}`;
      if (execError.killed) {
        errorOutput += `[WARNING: command ended by timeout (${timeoutMs}ms).]`;
      }
      return errorOutput.trim();
    }
  }

  private async checkShellAvailable(binary: string): Promise<boolean> {
    try {
      const checkCommand = os.platform() === 'win32' ? 'where' : 'which';
      const checkArg = os.platform() === 'win32' ? binary : binary;
      await execFileAsync(checkCommand, [checkArg], { timeout: 5000, windowsHide: true });
      return true;
    } catch (error: unknown) {logger.warn('[Multi Backend Terminal] process execution failed', error); return false; }
  }

  private detectDefaultShell(): ShellBackend {
    const platform = os.platform();
    if (platform === 'win32') {
      return 'powershell';
    }
    return 'bash';
  }
}
