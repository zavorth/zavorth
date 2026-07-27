import { CapabilityAutopilotReadinessService } from '../../src/services/CapabilityAutopilotReadinessService';
import type { CapabilityDefinition } from '../../src/contracts/CapabilityContract';
import type {
  InstalledIntegrationState,
  IntegrationManifest,
  IntegrationProbeSnapshot,
  IntegrationRequirement,
  IntegrationResolution,
} from '../../src/contracts/IntegrationHubContract';
import type {
  CapabilityManifest,
  CapabilityStateSnapshot,
} from '../../src/services/CapabilityLifecycleService';

const FIXED_NOW = new Date('2026-04-25T12:00:00.000Z');

const geminiCapability: CapabilityDefinition = {
  id: 'executor-gemini-cli',
  label: 'Gemini CLI',
  type: 'executor',
  description: 'Runs tasks through Gemini CLI.',
  intent: 'code_execution',
  executor_preference: 'gemini_cli',
  dispatch_mode: 'execution',
  requires_planning: false,
  command: {
    command: 'gemini',
    aliases: ['gcli'],
    description: 'Runs task through Gemini CLI.',
    explicit_executor: 'gemini_cli',
  },
};

const geminiBinaryRequirement: IntegrationRequirement = {
  id: 'gemini_cli_binary',
  type: 'binary',
  label: 'Gemini CLI binary',
  description: 'Gemini command must be installed and visible on PATH.',
  required: true,
};

const geminiIntegration: IntegrationManifest = {
  id: 'gemini',
  label: 'Gemini',
  aliases: ['gemini-cli', 'gcli'],
  summary: 'Google Gemini API/CLI.',
  description: 'Integra Gemini por API ou CLI.',
  supportLevel: 'native',
  category: 'local',
  tags: ['gemini', 'cli'],
  modes: [
    {
      id: 'cli',
      label: 'CLI',
      summary: 'Usar Gemini CLI local.',
      autoInstallable: false,
      safeByDefault: true,
    },
  ],
  defaultMode: 'cli',
  capabilities: ['code', 'chat'],
  binding: {
    kind: 'executor',
    key: 'gemini_cli',
    status: 'partial',
    summary: 'Executor Gemini CLI.',
  },
  requirements: [geminiBinaryRequirement],
  onboardingQuestions: [],
  installSteps: [
    {
      id: 'install-gemini-cli',
      title: 'Instalar Gemini CLI',
      description: 'Install the local CLI before running prompts.',
      kind: 'guided',
      blocking: true,
    },
  ],
  safetyNotes: ['Not instalar automatically sem permission.'],
  goodFor: ['Local execution of code prompts.'],
};

const lifecycleManifest: CapabilityManifest = {
  id: 'executor-gemini-cli',
  label: 'Gemini CLI lifecycle',
  description: 'Lifecycle fixture for Gemini CLI.',
  availability: 'optional',
  activationMode: 'lazy',
  approvalRequired: true,
  enabledByDefaultProfiles: ['full'],
  idleTtlMs: null,
  estimatedFootprint: {
    ramIdleMb: 1,
    diskMb: 1,
    processCount: 0,
  },
  provisioningRecipe: null,
  cleanupPaths: [],
  fallbackBehavior: 'Use another executor only if the user permits.',
};

const readyLifecycleState: CapabilityStateSnapshot = {
  capabilityId: 'executor-gemini-cli',
  label: 'Gemini CLI lifecycle',
  state: 'ready',
  activationMode: 'lazy',
  approvalRequired: true,
  enabledByProfile: true,
  enabledByUser: true,
  approvalScope: 'session',
  idleTtlMs: null,
  fallbackBehavior: 'Use another executor only if the user permits.',
  estimatedFootprint: {
    ramIdleMb: 1,
    diskMb: 1,
    processCount: 0,
  },
  lastUpdatedAt: FIXED_NOW.toISOString(),
};

const installedGemini: InstalledIntegrationState = {
  id: 'gemini',
  nickname: null,
  requestedBy: 'tester',
  status: 'configured',
  selectedMode: 'cli',
  enabledCapabilities: ['code'],
  answers: {},
  createdAt: FIXED_NOW.toISOString(),
  updatedAt: FIXED_NOW.toISOString(),
  configuredAt: FIXED_NOW.toISOString(),
  lastHealthCheckAt: FIXED_NOW.toISOString(),
  lastHealthStatus: 'ok',
  notes: [],
};

