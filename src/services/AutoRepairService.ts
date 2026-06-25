import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { execCommandSync } from '../core/CommandSpawn.js';
import { ProviderFactory } from '../providers/ProviderFactory.js';
import type { ILlmProvider } from '../providers/ILlmProvider.js';
import {
  RuntimeBootstrapRepairService,
  type RuntimeBootstrapRepairReport,
} from '../runtime/access/RuntimeBootstrapRepairService.js';
import { RuntimeBootstrapService } from '../runtime/access/RuntimeBootstrapService.js';
import { SafeModificationService } from './SafeModificationService.js';
import { SelfModificationService } from './SelfModificationService.js';
import {
  SupervisedRuntimeService,
  type SupervisedReloadRequestResult,
} from './SupervisedRuntimeService.js';
import { AutoRepairIncidentMemoryService } from './AutoRepairIncidentMemoryService.js';
import { AutoRepairValidationService } from './autorepair/AutoRepairValidationService.js';
import { ExternalServiceSmokeService } from './ExternalServiceSmokeService.js';
import { AutoRepairCodeAttemptRunner } from './autorepair/AutoRepairCodeAttemptRunner.js';
import {
  buildAutoRepairPlannerMessages,
  parseAutoRepairPlannerResponse,
} from './autorepair/AutoRepairPlannerSupport.js';
import {
  buildAutoRepairRunSummary,
  describeAutoRepairIncidentMemoryStatus,
  summarizeLastAutoRepairRun,
} from './autorepair/AutoRepairSummarySupport.js';
import {
  normalizeAutoRepairError,
  readOptionalAutoRepairText,
} from './autorepair/AutoRepairTextUtils.js';
import type {
  AutoRepairAttempt,
  AutoRepairGoal,
  AutoRepairPlan,
  AutoRepairReport,
  AutoRepairRunInput,
  AutoRepairRunResult,
  AutoRepairStatus,
} from './autorepair/AutoRepairTypes.js';

export type {
  AutoRepairAttempt,
  AutoRepairGoal,
  AutoRepairPlan,
  AutoRepairReport,
  AutoRepairRunInput,
  AutoRepairRunResult,
  AutoRepairStatus,
  AutoRepairValidationStep,
} from './autorepair/AutoRepairTypes.js';

const NON_RELOAD_BOOTSTRAP_ACTIONS = new Set([
  'validate-node-mesh-smoke',
  'validate-channel-providers',
  'validate-remote-transports',
]);

type AutoRepairDependencies = {
  projectRoot?: string;
  provider?: ILlmProvider;
  supervisedRuntimeService?: Pick<SupervisedRuntimeService, 'inspect' | 'summarizeRecentChanges' | 'requestReload'>;
  runtimeBootstrapService?: Pick<RuntimeBootstrapService, 'inspect'>;
  runtimeBootstrapRepairService?: Pick<RuntimeBootstrapRepairService, 'repair'>;
  selfModificationService?: Pick<SelfModificationService, 'previewModification'>;
  safeModificationService?: Pick<SafeModificationService, 'safeApply' | 'validateCandidate'>;
  incidentMemoryService?: Pick<
    AutoRepairIncidentMemoryService,
    'recordRun' | 'summarizeForPlanner' | 'summarizeForStatus'
  >;
  externalSmokeService?: Pick<ExternalServiceSmokeService, 'run'>;
  validationService?: Pick<
    AutoRepairValidationService,
    'runValidationSuite' | 'validateTarget' | 'collectCandidateFiles' | 'inferValidationDomains'
  >;
  now?: () => Date;
  execCommandSync?: typeof execCommandSync;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
  unlinkSync?: typeof fs.unlinkSync;
};

export class AutoRepairService {
  private readonly projectRoot: string;
  private provider?: ILlmProvider;
  private readonly supervisedRuntimeService: Pick<
    SupervisedRuntimeService,
    'inspect' | 'summarizeRecentChanges' | 'requestReload'
  >;
  private readonly runtimeBootstrapService: Pick<RuntimeBootstrapService, 'inspect'>;
  private readonly runtimeBootstrapRepairService: Pick<RuntimeBootstrapRepairService, 'repair'>;
  private readonly selfModificationService: Pick<SelfModificationService, 'previewModification'>;
  private readonly safeModificationService: Pick<SafeModificationService, 'safeApply' | 'validateCandidate'>;
  private readonly incidentMemoryService: Pick<
    AutoRepairIncidentMemoryService,
    'recordRun' | 'summarizeForPlanner' | 'summarizeForStatus'
  >;
  private readonly validationService: Pick<
    AutoRepairValidationService,
    'runValidationSuite' | 'validateTarget' | 'collectCandidateFiles' | 'inferValidationDomains'
  >;
  private readonly codeAttemptRunner: AutoRepairCodeAttemptRunner;
  private readonly now: () => Date;
  private readonly execCommandSyncImpl: typeof execCommandSync;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly mkdirSync: typeof fs.mkdirSync;
  private activeRunPromise: Promise<AutoRepairRunResult> | null = null;

