import fs from 'fs';
import path from 'path';
import { execCommandSync } from '../../core/CommandSpawn.js';
import type { SafeModificationService } from '../SafeModificationService.js';
import type { ExternalServiceSmokeService } from '../ExternalServiceSmokeService.js';
import type { AutoRepairValidationStep } from './AutoRepairTypes.js';

const SAFE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.ps1']);
const SAFE_TOP_LEVEL_DIRS = new Set(['src', 'tests', 'config', 'scripts']);
const SAFE_TOP_LEVEL_FILES = new Set(['package.json', 'tsconfig.json']);
const MAX_OUTPUT_CHARACTERS = 4_000;

const LAUNCHER_DOMAIN_FILES = new Set([
  'scripts/launch-zavorth-supervised.ps1',
  'scripts/request-supervised-reload.ps1',
  'scripts/request-supervised-autorepair.ps1',
  'scripts/run-zavorth-supervised-host.ps1',
]);
const HOST_DOMAIN_FILES = new Set([
  'src/host.ts',
  'src/services/ProcessLockService.ts',
  'src/services/SupervisedRuntimeService.ts',
  'src/services/RuntimeBootstrapService.ts',
  'src/services/RuntimeBootstrapRepairService.ts',
  'scripts/request-supervised-autorepair.ps1',
  'scripts/request-supervised-reload.ps1',
  'scripts/run-zavorth-supervised-host.ps1',
]);
const TELEGRAM_DOMAIN_FILES = new Set([
  'src/index.ts',
  'src/services/AutoRepairService.ts',
  'src/services/SupervisedRuntimeService.ts',
  'src/services/SupervisedRuntimeNotificationService.ts',
]);
const AUTOREPAIR_DOMAIN_FILES = new Set([
  'scripts/autorepair.ts',
  'src/services/AutoRepairService.ts',
  'src/services/SafeModificationService.ts',
  'src/services/SelfModificationCommandService.ts',
  'src/services/SupervisedRuntimeService.ts',
]);
const LAUNCHER_DOMAIN_TESTS = [
  'tests/host.test.ts',
  'tests/services/SupervisedRuntimeService.test.ts',
  'tests/services/AutoRepairService.test.ts',
];
const HOST_DOMAIN_TESTS = ['tests/host.test.ts', 'tests/services/SupervisedRuntimeService.test.ts'];
const TELEGRAM_DOMAIN_TESTS = [
  'tests/telegram/controllers/TelegramOpsController.test.ts',
  'tests/telegram/CommandParser.test.ts',
  'tests/telegram/AuthGuard.test.ts',
];
const AUTOREPAIR_DOMAIN_TESTS = [
  'tests/services/AutoRepairService.test.ts',
  'tests/services/SafeModificationService.test.ts',
  'tests/services/SelfModificationCommandService.test.ts',
  'tests/services/SupervisedRuntimeService.test.ts',
];

export type AutoRepairValidationDomain = 'launcher' | 'host' | 'telegram' | 'autorepair';

type ValidationCommandInput = {
  label: string;
  command: string;
  args: string[];
  timeoutMs?: number;
};

export type AutoRepairValidationTargetResult = {
  allowed: boolean;
  reason: string;
  normalizedRelativePath: string | null;
};

export type AutoRepairValidationServiceDependencies = {
  projectRoot: string;
  safeModificationService: Pick<SafeModificationService, 'validateCandidate'>;
  externalSmokeService: Pick<ExternalServiceSmokeService, 'run'>;
  now?: () => Date;
  execCommandSync?: typeof execCommandSync;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
};

export class AutoRepairValidationService {
  private readonly projectRoot: string;
  private readonly safeModificationService: Pick<SafeModificationService, 'validateCandidate'>;
  private readonly externalSmokeService: Pick<ExternalServiceSmokeService, 'run'>;
  private readonly now: () => Date;
  private readonly execCommandSyncImpl: typeof execCommandSync;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;

  constructor(dependencies: AutoRepairValidationServiceDependencies) {
    this.projectRoot = dependencies.projectRoot;
    this.safeModificationService = dependencies.safeModificationService;
    this.externalSmokeService = dependencies.externalSmokeService;
    this.now = dependencies.now || (() => new Date());
    this.execCommandSyncImpl = dependencies.execCommandSync || execCommandSync;
    this.existsSync = dependencies.existsSync || fs.existsSync.bind(fs);
    this.readFileSync = dependencies.readFileSync || fs.readFileSync.bind(fs);
  }