const okProbe: IntegrationProbeSnapshot = {
  generatedAt: FIXED_NOW.toISOString(),
  integrationId: 'gemini',
  label: 'Gemini',
  status: 'ok',
  transport: 'cli',
  summary: 'Gemini CLI responded.',
  detail: 'gemini --version retornou sucesso.',
  checkedTarget: 'gemini --version',
  httpStatus: null,
  latencyMs: 10,
};

function createService(options: {
  missingRequirements-: IntegrationRequirement[];
  probe-: IntegrationProbeSnapshot | null;
  lifecycleState-: CapabilityStateSnapshot | null;
  executorAvailable-: boolean | null;
} = {}) {
  const missingRequirements = options.missingRequirements || [];
  const probe = options.probe ?? null;
  const lifecycleState = options.lifecycleState === undefined
    ? readyLifecycleState
    : options.lifecycleState;

  return new CapabilityAutopilotReadinessService({
    now: () => FIXED_NOW,
    capabilityRegistry: {
      getAll: () => [geminiCapability],
    },
    lifecycleService: {
      getManifests: () => [lifecycleManifest],
      getManifest: (capabilityId: string) => capabilityId === lifecycleManifest.id ? lifecycleManifest : null,
      describeCapability: (capabilityId: string) => capabilityId === lifecycleManifest.id ? lifecycleState : null,
    },
    integrationRegistryService: {
      listManifests: () => [geminiIntegration],
      getManifestById: (integrationId: string | null | undefined) =>
        integrationId === 'gemini' ? geminiIntegration : null,
      resolveRequestedIntegration: (requestedId: string | null | undefined): IntegrationResolution => {
        const normalized = String(requestedId || '').trim().toLowerCase();
        const matched = ['gemini', 'gemini-cli', 'gcli'].includes(normalized);
        return {
          requestedId: normalized,
          manifest: matched ? geminiIntegration : null,
          matchedBy: matched ? 'id' : 'none',
          suggestion: null,
          note: matched ? 'matched' : 'none',
        };
      },
    },
    integrationInstallerService: {
      getInstalled: (integrationId: string | null | undefined) =>
        integrationId === 'gemini' ? installedGemini : null,
      getMissingRequirements: () => missingRequirements,
    },
    integrationProbeService: {
      getLatestProbe: (integrationId: string) => integrationId === 'gemini' ? probe : null,
    },
    executorAvailabilityResolver: options.executorAvailable === undefined
      ? undefined
      : async () => options.executorAvailable ?? null,
  });
}

describe('CapabilityAutopilotReadinessService', () => {
  it('builds an operational descriptor from registry, lifecycle and integration data', () => {
    const service = createService();

    const descriptor = service.getOperationalDescriptor('executor-gemini-cli');

    expect(descriptor).toMatchObject({
      capabilityId: 'executor-gemini-cli',
      label: 'Gemini CLI',
      type: 'executor',
      integration: {
        integrationId: 'gemini',
      },
      lifecycle: {
        manifestId: 'executor-gemini-cli',
        state: 'ready',
      },
      executor: {
        executorName: 'gemini_cli',
        available: null,
      },
      fallbackMode: 'ask_before_switch',
    });
    expect(descriptor?.hooks.map((hook) => hook.owner)).toEqual(
      expect.arrayContaining(['capability_registry', 'capability_lifecycle', 'integration_probe', 'execution_gateway']),
    );
  });

  it('reports missing readiness when required capability requirements are absent', async () => {
    const service = createService({
      missingRequirements: [geminiBinaryRequirement],
      executorAvailable: true,
    });

    const snapshot = await service.buildReadinessSnapshot('executor-gemini-cli');

    expect(snapshot).toMatchObject({
      capabilityId: 'executor-gemini-cli',
      status: 'missing',
      ready: false,
      safeToRun: false,
      suggestedNextAction: {
        repairable: true,
      },
    });
    expect(snapshot.missingRequirements).toHaveLength(1);
    expect(snapshot.checkedTargets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'binary',
          status: 'missing',
        }),
      ]),
    );
  });

  it('reports ready when lifecycle, probe and executor availability are healthy', async () => {
    const service = createService({
      probe: okProbe,
      executorAvailable: true,
    });

    const snapshot = await service.buildReadinessSnapshot('executor-gemini-cli');

    expect(snapshot).toMatchObject({
      capabilityId: 'executor-gemini-cli',
      status: 'ready',
      severity: 'info',
      ready: true,
      safeToRun: true,
      probe: {
        status: 'ok',
      },
      executor: {
        executorName: 'gemini_cli',
        available: true,
      },
    });
    expect(snapshot.evidence.map((entry) => entry.kind)).toEqual(
      expect.arrayContaining(['capability_registry', 'lifecycle_manifest', 'integration_registry', 'integration_probe', 'executor']),
    );
  });
});