  constructor(dependencies: AutoRepairDependencies = {}) {
    this.projectRoot = dependencies.projectRoot || config.projectRoot;
    this.provider = dependencies.provider;
    this.supervisedRuntimeService =
      dependencies.supervisedRuntimeService || new SupervisedRuntimeService();
    this.runtimeBootstrapService =
      dependencies.runtimeBootstrapService ||
      new RuntimeBootstrapService({
        projectRoot: this.projectRoot,
        supervisedRuntimeService: this.supervisedRuntimeService as any,
      });
    this.runtimeBootstrapRepairService =
      dependencies.runtimeBootstrapRepairService ||
      new RuntimeBootstrapRepairService({
        bootstrapService: this.runtimeBootstrapService as any,
        runCommand: dependencies.execCommandSync || execCommandSync,
        now: dependencies.now,
      });
    this.safeModificationService =
      dependencies.safeModificationService || new SafeModificationService(this.projectRoot);
    this.selfModificationService =
      dependencies.selfModificationService ||
      new SelfModificationService({
        projectRoot: this.projectRoot,
        safeModificationService: this.safeModificationService as SafeModificationService,
      });
    this.incidentMemoryService =
      dependencies.incidentMemoryService ||
      new AutoRepairIncidentMemoryService({
        filePath: path.resolve(this.projectRoot, 'data', 'operational-memory', 'autorepair-incidents.json'),
      });
    this.now = dependencies.now || (() => new Date());
    this.execCommandSyncImpl = dependencies.execCommandSync || execCommandSync;
    this.existsSync = dependencies.existsSync || fs.existsSync.bind(fs);
    this.readFileSync = dependencies.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSync = dependencies.writeFileSync || fs.writeFileSync.bind(fs);
    this.mkdirSync = dependencies.mkdirSync || fs.mkdirSync.bind(fs);
    const unlinkSync = dependencies.unlinkSync || fs.unlinkSync.bind(fs);
    this.validationService =
      dependencies.validationService ||
      new AutoRepairValidationService({
        projectRoot: this.projectRoot,
        safeModificationService: this.safeModificationService,
        externalSmokeService: dependencies.externalSmokeService || new ExternalServiceSmokeService(),
        now: this.now,
        execCommandSync: this.execCommandSyncImpl,
        existsSync: this.existsSync,
        readFileSync: this.readFileSync,
      });
    this.codeAttemptRunner = new AutoRepairCodeAttemptRunner({
      selfModificationService: this.selfModificationService,
      safeModificationService: this.safeModificationService,
      validationService: this.validationService,
      now: this.now,
      existsSync: this.existsSync,
      unlinkSync,
    });
  }

  public readLastReport(): AutoRepairReport | null {
    if (!this.existsSync(config.autoRepairReportFile)) {
      return null;
    }

    try {
      return JSON.parse(this.readFileSync(config.autoRepairReportFile, 'utf8')) as AutoRepairReport;
    } catch {
      return null;
    }
  }

  public summarizeLastRun(): string {
    return summarizeLastAutoRepairRun(this.readLastReport(), this.describeIncidentMemoryStatus());
  }

  public async run(input: AutoRepairRunInput): Promise<AutoRepairRunResult> {
    if (this.activeRunPromise) {
      return this.activeRunPromise;
    }

    const promise = this.executeRun(input);
    this.activeRunPromise = promise;

    try {
      return await promise;
    } finally {
      if (this.activeRunPromise === promise) {
        this.activeRunPromise = null;
      }
    }
  }

