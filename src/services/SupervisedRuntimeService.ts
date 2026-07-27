import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { execCommandSync } from '../core/CommandSpawn.js';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';

import {
RuntimeAccessReadinessService,
  type RuntimeAccessReadinessReport,
} from '../runtime/access/RuntimeAccessReadinessService.js';
type LockSnapshot = {
  active: boolean;
  pid: number | null;
  owner: string | null;
  startedAt: string | null;
  alive: boolean;
};

type GitCommitSummary = {
  hash: string;
  relativeDate: string;
  subject: string;
};

type ReloadReport = {
  status?: string;
  startedAt?: string;
  finishedAt?: string;
  reason?: string;
  requestedBy?: string;
  notifyChatId?: string;
  actions?: string[];
  errorMessage?: string;
};

export type SupervisedRuntimeInspection = {
  projectRoot: string;
  gitAvailable: boolean;
  branch: string | null;
  modifiedFiles: string[];
  stagedFiles: string[];
  untrackedFiles: string[];
  recentCommits: GitCommitSummary[];
  installRequired: boolean;
  buildRequired: boolean;
  hostSupervisor: LockSnapshot;
  telegramWorker: LockSnapshot;
  accessReadiness: RuntimeAccessReadinessReport;
  lastReloadReport: ReloadReport | null;
};

export type SupervisedReloadRequest = {
  reason: string;
  requestedBy: string;
  notifyChatId?: string | null;
  forceRestart?: boolean;
};

export type SupervisedReloadRequestResult = {
  accepted: boolean;
  summary: string;
  requestId: string;
};

type ProcessLike = {
  pid: number;
  env: NodeJS.ProcessEnv;
  send?: ((message: unknown) => boolean) | undefined;
  on: (event: string, listener: (...args: any[]) => void) => any;
  removeListener: (event: string, listener: (...args: any[]) => void) => any;
};

type SupervisedRuntimeRuntime = {
  processRef?: ProcessLike;
  now?: () => Date;
  execCommandSync?: typeof execCommandSync;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  statSync?: typeof fs.statSync;
  readdirSync?: typeof fs.readdirSync;
  kill?: (pid: number, signal?: number | NodeJS.Signals) => void;
  setTimeoutImpl?: typeof setTimeout;
  clearTimeoutImpl?: typeof clearTimeout;
};

export class SupervisedRuntimeService {
  private readonly projectRoot: string;
  private readonly processRef: ProcessLike;
  private readonly now: () => Date;
  private readonly execCommandSyncImpl: typeof execCommandSync;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly statSync: typeof fs.statSync;
  private readonly readdirSync: typeof fs.readdirSync;
  private readonly killFn: (pid: number, signal?: number | NodeJS.Signals) => void;
  private readonly setTimeoutImpl: typeof setTimeout;
  private readonly clearTimeoutImpl: typeof clearTimeout;
  private readonly accessReadinessService: RuntimeAccessReadinessService;

  constructor(runtime: SupervisedRuntimeRuntime = {}) {
    this.projectRoot = config.projectRoot;
    this.processRef = runtime.processRef || (process as unknown as ProcessLike);
    this.now = runtime.now || (() => new Date());
    this.execCommandSyncImpl = runtime.execCommandSync || execCommandSync;
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.statSync = runtime.statSync || fs.statSync.bind(fs);
    this.readdirSync = runtime.readdirSync || fs.readdirSync.bind(fs);
    this.killFn = runtime.kill || process.kill.bind(process);
    this.setTimeoutImpl = runtime.setTimeoutImpl || setTimeout;
    this.clearTimeoutImpl = runtime.clearTimeoutImpl || clearTimeout;
    this.accessReadinessService = new RuntimeAccessReadinessService({
      now: this.now,
      existsSync: this.existsSync,
      readFileSync: this.readFileSync,
      kill: this.killFn,
      hostLockFilePath: config.hostSupervisorLockFile,
      workerLockFilePath: config.processLockFile,
    });
  }

