import { sanitizeHumanCliText } from '../ZavorthCliText.js';
import {
  renderPremiumKeyValueTable,
  renderZavorthPremiumCliScreen,
  type ZavorthPremiumCliAction,
  type ZavorthPremiumCliPanel,
  type ZavorthPremiumCliStatusRow,
} from '../premium/index.js';
import type { ZavorthCliHomeSnapshot } from './ZavorthCliHomeTypes.js';

export function renderZavorthCliHome(snapshot: ZavorthCliHomeSnapshot): string {
  const attention = buildAttentionLines(snapshot);
  const provider = snapshot.provider.configured
    ? `${snapshot.provider.id || 'configured'}${snapshot.provider.model ? ` / ${snapshot.provider.model}` : ''}`
    : 'missing';
  const statusRows: ZavorthPremiumCliStatusRow[] = [
    { label: 'Runtime', value: snapshot.runtime.zavorthControl, status: snapshot.status === 'offline' ? 'offline' : 'ready' },
    { label: 'Provider', value: provider, status: snapshot.provider.configured ? 'ready' : 'warning' },
    { label: 'Approvals', value: `${snapshot.approvals.pending} pending`, status: snapshot.approvals.pending > 0 ? 'waiting' : 'ready' },
    { label: 'Safety', value: snapshot.safety.effectBoundary, status: snapshot.safety.effectBoundary === 'ready' ? 'ready' : 'blocked' },
  ];

  const panels: ZavorthPremiumCliPanel[] = [
    {
      title: attention.length ? 'Needs you' : 'Ready',
      accent: attention.length ? 'amber' : 'emerald',
      lines: attention.length
        ? attention.map((line) => `> ${line}`)
        : ['Zavorth is ready. Send a natural request or open the agent session.'],
    },
    {
      title: 'Daily path',
      accent: 'neural',
      lines: renderPremiumKeyValueTable([
        { key: 'agent session', value: 'zavorth', accent: 'amber' },
        { key: 'one request', value: 'zavorth ask "review this repo"', accent: 'cyan' },
        { key: 'setup', value: 'zavorth setup', accent: snapshot.provider.configured ? 'muted' : 'amber' },
        { key: 'approvals', value: 'zavorth approve', accent: snapshot.approvals.pending > 0 ? 'amber' : 'muted' },
        { key: 'zavorthControl', value: 'zavorth open', accent: 'cyan' },
      ]).split('\n'),
    },
  ];

  const actions: ZavorthPremiumCliAction[] = [
    snapshot.provider.configured
      ? { label: 'Open agent session', command: 'zavorth', detail: 'chat with the LLM-first runtime', accent: 'emerald' }
      : { label: 'Configure provider', command: 'zavorth setup', detail: 'model, key and trust mode', accent: 'amber' },
    snapshot.approvals.pending > 0
      ? { label: 'Review approvals', command: 'zavorth approve', detail: `${snapshot.approvals.pending} pending`, accent: 'amber' }
      : { label: 'Ask naturally', command: 'zavorth ask "review this workspace"', detail: 'governed LLM flow', accent: 'cyan' },
    { label: 'Diagnose setup', command: 'zavorth doctor', detail: 'provider, runtime, channels and safety', accent: 'muted' },
  ];

  return renderZavorthPremiumCliScreen({
    title: 'Home',
    subtitle: 'Short status, next action and daily commands.',
    mode: 'compact',
    statusRows,
    panels,
    actions,
  });
}

function buildAttentionLines(snapshot: ZavorthCliHomeSnapshot): string[] {
  const lines: string[] = [];
  if (!snapshot.provider.configured) {
    lines.push('Provider is not configured. Ask me to connect one, or open guided setup.');
  }
  if (snapshot.approvals.pending > 0) {
    lines.push(`${snapshot.approvals.pending} approval(s) pending. Review risk, scope and evidence before deciding.`);
  }
  if (snapshot.safety.effectBoundary !== 'ready') {
    lines.push('Safety boundary needs repair. I can inspect the failure and propose a narrow fix.');
  }
  if (snapshot.status === 'offline') {
    lines.push('Runtime looks offline. I can start or diagnose it before continuing.');
  }
  if (snapshot.approvals.latest.length > 0) {
    const latest = snapshot.approvals.latest[0];
    lines.push(`Latest: ${sanitizeHumanCliText(latest.title)} (${latest.riskLevel})`);
  }
  return lines;
}
