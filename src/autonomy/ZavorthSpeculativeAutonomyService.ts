import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { createTwoFilesPatch } from 'diff';
import ts from 'typescript';
import { config } from '../config/index.js';
import { spawnCommand } from '../core/CommandSpawn.js';
import type { ZavorthMutationPlan, ZavorthReadinessGate } from '../contracts/ZavorthMutationPlaneContract.js';
import { WorkspaceResolver } from '../security/WorkspaceResolver.js';
import { DockerSandboxRuntime, type DockerSandboxStatus } from '../services/sandbox/DockerSandboxRuntime.js';
import { ZavorthMutationPlaneService } from '../services/ZavorthMutationPlaneService.js';
import {
  buildAstContextGraph,
  inspectSourceFile,
  symbolFromNode,
  resolveRelativeImport,
  normalizeRelativeSourcePath
} from './ZavorthSpeculativeAstAnalysis.js';
import {
  copyWorkspace,
  shouldSkipCopy,
  applyWrite,
  applyPatch,
  validateWrite,
  validatePatch,
  buildUnifiedDiff,
  findUnsafeOriginalPath,
  safeReadWorkspaceTextFile
} from './ZavorthSpeculativeWorkspaceOperations.js';

import {
  runValidationCommands,
  buildValidationEnv,
  resolveSandboxBackend,
  buildLocalSandboxReceipt,
  runDockerValidationCommand,
  canUseDockerForSpeculativeValidation,
  safeDockerStatus,
  defaultCommandRunner,
  defaultDockerValidationRunner
} from './ZavorthSpeculativeSandboxRunner.js';

export {
  buildSpeculativeDockerValidationArgs,
  parseSpeculativeValidationCommand,
} from './ZavorthSpeculativeSandboxRunner.js';

export type ZavorthSpeculativeWorkspaceWrite = {
  path: string;
  content: string;
  actionId?: string | null;
  description?: string | null;
};

export type ZavorthSpeculativeWorkspacePatchHunk = {
  search: string;
  replace: string;
  description?: string | null;
};

export type ZavorthSpeculativeWorkspacePatch = {
  path: string;
  search?: string;
  replace?: string;
  hunks: ZavorthSpeculativeWorkspacePatchHunk[];
  actionId?: string | null;
  description?: string | null;
};

export type ZavorthAstContextGraphSymbol = {
  name: string;
  kind: 'class' | 'function' | 'interface' | 'type' | 'enum' | 'variable';
  exported: boolean;
  line: number;
};

export type ZavorthAstContextGraphFile = {
  path: string;
  imports: Array<{
    specifier: string;
    resolvedPath: string | null;
    external: boolean;
  }>;
  symbols: ZavorthAstContextGraphSymbol[];
  referencedIdentifiers: string[];
  parseErrors: string[];
};

export type ZavorthAstContextGraph = {
  generatedAt: string;
  workspaceRoot: string;
  entryFiles: string[];
  files: ZavorthAstContextGraphFile[];
  edges: Array<{
    from: string;
    to: string;
    kind: 'relative-import' | 'external-import';
  }>;
  summary: {
    fileCount: number;
    edgeCount: number;
    symbolCount: number;
    parseErrorCount: number;
  };
};

export type ZavorthSpeculativeValidationResult = {
  command: string;
  status: 'passed' | 'failed' | 'blocked' | 'skipped';
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut?: boolean;
};

export type ZavorthSpeculativeSandboxIsolation = 'auto' | 'local-copy' | 'container' | 'microvm';

export type ZavorthSpeculativeSandboxBackendReceipt = {
  kind: 'local-copy' | 'container' | 'microvm';
  requested: ZavorthSpeculativeSandboxIsolation;
  validationExecution: 'host' | 'container' | 'microvm' | 'skipped' | 'blocked';
  runtime: string;
  hardened: boolean;
  detail: string;
  fallbackFrom?: 'container' | 'microvm' | null;
  docker?: {
    image: string;
    sandboxRuntime: string;
    daemonReachable: boolean;
    canRun: boolean;
    network: 'none';
    readOnlyRootfs: boolean;
  } | null;
};

export type ZavorthSpeculativeCriticFinding = {
  id: string;
  severity: 'info' | 'warning' | 'high' | 'critical';
  summary: string;
};

export type ZavorthSpeculativeAttempt = {
  id: string;
  round: number;
  sandboxWorkspace: string;
  status: 'approved' | 'needs_correction' | 'blocked' | 'failed';
  summary: string;
  touchedFiles: string[];
  diffText: string;
  diffHash: string | null;
  astGraph: ZavorthAstContextGraph;
  validationResults: ZavorthSpeculativeValidationResult[];
  sandboxBackend: ZavorthSpeculativeSandboxBackendReceipt;
  critic: {
    approved: boolean;
    findings: ZavorthSpeculativeCriticFinding[];
  };
  readinessGate: ZavorthReadinessGate;
  blockedReasons: string[];
};

export type ZavorthSpeculativeCommandRunnerInput = {
  command: string;
  cwd: string;
  timeoutMs: number;
  env?: NodeJS.ProcessEnv;
};

export type ZavorthSpeculativeCommandRunner = (
  input: ZavorthSpeculativeCommandRunnerInput,
) => Promise<ZavorthSpeculativeValidationResult>;

export type ZavorthSpeculativeDockerValidationRunnerInput = {
  command: string;
  args: string[];
  timeoutMs: number;
  originalCommand: string;
};

export type ZavorthSpeculativeDockerValidationRunner = (
  input: ZavorthSpeculativeDockerValidationRunnerInput,
) => Promise<ZavorthSpeculativeValidationResult>;

export type ZavorthSpeculativeCorrectionInput = {
  task: string;
  workspaceRoot: string;
  attempt: ZavorthSpeculativeAttempt;
};

export type ZavorthSpeculativeCorrection = {
  writes?: ZavorthSpeculativeWorkspaceWrite[];
  patches?: ZavorthSpeculativeWorkspacePatch[];
  summary?: string | null;
};

export type ZavorthSpeculativeCorrectionProvider = (
  input: ZavorthSpeculativeCorrectionInput,
) => Promise<ZavorthSpeculativeCorrection | null>;

export type ZavorthSpeculativeCancellationCheckInput = {
  runId: string;
  sourceRunId: string | null;
  round: number;
  elapsedMs: number;
};

