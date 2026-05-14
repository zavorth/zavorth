import type { RuntimeAccessReadinessReport } from '../runtime/access/RuntimeAccessReadinessService.js';
import type { RuntimeBootstrapReport } from '../runtime/access/RuntimeBootstrapService.js';
import type { RuntimeBootstrapRepairReport } from '../runtime/access/RuntimeBootstrapRepairService.js';
import type { AutoRepairRunResult } from '../services/AutoRepairService.js';
import type { SupervisedReloadRequestResult } from '../services/SupervisedRuntimeService.js';

export function formatRuntimeAccessReadinessReport(report: RuntimeAccessReadinessReport): string {
  const selectedModel = report.runtime.providers?.modelPicker?.selected || null;
  return [
    'Access readiness do Zavorth',
    `- ${report.summary}`,
    `- local: ${report.local.ready ? 'pronto' : 'pendente'} | remoto: ${report.remote.ready ? 'pronto' : 'pendente'}`,
    `- base local: ${report.local.baseUrl}`,
    selectedModel ? `- modelo: ${selectedModel.providerLabel}/${selectedModel.modelLabel} (${selectedModel.readiness})` : null,
    report.recommendations[0] ? `- recomendacao: ${report.recommendations[0]}` : '- recomendacao: nenhuma',
  ].filter(Boolean).join('\n');
}

export function formatRuntimeBootstrapReport(report: RuntimeBootstrapReport): string {
  const selectedModel = report.env.selectedModel || null;
  const providerLine = selectedModel
    ? `${selectedModel.providerLabel}/${selectedModel.modelLabel} (${selectedModel.readiness})`
    : report.env.llmProvider;
  return [
    'Bootstrap do Zavorth',
    `- ${report.summary}`,
    `- projeto: ${report.projectRoot}`,
    `- .env: ${report.env.envFilePresent ? 'presente' : 'ausente'} | provider: ${providerLine}`,
    `- install: ${report.dependencies.installRequired ? 'pendente' : 'ok'} | build: ${report.dependencies.buildRequired ? 'pendente' : 'ok'}`,
    report.actions[0] ? `- proxima acao: ${report.actions[0].title} (${report.actions[0].command})` : '- proxima acao: nenhuma',
  ].join('\n');
}

export function formatRuntimeBootstrapRepairReport(report: RuntimeBootstrapRepairReport): string {
  const executed = report.steps.filter((step) => step.status === 'executed').length;
  const failed = report.steps.filter((step) => step.status === 'failed').length;
  const skipped = report.steps.filter((step) => step.status === 'skipped').length;
  return [
    'Bootstrap repair do Zavorth',
    `- ${report.summary}`,
    `- dry-run: ${report.dryRun ? 'sim' : 'nao'}`,
    `- etapas: ${report.steps.length} | executadas: ${executed} | falhas: ${failed} | puladas: ${skipped}`,
  ].join('\n');
}

export function formatSupervisedReloadResult(result: SupervisedReloadRequestResult): string {
  return [
    'Reload supervisionado do Zavorth',
    `- status: ${result.accepted ? 'aceito' : 'recusado'}`,
    `- request: ${result.requestId}`,
    `- resumo: ${result.summary}`,
  ].join('\n');
}

export function formatAutoRepairRunResult(result: AutoRepairRunResult): string {
  return [
    'Autorepair do Zavorth',
    `- status: ${result.status}`,
    `- sucesso: ${result.success ? 'sim' : 'nao'}`,
    `- resumo: ${result.summary}`,
  ].join('\n');
}
