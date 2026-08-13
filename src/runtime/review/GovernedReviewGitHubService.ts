import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { GovernedReviewService } from './GovernedReviewService.js';
import {
  ReviewActionExecutor,
  type GovernedReviewExternalActionAdapter,
  type ReviewAdapterActionResult,
} from './ReviewActionExecutor.js';
import type {
  GovernedReviewContextFile,
  GovernedReviewLiveAgentMode,
  GovernedReviewMode,
  GovernedReviewRequest,
  GovernedReviewRequestedActions,
  GovernedReviewResult,
} from './GovernedReviewTypes.js';export type GovernedReviewGitHubCommandResult = {
  command: string;
  args: string[];
  stdout: string;
  stderr: string;
  exitCode: number;
};

export type GovernedReviewGitHubCommandRunner = (
  command: string,
  args: string[],
  options?: {
    cwd?: string | null;
    input?: string | null;
  },
) => Promise<GovernedReviewGitHubCommandResult>;

export type GovernedReviewGitHubPullRequest = {
  target: string;
  number: number | null;
  title: string;
  url: string | null;
  author: string | null;
  baseRef: string | null;
  headRef: string | null;
  body: string | null;
  changedFiles: GovernedReviewContextFile[];
  additions: number;
  deletions: number;
  diffPreview: string;
  diffSha: string;
};

export type GovernedReviewGitHubRepo = {
  status: 'connected' | 'partial';
  nameWithOwner: string | null;
  url: string | null;
  defaultBranch: string | null;
  requestedRepo: string | null;
  connectionSummary: string;
};

export type GovernedReviewGitHubResult = {
  source: 'GovernedReviewGitHubService';
  status: GovernedReviewResult['status'];
  repo: GovernedReviewGitHubRepo;
  pullRequest: GovernedReviewGitHubPullRequest;
  review: GovernedReviewResult;
  commands: Array<{
    command: string;
    args: string[];
    exitCode: number;
  }>;
  summary: string;
  nextSafeAction: string;
};

export type GovernedReviewGitHubRunInput = {
  prTarget: string;
  repo?: string | null;
  workspace?: string | null;
  mode?: GovernedReviewMode | null;
  objective?: string | null;
  reviewId?: string | null;
  userId?: string | null;
  sessionId?: string | null;
  postComment?: boolean | null;
  approvalId?: string | null;
  launchLiveAgents?: boolean | null;
  liveAgentMode?: GovernedReviewLiveAgentMode | null;
  maxLiveWorkers?: number | null;
  maxToolCalls?: number | null;
  persistSubagentState?: boolean | null;
  instructions?: string[] | null;
  metadata?: Record<string, unknown> | null;
  rawFindings?: GovernedReviewRequest['rawFindings'];
};

export class GovernedReviewGitHubService {
  private readonly runner: GovernedReviewGitHubCommandRunner;
  private readonly reviewServiceFactory: (adapter: GovernedReviewExternalActionAdapter) => GovernedReviewService;

  public constructor(runtime: {
    runner?: GovernedReviewGitHubCommandRunner;
    reviewServiceFactory?: (adapter: GovernedReviewExternalActionAdapter) => GovernedReviewService;
  } = {}) {
    this.runner = runtime.runner || defaultGovernedReviewGitHubCommandRunner;
    this.reviewServiceFactory = runtime.reviewServiceFactory || ((adapter) =>
      new GovernedReviewService({
        actionExecutor: new ReviewActionExecutor({ actionAdapter: adapter }),
      }));
  }