  public async runValidationSuite(
    targetFile: string,
    validationHints: string[],
  ): Promise<AutoRepairValidationStep[]> {
    const steps: AutoRepairValidationStep[] = [];
    const normalizedTarget = targetFile.replace(/\\/g, '/').trim();
    const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const domains = new Set(this.inferValidationDomains(normalizedTarget, validationHints));

    if (path.extname(normalizedTarget).toLowerCase() === '.ps1') {
      steps.push(this.runPowerShellValidationStep(normalizedTarget));
    }

    if (steps.some((step) => step.status === 'failed')) {
      return steps;
    }

    if (domains.has('launcher')) {
      steps.push(this.runLauncherPowerShellBundleValidationStep());
      if (steps.some((step) => step.status === 'failed')) {
        return steps;
      }
    }

    steps.push(
      this.runValidationStep({
        label: 'build',
        command: npmExecutable,
        args: ['run', 'build'],
      }),
    );

    if (steps.some((step) => step.status === 'failed')) {
      return steps;
    }

    if (domains.has('launcher')) {
      steps.push(this.runLauncherDryRunValidationStep());
      if (steps.some((step) => step.status === 'failed')) {
        return steps;
      }
    }

    const relatedTests = new Set([
      ...this.inferDomainTests(domains),
      ...this.inferRelatedTests(normalizedTarget, validationHints),
    ]);
    if (relatedTests.size === 0) {
      steps.push(this.createSkippedValidationStep('tests', 'No specific test was found for this target.'));
    } else {
      steps.push(
        this.runValidationStep({
          label: 'tests',
          command: npmExecutable,
          args: ['test', '--', '--runInBand', ...Array.from(relatedTests)],
          timeoutMs: 240_000,
        }),
      );
      if (steps.some((step) => step.status === 'failed')) {
        return steps;
      }
    }

    const smokeSteps = await this.externalSmokeService.run({
      targetFile: normalizedTarget,
      validationHints,
      supervisedRuntime: process.env.ZAVORTH_SUPERVISED === 'true',
      domains: Array.from(domains),
    });
    for (const step of smokeSteps) {
      steps.push({
        ...step,
        output: step.output ? this.trimOutput(step.output) : step.output,
      });
    }

    return steps;
  }

  public validateTarget(rawTarget: string): AutoRepairValidationTargetResult {
    const input = String(rawTarget || '').trim();
    if (!input) {
      return {
        allowed: false,
        reason: 'The planner did not provide a target file.',
        normalizedRelativePath: null,
      };
    }

    if (path.isAbsolute(input)) {
      return {
        allowed: false,
        reason: 'Absolute paths were blocked for self-repair.',
        normalizedRelativePath: null,
      };
    }

    const normalized = input.replace(/\\/g, '/');
    const topLevel = normalized.split('/')[0];
    const extension = path.extname(normalized).toLowerCase();
    if (!SAFE_TOP_LEVEL_FILES.has(normalized) && !SAFE_TOP_LEVEL_DIRS.has(topLevel)) {
      return {
        allowed: false,
        reason: 'The proposed file is outside the safe self-repair area.',
        normalizedRelativePath: null,
      };
    }

    if (!SAFE_EXTENSIONS.has(extension) && !SAFE_TOP_LEVEL_FILES.has(normalized)) {
      return {
        allowed: false,
        reason: `The extension ${extension || '[no extension]'} is not supported by safe autorepair.`,
        normalizedRelativePath: null,
      };
    }

    const absolutePath = path.resolve(this.projectRoot, normalized);
    const relative = path.relative(this.projectRoot, absolutePath).replace(/\\/g, '/');
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
      return {
        allowed: false,
        reason: 'O alvo proposto escaparia da raiz do projeto.',
        normalizedRelativePath: null,
      };
    }

