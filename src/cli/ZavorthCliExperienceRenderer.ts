import { ZavorthSelfHealingUxService } from '../services/ZavorthSelfHealingUxService.js';
import type {
  ExperienceActionCard,
  ExperienceCommandResult,
  ExperienceDiffReview,
  ExperienceLearningCandidate,
  ExperienceSnapshot,
} from '../services/experience/ExperienceContracts.js';

import { formatZavorthSelfHealingProjection } from './ZavorthCliSelfHealingRenderer.js';
import { renderCliScreen, type CliVisualPanel } from './ZavorthCliVisualSystem.js';
import { formatCliValue, formatCount, sanitizeHumanCliText } from './ZavorthCliText.js';
import { paintCliDivider, paintCliTone } from './ZavorthCliVisualTheme.js';

function formatBudgetNumber(value: number | null | undefined): string {
  return formatCliValue(typeof value === 'number' && Number.isFinite(value) ? String(value) : 'n/a');
}

function renderLearning(candidates: ExperienceLearningCandidate[]): string[] {
  if (!candidates.length) {
    return ['No pending learning. Zavorth will suggest candidates after reliable runs.'];
  }
  return candidates.slice(0, 5).map((candidate) =>
    `${candidate.state} | ${candidate.id} | ${sanitizeHumanCliText(candidate.title)} (${Math.round(candidate.confidence * 100)}%)`);
}

function renderActionCards(cards: ExperienceActionCard[] = []): string[] {
  if (!cards.length) {
    return ['No pending actions. Important items appear here with risk, scope and command.'];
  }
  return cards.slice(0, 6).flatMap((card, index) => {
    const actions = card.actions.filter((item) => item.command).slice(0, 3);
    return [
      `[${index + 1}] ${card.status} | ${card.risk} | ${sanitizeHumanCliText(card.title)}`,
      `    scope: ${sanitizeHumanCliText(card.scope || 'workspace')} | sandbox: ${sanitizeHumanCliText(card.sandbox || 'governed')}`,
      ...actions.map((action) => `    ${normalizeActionLabel(action.label)} -> ${action.command}`),
    ];
  });
}

function normalizeActionLabel(label: string): string {
  const normalized = sanitizeHumanCliText(label);
  return normalized;
}

function renderDiffReviews(reviews: ExperienceDiffReview[] = []): string[] {
  if (!reviews.length) {
    return ['No sandbox diff available for review.'];
  }
  return reviews.slice(0, 4).flatMap((review) => [
    `${review.status} | ${review.risk} | ${sanitizeHumanCliText(review.summary)} (${review.id})`,
    review.recomposition?.summary ? `  recomposition: ${sanitizeHumanCliText(review.recomposition.summary)}` : '',
    ...review.files.slice(0, 5).map((file) =>
      `  ${file.path} | +${file.addedLines}/-${file.removedLines} | ${formatCount(file.hunks.length, 'hunk')}`),
    ...review.files.slice(0, 2).flatMap((file) =>
      file.hunks.slice(0, 3).map((hunk) =>
        `    ${hunk.id} | ${hunk.risk} | ${sanitizeHumanCliText(hunk.header)} -> approve-hunk/reject-hunk`)),
  ]);
}

function renderReasoning(snapshot: ExperienceSnapshot): string[] {
  const summary = snapshot.reasoningSummary;
  if (!summary) return ['Safe summary is unavailable in this snapshot version.'];
  return [
    `Understood: ${sanitizeHumanCliText(summary.understood)}`,
    `Risk: ${summary.risk}`,
    `Tools: ${summary.tools.length ? summary.tools.join(', ') : 'no tools announced'}`,
    summary.approvalReason ? `Approval: ${sanitizeHumanCliText(summary.approvalReason)}` : 'Approval: not required right now',
    `Next: ${sanitizeHumanCliText(summary.nextAction)}`,
  ];
}