  public inspect(): SupervisedRuntimeInspection {
    const hostSupervisor = this.readLockSnapshot(config.hostSupervisorLockFile);
    const runtimeWorker = this.readLockSnapshot(config.processLockFile);
    return {
      projectRoot: this.projectRoot,
      ...this.readGitState(),
      installRequired: this.testNpmInstallRequired(this.projectRoot),
      buildRequired: this.testBuildRequired(),
      hostSupervisor,
      telegramWorker: runtimeWorker,
      accessReadiness: this.accessReadinessService.inspect({
        hostSupervisor,
        telegramWorker: runtimeWorker,
      }),
      lastReloadReport: this.readLastReloadReport(),
    };
  }

  public async inspectLive(): Promise<SupervisedRuntimeInspection> {
    const hostSupervisor = this.readLockSnapshot(config.hostSupervisorLockFile);
    const runtimeWorker = this.readLockSnapshot(config.processLockFile);
    return {
      projectRoot: this.projectRoot,
      ...this.readGitState(),
      installRequired: this.testNpmInstallRequired(this.projectRoot),
      buildRequired: this.testBuildRequired(),
      hostSupervisor,
      telegramWorker: runtimeWorker,
      accessReadiness: await this.accessReadinessService.inspectLive({
        hostSupervisor,
        telegramWorker: runtimeWorker,
      }),
      lastReloadReport: this.readLastReloadReport(),
    };
  }

  public summarizeRecentChanges(): string {
    const inspection = this.inspect();
    const lines: string[] = ['changes e estado do Zavorth', ''];

    if (inspection.gitAvailable) {
      lines.push(`Branch current: ${inspection.branch || 'unavailable'}.`);
      lines.push(
        `Git local: ${inspection.stagedFiles.length} staged | ${inspection.modifiedFiles.length} modificados | ${inspection.untrackedFiles.length} novos.`,
      );
    } else {
      lines.push('local git: unavailable or repo not detected in this folder.');
    }

    lines.push(
      `Runtime supervised: host ${inspection.hostSupervisor.alive ? inspection.hostSupervisor.pid : 'offline'} | worker ${
        inspection.telegramWorker.alive ? inspection.telegramWorker.pid : 'offline'
      }.`,
    );
    lines.push(
      `access: local ${inspection.accessReadiness.local.ready ? 'ready' : 'pending'} | remote ${
        inspection.accessReadiness.remote.ready ? 'ready' : 'pending'
      }.`,
    );
    lines.push(`dependencies: ${inspection.installRequired ? 'need npm install' : 'synced'}.`);
    lines.push(`Build: ${inspection.buildRequired ? 'outdated, needs rebuild' : 'up to date'}.`);

    if (inspection.recentCommits.length > 0) {
      lines.push('', 'Latests commits:');
      for (const commit of inspection.recentCommits.slice(0, 3)) {
        lines.push(`- ${commit.hash} (${commit.relativeDate}): ${commit.subject}`);
      }
    }

    const changeLines = [
      ...inspection.stagedFiles.map((entry) => `staged ${entry}`),
      ...inspection.modifiedFiles.map((entry) => `mod ${entry}`),
      ...inspection.untrackedFiles.map((entry) => `novo ${entry}`),
    ].slice(0, 8);

    if (changeLines.length > 0) {
      lines.push('', 'Highlighted files:');
      for (const entry of changeLines) {
        lines.push(`- ${entry}`);
      }
    } else if (inspection.gitAvailable) {
      lines.push('', 'No local Git change pending now.');
    }

    if (inspection.lastReloadReport?.status) {
      const status = String(inspection.lastReloadReport.status || '').trim();
      const finishedAt = String(inspection.lastReloadReport.finishedAt || inspection.lastReloadReport.startedAt || '').trim();
      const actions = Array.isArray(inspection.lastReloadReport.actions)
        ? inspection.lastReloadReport.actions.slice(0, 4).join(' | ')
        : '';
      lines.push(
        '',
        `Latest reload supervised: ${status}${finishedAt ? ` em ${finishedAt}` : ''}.`,
      );
      if (actions) {
        lines.push(`Actions: ${actions}`);
      }
      if (inspection.lastReloadReport.errorMessage) {
        lines.push(`Failure registrada: ${inspection.lastReloadReport.errorMessage}`);
      }
    }

    if (inspection.accessReadiness.nextSteps.length > 0) {
      lines.push('', 'Prontos passos de access:');
      for (const step of inspection.accessReadiness.nextSteps.slice(0, 3)) {
        lines.push(`- ${step.title}: ${step.description}`);
      }
    }

    lines.push('', 'shortcuts: /changes for this summary | /selfupdate to recycle the supervised runtime | /autorepair to diagnose, fix, and validate.');
    return lines.join('\n');
  }

