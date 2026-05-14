import type { ZavorthLayeredMemoryService } from '../services/ZavorthLayeredMemoryService.js';
import { formatCount } from './ZavorthCliText.js';

export function formatLayeredMemoryMetrics(
  metrics: Awaited<ReturnType<ZavorthLayeredMemoryService['readMetrics']>>,
): string {
  return [
    'Metricas da memoria',
    'Panorama de pressao e distribuicao da layered memory.',
    '',
    'Agora',
    `- entradas: ${formatCount(metrics.summary.totalEntries, 'entrada', 'entradas')} | episodica ${metrics.summary.episodic} | semantica ${metrics.summary.semantic} | procedural ${metrics.summary.procedural}`,
    `- uso medio do budget: ${metrics.summary.averageBudgetUsage} | pressao: ${metrics.summary.pressure}`,
    `- procedimentos: ${formatCount(metrics.procedures.total, 'total', 'total')} | ${metrics.procedures.trustedLocal} trusted local | ${metrics.procedures.learnedDraft} draft`,
    '',
    'Faca agora',
    '- zavorth memory status',
    '- zavorth memory procedures',
  ].join('\n');
}