function renderLlmBrain(snapshot: ExperienceSnapshot): string[] {
  const brain = snapshot.llmBrain;
  if (!brain) {
    return ['No model loop snapshot yet. Start a model-backed run to populate this view.'];
  }
  return [
    `${brain.status} | ${brain.brainMode}`,
    `Session: ${brain.session.sessionId} | events ${brain.session.serializedEvents} | stream ${brain.streaming.visualStreamingReady ? 'ready' : 'pending'}`,
    `Tools: exposed ${brain.toolAgency.toolsExposed.length} | requested ${brain.toolAgency.requested} | executed ${brain.toolAgency.executed} | deferred ${brain.toolAgency.sideEffectsDeferred}`,
    `Provider tools: ${brain.providerNativeCapabilities.summary}`,
    `Harness: ${brain.harnessRuntime.mode} | sandbox runs ${brain.harnessRuntime.speculativeSandboxRuns} | backend plans ${brain.harnessRuntime.terminalBackendPlans}`,
    `Skill evolution: ${brain.skillEvolution.status} / ${brain.skillEvolution.candidateKind}`,
    `Adapters: ${brain.adapterCoverage.longTailFamilies.length} families proof-gated | live QA ${brain.qa.requiresHumanLiveQa ? 'needed' : 'clear'}`,
  ];
}

function renderAgentMaturity(snapshot: ExperienceSnapshot): string[] {
  const maturity = snapshot.agentMaturity;
  if (!maturity) {
    return ['Agent maturity snapshot is not available yet.'];
  }
  return [
    `Session: ${maturity.session.mode} | continuity ${maturity.session.continuity}`,
    `Gateway: ${maturity.gateway.policy} | provider tools ${maturity.gateway.providerNativeTools}`,
    `Execution: ${maturity.execution.strategy} | ${maturity.execution.preferredBackends.slice(0, 3).join(', ')}`,
    `Learning: ${maturity.learning.mode} | consent ${maturity.learning.userConsentRequired ? 'required' : 'not required'}`,
    `Subagents: ${maturity.subagents.mode} | isolated ${maturity.subagents.isolationRequired ? 'yes' : 'no'}`,
  ];
}

function renderZavorthPulse(snapshot: ExperienceSnapshot): string[] {
  const pulse = snapshot.daily?.pulse;
  if (!pulse) {
    return [sanitizeHumanCliText(snapshot.daily?.summary || snapshot.health.summary)];
  }
  return [
    sanitizeHumanCliText(pulse.headline),
    sanitizeHumanCliText(pulse.summary),
    `Best next action: ${sanitizeHumanCliText(pulse.bestNextAction.label)}${pulse.bestNextAction.command ? ` -> ${pulse.bestNextAction.command}` : ''}`,
    `Pending: approvals ${pulse.pending.approvals} | learning ${pulse.pending.learning} | evidence ${pulse.pending.receipts}`,
    ...pulse.highlights.slice(0, 3).map((item) => `+ ${sanitizeHumanCliText(item)}`),
    ...pulse.risks.slice(0, 3).map((item) => `! ${sanitizeHumanCliText(item)}`),
  ];
}

function renderResponseProfile(snapshot: ExperienceSnapshot): string[] {
  const profile = snapshot.responseProfile || snapshot.daily?.responseProfile || snapshot.daily?.pulse?.profile;
  if (!profile) {
    return ['Default profile: Dev. Use zavorth ask "use concise/dev/executive/mentor style" to adjust.'];
  }
  return [
    `${profile.label} (${profile.id}) | detail ${profile.defaultDetail}`,
    sanitizeHumanCliText(profile.summary),
    `Structure: ${profile.structure.join(' -> ')}`,
    ...profile.commands.slice(0, 2).map((command) => `Command: ${command}`),
  ];
}

function renderHudShortcuts(snapshot: ExperienceSnapshot): string[] {
  const firstCard = (snapshot.actionCards || [])[0];
  const approveAction = firstCard?.actions.find((action) => /approve|approve/i.test(action.id) && action.command);
  const rejectAction = firstCard?.actions.find((action) => /reject|reject/i.test(action.id) && action.command);
  const firstReview = (snapshot.diffReviews || [])[0];
  return [
    approveAction ? `Y approve first card -> ${approveAction.command}` : 'Y approve first card -> no pending action card',
    rejectAction ? `N reject first card -> ${rejectAction.command}` : 'N reject first card -> no pending action card',
    firstReview ? `D open diff -> zavorth diff ${firstReview.id}` : 'D open diff -> no pending diff',
    'L review learning -> zavorth learn',
    'O open zavorthControl -> zavorth open',
  ];
}