  public async requestReload(input: SupervisedReloadRequest): Promise<SupervisedReloadRequestResult> {
    const requestId = `reload-${this.now().getTime()}-${Math.random().toString(36).slice(2, 8)}`;
    const processRef = this.processRef;
    const send = processRef.send;
    if (processRef.env.ZAVORTH_SUPERVISED !== 'true' || typeof send !== 'function') {
      return {
        accepted: false,
        requestId,
        summary:
          'The current runtime is not under Host Supervisor. Click the "Supervised Zavorth" shortcut or start with npm run launcher:supervised before using /selfupdate.',
      };
    }

    if (input.forceRestart !== true) {
      const inspection = this.inspect();
      const shouldReload =
        inspection.installRequired ||
        inspection.buildRequired ||
        !inspection.hostSupervisor.alive ||
        !inspection.telegramWorker.alive ||
        !inspection.accessReadiness.local.ready ||
        inspection.lastReloadReport?.status === 'failed';

      if (!shouldReload) {
        return {
          accepted: false,
          requestId,
          summary:
            'The supervised runtime already appears healthy and has no pending install/build items. Use /selfupdate force if you still want to recycle it.',
        };
      }
    }

    return new Promise<SupervisedReloadRequestResult>((resolve) => {
      let settled = false;
      const timeout = this.setTimeoutImpl(() => {
        finalize({
          accepted: false,
          requestId,
          summary:
            'The host supervisor did not confirm reload handoff in time. Check data/runtime/supervised-launcher-last.log on the host.',
        });
      }, 5_000);

      const handler = (message: any) => {
        if (message?.type !== 'handoff_reload_ack' || message?.requestId !== requestId) {
          return;
        }

        finalize({
          accepted: Boolean(message?.accepted),
          requestId,
          summary:
            String(message?.summary || '').trim() ||
            'O host supervisor recebeu o request de reload.',
        });
      };

      const finalize = (result: SupervisedReloadRequestResult) => {
        if (settled) {
          return;
        }
        settled = true;
        this.clearTimeoutImpl(timeout);
        processRef.removeListener('message', handler);
        resolve(result);
      };

      processRef.on('message', handler);
      send({
        type: 'handoff_reload',
        requestId,
        payload: {
          reason: String(input.reason || '').trim() || 'Supervised reload requested by the operator.',
          requestedBy: String(input.requestedBy || '').trim() || 'unknown',
          notifyChatId: String(input.notifyChatId || '').trim() || null,
          forceRestart: input.forceRestart === true,
        },
      });
    });
  }

  private readGitState(): Pick<
    SupervisedRuntimeInspection,
    'gitAvailable' | 'branch' | 'modifiedFiles' | 'stagedFiles' | 'untrackedFiles' | 'recentCommits'
  > {
    if (!this.existsSync(path.join(this.projectRoot, '.git'))) {
      return {
        gitAvailable: false,
        branch: null,
        modifiedFiles: [],
        stagedFiles: [],
        untrackedFiles: [],
        recentCommits: [],
      };
    }

    try {
      const statusRaw = this.captureGit(['status', '--porcelain=v1', '--branch']);
      const lines = statusRaw.split(/\r...\n/).map((entry) => entry.trimEnd()).filter(Boolean);
      const branchLine = lines.find((entry) => entry.startsWith('## ')) || '';
      const branch = this.parseBranch(branchLine);
      const stagedFiles: string[] = [];
      const modifiedFiles: string[] = [];
      const untrackedFiles: string[] = [];

      for (const line of lines) {
        if (line.startsWith('## ')) {
          continue;
        }

        const code = line.slice(0, 2);
        const filePath = line.slice(3).trim();
        if (!filePath) {
          continue;
        }

        if (code === '......') {
          untrackedFiles.push(filePath);
          continue;
        }

        if (code[0] && code[0] !== ' ') {
          stagedFiles.push(filePath);
        }
        if (code[1] && code[1] !== ' ') {
          modifiedFiles.push(filePath);
        }
      }

      const recentCommits = this.captureGit(['log', '-3', '--date=relative', '--pretty=format:%h%x09%ar%x09%s'])
        .split(/\r...\n/)
        .map((entry) => this.parseCommitLine(entry))
        .filter((entry): entry is GitCommitSummary => Boolean(entry));

      return {
        gitAvailable: true,
        branch,
        modifiedFiles,
        stagedFiles,
        untrackedFiles,
        recentCommits,
      };
    } catch (error: unknown) {logger.warn('[Supervised Runtime] parsing failed', error);
    return {
        gitAvailable: false,
        branch: null,
        modifiedFiles: [],
        stagedFiles: [],
        untrackedFiles: [],
        recentCommits: [],
      };
  }
  }

