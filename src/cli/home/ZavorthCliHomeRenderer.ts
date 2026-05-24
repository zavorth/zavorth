import { sanitizeHumanCliText } from '../ZavorthCliText.js';
import { paintCliDivider, paintCliTone } from '../ZavorthCliVisualTheme.js';
import { TerminalPanel } from '../presentation/TerminalPanel.js';
import type { ZavorthCliHomeSnapshot } from './ZavorthCliHomeTypes.js';

export function renderZavorthCliHome(snapshot: ZavorthCliHomeSnapshot): string {
  const attentionLines = buildAttentionLines(snapshot);
  const provider = snapshot.provider.configured
    ? `${snapshot.provider.id || 'configured'}${snapshot.provider.model ? ` / ${snapshot.provider.model}` : ''}`
    : 'missing';
  const statusTone = snapshot.status === 'ready'
    ? 'success'
    : snapshot.status === 'blocked'
      ? 'danger'
      : 'warning';
  const statusLines = [
    `runtime   ${snapshot.runtime.dashboard}`,
    `provider  ${provider}`,
    `approvals ${snapshot.approvals.pending}`,
    `safety    ${snapshot.safety.effectBoundary}`,
  ];
  const nextLines = attentionLines.length
    ? attentionLines
    : ['Zavorth is ready. Start with chat or ask naturally.'];
  return [
    '',
    `${paintCliTone('ZAVORTH', 'brand')} ${paintCliTone('home', 'muted')}`,
    paintCliTone('Ask naturally. Execute safely. Keep evidence.', 'muted'),
    paintCliDivider(72),
    TerminalPanel.render([
      paintCliTone(snapshot.status.toUpperCase(), statusTone),
      ...statusLines,
    ].join('\n'), {
      title: 'Status',
      type: snapshot.status === 'ready' ? 'success' : snapshot.status === 'blocked' ? 'error' : 'warning',
      padding: 1,
      width: terminalPanelWidth(),
    }),
    TerminalPanel.render(nextLines.map((line) => `> ${line}`).join('\n'), {
      title: attentionLines.length ? 'Needs you' : 'Ready',
      type: attentionLines.length ? 'warning' : 'success',
      padding: 1,
      width: terminalPanelWidth(),
    }),
    TerminalPanel.render([
      `${paintCliTone('zavorth', 'brand')}                  open the agent session`,
      `${paintCliTone('zavorth ask "review this repo"', 'brand')}  run one natural request`,
      `${paintCliTone('zavorth setup', 'brand')}            configure provider/model`,
      `${paintCliTone('zavorth approve', 'brand')}          review governed work`,
      `${paintCliTone('zavorth open', 'brand')}             open Command Center`,
      '',
      `${paintCliTone('More when needed', 'muted')}: zavorth status | zavorth doctor | zavorth help`,
    ].join('\n'), {
      title: 'Start',
      type: 'default',
      padding: 1,
      width: terminalPanelWidth(),
    }),
    '',
  ].join('\n');
}

function buildAttentionLines(snapshot: ZavorthCliHomeSnapshot): string[] {
  const lines: string[] = [];
  if (!snapshot.provider.configured) {
    lines.push('Provider is not configured -> zavorth setup');
  }
  if (snapshot.approvals.pending > 0) {
    lines.push(`${snapshot.approvals.pending} approval(s) pending -> zavorth approve`);
  }
  if (snapshot.safety.effectBoundary !== 'ready') {
    lines.push('Safety boundary needs repair -> zavorth doctor');
  }
  if (snapshot.status === 'offline') {
    lines.push('Runtime looks offline -> zavorth start');
  }
  if (snapshot.approvals.latest.length > 0) {
    const latest = snapshot.approvals.latest[0];
    lines.push(`Latest: ${sanitizeHumanCliText(latest.title)} (${latest.riskLevel})`);
  }
  return lines;
}

function terminalPanelWidth(): number {
  const columns = Number(process.stdout?.columns || 0);
  if (!Number.isFinite(columns) || columns <= 0) {
    return 78;
  }
  return Math.max(56, Math.min(88, columns - 4));
}
