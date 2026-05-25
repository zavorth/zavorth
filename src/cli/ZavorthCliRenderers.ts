import type { ZavorthLayeredMemoryService } from '../services/ZavorthLayeredMemoryService.js';
import { formatCount } from './ZavorthCliText.js';

export function formatLayeredMemoryMetrics(
  metrics: Awaited<ReturnType<ZavorthLayeredMemoryService['readMetrics']>>,
): string {
  return [
    'Memory metrics',
    'Pressure and distribution snapshot for layered memory.',
    '',
    'Now',
    `- entries: ${formatCount(metrics.summary.totalEntries, 'entry', 'entries')} | episodic ${metrics.summary.episodic} | semantic ${metrics.summary.semantic} | procedural ${metrics.summary.procedural}`,
    `- average budget usage: ${metrics.summary.averageBudgetUsage} | pressure: ${metrics.summary.pressure}`,
    `- procedures: ${formatCount(metrics.procedures.total, 'total', 'total')} | ${metrics.procedures.trustedLocal} trusted local | ${metrics.procedures.learnedDraft} draft`,
    '',
    'Do now',
    '- zavorth memory status',
    '- zavorth memory procedures',
  ].join('\n');
}
