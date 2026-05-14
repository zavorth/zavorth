import {
  ZAVORTH_REASONING_ACTION_PATTERN_CONTRACT_VERSION,
  type ZavorthReasoningActionPatternAction,
  type ZavorthReasoningActionPatternActionKind,
  type ZavorthReasoningActionPatternApprovalRequest,
  type ZavorthReasoningActionPatternBlock,
  type ZavorthReasoningActionPatternDecision,
  type ZavorthReasoningActionPatternEvidence,
  type ZavorthReasoningActionPatternInput,
  type ZavorthReasoningActionPatternReceipt,
  type ZavorthReasoningActionPatternReasoningBlock,
  type ZavorthReasoningActionPatternRisk,
  type ZavorthReasoningActionPatternSnapshot,
  type ZavorthReasoningActionPatternStatus,
} from '../contracts/ZavorthReasoningActionPatternContract.js';
import type {
  ZavorthAgentCapabilityAssimilationMatrixItem,
  ZavorthAgentCapabilityAssimilationPolicyRequirement,
  ZavorthAgentCapabilityAssimilationSnapshot,
} from '../contracts/ZavorthAgentCapabilityAssimilationContract.js';
import { ZavorthAgentCapabilityAssimilationService } from './ZavorthAgentCapabilityAssimilationService.js';

type Runtime = {
  now?: () => Date;
  assimilation?: Pick<ZavorthAgentCapabilityAssimilationService, 'buildSnapshot'>;
};

type IntentFlags = {
  rawReasoning: boolean;
  subagents: boolean;
  skills: boolean;
  skillImport: boolean;
  largeAbsorption: boolean;
  perceptionBrowser: boolean;
  perceptionComputer: boolean;
  perceptionDevice: boolean;
  webSearch: boolean;
  workspaceMutation: boolean;
  commandExec: boolean;
  externalSend: boolean;
  sensitiveNetwork: boolean;
  destructive: boolean;
  directAnswer: boolean;
};

const DEFAULT_SURFACES = ['files', 'web', 'skills', 'subagents'] as const;

export class ZavorthReasoningActionPatternService {
  private readonly now: () => Date;
  private readonly assimilation: Pick<ZavorthAgentCapabilityAssimilationService, 'buildSnapshot'>;