  private async executeRun(input: AutoRepairRunInput): Promise<AutoRepairRunResult> {
    const startedAt = this.now().toISOString();
    const goal = input.goal || 'auto';
    const dryRun = input.dryRun === true;
    const force = input.force === true;
    const bootstrapRepair = this.runtimeBootstrapRepairService.repair({ dryRun });
    const report = this.createReport(input, startedAt, goal, dryRun, force, bootstrapRepair);
    const finalInspection = bootstrapRepair.final.supervisedRuntime;
    const executedBootstrapSteps = bootstrapRepair.steps.filter((step) => step.status === 'executed');
    const failedBootstrapSteps = bootstrapRepair.steps.filter((step) => step.status === 'failed');
    const reloadRelevantBootstrapSteps = executedBootstrapSteps.filter(
      (step) => !NON_RELOAD_BOOTSTRAP_ACTIONS.has(step.actionId),
    );
    const plannerRelevantBootstrapFailures = failedBootstrapSteps.filter(
      (step) => !NON_RELOAD_BOOTSTRAP_ACTIONS.has(step.actionId),
    );
    const needsReload =
      force ||
      reloadRelevantBootstrapSteps.length > 0 ||
      finalInspection.installRequired ||
      finalInspection.buildRequired ||
      !finalInspection.hostSupervisor.alive ||
      !finalInspection.telegramWorker.alive ||
      !finalInspection.accessReadiness.local.ready ||
      finalInspection.lastReloadReport?.status === 'failed';

    const needsCodePlanning =
      goal === 'improve' ||
      force ||
      plannerRelevantBootstrapFailures.length > 0 ||
      finalInspection.buildRequired ||
      !finalInspection.telegramWorker.alive ||
      finalInspection.lastReloadReport?.status === 'failed';

    if (!needsCodePlanning && !needsReload) {
      return this.finishNoopReport(report, {
        dryRun,
        needsReload,
        executedBootstrapSteps: executedBootstrapSteps.length,
        failedBootstrapSteps: failedBootstrapSteps.length,
        bootstrapStepCount: bootstrapRepair.steps.length,
      });
    }

    let lastPlan: AutoRepairPlan | null = null;
    if (needsCodePlanning) {
      lastPlan = await this.planRepair({
        input,
        goal,
        bootstrapRepair,
        previousAttempts: report.attempts,
      });
      report.planner = lastPlan;
      report.warnings.push(...lastPlan.warnings);
    }

    if (dryRun) {
      return this.finishReport(report, 'dry_run', needsReload, true);
    }

    const codeRepairSucceeded = await this.runCodeRepairAttempts(report, input, goal, bootstrapRepair, lastPlan);
    if (lastPlan?.needsCodeChange && !codeRepairSucceeded) {
      return this.finishReport(report, 'failed', needsReload, false);
    }

    if (needsReload || codeRepairSucceeded) {
      report.reloadRequest = await this.requestSupervisedReload({
        codeRepairSucceeded,
        finalInspection,
        force,
        report,
        input,
      });
      return this.finishReport(report, report.reloadRequest.accepted ? 'reloaded' : 'repaired', needsReload, true);
    }

    return this.finishReport(report, codeRepairSucceeded ? 'repaired' : 'noop', needsReload, true);
  }

  private createReport(
    input: AutoRepairRunInput,
    startedAt: string,
    goal: AutoRepairGoal,
    dryRun: boolean,
    force: boolean,
    bootstrapRepair: RuntimeBootstrapRepairReport,
  ): AutoRepairReport {
    return {
      startedAt,
      finishedAt: startedAt,
      requestedBy: String(input.requestedBy || '').trim() || 'unknown',
      reason: String(input.reason || '').trim() || 'Autoreparo solicitado sem motivo declarado.',
      goal,
      dryRun,
      force,
      status: 'noop',
      projectRoot: this.projectRoot,
      bootstrapRepair,
      planner: null,
      attempts: [],
      reloadRequest: null,
      warnings: [],
      summary: '',
    };
  }

  private finishNoopReport(
    report: AutoRepairReport,
    input: {
      dryRun: boolean;
      needsReload: boolean;
      executedBootstrapSteps: number;
      failedBootstrapSteps: number;
      bootstrapStepCount: number;
    },
  ): AutoRepairRunResult {
    report.status = input.dryRun
      ? 'dry_run'
      : input.failedBootstrapSteps > 0
        ? 'failed'
        : input.executedBootstrapSteps > 0
          ? 'repaired'
          : 'noop';
    report.finishedAt = this.now().toISOString();
    report.summary =
      input.bootstrapStepCount > 0
        ? this.buildRunSummary(report, input.needsReload)
        : input.dryRun
          ? 'O runtime parece saudavel. O dry-run nao encontrou reparos ou reload obrigatorios agora.'
          : 'O runtime parece saudavel. Nenhuma correcao ou recycle adicional foi necessario agora.';
    this.persistFinalReport(report);
    return {
      success: report.status !== 'failed',
      status: report.status,
      summary: report.summary,
      report,
    };
  }

