import {
  renderPremiumKeyValueTable,
  renderZavorthPremiumCliScreen,
  type ZavorthPremiumCliPanel,
  type ZavorthPremiumCliStep,
} from '../premium/index.js';
import type { ZavorthCliHatchSnapshot, ZavorthCliHatchStatus } from './ZavorthCliHatchTypes.js';

export function renderZavorthCliHatch(snapshot: ZavorthCliHatchSnapshot): string {
  const panels: ZavorthPremiumCliPanel[] = [
    {
      title: 'Launch commands',
      accent: snapshot.status === 'ready' ? 'emerald' : 'amber',
      lines: renderPremiumKeyValueTable([
        { key: 'recommended', value: snapshot.launch.recommended, accent: snapshot.status === 'ready' ? 'emerald' : 'cyan' },
        { key: 'terminal', value: snapshot.launch.terminal, accent: 'cyan' },
        { key: 'zavorthControl', value: snapshot.launch.zavorthControl, accent: 'cyan' },
        { key: 'setup', value: snapshot.launch.setup, accent: snapshot.status === 'needs_setup' ? 'amber' : 'muted' },
      ]).split('\n'),
    },
    {
      title: 'First prompt',
      accent: 'violet',
      lines: [
        `"${snapshot.firstPrompt}"`,
      ],
    },
    {
      title: 'Trust boundaries',
      accent: 'amber',
      lines: snapshot.guardrails.map((guardrail) => `- ${guardrail}`),
    },
  ];

  return renderZavorthPremiumCliScreen({
    title: 'Hatch',
    subtitle: snapshot.headline,
    mode: 'hero',
    steps: snapshot.checklist.map((step): ZavorthPremiumCliStep => ({
      id: step.id,
      title: step.title,
      status: step.status,
      detail: step.detail,
    })),
    statusRows: [
      { label: 'Hatch', value: statusLabel(snapshot.status), status: statusToPremium(snapshot.status) },
      { label: 'Provider', value: snapshot.home.provider.configured ? `${snapshot.home.provider.id}/${snapshot.home.provider.model || 'default'}` : 'missing', status: snapshot.home.provider.configured ? 'ready' : 'warning' },
      { label: 'Approvals', value: `${snapshot.home.approvals.pending} pending`, status: snapshot.home.approvals.pending > 0 ? 'waiting' : 'ready' },
      { label: 'ZavorthControl', value: snapshot.home.runtime.zavorthControl, status: snapshot.home.runtime.zavorthControl === 'available' ? 'ready' : 'warning' },
    ],
    panels,
    actions: snapshot.nextActions.map((action) => ({
      label: action.label,
      command: action.command,
      detail: action.detail,
      accent: action.command === snapshot.launch.recommended ? 'emerald' : 'cyan',
    })),
    notice: {
      title: 'First-run cockpit',
      body: 'Hatch prepares the daily session and shows the safest next move. It does not run tools or write files unless you explicitly choose the next command.',
    },
  });
}

function statusLabel(status: ZavorthCliHatchStatus): string {
  switch (status) {
    case 'ready':
      return 'ready';
    case 'needs_setup':
      return 'needs setup';
    case 'needs_approval':
      return 'needs approval';
    case 'blocked':
      return 'blocked';
    default:
      return 'unknown';
  }
}

function statusToPremium(status: ZavorthCliHatchStatus): 'ready' | 'warning' | 'blocked' | 'waiting' {
  switch (status) {
    case 'ready':
      return 'ready';
    case 'blocked':
      return 'blocked';
    case 'needs_approval':
      return 'waiting';
    default:
      return 'warning';
  }
}
