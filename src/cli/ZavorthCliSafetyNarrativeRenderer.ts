import {
  AgentRunService,
  SafetyNarrativeService,
  type SafetyNarrativeSnapshot,
} from '../runtime/agent/index.js';

export function resolveSafetyNarrativeCliText(args: string): string {
  return String(args || '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();
}

export function buildSafetyNarrativeCliSnapshot(input: {
  text: string;
  userId: string;
  sessionId: string;
}): SafetyNarrativeSnapshot {
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
        source: 'zavorth-cli-safety',
      },
    },
  });
  return new SafetyNarrativeService().buildSnapshot({
    run,
    generatedAt: run.updatedAt,
  });
}

export function formatSafetyNarrativeSnapshot(
  snapshot: SafetyNarrativeSnapshot,
): string {
  const lines = [
    'Safety Narrative - Safety Narrative',
    `- contract: ${snapshot.contractVersion}`,
    `- status: ${snapshot.status}`,
    `- high-risk: ${String(snapshot.highRiskBlockPresent)}`,
    `- approvals continuam: ${String(snapshot.policy.approvalsRemainRequired)}`,
    `- preview continua: ${String(snapshot.policy.previewRemainsRequired)}`,
    `- segredos redigidos: ${snapshot.redaction.secretCount}`,
    `- paths redigidos: ${snapshot.redaction.sensitivePathCount}`,
    `- next step: ${snapshot.nextSafeAction}`,
  ];

  if (snapshot.reasons.length > 0) {
    lines.push('', 'Motivos');
    for (const reason of snapshot.reasons.slice(0, 6)) {
      lines.push(
        `- ${reason.title} [${reason.risk}]`,
        `  ${reason.detail}`,
      );
    }
  }

  if (snapshot.alternatives.length > 0) {
    lines.push('', 'Alternativas seguras');
    for (const alternative of snapshot.alternatives.slice(0, 6)) {
      lines.push(
        `- ${alternative.label}`,
        `  ${alternative.detail}`,
      );
    }
  }

  lines.push('', 'Superficies');
  lines.push(`- ZavorthControl: ${snapshot.surface.zavorthControlPath}`);
  lines.push(`- CLI: ${snapshot.surface.cliCommand}`);

  return lines.join('\n');
}
