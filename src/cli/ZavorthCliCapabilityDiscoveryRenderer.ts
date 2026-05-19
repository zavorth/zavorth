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
    `- contrato: ${snapshot.contractVersion}`,
    `- intent: ${snapshot.intentCategory} | confianca ${confidence}%`,
    `- tools: ${snapshot.recommendedToolNames.length > 0 ? snapshot.recommendedToolNames.join(', ') : 'nenhuma'}`,
    `- grupos: ${snapshot.groups.length > 0 ? snapshot.groups.join(', ') : 'nenhum'}`,
    `- risco: ${snapshot.safety.highestRisk} | approval=${String(snapshot.safety.requiresApproval)} | preview=${String(snapshot.safety.previewRequired)}`,
    `- quarentena: ${snapshot.quarantine.warning || 'sem bloqueio importado'}`,
    `- proximo passo: ${snapshot.nextSafeAction}`,
  ];

  if (recommendations.length > 0) {
    lines.push('', 'Recomendacoes');
    for (const recommendation of recommendations) {
      lines.push(
        `- ${recommendation.label} [${recommendation.risk}]`,
        `  tools=${recommendation.toolIds.join(', ') || 'nenhuma'} | approval=${String(recommendation.requiresApproval)} | preview=${String(recommendation.previewRequired)}`,
        `  ${recommendation.reason}`,
      );
    }
  }

  lines.push('', 'Superficies');
  lines.push(`- Command Center: ${snapshot.surface.commandCenterPath}`);
  lines.push(`- CLI: ${snapshot.surface.cliCommand}`);

  return lines.join('\n');
}
