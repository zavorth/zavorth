import {
  AgentRunService,
  PRODUCTIZATION_EVIDENCE_CONTRACT_VERSION,
  ProductizationEvidenceService,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-productization-evidence-${++index}`;
}

describe('ProductizationEvidenceService Channel mesh6', () => {
  it('builds release readiness evidence without publishing a release', () => {
    const run = new AgentRunService({
      now: () => new Date('2026-05-04T01:46:00.000Z'),
      idFactory: createIdFactory(),
    }).createRun({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-productization-evidence',
      text: 'prepare evidence de produto para release preview',
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
      },
    });

    const snapshot = new ProductizationEvidenceService({
      now: () => new Date('2026-05-04T01:46:00.000Z'),
    }).buildSnapshot({
      run,
      generatedAt: run.updatedAt,
    });

    expect(snapshot).toEqual(expect.objectContaining({
      contractVersion: PRODUCTIZATION_EVIDENCE_CONTRACT_VERSION,
      source: 'ProductizationEvidenceService',
      status: expect.stringMatching(/ready|partial/),
      summary: expect.objectContaining({
        productizationContractLinked: true,
        releasePreviewReady: true,
        stableReleaseAllowed: false,
        replayLinked: true,
        zavorthControlLinked: true,
      }),
      productization: expect.objectContaining({
        contractService: 'ZavorthProductizationContractService',
        c9Linked: true,
        stage: 'C9',
      }),
      releaseReadiness: expect.objectContaining({
        status: 'preview-ready',
        channel: 'preview',
        stableRequiresRealRelease: true,
        noReleasePublished: true,
        noInstallerExecuted: true,
        noCanaryStarted: true,
      }),
      policy: expect.objectContaining({
        noReleasePublished: true,
        noInstallerExecuted: true,
        noCanaryStarted: true,
        stableRequiresRealRelease: true,
        productizationClaimsNeedReceipts: true,
        secretsSerialized: false,
      }),
    }));
    expect(snapshot.gates).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'productization-c9-contract', status: 'ready' }),
      expect.objectContaining({ id: 'replay-hardening', status: 'ready' }),
      expect.objectContaining({ id: 'release-honesty', status: 'ready' }),
    ]));
    expect(snapshot.surface.cliCommand).toContain('zavorth productization-evidence');
  });
});
