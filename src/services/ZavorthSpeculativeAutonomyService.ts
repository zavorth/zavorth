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
import { DockerSandboxRuntime, type DockerSandboxStatus } from './sandbox/DockerSandboxRuntime.js';
import { ZavorthMutationPlaneService } from './ZavorthMutationPlaneService.js';

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
  sandboxIsolation?: ZavorthSpeculativeSandboxIsolation | null;
  correctionProvider?: ZavorthSpeculativeCorrectionProvider | null;
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
};

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
    let candidate = initialCandidate;

    let workspaceStat: ReturnType<typeof fs.lstatSync> | null = null;
    try {
      workspaceStat = fs.lstatSync(workspaceRoot);
    } catch {
      workspaceStat = null;
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
      });
    }

    if (candidate.writes.length === 0 && candidate.patches.length === 0) {
      const attempt = this.blockedAttempt({
        id,
        workspaceRoot,
        round: 0,
        reason: 'Nenhum write ou patch estruturado foi fornecido para ensaio especulativo.',
      });
      return this.resultFromAttempts({
        id,
        workspaceRoot,
        validationCommands,
        attempts: [attempt],
        input,
      });
    }

    for (let round = 0; round <= maxCorrectionRounds; round += 1) {
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
    });
  }

  public buildAstContextGraph(input: {
    workspaceRoot: string;
    entryFiles: string[];
    generatedAt?: string;
  }): ZavorthAstContextGraph {
    const workspaceRoot = path.resolve(input.workspaceRoot);
    const generatedAt = input.generatedAt || this.now().toISOString();
    const queue = Array.from(new Set(
      input.entryFiles
        .map((entry) => this.normalizeRelativeSourcePath(workspaceRoot, entry))
        .filter((entry): entry is string => Boolean(entry)),
    ));
    const visited = new Set<string>();
    const files: ZavorthAstContextGraphFile[] = [];
    const edges: ZavorthAstContextGraph['edges'] = [];

    while (queue.length > 0 && visited.size < MAX_AST_FILES) {
      const relativePath = queue.shift();
      if (!relativePath || visited.has(relativePath)) {
        continue;
      }
      visited.add(relativePath);
      const absolutePath = WorkspaceResolver.ensurePathInsideWorkspace(workspaceRoot, relativePath);
      if (!fs.existsSync(absolutePath) || !SOURCE_EXTENSIONS.includes(path.extname(absolutePath))) {
        continue;
      }
      const fileStat = fs.lstatSync(absolutePath);
      if (!fileStat.isFile() || fileStat.isSymbolicLink()) {
        continue;
      }

      const sourceText = fs.readFileSync(absolutePath, 'utf8');
      const sourceFile = ts.createSourceFile(absolutePath, sourceText, ts.ScriptTarget.Latest, true);
      const fileRecord = this.inspectSourceFile({
        workspaceRoot,
        absolutePath,
        relativePath,
        sourceFile,
      });
      files.push(fileRecord);
      for (const item of fileRecord.imports) {
        edges.push({
          from: relativePath,
          to: item.resolvedPath || item.specifier,
          kind: item.external ? 'external-import' : 'relative-import',
        });
        if (item.resolvedPath && !item.external && !visited.has(item.resolvedPath)) {
          queue.push(item.resolvedPath);
        }
      }
    }

    return {
      generatedAt,
      workspaceRoot,
      entryFiles: queueIndependentEntries(input.entryFiles, workspaceRoot),
      files,
      edges,
      summary: {
        fileCount: files.length,
        edgeCount: edges.length,
        symbolCount: files.reduce((sum, file) => sum + file.symbols.length, 0),
        parseErrorCount: files.reduce((sum, file) => sum + file.parseErrors.length, 0),
      },
    };
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
    } catch (error) {
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
        ? `Ensaio especulativo aprovado com ${uniqueTouchedFiles.length} arquivo(s) alterado(s).`
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

  private resultFromAttempts(input: {
    id: string;
    workspaceRoot: string;
    validationCommands: string[];
    attempts: ZavorthSpeculativeAttempt[];
    input: PrepareZavorthSpeculativeAutonomyInput;
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
      receipts: [
        'super-zavorth-speculative-sandbox',
        finalAttempt?.sandboxBackend.validationExecution === 'container'
          ? 'strong-container-sandbox-validation'
          : 'local-copy-sandbox-validation',
        'ast-context-graph',
        'mandatory-validation-stage',
        'executor-critic-gate',
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
      approvalReason: 'Mudancas foram ensaiadas em sandbox temporario e precisam de aprovacao antes de tocar no workspace real.',
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
      return 'Super Zavorth nao conseguiu preparar um ensaio especulativo.';
    }
    if (status === 'approved') {
      return mutationPlan
        ? `Sandbox aprovado, diff final gerado e plano ${mutationPlan.id} criado para aprovacao.`
        : 'Sandbox aprovado e diff final gerado sem aplicar no workspace real.';
    }
    if (status === 'blocked') {
      return `Sandbox bloqueado: ${finalAttempt.blockedReasons.join('; ') || finalAttempt.summary}`;
    }
    return `${finalAttempt.summary} ${finalAttempt.critic.findings.map((finding) => finding.summary).join(' ')}`.trim();
  }

  private copyWorkspace(sourceRoot: string, targetRoot: string): WorkspaceCopyStats {
    const stats: WorkspaceCopyStats = { files: 0, bytes: 0, skipped: [] };
    const root = path.resolve(sourceRoot);
    const copyRecursive = (sourcePath: string): void => {
      const relativePath = normalizePortablePath(path.relative(root, sourcePath));
      if (relativePath && this.shouldSkipCopy(relativePath, sourcePath)) {
        stats.skipped.push(relativePath);
        return;
      }
      const targetPath = WorkspaceResolver.ensurePathInsideWorkspace(targetRoot, relativePath || '.');
      const stat = fs.lstatSync(sourcePath);
      if (stat.isSymbolicLink()) {
        stats.skipped.push(relativePath ? `${relativePath} (symlink)` : '(root symlink)');
        return;
      }
      if (stat.isDirectory()) {
        fs.mkdirSync(targetPath, { recursive: true });
        for (const entry of fs.readdirSync(sourcePath)) {
          copyRecursive(path.join(sourcePath, entry));
        }
        return;
      }
      if (!stat.isFile()) {
        stats.skipped.push(relativePath);
        return;
      }
      if (stats.files + 1 > this.maxCopyFiles || stats.bytes + stat.size > this.maxCopyBytes) {
        throw new Error(`Copia especulativa excedeu limites (${stats.files} arquivos, ${stats.bytes} bytes).`);
      }
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.copyFileSync(sourcePath, targetPath);
      stats.files += 1;
      stats.bytes += stat.size;
    };

    copyRecursive(root);
    return stats;
  }

  private shouldSkipCopy(relativePath: string, sourcePath: string): boolean {
    const normalized = normalizePortablePath(relativePath);
    const baseName = path.basename(sourcePath);
    if (IGNORED_DIR_NAMES.has(baseName)) {
      return true;
    }
    if (IGNORED_RELATIVE_PREFIXES.some((prefix) => normalized.startsWith(normalizePortablePath(prefix)))) {
      return true;
    }
    return /\.(?:png|jpg|jpeg|gif|webp|mp4|mov|zip|tar|gz|7z|sqlite|db)$/i.test(baseName);
  }

  private applyWrite(input: {
    sandboxWorkspace: string;
    write: ZavorthSpeculativeWorkspaceWrite;
  }): { relativePath: string | null; blockedReason: string | null } {
    try {
      const targetPath = WorkspaceResolver.ensurePathInsideWorkspace(input.sandboxWorkspace, input.write.path);
      const relativePath = normalizePortablePath(path.relative(input.sandboxWorkspace, targetPath));
      const blockedReason = this.validateWrite(input.write, relativePath);
      if (blockedReason) {
        return { relativePath, blockedReason };
      }
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, input.write.content, 'utf8');
      return { relativePath, blockedReason: null };
    } catch (error) {
      return {
        relativePath: null,
        blockedReason: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private applyPatch(input: {
    sandboxWorkspace: string;
    patch: ZavorthSpeculativeWorkspacePatch;
  }): { relativePath: string | null; blockedReason: string | null } {
    try {
      const targetPath = WorkspaceResolver.ensurePathInsideWorkspace(input.sandboxWorkspace, input.patch.path);
      const relativePath = normalizePortablePath(path.relative(input.sandboxWorkspace, targetPath));
      const blockedReason = this.validatePatch(input.patch, relativePath);
      if (blockedReason) {
        return { relativePath, blockedReason };
      }
      if (!fs.existsSync(targetPath)) {
        return { relativePath, blockedReason: `Patch bloqueado porque o arquivo alvo nao existe: ${relativePath}.` };
      }
      const currentContent = fs.readFileSync(targetPath, 'utf8');
      let nextContent = currentContent;
      for (const [index, hunk] of input.patch.hunks.entries()) {
        const occurrences = countOccurrences(nextContent, hunk.search);
        if (occurrences === 0) {
          return { relativePath, blockedReason: `Patch bloqueado porque o hunk ${index + 1} nao foi encontrado em ${relativePath}.` };
        }
        if (occurrences > 1) {
          return { relativePath, blockedReason: `Patch bloqueado porque o hunk ${index + 1} aparece ${occurrences} vezes em ${relativePath}.` };
        }
        nextContent = nextContent.replace(hunk.search, hunk.replace);
      }
      if (looksLikeSecret(nextContent)) {
        return { relativePath, blockedReason: 'Patch bloqueado porque o conteudo resultante parece conter segredo.' };
      }
      fs.writeFileSync(targetPath, nextContent, 'utf8');
      return { relativePath, blockedReason: null };
    } catch (error) {
      return {
        relativePath: null,
        blockedReason: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private validateWrite(write: ZavorthSpeculativeWorkspaceWrite, relativePath: string): string | null {
    if (!relativePath || relativePath.startsWith('../') || path.isAbsolute(relativePath)) {
      return 'Caminho de escrita invalido ou fora do workspace.';
    }
    if (looksLikeSecret(relativePath) || looksLikeSecret(write.content)) {
      return 'Escrita bloqueada porque o alvo ou conteudo parece conter segredo.';
    }
    if (Buffer.byteLength(write.content, 'utf8') > MAX_EDIT_BYTES) {
      return 'Escrita bloqueada porque excede o limite de tamanho do ensaio especulativo.';
    }
    return null;
  }

  private validatePatch(patch: ZavorthSpeculativeWorkspacePatch, relativePath: string): string | null {
    if (!relativePath || relativePath.startsWith('../') || path.isAbsolute(relativePath)) {
      return 'Caminho de patch invalido ou fora do workspace.';
    }
    if (!Array.isArray(patch.hunks) || patch.hunks.length === 0) {
      return 'Patch bloqueado porque nao ha hunks estruturados.';
    }
    if (patch.hunks.length > 12) {
      return 'Patch bloqueado porque excede 12 hunks em um unico arquivo.';
    }
    for (const hunk of patch.hunks) {
      if (!hunk.search) {
        return 'Patch bloqueado porque um hunk tem search vazio.';
      }
      if (looksLikeSecret(relativePath) || looksLikeSecret(hunk.search) || looksLikeSecret(hunk.replace)) {
        return 'Patch bloqueado porque o alvo ou conteudo parece conter segredo.';
      }
      if (Buffer.byteLength(hunk.search, 'utf8') > MAX_EDIT_BYTES || Buffer.byteLength(hunk.replace, 'utf8') > MAX_EDIT_BYTES) {
        return 'Patch bloqueado porque excede o limite de tamanho do ensaio especulativo.';
      }
    }
    return null;
  }

  private buildUnifiedDiff(input: {
    originalWorkspace: string;
    sandboxWorkspace: string;
    touchedFiles: string[];
  }): string {
    const parts: string[] = [];
    for (const relativePath of input.touchedFiles) {
      const originalPath = WorkspaceResolver.ensurePathInsideWorkspace(input.originalWorkspace, relativePath);
      const sandboxPath = WorkspaceResolver.ensurePathInsideWorkspace(input.sandboxWorkspace, relativePath);
      const before = this.safeReadWorkspaceTextFile(originalPath);
      const after = this.safeReadWorkspaceTextFile(sandboxPath);
      if (before === after) {
        continue;
      }
      parts.push(createTwoFilesPatch(
        `a/${relativePath}`,
        `b/${relativePath}`,
        before,
        after,
        'original',
        'sandbox',
      ));
    }
    return clampText(parts.join('\n'), MAX_DIFF_CHARS);
  }

  private async runValidationCommands(input: {
    originalWorkspace: string;
    sandboxWorkspace: string;
    commands: string[];
    sandboxBackend: ZavorthSpeculativeSandboxBackendReceipt;
  }): Promise<ZavorthSpeculativeValidationResult[]> {
    if (input.commands.length === 0) {
      return [this.skippedValidation('Nenhum comando de validacao foi detectado para este workspace.')];
    }
    const results: ZavorthSpeculativeValidationResult[] = [];
    for (const command of input.commands.slice(0, MAX_VALIDATION_COMMANDS)) {
      const parsed = parseSpeculativeValidationCommand(command);
      if (!parsed) {
        results.push({
          command: redactSensitiveText(command, 1200),
          status: 'blocked',
          exitCode: 126,
          stdout: '',
          stderr: 'Comando de validacao bloqueado por conter shell avancado ou comando fora da allowlist.',
          durationMs: 0,
        });
        continue;
      }
      if (input.sandboxBackend.validationExecution === 'blocked') {
        results.push({
          command: redactSensitiveText(command, 1200),
          status: 'blocked',
          exitCode: 126,
          stdout: '',
          stderr: input.sandboxBackend.detail,
          durationMs: 0,
        });
        continue;
      }

      const result = input.sandboxBackend.validationExecution === 'container'
        ? await this.runDockerValidationCommand({
          command,
          parsed,
          sandboxWorkspace: input.sandboxWorkspace,
          sandboxBackend: input.sandboxBackend,
        })
        : await this.commandRunner({
          command,
          cwd: input.sandboxWorkspace,
          timeoutMs: this.validationTimeoutMs,
          env: this.buildValidationEnv(input.originalWorkspace),
        });
      results.push(redactValidationResult(result));
    }
    return results;
  }

  private buildValidationEnv(originalWorkspace: string): NodeJS.ProcessEnv {
    const nodeBin = path.join(originalWorkspace, 'node_modules', '.bin');
    const nodePath = path.join(originalWorkspace, 'node_modules');
    return {
      ...process.env,
      CI: 'true',
      NODE_PATH: [nodePath, process.env.NODE_PATH].filter(Boolean).join(path.delimiter),
      PATH: [nodeBin, process.env.PATH].filter(Boolean).join(path.delimiter),
    };
  }

  private resolveSandboxBackend(input: {
    requested: ZavorthSpeculativeSandboxIsolation;
    validationMode: 'auto' | 'provided' | 'skip';
  }): ZavorthSpeculativeSandboxBackendReceipt {
    const requested = this.normalizeSandboxIsolation(input.requested);
    if (input.validationMode === 'skip') {
      return {
        ...this.buildLocalSandboxReceipt(requested, 'Validacao explicitamente pulada; nenhum backend executou comandos.'),
        validationExecution: 'skipped',
      };
    }

    if (requested === 'local-copy') {
      return this.buildLocalSandboxReceipt(requested, 'Sandbox especulativo usa copia local temporaria governada.');
    }

    if (requested === 'microvm') {
      return {
        kind: 'microvm',
        requested,
        validationExecution: 'blocked',
        runtime: 'FirecrackerWorkspaceBackend',
        hardened: true,
        detail: 'MicroVM foi solicitada, mas o backend de workspace especulativo em Firecracker ainda nao esta disponivel neste host. Use container ou local-copy.',
        fallbackFrom: null,
        docker: null,
      };
    }

    const dockerStatus = this.safeDockerStatus();
    if (dockerStatus && this.canUseDockerForSpeculativeValidation(dockerStatus)) {
      return {
        kind: 'container',
        requested,
        validationExecution: 'container',
        runtime: 'DockerSpeculativeSandboxBackend',
        hardened: true,
        detail: `Validacao especulativa sera executada em container Docker endurecido (${dockerStatus.sandboxRuntime || 'runc'}), sem rede e com workspace temporario montado rw.`,
        fallbackFrom: null,
        docker: {
          image: dockerStatus.image,
          sandboxRuntime: dockerStatus.sandboxRuntime || 'runc',
          daemonReachable: dockerStatus.daemonReachable,
          canRun: dockerStatus.canRun,
          network: 'none',
          readOnlyRootfs: config.dockerSandboxReadOnly,
        },
      };
    }

    if (requested === 'container' || config.dockerSandboxRequired) {
      return {
        kind: 'container',
        requested,
        validationExecution: 'blocked',
        runtime: 'DockerSpeculativeSandboxBackend',
        hardened: true,
        detail: dockerStatus?.detail || 'Docker indisponivel para validacao especulativa obrigatoria.',
        fallbackFrom: null,
        docker: dockerStatus
          ? {
            image: dockerStatus.image,
            sandboxRuntime: dockerStatus.sandboxRuntime || 'runc',
            daemonReachable: dockerStatus.daemonReachable,
            canRun: dockerStatus.canRun,
            network: 'none',
            readOnlyRootfs: config.dockerSandboxReadOnly,
          }
          : null,
      };
    }

    return {
      ...this.buildLocalSandboxReceipt(requested, `Docker indisponivel para modo auto; fallback para copia local governada. ${dockerStatus?.detail || ''}`.trim()),
      fallbackFrom: 'container',
    };
  }

  private buildLocalSandboxReceipt(
    requested: ZavorthSpeculativeSandboxIsolation,
    detail: string,
  ): ZavorthSpeculativeSandboxBackendReceipt {
    return {
      kind: 'local-copy',
      requested,
      validationExecution: 'host',
      runtime: 'LocalCopySpeculativeSandboxBackend',
      hardened: false,
      detail,
      fallbackFrom: null,
      docker: null,
    };
  }

  private safeDockerStatus(): DockerSandboxStatus | null {
    if (!this.dockerRuntime) {
      return null;
    }
    try {
      return this.dockerRuntime.getStatus('javascript');
    } catch {
      return null;
    }
  }

  private canUseDockerForSpeculativeValidation(status: DockerSandboxStatus): boolean {
    return Boolean(status.enabled && status.daemonReachable && (status.canRun || status.autoPullEnabled));
  }

  private async runDockerValidationCommand(input: {
    command: string;
    parsed: ParsedSpeculativeValidationCommand;
    sandboxWorkspace: string;
    sandboxBackend: ZavorthSpeculativeSandboxBackendReceipt;
  }): Promise<ZavorthSpeculativeValidationResult> {
    const image = input.sandboxBackend.docker?.image || config.dockerSandboxJavascriptImage;
    const dockerArgs = buildDockerValidationArgs({
      image,
      parsed: input.parsed,
      sandboxWorkspace: input.sandboxWorkspace,
    });
    return this.dockerRunner({
      command: config.dockerCliPath,
      args: dockerArgs,
      timeoutMs: this.validationTimeoutMs,
      originalCommand: input.command,
    });
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
        summary: 'O executor nao produziu diff material que possa ser aprovado.',
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
        summary: `${input.astGraph.summary.parseErrorCount} erro(s) de parse AST encontrados no contexto.`,
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
        : ['Diff especulativo ainda nao esta pronto para aprovacao/aplicacao.'],
      warnings: input.warnings || [],
      blockers: input.blockers || [],
      checkedAt: this.now().toISOString(),
      evidence: input.validationResults.map((result, index) => ({
        id: `validation-${index + 1}`,
        label: result.command,
        status: result.status,
        summary: result.status === 'passed'
          ? 'Comando concluiu com sucesso.'
          : clampText(result.stderr || result.stdout || result.status, 360),
        command: result.command,
        updatedAt: this.now().toISOString(),
      })),
      nextActions: input.canProceed
        ? ['Solicitar aprovacao do plano antes de aplicar no workspace real.']
        : ['Corrigir o executor/codigo no sandbox e repetir a validacao.'],
    };
  }

  private inspectSourceFile(input: {
    workspaceRoot: string;
    absolutePath: string;
    relativePath: string;
    sourceFile: ts.SourceFile;
  }): ZavorthAstContextGraphFile {
    const imports: ZavorthAstContextGraphFile['imports'] = [];
    const symbols: ZavorthAstContextGraphSymbol[] = [];
    const identifiers = new Set<string>();
    const parseDiagnostics = ((input.sourceFile as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics || []);
    const parseErrors = parseDiagnostics.map((diagnostic) =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
    );

    const visit = (node: ts.Node): void => {
      const symbol = this.symbolFromNode(input.sourceFile, node);
      if (symbol) {
        symbols.push(symbol);
      }
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        const specifier = node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)
          ? node.moduleSpecifier.text
          : null;
        if (specifier) {
          const resolvedPath = this.resolveRelativeImport(input.workspaceRoot, input.absolutePath, specifier);
          imports.push({
            specifier,
            resolvedPath,
            external: !specifier.startsWith('.'),
          });
        }
      }
      if (ts.isIdentifier(node) && identifiers.size < 80) {
        identifiers.add(node.text);
      }
      ts.forEachChild(node, visit);
    };

    visit(input.sourceFile);
    return {
      path: input.relativePath,
      imports,
      symbols: symbols.slice(0, 80),
      referencedIdentifiers: Array.from(identifiers).slice(0, 80),
      parseErrors,
    };
  }

  private symbolFromNode(sourceFile: ts.SourceFile, node: ts.Node): ZavorthAstContextGraphSymbol | null {
    const named = (name: ts.Node | undefined, kind: ZavorthAstContextGraphSymbol['kind']): ZavorthAstContextGraphSymbol | null => {
      if (!name || !ts.isIdentifier(name)) {
        return null;
      }
      const line = sourceFile.getLineAndCharacterOfPosition(name.getStart(sourceFile)).line + 1;
      return {
        name: name.text,
        kind,
        exported: hasExportModifier(node),
        line,
      };
    };
    if (ts.isClassDeclaration(node)) {
      return named(node.name, 'class');
    }
    if (ts.isFunctionDeclaration(node)) {
      return named(node.name, 'function');
    }
    if (ts.isInterfaceDeclaration(node)) {
      return named(node.name, 'interface');
    }
    if (ts.isTypeAliasDeclaration(node)) {
      return named(node.name, 'type');
    }
    if (ts.isEnumDeclaration(node)) {
      return named(node.name, 'enum');
    }
    if (ts.isVariableDeclaration(node)) {
      return named(node.name, 'variable');
    }
    return null;
  }

  private resolveRelativeImport(workspaceRoot: string, importerPath: string, specifier: string): string | null {
    if (!specifier.startsWith('.')) {
      return null;
    }
    const base = path.resolve(path.dirname(importerPath), specifier);
    const candidates = [
      base,
      ...SOURCE_EXTENSIONS.map((extension) => `${base}${extension}`),
      ...SOURCE_EXTENSIONS.map((extension) => path.join(base, `index${extension}`)),
    ];
    for (const candidate of candidates) {
      if (!fs.existsSync(candidate)) {
        continue;
      }
      const stat = fs.lstatSync(candidate);
      if (stat.isFile() && !stat.isSymbolicLink()) {
        return normalizePortablePath(path.relative(workspaceRoot, candidate));
      }
    }
    return null;
  }

  private normalizeRelativeSourcePath(workspaceRoot: string, entry: string): string | null {
    const trimmed = normalizeText(entry);
    if (!trimmed) {
      return null;
    }
    const absolutePath = path.isAbsolute(trimmed)
      ? trimmed
      : WorkspaceResolver.ensurePathInsideWorkspace(workspaceRoot, trimmed);
    const relativePath = normalizePortablePath(path.relative(workspaceRoot, absolutePath));
    if (relativePath.startsWith('../') || path.isAbsolute(relativePath)) {
      return null;
    }
    return SOURCE_EXTENSIONS.includes(path.extname(relativePath)) ? relativePath : null;
  }

  private findUnsafeOriginalPath(workspaceRoot: string, relativePath: string): string | null {
    const normalized = normalizePortablePath(relativePath);
    if (!normalized || normalized.startsWith('../') || path.isAbsolute(normalized)) {
      return normalized || relativePath;
    }

    let current = path.resolve(workspaceRoot);
    for (const part of normalized.split('/').filter(Boolean)) {
      current = path.join(current, part);
      if (!fs.existsSync(current)) {
        continue;
      }
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink()) {
        return normalizePortablePath(path.relative(workspaceRoot, current));
      }
    }
    return null;
  }

  private safeReadWorkspaceTextFile(absolutePath: string): string {
    if (!fs.existsSync(absolutePath)) {
      return '';
    }
    const stat = fs.lstatSync(absolutePath);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      return '';
    }
    return fs.readFileSync(absolutePath, 'utf8');
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
    } catch {
      return [];
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
    const sandboxBackend = input.sandboxBackend || this.buildLocalSandboxReceipt('local-copy', 'Ensaio bloqueado antes da selecao de backend forte.');
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

  private buildRunId(runId: string | null | undefined): string {
    const seed = `${normalizeText(runId, 'run')}:${this.now().toISOString()}:${crypto.randomBytes(8).toString('hex')}`;
    const slug = normalizeText(runId, 'run')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'run';
    return `${slug}-${sha256(seed).slice(0, 12)}`;
  }
}

async function defaultCommandRunner(
  input: ZavorthSpeculativeCommandRunnerInput,
): Promise<ZavorthSpeculativeValidationResult> {
  const startedAt = Date.now();
  const parsed = parseSpeculativeValidationCommand(input.command);
  if (!parsed) {
    return {
      command: redactSensitiveText(input.command, 1200),
      status: 'blocked',
      exitCode: 126,
      stdout: '',
      stderr: 'Comando de validacao bloqueado antes do spawn.',
      durationMs: 0,
    };
  }
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    let timedOut = false;
    const child = spawn(resolveExecutableForPlatform(parsed.executable), parsed.args, {
      cwd: input.cwd,
      env: input.env || process.env,
      shell: false,
      windowsHide: true,
    });
    const finish = (result: ZavorthSpeculativeValidationResult): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, input.timeoutMs);
    child?.stdout?.on('data', (chunk) => {
      stdout = clampText(`${stdout}${String(chunk)}`);
    });
    child?.stderr?.on('data', (chunk) => {
      stderr = clampText(`${stderr}${String(chunk)}`);
    });
    child?.on('error', (error) => {
      finish({
        command: redactSensitiveText(input.command, 1200),
        status: 'failed',
        exitCode: 1,
        stdout: redactSensitiveText(stdout),
        stderr: redactSensitiveText(error.message || stderr),
        durationMs: Date.now() - startedAt,
        timedOut,
      });
    });
    child?.on('close', (code) => {
      finish({
        command: redactSensitiveText(input.command, 1200),
        status: code === 0 && !timedOut ? 'passed' : 'failed',
        exitCode: typeof code === 'number' ? code : timedOut ? 124 : null,
        stdout: redactSensitiveText(stdout),
        stderr: timedOut ? redactSensitiveText(`${stderr}\nValidation timed out.`) : redactSensitiveText(stderr),
        durationMs: Date.now() - startedAt,
        timedOut,
      });
    });
  });
}