export type ZavorthSpeculativeCancellationCheck = (
  input: ZavorthSpeculativeCancellationCheckInput,
) => boolean | Promise<boolean>;

export type PrepareZavorthSpeculativeAutonomyInput = {
  workspaceRoot: string;
  task: string;
  writes?: ZavorthSpeculativeWorkspaceWrite[];
  patches?: ZavorthSpeculativeWorkspacePatch[];
  validationCommands?: string[];
  validationMode?: 'auto' | 'provided' | 'skip';
  runId?: string | null;
  traceId?: string | null;
  requestedBy?: string | null;
  sourceSurface?: string | null;
  createMutationPlan?: boolean;
  approvalRequired?: boolean;
  maxCorrectionRounds?: number;
  timeBudgetMs?: number | null;
  tokenBudget?: number | null;
  shouldCancel?: ZavorthSpeculativeCancellationCheck | null;
  sandboxIsolation?: ZavorthSpeculativeSandboxIsolation | null;
  correctionProvider?: ZavorthSpeculativeCorrectionProvider | null;
};

export type ZavorthSpeculativeAutoHealingReceipt = {
  status: 'idle' | 'running' | 'passed' | 'failed' | 'blocked';
  attempt: number;
  maxAttempts: number;
  lastErrorSummary: string | null;
  proposedCorrection: string | null;
  validationCommand: string | null;
  startedAt: string;
  completedAt: string;
  elapsedMs: number;
  maxElapsedMs: number;
  tokenBudget: number | null;
  tokensUsed: number | null;
  estimatedCostUsd: number | null;
  cancellable: boolean;
  cancelRequested: boolean;
  timedOut: boolean;
};

export type ZavorthSpeculativeAutonomyResult = {
  id: string;
  status: 'approved' | 'needs_correction' | 'blocked' | 'failed';
  summary: string;
  workspaceRoot: string;
  runRoot: string;
  attempts: ZavorthSpeculativeAttempt[];
  finalAttempt: ZavorthSpeculativeAttempt | null;
  mutationPlan: ZavorthMutationPlan | null;
  validationCommands: string[];
  receipts: string[];
  autoHealing: ZavorthSpeculativeAutoHealingReceipt;
};

export class ZavorthSpeculativeAutonomyCancellationRegistry {
  private readonly cancelled = new Map<string, { requestedAt: string; reason: string }>();

  public requestCancel(runId: string | null | undefined, reason = 'user-requested'): void {
    const normalized = normalizeText(runId);
    if (!normalized) return;
    this.cancelled.set(normalized, {
      requestedAt: new Date().toISOString(),
      reason: normalizeText(reason, 'user-requested'),
    });
  }

  public isCancelled(runId: string | null | undefined): boolean {
    const normalized = normalizeText(runId);
    return Boolean(normalized && this.cancelled.has(normalized));
  }

  public clear(runId?: string | null): void {
    const normalized = normalizeText(runId);
    if (normalized) {
      this.cancelled.delete(normalized);
      return;
    }
    this.cancelled.clear();
  }
}

export const defaultZavorthSpeculativeAutonomyCancellationRegistry =
  new ZavorthSpeculativeAutonomyCancellationRegistry();

type SpeculativeAutonomyRuntime = {
  runRoot?: string;
  now?: () => Date;
  mutationPlane?: Pick<ZavorthMutationPlaneService, 'createPlan'> | null;
  commandRunner?: ZavorthSpeculativeCommandRunner;
  dockerRunner?: ZavorthSpeculativeDockerValidationRunner;
  dockerRuntime?: Pick<DockerSandboxRuntime, 'getStatus'> | null;
  sandboxIsolation?: ZavorthSpeculativeSandboxIsolation | null;
  maxCopyFiles?: number;
  maxCopyBytes?: number;
  validationTimeoutMs?: number;
  cancellationRegistry?: Pick<ZavorthSpeculativeAutonomyCancellationRegistry, 'isCancelled'> | null;
};

type WorkspaceCopyStats = {
  files: number;
  bytes: number;
  skipped: string[];
};

export type ParsedSpeculativeValidationCommand = {
  executable: string;
  args: string[];
};

type EditCandidate = {
  writes: ZavorthSpeculativeWorkspaceWrite[];
  patches: ZavorthSpeculativeWorkspacePatch[];
  sourceSummary: string | null;
};

const DEFAULT_MAX_COPY_FILES = 4500;
const DEFAULT_MAX_COPY_BYTES = 180 * 1024 * 1024;
const DEFAULT_VALIDATION_TIMEOUT_MS = 120000;
const DEFAULT_AUTO_HEALING_TIME_BUDGET_MS = 2 * 60 * 1000;
const MAX_VALIDATION_COMMANDS = 3;
const MAX_AST_FILES = 80;
const MAX_DIFF_CHARS = 100000;
const MAX_STDIO_CHARS = 12000;
const MAX_EDIT_BYTES = 1024 * 1024;

const IGNORED_DIR_NAMES = new Set([
  '.git',
  'node_modules',
  'dist',
  'dist-ops',
  'build',
  'coverage',
  '.next',
  '.turbo',
  '.cache',
  '.tmp',
  'tmp',
]);

const IGNORED_RELATIVE_PREFIXES = [
  'data/runtime/',
  'data\\runtime\\',
];

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts'];

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizePortablePath(value: string): string {
  return value.replace(/\\/g, '/');
}

function clampText(value: unknown, maxChars = MAX_STDIO_CHARS): string {
  const text = String(value ?? '');
  return text.length <= maxChars ? text : `${text.slice(0, maxChars - 20)}\n[truncated]`;
}