  public constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.assimilation = runtime.assimilation || new ZavorthAgentCapabilityAssimilationService({
      now: this.now,
    });
  }

  public plan(input: ZavorthReasoningActionPatternInput): ZavorthReasoningActionPatternSnapshot {
    const generatedAt = this.now().toISOString();
    const text = normalizeText(input.text);
    const normalized = normalizeForMatch(text);
    const flags = inferIntent(normalized);
    const surfaces = normalizeSurfaces(input.availableSurfaces);
    const matrix = this.assimilation.buildSnapshot();
    const selectedMatrixItems = selectMatrixItems(matrix, flags);
    const actions = buildActions({
      flags,
      text,
      surfaces,
      approvalId: normalizeNullable(input.approvalId),
      ownerConfirmed: input.ownerConfirmed === true,
    });
    const blockedActions = buildBlockedActions(actions);
    const approvalRequests = buildApprovalRequests(actions);
    const evidence = buildEvidence({
      text,
      selectedMatrixItems,
      flags,
      surfaces,
    });
    const status = resolveStatus({
      actions,
      blockedActions,
      approvalRequests,
    });
    const reasoningBlocks = buildReasoningBlocks({
      status,
      actions,
      evidence,
      blockedActions,
      approvalRequests,
      flags,
    });
    const receipts = buildReceipts({
      status,
      actions,
      blockedActions,
      approvalRequests,
    });
    const summary = summarize(actions, evidence, receipts);

    return {
      generatedAt,
      contractVersion: ZAVORTH_REASONING_ACTION_PATTERN_CONTRACT_VERSION,
      source: 'ZavorthReasoningActionPatternService',
      phase: 'phase-2-reasoning-action-patterns',
      status,
      request: {
        surface: normalizeSurface(input.surface),
        actorId: normalizeNullable(input.actorId),
        textPreview: preview(text),
        rawSecretsSerialized: false,
      },
      selectedMatrixItems,
      evidence,
      actions,
      approvalRequests,
      blockedActions,
      reasoningBlocks,
      receipts,
      safety: {
        compactReasoningOnly: true,
        rawReasoningSerialized: false,
        noExternalPromptsCopied: true,
        noExternalSourceCodeCopied: true,
        policyBrokerRequiredForImpact: true,
        untrustedContentMustBeDelimited: true,
        mutationRequiresApproval: true,
        visualChangesRequireOwnerApproval: true,
      },
      recovery: {
        boundedRetries: 2,
        retryOnlyWhenEvidenceChanges: true,
        askUserWhenAmbiguous: true,
        rollbackRequiredForMutation: true,
        summarizeBeforeContinuingAfterFailure: true,
      },
      summary,
      commands: {
        report: 'npx tsx scripts/zavorth-reasoning-action-patterns.ts --text "<request>"',
        json: 'npx tsx scripts/zavorth-reasoning-action-patterns.ts --json --text "<request>"',
        check: 'node scripts/zavorth-reasoning-action-patterns-check.mjs',
        nextPhase: 'Phase 3 - Context Memory And Error Recovery Assimilation',
      },
      narrative: buildNarrative(status, summary),
    };
  }

  public formatPlanText(snapshot: ZavorthReasoningActionPatternSnapshot = this.plan({
    text: 'responder com seguranca',
  })): string {
    const lines = [
      'Zavorth Reasoning And Action Patterns - Phase 2',
      '',
      `Status: ${snapshot.status}`,
      `Actions: ${snapshot.summary.actions} | allowed=${snapshot.summary.allowed} | approval=${snapshot.summary.approvalRequired} | denied=${snapshot.summary.denied}`,
      `Evidence: ${snapshot.summary.evidence} | receipts=${snapshot.summary.receipts}`,
      '',
      'Compact plan:',
      ...findBlock(snapshot.reasoningBlocks, 'compact_plan').lines.map((line) => `- ${line}`),
      '',
      'Actions:',
      ...snapshot.actions.map((action) => `- ${action.title}: ${action.decision} | ${action.summary}`),
    ];
    if (snapshot.blockedActions.length > 0) {
      lines.push('', 'Blocked:');
      for (const block of snapshot.blockedActions) lines.push(`- ${block.reason} -> ${block.replacement}`);
    }
    if (snapshot.approvalRequests.length > 0) {
      lines.push('', 'Approvals:');
      for (const approval of snapshot.approvalRequests) lines.push(`- ${approval.reason}`);
    }
    lines.push('', `Next: ${snapshot.commands.nextPhase}`);
    return lines.join('\n');
  }
}

