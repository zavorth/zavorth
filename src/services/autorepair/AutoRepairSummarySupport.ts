import type { AutoRepairIncidentMemoryService } from '../AutoRepairIncidentMemoryService.js';
import {
  collectAutoRepairSmokeValidationStats,
  describeAutoRepairValidationStatus,
  describeChannelProviderBootstrapStatus,
  describeNodeMeshBootstrapStatus,
  describeRemoteTransportBootstrapStatus,
} from './AutoRepairReportNarrative.js';
import type { AutoRepairReport } from './AutoRepairTypes.js';

export function describeAutoRepairIncidentMemoryStatus(
  incidentMemoryService: Pick<AutoRepairIncidentMemoryService, 'summarizeForStatus'>,
): string {
  try {
    if (typeof incidentMemoryService.summarizeForStatus === 'function') {
      return incidentMemoryService.summarizeForStatus();
    }
    return 'Memoria operacional: historico disponivel para o planejador.';
  } catch {
    return 'Memoria operacional: indisponivel neste momento.';
  }
}

export function summarizeLastAutoRepairRun(
  report: AutoRepairReport | null,
  incidentMemoryStatus: string,
): string {
  if (!report) {
    return [
      'Autoreparo do Zavorth',
      '',
      'Ainda nao existe relatorio salvo.',
      'Use /autorepair para corrigir e religar ou /autorepair status para consultar o ultimo relatorio.',
    ].join('\n');
  }

  const lines = [
    'Autoreparo do Zavorth',
    '',
    `Status: ${report.status}.`,
    `Objetivo: ${report.goal}.`,
    `Solicitado por: ${report.requestedBy || 'unknown'}.`,
    `Inicio: ${report.startedAt}.`,
  ];

  if (report.finishedAt) {
    lines.push(`Fim: ${report.finishedAt}.`);
  }

  const executedBootstrapSteps = report.bootstrapRepair.steps.filter((step) => step.status === 'executed').length;
  const failedBootstrapSteps = report.bootstrapRepair.steps.filter((step) => step.status === 'failed').length;
  lines.push(`Reparo ambiental: ${executedBootstrapSteps} executado(s) | ${failedBootstrapSteps} falha(s).`);
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
    lines.push(`Plano: ${report.planner.summary}`);
  }

  if (report.attempts.length > 0) {
    const lastAttempt = report.attempts[report.attempts.length - 1];
    lines.push(
      `Ultima tentativa de codigo: #${lastAttempt.attemptNumber} em ${lastAttempt.targetFile || 'sem arquivo'} (${lastAttempt.status}).`,
    );
  }

  const validationSummary = describeAutoRepairValidationStatus(report);
  if (validationSummary) {
    lines.push(validationSummary);
  }

  const smokeStats = collectAutoRepairSmokeValidationStats(report);
  if (smokeStats.total > 0) {
    lines.push(
      `Smokes externos: ${smokeStats.passed} ok | ${smokeStats.failed} falha(s) | ${smokeStats.skipped} pulado(s).`,
    );
  }

  if (report.reloadRequest?.summary) {
    lines.push(`Reload: ${report.reloadRequest.summary}`);
  }

  if (report.warnings.length > 0) {
    lines.push('', 'Alertas:');
    for (const warning of report.warnings.slice(0, 3)) {
      lines.push(`- ${warning}`);
    }
  }

  lines.push('', `Resumo: ${report.summary}`);
  lines.push('', 'Atalhos: /autorepair | /autorepair status | /reload | /changes');
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
    'Autoreparo do Zavorth',
    '',
    `Status final: ${report.status}.`,
    `Objetivo: ${report.goal}.`,
    `Reparo ambiental: ${executedBootstrapSteps} executado(s) | ${failedBootstrapSteps} falha(s).`,
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
    lines.push(`Plano do modelo: ${report.planner.summary}`);
  }

  if (report.attempts.length > 0) {
    const lastAttempt = report.attempts[report.attempts.length - 1];
    lines.push(
      `Tentativa final: #${lastAttempt.attemptNumber} em ${lastAttempt.targetFile || 'sem arquivo'} (${lastAttempt.status}).`,
    );
    if (lastAttempt.error) {
      lines.push(`Ultimo erro: ${lastAttempt.error}`);
    }
  }

  const validationSummary = describeAutoRepairValidationStatus(report);
  if (validationSummary) {
    lines.push(validationSummary);
  }

  const smokeStats = collectAutoRepairSmokeValidationStats(report);
  if (smokeStats.total > 0) {
    lines.push(
      `Smokes externos: ${smokeStats.passed} ok | ${smokeStats.failed} falha(s) | ${smokeStats.skipped} pulado(s).`,
    );
  }

  if (report.reloadRequest?.summary) {
    lines.push(`Reload supervisionado: ${report.reloadRequest.summary}`);
  } else if (needsReload && process.env.ZAVORTH_SUPERVISED !== 'true') {
    lines.push(
      'O reparo terminou fora do host supervisionado. O launcher supervisionado pode seguir com o boot usando as mudancas novas.',
    );
  }

  if (report.warnings.length > 0) {
    lines.push('', 'Alertas:');
    for (const warning of report.warnings.slice(0, 3)) {
      lines.push(`- ${warning}`);
    }
  }

  lines.push('', 'Comandos uteis: /autorepair | /autorepair status | /reload | /changes');
  return lines.join('\n');
}