function redactSensitiveText(value: unknown, maxChars = MAX_STDIO_CHARS): string {
  let text = clampText(value, maxChars);
  text = text.replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, '[redacted-secret]');
  text = text.replace(/\b(?:ghp|github_pat|glpat|xox[baprs])-[A-Za-z0-9_-]{12,}\b/gi, '[redacted-secret]');
  text = text.replace(/\bAKIA[0-9A-Z]{16}\b/g, '[redacted-secret]');
  text = text.replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{12,}\b/gi, 'Bearer [redacted-secret]');
  text = text.replace(
    /\b((?:api[_-]?key|token|secret|password|passwd|credential)\s*[:=]\s*["']?)([^"'\s]{6,})/gi,
    '$1[redacted-secret]',
  );
  return text;
}

function redactValidationResult(result: ZavorthSpeculativeValidationResult): ZavorthSpeculativeValidationResult {
  return {
    ...result,
    command: redactSensitiveText(result.command, 1200),
    stdout: redactSensitiveText(result.stdout),
    stderr: redactSensitiveText(result.stderr),
  };
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function looksLikeSecret(value: string): boolean {
  return /\b(?:\.env|id_rsa|credentials\.json|secrets?\.json|token|secret|password|api[_-]?key|sk-[a-z0-9_-]{12,})\b/i.test(value);
}

function countOccurrences(value: string, search: string): number {
  if (!search) {
    return 0;
  }
  let count = 0;
  let index = value.indexOf(search);
  while (index >= 0) {
    count += 1;
    index = value.indexOf(search, index + search.length);
  }
  return count;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>).sort().map((key) =>
      `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`,
    ).join(',')}}`;
  }
  return JSON.stringify(value);
}

export class ZavorthSpeculativeAutonomyService {
  private readonly runRoot: string;
  private readonly now: () => Date;
  private readonly mutationPlane: Pick<ZavorthMutationPlaneService, 'createPlan'> | null;
  private readonly commandRunner: ZavorthSpeculativeCommandRunner;
  private readonly dockerRunner: ZavorthSpeculativeDockerValidationRunner;
  private readonly dockerRuntime: Pick<DockerSandboxRuntime, 'getStatus'> | null;
  private readonly sandboxIsolation: ZavorthSpeculativeSandboxIsolation;
  private readonly maxCopyFiles: number;
  private readonly maxCopyBytes: number;
  private readonly validationTimeoutMs: number;
  private readonly cancellationRegistry: Pick<ZavorthSpeculativeAutonomyCancellationRegistry, 'isCancelled'> | null;

  constructor(runtime: SpeculativeAutonomyRuntime = {}) {
    this.runRoot = runtime.runRoot || path.resolve(config.projectRoot, 'data', 'runtime', 'speculative-runs');
    this.now = runtime.now || (() => new Date());
    this.mutationPlane = runtime.mutationPlane === null
      ? null
      : runtime.mutationPlane || new ZavorthMutationPlaneService();
    this.commandRunner = runtime.commandRunner || defaultCommandRunner;
    this.dockerRunner = runtime.dockerRunner || defaultDockerValidationRunner;
    this.dockerRuntime = runtime.dockerRuntime === null
      ? null
      : runtime.dockerRuntime || new DockerSandboxRuntime();
    this.sandboxIsolation = this.normalizeSandboxIsolation(
      runtime.sandboxIsolation
      || (runtime.commandRunner ? 'local-copy' : null)
      || process.env.ZAVORTH_SPECULATIVE_SANDBOX_ISOLATION
      || (config.dockerSandboxRequired ? 'container' : 'auto'),
    );
    this.maxCopyFiles = Math.max(50, runtime.maxCopyFiles || DEFAULT_MAX_COPY_FILES);
    this.maxCopyBytes = Math.max(1024 * 1024, runtime.maxCopyBytes || DEFAULT_MAX_COPY_BYTES);
    this.validationTimeoutMs = Math.max(1000, runtime.validationTimeoutMs || DEFAULT_VALIDATION_TIMEOUT_MS);
    this.cancellationRegistry = runtime.cancellationRegistry === null
      ? null
      : runtime.cancellationRegistry || defaultZavorthSpeculativeAutonomyCancellationRegistry;
  }

  public async prepare(input: PrepareZavorthSpeculativeAutonomyInput): Promise<ZavorthSpeculativeAutonomyResult> {
    const id = this.buildRunId(input.runId);
    const workspaceRoot = path.resolve(input.workspaceRoot);
    const initialCandidate: EditCandidate = {
      writes: this.normalizeWrites(input.writes || []),
      patches: this.normalizePatches(input.patches || []),
      sourceSummary: 'initial-llm-draft',
    };
    const validationCommands = this.resolveValidationCommands(workspaceRoot, input);
    const attempts: ZavorthSpeculativeAttempt[] = [];
    const maxCorrectionRounds = Math.max(0, Math.min(input.maxCorrectionRounds ?? 1, 3));
    const startedAt = this.now();
    const controlState = {
      startedAt,
      maxElapsedMs: this.resolveAutoHealingTimeBudget(input.timeBudgetMs),
      tokenBudget: this.resolveNullableBudget(input.tokenBudget),
      cancelRequested: false,
      timedOut: false,
    };
    let candidate = initialCandidate;

    let workspaceStat: ReturnType<typeof fs.lstatSync> | null = null;
    try {
      workspaceStat = fs.lstatSync(workspaceRoot);
    } catch (error: unknown) {workspaceStat = null;
    }
    if (!workspaceStat?.isDirectory() || workspaceStat.isSymbolicLink()) {
      const attempt = this.blockedAttempt({
        id,
        workspaceRoot,
        round: 0,
        reason: `Workspace especulativo invalido, ausente ou simbolico: ${workspaceRoot}.`,
      });
      return this.resultFromAttempts({
        id,
        workspaceRoot,
        validationCommands,
        attempts: [attempt],
        input,
        controlState,
      });
    }

    if (candidate.writes.length === 0 && candidate.patches.length === 0) {
      const attempt = this.blockedAttempt({
        id,
        workspaceRoot,
        round: 0,
        reason: 'No structured write or patch was provided for the speculative rehearsal.',
      });
      return this.resultFromAttempts({
        id,
        workspaceRoot,
        validationCommands,
        attempts: [attempt],
        input,
        controlState,
      });
    }

    for (let round = 0; round <= maxCorrectionRounds; round += 1) {
      const stopReason = await this.resolveAutoHealingStopReason({
        id,
        sourceRunId: input.runId || null,
        round,
        input,
        controlState,
      });
      if (stopReason) {
        attempts.push(this.blockedAttempt({
          id,
          workspaceRoot,
          round,
          reason: stopReason,
        }));
        break;
      }
      const attempt = await this.runAttempt({
        id,
        workspaceRoot,
        task: input.task,
        round,
        candidate,
        validationCommands,
        validationMode: input.validationMode || 'auto',
        sandboxIsolation: this.normalizeSandboxIsolation(input.sandboxIsolation || this.sandboxIsolation),
      });
      attempts.push(attempt);
      if (attempt.status === 'approved' || attempt.status === 'blocked') {
        break;
      }
      if (!input.correctionProvider || round >= maxCorrectionRounds) {
        break;
      }

      const correctionStopReason = await this.resolveAutoHealingStopReason({
        id,
        sourceRunId: input.runId || null,
        round: round + 1,
        input,
        controlState,
      });
      if (correctionStopReason) {
        attempts.push(this.blockedAttempt({
          id,
          workspaceRoot,
          round: round + 1,
          reason: correctionStopReason,
        }));
        break;
      }

      const correction = await input.correctionProvider({
        task: input.task,
        workspaceRoot,
        attempt,
      });
      const nextCandidate: EditCandidate = {
        writes: this.normalizeWrites(correction?.writes || []),
        patches: this.normalizePatches(correction?.patches || []),
        sourceSummary: normalizeText(correction?.summary, 'self-correction'),
      };
      if (nextCandidate.writes.length === 0 && nextCandidate.patches.length === 0) {
        break;
      }
      candidate = nextCandidate;
    }

    return this.resultFromAttempts({
      id,
      workspaceRoot,
      validationCommands,
      attempts,
      input,
      controlState,
    });
  }


  private async runAttempt(input: {
    id: string;
    workspaceRoot: string;
    task: string;
    round: number;
    candidate: EditCandidate;
    validationCommands: string[];
    validationMode: 'auto' | 'provided' | 'skip';
    sandboxIsolation: ZavorthSpeculativeSandboxIsolation;
  }): Promise<ZavorthSpeculativeAttempt> {
    const attemptId = `${input.id}-round-${input.round + 1}`;
    const sandboxWorkspace = path.join(this.runRoot, input.id, `round-${input.round + 1}`, 'workspace');
    const blockedReasons: string[] = [];
    const sandboxBackend = this.resolveSandboxBackend({
      requested: input.sandboxIsolation,
      validationMode: input.validationMode,
    });
    fs.mkdirSync(path.dirname(sandboxWorkspace), { recursive: true });

    let copyStats: WorkspaceCopyStats;
    try {
      copyStats = this.copyWorkspace(input.workspaceRoot, sandboxWorkspace);
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error);
      return this.blockedAttempt({
        id: input.id,
        workspaceRoot: input.workspaceRoot,
        round: input.round,
        reason,
        sandboxWorkspace,
        sandboxBackend,
      });
    }

    const touchedFiles: string[] = [];
    for (const write of input.candidate.writes) {
      const result = this.applyWrite({ sandboxWorkspace, write });
      if (result.blockedReason) {
        blockedReasons.push(result.blockedReason);
      } else if (result.relativePath) {
        touchedFiles.push(result.relativePath);
      }
    }
    for (const patch of input.candidate.patches) {
      const result = this.applyPatch({ sandboxWorkspace, patch });
      if (result.blockedReason) {
        blockedReasons.push(result.blockedReason);
      } else if (result.relativePath) {
        touchedFiles.push(result.relativePath);
      }
    }

    const uniqueTouchedFiles = Array.from(new Set(touchedFiles)).sort();
    const unsafeOriginalPath = uniqueTouchedFiles
      .map((relativePath) => this.findUnsafeOriginalPath(input.workspaceRoot, relativePath))
      .find((entry): entry is string => Boolean(entry));
    if (unsafeOriginalPath) {
      return this.blockedAttempt({
        id: input.id,
        workspaceRoot: input.workspaceRoot,
        round: input.round,
        reason: `Alteracao especulativa bloqueada porque o alvo original atravessa symlink: ${unsafeOriginalPath}.`,
        sandboxWorkspace,
        sandboxBackend,
      });
    }

    const astGraph = this.buildAstContextGraph({
      workspaceRoot: sandboxWorkspace,
      entryFiles: uniqueTouchedFiles,
    });

    if (blockedReasons.length > 0) {
      const readinessGate = this.buildReadinessGate({
        attemptId,
        status: 'blocked',
        canProceed: false,
        blockers: blockedReasons,
        validationResults: [],
      });
      return {
        id: attemptId,
        round: input.round,
        sandboxWorkspace,
        status: 'blocked',
        summary: `${blockedReasons.length} bloqueio(s) impediram o ensaio especulativo.`,
        touchedFiles: uniqueTouchedFiles,
        diffText: '',
        diffHash: null,
        astGraph,
        validationResults: [],
        sandboxBackend,
        critic: {
          approved: false,
          findings: blockedReasons.map((reason, index) => ({
            id: `blocked-${index + 1}`,
            severity: 'critical',
            summary: reason,
          })),
        },
        readinessGate,
        blockedReasons,
      };
    }

    const diffText = this.buildUnifiedDiff({
      originalWorkspace: input.workspaceRoot,
      sandboxWorkspace,
      touchedFiles: uniqueTouchedFiles,
    });
    const validationResults = input.validationMode === 'skip'
      ? [this.skippedValidation('Validacao explicitamente desativada para este ensaio especulativo.')]
      : await this.runValidationCommands({
        originalWorkspace: input.workspaceRoot,
        sandboxWorkspace,
        commands: input.validationCommands,
        sandboxBackend,
      });
    const critic = this.reviewAttempt({
      diffText,
      validationResults,
      astGraph,
      copyStats,
      touchedFiles: uniqueTouchedFiles,
      sandboxBackend,
    });
    const status = critic.approved ? 'approved' : 'needs_correction';
    const readinessGate = this.buildReadinessGate({
      attemptId,
      status: status === 'approved' ? (critic.findings.some((finding) => finding.severity === 'warning') ? 'warning' : 'passed') : 'failed',
      canProceed: status === 'approved',
      warnings: critic.findings.filter((finding) => finding.severity === 'warning').map((finding) => finding.summary),
      blockers: critic.findings.filter((finding) => ['high', 'critical'].includes(finding.severity)).map((finding) => finding.summary),
      validationResults,
    });

    return {
      id: attemptId,
      round: input.round,
      sandboxWorkspace,
      status,
      summary: status === 'approved'
        ? `Speculative rehearsal approved with ${uniqueTouchedFiles.length} changed file(s).`
        : 'Ensaio especulativo precisa de correcao antes de virar plano aprovavel.',
      touchedFiles: uniqueTouchedFiles,
      diffText,
      diffHash: diffText ? sha256(diffText) : null,
      astGraph,
      validationResults,
      sandboxBackend,
      critic,
      readinessGate,
      blockedReasons: [],
    };
  }

  private resolveAutoHealingTimeBudget(value: number | null | undefined): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return DEFAULT_AUTO_HEALING_TIME_BUDGET_MS;
    }
    return Math.max(1_000, Math.min(Math.floor(numeric), 10 * 60 * 1000));
  }

  private resolveNullableBudget(value: number | null | undefined): number | null {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : null;
  }

  private async resolveAutoHealingStopReason(input: {
    id: string;
    sourceRunId: string | null;
    round: number;
    input: PrepareZavorthSpeculativeAutonomyInput;
    controlState: {
      startedAt: Date;
      maxElapsedMs: number;
      tokenBudget: number | null;
      cancelRequested: boolean;
      timedOut: boolean;
    };
  }): Promise<string | null> {
    const elapsedMs = Math.max(0, this.now().getTime() - input.controlState.startedAt.getTime());
    if (elapsedMs > input.controlState.maxElapsedMs) {
      input.controlState.timedOut = true;
      return `Auto-healing interrompido: budget de tempo excedido (${elapsedMs}ms de ${input.controlState.maxElapsedMs}ms).`;
    }

    const registryCancelled = Boolean(
      this.cancellationRegistry?.isCancelled(input.id)
      || this.cancellationRegistry?.isCancelled(input.sourceRunId),
    );
    const callbackCancelled = input.input.shouldCancel
      ? await input.input.shouldCancel({
        runId: input.id,
        sourceRunId: input.sourceRunId,
        round: input.round,
        elapsedMs,
      })
      : false;
    if (registryCancelled || callbackCancelled) {
      input.controlState.cancelRequested = true;
      return 'Auto-healing cancelled by the user before consuming more budget.';
    }
    return null;
  }

  private buildAutoHealingReceipt(input: {
    status: ZavorthSpeculativeAutonomyResult['status'];
    finalAttempt: ZavorthSpeculativeAttempt | null;
    attempts: ZavorthSpeculativeAttempt[];
    validationCommands: string[];
    controlState: {
      startedAt: Date;
      maxElapsedMs: number;
      tokenBudget: number | null;
      cancelRequested: boolean;
      timedOut: boolean;
    };
  }): ZavorthSpeculativeAutoHealingReceipt {
    const completedAt = this.now();
    const elapsedMs = Math.max(0, completedAt.getTime() - input.controlState.startedAt.getTime());
    const failedValidation = input.finalAttempt?.validationResults.find((result) =>
      result.status === 'failed' || result.status === 'blocked');
    const status: ZavorthSpeculativeAutoHealingReceipt['status'] =
      input.status === 'approved'
        ? 'passed'
        : input.status === 'blocked'
          ? 'blocked'
          : input.status === 'needs_correction'
            ? 'failed'
            : 'failed';
    return {
      status,
      attempt: Math.max(0, input.attempts.length),
      maxAttempts: Math.max(1, input.attempts.length),
      lastErrorSummary: failedValidation
        ? redactSensitiveText(failedValidation.stderr || failedValidation.stdout || failedValidation.command, 800)
        : input.finalAttempt?.summary || null,
      proposedCorrection: input.status === 'needs_correction'
        ? 'Auto-healing esgotou as tentativas disponiveis sem validar o diff final.'
        : null,
      validationCommand: input.validationCommands[0] || input.finalAttempt?.validationResults[0]?.command || null,
      startedAt: input.controlState.startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      elapsedMs,
      maxElapsedMs: input.controlState.maxElapsedMs,
      tokenBudget: input.controlState.tokenBudget,
      tokensUsed: null,
      estimatedCostUsd: null,
      cancellable: false,
      cancelRequested: input.controlState.cancelRequested,
      timedOut: input.controlState.timedOut,
    };
  }

  private resultFromAttempts(input: {
    id: string;
    workspaceRoot: string;
    validationCommands: string[];
    attempts: ZavorthSpeculativeAttempt[];
    input: PrepareZavorthSpeculativeAutonomyInput;
    controlState: {
      startedAt: Date;
      maxElapsedMs: number;
      tokenBudget: number | null;
      cancelRequested: boolean;
      timedOut: boolean;
    };
  }): ZavorthSpeculativeAutonomyResult {
    const finalAttempt = input.attempts[input.attempts.length - 1] || null;
    const status = finalAttempt?.status || 'failed';
    const mutationPlan = finalAttempt && status === 'approved' && input.input.createMutationPlan !== false
      ? this.createMutationPlan({
        id: input.id,
        workspaceRoot: input.workspaceRoot,
        input: input.input,
        finalAttempt,
        validationCommands: input.validationCommands,
      })
      : null;
    return {
      id: input.id,
      status,
      summary: this.summarizeResult(status, finalAttempt, mutationPlan),
      workspaceRoot: input.workspaceRoot,
      runRoot: path.join(this.runRoot, input.id),
      attempts: input.attempts,
      finalAttempt,
      mutationPlan,
      validationCommands: input.validationCommands,
      autoHealing: this.buildAutoHealingReceipt({
        status,
        finalAttempt,
        attempts: input.attempts,
        validationCommands: input.validationCommands,
        controlState: input.controlState,
      }),
      receipts: [
        'super-zavorth-speculative-sandbox',
        finalAttempt?.sandboxBackend.validationExecution === 'container'
          ? 'strong-container-sandbox-validation'
          : 'local-copy-sandbox-validation',
        'ast-context-graph',
        'mandatory-validation-stage',
        'executor-critic-gate',
        'auto-healing-budget-guard',
        ...(input.controlState.cancelRequested ? ['auto-healing-cancelled'] : []),
        ...(input.controlState.timedOut ? ['auto-healing-budget-exhausted'] : []),
        ...(mutationPlan ? ['governed-mutation-plan-created'] : ['host-workspace-not-mutated']),
      ],
    };
  }

  private createMutationPlan(input: {
    id: string;
    workspaceRoot: string;
    input: PrepareZavorthSpeculativeAutonomyInput;
    finalAttempt: ZavorthSpeculativeAttempt;
    validationCommands: string[];
  }): ZavorthMutationPlan | null {
    if (!this.mutationPlane) {
      return null;
    }
    return this.mutationPlane.createPlan({
      domain: 'capability',
      actionId: `super-zavorth-speculative-${input.id}`,
      title: 'Super Zavorth speculative workspace plan',
      summary: input.finalAttempt.summary,
      requestedBy: normalizeText(input.input.requestedBy) || null,
      sourceSurface: normalizeText(input.input.sourceSurface, 'agent-run-llm-runtime'),
      riskLevel: 'medium',
      approvalRequired: input.input.approvalRequired !== false,
      approvalReason: 'Changes were rehearsed in a temporary sandbox and need approval before touching the real workspace.',
      validationPlan: input.validationCommands,
      rollbackPlan: [
        'Nenhuma alteracao foi aplicada ao workspace real durante o ensaio.',
        'Para cancelar, descarte o plano de mutacao e remova o diretorio especulativo registrado no payload.',
      ],
      resourceImpact: {
        diskMb: Math.max(1, Math.ceil(Buffer.byteLength(input.finalAttempt.diffText || '', 'utf8') / (1024 * 1024))),
        processCount: input.finalAttempt.validationResults.length,
        externalExposure: 'none',
        recurring: false,
        notes: [
          `sandboxWorkspace=${input.finalAttempt.sandboxWorkspace}`,
          `sandboxBackend=${input.finalAttempt.sandboxBackend.kind}`,
          `validationExecution=${input.finalAttempt.sandboxBackend.validationExecution}`,
          `diffHash=${input.finalAttempt.diffHash || 'none'}`,
        ],
      },
      readinessGates: [input.finalAttempt.readinessGate],
      payload: {
        kind: 'super-zavorth-speculative-autonomy',
        workspaceRoot: input.workspaceRoot,
        task: redactSensitiveText(input.input.task, 3000),
        sandboxWorkspace: input.finalAttempt.sandboxWorkspace,
        touchedFiles: input.finalAttempt.touchedFiles,
        diffText: redactSensitiveText(input.finalAttempt.diffText, MAX_DIFF_CHARS),
        diffHash: input.finalAttempt.diffHash,
        validationResults: input.finalAttempt.validationResults.map(redactValidationResult),
        sandboxBackend: input.finalAttempt.sandboxBackend,
        astGraph: input.finalAttempt.astGraph,
        critic: input.finalAttempt.critic,
        receipts: [
          'sandbox-only-apply',
          'final-diff-ready',
          'validation-receipts-attached',
          'critic-approved',
        ],
      },
      retentionPolicy: {
        ttlMs: 24 * 60 * 60 * 1000,
        maxBytes: MAX_DIFF_CHARS * 2,
        cleanupOnSuccess: false,
        cleanupOnBoot: false,
        notes: ['Mantem evidencias do ensaio para revisao antes do apply real.'],
      },
    });
  }

  private summarizeResult(
    status: ZavorthSpeculativeAutonomyResult['status'],
    finalAttempt: ZavorthSpeculativeAttempt | null,
    mutationPlan: ZavorthMutationPlan | null,
  ): string {
    if (!finalAttempt) {
      return 'Super Zavorth could not prepare a speculative rehearsal.';
    }
    if (status === 'approved') {
      return mutationPlan
        ? `Sandbox approved, final diff generated, and plan ${mutationPlan.id} created for approval.`
        : 'Sandbox approved and final diff generated without applying to the real workspace.';
    }
    if (status === 'blocked') {
      return `Sandbox blocked: ${finalAttempt.blockedReasons.join('; ') || finalAttempt.summary}`;
    }
    return `${finalAttempt.summary} ${finalAttempt.critic.findings.map((finding) => finding.summary).join(' ')}`.trim();
  }

  private reviewAttempt(input: {
    diffText: string;
    validationResults: ZavorthSpeculativeValidationResult[];
    astGraph: ZavorthAstContextGraph;
    copyStats: WorkspaceCopyStats;
    touchedFiles: string[];
    sandboxBackend: ZavorthSpeculativeSandboxBackendReceipt;
  }): ZavorthSpeculativeAttempt['critic'] {
    const findings: ZavorthSpeculativeCriticFinding[] = [];
    if (input.touchedFiles.length === 0 || !input.diffText.trim()) {
      findings.push({
        id: 'empty-diff',
        severity: 'high',
        summary: 'The executor did not produce a material diff that can be approved.',
      });
    }
    for (const result of input.validationResults) {
      if (result.status === 'blocked') {
        findings.push({
          id: `validation-blocked-${sha256(result.command).slice(0, 8)}`,
          severity: 'critical',
          summary: `Validacao bloqueada: ${result.command}.`,
        });
      } else if (result.status === 'failed') {
        findings.push({
          id: `validation-failed-${sha256(result.command).slice(0, 8)}`,
          severity: 'high',
          summary: `Validacao falhou: ${result.command}.`,
        });
      } else if (result.status === 'skipped') {
        findings.push({
          id: 'validation-skipped',
          severity: 'warning',
          summary: result.stderr || result.stdout || 'Validacao registrada como skipped.',
        });
      }
    }
    if (input.astGraph.summary.parseErrorCount > 0) {
      findings.push({
        id: 'ast-parse-errors',
        severity: 'warning',
        summary: `${input.astGraph.summary.parseErrorCount} AST parse error(s) found in context.`,
      });
    }
    if (input.copyStats.skipped.length > 0) {
      findings.push({
        id: 'sandbox-copy-skipped',
        severity: 'info',
        summary: `${input.copyStats.skipped.length} entrada(s) pesadas ou irrelevantes foram ignoradas na copia do sandbox.`,
      });
    }
    if (input.sandboxBackend.validationExecution === 'host') {
      findings.push({
        id: 'sandbox-local-copy-backend',
        severity: 'info',
        summary: input.sandboxBackend.detail,
      });
    } else if (input.sandboxBackend.validationExecution === 'container') {
      findings.push({
        id: 'sandbox-container-backend',
        severity: 'info',
        summary: input.sandboxBackend.detail,
      });
    } else if (input.sandboxBackend.validationExecution === 'blocked') {
      findings.push({
        id: 'sandbox-backend-blocked',
        severity: 'critical',
        summary: input.sandboxBackend.detail,
      });
    }
    const approved = findings.every((finding) => ['info', 'warning'].includes(finding.severity));
    return { approved, findings };
  }

  private buildReadinessGate(input: {
    attemptId: string;
    status: ZavorthReadinessGate['status'];
    canProceed: boolean;
    warnings?: string[];
    blockers?: string[];
    validationResults: ZavorthSpeculativeValidationResult[];
  }): ZavorthReadinessGate {
    return {
      id: `${input.attemptId}-executor-critic`,
      status: input.status,
      canProceed: input.canProceed,
      scope: 'super-zavorth-speculative-autonomy',
      reasons: input.canProceed
        ? ['Diff final foi gerado em sandbox e o critico aprovou as evidencias.']
        : ['Speculative diff is not ready for approval/application yet.'],
      warnings: input.warnings || [],
      blockers: input.blockers || [],
      checkedAt: this.now().toISOString(),
      evidence: input.validationResults.map((result, index) => ({
        id: `validation-${index + 1}`,
        label: result.command,
        status: result.status,
        summary: result.status === 'passed'
          ? 'Command completed successfully.'
          : clampText(result.stderr || result.stdout || result.status, 360),
        command: result.command,
        updatedAt: this.now().toISOString(),
      })),
      nextActions: input.canProceed
        ? ['Request plan approval before applying to the real workspace.']
        : ['Corrigir o executor/codigo no sandbox e repetir a validacao.'],
    };
  }

  private resolveValidationCommands(
    workspaceRoot: string,
    input: PrepareZavorthSpeculativeAutonomyInput,
  ): string[] {
    if (input.validationMode === 'skip') {
      return [];
    }
    const provided = Array.isArray(input.validationCommands)
      ? Array.from(new Set(input.validationCommands.map((command) => normalizeText(command)).filter(Boolean))).slice(0, MAX_VALIDATION_COMMANDS)
      : [];
    if (provided.length > 0 || input.validationMode === 'provided') {
      return provided;
    }
    return this.detectValidationCommands(workspaceRoot);
  }

  private detectValidationCommands(workspaceRoot: string): string[] {
    const packagePath = path.join(workspaceRoot, 'package.json');
    if (!fs.existsSync(packagePath)) {
      return [];
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(packagePath, 'utf8')) as { scripts?: Record<string, unknown> };
      const scripts = parsed.scripts || {};
      if (typeof scripts['runtime:check'] === 'string') {
        return ['npm run runtime:check -- --pretty false'];
      }
      if (typeof scripts.build === 'string') {
        return ['npm run build -- --pretty false'];
      }
      if (typeof scripts.test === 'string') {
        return ['npm test -- --runInBand'];
      }
      return [];
    } catch (error: unknown) {return [];
    }
  }

  private blockedAttempt(input: {
    id: string;
    workspaceRoot: string;
    round: number;
    reason: string;
    sandboxWorkspace?: string;
    sandboxBackend?: ZavorthSpeculativeSandboxBackendReceipt;
  }): ZavorthSpeculativeAttempt {
    const attemptId = `${input.id}-round-${input.round + 1}`;
    const sandboxBackend = input.sandboxBackend || this.buildLocalSandboxReceipt('local-copy', 'Rehearsal blocked before selecting a stronger backend.');
    const astGraph = this.buildAstContextGraph({
      workspaceRoot: input.workspaceRoot,
      entryFiles: [],
    });
    const readinessGate = this.buildReadinessGate({
      attemptId,
      status: 'blocked',
      canProceed: false,
      blockers: [input.reason],
      validationResults: [],
    });
    return {
      id: attemptId,
      round: input.round,
      sandboxWorkspace: input.sandboxWorkspace || path.join(this.runRoot, input.id, `round-${input.round + 1}`, 'workspace'),
      status: 'blocked',
      summary: input.reason,
      touchedFiles: [],
      diffText: '',
      diffHash: null,
      astGraph,
      validationResults: [],
      sandboxBackend,
      critic: {
        approved: false,
        findings: [{
          id: 'blocked',
          severity: 'critical',
          summary: input.reason,
        }],
      },
      readinessGate,
      blockedReasons: [input.reason],
    };
  }

  private buildRunId(runId: string | null | undefined): string {
    const seed = `${normalizeText(runId, 'run')}:${this.now().toISOString()}:${crypto.randomBytes(8).toString('hex')}`;
    const slug = normalizeText(runId, 'run')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'run';
    return `${slug}-${sha256(seed).slice(0, 12)}`;
  }

  private normalizeSandboxIsolation(value: unknown): ZavorthSpeculativeSandboxIsolation {
    const normalized = normalizeText(value, 'auto').toLowerCase().replace(/_/g, '-');
    if (normalized === 'container' || normalized === 'docker' || normalized === 'gvisor' || normalized === 'runsc') {
      return 'container';
    }
    if (normalized === 'microvm' || normalized === 'micro-vm' || normalized === 'firecracker') {
      return 'microvm';
    }
    if (normalized === 'local' || normalized === 'local-copy' || normalized === 'copy') {
      return 'local-copy';
    }
    return 'auto';
  }

  private normalizeWrites(writes: ZavorthSpeculativeWorkspaceWrite[]): ZavorthSpeculativeWorkspaceWrite[] {
    return writes
      .map((write) => ({
        path: normalizeText(write.path),
        content: typeof write.content === 'string' ? write.content : '',
        actionId: normalizeText(write.actionId) || null,
        description: normalizeText(write.description) || null,
      }))
      .filter((write) => write.path && write.content !== '')
      .slice(0, 20);
  }

  private normalizePatches(patches: ZavorthSpeculativeWorkspacePatch[]): ZavorthSpeculativeWorkspacePatch[] {
    return patches
      .map((patch) => {
        const hunks = Array.isArray(patch.hunks) && patch.hunks.length > 0
          ? patch.hunks
          : patch.search
            ? [{ search: patch.search, replace: patch.replace || '' }]
            : [];
        return {
          path: normalizeText(patch.path),
          search: normalizeText(hunks[0]?.search),
          replace: typeof hunks[0]?.replace === 'string' ? hunks[0].replace : '',
          hunks: hunks.map((hunk) => ({
            search: normalizeText(hunk.search),
            replace: typeof hunk.replace === 'string' ? hunk.replace : '',
            description: normalizeText(hunk.description) || null,
          })).filter((hunk) => hunk.search),
          actionId: normalizeText(patch.actionId) || null,
          description: normalizeText(patch.description) || null,
        };
      })
      .filter((patch) => patch.path && patch.hunks.length > 0)
      .slice(0, 20);
  }

  private skippedValidation(reason: string): ZavorthSpeculativeValidationResult {
    return {
      command: 'validation:skipped',
      status: 'skipped',
      exitCode: null,
      stdout: reason,
      stderr: reason,
      durationMs: 0,
    };
  }
  public buildAstContextGraph(input: {
    workspaceRoot: string;
    entryFiles: string[];
    generatedAt?: string;
  }): ZavorthAstContextGraph {
    return buildAstContextGraph({
      ...input,
      generatedAt: input.generatedAt || this.now().toISOString(),
    });
  }

  private copyWorkspace(sourceRoot: string, targetRoot: string): WorkspaceCopyStats {
    return copyWorkspace(sourceRoot, targetRoot, this.maxCopyFiles, this.maxCopyBytes);
  }

  private shouldSkipCopy(relativePath: string, sourcePath: string): boolean {
    return shouldSkipCopy(relativePath, sourcePath);
  }

  private applyWrite(input: {
    sandboxWorkspace: string;
    write: ZavorthSpeculativeWorkspaceWrite;
  }): { relativePath: string | null; blockedReason: string | null } {
    return applyWrite(input);
  }

  private applyPatch(input: {
    sandboxWorkspace: string;
    patch: ZavorthSpeculativeWorkspacePatch;
  }): { relativePath: string | null; blockedReason: string | null } {
    return applyPatch(input);
  }

  private validateWrite(write: ZavorthSpeculativeWorkspaceWrite, relativePath: string): string | null {
    return validateWrite(write, relativePath);
  }

  private validatePatch(patch: ZavorthSpeculativeWorkspacePatch, relativePath: string): string | null {
    return validatePatch(patch, relativePath);
  }

  private buildUnifiedDiff(input: {
    originalWorkspace: string;
    sandboxWorkspace: string;
    touchedFiles: string[];
  }): string {
    return buildUnifiedDiff(input);
  }

  private findUnsafeOriginalPath(workspaceRoot: string, relativePath: string): string | null {
    return findUnsafeOriginalPath(workspaceRoot, relativePath);
  }

  private safeReadWorkspaceTextFile(absolutePath: string): string {
    return safeReadWorkspaceTextFile(absolutePath);
  }

  private async runValidationCommands(input: {
    originalWorkspace: string;
    sandboxWorkspace: string;
    commands: string[];
    sandboxBackend: ZavorthSpeculativeSandboxBackendReceipt;
  }): Promise<ZavorthSpeculativeValidationResult[]> {
    return runValidationCommands({
      ...input,
      timeoutMs: this.validationTimeoutMs,
      commandRunner: this.commandRunner,
      dockerRunner: this.dockerRunner,
    });
  }

  private buildValidationEnv(originalWorkspace: string): NodeJS.ProcessEnv {
    return buildValidationEnv(originalWorkspace);
  }

  private resolveSandboxBackend(input: {
    requested: ZavorthSpeculativeSandboxIsolation;
    validationMode: 'auto' | 'provided' | 'skip';
  }): ZavorthSpeculativeSandboxBackendReceipt {
    return resolveSandboxBackend({
      ...input,
      dockerRuntime: this.dockerRuntime,
    });
  }

  private buildLocalSandboxReceipt(
    requested: ZavorthSpeculativeSandboxIsolation,
    detail: string,
  ): ZavorthSpeculativeSandboxBackendReceipt {
    return buildLocalSandboxReceipt(requested, detail);
  }

  private async runDockerValidationCommand(input: {
    command: string;
    parsed: ParsedSpeculativeValidationCommand;
    sandboxWorkspace: string;
    sandboxBackend: ZavorthSpeculativeSandboxBackendReceipt;
  }): Promise<ZavorthSpeculativeValidationResult> {
    return runDockerValidationCommand({
      ...input,
      timeoutMs: this.validationTimeoutMs,
      dockerRunner: this.dockerRunner,
    });
  }

  private canUseDockerForSpeculativeValidation(status: DockerSandboxStatus): boolean {
    return canUseDockerForSpeculativeValidation(status);
  }

  private safeDockerStatus(): DockerSandboxStatus | null {
    return safeDockerStatus(this.dockerRuntime);
  }

  private inspectSourceFile(input: {
    workspaceRoot: string;
    absolutePath: string;
    relativePath: string;
    sourceFile: ts.SourceFile;
  }): ZavorthAstContextGraphFile {
    return inspectSourceFile(input);
  }

  private symbolFromNode(sourceFile: ts.SourceFile, node: ts.Node): ZavorthAstContextGraphSymbol | null {
    return symbolFromNode(sourceFile, node);
  }

  private resolveRelativeImport(workspaceRoot: string, importerPath: string, specifier: string): string | null {
    return resolveRelativeImport(workspaceRoot, importerPath, specifier);
  }

  private normalizeRelativeSourcePath(workspaceRoot: string, entry: string): string | null {
    return normalizeRelativeSourcePath(workspaceRoot, entry);
  }

}


export function buildSpeculativeAutonomyReceipt(input: ZavorthSpeculativeAutonomyResult): Record<string, unknown> {
  return {
    id: input.id,
    status: input.status,
    summary: input.summary,
    mutationPlanId: input.mutationPlan?.id || null,
    autoHealing: input.autoHealing,
    finalAttempt: input.finalAttempt
      ? {
        id: input.finalAttempt.id,
        round: input.finalAttempt.round,
        sandboxWorkspace: input.finalAttempt.sandboxWorkspace,
        touchedFiles: input.finalAttempt.touchedFiles,
        diffHash: input.finalAttempt.diffHash,
        sandboxBackend: input.finalAttempt.sandboxBackend,
        validationResults: input.finalAttempt.validationResults.map((result) => ({
          command: result.command,
          status: result.status,
          exitCode: result.exitCode,
          durationMs: result.durationMs,
          timedOut: result.timedOut === true,
        })),
        critic: input.finalAttempt.critic,
        astSummary: input.finalAttempt.astGraph.summary,
      }
      : null,
    receipts: input.receipts,
  };
}