function formatHomeProfileLabel(label: string | null | undefined): string {
  return sanitizeHumanCliText(label || 'Dev');
}

export function formatExperienceHome(snapshot: ExperienceSnapshot): string {
  const pendingActions = snapshot.actionCards || [];
  const pendingApprovals = snapshot.daily?.pendingApprovals ?? snapshot.approvals.filter((approval) => approval.status === 'pending').length;
  const pendingLearning = snapshot.learning.pending || snapshot.daily?.pendingLearning || 0;
  const provider = snapshot.agent.providerLabel || 'not configured';
  const model = snapshot.agent.modelLabel || 'not configured';
  const healthTone = snapshot.health.status === 'ready'
    ? 'success'
    : snapshot.health.status === 'blocked'
      ? 'danger'
      : 'warning';
  const firstActionCard = pendingActions[0] || null;
  const attentionLines = [
    provider === 'not configured' ? 'Provider is not configured. Ask me to connect Gemini, OpenRouter, Ollama or another provider.' : '',
    pendingApprovals > 0 ? `${pendingApprovals} approval(s) pending. I can show risk, scope and evidence preview before you decide.` : '',
    pendingLearning > 0 ? `${pendingLearning} learning item(s) waiting -> zavorth learn` : '',
    snapshot.health.status === 'blocked' ? 'Runtime is blocked. I can inspect the failure and propose a narrow repair.' : '',
    firstActionCard ? `Latest: ${sanitizeHumanCliText(firstActionCard.title)} (${firstActionCard.risk})` : '',
  ].filter(Boolean);
  const panels: CliVisualPanel[] = [
    {
      title: attentionLines.length ? 'Needs attention' : 'Ready',
      tone: attentionLines.length ? 'warning' : healthTone,
      lines: attentionLines.length
        ? attentionLines
        : ['Zavorth is ready. Start with a natural request or open the terminal chat.'],
    },
    {
      title: 'Start',
      tone: 'brand',
      lines: [
        'zavorth ask "review this repo"',
        'zavorth chat',
        'zavorth setup',
        'zavorth open',
      ],
    },
    {
      title: 'More when needed',
      tone: 'muted',
      lines: [
        `Status: zavorth ready | Provider: ${formatCliValue(provider)} | Model: ${formatCliValue(model)}`,
        `Approvals: zavorth approve | Evidence: ${snapshot.receipts.length}`,
        `Style: ${formatHomeProfileLabel(snapshot.responseProfile?.label)} | Details: zavorth inspect`,
        'Full help: zavorth --help',
      ],
    },
    {
      title: 'Agent loop',
      tone: 'neutral',
      lines: renderAgentMaturity(snapshot).slice(0, 4),
    },
  ];

  return renderCliScreen({
    eyebrow: 'Zavorth',
    title: 'ZAVORTH',
    summary: 'Ask naturally. Execute safely. Keep evidence.',
    panels,
    mode: 'hero',
  });
}

