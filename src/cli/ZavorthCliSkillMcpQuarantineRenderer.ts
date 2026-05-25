import {
  AgentRunService,
  SkillMcpQuarantineService,
  type SkillMcpQuarantineSnapshot,
  type UniversalAgentRun,
} from '../runtime/agent/index.js';

export function resolveSkillMcpQuarantineCliText(args: string): string {
  return String(args || '')
    .trim()
    .replace(/^(?:run|inspect|review|status|list)\b/i, '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();
}

export function buildSkillMcpQuarantineCliSnapshot(input: {
  text: string;
  userId: string;
  sessionId: string;
}): SkillMcpQuarantineSnapshot {
  const service = new AgentRunService({
    now: () => new Date('2026-05-03T23:45:00.000Z'),
  });
  const text = input.text || 'revisar skill importada e MCP experimental';
  const run = service.createRun({
    userId: input.userId,
    channel: 'cli',
    sessionId: input.sessionId,
    text,
    requestedTools: ['unsafe_imported_tool', 'mcp.experimental.write'],
    metadata: {
      coldContext: {
        skillContext: {
          source: 'SkillScanner',
          directory: 'skills/imported-draft',
          riskReports: [
            {
              kind: 'skill',
              id: 'imported-draft',
              toolNames: ['unsafe_imported_tool'],
              trustState: 'quarantined',
              riskLevel: 'high',
              quarantined: true,
              requiresReview: true,
              canExposeToModel: false,
              canExposeTools: false,
              reasons: ['capability-quarantined', 'external-import-review-required'],
            },
          ],
        },
        mcpContext: {
          source: 'McpRuntimeService.readSnapshot',
          manifestPath: 'config/mcp-servers.json',
          riskReports: [
            {
              kind: 'mcp',
              id: 'experimental-mcp',
              toolNames: ['mcp.experimental.write'],
              trustState: 'safe',
              riskLevel: 'medium',
              quarantined: false,
              requiresReview: false,
              canExposeToModel: true,
              canExposeTools: true,
              reasons: ['capability-safe'],
            },
          ],
        },
      },
    },
  });
  return new SkillMcpQuarantineService({
    now: () => new Date(run.updatedAt),
  }).buildSnapshot({
    run,
    generatedAt: run.updatedAt,
  });
}

export function buildSkillMcpQuarantineSnapshotFromRun(
  run: UniversalAgentRun,
): SkillMcpQuarantineSnapshot {
  return new SkillMcpQuarantineService().buildSnapshot({
    run,
    generatedAt: run.updatedAt,
  });
}

export function formatSkillMcpQuarantineSnapshot(
  snapshot: SkillMcpQuarantineSnapshot,
): string {
  const lines = [
    'Skill/MCP Quarantine - Skill MCP Quarantine',
    `- contrato: ${snapshot.contractVersion}`,
    `- run: ${snapshot.identifiers.runId}`,
    `- total: ${snapshot.summary.total}`,
    `- trusted: ${snapshot.summary.trusted}`,
    `- safe: ${snapshot.summary.safe}`,
    `- quarantined: ${snapshot.summary.quarantined}`,
    `- tools bloqueadas: ${snapshot.summary.blockedToolCount}`,
    `- auto-trust externo: ${String(!snapshot.policy.externalImportsNeverTrustedAutomatically)}`,
    `- proximo passo: ${snapshot.nextSafeAction}`,
  ];

  if (snapshot.entries.length > 0) {
    lines.push('', 'Capabilities importadas');
    for (const entry of snapshot.entries.slice(0, 8)) {
      lines.push(
        `- ${entry.kind}:${entry.id} [${entry.trustState}/${entry.riskLevel}]`,
        `  origem: ${entry.origin.source}${entry.origin.ref ? ` (${entry.origin.ref})` : ''}`,
        `  tools: ${entry.toolNames.length > 0 ? entry.toolNames.join(', ') : 'sem tools declaradas'}`,
        `  review: ${entry.actions.reviewCommand}`,
        `  promover: ${entry.actions.promoteCommand}`,
      );
    }
  } else {
    lines.push('', 'Capabilities importadas', '- nenhuma skill/MCP importada apareceu neste run.');
  }

  lines.push('', 'Politica');
  lines.push('- imports externos nao viram trusted automaticamente');
  lines.push('- quarentena nao pode ser removida por linguagem natural');
  lines.push('- promocao exige acao explicita do operador');

  lines.push('', 'Superficies');
  lines.push(`- Dashboard: ${snapshot.surface.dashboardPath}`);
  lines.push(`- CLI: ${snapshot.surface.cliCommand}`);
  lines.push(`- Review: ${snapshot.surface.reviewHint}`);

  return lines.join('\n');
}
