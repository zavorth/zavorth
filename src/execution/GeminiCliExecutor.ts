import { v4 as uuidv4 } from 'uuid';
import { ExecutionRequest, ExecutionResult } from '../contracts/ExecutionContract.js';
import { IExecutor } from '../contracts/IExecutor.js';
import { config } from '../config/index.js';
import { spawnCommand } from '../core/CommandSpawn.js';
import { buildChildProcessEnv } from '../security/ChildProcessEnv.js';
import { WorkspaceResolver } from '../security/WorkspaceResolver.js';
import { logger } from '../logger.js';

/** Error returned by the Gemini CLI process with optional stderr output. */
interface GeminiCliProcessError extends Error {
  stderr?: string;
}

/** Structured error info produced by classifyExecutionError. */
interface ClassifiedError {
  errorCode: string;
  errorMessage: string;
  stderr: string | null;
  metadata?: Record<string, string>;
}

/** Type guard to check if a value is a GeminiCliProcessError. */
function isGeminiCliProcessError(err: unknown): err is GeminiCliProcessError {
  return err instanceof Error;
}

export function buildGeminiCliChildEnv(
  geminiApiKey: string | null | undefined = config.geminiApiKey,
  hostEnv: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  const resolvedApiKey = String(geminiApiKey || '').trim();
  return buildChildProcessEnv({
    explicitEnv: resolvedApiKey ? { GEMINI_API_KEY: resolvedApiKey } : {},
    hostEnv,
  });
}

/**
 * GeminiCliExecutor - Executa prompts via Gemini CLI (google/gemini-cli).
 *
 * Spawns the `gemini` process in non-interactive mode, captures stdout/stderr,
 * respeita timeouts e confina execucao ao workspace da task.
 */
export class GeminiCliExecutor implements IExecutor {
  public readonly name = 'gemini_cli';
  private readonly cliCommand = config.geminiCliCommand || (process.platform === 'win32' ? 'gemini.cmd' : 'gemini');

  public async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const startedAt = new Date().toISOString();
    const result: ExecutionResult = {
      execution_id: request.execution_id || uuidv4(),
      task_id: request.task_id,
      executor: this.name,
      success: false,
      started_at: startedAt,
      finished_at: '',
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
      metadata: {},
    };

    const prompt = request.instructions.join('\n').trim();
    if (!prompt) {
      result.error_message = 'No prompt was provided for Gemini CLI.';
      result.finished_at = new Date().toISOString();
      return result;
    }

    const timeoutMs = (request.timeout_seconds || 120) * 1000;

    try {
      const cwd = WorkspaceResolver.validate(request.workspace);
      const { stdout, stderr } = await this.spawnGemini(prompt, cwd, timeoutMs);
      result.stdout = stdout;
      result.stderr = stderr;
      result.success = true;
      result.actions_executed.push(`[GeminiCLI] Prompt executado (${prompt.length} chars)`);
      result.commands_executed.push(`gemini --prompt "${prompt.substring(0, 80)}..."`);
    } catch (error: any) { const err = error; const e = error;
      const classifiedError = this.classifyExecutionError(error);
      result.error_message = classifiedError.errorMessage;
      result.error_code = classifiedError.errorCode;
      result.stderr = classifiedError.stderr;
      result.metadata = {
        ...(result.metadata || {}),
        ...(classifiedError.metadata || {}),
      };
      result.actions_executed.push(`[GeminiCLI] Failure: ${classifiedError.errorMessage}`);
    }

    result.finished_at = new Date().toISOString();
    return result;
  }

  public async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const child = spawnCommand(this.cliCommand, ['--version'], {
        windowsHide: true,
        timeout: 5000,
      });

      let outputReceived = false;
      child.stdout?.on('data', () => {
        outputReceived = true;
      });
      child.on('close', (code) => resolve(code === 0 || outputReceived));
      child.on('error', () => resolve(false));
    });
  }

  private spawnGemini(prompt: string, cwd: string, timeoutMs: number): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const args = ['--output-format', 'text', '-p', prompt];
      const env = buildGeminiCliChildEnv();

      const child = spawnCommand(this.cliCommand, args, {
        cwd,
        windowsHide: true,
        env,
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (d: Buffer) => {
        stdout += d.toString();
      });
      child.stderr?.on('data', (d: Buffer) => {
        stderr += d.toString();
      });

      const timer = setTimeout(() => {
        try {
          child.kill('SIGKILL');
        } catch (err: any) { const error = err; const e = err; logger.warn("[auto-fix] Empty catch block", err); }
        reject(new Error(`Gemini CLI timeout apos ${timeoutMs / 1000}s`));
      }, timeoutMs);

      child.on('error', (e) => {
        clearTimeout(timer);
        reject(e);
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          const err = new Error(`Gemini CLI saiu com codigo ${code}`) as GeminiCliProcessError;
          err.stderr = stderr;
          reject(err);
        } else {
          resolve({ stdout, stderr });
        }
      });
    });
  }

  private classifyExecutionError(error: unknown): ClassifiedError {
    const rawStderr = String((isGeminiCliProcessError(error) ? error.stderr : null) || '').trim();
    const rawMessage = String((error instanceof Error ? error.message : null) || '').trim();
    const combined = `${rawMessage}\n${rawStderr}`.trim();
    const normalized = combined.toLowerCase();

    if (
      normalized.includes('quota exceeded') ||
      normalized.includes('exhausted your daily quota') ||
      normalized.includes('terminalquotaerror') ||
      normalized.includes('429')
    ) {
      return {
        errorCode: 'GEMINI_CLI_QUOTA_EXCEEDED',
        errorMessage:
          'Gemini CLI is unavailable right now because the API quota was exceeded. Wait for quota renewal or switch the key/model before trying again.',
        stderr: rawStderr || null,
        metadata: {
          gemini_failure_kind: 'quota_exceeded',
        },
      };
    }

    if (normalized.includes('api key') && normalized.includes('invalid')) {
      return {
        errorCode: 'GEMINI_CLI_AUTH_ERROR',
        errorMessage:
          'Gemini CLI falhou por autenticacao invalida. Verifique a chave GEMINI_API_KEY antes de tentar novamente.',
        stderr: rawStderr || null,
        metadata: {
          gemini_failure_kind: 'auth_error',
        },
      };
    }

    if (normalized.includes('timeout')) {
      return {
        errorCode: 'GEMINI_CLI_TIMEOUT',
        errorMessage: rawMessage || 'Gemini CLI excedeu o tempo limite da execucao.',
        stderr: rawStderr || null,
        metadata: {
          gemini_failure_kind: 'timeout',
        },
      };
    }

    return {
      errorCode: 'GEMINI_CLI_ERROR',
      errorMessage: rawMessage || 'Gemini CLI falhou durante a execucao.',
      stderr: rawStderr || null,
      metadata: {
        gemini_failure_kind: 'generic_error',
      },
    };
  }
}
