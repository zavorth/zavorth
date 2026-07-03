import type { ZavorthCliHudDecision, ZavorthCliHudSnapshot } from './ZavorthCliHudTypes.js';
import { renderZavorthCliHud } from './ZavorthCliHudRenderer.js';

export type ZavorthCliGuidedReviewStepStatus = 'done' | 'active' | 'waiting' | 'blocked';

export type ZavorthCliGuidedReviewStep = {
  id: 'select' | 'inspect' | 'diff' | 'validate' | 'decide' | 'receipt';
  title: string;
  status: ZavorthCliGuidedReviewStepStatus;
  summary: string;
  command?: string | null;
};

export type ZavorthCliGuidedReviewSnapshot = {
  contractVersion: 'zavorth-cli-guided-review/1';
  generatedAt: string;
  projectRoot: string;
  selectedPlanId: string | null;
  selectedIndex: number | null;
  pending: number;
  diffEntries: number;
  decision: ZavorthCliHudDecision;
  steps: ZavorthCliGuidedReviewStep[];
  receipt: {
    id: string | null;
    status: ZavorthCliHudDecision['status'];
    summary: string;
    noHostApply: true;
  };
  nextCommands: Array<{
    label: string;
    command: string;
    detail: string;
  }>;
  hud: ZavorthCliHudSnapshot;
};

export function buildZavorthCliGuidedReviewSnapshot(
  hud: ZavorthCliHudSnapshot,
): ZavorthCliGuidedReviewSnapshot {
  const selected = hud.approvals.cards.find((card) => card.id === hud.selectedPlanId) || null;
  const hasDecision = ['approved', 'rejected', 'deferred'].includes(hud.decision.status);
  const hasSelection = Boolean(hud.selectedPlanId);
  const diffCommand = hud.selectedPlanId ? `zavorth diff ${hud.selectedPlanId}` : 'zavorth diff';
  const approveCommand = hud.selectedPlanId ? `zavorth hud guide --action approve --plan ${hud.selectedPlanId} --yes` : 'zavorth hud guide';
  const rejectCommand = hud.selectedPlanId ? `zavorth hud guide --action reject --plan ${hud.selectedPlanId} --yes` : 'zavorth hud guide';
  const deferCommand = hud.selectedPlanId ? `zavorth hud guide --action defer --plan ${hud.selectedPlanId} --yes` : 'zavorth hud guide';

  const steps: ZavorthCliGuidedReviewStep[] = [
    {
      id: 'select',
      title: 'Select plan',
      status: hasSelection ? 'done' : 'active',
      summary: hasSelection
        ? `Selected #${hud.selectedIndex || '?'}: ${selected?.title || hud.selectedPlanId}`
        : 'Choose a pending plan by index before deciding.',
      command: hasSelection ? null : 'zavorth hud guide --select 1',
    },
    {
      id: 'inspect',
      title: 'Inspect scope',
      status: hasSelection ? 'done' : 'waiting',
      summary: selected
        ? `${selected.riskLevel} risk, ${selected.resourceImpact.externalExposure} external exposure, ${selected.readiness.blocked} blocked gates.`
        : 'Waiting for a selected plan.',
      command: null,
    },
    {
      id: 'diff',
      title: 'Review diff',
      status: hasSelection && hud.approvals.summary.diffEntries > 0 ? 'done' : hasSelection ? 'active' : 'waiting',
      summary: hasSelection
        ? `${hud.approvals.summary.diffEntries} diff preview entries available.`
        : 'Waiting for a selected plan.',
      command: hasSelection ? diffCommand : null,
    },
    {
      id: 'validate',
      title: 'Validate safety',
      status: hasSelection ? 'done' : 'waiting',
      summary: selected
        ? `Validation: ${selected.validationPlan.slice(0, 2).join('; ') || 'none declared'}`
        : 'Waiting for a selected plan.',
      command: hasSelection ? 'zavorth doctor' : null,
    },
    {
      id: 'decide',
      title: 'Decide',
      status: hasDecision ? 'done' : hasSelection ? 'active' : 'waiting',
      summary: hasDecision
        ? hud.decision.message
        : 'Approve, reject or defer with explicit confirmation.',
      command: hasSelection ? `${approveCommand} | ${rejectCommand} | ${deferCommand}` : null,
    },
    {
      id: 'receipt',
      title: 'Evidence',
      status: hasDecision ? 'done' : 'waiting',
      summary: hud.decision.receiptId
        ? `Evidence ${hud.decision.receiptId}`
        : 'Evidence appears after approve/reject/defer.',
      command: hud.decision.receiptId ? 'zavorth receipts' : null,
    },
  ];

  return {
    contractVersion: 'zavorth-cli-guided-review/1',
    generatedAt: hud.generatedAt,
    projectRoot: hud.projectRoot,
    selectedPlanId: hud.selectedPlanId,
    selectedIndex: hud.selectedIndex,
    pending: hud.approvals.summary.pending,
    diffEntries: hud.approvals.summary.diffEntries,
    decision: hud.decision,
    steps,
    receipt: {
      id: hud.decision.receiptId || null,
      status: hud.decision.status,
      summary: hasDecision ? hud.decision.message : 'No decision has been applied yet.',
      noHostApply: true,
    },
    nextCommands: buildNextCommands(hud, {
      diffCommand,
      approveCommand,
      rejectCommand,
      deferCommand,
    }),
    hud,
  };
}

