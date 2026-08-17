import type { AutoRepairIncidentMemoryService } from '../AutoRepairIncidentMemoryService.js';
import {
  collectAutoRepairSmokeValidationStats,
  describeAutoRepairValidationStatus,
  describeChannelProviderBootstrapStatus,
  describeNodeMeshBootstrapStatus,
  describeRemoteTransportBootstrapStatus,
} from './AutoRepairReportNarrative.js';
import type { AutoRepairReport } from './AutoRepairTypes.js';
import { logger } from '../../logger.js';

export function describeAutoRepairIncidentMemoryStatus(
  incidentMemoryService: Pick<AutoRepairIncidentMemoryService, 'summarizeForStatus'>,
): string {
  try {
    if (typeof incidentMemoryService.summarizeForStatus === 'function') {
      return incidentMemoryService.summarizeForStatus();
    }
    return 'Operational memory: history available for the planner.';
  } catch (error: unknown) {logger.warn('[Auto Repair Summary] filesystem check failed', error); return 'Operational memory: unavailable at this moment.'; }
}

export function summarizeLastAutoRepairRun(
  report: AutoRepairReport | null,
  incidentMemoryStatus: string,
): string {
  if (!report) {
    return [
      'Zavorth Auto-Repair',
      '',
      'No saved report exists yet.',
      'Use /autorepair to fix and reconnect or /autorepair status to view the latest report.',
    ].join('\n');
  }

  const lines = [
    'Zavorth Auto-Repair',
    '',
    `Status: ${report.status}.`,
    `Goal: ${report.goal}.`,
    `Requested by: ${report.requestedBy || 'unknown'}.`,
    `Started: ${report.startedAt}.`,
  ];

  if (report.finishedAt) {
    lines.push(`Finished: ${report.finishedAt}.`);
  }

  const executedBootstrapSteps = report.bootstrapRepair.steps.filter((step) => step.status === 'executed').length;
  const failedBootstrapSteps = report.bootstrapRepair.steps.filter((step) => step.status === 'failed').length;
  lines.push(`Environmental repair: ${executedBootstrapSteps} executed | ${failedBootstrapSteps} failed.`);
  const nodeMeshBootstrapSummary = describeNodeMeshBootstrapStatus(report);
  if (nodeMeshBootstrapSummary) {
    lines.push(nodeMeshBootstrapSummary);
  }
  const channelProviderBootstrapSummary = describeChannelProviderBootstrapStatus(report);
  if (channelProviderBootstrapSummary) {
    lines.push(channelProviderBootstrapSummary);
  }
  const remoteTransportBootstrapSummary = describeRemoteTransportBootstrapStatus(report);
  if (remoteTransportBootstrapSummary) {
    lines.push(remoteTransportBootstrapSummary);
  }
  lines.push(incidentMemoryStatus);

  if (report.planner?.summary) {
    lines.push(`Plan: ${report.planner.summary}`);
  }

  if (report.attempts.length > 0) {
    const lastAttempt = report.attempts[report.attempts.length - 1];
    lines.push(
      `Last code attempt: #${lastAttempt.attemptNumber} at ${lastAttempt.targetFile || 'no file'} (${lastAttempt.status}).`,
    );
  }

  const validationSummary = describeAutoRepairValidationStatus(report);
  if (validationSummary) {
    lines.push(validationSummary);
  }

  const smokeStats = collectAutoRepairSmokeValidationStats(report);
  if (smokeStats.total > 0) {
    lines.push(
      `External smokes: ${smokeStats.passed} ok | ${smokeStats.failed} failed | ${smokeStats.skipped} skipped.`,
    );
  }

  if (report.reloadRequest?.summary) {
    lines.push(`Reload: ${report.reloadRequest.summary}`);
  }

  if (report.warnings.length > 0) {
    lines.push('', 'Warnings:');
    for (const warning of report.warnings.slice(0, 3)) {
      lines.push(`- ${warning}`);
    }
  }

  lines.push('', `Summary: ${report.summary}`);
  lines.push('', 'Shortcuts: /autorepair | /autorepair status | /reload | /changes');
  return lines.join('\n');
}

export function buildAutoRepairRunSummary(
  report: AutoRepairReport,
  needsReload: boolean,
  incidentMemoryStatus: string,
): string {
  const executedBootstrapSteps = report.bootstrapRepair.steps.filter((step) => step.status === 'executed').length;
  const failedBootstrapSteps = report.bootstrapRepair.steps.filter((step) => step.status === 'failed').length;
  const lines = [
    'Zavorth Auto-Repair',
    '',
    `Final status: ${report.status}.`,
    `Goal: ${report.goal}.`,
    `Environmental repair: ${executedBootstrapSteps} executed | ${failedBootstrapSteps} failed.`,
  ];

  const nodeMeshBootstrapSummary = describeNodeMeshBootstrapStatus(report);
  if (nodeMeshBootstrapSummary) {
    lines.push(nodeMeshBootstrapSummary);
  }
  const channelProviderBootstrapSummary = describeChannelProviderBootstrapStatus(report);
  if (channelProviderBootstrapSummary) {
    lines.push(channelProviderBootstrapSummary);
  }
  const remoteTransportBootstrapSummary = describeRemoteTransportBootstrapStatus(report);
  if (remoteTransportBootstrapSummary) {
    lines.push(remoteTransportBootstrapSummary);
  }
  lines.push(incidentMemoryStatus);

  if (report.planner?.summary) {
    lines.push(`Model plan: ${report.planner.summary}`);
  }

  if (report.attempts.length > 0) {
    const lastAttempt = report.attempts[report.attempts.length - 1];
    lines.push(
      `Final attempt: #${lastAttempt.attemptNumber} at ${lastAttempt.targetFile || 'no file'} (${lastAttempt.status}).`,
    );
    if (lastAttempt.error) {
      lines.push(`Last error: ${lastAttempt.error}`);
    }
  }

  const validationSummary = describeAutoRepairValidationStatus(report);
  if (validationSummary) {
    lines.push(validationSummary);
  }

  const smokeStats = collectAutoRepairSmokeValidationStats(report);
  if (smokeStats.total > 0) {
    lines.push(
      `External smokes: ${smokeStats.passed} ok | ${smokeStats.failed} failure(s) | ${smokeStats.skipped} skipped item(s).`,
    );
  }

  if (report.reloadRequest?.summary) {
    lines.push(`Supervised reload: ${report.reloadRequest.summary}`);
  } else if (needsReload && process.env.ZAVORTH_SUPERVISED !== 'true') {
    lines.push(
      'The repair finished outside the supervised host. The supervised launcher can proceed with boot using the new changes.',
    );
  }

  if (report.warnings.length > 0) {
    lines.push('', 'Warnings:');
    for (const warning of report.warnings.slice(0, 3)) {
      lines.push(`- ${warning}`);
    }
  }

  lines.push('', 'Useful commands: /autorepair | /autorepair status | /reload | /changes');
  return lines.join('\n');
}