  private finishReport(
    report: AutoRepairReport,
    status: AutoRepairStatus,
    needsReload: boolean,
    success: boolean,
  ): AutoRepairRunResult {
    report.status = status;
    report.finishedAt = this.now().toISOString();
    report.summary = this.buildRunSummary(report, needsReload);
    this.persistFinalReport(report);
    return {
      success,
      status: report.status,
      summary: report.summary,
      report,
    };
  }

  private async runCodeRepairAttempts(
    report: AutoRepairReport,
    input: AutoRepairRunInput,
    goal: AutoRepairGoal,
    bootstrapRepair: RuntimeBootstrapRepairReport,
    lastPlan: AutoRepairPlan | null,
  ): Promise<boolean> {
    if (!lastPlan?.needsCodeChange) {
      return false;
    }

    for (let attemptNumber = 1; attemptNumber <= Math.max(1, config.autoRepairMaxAttempts); attemptNumber += 1) {
      const plan =
        attemptNumber === 1
          ? lastPlan
          : await this.planRepair({
              input,
              goal,
              bootstrapRepair,
              previousAttempts: report.attempts,
            });
      report.planner = plan;
      const attempt = await this.codeAttemptRunner.execute(attemptNumber, plan);
      report.attempts.push(attempt);

      if (attempt.status === 'validated') {
        return true;
      }
    }

    return false;
  }

  private async requestSupervisedReload(input: {
    codeRepairSucceeded: boolean;
    finalInspection: RuntimeBootstrapRepairReport['final']['supervisedRuntime'];
    force: boolean;
    report: AutoRepairReport;
    input: AutoRepairRunInput;
  }): Promise<SupervisedReloadRequestResult> {
    return this.supervisedRuntimeService.requestReload({
      reason: input.codeRepairSucceeded
        ? 'Autoreparo validado; recycle supervisionado solicitado.'
        : 'Reparo ambiental concluido; recycle supervisionado solicitado.',
      requestedBy: input.report.requestedBy,
      notifyChatId: String(input.input.notifyChatId || '').trim() || null,
      forceRestart:
        input.force || input.codeRepairSucceeded || !input.finalInspection.accessReadiness.local.ready,
    });
  }

  private async planRepair(input: {
    input: AutoRepairRunInput;
    goal: AutoRepairGoal;
    bootstrapRepair: RuntimeBootstrapRepairReport;
    previousAttempts: AutoRepairAttempt[];
  }): Promise<AutoRepairPlan> {
    try {
      const runtimeSummary = this.supervisedRuntimeService.summarizeRecentChanges();
      const incidentMemorySummary = this.incidentMemoryService.summarizeForPlanner();
      const inspection = this.supervisedRuntimeService.inspect();
      const launcherLog = this.readOptionalText(
        path.resolve(this.projectRoot, 'data', 'runtime', 'supervised-launcher-last.log'),
      );
      const runtimeDiagnostics = this.readOptionalText(config.runtimeDiagnosticsFile);
      const rawReloadReport = this.readOptionalText(config.supervisedReloadReportFile);
      let parsedReport = rawReloadReport;
      if (rawReloadReport) {
        const failure = this.extractStructuredFailure(rawReloadReport);
        if (failure) {
          parsedReport = `--- STRUCTURED FAILURE ---\nTest: ${failure.testName}\nFile: ${failure.file}:${failure.line}\nError: ${failure.error}\n--------------------------`;
        }
      }
      const candidateFiles = this.validationService.collectCandidateFiles([
        ...inspection.modifiedFiles,
        ...inspection.stagedFiles,
        ...inspection.untrackedFiles,
        launcherLog,
        runtimeDiagnostics,
        rawReloadReport,
      ]);
      const messages = buildAutoRepairPlannerMessages({
        runInput: input.input,
        goal: input.goal,
        bootstrapRepair: input.bootstrapRepair,
        previousAttempts: input.previousAttempts,
        runtimeSummary,
        incidentMemorySummary,
        rawReloadReport: parsedReport,
        runtimeDiagnostics,
        launcherLog,
        candidateFiles,
      });

      const response = await this.getProvider().chat(messages);
      return parseAutoRepairPlannerResponse(response.content || '');
    } catch (error: any) {
      return {
        needsCodeChange: false,
        targetFile: null,
        instruction: '',
        summary: `Nao consegui gerar um plano automatico de autoreparo: ${normalizeAutoRepairError(error)}`,
        confidence: 0,
        warnings: ['Planejador indisponivel ou sem credencial valida neste momento.'],
        validationHints: [],
      };
    }
  }