export function formatExperienceAgentSession(snapshot: ExperienceSnapshot): string {
  const pendingApprovals = snapshot.daily?.pendingApprovals ?? snapshot.approvals.filter((approval) => approval.status === 'pending').length;
  const firstAction = (snapshot.actionCards || [])[0] || null;
  const firstDiff = (snapshot.diffReviews || [])[0] || null;
  const provider = sanitizeHumanCliText(snapshot.agent.providerLabel || 'not configured');
  const model = sanitizeHumanCliText(snapshot.agent.modelLabel || 'not configured');
  const health = sanitizeHumanCliText(snapshot.health.status || 'unknown');
  const workspace = sanitizeHumanCliText(snapshot.workspace || 'local workspace');
  const sessionId = sanitizeHumanCliText(snapshot.sessionId || 'main');
  const configured = provider !== 'not configured';
  const setupHint = provider === 'not configured'
    ? 'I can start by helping you choose a model.'
    : 'Tell me what you want to inspect, change, explain or automate.';
  const statusTone = health === 'ready' ? 'success' : health === 'blocked' ? 'danger' : 'warning';
  const providerTone = configured ? 'success' : 'warning';
  const modelTone = model !== 'not configured' ? 'success' : 'warning';
  const approvalTone = pendingApprovals > 0 ? 'warning' : 'muted';
  const providerDisplay = configured ? provider : 'missing';
  const modelDisplay = model !== 'not configured' ? model : 'missing';
  const statusLine = [
    renderAgentPill('runtime', health, statusTone),
    renderAgentPill('provider', providerDisplay, providerTone),
    renderAgentPill('model', modelDisplay, modelTone),
    renderAgentPill('approvals', pendingApprovals > 0 ? `${pendingApprovals} pending` : 'clear', approvalTone),
  ].join(paintCliTone('  |  ', 'muted'));
  const guidance = configured
    ? [
      `${paintCliTone('ready:', 'success')} Native tools are available when useful.`,
      'Sensitive actions stay behind policy, approval, sandbox and evidence.',
      'Try: review this repo, explain the gateway, fix failing tests.',
    ]
    : [
      `${paintCliTone('setup needed:', 'warning')} Provider and model are not configured yet.`,
      'Tell me which provider to use, choose a local provider, or paste a key only when I ask for it.',
      'I will keep secrets redacted, test explicitly, and leave setup evidence.',
    ];
  const shortcuts = configured
    ? [
      renderAgentShortcut('ask', 'send a natural request'),
      renderAgentShortcut('approve', pendingApprovals > 0 ? 'review pending governed work' : 'review governed work'),
      renderAgentShortcut('open', 'ZavorthControl'),
      renderAgentShortcut('status', 'runtime health'),
    ]
    : [
      renderAgentShortcut('setup', 'guided provider setup'),
      renderAgentShortcut('providers', 'model routes and fallbacks'),
      renderAgentShortcut('approve', pendingApprovals > 0 ? 'review pending governed work' : 'review governed work'),
      renderAgentShortcut('doctor', 'diagnose local setup'),
    ];
  const timeline = snapshot.timeline || [];
  const activityLines = [
    timeline.length > 0
      ? `timeline ${timeline.slice(-1)[0]?.status || 'active'} ? ${sanitizeHumanCliText(timeline.slice(-1)[0]?.title || 'latest event')}`
      : 'timeline idle',
    firstAction ? `approval ${sanitizeHumanCliText(firstAction.title)} (${firstAction.risk}) -> zavorth approve`
      : pendingApprovals > 0
        ? `approvals ${pendingApprovals} pending -> zavorth approve`
        : 'approvals clear',
    firstDiff ? `diff ${sanitizeHumanCliText(firstDiff.summary)} -> zavorth diff ${firstDiff.id}`
      : 'diff none',
    snapshot.llmBrain?.streaming?.visualStreamingReady ? 'streaming ready; tool calls collapse into progress lines'
      : 'streaming quiet until a model-backed run starts',
  ];
  const header = [
    `${paintCliTone('Zavorth', 'brand')} ${paintCliTone('agent', 'muted')} ${paintCliTone('-', 'muted')} ${paintCliTone('session', 'muted')} ${sessionId}`,
    `${paintCliTone('workspace', 'muted')} ${workspace}`,
    statusLine,
  ].join('\n');
  const intro = [
    `${paintCliTone("Hi, I'm Zavorth.", 'brand')} ${paintCliTone('Say what you want done; I will keep sensitive work behind approval.', 'muted')}`,
    setupHint,
  ].join('\n');
  const brainLines = snapshot.agentMaturity
    ? [
      `gateway ${snapshot.agentMaturity.gateway.policy}`,
      `execution ${snapshot.agentMaturity.execution.strategy}`,
      'learning reversible after successful runs',
    ]
    : [];

  return [
    header,
    '',
    intro,
    '',
    guidance.map((line) => `${paintCliTone('>', 'brand')} ${line}`).join('\n'),
    '',
    renderAgentShortcutPanel(shortcuts),
    '',
    renderAgentActivityPanel(activityLines),
    brainLines.length
      ? [
        '',
        paintCliTone('loop', 'muted'),
        ...brainLines.map((line) => `  ${paintCliTone(line, 'muted')}`),
      ].join('\n')
      : '',
    '',
    paintCliTone(`ready | help /help | quit /exit`, 'muted'),
    paintCliDivider(getAgentSessionWidth()),
  ].filter(Boolean).join('\n');
}

function getAgentSessionWidth(): number {
  const columns = Number(process.stdout?.columns || 0);
  if (!Number.isFinite(columns) || columns <= 0) {
    return 86;
  }
  return Math.max(64, Math.min(86, columns - 2));
}

