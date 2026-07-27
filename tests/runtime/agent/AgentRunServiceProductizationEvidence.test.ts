import {
  AgentRunService,
  PRODUCTIZATION_EVIDENCE_CONTRACT_VERSION,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-agent-productization-evidence-${++index}`;
}

describe('AgentRunService productization evidence Channel mesh6', () => {
  it('publishes run.metadata.productizationEvidence after replay hardening', async () => {
    const service = new AgentRunService({
      now: () => new Date('2026-05-04T01:46:00.000Z'),
      idFactory: createIdFactory(),
      executor: () => ({
        status: 'completed' as const,
        summary: 'Productization evidence com artifact do executor.',
        replyText: 'ok',
        artifacts: [
          {
            id: 'artifact-agent-productization-evidence',
            title: 'Artifact de readiness',
            kind: 'report' as const,
            createdAt: '2026-05-04T01:46:00.000Z',
            status: 'ready' as const,
          },
        ],
      }),
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-agent-productization-evidence',
      text: 'prepare readiness de product',
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
          rollbackAvailable: false,
        },
      },
    });

    const evidence = result.run.metadata.productizationEvidence as any;
    expect(result.run.status).toBe('completed');
    expect(result.run.metadata.runArtifactReceiptReplay).toBeTruthy();
    expect(evidence).toEqual(expect.objectContaining({
      contractVersion: PRODUCTIZATION_EVIDENCE_CONTRACT_VERSION,
      source: 'ProductizationEvidenceService',
      summary: expect.objectContaining({
        productizationContractLinked: true,
        replayLinked: true,
        stableReleaseAllowed: false,
      }),
      releaseReadiness: expect.objectContaining({
        status: 'preview-ready',
        noReleasePublished: true,
        noInstallerExecuted: true,
      }),
      policy: expect.objectContaining({
        productizationClaimsNeedReceipts: true,
        replayEvidenceMustRemainReceiptsOnly: true,
        secretsSerialized: false,
      }),
    }));
    expect(evidence.gates).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'replay-hardening', status: 'ready' }),
    ]));
  });
});
