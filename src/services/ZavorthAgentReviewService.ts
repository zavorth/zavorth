import { execFile, spawn } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { logger } from '../logger.js';
import {
buildGovernedReviewZavorthControlSnapshot,
  GovernedReviewGitHubService,
  GovernedReviewService,
  type GovernedReviewContextFile,
  type GovernedReviewFinding,
  type GovernedReviewGitHubCommandRunner,
  type GovernedReviewLiveAgentMode,
  type GovernedReviewMode,
  type GovernedReviewPatchRequest,
  type GovernedReviewResult,
} from '../runtime/review/index.js';

const execFileAsync = promisify(execFile);

export const ZAVORTH_AGENT_REVIEW_CONTRACT_VERSION = 'zavorth-agent-review/1' as const;

export type ZavorthAgentReviewTarget = 'workspace-diff' | 'github-pr' | 'provided';

export type ZavorthAgentReviewRequest = {
  objective?: string | null;
  workspace?: string | null;
  target?: ZavorthAgentReviewTarget | null;
  mode?: GovernedReviewMode | null;
  baseRef?: string | null;
  targetRef?: string | null;
  prTarget?: string | null;
  repo?: string | null;
  files?: GovernedReviewContextFile[] | null;
  diffText?: string | null;
  rawFindings?: Array<Partial<GovernedReviewFinding>> | null;
  instructions?: string[] | null;
  postComment?: boolean | null;
  applyPatch?: boolean | null;
  patch?: GovernedReviewPatchRequest | null;
  launchLiveAgents?: boolean | null;
  liveAgentMode?: GovernedReviewLiveAgentMode | null;
  approvalId?: string | null;
  userId?: string | null;
  sessionId?: string | null;
};

export type ZavorthAgentReviewSnapshot = {
  contractVersion: typeof ZAVORTH_AGENT_REVIEW_CONTRACT_VERSION;
  surface: 'zavorth-agent-review';
  status: GovernedReviewResult['status'];
  target: ZavorthAgentReviewTarget;
  review: GovernedReviewResult;
  zavorthControl: ReturnType<typeof buildGovernedReviewZavorthControlSnapshot>;
  visual: {
    route: '/zavorthControl/reviews';
    layout: 'review-board';
    statusTone: 'ok' | 'warning' | 'danger' | 'blocked';
    severityCounts: Record<GovernedReviewFinding['severity'], number>;
    primaryFinding: {
      title: string;
      severity: GovernedReviewFinding['severity'];
      location: string;
      recommendation: string;
    } | null;
    findingCards: Array<{
      id: string;
      title: string;
      severity: GovernedReviewFinding['severity'];
      confidence: number;
      location: string;
      recommendation: string;
    }>;
    laneCards: Array<{
      id: string;
      label: string;
      status: string;
      detail: string;
    }>;
    actionCards: Array<{
      id: string;
      label: string;
      state: 'available' | 'approval-required' | 'blocked';
      detail: string;
    }>;
    patchApplyMode: 'approval-gated';
  };
  command: {
    primary: 'zavorth agent-review';
    aliases: string[];
    readOnlyDefault: true;
    approvalRequiredFor: string[];
  };
  evidence: {
    collectedFromGit: boolean;
    collectedFromGitHub: boolean;
    localDiffBytes: number;
    heuristicFindingsGenerated: number;
    noMutationAppliedByDefault: boolean;
    noExternalCommentWithoutApproval: boolean;
  };
  summary: string;
  nextSafeAction: string;
};

type Runtime = {
  gitRunner?: GovernedReviewGitHubCommandRunner;
  githubService?: GovernedReviewGitHubService;
  reviewService?: GovernedReviewService;
};

export class ZavorthAgentReviewService {
  private readonly gitRunner: GovernedReviewGitHubCommandRunner;
  private readonly githubService: GovernedReviewGitHubService;
  private readonly reviewService: GovernedReviewService;

  public constructor(runtime: Runtime = {}) {
    this.gitRunner = runtime.gitRunner || defaultAgentReviewCommandRunner;
    this.githubService = runtime.githubService || new GovernedReviewGitHubService({ runner: this.gitRunner });
    this.reviewService = runtime.reviewService || new GovernedReviewService();
  }

  public async run(input: ZavorthAgentReviewRequest = {}): Promise<ZavorthAgentReviewSnapshot> {
    const target = resolveTarget(input);
    if (target === 'github-pr') {
      return this.runGitHubReview(input);
    }
    return this.runWorkspaceReview(input, target);
  }