async function defaultDockerValidationRunner(
  input: ZavorthSpeculativeDockerValidationRunnerInput,
): Promise<ZavorthSpeculativeValidationResult> {
  const startedAt = Date.now();
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    let timedOut = false;
    let child: ReturnType<typeof spawnCommand> | null = null;

    const finish = (result: ZavorthSpeculativeValidationResult): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(redactValidationResult(result));
    };

    const timer = setTimeout(() => {
      timedOut = true;
      child?.kill('SIGTERM');
    }, input.timeoutMs);

    try {
      child = spawnCommand(input.command, input.args, {
        env: process.env,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      finish({
        command: input.originalCommand,
        status: 'failed',
        exitCode: 1,
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startedAt,
        timedOut,
      });
      return;
    }

    child.stdout?.on('data', (chunk) => {
      stdout = clampText(`${stdout}${String(chunk)}`);
    });
    child.stderr?.on('data', (chunk) => {
      stderr = clampText(`${stderr}${String(chunk)}`);
    });
    child.on('error', (error) => {
      finish({
        command: input.originalCommand,
        status: 'failed',
        exitCode: 1,
        stdout,
        stderr: error.message || stderr,
        durationMs: Date.now() - startedAt,
        timedOut,
      });
    });
    child.on('close', (code) => {
      finish({
        command: input.originalCommand,
        status: code === 0 && !timedOut ? 'passed' : 'failed',
        exitCode: typeof code === 'number' ? code : timedOut ? 124 : null,
        stdout,
        stderr: timedOut ? `${stderr}\nDocker validation timed out.` : stderr,
        durationMs: Date.now() - startedAt,
        timedOut,
      });
    });
  });
}