  private parseBranch(branchLine: string): string | null {
    const normalized = String(branchLine || '').replace(/^##\s*/, '').trim();
    if (!normalized) {
      return null;
    }

    const [branch] = normalized.split('...');
    return branch || null;
  }

  private parseCommitLine(line: string): GitCommitSummary | null {
    const [hash, relativeDate, subject] = String(line || '').split('\t');
    if (!hash || !subject) {
      return null;
    }

    return {
      hash: hash.trim(),
      relativeDate: String(relativeDate || '').trim() || 'agora',
      subject: subject.trim(),
    };
  }

  private captureGit(args: string[]): string {
    return String(
      this.execCommandSyncImpl('git', args, {
        cwd: this.projectRoot,
        encoding: 'utf8',
        stdio: 'pipe',
      }),
    ).trim();
  }

  private testNpmInstallRequired(workingDirectory: string): boolean {
    const nodeModulesDir = path.join(workingDirectory, 'node_modules');
    if (!this.existsSync(nodeModulesDir)) {
      return true;
    }

    const packageJsonPath = path.join(workingDirectory, 'package.json');
    const packageLockPath = path.join(workingDirectory, 'package-lock.json');
    const installStampPath = path.join(nodeModulesDir, '.package-lock.json');
    const referencePath = this.existsSync(installStampPath) ? installStampPath : nodeModulesDir;
    const referenceTime = this.statSync(referencePath).mtimeMs;

    const packageDependencyFingerprint = this.getPackageDependencyFingerprint(packageJsonPath);
    const lockedDependencyFingerprint = this.getPackageLockDependencyFingerprint(packageLockPath);
    if (
      packageDependencyFingerprint &&
      lockedDependencyFingerprint &&
      packageDependencyFingerprint !== lockedDependencyFingerprint
    ) {
      return true;
    }

    if (this.existsSync(packageLockPath) && this.statSync(packageLockPath).mtimeMs > referenceTime) {
      return true;
    }

    if (!this.existsSync(packageLockPath) && this.existsSync(packageJsonPath) && this.statSync(packageJsonPath).mtimeMs > referenceTime) {
      return true;
    }

    return false;
  }

  private getPackageDependencyFingerprint(jsonPath: string): string {
    if (!this.existsSync(jsonPath)) {
      return '';
    }

    try {
      const parsed = JSON.parse(this.readFileSync(jsonPath, 'utf8')) as Record<string, unknown>;
      return this.getDependencyFingerprintFromObject(parsed);
    } catch (error: unknown) {logger.warn('[Supervised Runtime] JSON parse failed', error); return ''; }
  }

  private getPackageLockDependencyFingerprint(jsonPath: string): string {
    if (!this.existsSync(jsonPath)) {
      return '';
    }

    try {
      const parsed = JSON.parse(this.readFileSync(jsonPath, 'utf8')) as Record<string, unknown>;
      return this.getDependencyFingerprintFromObject(this.getPackageLockRootObject(parsed));
    } catch (error: unknown) {logger.warn('[Supervised Runtime] JSON parse failed', error); return ''; }
  }

  private getPackageLockRootObject(input: Record<string, any>): Record<string, unknown> | null {
    const packages = input?.packages;
    if (packages && typeof packages === 'object' && !Array.isArray(packages) && '' in packages) {
      return (packages as Record<string, Record<string, unknown>>)[''] || null;
    }

    return input;
  }

  private getDependencyFingerprintFromObject(input: Record<string, unknown> | null): string {
    if (!input || typeof input !== 'object') {
      return '';
    }

    const snapshot: Record<string, Record<string, string>> = {};
    for (const section of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
      snapshot[section] = this.toSortedStringMap(input[section]);
    }

    return JSON.stringify(snapshot);
  }

  private toSortedStringMap(input: unknown): Record<string, string> {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return {};
    }

    const result: Record<string, string> = {};
    for (const key of Object.keys(input).sort()) {
      result[key] = String((input as Record<string, unknown>)[key]);
    }

    return result;
  }