function buildActions(input: {
  flags: IntentFlags;
  text: string;
  surfaces: string[];
  approvalId: string | null;
  ownerConfirmed: boolean;
}): ZavorthReasoningActionPatternAction[] {
  const actions: ZavorthReasoningActionPatternAction[] = [];
  const add = (action: Omit<ZavorthReasoningActionPatternAction, 'id'>) => {
    const duplicate = actions.find((item) => item.kind === action.kind && item.target === action.target);
    if (!duplicate) actions.push({ ...action, id: `action-${actions.length + 1}` });
  };

  if (input.flags.rawReasoning) {
    add(action('raw_reasoning', 'deny', 'forbidden', 'Raw reasoning request', 'Raw internal reasoning is never serialized; provide compact plan, evidence and receipts instead.', null, false, true, ['no-raw-chain-of-thought', 'receipt']));
  }
  if (input.flags.destructive) {
    add(action('command_exec', 'deny', 'forbidden', 'Destructive host operation', 'Destructive, exfiltrating or host-compromising commands are blocked by policy.', 'host', false, false, ['policy-broker', 'approval', 'workspace-boundary', 'receipt']));
  }
  if (input.flags.subagents) {
    add(action('spawn_subagent', 'allow_readonly', 'review', 'Governed subagents', 'Spawn read-only workers for analysis, research or review when the user asks for agents.', 'subagents', true, true, ['policy-broker', 'receipt']));
  }
  if (input.flags.skills) {
    const decision = input.flags.skillImport ? 'require_approval' : 'allow_readonly';
    add(action('use_skill', decision, decision === 'require_approval' ? 'review' : 'safe', 'Governed skill use', input.flags.skillImport ? 'Preview and materialize skills only through allowlists, provenance and approval.' : 'Use approved skill instructions as governed context, not executable code.', 'skill-library', true, true, ['untrusted-content', 'receipt', ...(decision === 'require_approval' ? ['approval'] as const : [])]));
  }
  if (input.flags.largeAbsorption) {
    add(action('absorb_skill', 'allow_readonly', 'review', 'Large skill absorption preview', 'Break large skill libraries into chunks, batches and quarantine without live import by default.', 'skill-library/imported', true, true, ['untrusted-content', 'receipt']));
  }
  if (input.flags.webSearch) {
    const decision = input.flags.sensitiveNetwork ? 'require_approval' : 'allow_readonly';
    add(action('web_search', decision, decision === 'require_approval' ? 'dangerous' : 'safe', 'Web evidence', input.flags.sensitiveNetwork ? 'Sensitive network targets require policy review before fetch.' : 'Fetch public web evidence through safe fetch and untrusted-content boundaries.', 'web', true, true, ['egress-guard', 'untrusted-content', 'receipt', ...(decision === 'require_approval' ? ['approval'] as const : [])]));
  }
  if (input.flags.perceptionBrowser) {
    add(action('observe_browser', hasSurface(input.surfaces, 'browser') ? 'allow_readonly' : 'setup_required', 'review', 'Browser vision', 'Observe browser state when configured; clicking or typing remains approval-gated.', 'browser', true, true, ['policy-broker', 'receipt']));
  }
  if (input.flags.perceptionComputer) {
    add(action('observe_computer', hasSurface(input.surfaces, 'computer') ? 'allow_readonly' : 'setup_required', 'review', 'Computer vision', 'Observe desktop state when configured; UI mutation remains approval-gated.', 'computer', true, true, ['policy-broker', 'redaction', 'receipt']));
  }
  if (input.flags.perceptionDevice) {
    add(action('observe_device', hasSurface(input.surfaces, 'android') ? 'allow_readonly' : 'setup_required', 'review', 'Device vision', 'Use ADB read-only observation when configured; taps and input remain approval-gated.', 'android', true, true, ['policy-broker', 'redaction', 'receipt']));
  }
  if (input.flags.workspaceMutation) {
    add(action('workspace_write', input.approvalId || input.ownerConfirmed ? 'allow' : 'require_approval', 'review', 'Workspace mutation', 'Draft reversible workspace changes with rollback and require owner approval before applying.', 'workspace', true, false, ['policy-broker', 'approval', 'workspace-boundary', 'receipt']));
  }
  if (input.flags.commandExec) {
    add(action('command_exec', input.approvalId || input.ownerConfirmed ? 'allow' : 'require_approval', 'dangerous', 'Command execution', 'Run commands only after policy review, scoped target and receipts.', 'shell', false, false, ['policy-broker', 'approval', 'workspace-boundary', 'receipt']));
  }
  if (input.flags.externalSend) {
    add(action('external_send', input.approvalId || input.ownerConfirmed ? 'allow' : 'require_approval', 'dangerous', 'External effect', 'Sending, posting, deploying or messaging requires explicit approval and channel receipts.', 'external-surface', false, false, ['policy-broker', 'approval', 'egress-guard', 'receipt']));
  }
  if (actions.length === 0 || input.flags.directAnswer) {
    add(action('answer', 'allow', 'safe', 'Direct answer', 'Answer directly with compact reasoning, visible evidence and no hidden chain-of-thought.', null, true, true, ['receipt']));
  }

  return actions;
}

