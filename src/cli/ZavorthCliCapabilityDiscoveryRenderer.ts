import type { NaturalCapabilityDiscoverySnapshot } from '../runtime/agent/index.js';

export function resolveCapabilityDiscoveryCliText(args: string): string {
  return String(args || '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();
}

export function formatNaturalCapabilityDiscoverySnapshot(
  snapshot: NaturalCapabilityDiscoverySnapshot,
): string {
  const confidence = Math.round(snapshot.confidence * 100);
  const recommendations = snapshot.recommendations.slice(0, 6);
  const lines = [
    'Natural Capability Discovery - Capability Discovery',
    `- contract: ${snapshot.contractVersion}`,
    `- intent: ${snapshot.intentCategory} | confidence ${confidence}%`,
    `- tools: ${snapshot.recommendedToolNames.length > 0 ? snapshot.recommendedToolNames.join(', ') : 'none'}`,
    `- groups: ${snapshot.groups.length > 0 ? snapshot.groups.join(', ') : 'none'}`,
    `- risk: ${snapshot.safety.highestRisk} | approval=${String(snapshot.safety.requiresApproval)} | preview=${String(snapshot.safety.previewRequired)}`,
    `- quarantine: ${snapshot.quarantine.warning || 'no imported block'}`,
    `- next step: ${snapshot.nextSafeAction}`,
  ];

  if (recommendations.length > 0) {
    lines.push('', 'Recommendations');
    for (const recommendation of recommendations) {
      lines.push(
        `- ${recommendation.label} [${recommendation.risk}]`,
        `  tools=${recommendation.toolIds.join(', ') || 'none'} | approval=${String(recommendation.requiresApproval)} | preview=${String(recommendation.previewRequired)}`,
        `  ${recommendation.reason}`,
      );
    }
  }

  lines.push('', 'Surfaces');
  lines.push(`- ZavorthControl: ${snapshot.surface.zavorthControlPath}`);
  lines.push(`- CLI: ${snapshot.surface.cliCommand}`);

  return lines.join('\n');
}
