import type { ZavorthReleasePresenceSnapshot } from '../services/ZavorthReleasePresenceControlPlaneService.js';
import { formatCliValue, sanitizeHumanCliText } from './ZavorthCliText.js';
import { renderCliScreen, type CliVisualPanel } from './ZavorthCliVisualSystem.js';

function compact(value: string | null | undefined, maxLength = 96): string {
  const normalized = sanitizeHumanCliText(value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return 'not provided';
  }
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function statusTone(snapshot: ZavorthReleasePresenceSnapshot): CliVisualPanel['tone'] {
  if (snapshot.status === 'blocked') {
    return 'danger';
  }
  if (snapshot.status === 'degraded' || snapshot.release.risk.level === 'high') {
    return 'warning';
  }
  return 'success';
}

function channelLine(channel: ZavorthReleasePresenceSnapshot['channels'][number]): string {
  return `- ${channel.label}: ${channel.status} | ${channel.version || 'no version'} | ${channel.source}`;
}

function historyLine(entry: ZavorthReleasePresenceSnapshot['history'][number]): string {
  const commit = entry.commit ? entry.commit.slice(0, 8) : 'without-commit';
  return `- ${entry.label}: ${entry.publishedAt || 'without data'} | ${commit}`;
}

export function formatReleasePresenceSnapshot(snapshot: ZavorthReleasePresenceSnapshot): string {
  const diffReport = snapshot.diff.report;
  const diffLines = snapshot.diff.available && diffReport
    ? [
        `- summary: ${compact(snapshot.diff.summary, 100)}`,
        `- docs: +${diffReport.targets.docs?.added.length || 0} ~${diffReport.targets.docs?.changed.length || 0} -${diffReport.targets.docs?.removed.length || 0}`,
        `- console: +${diffReport.targets.remoteConsole?.added.length || 0} ~${diffReport.targets.remoteConsole?.changed.length || 0} -${diffReport.targets.remoteConsole?.removed.length || 0}`,
      ]
    : [`- ${compact(snapshot.diff.summary, 110)}`];
  const rollbackChecks = snapshot.rollback.preflight.checks.slice(0, 6).map((check) =>
    `- ${check.id}: ${check.status} | ${compact(check.summary, 76)}`);
  const remoteLines = snapshot.remotePresence.entries.slice(0, 5).map((entry) =>
    `- ${entry.label}: ${entry.readiness} | ${entry.available ? 'online' : 'offline'} | ${compact(entry.summary, 62)}`);
  const taskCostLines = snapshot.costPanel.taskCosts.slice(0, 5).map((task) =>
    `- ${task.taskRef}: ${task.status} | attempts ${task.attempts} | failures ${task.failures}`);

  const panels: CliVisualPanel[] = [
    {
      title: 'Release',
      tone: statusTone(snapshot),
      lines: [
        `- mode: ${snapshot.mode}`,
        `- status: ${snapshot.status}`,
        `- channel: ${snapshot.release.channel}`,
        `- version: ${snapshot.release.version || 'no version'}`,
        `- risk: ${snapshot.release.risk.level} | ${compact(snapshot.release.risk.reasons.join(' | '), 92)}`,
      ],
    },
    {
      title: 'Channels',
      tone: 'info',
      lines: snapshot.channels.map(channelLine),
    },
    {
      title: 'Diff',
      tone: snapshot.diff.available ? 'success' : 'warning',
      lines: diffLines,
    },
    {
      title: 'Rollback preview',
      tone: snapshot.rollback.preflight.status === 'block'
        ? 'danger'
        : snapshot.rollback.preflight.status === 'warn'
          ? 'warning'
          : 'success',
      lines: [
        `- target: ${snapshot.rollback.targetLabel || 'unresolved'}`,
        `- executed: ${snapshot.rollback.executed ? 'yes' : 'no'}`,
        `- confirmation: ${snapshot.rollback.confirmationRequired ? 'required' : 'no'}`,
        `- command: ${snapshot.rollback.command}`,
        ...rollbackChecks,
      ],
    },
    {
      title: 'Remote presence',
      tone: snapshot.remotePresence.status === 'online'
        ? 'success'
        : snapshot.remotePresence.status === 'degraded'
          ? 'warning'
          : 'neutral',
      lines: [
        `- state: ${snapshot.remotePresence.status}`,
        `- ready/total: ${snapshot.remotePresence.ready}/${snapshot.remotePresence.transportTotal}`,
        `- loose credentials: ${snapshot.remotePresence.credentials.looseCredentialRequired ? 'yes' : 'no'}`,
        ...(
          remoteLines.length > 0
            ? remoteLines
            : [`- ${compact(snapshot.remotePresence.stateSummary, 100)}`]
        ),
      ],
    },
    {
      title: 'Custo e attempts',
      tone: snapshot.costPanel.failures > 0 || snapshot.costPanel.blocked > 0 ? 'warning' : 'neutral',
      lines: [
        `- events: ${snapshot.costPanel.totalEvents}`,
        `- traces: ${snapshot.costPanel.traces}`,
        `- failures/blocks: ${snapshot.costPanel.failures}/${snapshot.costPanel.blocked}`,
        `- tokens: ${snapshot.costPanel.tokenAccounting.available ? snapshot.costPanel.tokenAccounting.totalTokens : 'unavailable'}`,
        ...(taskCostLines.length > 0 ? taskCostLines : ['- without traces recentes por task']),
      ],
    },
    {
      title: 'Historico',
      tone: snapshot.history.length > 0 ? 'brand' : 'neutral',
      lines: snapshot.history.length > 0
        ? snapshot.history.slice(0, 5).map(historyLine)
        : ['- without publishes no ledger local'],
    },
    {
      title: 'Contratos',
      tone: Object.values(snapshot.contracts).every(Boolean) ? 'success' : 'warning',
      lines: [
        `- loose credential: ${snapshot.contracts.remoteNeverRequiresLooseCredentialFirstLayer ? 'no' : 'review'}`,
        `- rollback with evidence: ${snapshot.contracts.rollbackHasPreflightAndEvidence ? 'yes' : 'no'}`,
        `- publish with risk/diff/reversal: ${snapshot.contracts.publishRegistersVersionDiffRiskRollback ? 'yes' : 'no'}`,
        `- read-only rollback preview: ${snapshot.contracts.rollbackPreviewDoesNotExecute ? 'yes' : 'no'}`,
      ],
    },
  ];

  return renderCliScreen({
    eyebrow: 'Release',
    eyebrowTone: statusTone(snapshot),
    title: 'Release, remote e produto',
    summary: formatCliValue(snapshot.narrative.headline, 'Release presence ready.'),
    mode: 'compact',
    showWordmark: false,
    panels,
  });
}