function renderAgentPill(label: string, value: string, tone: 'brand' | 'neutral' | 'muted' | 'info' | 'success' | 'warning' | 'danger'): string {
  return `${paintCliTone(label, 'muted')} ${paintCliTone(value, tone)}`;
}

function renderAgentShortcut(command: string, detail: string): string {
  return `${paintCliTone(command.padEnd(9), 'brand')} ${paintCliTone(detail, 'muted')}`;
}

function renderAgentShortcutPanel(lines: string[]): string {
  return [
    paintCliTone('quick actions', 'muted'),
    ...lines.map((line) => `  ${line}`),
  ].join('\n');
}

function renderAgentActivityPanel(lines: string[]): string {
  return [
    paintCliTone('live state', 'muted'),
    ...lines.map((line) => `  ${paintCliTone('-', 'muted')} ${sanitizeHumanCliText(line)}`),
  ].join('\n');
}


export function formatExperienceHud(snapshot: ExperienceSnapshot): string {
  const panels: CliVisualPanel[] = [
    {
      title: 'Daily HUD',
      tone: snapshot.daily?.health === 'ready' ? 'success' : 'warning',
      lines: [
        ...renderZavorthPulse(snapshot),
        `Workspace: ${formatCliValue(snapshot.workspace || 'default')}`,
        `Autonomy: ${snapshot.trust.sandbox.mode}`,
      ],
    },
    {
      title: 'Profile',
      tone: 'neutral',
      lines: renderResponseProfile(snapshot),
    },
    {
      title: 'Pending actions',
      tone: (snapshot.actionCards || []).length > 0 ? 'warning' : 'success',
      lines: renderActionCards(snapshot.actionCards),
    },
    {
      title: 'Daily shortcuts',
      tone: 'brand',
      lines: renderHudShortcuts(snapshot),
    },
    {
      title: 'Model loop',
      tone: snapshot.llmBrain?.status === 'blocked'
        ? 'danger'
        : snapshot.llmBrain?.status === 'attention'
          ? 'warning'
          : 'success',
      lines: renderLlmBrain(snapshot),
    },
    {
      title: 'Agent maturity',
      tone: 'neutral',
      lines: renderAgentMaturity(snapshot),
    },
    {
      title: 'Diff review',
      tone: (snapshot.diffReviews || []).some((review) => review.status !== 'empty') ? 'brand' : 'muted',
      lines: renderDiffReviews(snapshot.diffReviews),
    },
    {
      title: 'Auto-healing',
      tone: snapshot.autoHealing?.status === 'failed' || snapshot.autoHealing?.status === 'blocked'
        ? 'danger'
        : snapshot.autoHealing?.status === 'running'
          ? 'warning'
          : 'success',
      lines: [
        `Status: ${snapshot.autoHealing?.status || 'idle'}`,
        `Attempt: ${snapshot.autoHealing?.attempt || 0}/${snapshot.autoHealing?.maxAttempts || 3}`,
        `Validation: ${formatCliValue(snapshot.autoHealing?.validationCommand || 'not detected')}`,
        `Budget: ${Math.round((snapshot.autoHealing?.budget?.elapsedMs || 0) / 1000)}s/${Math.round((snapshot.autoHealing?.budget?.maxElapsedMs || 120000) / 1000)}s | tokens ${formatBudgetNumber(snapshot.autoHealing?.budget?.tokensUsed)}/${formatBudgetNumber(snapshot.autoHealing?.budget?.tokenBudget)}`,
        snapshot.autoHealing?.budget?.cancellable ? `Cancel: ${snapshot.autoHealing.budget.cancelCommand || 'action unavailable'}`
          : 'Cancel: unavailable',
        sanitizeHumanCliText(snapshot.autoHealing?.lastErrorSummary || snapshot.autoHealing?.proposedCorrection || 'No active auto-healing.'),
      ],
    },
    {
      title: 'Context',
      tone: snapshot.contextRecovery?.status === 'needs-selection' ? 'warning' : 'muted',
      lines: snapshot.contextRecovery?.status === 'needs-selection'
        ? [
            sanitizeHumanCliText(snapshot.contextRecovery.question),
            ...snapshot.contextRecovery.options.slice(0, 5).map((option, index) =>
              `${index + 1}. ${sanitizeHumanCliText(option.label)} -> ${option.command}`),
          ]
        : ['No pending ambiguity.'],
    },
    {
      title: 'Safe reasoning',
      tone: 'neutral',
      lines: [
        ...renderReasoning(snapshot),
        'Raw model reasoning stays private; this summary shows decisions, risks and evidence.',
      ],
    },
  ];

  return renderCliScreen({
    eyebrow: 'Daily terminal',
    title: 'Zavorth HUD',
    summary: 'Chat, approvals, diff, sandbox, evidence and learning in one keyboard view.',
    panels,
  });
}

