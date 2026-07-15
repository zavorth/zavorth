import {
  buildCliOperationsDoctorSnapshot,
  formatCliOperationsDoctorSnapshot,
  formatRuntimeAccessReadinessReport,
  formatRuntimeBootstrapReport,
} from '../../src/cli/ZavorthCliNativeRenderers.runtime';

function createReadinessReport(overrides: Record<string, any> = {}) {
  const report = {
    checkedAt: '2026-05-02T10:00:00.000Z',
    runtime: {
      providers: {
        activeProviderName: 'openai',
        activeModelName: 'gpt-4o',
        preferredZavorthBridgeModel: null,
        readyCount: 1,
        needsConfigurationCount: 0,
        needsProbeCount: 0,
        recommendedProfile: 'Coding',
        readyProviders: ['openai'],
        pendingConfigProviders: [],
        probeProviders: [],
        recommendations: [],
        modelPicker: {
          selected: {
            source: 'current-config',
            providerLabel: 'OpenAI',
            modelLabel: 'gpt-4o',
            readiness: 'ready',
            ready: true,
            explanation: ['Configuracao atual seleciona openai/gpt-4o.'],
          },
        },
      },
      nodeMeshSmoke: {
        status: 'passed',
        summary: 'Node Mesh ok.',
        command: 'npm run test:nodes:smoke',
        file: 'node-mesh.json',
        stale: false,
        nodeId: 'node-1',
        finalNodeStatus: 'online',
        recentCapabilityId: 'files.read',
        error: null,
      },
      channelProviderDoctor: {
        status: 'passed',
        summary: 'Canais ok.',
        stale: false,
        command: 'npm run test:channels:smoke',
        items: [{ status: 'passed' }],
      },
      remoteTransportDoctor: {
        status: 'passed',
        summary: 'Transportes ok.',
        stale: false,
        command: 'npm run test:transports:smoke',
        recommendedAction: null,
        items: [{ status: 'passed' }],
      },
    },
    auth: { enabled: true, source: 'env', tokenFile: 'token.txt' },
    local: {
      baseUrl: 'http://127.0.0.1:33333',
      dashboardUrl: 'http://127.0.0.1:33333/',
      appUrl: 'http://127.0.0.1:33333/dashboard',
      ready: true,
      issues: [],
    },
    remote: {
      baseUrl: 'https://zavorth.example.com',
      appUrl: 'https://zavorth.example.com/zavorthControl',
      ready: true,
      issues: [],
    },
    recommendations: ['O Model Picker compartilhado selecionou OpenAI/gpt-4o (ready).'],
    nextSteps: [],
    summary: 'Zavorth pronto para uso local e remoto.',
    ...overrides,
  };
  return report as any;
}

describe('Zavorth CLI runtime renderers model picker', () => {
  it('shows the shared selected model in doctor output', async () => {
    const snapshot = await buildCliOperationsDoctorSnapshot(
      createReadinessReport(),
      {} as any,
      { userId: 'operator', platform: 'cli' } as any,
    );

    const text = formatCliOperationsDoctorSnapshot(snapshot);

    expect(snapshot.providers).toMatchObject({
      providerLabel: 'OpenAI',
      modelLabel: 'gpt-4o',
      readiness: 'ready',
      ready: true,
    });
    expect(text).toContain('Modelo atual: OpenAI/gpt-4o pronto.');
  });

  it('shows the shared selected model in access and bootstrap summaries', () => {
    const accessText = formatRuntimeAccessReadinessReport(createReadinessReport());
    const bootstrapText = formatRuntimeBootstrapReport({
      checkedAt: '2026-05-02T10:00:00.000Z',
      projectRoot: 'C:/tmp/zavorth',
      env: {
        envFilePresent: true,
        llmProvider: 'openai',
        llmCredentialReady: true,
        issues: [],
        selectedModel: {
          source: 'current-config',
          providerName: 'openai',
          providerLabel: 'OpenAI',
          modelName: 'gpt-4o',
          modelLabel: 'gpt-4o',
          routeId: 'openai',
          readiness: 'ready',
          ready: true,
          explanation: ['Configuracao atual seleciona openai/gpt-4o.'],
        },
      },
      dependencies: { installRequired: false, buildRequired: false },
      platforms: [],
      supervisedRuntime: {} as any,
      actions: [],
      summary: 'Bootstrap fechado.',
    });

    expect(accessText).toContain('model: OpenAI/gpt-4o (ready)');
    expect(bootstrapText).toContain('provider: OpenAI/gpt-4o (ready)');
  });
});