export function renderZavorthCliGuidedReview(snapshot: ZavorthCliGuidedReviewSnapshot): string {
  const lines = [
    renderZavorthCliHud(snapshot.hud),
    '',
    'Guided review flow',
    '------------------',
    ...snapshot.steps.map((step) => [
      `${symbolForStep(step.status)} ${step.title}`,
      `  ${step.summary}`,
      step.command ? `  ${step.command}` : null,
    ].filter(Boolean).join('\n')),
    '',
    'Decision evidence',
    `  status: ${snapshot.receipt.status}`,
    `  id: ${snapshot.receipt.id || 'pending'}`,
    `  ${snapshot.receipt.summary}`,
    '  no host apply: true',
    '',
    'Next',
    ...snapshot.nextCommands.map((entry) => `  ${entry.label}: ${entry.command} (${entry.detail})`),
  ];
  return `${lines.join('\n')}\n`;
}

function buildNextCommands(
  hud: ZavorthCliHudSnapshot,
  commands: {
    diffCommand: string;
    approveCommand: string;
    rejectCommand: string;
    deferCommand: string;
  },
): ZavorthCliGuidedReviewSnapshot['nextCommands'] {
  if (!hud.selectedPlanId) {
    return [
      { label: 'Select first plan', command: 'zavorth hud guide --select 1', detail: 'choose target' },
      { label: 'Open zavorthControl', command: 'zavorth open', detail: 'visual review' },
    ];
  }
  if (['approved', 'rejected', 'deferred'].includes(hud.decision.status)) {
    return [
      { label: 'Refresh review', command: 'zavorth hud guide', detail: 'continue queue' },
      { label: 'Open zavorthControl', command: 'zavorth open', detail: 'inspect evidence' },
    ];
  }
  return [
    { label: 'Review diff', command: commands.diffCommand, detail: 'preview only' },
    { label: 'Approve', command: commands.approveCommand, detail: 'approval only' },
    { label: 'Reject', command: commands.rejectCommand, detail: 'block with audit' },
    { label: 'Defer', command: commands.deferCommand, detail: 'keep pending' },
  ];
}

function symbolForStep(status: ZavorthCliGuidedReviewStepStatus): string {
  switch (status) {
    case 'done':
      return 'o';
    case 'active':
      return '>';
    case 'blocked':
      return 'x';
    default:
      return '-';
  }
}