export function formatExperiencePulse(snapshot: ExperienceSnapshot): string {
  const pulse = snapshot.daily?.pulse;
  return renderCliScreen({
    eyebrow: 'Zavorth Pulse',
    title: pulse?.headline || 'Zavorth is ready for the next request',
    summary: pulse?.summary || snapshot.health.summary,
    panels: [
      {
        title: 'Next action',
        tone: pulse?.risks.length ? 'warning' : 'brand',
        lines: pulse
          ? [
              `${sanitizeHumanCliText(pulse.bestNextAction.label)}${pulse.bestNextAction.command ? ` -> ${pulse.bestNextAction.command}` : ''}`,
              pulse.bestNextAction.reason,
            ]
          : ['zavorth ask "<request>"'],
      },
      {
        title: 'Signals',
        tone: 'neutral',
        lines: pulse
          ? [
              `Approvals: ${pulse.pending.approvals}`,
              `Learning: ${pulse.pending.learning}`,
              `Evidence: ${pulse.pending.receipts}`,
              `Profile: ${pulse.profile.label}`,
            ]
          : ['No Pulse available.'],
      },
      {
        title: 'Highlights',
        tone: 'success',
        lines: pulse?.highlights.length ? pulse.highlights.map(sanitizeHumanCliText) : ['No operational highlight right now.'],
      },
      {
        title: 'Risks',
        tone: pulse?.risks.length ? 'warning' : 'success',
        lines: pulse?.risks.length ? pulse.risks.map(sanitizeHumanCliText) : ['No pending risks in Pulse.'],
      },
    ],
    mode: 'compact',
    showWordmark: false,
  });
}

export function formatExperienceDiffs(snapshot: ExperienceSnapshot): string {
  const reviews = snapshot.diffReviews || [];
  const panels: CliVisualPanel[] = reviews.length
    ? reviews.map((review) => ({
        title: review.title,
        tone: review.risk === 'danger' ? 'danger' : review.risk === 'attention' ? 'warning' : 'brand',
        lines: [
          `${review.id} | ${review.status} | ${review.summary}`,
          ...review.files.flatMap((file) => [
            `${file.path} | +${file.addedLines}/-${file.removedLines} | ${formatCount(file.hunks.length, 'hunk')}`,
            ...file.hunks.slice(0, 4).flatMap((hunk) => [
              `  ${hunk.id} | ${hunk.risk} | ${hunk.header}`,
              ...hunk.preview.slice(0, 5).map((line) => `    ${line}`),
            ]),
          ]),
          'Actions: zavorth diff approve <reviewId> | zavorth diff reject-hunk <hunkId> | zavorth diff retry <reviewId>',
        ],
      }))
    : [{
        title: 'Diff review',
        tone: 'muted',
        lines: ['No governed diff was found in the current snapshot.'],
      }];

  return renderCliScreen({
    eyebrow: 'Diff Review',
    title: 'Governed partial review',
    summary: 'No hunk is applied directly to the host: selections recompose a mutation plan and pass policy.',
    panels,
    showWordmark: false,
  });
}