  public async run(input: GovernedReviewGitHubRunInput): Promise<GovernedReviewGitHubResult> {
    const prTarget = normalizeText(input.prTarget);
    if (!prTarget) {
      throw new Error('GitHub governed review requires a PR target.');
    }

    const commandLog: GovernedReviewGitHubResult['commands'] = [];
    const trackedRunner: GovernedReviewGitHubCommandRunner = async (command, args, options) => {
      const result = await this.runner(command, args, options);
      commandLog.push({
        command: result.command || command,
        args: result.args || args,
        exitCode: result.exitCode,
      });
      return result;
    };

    const repo = await connectGitHubRepo({
      repo: input.repo,
      workspace: input.workspace,
      runner: trackedRunner,
    });
    const pullRequest = await collectGitHubPullRequest({
      prTarget,
      repo: repo.nameWithOwner || normalizeText(input.repo),
      workspace: input.workspace,
      runner: trackedRunner,
    });
    const adapter = new GitHubGovernedReviewActionAdapter({
      runner: trackedRunner,
      workspace: input.workspace,
      repo: repo.nameWithOwner || normalizeText(input.repo),
    });
    const service = this.reviewServiceFactory(adapter);
    const actions = buildGitHubActions({
      input,
      pullRequest,
    });
    const request = buildGovernedReviewRequestFromGitHub({
      input,
      repo,
      pullRequest,
      actions,
    });
    const review = hasRequestedActions(actions)
      ? await service.runWithActions(request)
      : service.run(request);

    return {
      source: 'GovernedReviewGitHubService',
      status: review.status,
      repo,
      pullRequest,
      review,
      commands: commandLog,
      summary: [
        `GitHub PR ${pullRequest.number ? `#${pullRequest.number}` : pullRequest.target} collected from ${repo.nameWithOwner || 'current repository'}.`,
        review.summary,
      ].join(' '),
      nextSafeAction: review.nextSafeAction,
    };
  }
}

class GitHubGovernedReviewActionAdapter implements GovernedReviewExternalActionAdapter {
  private readonly runner: GovernedReviewGitHubCommandRunner;
  private readonly workspace: string | null;
  private readonly repo: string | null;

  public constructor(input: {
    runner: GovernedReviewGitHubCommandRunner;
    workspace?: string | null;
    repo?: string | null;
  }) {
    this.runner = input.runner;
    this.workspace = normalizeText(input.workspace);
    this.repo = normalizeText(input.repo);
  }

  public async postPullRequestComment(input: {
    prTarget: string | null;
    body: string;
    approvalId: string;
  }): Promise<ReviewAdapterActionResult> {
    const prTarget = normalizeText(input.prTarget);
    if (!prTarget) {
      return {
        status: 'blocked',
        summary: 'GitHub PR comment approved, but no PR target was provided.',
        metadata: {
          externalIoPerformed: false,
          requiredFlag: '--pr=<number-or-url>',
        },
      };
    }

    const args = ['pr', 'comment', prTarget, '--body-file', '-'];
    if (this.repo) {
      args.push('--repo', this.repo);
    }
    const result = await this.runner('gh', args, {
      cwd: this.workspace,
      input: input.body,
    });
    if (result.exitCode !== 0) {
      return {
        status: 'failed',
        summary: `GitHub PR comment failed for ${prTarget}: ${firstLine(result.stderr) || `exit ${result.exitCode}`}`,
        metadata: {
          approvalId: input.approvalId,
          prTarget,
          repo: this.repo,
          exitCode: result.exitCode,
          stderr: result.stderr.slice(0, 2000),
          externalIoPerformed: false,
        },
      };
    }

    return {
      status: 'completed',
      summary: `Posted governed review comment to GitHub PR ${prTarget}.`,
      metadata: {
        approvalId: input.approvalId,
        prTarget,
        repo: this.repo,
        stdout: result.stdout.slice(0, 2000),
        externalIoPerformed: true,
      },
    };
  }
}

async function connectGitHubRepo(input: {
  repo?: string | null;
  workspace?: string | null;
  runner: GovernedReviewGitHubCommandRunner;
}): Promise<GovernedReviewGitHubRepo> {
  const repoHint = normalizeText(input.repo);
  const args = ['repo', 'view'];
  if (repoHint) {
    args.push(repoHint);
  }
  args.push('--json', 'nameWithOwner,url,defaultBranchRef');
  const result = await input.runner('gh', args, { cwd: input.workspace });
  if (result.exitCode === 0) {
    const parsed = parseJsonRecord(result.stdout);
    const defaultBranchRef = isRecord(parsed.defaultBranchRef) ? parsed.defaultBranchRef : {};
    const nameWithOwner = normalizeText(parsed.nameWithOwner);
    return {
      status: 'connected',
      nameWithOwner,
      url: normalizeText(parsed.url),
      defaultBranch: normalizeText(defaultBranchRef.name),
      requestedRepo: repoHint,
      connectionSummary: nameWithOwner ? `Connected through gh to ${nameWithOwner}.`
        : 'Connected through gh to the current repository.',
    };
  }

  return {
    status: 'partial',
    nameWithOwner: repoHint,
    url: null,
    defaultBranch: null,
    requestedRepo: repoHint,
    connectionSummary: `gh repo view did not return repository metadata: ${firstLine(result.stderr) || `exit ${result.exitCode}`}`,
  };
}

