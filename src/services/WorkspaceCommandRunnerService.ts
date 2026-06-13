import { execFile } from 'child_process';
import crypto from 'crypto';
import path from 'path';
import { WorkspacePathGuard } from '../mcp/workspace/WorkspacePathGuard.js';
import { SecurityAuditLogger } from './SecurityAuditLogger.js';
import { LogRepository } from '../storage/LogRepository.js';

export interface CommandExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  timeoutFlag: boolean;
  truncatedFlag: boolean;
}

export class WorkspaceCommandRunnerService {
  private readonly auditLogger: SecurityAuditLogger;

  constructor(auditLogger?: SecurityAuditLogger) {
    this.auditLogger = auditLogger || new SecurityAuditLogger(new LogRepository());
  }

  public async executeCommand(
    commandStr: string,
    cwd: string,
    workspaceRoot: string,
    timeoutMs: number = 30000,
    riskLevel: string = 'HIGH'
  ): Promise<CommandExecutionResult> {
    // 1. Validate cwd with WorkspacePathGuard
    const guard = new WorkspacePathGuard(workspaceRoot);
    const resolvedCwd = guard.resolveExisting(cwd);

    // 2. Parse commandStr into file and args
    const parsed = this.parseCommand(commandStr);
    if (!parsed) {
      throw new Error(`Failed to parse command: ${commandStr}`);
    }

    const { binary, args } = parsed;

    // 3. Env sanitization
    const sanitizedEnv = { ...process.env };
    for (const key of Object.keys(sanitizedEnv)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('token') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('key') ||
        lowerKey.includes('password') ||
        lowerKey.includes('passphrase') ||
        lowerKey.includes('auth') ||
        lowerKey.includes('jwt') ||
        lowerKey.includes('private') ||
        lowerKey.includes('credential')
      ) {
        delete sanitizedEnv[key];
      }
    }

    // 4. Execute using execFile (shell: false, windowsHide: true)
    const startTime = Date.now();
    let exitCode = 0;
    let stdout = '';
    let stderr = '';
    let timeoutFlag = false;
    let truncatedFlag = false;

    try {
      const execPromise = new Promise<{ stdout: string; stderr: string; code: number | null }>((resolve) => {
        execFile(binary, args, {
          cwd: resolvedCwd,
          env: sanitizedEnv,
          timeout: timeoutMs,
          windowsHide: true,
          shell: false,
          maxBuffer: 1024 * 1024 * 5
        }, (error, childStdout, childStderr) => {
          if (error) {
            const execError = error as any;
            if (execError.killed || execError.signal === 'SIGTERM') {
              timeoutFlag = true;
            }
            resolve({
              stdout: childStdout || '',
              stderr: childStderr || '',
              code: execError.code !== undefined ? execError.code : 1
            });
          } else {
            resolve({
              stdout: childStdout,
              stderr: childStderr,
              code: 0
            });
          }
        });
      });

      const res = await execPromise;
      stdout = res.stdout;
      stderr = res.stderr;
      exitCode = res.code !== null ? res.code : 0;
    } catch (err: any) {
      exitCode = err.code !== undefined ? err.code : 1;
      stderr = err.message || 'Unknown execution error';
    }

    const durationMs = Date.now() - startTime;

    // 5. Truncate outputs to 10,000 characters
    const maxChars = 10000;
    if (stdout.length > maxChars) {
      stdout = stdout.slice(0, maxChars) + '\n... [TRUNCATED]';
      truncatedFlag = true;
    }
    if (stderr.length > maxChars) {
      stderr = stderr.slice(0, maxChars) + '\n... [TRUNCATED]';
      truncatedFlag = true;
    }

    // 6. Security Audit Log
    const commandHash = crypto.createHash('sha256').update(commandStr).digest('hex');
    const redactedCommand = this.redactSecrets(commandStr);

    this.auditLogger.logWorkspaceEvent({
      event: 'command_executed',
      workspaceId: path.basename(workspaceRoot),
      toolName: 'workspace.command.run',
      operation: 'execute-command',
      reason: redactedCommand,
      metadata: {
        exitCode,
        durationMs,
        timeoutFlag,
        truncatedFlag,
        riskLevel,
        commandHash,
        redactedCommandPreview: redactedCommand.slice(0, 100)
      }
    });

    return {
      exitCode,
      stdout,
      stderr,
      durationMs,
      timeoutFlag,
      truncatedFlag
    };
  }

  private parseCommand(command: string): { binary: string; args: string[] } | null {
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
      return null;
    }
    if (current) {
      tokens.push(current);
    }
    if (tokens.length === 0) {
      return null;
    }

    return {
      binary: tokens[0],
      args: tokens.slice(1),
    };
  }

  private redactSecrets(command: string): string {
    const assignmentPattern = /((?:api[_-]?key|token|secret|password|passwd|passphrase|private[_-]?key|auth|credential|jwt|bearer|key)\s*[:=]\s*["']?)([a-zA-Z0-9_\-.~%+]{8,})(["']?)/gi;
    let redacted = command.replace(assignmentPattern, '$1[REDACTED]$3');

    const githubTokenPattern = /\b(gh[pous]_)[a-zA-Z0-9]{36,}\b/g;
    redacted = redacted.replace(githubTokenPattern, '$1[REDACTED]');

    const awsKeyPattern = /\b(AKIA)[A-Z0-9]{16}\b/g;
    redacted = redacted.replace(awsKeyPattern, '$1[REDACTED]');

    const slackTokenPattern = /\b(xox[baprs]-[0-9]{10,12}-)[a-zA-Z0-9]{24,48}\b/g;
    redacted = redacted.replace(slackTokenPattern, '$1[REDACTED]');

    const openAiKeyPattern = /\b(sk-)[a-zA-Z0-9]{48,}\b/g;
    redacted = redacted.replace(openAiKeyPattern, '$1[REDACTED]');

    return redacted;
  }
}
