import { execFile } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import { logger } from '../logger.js';

const execFileAsync = promisify(execFile);

export type RuntimeEphemeralShellRequest = {
  file: string;
  args: string[];
  timeoutMs: number;
  auditSeed: string;
};

export type RuntimeEphemeralShellResult = {
  stdout: string;
  stderr: string;
  auditId: string;
  workspaceRemoved: boolean;
};

export class RuntimeEphemeralShellAdapter {
  constructor(private readonly basePath = path.join(os.tmpdir(), 'zavorth-remote-shell')) {}

  public async execute(request: RuntimeEphemeralShellRequest): Promise<RuntimeEphemeralShellResult> {
    fs.mkdirSync(this.basePath, { recursive: true });
    const workspace = fs.mkdtempSync(path.join(this.basePath, 'run-'));
    const auditId = crypto.createHash('sha256').update(request.auditSeed).digest('hex').slice(0, 16);
    let stdout = '';
    let stderr = '';
    let workspaceRemoved = false;

    try {
      const result = await execFileAsync(request.file, request.args, {
        timeout: request.timeoutMs,
        cwd: workspace,
        env: this.buildSanitizedEnv(workspace),
        windowsHide: true,
        maxBuffer: 1024 * 1024,
      });
      stdout = result.stdout;
      stderr = result.stderr;
    } finally {
      try {
        fs.rmSync(workspace, { recursive: true, force: true });
        workspaceRemoved = true;
      } catch (error: unknown) {logger.warn('[Runtime Ephemeral Shell Adapter] delete operation failed', error);
    workspaceRemoved = false;
  }
    }

    return {
      stdout,
      stderr,
      auditId,
      workspaceRemoved,
    };
  }

  private buildSanitizedEnv(workspace: string): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = {
      PATH: process.env.PATH || process.env.Path || '',
      TMP: workspace,
      TEMP: workspace,
      TMPDIR: workspace,
      HOME: workspace,
      USERPROFILE: workspace,
      NO_COLOR: '1',
      ZAVORTH_EPHEMERAL_EXECUTION: 'true',
    };

    if (process.env.Path) {
      env.Path = process.env.Path;
    }

    if (process.platform === 'win32') {
      env.SystemRoot = process.env.SystemRoot || 'C:\\Windows';
      env.ComSpec = process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe';
      env.PATHEXT = process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD';
    }

    return env;
  }
}
