import { asErrorLike } from '../utils/errorLike';
/**
 * SafeModificationService - Guarded Self-Modification
 *
 * Provides a safe pipeline for Zavorth to modify its own source code:
 * 1. Write changes to a temp file
 * 2. Run `tsc --noEmit` to validate syntax
 * 3. Signal the Host to create backups
 * 4. Apply the change only if validation passes
 */

import { logger } from '../logger.js';
import fs from 'fs';
import path from 'path';
import { execCommandSync } from '../core/CommandSpawn.js';

export interface ModificationResult {
  success: boolean;
  reason: string;
  validationOutput?: string;
}

export class SafeModificationService {
  private projectRoot: string;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || this.findProjectRoot();
  }

  /**
   * Safely apply a code change to a project file.
   * Validates the candidate with an extension-aware validator before applying
   * and requests Host backup when supervised.
   */
  public async safeApply(filePath: string, newContent: string): Promise<ModificationResult> {
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(this.projectRoot, filePath);
    if (!this.isInsideProjectRoot(absolutePath)) {
      return {
        success: false,
        reason: 'O arquivo solicitado fica fora da raiz do projeto e foi bloqueado.',
      };
    }

    const validation = this.validateCandidate(absolutePath, newContent);
    if (!validation.passes) {
      return {
        success: false,
        reason: 'Validacao de sintaxe falhou. O codigo proposto tem erros e foi rejeitado para proteger o Zavorth.',
        validationOutput: validation.output,
      };
    }

    await this.requestHostBackup([absolutePath]);

    try {
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      fs.writeFileSync(absolutePath, newContent, 'utf-8');
      return {
        success: true,
        reason: `Arquivo ${path.basename(absolutePath)} modificado com sucesso. Backup criado pelo Host.`,
      };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Safe Modification] filesystem operation failed', error);
    return {
        success: false,
        reason: `Falha ao escrever o arquivo: ${err.message}`,
      };
  }
  }

  /**
   * Public wrapper used by higher-level self-modification services to validate a candidate
   * without persisting the write.
   */
  public validateCandidate(filePath: string, newContent: string): { passes: boolean; output: string } {
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(this.projectRoot, filePath);
    if (!this.isInsideProjectRoot(absolutePath)) {
      return {
        passes: false,
        output: 'O arquivo solicitado fica fora da raiz do projeto e foi bloqueado.',
      };
    }

    const extension = path.extname(absolutePath).toLowerCase();
    if (extension === '.json') {
      try {
        JSON.parse(newContent);
        return { passes: true, output: '' };
      } catch (error: unknown) {
        logger.warn('[Safe Modification] JSON parse failed', error);
    return {
          passes: false,
          output: `JSON invalido: ${error.message}`,
        };
  }
    }

    if (extension === '.ps1') {
      return this.validatePowerShellSyntax(absolutePath, newContent);
    }

    if (!['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(extension)) {
      return {
        passes: false,
        output: `Ainda nao existe validador seguro para a extensao ${extension || '[sem extensao]'}.`,
      };
    }

    return this.validateSyntax(absolutePath, newContent);
  }

  /**
   * Validate TypeScript syntax by writing to a temp file and running tsc --noEmit.
   */
  private validateSyntax(originalPath: string, newContent: string): { passes: boolean; output: string } {
    const tmpPath = `${originalPath}.tmp.ts`;
    try {
      fs.writeFileSync(tmpPath, newContent, 'utf-8');

      const tsconfigPath = path.join(this.projectRoot, 'tsconfig.json');
      const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
      const tscArgs = fs.existsSync(tsconfigPath)
        ? ['tsc', '--noEmit', '--project', tsconfigPath]
        : ['tsc', '--noEmit', tmpPath];

      let originalContent: string | null = null;
      if (fs.existsSync(originalPath)) {
        originalContent = fs.readFileSync(originalPath, 'utf-8');
        fs.writeFileSync(originalPath, newContent, 'utf-8');
      }

      let output = '';
      let passes = false;
      try {
        output = String(
          execCommandSync(npxCommand, tscArgs, {
            cwd: this.projectRoot,
            encoding: 'utf-8',
            timeout: 30_000,
            stdio: 'pipe',
          }),
        );
        passes = true;
      } catch (error: unknown) { const err = asErrorLike(error); output = (error as any)?.stdout || (error as any)?.stderr || err.message || '';
        const basename = path.basename(originalPath);
        const relevantErrors = output
          .split('\n')
          .filter((line: string) => line.includes(basename) && line.includes('error TS'));
        passes = relevantErrors.length === 0;
      } finally {
        if (originalContent !== null) {
          fs.writeFileSync(originalPath, originalContent, 'utf-8');
        }
      }

      return { passes, output };
    } finally {
      try {
        fs.unlinkSync(tmpPath);
      } catch (error: unknown) {// ignore cleanup failures
      logger.warn('[Safe Modification] file cleanup failed', error);
    }
    }
  }

  private validatePowerShellSyntax(originalPath: string, newContent: string): { passes: boolean; output: string } {
    const tmpPath = `${originalPath}.tmp.ps1`;
    try {
      fs.writeFileSync(tmpPath, newContent, 'utf-8');

      const executable = this.resolvePowerShellExecutable();
      if (!executable) {
        return {
          passes: false,
          output: 'Nao encontrei PowerShell disponivel para validar scripts .ps1 com seguranca.',
        };
      }

      const command = [
        '$tokens = $null',
        '$errors = $null',
        '[void][System.Management.Automation.Language.Parser]::ParseFile($env:ZAVORTH_VALIDATE_PS1_PATH, [ref]$tokens, [ref]$errors)',
        'if ($errors -and $errors.Count -gt 0) {',
        '  $errors | ForEach-Object {',
        '    $line = if ($_.Extent) { $_.Extent.StartLineNumber } else { 0 }',
        '    "{0}:{1}: {2}" -f $env:ZAVORTH_VALIDATE_PS1_PATH, $line, $_.Message',
        '  }',
        '  exit 1',
        '}',
        'if (Get-Module -ListAvailable -Name PSScriptAnalyzer) {',
        '  $issues = Invoke-ScriptAnalyzer -Path $env:ZAVORTH_VALIDATE_PS1_PATH -Severity Error',
        '  if ($issues) {',
        '    $issues | ForEach-Object {',
        '      "{0}:{1}: {2}" -f $_.RuleName, $_.Line, $_.Message',
        '    }',
        '    exit 1',
        '  }',
        '}',
      ].join('; ');

      try {
        const output = String(
          execCommandSync(executable, ['-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command], {
            cwd: this.projectRoot,
            encoding: 'utf-8',
            timeout: 30_000,
            stdio: 'pipe',
            env: {
              ...process.env,
              ZAVORTH_VALIDATE_PS1_PATH: tmpPath,
            },
          }),
        );

        return {
          passes: true,
          output: output.trim(),
        };
      } catch (error: unknown) {logger.warn('[Safe Modification] validation failed', error);
    return {
          passes: false,
          output: String(error?.stdout || error?.stderr || error?.message || '').trim() || 'Falha desconhecida ao validar o script PowerShell.',
        };
  }
    } finally {
      try {
        fs.unlinkSync(tmpPath);
      } catch (error: unknown) {// ignore cleanup failures
      logger.warn('[Safe Modification] file cleanup failed', error);
    }
    }
  }

  /**
   * Send a message to the Host process requesting backup of specified files.
   * Only works when running under the Host supervisor (ZAVORTH_SUPERVISED=true).
   */
  private async requestHostBackup(files: string[]): Promise<void> {
    if (process.env.ZAVORTH_SUPERVISED !== 'true' || !process.send) {
      logger.info('[SafeModification] Not supervised - skipping Host backup request.');
      return;
    }

    return new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        process.removeListener('message', handler);
        logger.warn('[SafeModification] Host backup acknowledgment timed out.');
        resolve();
      }, 5000);

      const handler = (msg: any) => {
        if (msg?.type === 'backup_done') {
          clearTimeout(timeout);
          process.removeListener('message', handler);
          resolve();
        }
      };

      process.on('message', handler);
      process.send!({ type: 'pre_modify', files });
    });
  }

  private findProjectRoot(): string {
    let dir = process.cwd();
    for (let i = 0; i < 5; i += 1) {
      if (fs.existsSync(path.join(dir, 'package.json'))) {
        return dir;
      }
      dir = path.dirname(dir);
    }
    return process.cwd();
  }

  private isInsideProjectRoot(targetPath: string): boolean {
    const relative = path.relative(this.projectRoot, targetPath);
    return targetPath === this.projectRoot || (relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative));
  }

  private resolvePowerShellExecutable(): string | null {
    const candidates =
      process.platform === 'win32'
        ? [
            path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
            'powershell.exe',
            'pwsh.exe',
          ]
        : ['pwsh', 'powershell'];

    for (const candidate of candidates) {
      if (!candidate) {
        continue;
      }

      if (candidate.includes(path.sep)) {
        if (fs.existsSync(candidate)) {
          return candidate;
        }
        continue;
      }

      return candidate;
    }

    return null;
  }
}