  public renderText(snapshot: ZavorthAgentReviewSnapshot): string {
    const findings = [
      ...snapshot.review.verification.acceptedFindings,
      ...snapshot.review.verification.needsHumanReviewFindings,
    ];
    const lines = [
      'Zavorth Agent Review',
      `Status: ${snapshot.status}`,
      `Target: ${snapshot.target}`,
      `Mode: ${snapshot.review.mode}`,
      `Review: ${snapshot.review.reviewId}`,
      '',
      snapshot.summary,
      '',
      'Safety:',
      '- Read-only by default.',
      '- PR comments, patches and live review agents require explicit approval.',
      `- Mutation applied by default: ${snapshot.evidence.noMutationAppliedByDefault ? 'no' : 'yes'}`,
      '',
      'Findings:',
    ];

    if (findings.length === 0) {
      lines.push('- No accepted or human-review findings were produced.');
    } else {
      for (const finding of findings.slice(0, 12)) {
        lines.push(
          `- [${finding.severity}] ${finding.title}`,
          `  Location: ${finding.file || 'workspace'}${finding.line ? `:${finding.line}` : ''}`,
          `  Confidence: ${finding.confidence} | Status: ${finding.verification.status}`,
          `  Recommendation: ${finding.recommendation}`,
        );
      }
    }

    lines.push(
      '',
      'Visual Review:',
      `- Tone: ${snapshot.visual.statusTone}`,
      `- Severity: critical ${snapshot.visual.severityCounts.critical}, high ${snapshot.visual.severityCounts.high}, medium ${snapshot.visual.severityCounts.medium}, low ${snapshot.visual.severityCounts.low}`,
      `- Patch apply: ${snapshot.visual.patchApplyMode}`,
      '',
      'Actions:',
      ...snapshot.zavorthControl.actions.map((action) =>
        `- ${action.label}: ${action.enabled ? 'enabled' : 'blocked'}${action.requiresApproval ? ' (approval required)' : ''}`,
      ),
      '',
      `Next: ${snapshot.nextSafeAction}`,
    );
    return `${lines.join('\n')}\n`;
  }

  private async runGitHubReview(input: ZavorthAgentReviewRequest): Promise<ZavorthAgentReviewSnapshot> {
    const result = await this.githubService.run({
      prTarget: normalizeText(input.prTarget) || normalizeText(input.targetRef) || 'current',
      repo: input.repo,
      workspace: input.workspace,
      mode: input.mode,
      objective: input.objective,
      reviewId: null,
      userId: input.userId,
      sessionId: input.sessionId,
      postComment: input.postComment === true,
      approvalId: input.approvalId,
      launchLiveAgents: input.launchLiveAgents === true,
      liveAgentMode: input.liveAgentMode,
      instructions: buildInstructions(input),
      rawFindings: input.rawFindings,
    });
    return this.snapshot({
      target: 'github-pr',
      review: result.review,
      collectedFromGit: false,
      collectedFromGitHub: true,
      localDiffBytes: 0,
      heuristicFindingsGenerated: 0,
      summary: result.summary,
    });
  }

  private async runWorkspaceReview(
    input: ZavorthAgentReviewRequest,
    target: ZavorthAgentReviewTarget,
  ): Promise<ZavorthAgentReviewSnapshot> {
    const workspace = normalizeText(input.workspace) || process.cwd();
    const collected = target === 'provided'
      ? {
        files: input.files || [],
        diffText: normalizeText(input.diffText) || '',
        collectedFromGit: false,
      }
      : await this.collectWorkspaceDiff({
        workspace,
        baseRef: input.baseRef,
        targetRef: input.targetRef,
      });
    const heuristicFindings = input.rawFindings?.length
      ? []
      : buildHeuristicFindings(collected.diffText);
    const request = {
      mode: input.mode,
      objective: normalizeText(input.objective) || 'Review current workspace changes',
      workspace,
      baseRef: input.baseRef,
      targetRef: input.targetRef,
      diffSummary: summarizeDiff(collected.diffText, collected.files),
      files: collected.files,
      instructions: buildInstructions(input),
      rawFindings: [
        ...(input.rawFindings || []),
        ...heuristicFindings,
      ],
      actions: {
        approvalId: input.approvalId,
        commentOnPr: input.postComment === true,
        applyPatch: input.applyPatch === true,
        patch: input.patch,
        launchLiveAgents: input.launchLiveAgents === true,
        liveAgentMode: input.liveAgentMode,
      },
      metadata: {
        source: 'zavorth-agent-review',
        userId: input.userId || null,
        sessionId: input.sessionId || null,
      },
    };
    const hasApprovalGatedAction = input.postComment === true
      || input.applyPatch === true
      || input.launchLiveAgents === true;
    const review = hasApprovalGatedAction
      ? await this.reviewService.runWithActions(request)
      : this.reviewService.run(request);

    return this.snapshot({
      target,
      review,
      collectedFromGit: collected.collectedFromGit,
      collectedFromGitHub: false,
      localDiffBytes: collected.diffText.length,
      heuristicFindingsGenerated: heuristicFindings.length,
      summary: review.summary,
    });
  }