function action(
  kind: ZavorthReasoningActionPatternActionKind,
  decision: ZavorthReasoningActionPatternDecision,
  risk: ZavorthReasoningActionPatternRisk,
  title: string,
  summary: string,
  target: string | null,
  reversible: boolean,
  readOnly: boolean,
  policyRequirements: readonly ZavorthAgentCapabilityAssimilationPolicyRequirement[],
): Omit<ZavorthReasoningActionPatternAction, 'id'> {
  return {
    kind,
    decision,
    risk,
    title,
    summary,
    target,
    reversible,
    readOnly,
    policyRequirements: [...policyRequirements],
  };
}

function buildBlockedActions(actions: ZavorthReasoningActionPatternAction[]): ZavorthReasoningActionPatternBlock[] {
  return actions
    .filter((actionItem) => actionItem.decision === 'deny')
    .map((actionItem, index) => ({
      id: `block-${index + 1}`,
      actionId: actionItem.id,
      reason: actionItem.kind === 'raw_reasoning'
        ? 'Raw internal reasoning request denied.'
        : 'Forbidden impact denied by policy.',
      replacement: actionItem.kind === 'raw_reasoning'
        ? 'Return compact plan, evidence, assumptions, approvals and receipts.'
        : 'Offer safe analysis, dry-run, rollback plan or ask for a safer target.',
      policyRequirements: actionItem.policyRequirements,
    }));
}

function buildApprovalRequests(actions: ZavorthReasoningActionPatternAction[]): ZavorthReasoningActionPatternApprovalRequest[] {
  return actions
    .filter((actionItem) => actionItem.decision === 'require_approval')
    .map((actionItem, index) => ({
      id: `approval-${index + 1}`,
      actionId: actionItem.id,
      reason: `${actionItem.title} requires owner approval before live impact.`,
      requiredBefore: approvalBoundary(actionItem.kind),
    }));
}

function approvalBoundary(kind: ZavorthReasoningActionPatternActionKind): ZavorthReasoningActionPatternApprovalRequest['requiredBefore'] {
  if (kind === 'workspace_write') return 'workspace-mutation';
  if (kind === 'command_exec') return 'command-exec';
  if (kind === 'use_skill' || kind === 'absorb_skill') return 'live-import';
  if (kind === 'web_search') return 'sensitive-network';
  return 'external-effect';
}

function buildEvidence(input: {
  text: string;
  selectedMatrixItems: ZavorthReasoningActionPatternSnapshot['selectedMatrixItems'];
  flags: IntentFlags;
  surfaces: string[];
}): ZavorthReasoningActionPatternEvidence[] {
  const evidence: ZavorthReasoningActionPatternEvidence[] = [
    {
      id: 'evidence-request',
      source: 'request',
      summary: `Request preview: ${preview(input.text) || 'empty request'}.`,
      trusted: true,
      untrustedContent: false,
    },
  ];
  for (const item of input.selectedMatrixItems.slice(0, 6)) {
    evidence.push({
      id: `evidence-matrix-${item.id}`,
      source: 'assimilation-matrix',
      summary: `${item.nativeName} supplies the safe pattern for ${item.category}.`,
      trusted: true,
      untrustedContent: false,
    });
  }
  if (input.flags.webSearch || input.flags.skills) {
    evidence.push({
      id: 'evidence-untrusted-boundary',
      source: 'policy',
      summary: 'Web and imported skill content must be wrapped as untrusted evidence.',
      trusted: true,
      untrustedContent: false,
    });
  }
  evidence.push({
    id: 'evidence-capability-surfaces',
    source: 'capability',
    summary: `Available read surfaces: ${input.surfaces.join(', ') || 'none'}.`,
    trusted: true,
    untrustedContent: false,
  });
  return evidence;
}

