import type {
  ZavorthSubagentRuntimeRun,
  ZavorthSubagentRuntimeSession,
  ZavorthSubagentRuntimeSnapshot,
} from '../contracts/runtime/ZavorthSubagentRuntimeContract.js';
import { getSubagentScientistName } from './ZavorthSubagentIdentityService.js';

export const AUTO_SUBAGENT_DECISION_LABEL = 'Auto subagent decision';

export function formatSubagentRuntimeSnapshotText(snapshot: ZavorthSubagentRuntimeSnapshot): string {
  const selectedSession = snapshot.selectedSessionId
    ? snapshot.sessions.find((session) => session.sessionId === snapshot.selectedSessionId) || null
    : null;
  const selectedRun = snapshot.selectedRunId
    ? snapshot.runs.find((run) => run.runId === snapshot.selectedRunId) || null
    : null;
  const lines = [
    'Zavorth Agents',
    '',
    `Status: ${snapshot.status}`,
    `Action: ${snapshot.action}`,
    `Mode: ${snapshot.mode}`,
    `Sessions: ${snapshot.summary.sessions} | active: ${snapshot.summary.activeSessions}`,
    `Runs: ${snapshot.summary.runs} | completed: ${snapshot.summary.completedRuns} | approval: ${snapshot.summary.approvalRequiredRuns} | denied: ${snapshot.summary.deniedRuns}`,
    `Workers: liveRuns=${snapshot.summary.liveRuns} results=${snapshot.summary.workerResults} failed=${snapshot.summary.failedWorkerResults}`,
    `Receipts: policy=${snapshot.summary.policyReceipts} subagent=${snapshot.summary.subagentReceipts} invocation=${snapshot.summary.invocationReceipts}`,
    `Auto decisions: ${snapshot.summary.autoInvocationDecisions}`,
    `Config: children=${snapshot.dynamicConfig.settings.maxConcurrentChildren} depth=${snapshot.dynamicConfig.settings.maxSpawnDepth} role=${snapshot.dynamicConfig.settings.defaultRoleMode} sandbox=${snapshot.dynamicConfig.settings.sandboxBackend}`,
    `Workboard: queued=${snapshot.workboard.summary.queued} running=${snapshot.workboard.summary.running} completed=${snapshot.workboard.summary.completed} blocked=${snapshot.workboard.summary.blocked}`,
    `Devices: approved=${snapshot.pairedDevices.summary.approved} pending=${snapshot.pairedDevices.summary.pending} revoked=${snapshot.pairedDevices.summary.revoked}`,
    `Sandbox: selected=${snapshot.sandbox.selectedBackend} cloud=${snapshot.dynamicConfig.settings.cloudSandboxEnabled}`,
  ];

  if (selectedSession || selectedRun) {
    lines.push(
      '',
      'Selected:',
      `- session: ${selectedSession?.sessionId || snapshot.selectedSessionId || 'n/d'}`,
      `- run: ${selectedRun?.runId || snapshot.selectedRunId || 'n/d'}`,
      `- status: ${selectedSession?.status || selectedRun?.status || snapshot.status}`,
      `- roles: ${formatRuntimeRoles(selectedSession, selectedRun)}`,
    );
    const selectedMessages = selectedSession?.messages || [];
    if (selectedMessages.length > 0) {
      lines.push('- messages:');
      for (const message of selectedMessages.slice(-4)) {
        lines.push(`  - ${message.role}: ${firstLine(message.text, 180)}`);
      }
    }
    if (selectedRun?.summary || selectedRun?.output) {
      lines.push(`- summary: ${firstLine(selectedRun.summary || selectedRun.output || '', 280)}`);
    }
  }

  lines.push('', 'Sessions:');
  for (const session of snapshot.sessions.slice(0, 8)) {
    lines.push([
      `- ${session.sessionId}`,
      `${session.status}`,
      `${session.mode}/${session.executionMode || 'governed-in-process'}`,
      `roles=${formatSessionRoles(session)}`,
      `updated=${session.updatedAt}`,
    ].join(' | '));
  }
  if (snapshot.sessions.length === 0) {
    lines.push('- none yet. Use /agents spawn <task> or /invoke "use subagentes para <task>".');
  }
  if (snapshot.timeline.length > 0) {
    lines.push('', 'Timeline:');
    for (const event of snapshot.timeline.slice(-8)) {
      lines.push(`- ${event.kind}: ${event.status} | ${event.sessionId || 'runtime'} | ${event.detail}`);
    }
  }
  const latestAuto = snapshot.autoInvocationTelemetry.latest;
  if (latestAuto) {
    lines.push(
      '',
      `${AUTO_SUBAGENT_DECISION_LABEL}:`,
      `- ${latestAuto.cli.headline}`,
      `- selectedBy=${latestAuto.selectedBy} | confidence=${latestAuto.confidence} | live=${latestAuto.live}`,
      `- roles=${latestAuto.roles.map((role) => `${role.roleId} (${role.whySelected})`).join('; ') || 'n/d'}`,
      `- triggers=${latestAuto.triggers.join(', ') || 'n/d'}`,
      `- risks=${latestAuto.riskSignals.join(', ') || 'none'}`,
      `- why=${latestAuto.publicRationale}`,
    );
  }
  lines.push('', 'Useful commands:');
  lines.push('- /agents status');
  lines.push('- /agents spawn <task>');
  lines.push('- /agents spawn-batch --tasks tasks.json');
  lines.push('- /agents board status');
  lines.push('- /agents devices list');
  lines.push('- /agents config set maxConcurrentChildren 4');
  lines.push('- /agents read latest');
  lines.push('- /agents summarize latest');
  lines.push('- /agents cancel latest');
  lines.push('', 'Policy: read-only explicit subagents can run; writes, sensitive network and live I/O require approval.');
  lines.push(`Next: ${snapshot.commands.nextStage}`);
  return lines.join('\n');
}

function firstLine(value: string, maxLength = 240): string {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function formatRuntimeRoles(
  selectedSession: ZavorthSubagentRuntimeSession | null,
  selectedRun: ZavorthSubagentRuntimeRun | null,
): string {
  if (selectedSession) return formatSessionRoles(selectedSession);
  const roleIds = selectedRun?.roleIds || [];
  return roleIds
    .map((roleId) => `${getSubagentScientistName(roleId, selectedRun?.sessionId || '')} (${roleId})`)
    .join(', ') || 'n/d';
}

function formatSessionRoles(session: ZavorthSubagentRuntimeSession): string {
  if (session.profileSummaries.length > 0) {
    return session.profileSummaries
      .map((profile) => profile.identity?.displayName || profile.label || profile.id)
      .join(', ');
  }
  return session.roleIds
    .map((roleId) => `${getSubagentScientistName(roleId, session.sessionId)} (${roleId})`)
    .join(', ') || 'auto';
}