async function collectGitHubPullRequest(input: {
  prTarget: string;
  repo?: string | null;
  workspace?: string | null;
  runner: GovernedReviewGitHubCommandRunner;
}): Promise<GovernedReviewGitHubPullRequest> {
  const prViewArgs = ['pr', 'view', input.prTarget, '--json', 'number,title,url,headRefName,baseRefName,author,body,files'];
  const repo = normalizeText(input.repo);
  if (repo) {
    prViewArgs.push('--repo', repo);
  }
  const prView = await input.runner('gh', prViewArgs, { cwd: input.workspace });
  if (prView.exitCode !== 0) {
    throw new Error(`Unable to read GitHub PR ${input.prTarget}: ${firstLine(prView.stderr) || `exit ${prView.exitCode}`}`);
  }

  const diffArgs = ['pr', 'diff', input.prTarget, '--patch'];
  if (repo) {
    diffArgs.push('--repo', repo);
  }
  const diffResult = await input.runner('gh', diffArgs, { cwd: input.workspace });
  if (diffResult.exitCode !== 0) {
    throw new Error(`Unable to read GitHub PR diff ${input.prTarget}: ${firstLine(diffResult.stderr) || `exit ${diffResult.exitCode}`}`);
  }

  const parsed = parseJsonRecord(prView.stdout);
  const author = isRecord(parsed.author) ? normalizeText(parsed.author.login) : null;
  const files = normalizeGitHubFiles(parsed.files, diffResult.stdout);
  const additions = files.reduce((sum, file) => sum + (file.additions || 0), 0);
  const deletions = files.reduce((sum, file) => sum + (file.deletions || 0), 0);
  return {
    target: input.prTarget,
    number: normalizeNumber(parsed.number),
    title: normalizeText(parsed.title) || 'Untitled GitHub PR',
    url: normalizeText(parsed.url),
    author,
    baseRef: normalizeText(parsed.baseRefName),
    headRef: normalizeText(parsed.headRefName),
    body: normalizeText(parsed.body),
    changedFiles: files,
    additions,
    deletions,
    diffPreview: diffResult.stdout.slice(0, 20000),
    diffSha: createHash('sha256').update(diffResult.stdout).digest('hex'),
  };
}

function buildGitHubActions(input: {
  input: GovernedReviewGitHubRunInput;
  pullRequest: GovernedReviewGitHubPullRequest;
}): GovernedReviewRequestedActions {
  return {
    approvalId: normalizeText(input.input.approvalId),
    commentOnPr: input.input.postComment === true,
    prTarget: String(input.pullRequest.number || input.pullRequest.target),
    launchLiveAgents: input.input.launchLiveAgents === true,
    liveAgentMode: input.input.liveAgentMode || null,
    maxLiveWorkers: input.input.maxLiveWorkers || null,
    maxToolCalls: input.input.maxToolCalls || null,
    persistSubagentState: input.input.persistSubagentState === true,
    applyPatch: false,
  };
}

