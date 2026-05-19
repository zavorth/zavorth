import { buildDefaultZavorthGuidedMissionTemplates } from '../../src/contracts/ZavorthFirstRunProductJourneyContract.js';
import { buildZavorthProductModeContract } from '../../src/contracts/ZavorthProductModeContract.js';
import { ZavorthUnifiedOnboardingService } from '../../src/services/ZavorthUnifiedOnboardingService.js';
import type { ZavorthProductizationProtectedRuntimeSnapshot } from '../../src/services/ZavorthProductizationProtectedRuntimeService.js';

describe('ZavorthUnifiedOnboardingService', () => {
  it('unifies setup, go, doctor, templates and first mission into one read-only journey', () => {
    const service = new ZavorthUnifiedOnboardingService({
      now: () => new Date('2026-05-13T12:00:00.000Z'),
      productization: productizationStub('ready'),
      providerDoctor: providerDoctorStub({ ready: 1, missingAuth: 2, needsProbe: 1 }),
    });

    const snapshot = service.buildSnapshot({
      dailyMode: 'personal',
      detailMode: 'simple',
    });

    expect(snapshot.contractVersion).toBe('2026-05-13.checkpoint-2');
    expect(snapshot.status).toBe('ready');
    expect(snapshot.steps.map((step) => step.id)).toEqual([
      'mode',
      'provider',
      'workspace',
      'sandbox',
      'channels',
      'template',
      'first-mission',
    ]);
    expect(snapshot.commands.map((entry) => entry.command)).toEqual(expect.arrayContaining([
      'zavorth onboard',
      'zavorth go',
      'zavorth doctor --simple',
      'zavorth templates',
      'zavorth gateway status',
    ]));
    expect(snapshot.safeDemo.readOnly).toBe(true);
    expect(snapshot.commandCenterProjection.executionAuthority).toBe(false);
  });

  it('marks provider setup as needed when no provider is ready', () => {
    const service = new ZavorthUnifiedOnboardingService({
      now: () => new Date('2026-05-13T12:00:00.000Z'),
      productization: productizationStub('fallback'),
      providerDoctor: providerDoctorStub({ ready: 0, missingAuth: 3, needsProbe: 2 }),
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.status).toBe('needs_setup');
    expect(snapshot.provider.status).toBe('missing_auth');
    expect(snapshot.steps.find((step) => step.id === 'provider')?.status).toBe('needs_input');
    expect(snapshot.steps.find((step) => step.id === 'sandbox')?.safeDefault).toContain('dry-run');
  });
});

function providerDoctorStub(input: { ready: number; missingAuth: number; needsProbe: number }) {
  const readyProviders = Array.from({ length: input.ready }, (_, index) => ({
    id: `ready-${index}`,
    effectiveProviderName: `ready-${index}`,
  }));
  const pendingConfigProviders = Array.from({ length: input.missingAuth }, (_, index) => ({
    id: `missing-${index}`,
    effectiveProviderName: `missing-${index}`,
  }));
  const probeProviders = Array.from({ length: input.needsProbe }, (_, index) => ({
    id: `probe-${index}`,
    effectiveProviderName: `probe-${index}`,
  }));
  return {
    inspect: () => ({
      activeProviderName: readyProviders[0]?.id || 'none',
      activeModelName: readyProviders[0] ? 'model-ready' : 'none',
      preferredZavorthBridgeModel: null,
      providers: [...readyProviders, ...pendingConfigProviders, ...probeProviders],
      readyProviders,
      pendingConfigProviders,
      probeProviders,
      profiles: [],
      recommendedProfile: {},
      modelPicker: {},
      recommendations: input.ready > 0
        ? ['Provider is ready; run the safe first mission.']
        : ['Configure OPENAI_API_KEY, GEMINI_API_KEY or another provider credential.'],
    } as any),
  };
}

function productizationStub(sandboxStatus: 'ready' | 'fallback') {
  return {
    buildSnapshot: (): ZavorthProductizationProtectedRuntimeSnapshot => {
      const generatedAt = '2026-05-13T12:00:00.000Z';
      const templates = buildDefaultZavorthGuidedMissionTemplates();
      const productMode = buildZavorthProductModeContract();
      return {
        schemaVersion: 1,
        surface: 'productization-protected-runtime',
        generatedAt,
        status: 'ready',
        productMode,
        firstRun: {
          schemaVersion: 1,
          surface: 'first-run-product-journey',
          generatedAt,
          selected: productMode.selected,
          status: 'ready',
          primaryCommands: {
            onboard: 'zavorth onboard',
            go: 'zavorth go',
            doctorSimple: 'zavorth doctor --simple',
            doctorAdvanced: 'zavorth doctor --advanced',
            templates: 'zavorth templates',
          },
          steps: [],
          templates,
          safeDemoRun: {
            templateId: 'dev-repo-review',
            command: 'zavorth missions --template=dev-repo-review',
            mutatesWorkspace: false,
            summary: 'Read-only repository review.',
          },
        },
        sandbox: {
          schemaVersion: 1,
          surface: 'sandbox-readiness',
          generatedAt,
          status: sandboxStatus,
          mutationMode: sandboxStatus === 'ready' ? 'sandbox' : 'dry-run',
          readOnlyAllowed: true,
          previewAllowed: true,
          strongSandboxAvailable: sandboxStatus === 'ready',
          preferredStrongTier: sandboxStatus === 'ready' ? 'docker' : null,
          readyTiers: sandboxStatus === 'ready' ? ['docker'] : ['local-jail'],
          fallback: {
            active: sandboxStatus !== 'ready',
            reason: sandboxStatus === 'ready' ? 'Strong sandbox available.' : 'Strong sandbox missing.',
            mutatingActions: sandboxStatus === 'ready' ? 'sandboxed' : 'dry-run-only',
            userAction: sandboxStatus === 'ready' ? 'Continue.' : 'Install Docker or keep dry-run.',
          },
          blockers: [],
          host: {} as any,
        },
        templates,
        mission: {} as any,
        receipt: {} as any,
        commandCenterProjection: {
          route: '/dashboard',
          executionAuthority: false,
          approvalRequiredForMutableActions: true,
          visualBlocksRequireOwnerApproval: true,
          endpoints: [],
        },
        cli: {
          commands: [],
          mirrorsWebProjection: true,
        },
        distribution: {
          privateExecutableFirst: true,
          npmDevInternalPath: true,
          proprietaryLicenseRequired: true,
          publicClaimsMustBeCurrent: true,
        },
        certification: {
          gate: 'test',
          checks: [],
        },
      };
    },
  };
}
