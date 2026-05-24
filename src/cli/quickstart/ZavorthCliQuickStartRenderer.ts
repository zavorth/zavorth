import {
  renderPremiumKeyValueTable,
  renderZavorthPremiumCliScreen,
  type ZavorthPremiumCliPanel,
  type ZavorthPremiumCliStep,
} from '../premium/index.js';
import type { ZavorthCliQuickStartSnapshot, ZavorthCliQuickStartStatus } from './ZavorthCliQuickStartTypes.js';

export function renderZavorthCliQuickStart(snapshot: ZavorthCliQuickStartSnapshot): string {
  const steps: ZavorthPremiumCliStep[] = snapshot.options.map((option) => ({
    id: option.id,
    title: option.label,
    status: option.status === 'ready'
      ? 'ready'
      : option.status === 'blocked'
        ? 'blocked'
        : option.status === 'recommended'
          ? 'waiting'
          : 'warning',
    detail: `${option.command} - ${option.detail}`,
  }));
  const panels: ZavorthPremiumCliPanel[] = [
    {
      title: 'Provider',
      accent: snapshot.provider.configured ? 'emerald' : 'amber',
      lines: renderPremiumKeyValueTable([
        { key: 'status', value: snapshot.provider.configured ? 'configured' : 'missing', accent: snapshot.provider.configured ? 'emerald' : 'amber' },
        { key: 'provider', value: snapshot.provider.id || 'not configured' },
        { key: 'model', value: snapshot.provider.model || 'not configured' },
        { key: 'setup', value: snapshot.provider.recommendedCommand, accent: 'cyan' },
      ]).split('\n'),
    },
    {
      title: 'Channels',
      accent: snapshot.channels.telegram === 'ready' || snapshot.channels.discord === 'ready' ? 'emerald' : 'cyan',
      lines: renderPremiumKeyValueTable([
        { key: 'telegram', value: snapshot.channels.telegram, accent: snapshot.channels.telegram === 'ready' ? 'emerald' : snapshot.channels.telegram === 'needs-allowlist' ? 'amber' : 'muted' },
        { key: 'discord', value: snapshot.channels.discord, accent: snapshot.channels.discord === 'ready' ? 'emerald' : 'muted' },
        { key: 'setup', value: snapshot.channels.recommendedCommand, accent: 'cyan' },
      ]).split('\n'),
    },
    {
      title: 'Safety',
      accent: snapshot.safety.effectBoundary === 'ready' ? 'emerald' : 'rose',
      lines: [
        `- effect boundary: ${snapshot.safety.effectBoundary}`,
        '- writes require --apply',
        '- secrets are redacted',
        '- runtime is not started by QuickStart',
      ],
    },
  ];

  return renderZavorthPremiumCliScreen({
    title: 'QuickStart',
    subtitle: snapshot.headline,
    mode: 'hero',
    steps,
    statusRows: [
      { label: 'QuickStart', value: statusLabel(snapshot.status), status: statusToPremium(snapshot.status) },
      { label: 'Provider', value: snapshot.provider.configured ? `${snapshot.provider.id}/${snapshot.provider.model || 'default'}` : 'missing', status: snapshot.provider.configured ? 'ready' : 'warning' },
      { label: 'Telegram', value: snapshot.channels.telegram, status: snapshot.channels.telegram === 'ready' ? 'ready' : snapshot.channels.telegram === 'needs-allowlist' ? 'warning' : 'offline' },
      { label: 'Approvals', value: `${snapshot.approvals.pending} pending`, status: snapshot.approvals.pending > 0 ? 'waiting' : 'ready' },
    ],
    panels,
    actions: snapshot.nextActions.map((action) => ({
      label: action.label,
      command: action.command,
      detail: action.detail,
      accent: 'cyan',
    })),
    notice: {
      title: 'Preview-first setup',
      body: 'Provider and channel commands preview by default. Add --apply only when you are ready to write the local .env.',
    },
  });
}

function statusLabel(status: ZavorthCliQuickStartStatus): string {
  return status.replace(/_/g, ' ');
}

function statusToPremium(status: ZavorthCliQuickStartStatus): 'ready' | 'warning' | 'blocked' | 'waiting' {
  if (status === 'ready') {
    return 'ready';
  }
  if (status === 'blocked') {
    return 'blocked';
  }
  if (status === 'needs_approval') {
    return 'waiting';
  }
  return 'warning';
}
