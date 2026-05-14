import {
  ExternalAgentNativeReplacementRegistry,
  ExternalAgentWorkerBridge,
  FixtureExternalAgentWorkerClient,
  canonicalizeNativeReplacementContract,
} from '../../../src/runtime/external-agents/index.js';
import {
  FixtureExternalExecutorSidecarClient,
  QuarantinedExternalExecutorSidecarAdapter,
} from '../../../src/runtime/external-agents/external-executor/index.js';

describe('Plan 111 Phase 9 native replacement registry', () => {
  it('marks adapter-backed behavior removable only after Zavorth-native parity passes', async () => {
    const adapter = new QuarantinedExternalExecutorSidecarAdapter({
      client: new FixtureExternalExecutorSidecarClient(),
      now: () => new Date('2026-04-28T01:00:00.000Z'),
    });
    const registry = new ExternalAgentNativeReplacementRegistry({
      now: () => new Date('2026-04-28T01:01:00.000Z'),
      forbiddenSourceTerms: ['ExternalExecutor'],
    });
    const [event] = await adapter.pullTestEvents();
    const adapterMessage = adapter.normalizeEvent(event);
    const nativeMessage = canonicalizeNativeReplacementContract(adapterMessage);
    const capabilities = await adapter.listCapabilities();
    const adapterProvider = adapter.normalizeCapabilityProvider(capabilities);
    const nativeProvider = canonicalizeNativeReplacementContract(adapterProvider);
    const workerBridge = new ExternalAgentWorkerBridge({
      adapter,
      client: new FixtureExternalAgentWorkerClient({
        now: () => new Date('2026-04-28T01:02:00.000Z'),
      }),
      now: () => new Date('2026-04-28T01:03:00.000Z'),
    });
    const workerTask = await workerBridge.delegateTask({
      request: {
        userId: 'grey',
        channel: 'web',
        sessionId: 'session-phase9-worker',
        text: 'execute como substituicao nativa governada',
      },
      workerId: 'fixture-local',
      runId: 'run-phase9-worker',
      timeoutMs: 5000,
    });
    const adapterExecutorResult = workerBridge.toExecutorResult(workerTask);
    const nativeExecutorResult = canonicalizeNativeReplacementContract(adapterExecutorResult);

    registry.register({
      id: 'native-normalized-inbound',
      label: 'Zavorth normalized inbound replacement',
      area: 'gateway-event',
      nativeContract: 'NormalizedInboundMessage',
      adapterPath: 'src/runtime/external-agents/ExternalAgentSidecarAdapter.ts',
      nativePath: 'src/runtime/agent/contracts/index.ts',
      publicSurfaceIds: ['NormalizedInboundMessage', 'ZavorthAgentGateway.handle'],
      parityCases: [
        {
          id: 'event-normalization-parity',
          label: 'event normalization parity',
          contract: 'NormalizedInboundMessage',
          adapterBehavior: adapterMessage,
          nativeBehavior: nativeMessage,
        },
      ],
    });
    registry.register({
      id: 'native-capability-policy',
      label: 'Zavorth capability policy replacement',
      area: 'capability-policy',
      nativeContract: 'ToolExposurePolicyInput',
      adapterPath: 'src/runtime/external-agents/ExternalAgentCapabilityProvider.ts',
      nativePath: 'src/runtime/agent/ToolExposurePolicy.ts',
      publicSurfaceIds: ['ToolExposurePolicyInput', 'UniversalToolExposureProfile'],
      parityCases: [
        {
          id: 'capability-policy-parity',
          label: 'capability policy parity',
          contract: 'ToolExposurePolicyInput',
          adapterBehavior: adapterProvider,
          nativeBehavior: nativeProvider,
        },
      ],
    });
    registry.register({
      id: 'native-worker-executor-result',
      label: 'Zavorth worker executor replacement',
      area: 'worker-delegation',
      nativeContract: 'UniversalAgentExecutorResult',
      adapterPath: 'src/runtime/external-agents/ExternalAgentWorkerBridge.ts',
      nativePath: 'src/runtime/agent/AgentRunService.ts',
      publicSurfaceIds: ['UniversalAgentExecutorResult', 'UniversalArtifactSummary'],
      parityCases: [
        {
          id: 'worker-result-parity',
          label: 'worker result parity',
          contract: 'UniversalAgentExecutorResult',
          adapterBehavior: adapterExecutorResult,
          nativeBehavior: nativeExecutorResult,
        },
      ],
    });

    const plan = registry.buildPlan();

    expect(plan).toEqual(expect.objectContaining({
      version: 'external-agent-native-replacement-plan/v1',
      status: 'ready',
      summary: {
        total: 3,
        parityReady: 3,
        blocked: 0,
        removableAdapters: 3,
      },
      guarantee: {
        adapterDependencyOptionalOrRemovable: true,
        publicSurfacesZavorthNative: true,
        sourceModulesCopied: false,
      },
    }));
    expect(plan.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'native-normalized-inbound',
        status: 'parity-ready',
        adapterPathStatus: 'optional-removable',
        canRemoveAdapter: true,
      }),
      expect.objectContaining({
        id: 'native-capability-policy',
        status: 'parity-ready',
        adapterPathStatus: 'optional-removable',
        canRemoveAdapter: true,
      }),
      expect.objectContaining({
        id: 'native-worker-executor-result',
        status: 'parity-ready',
        adapterPathStatus: 'optional-removable',
        canRemoveAdapter: true,
      }),
    ]));
    expect(plan.candidates.flatMap((candidate) => candidate.parity)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'event-normalization-parity',
        passed: true,
      }),
      expect.objectContaining({
        id: 'capability-policy-parity',
        passed: true,
      }),
      expect.objectContaining({
        id: 'worker-result-parity',
        passed: true,
      }),
    ]));
    expect(JSON.stringify(plan)).not.toContain('ExternalExecutor');
  });

  it('blocks replacement if public native surfaces leak source identity', () => {
    const registry = new ExternalAgentNativeReplacementRegistry({
      now: () => new Date('2026-04-28T01:10:00.000Z'),
      forbiddenSourceTerms: ['ExternalExecutor'],
    });
    registry.register({
      id: 'bad-source-branded-replacement',
      label: 'ExternalExecutor copied dashboard replacement',
      area: 'command-center',
      nativeContract: 'ZavorthCommandCenterAssimilationSnapshot',
      adapterPath: 'src/runtime/external-agents/external-executor/QuarantinedExternalExecutorSidecarAdapter.ts',
      nativePath: 'src/ai-gateway/app/(dashboard)/control/command-center/projections/zavorthCommandCenterAssimilationProjection.ts',
      publicSurfaceIds: ['ExternalExecutorDashboardWidget'],
      parityCases: [
        {
          id: 'bad-dashboard-parity',
          label: 'bad dashboard parity',
          contract: 'ZavorthCommandCenterAssimilationSnapshot',
          adapterBehavior: { contractVersion: 'zavorth-command-center-assimilation/v1' },
          nativeBehavior: { contractVersion: 'zavorth-command-center-assimilation/v1' },
        },
      ],
    });

    const plan = registry.buildPlan();

    expect(plan.status).toBe('blocked');
    expect(plan.candidates[0]).toEqual(expect.objectContaining({
      status: 'blocked',
      adapterPathStatus: 'required-until-parity',
      canRemoveAdapter: false,
      identityLeaks: expect.arrayContaining([
        expect.objectContaining({
          value: expect.stringContaining('ExternalExecutor'),
        }),
      ]),
    }));
    expect(plan.guarantee.publicSurfacesZavorthNative).toBe(false);
  });

  it('blocks replacement if a candidate requests source module copy', () => {
    const registry = new ExternalAgentNativeReplacementRegistry({
      now: () => new Date('2026-04-28T01:15:00.000Z'),
      forbiddenSourceTerms: ['ExternalExecutor'],
    });
    registry.register({
      id: 'copied-source-module',
      label: 'Zavorth replacement with forbidden source copy request',
      area: 'gateway-event',
      nativeContract: 'NormalizedInboundMessage',
      adapterPath: 'src/runtime/external-agents/ExternalAgentSidecarAdapter.ts',
      nativePath: 'src/runtime/agent/contracts/index.ts',
      publicSurfaceIds: ['NormalizedInboundMessage'],
      rules: {
        sourceModulesCopied: true,
      } as never,
      parityCases: [
        {
          id: 'copied-module-parity',
          label: 'copied module parity',
          contract: 'NormalizedInboundMessage',
          adapterBehavior: { channel: 'web', text: 'hello' },
          nativeBehavior: { channel: 'web', text: 'hello' },
        },
      ],
    });

    const plan = registry.buildPlan();

    expect(plan.status).toBe('blocked');
    expect(plan.candidates[0]).toEqual(expect.objectContaining({
      status: 'blocked',
      adapterPathStatus: 'required-until-parity',
      canRemoveAdapter: false,
      rules: expect.objectContaining({
        sourceModulesCopied: false,
      }),
      ruleViolations: expect.arrayContaining([
        expect.stringContaining('Source runtime modules cannot be copied'),
      ]),
    }));
    expect(plan.guarantee.sourceModulesCopied).toBe(false);
  });

  it('keeps the adapter path required when parity tests are missing or failing', () => {
    const registry = new ExternalAgentNativeReplacementRegistry({
      now: () => new Date('2026-04-28T01:20:00.000Z'),
      forbiddenSourceTerms: ['ExternalExecutor'],
    });
    registry.register({
      id: 'missing-parity',
      label: 'Zavorth native candidate without parity',
      area: 'session-memory',
      nativeContract: 'CanonicalSessionContextSnapshot',
      adapterPath: 'src/runtime/external-agents/ExternalAgentSessionMemoryBridge.ts',
      nativePath: 'src/runtime/agent/context/CanonicalSessionContextAssembler.ts',
      publicSurfaceIds: ['CanonicalSessionContextSnapshot'],
      parityCases: [],
    });
    registry.register({
      id: 'failing-parity',
      label: 'Zavorth native candidate with failing parity',
      area: 'channel-bridge',
      nativeContract: 'UniversalReplyPacket',
      adapterPath: 'src/runtime/external-agents/ExternalAgentChannelBridge.ts',
      nativePath: 'src/runtime/reply/ReplyPipeline.ts',
      publicSurfaceIds: ['UniversalReplyPacket'],
      parityCases: [
        {
          id: 'reply-parity',
          label: 'reply parity',
          contract: 'UniversalReplyPacket',
          adapterBehavior: { id: 'reply-1', text: 'adapter reply' },
          nativeBehavior: { id: 'reply-1', text: 'native reply' },
        },
      ],
    });

    const plan = registry.buildPlan();

    expect(plan.status).toBe('blocked');
    expect(plan.summary).toEqual({
      total: 2,
      parityReady: 0,
      blocked: 2,
      removableAdapters: 0,
    });
    expect(plan.candidates).toEqual([
      expect.objectContaining({
        id: 'missing-parity',
        status: 'blocked',
        adapterPathStatus: 'required-until-parity',
        parity: [],
      }),
      expect.objectContaining({
        id: 'failing-parity',
        status: 'blocked',
        adapterPathStatus: 'required-until-parity',
        parity: [
          expect.objectContaining({
            id: 'reply-parity',
            passed: false,
          }),
        ],
      }),
    ]);
    expect(plan.guarantee.adapterDependencyOptionalOrRemovable).toBe(false);
  });
});
