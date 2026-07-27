import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { spawnCommand } from '../../core/CommandSpawn.js';
import { logger } from '../../logger.js';
import type {
ISandboxRuntime,
  SandboxLanguage,
  SandboxRequest,
  SandboxResult,
} from './ISandboxRuntime.js';

export class LocalJailSandboxRuntime implements ISandboxRuntime {
  public readonly securityLevel = 'local-jail' as const;
  private static readonly BLOCKED_ENV_NAMES = new Set([
    'all_proxy',
    'anthropic_api_key',
    'aws_access_key_id',
    'aws_secret_access_key',
    'azure_openai_api_key',
    'comspec',
    'gemini_api_key',
    'google_api_key',
    'home',
    'http_proxy',
    'https_proxy',
    'openai_api_key',
    'path',
    'pathext',
    'systemroot',
    'temp',
    'tmp',
    'tmpdir',
    'userprofile',
  ]);
  private readonly jailBasePath: string;

  constructor(basePath = path.join(os.tmpdir(), 'zavorth_local_jails')) {
    this.jailBasePath = basePath;
    if (!fs.existsSync(this.jailBasePath)) {
      fs.mkdirSync(this.jailBasePath, { recursive: true });
    }
  }

  public async execute(request: SandboxRequest): Promise<SandboxResult> {
    if (request.language === 'shell' && process.env.ZAVORTH_ALLOW_LOCAL_JAIL_SHELL !== 'true') {
      return {
        stdout: '',
        stderr:
          '[LocalJail] Shell execution is blocked in local-jail. Use container or microvm sandbox.',
        exitCode: -1,
        executionTimeMs: 0,
        securityLevel: this.securityLevel,
        runtime: 'LocalJailSandboxRuntime',
      };
    }

    const jailId = `jail_${uuidv4().slice(0, 8)}`;
    const jailPath = path.join(this.jailBasePath, jailId);
    fs.mkdirSync(jailPath, { recursive: true });

    const prepared = this.prepareScript(request.language, request.code, jailPath);
    const startedAt = Date.now();

    try {
      const result = await this.runProcess(
        prepared.command,
        prepared.args,
        jailPath,
        request.timeoutMs || 15_000,
        this.buildSanitizedEnv(jailPath, request.env),
      );

      return {
        ...result,
        executionTimeMs: Date.now() - startedAt,
        securityLevel: this.securityLevel,
        runtime: 'LocalJailSandboxRuntime',
      };
    } finally {
      try {
        fs.rmSync(jailPath, { recursive: true, force: true });
      } catch (error: unknown) {// ignore cleanup failures for ephemeral jails
      logger.warn('[local Jail Sandbox Runtime] process execution failed', error);
    }
    }
  }

  private prepareScript(
    language: SandboxLanguage,
    code: string,
    jailPath: string,
  ): {
    command: string;
    args: string[];
  } {
    if (language === 'javascript') {
      const scriptPath = path.join(jailPath, 'index.js');
      fs.writeFileSync(scriptPath, code, 'utf8');
      return {
        command: 'node',
        args: ['index.js'],
      };
    }

    if (language === 'python') {
      const scriptPath = path.join(jailPath, 'main.py');
      fs.writeFileSync(scriptPath, code, 'utf8');
      return {
        command: process.platform === 'win32' ? 'python' : 'python3',
        args: ['main.py'],
      };
    }

    if (process.platform === 'win32') {
      const scriptPath = path.join(jailPath, 'script.cmd');
      fs.writeFileSync(scriptPath, `@echo off\r\n${code}\r\n`, 'utf8');
      return {
        command: process.env.ComSpec || 'cmd.exe',
        args: ['/d', '/s', '/c', 'script.cmd'],
      };
    }

    const scriptPath = path.join(jailPath, 'script.sh');
    fs.writeFileSync(scriptPath, `#!/usr/bin/env bash\nset -e\n${code}\n`, 'utf8');
    fs.chmodSync(scriptPath, 0o755);
    return {
      command: 'bash',
      args: ['script.sh'],
    };
  }

  private buildSanitizedEnv(jailPath: string, extraEnv?: Record<string, string>): Record<string, string> {
    const env: Record<string, string> = {
      PATH: process.env.PATH || process.env.Path || '',
      TMP: process.env.TMP || jailPath,
      TEMP: process.env.TEMP || jailPath,
      ISOLATED_LOCAL_JAIL: 'true',
      NO_COLOR: '1',
      PYTHONIOENCODING: 'utf-8',
    };

    if (process.env.Path) {
      env.Path = process.env.Path;
    }

    if (process.platform === 'win32') {
      env.SystemRoot = process.env.SystemRoot || 'C:\\Windows';
      env.ComSpec = process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe';
      env.PATHEXT = process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD';
      env.USERPROFILE = jailPath;
    } else {
      env.HOME = jailPath;
      env.TMPDIR = jailPath;
    }

    return {
      ...env,
      ...this.filterExtraEnv(extraEnv),
    };
  }

  private filterExtraEnv(extraEnv?: Record<string, string>): Record<string, string> {
    const filtered: Record<string, string> = {};
    for (const [rawKey, rawValue] of Object.entries(extraEnv || {})) {
      const key = String(rawKey || '').trim();
      if (!key || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
        continue;
      }

      const normalized = key.toLowerCase();
      if (
        LocalJailSandboxRuntime.BLOCKED_ENV_NAMES.has(normalized) ||
        normalized.includes('secret') ||
        normalized.includes('token') ||
        normalized.includes('password') ||
        normalized.includes('credential') ||
        normalized.includes('api_key') ||
        normalized.endsWith('_key')
      ) {
        continue;
      }

      filtered[key] = String(rawValue || '').slice(0, 4096);
    }
    return filtered;
  }

  private runProcess(
    command: string,
    args: string[],
    cwd: string,
    timeoutMs: number,
    env: Record<string, string>,
  ): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
    return new Promise((resolve) => {
      const child = spawnCommand(command, args, {
        cwd,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr?.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      const timeout = setTimeout(() => {
        try {
          if (process.platform === 'win32' && child.pid) {
            execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
          } else {
            child.kill('SIGKILL');
          }
        } catch (error: unknown) {// ignore kill failures on timeout
      logger.warn('[local Jail Sandbox Runtime] process execution failed', error);
    }

        resolve({
          stdout,
          stderr: `${stderr}\n[LocalJail] Timeout after ${timeoutMs}ms.`,
          exitCode: null,
        });
      }, timeoutMs);

      child.on('close', (code) => {
        clearTimeout(timeout);
        resolve({ stdout, stderr, exitCode: code });
      });

      child.on('error', (error) => {
        clearTimeout(timeout);
        resolve({
          stdout,
          stderr: `${stderr}\n[LocalJail] Failed to start process: ${error.message}`,
          exitCode: -1,
        });
      });
    });
  }
}