function buildGovernedReviewRequestFromGitHub(input: {
  input: GovernedReviewGitHubRunInput;
  repo: GovernedReviewGitHubRepo;
  pullRequest: GovernedReviewGitHubPullRequest;
  actions: GovernedReviewRequestedActions;
}): GovernedReviewRequest {
  const objective = normalizeText(input.input.objective)
    || `Review GitHub PR ${input.pullRequest.number ? `#${input.pullRequest.number}` : input.pullRequest.target}: ${input.pullRequest.title}`;
  return {
    reviewId: normalizeText(input.input.reviewId),
    mode: input.input.mode || 'code-review',
    objective,
    workspace: normalizeText(input.input.workspace),
    targetRef: input.pullRequest.headRef,
    baseRef: input.pullRequest.baseRef,
    diffSummary: [
      `GitHub PR ${input.pullRequest.number ? `#${input.pullRequest.number}` : input.pullRequest.target}: ${input.pullRequest.title}.`,
      `${input.pullRequest.changedFiles.length} file(s), +${input.pullRequest.additions}/-${input.pullRequest.deletions}.`,
      `Diff sha256=${input.pullRequest.diffSha.slice(0, 16)}.`,
    ].join(' '),
    files: input.pullRequest.changedFiles,
    instructions: [
      'GitHub PR metadata and diff were collected with gh CLI.',
      'Use the governed review verifier before surfacing findings.',
      'Posting comments to GitHub requires an approval id and a receipt.',
      ...(input.input.instructions || []),
    ],
    rawFindings: input.input.rawFindings,
    actions: input.actions,
    metadata: {
      source: 'github-pr',
      repo: input.repo.nameWithOwner,
      repoUrl: input.repo.url,
      repoConnectionStatus: input.repo.status,
      prTarget: input.pullRequest.target,
      prNumber: input.pullRequest.number,
      prUrl: input.pullRequest.url,
      prAuthor: input.pullRequest.author,
      prTitle: input.pullRequest.title,
      diffSha: input.pullRequest.diffSha,
      diffPreview: input.pullRequest.diffPreview,
      userId: normalizeText(input.input.userId),
      sessionId: normalizeText(input.input.sessionId),
      ...(input.input.metadata || {}),
    },
  };
}

function normalizeGitHubFiles(value: unknown, diff: string): GovernedReviewContextFile[] {
  const fromView = Array.isArray(value)
    ? value
      .map((entry): GovernedReviewContextFile | null => {
        if (!isRecord(entry)) {
          return null;
        }
        const path = normalizeText(entry.path) || normalizeText(entry.filename);
        if (!path) {
          return null;
        }
        return {
          path,
          status: normalizeFileStatus(entry.status),
          additions: normalizeCount(entry.additions),
          deletions: normalizeCount(entry.deletions),
        };
      })
      .filter((entry): entry is GovernedReviewContextFile => Boolean(entry))
    : [];
  if (fromView.length > 0) {
    return fromView.slice(0, 200);
  }

  const files = Array.from(diff.matchAll(/^diff --git a\/(.+?) b\/(.+)$/gm))
    .map((match): GovernedReviewContextFile => ({
      path: match[2] || match[1] || 'unknown',
      status: 'modified',
    }));
  return files.slice(0, 200);
}

function normalizeFileStatus(value: unknown): GovernedReviewContextFile['status'] {
  if (value === 'added' || value === 'modified' || value === 'deleted' || value === 'renamed') {
    return value;
  }
  return 'modified';
}

function hasRequestedActions(actions: GovernedReviewRequestedActions): boolean {
  return actions.commentOnPr === true
    || actions.launchLiveAgents === true
    || actions.applyPatch === true;
}

function normalizeCount(value: unknown): number | undefined {
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? Math.floor(count) : undefined;
}

function normalizeNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseJsonRecord(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : {};
  } catch (error: unknown) {return {};
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function firstLine(value: string): string {
  return String(value || '').split(/\r?\n/).map((line) => line.trim()).find(Boolean) || '';
}

function normalizeText(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text || null;
}

export const defaultGovernedReviewGitHubCommandRunner: GovernedReviewGitHubCommandRunner = (
  command,
  args,
  options,
) => new Promise((resolve) => {
  const child = execFile(command, args, {
    cwd: options?.cwd || undefined,
    maxBuffer: 25 * 1024 * 1024,
    windowsHide: true,
  }, (error, stdout, stderr) => {
    const code = typeof (error as NodeJS.ErrnoException | null)?.code === 'number'
      ? Number((error as NodeJS.ErrnoException).code)
      : error
        ? 1
        : 0;
    resolve({
      command,
      args,
      stdout: String(stdout || ''),
      stderr: String(stderr || ''),
      exitCode: code,
    });
  });
  if (options?.input) {
    child.stdin?.end(options.input);
  }
});
