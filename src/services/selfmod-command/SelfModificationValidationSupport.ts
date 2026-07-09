import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { logger } from '../../logger.js';
import {
LAUNCHER_TOUCH_PATTERNS,
  type SelfmodValidationReport,
  type StagedValidationChange,
} from './SelfModificationCommandTypes.js';

export class SelfModificationValidationSupport {
  private readonly projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  public defaultValidationPlan(relativePaths: string[]): string[] {
    const plan = [
      'Validar sintaxe por arquivo alterado.',
      'Executar build completo do projeto.',
    ];
    if (this.shouldDryRunLauncher(relativePaths)) {
      plan.push('Executar dry-run do launcher supervisionado para validar a trilha de boot.');
    }
    return plan;
  }

  public runDeepValidation(
    relativePaths: string[],
    stagedChanges: StagedValidationChange[],
  ): SelfmodValidationReport[] {
    const reports: SelfmodValidationReport[] = [];
    reports.push(this.runBuildValidation(stagedChanges));
    if (this.shouldDryRunLauncher(relativePaths)) {
      reports.push(this.runLauncherDryRunValidation());
    }
    return reports;
  }

  public runBuildValidation(stagedChanges: StagedValidationChange[]): SelfmodValidationReport {
    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const touchedParents = new Set<string>();

    try {
      for (const change of stagedChanges) {
        fs.mkdirSync(path.dirname(change.absolutePath), { recursive: true });
        touchedParents.add(path.dirname(change.absolutePath));
        fs.writeFileSync(change.absolutePath, change.nextContent, 'utf8');
      }

      const result = spawnSync(
        npmCommand,
        ['run', 'build'],
        {
          cwd: this.projectRoot,
          encoding: 'utf8',
          windowsHide: true,
        },
      );
      const output =
        `${String(result.stdout || '')}\n${String(result.stderr || '')}`.trim() ||
        'build executado sem output adicional.';
      return {
        filePath: 'project:build',
        passes: result.status === 0,
        output,
      };
    } finally {
      for (const change of [...stagedChanges].reverse()) {
        if (!change.originalExists) {
          try {
            if (fs.existsSync(change.absolutePath)) {
              fs.rmSync(change.absolutePath, { force: true });
            }
          } catch (error: unknown) {// Falhas na limpeza nao devem mascarar o resultado do build.
      logger.warn('[Self Modification Validation] filesystem operation failed', error);
    }
          continue;
        }

        try {
          fs.writeFileSync(change.absolutePath, change.previousContent, 'utf8');
        } catch (error: unknown) {// Falhas na limpeza nao devem mascarar o resultado do build.
      logger.warn('[Self Modification Validation] filesystem operation failed', error);
    }
      }

      for (const parentDir of touchedParents) {
        try {
          if (fs.existsSync(parentDir) && fs.readdirSync(parentDir).length === 0) {
            fs.rmdirSync(parentDir);
          }
        } catch (error: unknown) {// Ignora diretorios nao vazios ou races de limpeza.
      logger.warn('[Self Modification Validation] filesystem operation failed', error);
    }
      }
    }
  }

  public runLauncherDryRunValidation(): SelfmodValidationReport {
    const launcherScript = path.resolve(
      this.projectRoot,
      'scripts',
      'launch-zavorth-unified.ps1',
    );
    if (!fs.existsSync(launcherScript)) {
      return {
        filePath: 'scripts/launch-zavorth-unified.ps1',
        passes: false,
        output: 'Launcher unificado nao encontrado para dry-run.',
      };
    }

    const powershellExecutable =
      process.platform === 'win32'
        ? path.join(
            process.env.SystemRoot || 'C:\\Windows',
            'System32',
            'WindowsPowerShell',
            'v1.0',
            'powershell.exe',
          )
        : 'pwsh';
    const result = spawnSync(
      powershellExecutable,
      ['-ExecutionPolicy', 'Bypass', '-File', launcherScript, '-DryRun'],
      {
        cwd: this.projectRoot,
        encoding: 'utf8',
        windowsHide: true,
      },
    );
    const output =
      `${String(result.stdout || '')}\n${String(result.stderr || '')}`.trim() ||
      'dry-run executado sem output adicional.';
    return {
      filePath: 'scripts/launch-zavorth-unified.ps1',
      passes: result.status === 0,
      output,
    };
  }

  public shouldDryRunLauncher(relativePaths: string[]): boolean {
    return relativePaths.some((relativePath) =>
      LAUNCHER_TOUCH_PATTERNS.some((pattern) => pattern.test(relativePath.replace(/\\/g, '/'))),
    );
  }
}