    return {
      allowed: true,
      reason: 'ok',
      normalizedRelativePath: relative,
    };
  }

  public collectCandidateFiles(sources: Array<string | null | undefined>): string[] {
    const matches = new Set<string>();
    const regex =
      /(?:src|tests|config|scripts)\/[A-Za-z0-9_./-]+\.(?:ts|tsx|js|jsx|mjs|cjs|json|ps1)|(?:^|[^A-Za-z0-9_./-])(package\.json|tsconfig\.json)(?=$|[^A-Za-z0-9_./-])/g;

    for (const source of sources) {
      const normalized = String(source || '').replace(/\\/g, '/');
      if (!normalized) {
        continue;
      }

      const lines = normalized.split(/\r?\n/);
      for (const line of lines) {
        for (const token of line.matchAll(regex)) {
          const value = (token[0] || token[1] || '').replace(/^[^A-Za-z0-9]*/, '').trim();
          const validation = this.validateTarget(value);
          if (validation.allowed && validation.normalizedRelativePath) {
            matches.add(validation.normalizedRelativePath);
          }
        }
      }
    }

    return Array.from(matches).slice(0, 20);
  }

  public inferValidationDomains(targetFile: string, validationHints: string[]): AutoRepairValidationDomain[] {
    const domains = new Set<AutoRepairValidationDomain>();
    const filesToInspect = [targetFile, ...validationHints].map((value) => String(value || '').replace(/\\/g, '/').trim());

    for (const file of filesToInspect) {
      if (!file) {
        continue;
      }

      if (
        file.startsWith('src/telegram/') ||
        file.startsWith('tests/telegram/') ||
        TELEGRAM_DOMAIN_FILES.has(file)
      ) {
        domains.add('telegram');
      }

      if (file.startsWith('tests/host.') || HOST_DOMAIN_FILES.has(file)) {
        domains.add('host');
      }

      if (LAUNCHER_DOMAIN_FILES.has(file)) {
        domains.add('launcher');
        domains.add('host');
      }

      if (AUTOREPAIR_DOMAIN_FILES.has(file) || file.startsWith('tests/services/AutoRepairService.')) {
        domains.add('autorepair');
        domains.add('launcher');
        domains.add('telegram');
      }
    }

    return Array.from(domains);
  }

  private inferRelatedTests(targetFile: string, validationHints: string[]): string[] {
    const candidates = new Set<string>();
    const normalized = targetFile.replace(/\\/g, '/').trim();

    for (const hint of validationHints) {
      const validation = this.validateTarget(hint);
      if (validation.allowed && validation.normalizedRelativePath?.startsWith('tests/')) {
        candidates.add(validation.normalizedRelativePath);
      }
    }

    if (normalized.startsWith('tests/')) {
      candidates.add(normalized);
    }

    if (normalized === 'src/host.ts') {
      candidates.add('tests/host.test.ts');
    }

    if (normalized.startsWith('src/')) {
      const withoutExtension = normalized.replace(/\.(?:ts|tsx|js|jsx|mjs|cjs)$/, '');
      const relative = withoutExtension.slice(4);
      candidates.add(`tests/${relative}.test.ts`);
      candidates.add(`tests/${relative}.test.tsx`);
      candidates.add(`tests/${relative}.spec.ts`);
      candidates.add(`tests/${relative}.spec.tsx`);
    }

    return Array.from(candidates).filter((candidate) => this.existsSync(path.join(this.projectRoot, candidate)));
  }

  private inferDomainTests(domains: Set<AutoRepairValidationDomain>): string[] {
    const candidates = new Set<string>();

    if (domains.has('launcher')) {
      for (const testFile of LAUNCHER_DOMAIN_TESTS) {
        candidates.add(testFile);
      }
    }

    if (domains.has('host')) {
      for (const testFile of HOST_DOMAIN_TESTS) {
        candidates.add(testFile);
      }
    }

    if (domains.has('telegram')) {
      for (const testFile of TELEGRAM_DOMAIN_TESTS) {
        candidates.add(testFile);
      }
    }

    if (domains.has('autorepair')) {
      for (const testFile of AUTOREPAIR_DOMAIN_TESTS) {
        candidates.add(testFile);
      }
    }

    return Array.from(candidates).filter((candidate) => this.existsSync(path.join(this.projectRoot, candidate)));
  }

  private runPowerShellValidationStep(targetFile: string): AutoRepairValidationStep {
    const absolutePath = path.resolve(this.projectRoot, targetFile);
    return this.runInlineValidationStep({
      label: 'powershell-parse',
      command: `safe-validate ${targetFile}`,
      validator: () => {
        if (!this.existsSync(absolutePath)) {
          throw new Error(`PowerShell file missing for validation: ${targetFile}`);
        }

        const validation = this.safeModificationService.validateCandidate(
          absolutePath,
          this.readFileSync(absolutePath, 'utf8'),
        );
        if (!validation.passes) {
          throw new Error(validation.output || `Failed to validate ${targetFile}.`);
        }

        return validation.output || `PowerShell script ${targetFile} validated successfully.`;
      },
    });
  }

  private runLauncherPowerShellBundleValidationStep(): AutoRepairValidationStep {
    const files = Array.from(LAUNCHER_DOMAIN_FILES)
      .filter((file) => file.endsWith('.ps1'))
      .map((file) => path.resolve(this.projectRoot, file))
      .filter((filePath) => this.existsSync(filePath));

    if (files.length === 0) {
      return this.createSkippedValidationStep(
        'launcher-powershell-bundle',
        'No central launcher PowerShell script was found in this workspace for validation.',
      );
    }

    return this.runInlineValidationStep({
      label: 'launcher-powershell-bundle',
      command: `safe-validate ${files.length} launcher-script(s)`,
      validator: () => {
        const failures: string[] = [];
        for (const absolutePath of files) {
          const validation = this.safeModificationService.validateCandidate(
            absolutePath,
            this.readFileSync(absolutePath, 'utf8'),
          );
          if (!validation.passes) {
            failures.push(`${path.relative(this.projectRoot, absolutePath)}: ${validation.output}`);
          }
        }

        if (failures.length > 0) {
          throw new Error(failures.join('\n'));
        }

        return `Launcher PowerShell bundle validated: ${files.map((file) => path.relative(this.projectRoot, file)).join(', ')}.`;
      },
    });
  }

  private runLauncherDryRunValidationStep(): AutoRepairValidationStep {
    if (process.platform !== 'win32') {
      return this.createSkippedValidationStep(
        'launcher-dry-run',
        'O dry-run do supervised launcher so roda no Windows.',
      );
    }

    const executable = this.resolvePowerShellExecutable();
    const launcherPath = path.resolve(this.projectRoot, 'scripts', 'launch-zavorth-supervised.ps1');
    if (!executable || !this.existsSync(launcherPath)) {
      return this.createSkippedValidationStep(
        'launcher-dry-run',
        'Supervised launcher unavailable for operational dry-run in this environment.',
      );
    }

    return this.runValidationStep({
      label: 'launcher-dry-run',
      command: executable,
      args: [
        '-NoLogo',
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        launcherPath,
        '-DryRun',
        '-Headless',
        '-Reason',
        'AutoRepair validation dry-run',
        '-RequestedBy',
        'autorepair-validation',
      ],
      timeoutMs: 240_000,
    });
  }

  private runInlineValidationStep(input: {
    label: string;
    command: string;
    validator: () => string;
  }): AutoRepairValidationStep {
    const started = this.now();
    const startedAt = started.toISOString();
    try {
      const output = input.validator();
      const finished = this.now();
      return {
        label: input.label,
        command: input.command,
        status: 'passed',
        startedAt,
        finishedAt: finished.toISOString(),
        durationMs: Math.max(0, finished.getTime() - started.getTime()),
        output: this.trimOutput(String(output || '').trim()),
      };
    } catch (error: unknown) {const finished = this.now();
      return {
        label: input.label,
        command: input.command,
        status: 'failed',
        startedAt,
        finishedAt: finished.toISOString(),
        durationMs: Math.max(0, finished.getTime() - started.getTime()),
        output: this.trimOutput(this.normalizeCommandError(error)),
      };
    }
  }

  private runValidationStep(input: ValidationCommandInput): AutoRepairValidationStep {
    const started = this.now();
    const startedAt = started.toISOString();
    try {
      const output = this.execCommandSyncImpl(input.command, input.args, {
        cwd: this.projectRoot,
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: input.timeoutMs || 180_000,
      });
      const finished = this.now();
      return {
        label: input.label,
        command: [input.command, ...input.args].join(' ').trim(),
        status: 'passed',
        startedAt,
        finishedAt: finished.toISOString(),
        durationMs: Math.max(0, finished.getTime() - started.getTime()),
        output: this.trimOutput(String(output || '').trim()),
      };
    } catch (error: unknown) {const finished = this.now();
      return {
        label: input.label,
        command: [input.command, ...input.args].join(' ').trim(),
        status: 'failed',
        startedAt,
        finishedAt: finished.toISOString(),
        durationMs: Math.max(0, finished.getTime() - started.getTime()),
        output: this.trimOutput(this.normalizeCommandError(error)),
      };
    }
  }

  private createSkippedValidationStep(label: string, output: string): AutoRepairValidationStep {
    const timestamp = this.now().toISOString();
    return {
      label,
      command: 'skip',
      status: 'skipped',
      startedAt: timestamp,
      finishedAt: timestamp,
      durationMs: 0,
      output,
    };
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
        if (this.existsSync(candidate)) {
          return candidate;
        }
        continue;
      }

      return candidate;
    }

    return null;
  }

  private normalizeCommandError(error: any): string {
    return this.normalizeError(error?.stdout || error?.stderr || error?.message || error);
  }

  private normalizeError(error: unknown): string {
    const text = String(error || '').trim();
    if (!text) {
      return 'Unknown failure.';
    }

    return this.trimOutput(text);
  }

  private trimOutput(text: string, maxLength = MAX_OUTPUT_CHARACTERS): string {
    const normalized = String(text || '').trim();
    if (!normalized) {
      return '';
    }

    if (normalized.length <= maxLength) {
      return normalized;
    }

    return `${normalized.slice(0, maxLength)}...[truncado]`;
  }
}