  private async collectWorkspaceDiff(input: {
    workspace: string;
    baseRef?: string | null;
    targetRef?: string | null;
  }): Promise<{
    files: GovernedReviewContextFile[];
    diffText: string;
    collectedFromGit: boolean;
  }> {
    try {
      const diffArgs = buildGitDiffArgs(input.baseRef, input.targetRef);
      const nameStatusArgs = buildGitNameStatusArgs(input.baseRef, input.targetRef);
      const [diff, nameStatus, numstat] = await Promise.all([
        this.gitRunner('git', diffArgs, { cwd: input.workspace }),
        this.gitRunner('git', nameStatusArgs, { cwd: input.workspace }),
        this.gitRunner('git', ['diff', '--numstat', ...diffArgs.slice(1)], { cwd: input.workspace }),
      ]);
      if (diff.exitCode !== 0 || nameStatus.exitCode !== 0) {
        return {
          files: [],
          diffText: '',
          collectedFromGit: false,
        };
      }
      return {
        files: parseGitFiles(nameStatus.stdout, numstat.stdout),
        diffText: diff.stdout,
        collectedFromGit: true,
      };
    } catch (error: unknown) {logger.warn('[Zavorth Agent] parsing failed', error);
    return {
        files: [],
        diffText: '',
        collectedFromGit: false,
      };
  }
  }

  private snapshot(input: {
    target: ZavorthAgentReviewTarget;
    review: GovernedReviewResult;
    collectedFromGit: boolean;
    collectedFromGitHub: boolean;
    localDiffBytes: number;
    heuristicFindingsGenerated: number;
    summary: string;
  }): ZavorthAgentReviewSnapshot {
    const zavorthControl = buildGovernedReviewZavorthControlSnapshot(input.review);
    const visual = buildAgentReviewVisualSnapshot(input.review, zavorthControl);
    return {
      contractVersion: ZAVORTH_AGENT_REVIEW_CONTRACT_VERSION,
      surface: 'zavorth-agent-review',
      status: input.review.status,
      target: input.target,
      review: input.review,
      zavorthControl,
      visual,
      command: {
        primary: 'zavorth agent-review',
        aliases: ['zavorth review', 'npm run zavorth:agent-review'],
        readOnlyDefault: true,
        approvalRequiredFor: ['comment-on-pr', 'apply-patch', 'launch-live-agents'],
      },
      evidence: {
        collectedFromGit: input.collectedFromGit,
        collectedFromGitHub: input.collectedFromGitHub,
        localDiffBytes: input.localDiffBytes,
        heuristicFindingsGenerated: input.heuristicFindingsGenerated,
        noMutationAppliedByDefault: input.review.policy.noMutationApplied,
        noExternalCommentWithoutApproval: input.review.policy.externalEgressNotPerformed,
      },
      summary: input.summary,
      nextSafeAction: input.review.nextSafeAction,
    };
  }
}

function buildAgentReviewVisualSnapshot(
  review: GovernedReviewResult,
  zavorthControl: ReturnType<typeof buildGovernedReviewZavorthControlSnapshot>,
): ZavorthAgentReviewSnapshot['visual'] {
  const findings = [
    ...review.verification.acceptedFindings,
    ...review.verification.needsHumanReviewFindings,
  ];
  const severityCounts: Record<GovernedReviewFinding['severity'], number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  for (const finding of findings) {
    severityCounts[finding.severity] += 1;
  }
  const primaryFinding = findings[0]
    ? {
      title: findings[0].title,
      severity: findings[0].severity,
      location: formatReviewLocation(findings[0].file, findings[0].line),
      recommendation: findings[0].recommendation,
    }
    : null;
  const statusTone = review.status === 'blocked' || review.status === 'failed'
    ? 'blocked'
    : severityCounts.critical > 0 || severityCounts.high > 0
      ? 'danger'
      : severityCounts.medium > 0 || review.status === 'waiting_approval'
        ? 'warning'
        : 'ok';

  return {
    route: '/zavorthControl/reviews',
    layout: 'review-board',
    statusTone,
    severityCounts,
    primaryFinding,
    findingCards: findings.slice(0, 8).map((finding) => ({
      id: finding.id,
      title: finding.title,
      severity: finding.severity,
      confidence: finding.confidence,
      location: formatReviewLocation(finding.file, finding.line),
      recommendation: finding.recommendation,
    })),
    laneCards: zavorthControl.lanes.map((lane) => ({
      id: lane.id,
      label: lane.label,
      status: lane.status,
      detail: lane.detail,
    })),
    actionCards: zavorthControl.actions.map((action) => ({
      id: action.id,
      label: action.label,
      state: action.enabled
        ? 'available'
        : action.requiresApproval
          ? 'approval-required'
          : 'blocked',
      detail: action.detail,
    })),
    patchApplyMode: 'approval-gated',
  };
}

