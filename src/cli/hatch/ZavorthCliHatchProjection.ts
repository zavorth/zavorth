import type { ZavorthMutationPlaneService } from '../../services/ZavorthMutationPlaneService.js';
import { buildZavorthCliHomeSnapshot } from '../home/index.js';
import type { ZavorthCliHatchSnapshot, ZavorthCliHatchStatus, ZavorthCliHatchStep } from './ZavorthCliHatchTypes.js';

export type BuildZavorthCliHatchSnapshotInput = {
  projectRoot: string;
  now?: () => Date;
  mutationPlane?: Pick<ZavorthMutationPlaneService, 'listPlans'> | null;
};

export function buildZavorthCliHatchSnapshot(
  input: BuildZavorthCliHatchSnapshotInput,
): ZavorthCliHatchSnapshot {
  const home = buildZavorthCliHomeSnapshot(input);
  const status = resolveHatchStatus(home);
  const approveCommand = home.approvals.pending > 0 ? 'zavorth approve' : null;
  const nextActions = buildNextActions(status, approveCommand);

  return {
    contractVersion: 'zavorth-cli-hatch/1',
    generatedAt: home.generatedAt,
    projectRoot: home.projectRoot,
    status,
    headline: buildHeadline(status),
    home: {
      status: home.status,
      provider: home.provider,
      runtime: home.runtime,
      channels: home.channels,
      approvals: home.approvals,
      safety: home.safety,
    },
    launch: {
      recommended: nextActions[0]?.command || 'zavorth setup',
      terminal: 'zavorth ask "wake up and review this workspace"',
      dashboard: 'zavorth open',
      setup: 'zavorth setup',
      approve: approveCommand,
    },
    firstPrompt: 'wake up, review this workspace and tell me the next safe step',
    checklist: buildChecklist(home),
    guardrails: [
      'Hatch never applies host mutations on its own.',
      'Sensitive actions still pass through policy, preview, approval and receipts.',
      'Secrets and tokens are shown only as present or missing.',
      'Use --start only when you want to delegate to the existing start/go flow.',
    ],
    nextActions,
  };
}

function resolveHatchStatus(home: ReturnType<typeof buildZavorthCliHomeSnapshot>): ZavorthCliHatchStatus {
  if (home.safety.effectBoundary !== 'ready') {
    return 'blocked';
  }
  if (home.approvals.pending > 0) {
    return 'needs_approval';
  }
  if (!home.provider.configured) {
    return 'needs_setup';
  }
  return 'ready';
}

function buildHeadline(status: ZavorthCliHatchStatus): string {
  switch (status) {
    case 'ready':
      return 'Ready to hatch a live terminal session.';
    case 'needs_approval':
      return 'Review pending governed actions before hatching.';
    case 'needs_setup':
      return 'Finish provider setup before the LLM-first flow can hatch.';
    case 'blocked':
      return 'Safety core is incomplete. Run doctor before hatching.';
    default:
      return 'Prepare a governed Zavorth session.';
  }
}

function buildChecklist(home: ReturnType<typeof buildZavorthCliHomeSnapshot>): ZavorthCliHatchStep[] {
  return [
    {
      id: 'safety',
      title: 'Safety core',
      status: home.safety.effectBoundary === 'ready' ? 'ready' : 'blocked',
      detail: `effect boundary ${home.safety.effectBoundary}`,
    },
    {
      id: 'provider',
      title: 'LLM provider',
      status: home.provider.configured ? 'ready' : 'warning',
      detail: home.provider.configured
        ? `${home.provider.id}/${home.provider.model || 'default'}`
        : 'configure provider/model first',
    },
    {
      id: 'dashboard',
      title: 'Command Center',
      status: home.runtime.dashboard === 'available' ? 'ready' : 'warning',
      detail: home.runtime.dashboard === 'available' ? 'available' : 'dashboard source missing',
    },
    {
      id: 'approvals',
      title: 'Governed actions',
      status: home.approvals.pending > 0 ? 'waiting' : 'ready',
      detail: `${home.approvals.pending} pending approval(s)`,
    },
    {
      id: 'channels',
      title: 'Remote channels',
      status: home.channels.telegram === 'ready' || home.channels.discord === 'ready' ? 'ready' : 'warning',
      detail: `telegram ${home.channels.telegram}; discord ${home.channels.discord}`,
    },
  ];
}

function buildNextActions(
  status: ZavorthCliHatchStatus,
  approveCommand: string | null,
): ZavorthCliHatchSnapshot['nextActions'] {
  if (status === 'blocked') {
    return [
      { label: 'Diagnose safety core', command: 'zavorth doctor', detail: 'repair before hatching' },
      { label: 'Show home snapshot', command: 'zavorth home', detail: 'local state only' },
    ];
  }
  if (status === 'needs_setup') {
    return [
      { label: 'Run Setup Studio', command: 'zavorth setup', detail: 'provider, model and trust mode' },
      { label: 'Recheck readiness', command: 'zavorth hatch', detail: 'after setup' },
    ];
  }
  if (status === 'needs_approval' && approveCommand) {
    return [
      { label: 'Review approvals', command: approveCommand, detail: 'clear governed queue first' },
      { label: 'Open Command Center', command: 'zavorth open', detail: 'visual approval flow' },
      { label: 'Hatch after approval', command: 'zavorth hatch', detail: 'recheck session readiness' },
    ];
  }
  return [
    { label: 'Hatch in terminal', command: 'zavorth ask "wake up and review this workspace"', detail: 'natural LLM-first flow' },
    { label: 'Open Command Center', command: 'zavorth open', detail: 'visual control plane' },
    { label: 'Start runtime', command: 'zavorth start', detail: 'delegates to existing start/go flow' },
  ];
}
