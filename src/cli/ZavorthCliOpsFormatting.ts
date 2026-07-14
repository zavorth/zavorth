import type { RuntimeAccessReadinessReport } from '../runtime/access/RuntimeAccessReadinessService.js';
import type { RuntimeBootstrapReport } from '../runtime/access/RuntimeBootstrapService.js';
import type { RuntimeBootstrapRepairReport } from '../runtime/access/RuntimeBootstrapRepairService.js';
import type { AutoRepairRunResult } from '../services/AutoRepairService.js';
import type { SupervisedReloadRequestResult } from '../services/SupervisedRuntimeService.js';

export function formatRuntimeAccessReadinessReport(report: RuntimeAccessReadinessReport): string {
  const selectedModel = report.runtime.providers?.modelPicker?.selected || null;
  return [
    'Zavorth access readiness',
    `- ${report.summary}`,
    `- local: ${report.local.ready ? 'ready' : 'pending'} | remote: ${report.remote.ready ? 'ready' : 'pending'}`,
    `- local base: ${report.local.baseUrl}`,
    selectedModel ? `- model: ${selectedModel.providerLabel}/${selectedModel.modelLabel} (${selectedModel.readiness})` : null,
    report.recommendations[0] ? `- recommendation: ${report.recommendations[0]}` : '- recommendation: none',
  ].filter(Boolean).join('\n');
}

export function formatRuntimeBootstrapReport(report: RuntimeBootstrapReport): string {
  const selectedModel = report.env.selectedModel || null;
  const providerLine = selectedModel
    ? `${selectedModel.providerLabel}/${selectedModel.modelLabel} (${selectedModel.readiness})`
    : report.env.llmProvider;
  return [
    'Zavorth bootstrap',
    `- ${report.summary}`,
    `- project: ${report.projectRoot}`,
    `- .env: ${report.env.envFilePresent ? 'presente' : 'ausente'} | provider: ${providerLine}`,
    `- install: ${report.dependencies.installRequired ? 'pending' : 'ok'} | build: ${report.dependencies.buildRequired ? 'pending' : 'ok'}`,
    report.actions[0] ? `- next action: ${report.actions[0].title} (${report.actions[0].command})` : '- next action: none',
  ].join('\n');
}

export function formatRuntimeBootstrapRepairReport(report: RuntimeBootstrapRepairReport): string {
  const executed = report.steps.filter((step) => step.status === 'executed').length;
  const failed = report.steps.filter((step) => step.status === 'failed').length;
  const skipped = report.steps.filter((step) => step.status === 'skipped').length;
  return [
    'Zavorth bootstrap repair',
    `- ${report.summary}`,
    `- dry-run: ${report.dryRun ? 'yes' : 'no'}`,
    `- etapas: ${report.steps.length} | executadas: ${executed} | falhas: ${failed} | puladas: ${skipped}`,
  ].join('\n');
}

export function formatSupervisedReloadResult(result: SupervisedReloadRequestResult): string {
  return [
    'Zavorth supervised reload',
    `- status: ${result.accepted ? 'accepted' : 'rejected'}`,
    `- request: ${result.requestId}`,
    `- resumo: ${result.summary}`,
  ].join('\n');
}

export function formatAutoRepairRunResult(result: AutoRepairRunResult): string {
  return [
    'Zavorth autorepair',
    `- status: ${result.status}`,
    `- success: ${result.success ? 'yes' : 'no'}`,
    `- resumo: ${result.summary}`,
  ].join('\n');
}
