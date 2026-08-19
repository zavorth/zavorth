import {
  AgentRunService,
  ProductizationEvidenceService,
  type ProductizationEvidenceSnapshot,
  type UniversalAgentRun,
} from '../runtime/agent/index.js';

export function resolveProductizationEvidenceCliText(args: string): string {
  return String(args || '')
    .trim()
    .replace(/^(?:(?:productization-evidence|release-readiness|release-evidence|readiness|ship-readiness|product-evidence|run|status|latest)\b\s*)+/i, '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();
}

export function buildProductizationEvidenceCliSnapshot(input: {
  text: string;
  userId: string;
  sessionId: string;
}): ProductizationEvidenceSnapshot {
  const service = new AgentRunService({
    now: () => new Date('2026-05-04T01:46:00.000Z'),
  });
  const run = service.createRun({
    userId: input.userId,
    channel: 'cli',
    sessionId: input.sessionId,
    text: input.text || 'audit product readiness without publishing a release',
    workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
    requestedTools: ['workspace.read'],
    metadata: {
      productizationContract: {
        source: 'ZavorthProductizationContractService',
        stage: 'C9',
        status: 'ready',
        control: { ready: true },
        cli: { ready: true },
        sdk: { ready: true },
        docs: { ready: true },
        website: { ready: true },
      },
      releaseStatus: {
        status: 'preview',
        channel: 'preview',
        version: 'v0.1-preview',
        rollbackAvailable: false,
      },
      memoryWithReceipts: {
        source: 'MemoryWithReceiptsService',
        contractVersion: '2026-05-03.memory-receipts',
        receipts: [
          {
            id: 'productization-evidence:memory-receipt',
            kind: 'memory',
            source: 'MemoryWithReceiptsService',
            detail: 'CLI fixture cites contract C9 and keeps release in preview.',
            status: 'ready',
          },
        ],
      },
    },
  });
  run.artifacts = [
    {
      id: 'artifact-productization-evidence',
      title: 'Release readiness evidence',
      kind: 'report',
      createdAt: run.updatedAt,
      sessionId: run.sessionId,
      status: 'ready',
    },
  ];
  return buildProductizationEvidenceSnapshotFromRun(run);
}

export function buildProductizationEvidenceSnapshotFromRun(
  run: UniversalAgentRun,
): ProductizationEvidenceSnapshot {
  return new ProductizationEvidenceService().buildSnapshot({
    run,
    generatedAt: run.updatedAt,
  });
}

export function formatProductizationEvidenceSnapshot(
  snapshot: ProductizationEvidenceSnapshot,
): string {
  const lines = [
    'Productization Evidence & Release Readiness - Channel mesh6',
    `- contract: ${snapshot.contractVersion}`,
    `- run: ${snapshot.identifiers.runId}`,
    `- session: ${snapshot.identifiers.sessionId}`,
    `- status: ${snapshot.status}`,
    `- gates ready: ${snapshot.summary.readyGateCount}/${snapshot.gates.length}`,
    `- C9 linked: ${snapshot.summary.productizationContractLinked ? 'yes' : 'partial'}`,
    `- release: ${snapshot.releaseReadiness.status} / ${snapshot.releaseReadiness.channel}`,
    `- stable allowed: ${snapshot.summary.stableReleaseAllowed ? 'yes' : 'no'}`,
    `- next step: ${snapshot.nextSafeAction}`,
    '',
    'Gates',
  ];

  for (const gate of snapshot.gates) {
    lines.push(
      `- ${gate.status}: ${gate.label}`,
      `  ${gate.source} - ${gate.command} - ${gate.detail}`,
    );
  }

  lines.push('', 'surfaces');
  for (const surface of snapshot.surfaces) {
    lines.push(`- ${surface.status}: ${surface.label} (${surface.path})`);
  }

  lines.push('', 'Release policy');
  lines.push(`- noReleasePublished: ${String(snapshot.policy.noReleasePublished)}`);
  lines.push(`- noInstallerExecuted: ${String(snapshot.policy.noInstallerExecuted)}`);
  lines.push(`- noCanaryStarted: ${String(snapshot.policy.noCanaryStarted)}`);
  lines.push('- preview-only until release gates pass');
  lines.push('- stable requires real release and rollback');
  lines.push('- product claims must cite receipts');
  lines.push('- secrets were not serialized');

  lines.push('', 'Runtime evidence');
  lines.push(`- replay: ${String(snapshot.runtimeEvidence.runArtifactReceiptReplay)}`);
  lines.push(`- provider mesh: ${String(snapshot.runtimeEvidence.providerMeshConsolidation)}`);
  lines.push(`- UNI/trust: ${String(snapshot.runtimeEvidence.universalIntentTrustEnforcement)}`);
  lines.push(`- ZavorthControl: ${String(snapshot.runtimeEvidence.zavorthControlProjection)}`);

  lines.push('', 'consumption surfaces');
  lines.push(`- ZavorthControl: ${snapshot.surface.zavorthControlPath}`);
  lines.push(`- CLI: ${snapshot.surface.cliCommand}`);
  lines.push(`- Release: ${snapshot.surface.releaseHint}`);

  return lines.join('\n');
}