function buildReasoningBlocks(input: {
  status: ZavorthReasoningActionPatternStatus;
  actions: ZavorthReasoningActionPatternAction[];
  evidence: ZavorthReasoningActionPatternEvidence[];
  blockedActions: ZavorthReasoningActionPatternBlock[];
  approvalRequests: ZavorthReasoningActionPatternApprovalRequest[];
  flags: IntentFlags;
}): ZavorthReasoningActionPatternReasoningBlock[] {
  const allowed = input.actions.filter((item) => item.decision === 'allow' || item.decision === 'allow_readonly');
  const setup = input.actions.filter((item) => item.decision === 'setup_required');
  return [
    block('compact-plan', 'compact_plan', 'Compact plan', [
      'Classify the request into safe read-only work, approval-gated impact and denied behavior.',
      'Use approved Zavorth-native patterns only; never serialize hidden reasoning.',
      input.status === 'ready' ? 'Proceed with allowed read-only or direct actions.' : 'Stop at the required approval, setup or block before impact.',
    ]),
    block('evidence-summary', 'evidence', 'Evidence', input.evidence.slice(0, 6).map((item) => item.summary)),
    block('allowed-actions', 'allowed_actions', 'Allowed actions', allowed.length > 0
      ? allowed.map((item) => `${item.title}: ${item.summary}`)
      : ['No live action is allowed until the blocking condition is resolved.']),
    block('blocked-actions', 'blocked_actions', 'Blocked actions', [
      ...input.blockedActions.map((item) => `${item.reason} Replacement: ${item.replacement}`),
      ...input.approvalRequests.map((item) => `${item.reason}`),
      ...setup.map((item) => `${item.title} needs setup before use.`),
    ].filter(Boolean).slice(0, 8)),
    block('verification', 'verification', 'Verification', [
      'Run targeted checks that match the planned surface before declaring completion.',
      input.flags.workspaceMutation || input.flags.commandExec ? 'For mutation or commands, capture rollback and command/test receipts.' : 'For read-only work, cite evidence and state remaining uncertainty.',
    ]),
    block('recovery', 'recovery', 'Recovery', [
      'Retry at most twice and only when new evidence changes the expected result.',
      'If ambiguity remains, ask the user instead of guessing.',
      'After a failed tool call, summarize what failed and choose a safer route.',
    ]),
  ];
}

function block(
  id: string,
  kind: ZavorthReasoningActionPatternReasoningBlock['kind'],
  title: string,
  lines: string[],
): ZavorthReasoningActionPatternReasoningBlock {
  return {
    id,
    kind,
    title,
    lines: lines.length > 0 ? lines : ['n/a'],
    rawReasoning: false,
  };
}

function buildReceipts(input: {
  status: ZavorthReasoningActionPatternStatus;
  actions: ZavorthReasoningActionPatternAction[];
  blockedActions: ZavorthReasoningActionPatternBlock[];
  approvalRequests: ZavorthReasoningActionPatternApprovalRequest[];
}): ZavorthReasoningActionPatternReceipt[] {
  const receipts: ZavorthReasoningActionPatternReceipt[] = [
    {
      id: 'receipt-phase-2',
      kind: 'phase-2-pattern-plan',
      status: 'recorded',
      summary: `Reasoning/action pattern plan built with status ${input.status}.`,
      actionIds: input.actions.map((item) => item.id),
    },
    {
      id: 'receipt-no-raw-reasoning',
      kind: 'no-raw-reasoning',
      status: input.blockedActions.some((item) => item.reason.includes('Raw internal')) ? 'blocked' : 'recorded',
      summary: 'Only compact plan, evidence and receipts are serializable.',
      actionIds: input.actions.filter((item) => item.kind === 'raw_reasoning').map((item) => item.id),
    },
    {
      id: 'receipt-recovery-policy',
      kind: 'recovery-policy',
      status: 'recorded',
      summary: 'Bounded retry, user clarification and rollback requirements are attached.',
      actionIds: [],
    },
  ];
  for (const approval of input.approvalRequests) {
    receipts.push({
      id: `receipt-${approval.id}`,
      kind: 'approval-request',
      status: 'requires-approval',
      summary: approval.reason,
      actionIds: [approval.actionId],
    });
  }
  for (const blocked of input.blockedActions) {
    receipts.push({
      id: `receipt-${blocked.id}`,
      kind: 'blocked-action',
      status: 'blocked',
      summary: blocked.reason,
      actionIds: [blocked.actionId],
    });
  }
  return receipts;
}

