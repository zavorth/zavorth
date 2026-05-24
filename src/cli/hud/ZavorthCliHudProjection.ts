import type { ZavorthMutationPlaneService } from '../../services/ZavorthMutationPlaneService.js';
import { buildZavorthCliApprovalDiffSnapshot } from '../approval-diff/ZavorthCliApprovalDiffProjection.js';
import { buildZavorthCliHomeSnapshot } from '../home/ZavorthCliHomeProjection.js';
import type {
  ZavorthCliHudDecision,
  ZavorthCliHudMode,
  ZavorthCliHudShortcut,
  ZavorthCliHudSnapshot,
} from './ZavorthCliHudTypes.js';

export type BuildZavorthCliHudSnapshotInput = {
  projectRoot: string;
  now?: () => Date;
  mode?: ZavorthCliHudMode;
  tty?: boolean;
  targetPlanId?: string | null;
  selectedIndex?: number | null;
  mutationPlane: Pick<ZavorthMutationPlaneService, 'listPlans' | 'readPlan' | 'approvePlan'>;
  decision?: ZavorthCliHudDecision;
};

export function buildZavorthCliHudSnapshot(input: BuildZavorthCliHudSnapshotInput): ZavorthCliHudSnapshot {
  const now = input.now || (() => new Date());
  const home = buildZavorthCliHomeSnapshot({
    projectRoot: input.projectRoot,
    now,
    mutationPlane: input.mutationPlane,
  });
  const approvals = buildZavorthCliApprovalDiffSnapshot({
    projectRoot: input.projectRoot,
    view: 'approvals',
    targetPlanId: input.targetPlanId,
    now,
    mutationPlane: input.mutationPlane,
  });
  const selectedByIndex = typeof input.selectedIndex === 'number' && input.selectedIndex > 0
    ? approvals.cards[input.selectedIndex - 1]?.id || null
    : null;
  const selectedPlanId = input.targetPlanId || selectedByIndex || approvals.cards.find((card) => card.approvalStatus === 'pending')?.id || null;
  const selectedIndex = selectedPlanId ? approvals.cards.findIndex((card) => card.id === selectedPlanId) + 1 : null;
  const planQueue = approvals.cards.map((card, index) => ({
    index: index + 1,
    id: card.id,
    title: card.title,
    status: `${card.status}/${card.approvalStatus}`,
    riskLevel: card.riskLevel,
    diffCount: card.diffCount,
  }));

  return {
    contractVersion: 'zavorth-cli-hud/1',
    generatedAt: now().toISOString(),
    projectRoot: input.projectRoot,
    mode: input.mode || 'snapshot',
    tty: input.tty ?? Boolean(process.stdout?.isTTY && process.stdin?.isTTY),
    home,
    approvals,
    selectedPlanId,
    selectedIndex: selectedIndex && selectedIndex > 0 ? selectedIndex : null,
    planQueue,
    shortcuts: buildHudShortcuts(selectedPlanId, approvals.summary.pending, planQueue.length),
    decision: input.decision || {
      attempted: false,
      key: null,
      status: 'none',
      message: 'HUD ready. Use shortcuts for the next safe action.',
    },
    safety: {
      noHostApply: true,
      approvalRequiresDoubleConfirm: true,
      secretsRedacted: true,
      fallbackTextMode: !(input.tty ?? Boolean(process.stdout?.isTTY && process.stdin?.isTTY)),
    },
  };
}

function buildHudShortcuts(selectedPlanId: string | null, pendingApprovals: number, queueSize: number): ZavorthCliHudShortcut[] {
  return [
    {
      key: '1-9',
      label: 'Select',
      command: 'zavorth hud --select <n>',
      requiresConfirmation: false,
      enabled: queueSize > 0,
      detail: 'choose an approval card by index',
    },
    {
      key: 'h',
      label: 'Home',
      command: 'zavorth',
      requiresConfirmation: false,
      enabled: true,
      detail: 'return to daily status',
    },
    {
      key: 'd',
      label: 'Diff',
      command: selectedPlanId ? `zavorth diff ${selectedPlanId}` : 'zavorth diff',
      requiresConfirmation: false,
      enabled: Boolean(selectedPlanId),
      detail: selectedPlanId ? 'inspect selected mutation preview' : 'no pending plan selected',
    },
    {
      key: 'y',
      label: 'Approve',
      command: selectedPlanId ? `zavorth approve ${selectedPlanId} --yes` : 'zavorth approve',
      requiresConfirmation: true,
      enabled: Boolean(selectedPlanId && pendingApprovals > 0),
      detail: 'double confirm; approval only, never host apply',
    },
    {
      key: 'x',
      label: 'Reject',
      command: selectedPlanId ? `zavorth hud --action reject --plan ${selectedPlanId} --yes` : 'zavorth hud --action reject',
      requiresConfirmation: true,
      enabled: Boolean(selectedPlanId && pendingApprovals > 0),
      detail: 'reject and block this plan with audit',
    },
    {
      key: 's',
      label: 'Defer',
      command: selectedPlanId ? `zavorth hud --action defer --plan ${selectedPlanId} --yes` : 'zavorth hud --action defer',
      requiresConfirmation: true,
      enabled: Boolean(selectedPlanId && pendingApprovals > 0),
      detail: 'keep pending, record a defer receipt',
    },
    {
      key: 'o',
      label: 'Open',
      command: 'zavorth open',
      requiresConfirmation: false,
      enabled: true,
      detail: 'open Command Center',
    },
    {
      key: 'r',
      label: 'Refresh',
      command: 'zavorth hud',
      requiresConfirmation: false,
      enabled: true,
      detail: 'reload live snapshot',
    },
    {
      key: 'q',
      label: 'Quit',
      command: 'quit',
      requiresConfirmation: false,
      enabled: true,
      detail: 'leave HUD',
    },
  ];
}
