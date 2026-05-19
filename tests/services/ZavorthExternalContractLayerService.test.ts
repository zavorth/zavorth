import {
  ZAVORTH_EXTERNAL_CONTRACT_LAYER_VERSION,
} from '../../src/contracts/ZavorthExternalContractLayerContract.js';
import { ZavorthExternalContractLayerService } from '../../src/services/ZavorthExternalContractLayerService.js';

describe('ZavorthExternalContractLayerService Intent model', () => {
  it('publishes the Zavorth-owned contract layer after Security contract inventory readiness', () => {
    const snapshot = createService().buildSnapshot();

    expect(snapshot).toEqual(expect.objectContaining({
      generatedAt: '2026-05-11T19:30:00.000Z',
      contractVersion: ZAVORTH_EXTERNAL_CONTRACT_LAYER_VERSION,
      status: 'contract-layer-ready',
      planId: 'Zavorth External Runtime Integration',
      stage: 'contract-layer',
      previousInventoryStatus: 'inventory-ready',
    }));
    expect(snapshot.summary).toEqual(expect.objectContaining({
      runtimeDescriptors: 3,
      envelopeSchemas: 11,
      normalizedFixtures: 2,
      blockedFixtures: 3,
      structuredErrors: 6,
      publicIdentityLeaksAllowed: 0,
      liveExecutionPerformed: false,
      sourceRuntimeCodeExecuted: false,
    }));
    expect(snapshot.commands.nextStage).toBe('291 Preview engine - Native Engine Absorption');
  });

  it('defines all Intent model envelopes and keeps external runtime descriptors quarantined', () => {
    const snapshot = createService().buildSnapshot();

    expect(snapshot.envelopeSchemas.map((entry) => entry.kind)).toEqual([
      'runtime',
      'capability',
      'skill',
      'tool',
      'channel',
      'session',
      'event',
      'artifact',
      'approval',
      'health',
      'worker',
    ]);
    expect(snapshot.runtimeDescriptors.map((entry) => entry.id)).toEqual([
      'reference-runtime',
      'acp-compatible-sidecar',
      'acp-compatibility-fixture',
    ]);
    expect(snapshot.runtimeDescriptors.every((entry) => (
      entry.publicName === 'Zavorth'
      && entry.sourceNameQuarantined
      && !entry.enabledByDefault
      && !entry.liveExecutionAllowed
      && entry.credentialPolicy.secretRefsOnly
      && entry.credentialPolicy.rawSecretValuesAccepted === false
      && entry.ingressPolicy.freeTextEntrypoint === 'ZavorthAgentGateway'
      && entry.ingressPolicy.noDirectUserReply
    ))).toBe(true);
  });

  it('normalizes safe external metadata into Zavorth envelopes without identity leakage', () => {
    const receipt = createService().normalizeExternalEnvelope({
      kind: 'capability',
      sourceRuntimeId: 'acp-compatibility-fixture',
      sourceRef: 'extensions/telegram',
      sourcePath: '\\\\wsl.localhost\\Ubuntu-24.04\\home\\grey\\acp-compatible-sidecar-src\\extensions\\telegram',
      sourceLabel: 'ACP-compatible Telegram channel fixture',
      publicName: 'Zavorth',
      provenance: {
        observedAt: '2026-05-11T19:31:00.000Z',
        evidence: ['docs/product-direction.md'],
      },
    });

    expect(receipt.status).toBe('normalized');
    expect(receipt.errors).toEqual([]);
    expect(receipt.envelope).toEqual(expect.objectContaining({
      envelopeId: 'zavorth.external.capability.extensions-telegram',
      kind: 'capability',
      sourceRuntimeId: 'acp-compatibility-fixture',
      publicName: 'Zavorth',
      naturalFirstRoute: 'capability-discovery',
      trustScope: 'policy-gated',
      payloadClassification: 'advisory-data',
    }));
    expect(receipt.envelope?.policy).toEqual(expect.objectContaining({
      noRuntimeMixing: true,
      noSourceRuntimeCodeExecution: true,
      noDirectToolExposure: true,
      noDirectUserReply: true,
      noRawSecrets: true,
      sourceNamesDiagnosticsOnly: true,
    }));
  });

  it('turns unsafe or invalid source data into structured Zavorth errors', () => {
    const receipt = createService().normalizeExternalEnvelope({
      kind: 'tool',
      sourceRuntimeId: 'acp-compatible-sidecar',
      sourceRef: 'extensions/shell/tool',
      publicName: 'ACP-compatible sidecar',
      directToolExposure: true,
      requestedLiveAction: true,
      rawSecretValue: 'sk-do-not-serialize',
      provenance: { evidence: [] },
    });

    expect(receipt.status).toBe('blocked');
    expect(receipt.envelope).toBeNull();
    expect(receipt.errors.map((entry) => entry.code)).toEqual(expect.arrayContaining([
      'missing_provenance',
      'source_identity_leak',
      'raw_secret_value',
      'direct_tool_exposure',
      'live_execution_requested',
    ]));
    expect(receipt.safety).toEqual(expect.objectContaining({
      sourceRuntimeCodeExecuted: false,
      liveExecutionPerformed: false,
      directToolExposureAllowed: false,
      rawSecretSerialized: false,
      publicIdentityLeakAllowed: false,
    }));
  });

  it('blocks Intent model if Security contract inventory is not ready', () => {
    const snapshot = createService().buildSnapshot({ inventoryStatus: 'blocked' });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.previousInventoryStatus).toBe('blocked');
    expect(snapshot.acceptanceMatrix.find((entry) => entry.requirementId === 'inventory-ready')).toEqual(expect.objectContaining({
      status: 'failed',
    }));
  });

  it('formats an operator summary without enabling sidecars or tools', () => {
    const service = createService();
    const text = service.formatSnapshotText(service.buildSnapshot());

    expect(text).toContain('Zavorth External Runtime Intent model Contract Layer');
    expect(text).toContain('Status: contract-layer-ready');
    expect(text).toContain('Envelope schemas: 11');
    expect(text).toContain('Live execution performed: false');
    expect(text).toContain('Next: 291 Preview engine - Native Engine Absorption');
  });
});

function createService(): ZavorthExternalContractLayerService {
  return new ZavorthExternalContractLayerService({
    now: () => new Date('2026-05-11T19:30:00.000Z'),
    inventoryStatus: 'inventory-ready',
  });
}