function formatReviewLocation(file: string | undefined, line: number | undefined): string {
  if (!file) {
    return 'workspace';
  }
  return line ? `${file}:${line}` : file;
}

export async function defaultAgentReviewCommandRunner(
  command: string,
  args: string[],
  options?: {
    cwd?: string | null;
    input?: string | null;
  },
): Promise<{
  command: string;
  args: string[];
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  if (options?.input) {
    return runCommandWithInput(command, args, options);
  }
  try {
    const result = await execFileAsync(command, args, {
      cwd: options?.cwd || undefined,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 8,
    });
    return {
      command,
      args,
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      exitCode: 0,
    };
  } catch (error: unknown) {const failure = error as Error & { stdout?: string; stderr?: string; code?: number };
    return {
      command,
      args,
      stdout: String(failure.stdout || ''),
      stderr: String(failure.stderr || failure.message || ''),
      exitCode: typeof failure.code === 'number' ? failure.code : 1,
    };
  }
}

async function runCommandWithInput(
  command: string,
  args: string[],
  options?: {
    cwd?: string | null;
    input?: string | null;
  },
): Promise<{
  command: string;
  args: string[];
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options?.cwd || undefined,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (error) => {
      resolve({
        command,
        args,
        stdout,
        stderr: stderr || error.message,
        exitCode: 1,
      });
    });
    child.on('close', (code) => {
      resolve({
        command,
        args,
        stdout,
        stderr,
        exitCode: typeof code === 'number' ? code : 1,
      });
    });
    child.stdin.end(options?.input || '');
  });
}

function resolveTarget(input: ZavorthAgentReviewRequest): ZavorthAgentReviewTarget {
  if (input.target === 'github-pr' || normalizeText(input.prTarget)) {
    return 'github-pr';
  }
  if (input.target === 'provided' || input.files?.length || normalizeText(input.diffText)) {
    return 'provided';
  }
  return 'workspace-diff';
}

function buildInstructions(input: ZavorthAgentReviewRequest): string[] {
  return [
    'Zavorth Agent Review is read-only by default.',
    'Return file, line, severity, confidence and concrete recommendation for each finding.',
    'Do not apply patches, post PR comments or launch live workers without an approval id.',
    ...(input.instructions || []),
  ].filter(Boolean);
}

function buildGitDiffArgs(baseRef?: string | null, targetRef?: string | null): string[] {
  const base = normalizeText(baseRef);
  const target = normalizeText(targetRef);
  if (base && target) {
    return ['diff', `${base}...${target}`];
  }
  if (base) {
    return ['diff', base];
  }
  return ['diff', 'HEAD'];
}

function buildGitNameStatusArgs(baseRef?: string | null, targetRef?: string | null): string[] {
  const diffArgs = buildGitDiffArgs(baseRef, targetRef);
  return ['diff', '--name-status', ...diffArgs.slice(1)];
}

function parseGitFiles(nameStatus: string, numstat: string): GovernedReviewContextFile[] {
  const stats = new Map<string, { additions: number; deletions: number }>();
  for (const line of numstat.split(/\r?\n/)) {
    const parts = line.split('\t');
    if (parts.length < 3) continue;
    stats.set(parts[2] || '', {
      additions: parseGitCount(parts[0]),
      deletions: parseGitCount(parts[1]),
    });
  }
  return nameStatus.split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\t+/);
      const rawStatus = parts[0] || '';
      const filePath = parts.at(-1) || '';
      const stat = stats.get(filePath);
      return {
        path: filePath,
        status: normalizeGitStatus(rawStatus),
        additions: stat?.additions,
        deletions: stat?.deletions,
        language: inferLanguage(filePath),
      };
    })
    .filter((file) => file.path)
    .slice(0, 200);
}