export function formatExperienceCommandResult(result: ExperienceCommandResult): string {
  const replyText = result.replies.map((reply) => sanitizeHumanCliText(reply.text)).filter(Boolean).join('\n\n');
  const actionCards = result.snapshot.actionCards || [];
  const showDiagnostics = process.argv.includes('--debug') || process.argv.includes('--verbose') || process.env.ZAVORTH_DEBUG === '1';
  const visibleActionCards = showDiagnostics || result.plan.requiresApproval || !result.ok
    ? actionCards
    : actionCards.filter((card) =>
      card.source === 'approval'
      || card.risk === 'danger'
      || card.status === 'blocked');
  const hasActionCards = visibleActionCards.length > 0;
  const needsAttention = result.plan.requiresApproval || hasActionCards;
  const nextAction = result.plan.requiresApproval
    ? sanitizeHumanCliText(result.plan.nextSafeAction)
    : hasActionCards ? 'Review the suggested recovery or setup action, then continue in natural language.'
    : 'You can continue with another request.';
  const panels: CliVisualPanel[] = [
    {
      title: 'Answer',
      tone: result.ok ? 'success' : 'danger',
      lines: [replyText || (result.ok ? 'Done.' : result.error || 'The request could not be completed.')],
    },
    {
      title: result.plan.requiresApproval ? 'Needs approval' : needsAttention ? 'Needs attention' : 'Next step',
      tone: result.plan.risk === 'danger' ? 'danger' : result.plan.requiresApproval ? 'warning' : 'brand',
      lines: [
        nextAction,
        result.plan.requiresApproval ? 'Review the action before anything sensitive continues.'
          : hasActionCards ? 'No approval was bypassed; this is guidance or a safe setup step.'
            : 'No approval needed.',
        result.plan.risk !== 'safe' || result.plan.requiresApproval ? `Risk: ${result.plan.risk}` : '',
      ].filter(Boolean),
    },
  ];

  if (showDiagnostics && result.receipts.length > 0) {
    panels.push({
      title: 'Evidence',
      tone: 'muted',
      lines: result.receipts.slice(0, 3).map((receipt) => `${receipt.status} | ${sanitizeHumanCliText(receipt.title)}`),
    });
  } else if (result.receipts.length > 0 && needsAttention) {
    panels.push({
      title: 'Evidence',
      tone: 'muted',
      lines: ['Evidence saved. Use --debug to show details.'],
    });
  }

  if (visibleActionCards.length > 0) {
    panels.push({
      title: visibleActionCards.some((card) => card.source !== 'approval') ? 'Pending actions' : 'Approvals',
      tone: 'warning',
      lines: renderActionCards(visibleActionCards),
    });
  }

  if (result.snapshot.llmBrain && (showDiagnostics || result.snapshot.llmBrain.status !== 'passed')) {
    panels.push({
      title: 'Model loop',
      tone: result.snapshot.llmBrain.status === 'blocked'
        ? 'danger'
        : result.snapshot.llmBrain.status === 'attention'
          ? 'warning'
          : 'neutral',
      lines: renderLlmBrain(result.snapshot),
    });
  }

  if (showDiagnostics) {
    panels.push(
    {
      title: 'Style',
      tone: 'neutral',
      lines: renderResponseProfile(result.snapshot),
    },
    {
      title: 'Why',
      tone: 'neutral',
      lines: [
        ...renderReasoning(result.snapshot),
        'Raw model reasoning stays private.',
      ],
    },
    );
  }

  const rendered = renderCliScreen({
    eyebrow: 'Zavorth',
    title: result.ok ? 'Done' : 'Blocked',
    summary: result.error || 'Request processed safely.',
    panels,
    mode: 'hero',
    showWordmark: false,
  });
  const healing = new ZavorthSelfHealingUxService().buildProjection({
    attempted: result.plan.title,
    commandText: result.plan.summary,
    result,
    snapshot: result.snapshot,
    debug: showDiagnostics,
  });
  if (!healing.shouldRender || (healing.issue === 'none' && result.ok)) {
    return rendered;
  }
  return `${rendered}\n\n${formatZavorthSelfHealingProjection(healing)}`;
}

export function formatExperienceLearning(snapshot: ExperienceSnapshot): string {
  return renderCliScreen({
    eyebrow: 'Learning OS',
    title: 'Governed learning',
    summary: snapshot.learning.summary,
    panels: [
      {
        title: 'Candidates',
        tone: snapshot.learning.pending > 0 ? 'warning' : 'success',
        lines: renderLearning(snapshot.learning.candidates),
      },
      {
        title: 'Commands',
        lines: [
          'zavorth learn approve <id>',
          'zavorth learn reject <id>',
          'zavorth learn promote <id>',
          'zavorth learn export --json',
          'zavorth learn reset',
        ],
      },
    ],
  });
}