  private testBuildRequired(): boolean {
    const hostScript = path.join(this.projectRoot, 'dist', 'host.js');
    const workerScript = path.join(this.projectRoot, 'dist', 'index.js');

    if (!this.existsSync(hostScript) || !this.existsSync(workerScript)) {
      return true;
    }

    const latestSourceWrite = this.getLatestWriteTime([
      path.join(this.projectRoot, 'src'),
      path.join(this.projectRoot, 'package.json'),
      path.join(this.projectRoot, 'package-lock.json'),
      path.join(this.projectRoot, 'tsconfig.json'),
    ]);
    const earliestBuildWrite = Math.min(this.statSync(hostScript).mtimeMs, this.statSync(workerScript).mtimeMs);

    return latestSourceWrite > earliestBuildWrite;
  }

  private getLatestWriteTime(targets: string[]): number {
    let latest = 0;
    for (const target of targets) {
      if (!this.existsSync(target)) {
        continue;
      }

      latest = Math.max(latest, this.getEntryLatestWriteTime(target));
    }

    return latest;
  }

  private getEntryLatestWriteTime(target: string): number {
    const stat = this.statSync(target);
    if (!stat.isDirectory()) {
      return stat.mtimeMs;
    }

    let latest = stat.mtimeMs;
    for (const entry of this.readdirSync(target)) {
      const normalized = String(entry || '').trim();
      if (!normalized || normalized.startsWith('.') || normalized === 'node_modules' || normalized === 'dist' || normalized === 'build') {
        continue;
      }

      const nextPath = path.join(target, normalized);
      latest = Math.max(latest, this.getEntryLatestWriteTime(nextPath));
    }

    return latest;
  }

  private readLockSnapshot(filePath: string): LockSnapshot {
    if (!this.existsSync(filePath)) {
      return {
        active: false,
        pid: null,
        owner: null,
        startedAt: null,
        alive: false,
      };
    }

    try {
      const parsed = JSON.parse(this.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
      const pid = Number(parsed.pid || 0) || null;
      return {
        active: true,
        pid,
        owner: typeof parsed.owner === 'string' ? parsed.owner : null,
        startedAt: typeof parsed.startedAt === 'string' ? parsed.startedAt : null,
        alive: pid ? this.isProcessAlive(pid) : false,
      };
    } catch (error: unknown) {logger.warn('[Supervised Runtime] filesystem operation failed', error);
    return {
        active: true,
        pid: null,
        owner: null,
        startedAt: null,
        alive: false,
      };
  }
  }

  private isProcessAlive(pid: number): boolean {
    try {
      this.killFn(pid, 0);
      return true;
    } catch (error: unknown) {logger.warn('[Supervised Runtime] parsing failed', error); return asErrorLike(error).code !== 'ESRCH'; }
  }

  private readLastReloadReport(): ReloadReport | null {
    const reportPath = config.supervisedReloadReportFile;
    if (!this.existsSync(reportPath)) {
      return null;
    }

    try {
      return JSON.parse(this.readFileSync(reportPath, 'utf8')) as ReloadReport;
    } catch (error: unknown) {logger.warn('[Supervised Runtime] JSON parse failed', error); return null; }
  }
}