function buildHeuristicFindings(diffText: string): Array<Partial<GovernedReviewFinding>> {
  const findings: Array<Partial<GovernedReviewFinding>> = [];
  let currentFile = '';
  let currentLine = 0;
  for (const line of diffText.split(/\r?\n/)) {
    const fileMatch = /^diff --git a\/.+ b\/(.+)$/.exec(line);
    if (fileMatch) {
      currentFile = fileMatch[1] || '';
      currentLine = 0;
      continue;
    }
    const hunkMatch = /^@@ -\d+(?:,\d+)? \+(\d+)/.exec(line);
    if (hunkMatch) {
      currentLine = Number(hunkMatch[1] || 0);
      continue;
    }
    if (line.startsWith('+') && !line.startsWith('+++')) {
      const content = line.slice(1);
      for (const finding of heuristicFindingsForAddedLine(content, currentFile, currentLine || undefined)) {
        findings.push(finding);
      }
      currentLine += 1;
    } else if (!line.startsWith('-')) {
      currentLine += line.startsWith(' ') ? 1 : 0;
    }
  }
  return findings.slice(0, 40);
}

function heuristicFindingsForAddedLine(
  line: string,
  file: string,
  lineNumber?: number,
): Array<Partial<GovernedReviewFinding>> {
  const checks: Array<{
    pattern: RegExp;
    title: string;
    severity: GovernedReviewFinding['severity'];
    recommendation: string;
    confidence: number;
  }> = [
    {
      pattern: /\b(console\.log|logger\.(info|debug|warn|error))\b.*\b(token|secret|password|api[_-]?key|authorization)\b/i,
      title: 'Sensitive value may be logged',
      severity: 'high',
      recommendation: 'Redact sensitive values before logging or remove the log statement.',
      confidence: 88,
    },
    {
      pattern: /\b(eval|new Function)\s*\(/,
      title: 'Dynamic code execution introduced',
      severity: 'critical',
      recommendation: 'Replace dynamic execution with a typed parser or allow-listed command table.',
      confidence: 86,
    },
    {
      pattern: /\bexec\s*\(|child_process\.(exec|spawn|execFile)\b.*\$\{/,
      title: 'Shell execution may use interpolated input',
      severity: 'high',
      recommendation: 'Use execFile/spawn with fixed argv and validate every user-controlled argument.',
      confidence: 82,
    },
    {
      pattern: /dangerouslySetInnerHTML|innerHTML\s*=/,
      title: 'HTML injection surface introduced',
      severity: 'high',
      recommendation: 'Use safe rendering primitives or sanitize trusted markup at the boundary.',
      confidence: 82,
    },
    {
      pattern: /\bTODO\b|\bFIXME\b/i,
      title: 'Unresolved implementation marker added',
      severity: 'low',
      recommendation: 'Convert the marker into a tracked issue or finish the implementation before merge.',
      confidence: 63,
    },
  ];
  return checks
    .filter((check) => check.pattern.test(line))
    .map((check) => ({
      title: check.title,
      severity: check.severity,
      confidence: check.confidence,
      file,
      line: lineNumber,
      evidence: [line.trim().slice(0, 240)],
      recommendation: check.recommendation,
      sourceAgentId: 'zavorth-agent-review-heuristic',
      tags: ['agent-review', 'heuristic'],
    }));
}

function summarizeDiff(diffText: string, files: GovernedReviewContextFile[]): string {
  if (!diffText && files.length === 0) {
    return 'No local diff was detected; review remains a read-only governed empty-context run.';
  }
  const totalAdditions = files.reduce((sum, file) => sum + (file.additions || 0), 0);
  const totalDeletions = files.reduce((sum, file) => sum + (file.deletions || 0), 0);
  return `Agent review collected ${files.length} file(s), +${totalAdditions}/-${totalDeletions}, diff bytes=${diffText.length}.`;
}

function normalizeGitStatus(status: string): GovernedReviewContextFile['status'] {
  const first = status.charAt(0).toUpperCase();
  if (first === 'A') return 'added';
  if (first === 'M') return 'modified';
  if (first === 'D') return 'deleted';
  if (first === 'R') return 'renamed';
  return 'unknown';
}

function inferLanguage(filePath: string): string | undefined {
  const extension = path.extname(filePath).replace('.', '').toLowerCase();
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    rs: 'rust',
    go: 'go',
    json: 'json',
    md: 'markdown',
  };
  return map[extension];
}

function parseGitCount(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}