function resolveStatus(input: {
  actions: ZavorthReasoningActionPatternAction[];
  blockedActions: ZavorthReasoningActionPatternBlock[];
  approvalRequests: ZavorthReasoningActionPatternApprovalRequest[];
}): ZavorthReasoningActionPatternStatus {
  const allDenied = input.actions.length > 0 && input.actions.every((item) => item.decision === 'deny');
  const forbiddenCommand = input.actions.some((item) => item.decision === 'deny' && item.kind === 'command_exec');
  if (allDenied || forbiddenCommand) return 'blocked';
  if (input.approvalRequests.length > 0) return 'approval-required';
  if (input.actions.some((item) => item.decision === 'setup_required')) return 'needs-setup';
  if (input.blockedActions.length > 0) return 'ready';
  return 'ready';
}

function summarize(
  actions: ZavorthReasoningActionPatternAction[],
  evidence: ZavorthReasoningActionPatternEvidence[],
  receipts: ZavorthReasoningActionPatternReceipt[],
): ZavorthReasoningActionPatternSnapshot['summary'] {
  return {
    actions: actions.length,
    allowed: actions.filter((item) => item.decision === 'allow' || item.decision === 'allow_readonly').length,
    approvalRequired: actions.filter((item) => item.decision === 'require_approval').length,
    setupRequired: actions.filter((item) => item.decision === 'setup_required').length,
    denied: actions.filter((item) => item.decision === 'deny').length,
    evidence: evidence.length,
    receipts: receipts.length,
  };
}

function buildNarrative(
  status: ZavorthReasoningActionPatternStatus,
  summary: ZavorthReasoningActionPatternSnapshot['summary'],
): ZavorthReasoningActionPatternSnapshot['narrative'] {
  if (status === 'blocked') {
    return {
      headline: 'Unsafe action blocked',
      operatorSummary: 'The request included behavior that must not be executed, but a safe replacement path is available.',
      nextAction: 'Use compact plan, evidence, dry-run, rollback planning or ask the user for a safer target.',
    };
  }
  if (status === 'approval-required') {
    return {
      headline: 'Approval required before impact',
      operatorSummary: `${summary.approvalRequired} action(s) require owner approval before workspace, command or external impact.`,
      nextAction: 'Ask for approval with the receipt details, then re-plan with approvalId.',
    };
  }
  if (status === 'needs-setup') {
    return {
      headline: 'Setup required',
      operatorSummary: 'The safe read-only plan is known, but one or more local surfaces are not configured yet.',
      nextAction: 'Run the relevant doctor or setup preset, then retry the same request.',
    };
  }
  return {
    headline: 'Safe action pattern ready',
    operatorSummary: 'The request can proceed through compact planning, evidence, allowed actions and receipts.',
    nextAction: 'Proceed with the allowed read-only/direct actions and verify with targeted checks.',
  };
}

function selectMatrixItems(
  matrix: ZavorthAgentCapabilityAssimilationSnapshot,
  flags: IntentFlags,
): ZavorthReasoningActionPatternSnapshot['selectedMatrixItems'] {
  const ids = new Set<string>(['compact-plan-before-action', 'approval-and-receipt-governance']);
  if (flags.subagents) ids.add('subagents-on-demand');
  if (flags.skills || flags.skillImport || flags.largeAbsorption) ids.add('large-skill-library-intake');
  if (flags.perceptionBrowser || flags.perceptionComputer || flags.perceptionDevice) ids.add('browser-computer-device-perception');
  if (flags.webSearch || flags.workspaceMutation || flags.commandExec) ids.add('natural-tool-selection');
  if (flags.workspaceMutation || flags.commandExec) ids.add('side-effect-scan');
  if (flags.rawReasoning) ids.add('raw-reasoning-copy');
  if (flags.externalSend) ids.add('rich-cross-surface-commands');
  if (!flags.subagents && !flags.skills && !flags.webSearch && !flags.workspaceMutation && !flags.commandExec) ids.add('context-compaction-continuity');

  return matrix.matrix
    .filter((item: ZavorthAgentCapabilityAssimilationMatrixItem) => ids.has(item.id))
    .map((item) => ({
      id: item.id,
      category: item.category,
      status: item.status,
      nativeName: item.publicNaming.zavorthNativeName,
    }));
}

