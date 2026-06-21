import { execFile } from 'child_process';
import crypto from 'crypto';
import { SecurityAuditLogger } from './SecurityAuditLogger.js';
import { LogRepository } from '../storage/LogRepository.js';

export interface HostCommandExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  timeoutFlag: boolean;
  truncatedFlag: boolean;
}

export class HostCommandRunnerService {
  private readonly auditLogger: SecurityAuditLogger;

  constructor(auditLogger?: SecurityAuditLogger) {
    this.auditLogger = auditLogger || new SecurityAuditLogger(new LogRepository());
  }

  public async executeCommand(
    workspaceId: string,
    command: string,
    args: string[],
    cwd: string,
    shell: boolean,
    timeoutMs: number = 30000,
    riskLevel: string = 'HIGH'
  ): Promise<HostCommandExecutionResult> {
    // 1. Env sanitization - allowlist ONLY
    const allowedKeys = ['PATH', 'SYSTEMROOT', 'WINDIR', 'HOME', 'USERPROFILE', 'TEMP', 'TMP'];
    const sanitizedEnv: Record<string, string> = {};
    for (const key of Object.keys(process.env)) {
      const upperKey = key.toUpperCase();
      if (allowedKeys.includes(upperKey)) {
        sanitizedEnv[key] = process.env[key] || '';
      }
    }

    const startTime = Date.now();
    let exitCode = 0;
    let stdout = '';
    let stderr = '';
    let timeoutFlag = false;
    let truncatedFlag = false;

    try {
      const execPromise = new Promise<{ stdout: string; stderr: string; code: number | null }>((resolve) => {
        execFile(
          command,
          args,
          {
            cwd,
            env: sanitizedEnv,
            timeout: timeoutMs,
            windowsHide: true,
            shell: shell,
            maxBuffer: 1024 * 1024 * 5
          },
          (error, childStdout, childStderr) => {
            if (error) {
              const execError = error as any;
              if (execError.killed || execError.signal === 'SIGTERM' || execError.signal === 'SIGKILL') {
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
          }
        );
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

    // 2. Truncate outputs to 10,000 characters
    const maxChars = 10000;
    if (stdout.length > maxChars) {
      stdout = stdout.slice(0, maxChars) + '\n... [TRUNCATED]';
      truncatedFlag = true;
    }
    if (stderr.length > maxChars) {
      stderr = stderr.slice(0, maxChars) + '\n... [TRUNCATED]';
      truncatedFlag = true;
    }

    // 3. Security Audit Log
    const commandHash = crypto.createHash('sha256').update(command).digest('hex');
    const assignmentPattern = /((?:api[_-]?key|token|secret|password|passwd|passphrase|private[_-]?key|auth|credential|jwt|bearer|key)\s*[:=]\s*["']?)([a-zA-Z0-9_\-.~%+]{8,})(["']?)/gi;
    const redactedCommand = command.replace(assignmentPattern, '$1[REDACTED]$3');

    this.auditLogger.logWorkspaceEvent({
      event: 'host_command_executed',
      workspaceId,
      toolName: 'workspace.host_command.run',
      operation: 'execute',
      reason: redactedCommand.slice(0, 100),
      metadata: {
        exitCode,
        durationMs,
        timeoutFlag,
        truncatedFlag,
        riskLevel,
        commandHash,
        shell
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
}
