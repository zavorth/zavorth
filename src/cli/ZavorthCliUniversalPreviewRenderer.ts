import {
  AgentRunService,
  type UniversalPreviewModeSnapshot,
} from '../runtime/agent/index.js';

export function resolveUniversalPreviewCliText(args: string): string {
  return String(args || '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();
}

export function buildUniversalPreviewCliSnapshot(input: {
  text: string;
  userId: string;
  sessionId: string;
}): UniversalPreviewModeSnapshot {
  const service = new AgentRunService();
  const run = service.createRun({
    userId: input.userId,
    channel: 'cli',
    sessionId: input.sessionId,
    text: input.text,
    requestedTools: [],
    metadata: {
      universalPreviewMode: {
        enabled: true,
        source: 'zavorth-cli',
      },
    },
  });
  return run.metadata.universalPreviewMode as UniversalPreviewModeSnapshot;
}

export function formatUniversalPreviewModeSnapshot(
  snapshot: UniversalPreviewModeSnapshot,
): string {
  const lines = [
    'Universal Preview Mode - Universal Preview',
    `- contract: ${snapshot.contractVersion}`,
    `- mode: ${snapshot.mode}`,
    `- risk: ${snapshot.risk.highestRisk} | approval=${String(snapshot.risk.requiresApproval)} | preview=${String(snapshot.risk.previewRequired)}`,
    `- exposed tools: ${snapshot.toolExposure.exposedToolIds.length > 0 ? snapshot.toolExposure.exposedToolIds.join(', ') : 'none'}`,
    `- real calls: ${snapshot.safety.toolsActuallyCalled.length}`,
    `- next step: ${snapshot.nextSafeAction}`,
  ];

  if (snapshot.planSteps.length > 0) {
    lines.push('', 'Plan');
    for (const step of snapshot.planSteps.slice(0, 6)) {
      lines.push(
        `- ${step.label} [${step.risk}]`,
        `  ${step.action}`,
        `  impact: ${step.impact}`,
      );
    }
  }

  lines.push('', 'Surfaces');
  lines.push(`- ZavorthControl: ${snapshot.surface.zavorthControlPath}`);
  lines.push(`- CLI: ${snapshot.surface.cliCommand}`);

  return lines.join('\n');
}
