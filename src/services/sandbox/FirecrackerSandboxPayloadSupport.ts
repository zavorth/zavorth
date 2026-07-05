import fs from 'fs';
import path from 'path';
import { execNativeCommandSync } from '../../core/CommandSpawn.js';
import type { SandboxLanguage } from './ISandboxRuntime.js';
import { safeParseInt } from '../../ai-gateway/shared/utils/safeParseInt.js';
import { logger } from '../../logger.js';

type FirecrackerPayloadHost = {
  getCodeFilename(language: SandboxLanguage): string;
  getInterpreter(language: SandboxLanguage): string;
  extractResultsFromDrive(
    drivePath: string,
    vmDir: string,
  ): { stdout: string; stderr: string; exitCode: number | null };
};

export class FirecrackerSandboxPayloadSupport {
  constructor(private readonly host: unknown) {}

  public buildPayloadDrive(
    language: SandboxLanguage,
    code: string,
    vmDir: string,
    drivePath: string,
  ): void {
    const payloadStaging = path.join(vmDir, 'payload_staging');
    const payloadDir = path.join(payloadStaging, 'payload');
    const resultsDir = path.join(payloadStaging, 'results');
    fs.mkdirSync(payloadDir, { recursive: true });
    fs.mkdirSync(resultsDir, { recursive: true });

    const host = this.host as FirecrackerPayloadHost;
    const codeFile = host.getCodeFilename(language);
    fs.writeFileSync(path.join(payloadDir, codeFile), code, 'utf8');

    const interpreter = host.getInterpreter(language);
    const runScript = [
      '#!/bin/bash',
      'set +e',
      'PAYLOAD_DIR="$(dirname "$0")"',
      'RESULTS_DIR="${PAYLOAD_DIR}/../results"',
      interpreter + ' "${PAYLOAD_DIR}/' + codeFile + '" >"${RESULTS_DIR}/stdout.txt" 2>"${RESULTS_DIR}/stderr.txt"',
      'echo $? > "${RESULTS_DIR}/exitcode.txt"',
      'sync',
    ].join('\n');

    fs.writeFileSync(path.join(payloadDir, 'run.sh'), runScript, { mode: 0o755 });

    try {
      execNativeCommandSync('dd', [
        'if=/dev/zero', `of=${drivePath}`, 'bs=1M', 'count=4',
      ], { timeout: 5000 });

      execNativeCommandSync('mkfs.ext4', [
        '-F', '-q', '-d', payloadStaging, drivePath,
      ], { timeout: 5000 });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `[FirecrackerSandbox] Falha ao construir payload drive: ${message}. ` +
        'Verifique se e2fsprogs esta instalado (apt install e2fsprogs).',
      );
    }
  }

  public extractResultsFromDrive(
    drivePath: string,
    vmDir: string,
  ): { stdout: string; stderr: string; exitCode: number | null } {
    const extractDir = path.join(vmDir, 'extracted_results');
    fs.mkdirSync(extractDir, { recursive: true });

    const readFile = (ext4Path: string): string => {
      try {
        const output = execNativeCommandSync('debugfs', [
          '-R', `cat ${ext4Path}`, drivePath,
        ], {
          timeout: 5000,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore'],
        });
        return String(output || '');
      } catch (error) { logger.warn('[Firecracker Sandbox Payload] filesystem operation failed', error); return ''; }
    };

    const stdout = readFile('results/stdout.txt');
    const stderr = readFile('results/stderr.txt');
    const exitCodeStr = readFile('results/exitcode.txt').trim();
    const exitCode = safeParseInt(exitCodeStr, NaN);

    return {
      stdout,
      stderr,
      exitCode: Number.isFinite(exitCode) ? exitCode : null,
    };
  }

  public async waitForResults(
    vmDir: string,
    payloadDrivePath: string,
    timeoutMs: number,
  ): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
    return new Promise((resolve) => {
      const deadline = Date.now() + timeoutMs;

      const poll = setInterval(() => {
        const result = (this.host as FirecrackerPayloadHost).extractResultsFromDrive(payloadDrivePath, vmDir);
        const socketGone = !fs.existsSync(path.join(vmDir, 'firecracker.sock'));
        const timedOut = Date.now() >= deadline;
        const completed = result.exitCode !== null;

        if (completed || socketGone || timedOut) {
          clearInterval(poll);

          if (timedOut && !completed) {
            result.stderr += `\n[FirecrackerSandbox] Timeout apos ${timeoutMs}ms. MicroVM destruida.`;
            result.exitCode = null;
          }

          resolve(result);
        }
      }, 250);
    });
  }
}