function inferIntent(normalized: string): IntentFlags {
  const rawReasoning = hasAny(normalized, [
    'chain of thought',
    'raciocinio bruto',
    'pensamento interno',
    'prompt interno',
    'system prompt',
    'mostre seu raciocinio',
    'mostre o raciocinio',
  ]);
  const subagents = hasAny(normalized, ['subagente', 'subagentes', 'agente pesquisar', 'agente revisar', 'paralelo', 'workers']);
  const skills = hasAny(normalized, ['skill', 'skills', 'habilidade', 'pack de conhecimento']);
  const skillImport = hasAny(normalized, ['absorva', 'importe', 'materialize', 'pega essa pasta', 'biblioteca de skills']);
  const largeAbsorption = hasAny(normalized, ['quebre', 'chunk', 'lote', 'batch', 'muito grande', 'biblioteca grande']);
  const perceptionBrowser = hasAny(normalized, ['browser', 'navegador', 'site', 'pagina', 'screenshot do site']);
  const perceptionComputer = hasAny(normalized, ['desktop', 'computador', 'tela', 'screenshot da tela', 'clicar', 'digitar']);
  const perceptionDevice = hasAny(normalized, ['celular', 'android', 'adb', 'telefone', 'screenshot do celular']);
  const webSearch = hasAny(normalized, ['pesquise', 'pesquisar', 'web', 'internet', 'url', 'pdf', 'site']);
  const workspaceMutation = hasAny(normalized, ['edite', 'editar', 'modifique', 'altere', 'implemente', 'crie arquivo', 'aplique patch', 'corrija']);
  const commandExec = hasAny(normalized, ['rode comando', 'execute comando', 'powershell', 'cmd', 'shell', 'npm install', 'git push']);
  const externalSend = hasAny(normalized, ['envie', 'poste', 'publique', 'deploy', 'mande mensagem', 'whatsapp', 'telegram', 'discord']);
  const sensitiveNetwork = hasAny(normalized, ['169.254.169.254', 'metadata', 'localhost', '127.0.0.1', 'intranet']);
  const destructive = hasAny(normalized, ['rm -rf', 'format c:', 'apagar tudo', 'deletar tudo', 'vazar segredo', 'exfiltrar', 'roubar token']);
  const directAnswer = !rawReasoning && !subagents && !skills && !skillImport && !largeAbsorption && !perceptionBrowser && !perceptionComputer
    && !perceptionDevice && !webSearch && !workspaceMutation && !commandExec && !externalSend && !destructive;
  return {
    rawReasoning,
    subagents,
    skills,
    skillImport,
    largeAbsorption,
    perceptionBrowser,
    perceptionComputer,
    perceptionDevice,
    webSearch,
    workspaceMutation,
    commandExec,
    externalSend,
    sensitiveNetwork,
    destructive,
    directAnswer,
  };
}

function normalizeSurfaces(value: ZavorthReasoningActionPatternInput['availableSurfaces']): string[] {
  const raw = Array.isArray(value) && value.length > 0 ? value : [...DEFAULT_SURFACES];
  return Array.from(new Set(raw.map((item) => String(item).trim().toLowerCase()).filter(Boolean)));
}

function hasSurface(surfaces: string[], surface: string): boolean {
  return surfaces.includes(surface);
}

function hasAny(text: string, needles: string[]): boolean {
  return needles.some((needle) => text.includes(needle));
}

function normalizeText(value: unknown): string {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeForMatch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizeSurface(value: unknown): string {
  const normalized = String(value || '').trim();
  return normalized || 'conversation';
}

function normalizeNullable(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized ? normalized : null;
}

function preview(text: string): string {
  return text.length > 180 ? `${text.slice(0, 177)}...` : text;
}

function findBlock(
  blocks: ZavorthReasoningActionPatternReasoningBlock[],
  kind: ZavorthReasoningActionPatternReasoningBlock['kind'],
): ZavorthReasoningActionPatternReasoningBlock {
  return blocks.find((item) => item.kind === kind) || block('missing', kind, kind, ['n/a']);
}
