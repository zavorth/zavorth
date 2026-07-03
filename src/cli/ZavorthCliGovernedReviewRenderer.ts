import {
  GovernedReviewGitHubService,
  GovernedReviewService,
  type GovernedReviewContextFile,
  type GovernedReviewGitHubResult,
  type GovernedReviewMode,
  type GovernedReviewRequestedActions,
  type GovernedReviewRequest,
  type GovernedReviewResult,
} from '../runtime/review/index.js';

export type GovernedReviewCliSnapshot = GovernedReviewResult | GovernedReviewGitHubResult;

export function resolveGovernedReviewCliText(args: string): string {
  return stripReviewFlags(String(args || '')
    .trim()
    .replace(/^(?:governed-review|review-kernel|code-review|security-review|policy-review|regression-review|github-review|review|github|run|preview|status|latest)\b/i, '')
    .trim())
    .replace(/^["']|["']$/g, '')
    .trim();
}

export function shouldHandleReviewCommand(commandName: string | null, args: string): boolean {
  const command = String(commandName || '').trim().toLowerCase();
  if (command !== 'review') {
    return false;
  }
  const normalizedArgs = String(args || '').trim();
  return normalizedArgs.length === 0
    || /^\s*github\b/i.test(normalizedArgs)
    || /(?:^|\s)--(?:github|governed|kernel|security|policy|regression|mode=|file=|base=|target=|repo=|pr=|github-pr=|live-agents|launch-live-agents|mock-live-agents|comment-pr|post-pr-comment|post-comment|apply-patch|approval-id=)\b/i.test(normalizedArgs);
}

export function resolveGovernedReviewMode(commandName: string | null, args: string): GovernedReviewMode | null {
  const command = String(commandName || '').trim().toLowerCase();
  const explicitMode = readStringFlag(args, 'mode');
  if (isReviewMode(explicitMode)) {
    return explicitMode;
  }
  if (hasFlag(args, 'security')) {
    return 'security-review';
  }
  if (hasFlag(args, 'policy')) {
    return 'policy-review';
  }
  if (hasFlag(args, 'regression')) {
    return 'regression-review';
  }

  if (command === 'security-review') {
    return 'security-review';
  }
  if (command === 'policy-review') {
    return 'policy-review';
  }
  if (command === 'regression-review') {
    return 'regression-review';
  }
  if (command === 'code-review' || command === 'governed-review' || command === 'review-kernel') {
    return 'code-review';
  }
  return null;
}

export function buildGovernedReviewCliSnapshot(input: {
  commandName?: string | null;
  args: string;
  userId: string;
  sessionId: string;
  workspace?: string | null;
}): GovernedReviewResult {
  return new GovernedReviewService().run(buildGovernedReviewRequest(input));
}

export async function buildGovernedReviewCliSnapshotAsync(input: {
  commandName?: string | null;
  args: string;
  userId: string;
  sessionId: string;
  workspace?: string | null;
}): Promise<GovernedReviewCliSnapshot> {
  if (shouldRunGitHubGovernedReview(input.commandName || null, input.args)) {
    return buildGitHubGovernedReviewCliSnapshot(input);
  }
  const request = buildGovernedReviewRequest(input);
  if (!hasRequestedActions(request.actions)) {
    return new GovernedReviewService().run(request);
  }
  return new GovernedReviewService().runWithActions(request);
}

async function buildGitHubGovernedReviewCliSnapshot(input: {
  commandName?: string | null;
  args: string;
  userId: string;
  sessionId: string;
  workspace?: string | null;
}): Promise<GovernedReviewGitHubResult> {
  const prTarget = readStringFlag(input.args, 'github-pr')
    || readStringFlag(input.args, 'pr')
    || readStringFlag(input.args, 'pr-target');
  if (!prTarget) {
    throw new Error('GitHub governed review requires --pr=<number-or-url> or --github-pr=<number-or-url>.');
  }
  const mode = resolveGovernedReviewMode(input.commandName || null, input.args);
  return new GovernedReviewGitHubService().run({
    prTarget,
    repo: readStringFlag(input.args, 'repo'),
    workspace: readStringFlag(input.args, 'workspace') || input.workspace || null,
    mode,
    objective: resolveGovernedReviewCliText(input.args),
    reviewId: readStringFlag(input.args, 'review-id'),
    userId: input.userId,
    sessionId: input.sessionId,
    postComment: hasFlag(input.args, 'comment-pr')
      || hasFlag(input.args, 'post-pr-comment')
      || hasFlag(input.args, 'post-comment'),
    approvalId: readStringFlag(input.args, 'approval-id'),
    launchLiveAgents: hasFlag(input.args, 'live-agents')
      || hasFlag(input.args, 'launch-live-agents')
      || hasFlag(input.args, 'mock-live-agents'),
    liveAgentMode: readLiveAgentMode(input.args),
    maxLiveWorkers: readIntegerFlag(input.args, 'max-live-workers'),
    maxToolCalls: readIntegerFlag(input.args, 'max-tool-calls'),
    persistSubagentState: false,
    instructions: [
      'CLI GitHub governed review is approval-aware.',
      'PR comments are posted only after explicit approval id.',
    ],
    metadata: {
      source: 'zavorth-cli',
      zavorthControlPath: '/zavorthControl/reviews',
    },
  });
}

function buildGovernedReviewRequest(input: {
  commandName?: string | null;
  args: string;
  userId: string;
  sessionId: string;
  workspace?: string | null;
}): GovernedReviewRequest {
  const mode = resolveGovernedReviewMode(input.commandName || null, input.args);
  const text = resolveGovernedReviewCliText(input.args)
    || defaultObjectiveForMode(mode || 'code-review');
  return {
    reviewId: readStringFlag(input.args, 'review-id'),
    mode,
    objective: text,
    workspace: readStringFlag(input.args, 'workspace') || input.workspace || null,
    targetRef: readStringFlag(input.args, 'target') || 'HEAD',
    baseRef: readStringFlag(input.args, 'base') || null,
    files: readFiles(input.args),
    instructions: [
      'CLI governed review surface is approval-aware.',
      'Comments, patches and live review agents require explicit approval.',
    ],
    actions: readRequestedActions(input.args),
    metadata: {
      source: 'zavorth-cli',
      userId: input.userId,
      sessionId: input.sessionId,
      zavorthControlPath: '/zavorthControl/reviews',
    },
  };
}

export function formatGovernedReviewSnapshot(snapshot: GovernedReviewCliSnapshot): string {
  if (isGitHubGovernedReviewSnapshot(snapshot)) {
    return formatGitHubGovernedReviewSnapshot(snapshot);
  }
  const lines = [
    'Zavorth Governed Review - Connector registry',
    `- contrato: ${snapshot.contractVersion}`,
    `- review: ${snapshot.reviewId}`,
    `- modo: ${snapshot.mode}`,
    `- status: ${snapshot.status}`,
    `- objetivo: ${snapshot.objective}`,
    `- contexto: ${snapshot.context.files.length} arquivo(s); ${snapshot.context.source}`,
    `- agentes: ${snapshot.agentPlan.length}; subagent receipts: ${snapshot.agentRuntimePlan.subagentReceipts.length}`,
    `- findings: ${snapshot.verification.acceptedFindingCount} aceitos | ${snapshot.verification.needsHumanReviewFindingCount} revisao humana | ${snapshot.verification.discardedFindingCount} descartados`,
    `- threshold: aceito ${snapshot.verification.acceptedThreshold}; revisao humana ${snapshot.verification.humanReviewThreshold}`,
    '',
    'Agentes',
  ];

  for (const role of snapshot.agentPlan.slice(0, 8)) {
    const runtimeLink = snapshot.agentRuntimePlan.roleLinks.find((link) => link.reviewRoleId === role.id);
    lines.push(
      `- ${role.id}: ${role.label} [${role.kind}]`,
      `  scope: ${runtimeLink?.scopeMode || 'blocked'}; approval: ${runtimeLink?.approvalRequired ? 'sim' : 'nao'}; budget zero: ${runtimeLink?.budgetZero ? 'sim' : 'nao'}`,
    );
  }

  lines.push('', 'Findings aceitos');
  if (snapshot.findings.length === 0) {
    lines.push('- nenhum finding aceito nesta previa; execute agentes/verificador real antes de comentar ou aplicar patch');
  } else {
    for (const finding of snapshot.findings.slice(0, 8)) {
      lines.push(
        `- [${finding.severity}] ${finding.title} (${finding.confidence})`,
        `  ${finding.file ? `${finding.file}${finding.line ? `:${finding.line}` : ''}` : 'sem arquivo'}`,
        `  recomendacao: ${finding.recommendation}`,
      );
    }
  }

  if (snapshot.verification.needsHumanReviewFindings.length > 0) {
    lines.push('', 'Revisao humana');
    for (const finding of snapshot.verification.needsHumanReviewFindings.slice(0, 5)) {
      lines.push(`- ${finding.title} (${finding.confidence}): ${finding.verification.reasons.join(', ')}`);
    }
  }

  lines.push('', 'Execution');
  lines.push(`- status: ${snapshot.execution.status}; approval: ${snapshot.execution.approvalId || 'nao informado'}`);
  if (snapshot.execution.outcomes.length === 0) {
    lines.push('- nenhuma acao approval-gated solicitada');
  } else {
    for (const outcome of snapshot.execution.outcomes) {
      lines.push(`- ${outcome.action}: ${outcome.status}; allowed=${outcome.allowed}; ${outcome.summary}`);
    }
  }
  if (snapshot.execution.liveAgentSnapshot) {
    lines.push(
      `- live agents: status=${snapshot.execution.liveAgentSnapshot.status}; workers=${snapshot.execution.liveAgentSnapshot.workerResults}; externalIO=${snapshot.execution.liveAgentSnapshot.externalIoPerformed}`,
    );
  }

  lines.push('', 'Policy Gate');
  for (const decision of snapshot.policyGate.decisions) {
    lines.push(`- ${decision.action}: allowed=${decision.allowed}; approval=${decision.requiresApproval}; ${decision.reason}`);
  }

  lines.push('', 'Receipts');
  for (const receipt of snapshot.receipts.slice(0, 10)) {
    lines.push(`- ${receipt.kind}: ${receipt.status} (${receipt.source})`);
  }

  lines.push('', 'Superficies');
  lines.push('- CLI JSON: zavorth governed-review --json');
  lines.push('- ZavorthControl: /zavorthControl/reviews');
  lines.push('- Comentario em PR, patch e live agents continuam approval-gated.');

  return lines.join('\n');
}

function defaultObjectiveForMode(mode: GovernedReviewMode): string {
  switch (mode) {
    case 'security-review':
      return 'run a governed security review preview';
    case 'policy-review':
      return 'run a governed policy review preview';
    case 'regression-review':
      return 'run a governed regression review preview';
    case 'code-review':
    default:
      return 'run a governed code review preview';
  }
}

function readFiles(args: string): GovernedReviewContextFile[] {
  const matches = Array.from(String(args || '').matchAll(/--file=("[^"]+"|'[^']+'|\S+)/g));
  return matches
    .map((match) => String(match[1] || '').replace(/^["']|["']$/g, '').trim())
    .filter(Boolean)
    .slice(0, 50)
    .map((file): GovernedReviewContextFile => ({
      path: file,
      status: 'modified',
    }));
}

function stripReviewFlags(value: string): string {
  return value
    .replace(/^\s*github\b/i, '')
    .replace(/--(?:github|governed|kernel|security|policy|regression|live-agents|launch-live-agents|mock-live-agents|mock-live|live-llm|comment-pr|post-pr-comment|post-comment|apply-patch)\b/g, '')
    .replace(/--(?:mode|file|base|target|workspace|repo|review-id|approval-id|pr|github-pr|pr-target|patch-file|patch|live-mode|max-live-workers|max-tool-calls)=(?:"[^"]+"|'[^']+'|\S+)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function readRequestedActions(args: string): GovernedReviewRequestedActions | null {
  const launchLiveAgents = hasFlag(args, 'live-agents')
    || hasFlag(args, 'launch-live-agents')
    || hasFlag(args, 'mock-live-agents');
  const commentOnPr = hasFlag(args, 'comment-pr') || hasFlag(args, 'post-pr-comment');
  const applyPatch = hasFlag(args, 'apply-patch');
  if (!launchLiveAgents && !commentOnPr && !applyPatch) {
    return null;
  }
  const patchFile = readStringFlag(args, 'patch-file');
  const patch = readStringFlag(args, 'patch');
  return {
    approvalId: readStringFlag(args, 'approval-id'),
    launchLiveAgents,
    liveAgentMode: readLiveAgentMode(args),
    maxLiveWorkers: readIntegerFlag(args, 'max-live-workers'),
    maxToolCalls: readIntegerFlag(args, 'max-tool-calls'),
    persistSubagentState: false,
    commentOnPr,
    prTarget: readStringFlag(args, 'pr') || readStringFlag(args, 'pr-target'),
    applyPatch,
    patch: patchFile && patch
      ? {
        filePath: patchFile,
        patch,
        dryRun: hasFlag(args, 'patch-dry-run'),
      }
      : null,
  };
}

function hasRequestedActions(actions: GovernedReviewRequestedActions | null | undefined): boolean {
  return actions?.launchLiveAgents === true
    || actions?.commentOnPr === true
    || actions?.applyPatch === true;
}

function readLiveAgentMode(args: string): GovernedReviewRequestedActions['liveAgentMode'] {
  const explicit = readStringFlag(args, 'live-mode');
  if (explicit === 'live-llm' || explicit === 'mock-live' || explicit === 'governed-in-process') {
    return explicit;
  }
  if (hasFlag(args, 'mock-live-agents') || hasFlag(args, 'mock-live')) {
    return 'mock-live';
  }
  if (hasFlag(args, 'live-llm') || hasFlag(args, 'live-agents') || hasFlag(args, 'launch-live-agents')) {
    return 'live-llm';
  }
  return 'mock-live';
}

function readIntegerFlag(args: string, name: string): number | null {
  const value = readStringFlag(args, name);
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }
  return null;
}

function hasFlag(args: string, name: string): boolean {
  return new RegExp(`(?:^|\\s)--${name}\\b`, 'i').test(args);
}

function readStringFlag(args: string, name: string): string | null {
  const match = String(args || '').match(new RegExp(`--${name}=("[^"]+"|'[^']+'|\\S+)`, 'i'));
  if (!match) {
    return null;
  }
  const value = String(match[1] || '').replace(/^["']|["']$/g, '').trim();
  return value || null;
}

function isReviewMode(value: unknown): value is GovernedReviewMode {
  return value === 'code-review'
    || value === 'security-review'
    || value === 'policy-review'
    || value === 'regression-review';
}

function shouldRunGitHubGovernedReview(commandName: string | null, args: string): boolean {
  const command = String(commandName || '').trim().toLowerCase();
  return command === 'github-review'
    || hasFlag(args, 'github')
    || Boolean(readStringFlag(args, 'github-pr'))
    || /^\s*github\b/i.test(args);
}

function isGitHubGovernedReviewSnapshot(snapshot: GovernedReviewCliSnapshot): snapshot is GovernedReviewGitHubResult {
  return (snapshot as GovernedReviewGitHubResult).source === 'GovernedReviewGitHubService';
}

function formatGitHubGovernedReviewSnapshot(snapshot: GovernedReviewGitHubResult): string {
  const reviewText = formatGovernedReviewSnapshot(snapshot.review);
  const lines = [
    'Zavorth GitHub Governed Review - Phase B',
    `- repo: ${snapshot.repo.nameWithOwner || snapshot.repo.requestedRepo || 'current'} (${snapshot.repo.status})`,
    `- pr: ${snapshot.pullRequest.number ? `#${snapshot.pullRequest.number}` : snapshot.pullRequest.target} ${snapshot.pullRequest.title}`,
    `- refs: ${snapshot.pullRequest.baseRef || 'base'} <- ${snapshot.pullRequest.headRef || 'head'}`,
    `- diff: ${snapshot.pullRequest.changedFiles.length} arquivo(s); +${snapshot.pullRequest.additions}/-${snapshot.pullRequest.deletions}; sha ${snapshot.pullRequest.diffSha.slice(0, 16)}`,
    `- comentario: ${snapshot.review.execution.outcomes.find((outcome) => outcome.action === 'comment-on-pr')?.status || 'nao solicitado'}`,
    `- comandos gh: ${snapshot.commands.length}`,
    '',
    reviewText,
  ];
  return lines.join('\n');
}