function isAllowedValidationCommand(command: string): boolean {
  return parseSpeculativeValidationCommand(command) !== null;
}

export function parseSpeculativeValidationCommand(command: string): ParsedSpeculativeValidationCommand | null {
  const normalized = normalizeText(command);
  if (!normalized || /[\r\n]/.test(normalized)) {
    return null;
  }
  if (/[;&|`<>]/.test(normalized)) {
    return null;
  }
  if (/\b(?:rm|del|erase|format|shutdown|curl|wget|powershell|cmd|bash|sh)\b/i.test(normalized)) {
    return null;
  }
  const tokens = splitValidationCommand(normalized);
  if (!tokens || tokens.length === 0) {
    return null;
  }
  const executable = tokens[0].toLowerCase();
  if (!new Set(['npm', 'npx', 'yarn', 'pnpm', 'node', 'tsc', 'jest', 'vitest']).has(executable)) {
    return null;
  }
  if (tokens.slice(1).some((token) => /^--?(?:token|secret|password|passwd|api[_-]?key|credential)(?:=|$)/i.test(token))) {
    return null;
  }
  if (tokens.some((token) => looksLikeSecret(token))) {
    return null;
  }
  return {
    executable,
    args: tokens.slice(1),
  };
}

function splitValidationCommand(command: string): string[] | null {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let escaped = false;

  for (const char of command) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (quote === '"' && char === '\\') {
      escaped = true;
      continue;
    }
    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += char;
  }

  if (quote || escaped) {
    return null;
  }
  if (current) {
    tokens.push(current);
  }
  return tokens;
}

function resolveExecutableForPlatform(executable: string): string {
  if (process.platform !== 'win32') {
    return executable;
  }
  if (['npm', 'npx', 'yarn', 'pnpm', 'tsc', 'jest', 'vitest'].includes(executable.toLowerCase())) {
    return `${executable}.cmd`;
  }
  return executable;
}

export function buildSpeculativeDockerValidationArgs(input: {
  image: string;
  parsed: ParsedSpeculativeValidationCommand;
  sandboxWorkspace: string;
}): string[] {
  const containerWorkspace = config.dockerSandboxWorkspacePath || '/workspace';
  return [
    'run',
    '--rm',
    ...buildSpeculativeDockerHardeningArgs(),
    '-v',
    `${normalizeDockerHostMountPath(input.sandboxWorkspace)}:${containerWorkspace}:rw`,
    '-w',
    containerWorkspace,
    '-e',
    'CI=true',
    '-e',
    'NO_UPDATE_NOTIFIER=1',
    '-e',
    'NPM_CONFIG_FUND=false',
    '-e',
    'NPM_CONFIG_AUDIT=false',
    '-e',
    'NPM_CONFIG_CACHE=/tmp/npm-cache',
    '-e',
    'HOME=/tmp',
    input.image,
    input.parsed.executable,
    ...input.parsed.args,
  ];
}

function buildDockerValidationArgs(input: {
  image: string;
  parsed: ParsedSpeculativeValidationCommand;
  sandboxWorkspace: string;
}): string[] {
  return buildSpeculativeDockerValidationArgs(input);
}

function buildSpeculativeDockerHardeningArgs(): string[] {
  const args: string[] = [];
  if (config.dockerSandboxRuntime) {
    args.push('--runtime', config.dockerSandboxRuntime);
  }
  args.push('--network', 'none');
  args.push('--memory', `${Math.max(256, config.dockerSandboxMemoryMb)}m`);
  args.push('--cpus', String(config.dockerSandboxCpuLimit));
  args.push('--pids-limit', String(Math.max(16, config.dockerSandboxPidsLimit)));
  if (config.dockerSandboxCapDropAll) {
    args.push('--cap-drop', 'ALL');
  }
  if (config.dockerSandboxNoNewPrivileges) {
    args.push('--security-opt', 'no-new-privileges');
  }
  if (config.dockerSandboxReadOnly) {
    args.push('--read-only');
    args.push('--tmpfs', '/tmp:rw,nosuid,size=128m');
  }
  return args;
}

function normalizeDockerHostMountPath(hostPath: string): string {
  const normalized = path.resolve(hostPath).replace(/\\/g, '/');
  if (!String(config.dockerCliPath || '').toLowerCase().includes('docker-wsl-zavorth.cmd')) {
    return normalized;
  }
  const match = normalized.match(/^([a-zA-Z]):\/(.*)$/);
  if (!match) {
    return normalized;
  }
  return `/mnt/${match[1].toLowerCase()}/${match[2]}`;
}

function hasExportModifier(node: ts.Node): boolean {
  return Boolean(ts.canHaveModifiers(node) && ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword));
}

function queueIndependentEntries(entries: string[], workspaceRoot: string): string[] {
  return entries
    .map((entry) => {
      const trimmed = normalizeText(entry);
      if (!trimmed) {
        return null;
      }
      const absolutePath = path.isAbsolute(trimmed) ? trimmed : path.resolve(workspaceRoot, trimmed);
      const relativePath = normalizePortablePath(path.relative(workspaceRoot, absolutePath));
      return relativePath.startsWith('../') || path.isAbsolute(relativePath) ? null : relativePath;
    })
    .filter((entry): entry is string => Boolean(entry));
}

export function buildSpeculativeAutonomyReceipt(input: ZavorthSpeculativeAutonomyResult): Record<string, unknown> {
  return {
    id: input.id,
    status: input.status,
    summary: input.summary,
    mutationPlanId: input.mutationPlan?.id || null,
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
