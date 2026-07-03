import {
  renderPremiumKeyValueTable,
  renderZavorthPremiumCliScreen,
  type ZavorthPremiumCliAction,
  type ZavorthPremiumCliPanel,
  type ZavorthPremiumCliStatusRow,
} from '../premium/index.js';
import type { ZavorthCliHudSnapshot } from './ZavorthCliHudTypes.js';

export function renderZavorthCliHud(snapshot: ZavorthCliHudSnapshot): string {
  const selected = snapshot.approvals.cards.find((card) => card.id === snapshot.selectedPlanId);
  const panels: ZavorthPremiumCliPanel[] = [];

  if (snapshot.mode !== 'review') {
    panels.push({
      title: 'Zavorth live',
      accent: snapshot.home.status === 'blocked' ? 'rose' : snapshot.home.status === 'warning' ? 'amber' : 'cyan',
      lines: [
        snapshot.home.headline,
        '',
        ...renderPremiumKeyValueTable([
          { key: 'provider', value: snapshot.home.provider.configured ? `${snapshot.home.provider.id || 'configured'} ${snapshot.home.provider.model || ''}`.trim() : 'missing', accent: snapshot.home.provider.configured ? 'emerald' : 'amber' },
          { key: 'zavorthControl', value: snapshot.home.runtime.zavorthControl },
          { key: 'telegram', value: snapshot.home.channels.telegram },
          { key: 'safety', value: snapshot.home.safety.effectBoundary, accent: snapshot.home.safety.effectBoundary === 'ready' ? 'emerald' : 'rose' },
          { key: 'fallback mode', value: snapshot.safety.fallbackTextMode ? 'text' : 'interactive-ready' },
          { key: 'visual mode', value: snapshot.tty ? 'keyboard cockpit' : 'read-only terminal' },
        ]).split('\n'),
        '',
        'Daily flow: ask -> preview -> approve -> evidence.',
      ],
    });
  }

  if (snapshot.planQueue.length > 0) {
    panels.push({
      title: 'Pending work',
      accent: 'cyan',
      lines: snapshot.planQueue.slice(0, 9).flatMap((plan) => [
        `${snapshot.selectedIndex === plan.index ? '>' : ' '} [${plan.index}] ${plan.title} (${plan.riskLevel})`,
        `  ${plan.status} - diffs ${plan.diffCount} - ${plan.id}`,
      ]),
    });
  }

  if (selected) {
    panels.push({
      title: `Selected Plan (${selected.riskLevel})`,
      accent: selected.riskLevel === 'high' || selected.riskLevel === 'critical' ? 'rose' : selected.riskLevel === 'medium' ? 'amber' : 'emerald',
      lines: [
        ...renderPremiumKeyValueTable([
          { key: 'id', value: selected.id, accent: 'cyan' },
          { key: 'status', value: `${selected.status}/${selected.approvalStatus}`, accent: selected.approvalStatus === 'pending' ? 'amber' : 'emerald' },
          { key: 'diffs', value: `${selected.diffCount}` },
          { key: 'external', value: selected.resourceImpact.externalExposure },
        ]).split('\n'),
        '',
        selected.summary,
        '',
        `approval: ${selected.approvalReason}`,
      ],
    });
  }

  panels.push({
      title: snapshot.mode === 'review' ? 'Review keys' : 'Keys',
    accent: 'violet',
    lines: snapshot.shortcuts.flatMap((shortcut) => [
      `[${shortcut.key}] ${shortcut.label} - ${shortcut.requiresConfirmation ? 'double-confirm' : 'direct'}`,
      `  ${shortcut.enabled ? shortcut.command : 'disabled'}`,
      shortcut.detail ? `  ${shortcut.detail}` : '',
    ].filter(Boolean)),
  });

  return renderZavorthPremiumCliScreen({
    title: snapshot.mode === 'review' ? 'Review Mode' : 'HUD',
    subtitle: `${snapshot.decision.message} Use simple keys; every sensitive action stays governed.`,
    mode: 'compact',
    statusRows: buildStatusRows(snapshot),
    panels,
    actions: buildActions(snapshot),
    notice: {
      title: 'Shortcut safety',
      body: 'The HUD can approve, reject or defer work only after explicit double confirmation. It never applies host changes by itself.',
    },
  });
}

function buildStatusRows(snapshot: ZavorthCliHudSnapshot): ZavorthPremiumCliStatusRow[] {
  return [
    { label: 'Agent', value: snapshot.home.status, status: snapshot.home.status === 'ready' ? 'ready' : snapshot.home.status === 'blocked' ? 'blocked' : 'warning' },
    { label: 'Pending approvals', value: `${snapshot.approvals.summary.pending}`, status: snapshot.approvals.summary.pending > 0 ? 'waiting' : 'ready' },
    { label: 'Diff previews', value: `${snapshot.approvals.summary.diffEntries}`, status: snapshot.approvals.summary.diffEntries > 0 ? 'warning' : 'ready' },
    { label: 'Selected', value: snapshot.selectedIndex ? `#${snapshot.selectedIndex}` : 'none', status: snapshot.selectedIndex ? 'ready' : 'warning' },
    { label: 'TTY', value: snapshot.tty ? 'yes' : 'no', status: snapshot.tty ? 'ready' : 'warning', detail: snapshot.tty ? 'interactive keys available' : 'text fallback' },
  ];
}

function buildActions(snapshot: ZavorthCliHudSnapshot): ZavorthPremiumCliAction[] {
  return snapshot.shortcuts
    .filter((shortcut) => shortcut.enabled)
    .slice(0, 7)
    .map((shortcut) => ({
      label: `[${shortcut.key}] ${shortcut.label}`,
      command: shortcut.command,
      detail: shortcut.detail,
      accent: shortcut.requiresConfirmation ? 'amber' : shortcut.key === 'o' ? 'emerald' : 'cyan',
    }));
}