  private buildRunSummary(report: AutoRepairReport, needsReload: boolean): string {
    return buildAutoRepairRunSummary(report, needsReload, this.describeIncidentMemoryStatus());
  }

  private describeIncidentMemoryStatus(): string {
    return describeAutoRepairIncidentMemoryStatus(this.incidentMemoryService);
  }

  private persistReport(report: AutoRepairReport): void {
    this.mkdirSync(path.dirname(config.autoRepairReportFile), { recursive: true });
    this.writeFileSync(config.autoRepairReportFile, JSON.stringify(report, null, 2), 'utf8');
  }

  private persistFinalReport(report: AutoRepairReport): void {
    this.persistReport(report);
    try {
      this.incidentMemoryService.recordRun(report, this.collectIncidentDomains(report));
    } catch {
      // A memoria operacional nao deve impedir o fluxo principal do autorepair.
    }
  }

  private collectIncidentDomains(report: AutoRepairReport): string[] {
    const lastAttempt = report.attempts[report.attempts.length - 1];
    const targetFile = lastAttempt?.targetFile || report.planner?.targetFile || '';
    const validationHints = report.planner?.validationHints || [];
    return this.validationService.inferValidationDomains(targetFile, validationHints);
  }

  private readOptionalText(filePath: string): string {
    return readOptionalAutoRepairText(filePath, this.existsSync, (target) =>
      String(this.readFileSync(target, 'utf8')),
    );
  }

  public extractStructuredFailure(stdout: string): { testName: string; file: string; line: number; error: string } | null {
    if (!stdout) return null;

    const lines = stdout.split(/\r?\n/);
    let testName = '';
    let file = '';
    let line = 0;
    let errorLines: string[] = [];
    let insideTestFailure = false;

    for (const l of lines) {
      const testNameMatch = l.match(/^\s*●\s*(.+)$/);
      if (testNameMatch) {
        testName = testNameMatch[1].trim();
        insideTestFailure = true;
        errorLines = [];
        continue;
      }

      if (insideTestFailure) {
        const stackMatch = l.match(/at\s+(?:.+?\s+\()?([a-zA-Z0-9_\-\/\\\.]+?\.(?:ts|js)):(\d+):(\d+)\)?/);
        if (stackMatch) {
          if (!file) {
            file = stackMatch[1].replace(/\\/g, '/');
            line = parseInt(stackMatch[2], 10);
          }
        }

        if (l.trim().startsWith('at ')) {
          insideTestFailure = false;
          continue;
        }

        errorLines.push(l);
      }
    }

    if (!file) {
      for (const l of lines) {
        const stackMatch = l.match(/at\s+(?:.+?\s+\()?([a-zA-Z0-9_\-\/\\\.]+?\.(?:ts|js)):(\d+):(\d+)\)?/);
        if (stackMatch) {
          file = stackMatch[1].replace(/\\/g, '/');
          line = parseInt(stackMatch[2], 10);
          break;
        }
      }
    }

    if (!file) {
      return null;
    }

    const cleanedErrorLines = errorLines.filter((el) => {
      const trimmed = el.trim();
      if (trimmed.includes('|')) return false;
      if (trimmed.startsWith('>')) return false;
      if (/^[~^\|\s]+$/.test(trimmed)) return false;
      return true;
    });

    const error = cleanedErrorLines.join('\n').trim() || 'Assertion failed / Test failed';

    return {
      testName: testName || 'Unknown Test',
      file,
      line,
      error,
    };
  }

  private getProvider(): ILlmProvider {
    if (!this.provider) {
      this.provider = ProviderFactory.create(config.llmProvider || 'gemini');
    }

    return this.provider;
  }
}
