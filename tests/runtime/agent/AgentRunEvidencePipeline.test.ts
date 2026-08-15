import {
  AgentRunEvidencePipeline,
  AgentRunEvidenceStore,
  type AgentRunEvidencePipelineStep,
} from '../../../src/runtime/agent/index.js';

describe('AgentRunEvidencePipeline', () => {
  function createPipeline(calls: string[]) {
    const stepIds = [
      'memoryWithReceipts',
      'skillMcpQuarantine',
      'universalIntentTrustEnforcement',
      'capabilityNegotiation',
      'toolRehearsal',
      'providerArena',
      'providerMeshConsolidation',
      'crossChannelContinuity',
      'agentTeamCompiler',
      'askBeforeAssumptionPolicy',
      'artifactMemory',
      'personalOpsAutopilot',
      'selfingZavorthControl',
      'runArtifactReceiptReplay',
      'productizationEvidence',
      'productEntryRuntime',
      'releaseInstallerRollbackPath',
      'publicSiteDocsDemoSync',
      'feedbackTelemetryProductLoop',
      'publicAdoptionPilotLoop',
      'integrationShowcasePartnerSurface',
      'releaseAdoptionReadiness',
      'releaseCandidatePreCanaryGate',
      'blueprintCompletionGate',
      'capabilityLoopGovernance',
    ] as const;
    const steps: AgentRunEvidencePipelineStep[] = stepIds.map((id) => ({
      id,
      apply: () => calls.push(id),
    }));
    return new AgentRunEvidencePipeline({ steps });
  }

  function createAsyncPipeline(calls: string[], jobs: any[]) {
    const stepIds = [
      'memoryWithReceipts',
      'skillMcpQuarantine',
      'universalIntentTrustEnforcement',
      'capabilityNegotiation',
      'toolRehearsal',
      'providerArena',
      'providerMeshConsolidation',
      'crossChannelContinuity',
      'agentTeamCompiler',
      'askBeforeAssumptionPolicy',
      'artifactMemory',
      'personalOpsAutopilot',
      'selfingZavorthControl',
      'runArtifactReceiptReplay',
      'productizationEvidence',
      'productEntryRuntime',
      'releaseInstallerRollbackPath',
      'publicSiteDocsDemoSync',
      'feedbackTelemetryProductLoop',
      'publicAdoptionPilotLoop',
      'integrationShowcasePartnerSurface',
      'releaseAdoptionReadiness',
      'releaseCandidatePreCanaryGate',
      'blueprintCompletionGate',
      'capabilityLoopGovernance',
    ] as const;
    const steps: AgentRunEvidencePipelineStep[] = stepIds.map((id) => ({
      id,
      apply: () => calls.push(id),
    }));
    return new AgentRunEvidencePipeline({
      steps,
      workerMode: 'async-heavy',
      worker: {
        schedule: (job) => jobs.push(job),
      },
    });
  }

  it('keeps operational evidence ahead of product evidence for initial runs', () => {
    const calls: string[] = [];
    createPipeline(calls).applyInitial({
      run: { metadata: {} } as any,
      request: {} as any,
      generatedAt: '2026-05-06T12:00:00.000Z',
    });

    expect(calls.slice(0, 6)).toEqual([
      'memoryWithReceipts',
      'skillMcpQuarantine',
      'universalIntentTrustEnforcement',
      'capabilityNegotiation',
      'toolRehearsal',
      'providerArena',
    ]);
    expect(calls).toContain('blueprintCompletionGate');
  });

  it('keeps frontloaded evidence free of bootstrap-only steps', () => {
    const calls: string[] = [];
    const run = { metadata: {} } as any;
    const pipeline = createPipeline(calls);
    pipeline.applyFrontloaded({
      run,
      request: {} as any,
      generatedAt: '2026-05-06T12:00:00.000Z',
    });

    expect(calls).not.toContain('memoryWithReceipts');
    expect(calls).not.toContain('skillMcpQuarantine');
    expect(calls).not.toContain('universalIntentTrustEnforcement');
    expect(calls[0]).toBe('capabilityNegotiation');
    expect(run.metadata.evidenceCollectors).toEqual(expect.objectContaining({
      source: 'AgentRunEvidencePipeline',
      stage: 3,
      lastStage: 'frontloaded',
      collectorCount: 6,
      receipts: expect.arrayContaining([
        expect.objectContaining({
          collectorId: 'safety',
          stage: 'frontloaded',
          stepIds: expect.arrayContaining(['capabilityNegotiation', 'toolRehearsal']),
        }),
        expect.objectContaining({
          collectorId: 'release',
          stage: 'frontloaded',
          stepIds: expect.arrayContaining(['blueprintCompletionGate']),
        }),
      ]),
    }));
  });

  it('describes collector groups without exposing mutable internals', () => {
    const calls: string[] = [];
    const pipeline = createPipeline(calls);
    const collectors = pipeline.describeCollectors();
    collectors[0].stepIds.length = 0;

    expect(pipeline.describeCollectors()[0]).toEqual(expect.objectContaining({
      id: 'memory',
      label: 'Memory Evidence Collector',
      stepIds: expect.arrayContaining(['memoryWithReceipts', 'artifactMemory']),
    }));
  });

  it('schedules heavy collectors without blocking inline safety/runtime evidence', () => {
    const calls: string[] = [];
    const jobs: any[] = [];
    const run = { id: 'run-1', metadata: {} } as any;
    createAsyncPipeline(calls, jobs).applyFrontloaded({
      run,
      request: {} as any,
      generatedAt: '2026-05-06T12:00:00.000Z',
    });

    expect(calls).toEqual(expect.arrayContaining([
      'capabilityNegotiation',
      'toolRehearsal',
      'providerArena',
    ]));
    expect(calls).not.toContain('productizationEvidence');
    expect(calls).not.toContain('releaseCandidatePreCanaryGate');
    expect(jobs.map((job) => job.collectorId)).toEqual(expect.arrayContaining(['product', 'release']));
    expect(run.metadata.evidenceWorkers).toEqual(expect.objectContaining({
      source: 'AgentRunEvidencePipeline',
      stage: 9,
      mode: 'async-heavy',
      receipts: expect.arrayContaining([
        expect.objectContaining({ collectorId: 'product', status: 'scheduled' }),
        expect.objectContaining({ collectorId: 'release', status: 'scheduled' }),
      ]),
    }));
    expect(run.metadata.evidenceCollectors.receipts).toEqual(expect.arrayContaining([
      expect.objectContaining({ collectorId: 'product', executionMode: 'scheduled' }),
      expect.objectContaining({ collectorId: 'release', executionMode: 'scheduled' }),
    ]));

    jobs.forEach((job) => job.execute());
    expect(calls).toEqual(expect.arrayContaining([
      'productizationEvidence',
      'releaseCandidatePreCanaryGate',
    ]));
  });

  it('keeps async worker enqueue pending until confirmation', async () => {
    const calls: string[] = [];
    const jobs: any[] = [];
    const confirmations: Array<() => void> = [];
    const stepIds = [
      'capabilityNegotiation',
      'toolRehearsal',
      'providerArena',
      'productizationEvidence',
      'releaseCandidatePreCanaryGate',
      'blueprintCompletionGate',
    ] as const;
    const steps: AgentRunEvidencePipelineStep[] = stepIds.map((id) => ({
      id,
      apply: () => calls.push(id),
    }));
    const run = { id: 'run-pending-confirmation', metadata: {} } as any;

    new AgentRunEvidencePipeline({
      steps,
      workerMode: 'async-heavy',
      worker: {
        schedule: (job) => {
          jobs.push(job);
          return new Promise<void>((resolve) => confirmations.push(resolve));
        },
      },
    }).applyFrontloaded({
      run,
      request: {} as any,
      generatedAt: '2026-05-06T12:00:00.000Z',
    });

    expect(run.metadata.evidenceWorkers.receipts).toEqual(expect.arrayContaining([
      expect.objectContaining({ collectorId: 'product', status: 'pending' }),
      expect.objectContaining({ collectorId: 'release', status: 'pending' }),
    ]));
    expect(run.metadata.evidenceWorkers.receipts).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ collectorId: 'product', status: 'scheduled' }),
    ]));
    expect(run.metadata.evidenceCollectors.receipts).toEqual(expect.arrayContaining([
      expect.objectContaining({ collectorId: 'product', executionMode: 'pending' }),
      expect.objectContaining({ collectorId: 'release', executionMode: 'pending' }),
    ]));
    expect(calls).not.toContain('productizationEvidence');

    confirmations.forEach((confirm) => confirm());
    await new Promise((resolve) => setImmediate(resolve));

    expect(run.metadata.evidenceWorkers.receipts).toEqual(expect.arrayContaining([
      expect.objectContaining({ collectorId: 'product', status: 'scheduled' }),
      expect.objectContaining({ collectorId: 'release', status: 'scheduled' }),
    ]));
    expect(calls).not.toContain('productizationEvidence');
    jobs.forEach((job) => job.execute());
    expect(calls).toEqual(expect.arrayContaining([
      'productizationEvidence',
      'releaseCandidatePreCanaryGate',
    ]));
  });

  it('uses worker-first mode automatically when a worker is provided', () => {
    const calls: string[] = [];
    const jobs: any[] = [];
    const stepIds = [
      'capabilityNegotiation',
      'toolRehearsal',
      'providerArena',
      'productizationEvidence',
      'releaseCandidatePreCanaryGate',
      'blueprintCompletionGate',
    ] as const;
    const steps: AgentRunEvidencePipelineStep[] = stepIds.map((id) => ({
      id,
      apply: () => calls.push(id),
    }));
    const run = { id: 'run-2', metadata: {} } as any;
    new AgentRunEvidencePipeline({
      steps,
      worker: {
        schedule: (job) => jobs.push(job),
      },
    }).applyFrontloaded({
      run,
      request: {} as any,
      generatedAt: '2026-05-06T12:00:00.000Z',
    });

    expect(calls).toEqual(expect.arrayContaining(['capabilityNegotiation', 'toolRehearsal', 'providerArena']));
    expect(calls).not.toContain('productizationEvidence');
    expect(jobs.map((job) => job.collectorId)).toEqual(expect.arrayContaining(['product', 'release']));
    expect(run.metadata.evidenceWorkers).toEqual(expect.objectContaining({
      stage: 11,
      mode: 'worker-first-heavy',
    }));
  });

  it('falls back inline when async worker enqueue fails after scheduling', async () => {
    const calls: string[] = [];
    const stepIds = [
      'capabilityNegotiation',
      'toolRehearsal',
      'providerArena',
      'productizationEvidence',
      'releaseCandidatePreCanaryGate',
    ] as const;
    const steps: AgentRunEvidencePipelineStep[] = stepIds.map((id) => ({
      id,
      apply: () => calls.push(id),
    }));
    const run = { id: 'run-async-fallback', metadata: {} } as any;

    new AgentRunEvidencePipeline({
      steps,
      workerMode: 'async-heavy',
      worker: {
        schedule: () => Promise.reject(new Error('queue unavailable')),
      },
    }).applyFrontloaded({
      run,
      request: {} as any,
      generatedAt: '2026-05-06T12:00:00.000Z',
    });

    expect(calls).toEqual(expect.arrayContaining([
      'capabilityNegotiation',
      'toolRehearsal',
      'providerArena',
    ]));
    expect(calls).not.toContain('productizationEvidence');
    expect(run.metadata.evidenceWorkers.receipts).toEqual(expect.arrayContaining([
      expect.objectContaining({ collectorId: 'product', status: 'pending' }),
      expect.objectContaining({ collectorId: 'release', status: 'pending' }),
    ]));
    expect(run.metadata.evidenceCollectors.receipts).toEqual(expect.arrayContaining([
      expect.objectContaining({ collectorId: 'product', executionMode: 'pending' }),
      expect.objectContaining({ collectorId: 'release', executionMode: 'pending' }),
    ]));

    await new Promise((resolve) => setImmediate(resolve));

    expect(calls).toEqual(expect.arrayContaining([
      'productizationEvidence',
      'releaseCandidatePreCanaryGate',
    ]));
    expect(run.metadata.evidenceWorkers.receipts).toEqual(expect.arrayContaining([
      expect.objectContaining({ collectorId: 'product', status: 'failed' }),
      expect.objectContaining({ collectorId: 'product', status: 'fallback-inline' }),
      expect.objectContaining({ collectorId: 'release', status: 'failed' }),
      expect.objectContaining({ collectorId: 'release', status: 'fallback-inline' }),
    ]));
  });

  it('keeps evidence refs durable by run id and preserves per-key history', () => {
    const store = new AgentRunEvidenceStore();
    const run = {
      id: 'run-evidence-history',
      createdAt: '2026-05-06T12:00:00.000Z',
      updatedAt: '2026-05-06T12:00:00.000Z',
      metadata: {},
    } as any;
    const firstSnapshot = {
      source: 'FixtureEvidence',
      status: 'empty',
      generatedAt: '2026-05-06T12:00:00.000Z',
      value: 1,
    };
    const secondSnapshot = {
      source: 'FixtureEvidence',
      status: 'partial',
      generatedAt: '2026-05-06T12:00:01.000Z',
      value: 2,
    };

    const firstRef = store.put(run, 'fixtureEvidence', firstSnapshot, false);
    const secondRef = store.put(run, 'fixtureEvidence', secondSnapshot, true);
    const refs = (run.metadata.evidenceRefs as any).refs;

    expect(refs.filter((ref: any) => ref.key === 'fixtureEvidence')).toHaveLength(2);
    expect(store.get(run, 'fixtureEvidence')).toEqual(secondSnapshot);
    expect(store.getHistory(run, 'fixtureEvidence')).toEqual([
      firstSnapshot,
      secondSnapshot,
    ]);
    expect(store.getByRef(run, firstRef.id)).toEqual(firstSnapshot);
    expect(store.getByRef(run, secondRef.id)).toEqual(secondSnapshot);

    const reloadedRun = JSON.parse(JSON.stringify(run));
    const freshStore = new AgentRunEvidenceStore();

    expect(freshStore.get(reloadedRun, 'fixtureEvidence')).toEqual(secondSnapshot);
    expect(freshStore.getHistory(reloadedRun, 'fixtureEvidence')).toEqual([
      firstSnapshot,
      secondSnapshot,
    ]);
    expect(freshStore.getByRef(reloadedRun, firstRef.id)).toEqual(firstSnapshot);
    expect(freshStore.getByRef(reloadedRun, secondRef.id)).toEqual(secondSnapshot);
  });
});
