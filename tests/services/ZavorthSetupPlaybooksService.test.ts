import { DashboardSetupChecklistService } from '../../src/services/DashboardSetupChecklistService.js';
import { ExecutionBackendPlaybookService } from '../../src/services/ExecutionBackendPlaybookService.js';
import { ProviderConnectionPlaybookService } from '../../src/services/ProviderConnectionPlaybookService.js';

describe('Zavorth setup playbooks', () => {
  const now = () => new Date('2026-06-04T12:00:00.000Z');

  it('builds a provider playbook without serializing secret values or claiming catalog as live', () => {
    const service = new ProviderConnectionPlaybookService({
      now,
      providerMatrixService: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: '2026-06-04T12:00:00.000Z',
          entries: [
            {
              id: 'openai',
              label: 'OpenAI',
              providerName: 'OpenAI',
              providerId: 'openai',
              familyIds: ['openai'],
              routeKind: 'native',
              routeClass: 'cloud',
              mode: 'chat',
              credentialKind: 'api-key',
              credentialRefs: ['OPENAI_API_KEY'],
              requirements: ['OPENAI_MODEL'],
              currentModelName: 'gpt-4o',
              capabilities: ['chat'],
              status: 'missing_auth',
              catalogReady: true,
              liveReady: false,
              defaultRouteAllowed: false,
              readinessProof: 'catalog',
              defaultBlockReason: 'Missing auth.',
              authConfigured: false,
              baseUrlConfigured: true,
              discoverySupported: true,
              health: null,
              issue: null,
              explanation: [],
              userAction: 'Add OPENAI_API_KEY.',
              testCommand: 'zavorth providers test openai',
              probe: {
                status: 'ready_to_probe',
                mode: 'catalog_only',
                liveNetworkUsed: false,
                requestedAt: null,
                completedAt: null,
                durationMs: null,
                target: null,
                httpStatus: null,
                modelCount: null,
                evidenceHash: null,
                summary: 'Ready after auth.',
              },
              rawSecretsPresent: false,
            },
          ],
        } as any)),
      },
    });

    const snapshot = service.buildSnapshot({ providerId: 'openai' });

    expect(snapshot.selected?.status).toBe('needs-auth');
    expect(snapshot.selected?.missingInputKeys).toEqual(['OPENAI_API_KEY']);
    expect(snapshot.selected?.readiness.liveReady).toBe(false);
    expect(snapshot.selected?.safety.rawSecretsSerialized).toBe(false);
    expect(JSON.stringify(snapshot)).not.toContain('sk-');
  });

  it('builds an execution backend playbook that keeps Docker dry until configured and approved', () => {
    const service = new ExecutionBackendPlaybookService({
      now,
      terminalBackendsService: {
        execute: jest.fn(() => ({
          generatedAt: '2026-06-04T12:00:00.000Z',
          selectedBackend: 'docker',
          status: 'preview',
          backends: [
            {
              id: 'docker',
              label: 'Docker container',
              status: 'needs-configuration',
              isolation: 'container',
              liveCapable: true,
              liveReady: false,
              requiresConfiguration: ['Docker daemon reachable', 'container image'],
              defaultCommand: 'docker run ...',
              nextCommand: 'set ZAVORTH_DOCKER_ENABLED=true',
              limitations: ['Network disabled by default.'],
            },
          ],
          safety: {
            noBackendLiveByDefault: true,
            highRiskRequiresApproval: true,
            backendConfigRequiredForRemoteExecution: true,
            commandEnvelopeUsesStructuredArgs: true,
            stdoutStderrRedacted: true,
            receiptsRequired: true,
            cloudBackendsRequireExplicitConfiguration: true,
          },
        } as any)),
      },
    });

    const snapshot = service.buildSnapshot({ backendId: 'docker' });

    expect(snapshot.selected?.backendId).toBe('docker');
    expect(snapshot.selected?.status).toBe('needs-configuration');
    expect(snapshot.selected?.liveMutationAllowedByDefault).toBe(false);
    expect(snapshot.selected?.steps.find((step) => step.id === 'run-strong-smoke')?.status).toBe('blocked');
    expect(snapshot.selected?.safety.dryRunWhenStrongSandboxMissing).toBe(true);
  });

  it('projects a dashboard setup checklist without execution authority', () => {
    const service = new DashboardSetupChecklistService({
      now,
      channelPlaybook: {
        buildSnapshot: jest.fn(() => ({
          summary: { defaultRouteAllowed: 0, readyToValidate: 1, liveReady: 0 },
          selected: null,
        } as any)),
      },
      providerPlaybook: {
        buildSnapshot: jest.fn(() => ({
          summary: { defaultRouteAllowed: 0, readyToProbe: 1, liveReady: 0 },
          selected: null,
        } as any)),
      },
      backendPlaybook: {
        buildSnapshot: jest.fn(() => ({
          summary: { strongSandboxReady: 0, previewReady: 1, liveReady: 0 },
          selected: null,
        } as any)),
      },
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.items.map((item) => item.id)).toEqual([
      'connect-telegram',
      'connect-provider',
      'configure-executor',
      'review-memory',
      'install-skills-governed',
      'schedule-with-preview',
      'run-profile-mission',
      'run-quality-evals',
    ]);
    expect(snapshot.items.map((item) => item.area)).toEqual([
      'channel',
      'provider',
      'execution-backend',
      'memory',
      'skill',
      'scheduler',
      'mission',
      'quality',
    ]);
    expect(snapshot.items.every((item) => item.href.startsWith('/control'))).toBe(true);
    expect(snapshot.items.find((item) => item.id === 'review-memory')?.summary).toContain('origem');
    expect(snapshot.items.find((item) => item.id === 'install-skills-governed')?.summary).toContain('MCP');
    expect(snapshot.items.find((item) => item.id === 'schedule-with-preview')?.summary).toContain('prompt final');
    expect(snapshot.items.find((item) => item.id === 'run-profile-mission')?.summary).toContain('receipt');
    expect(snapshot.items.find((item) => item.id === 'run-quality-evals')?.summary).toContain('approval fatigue');
    expect(snapshot.safety).toEqual({
      projectionOnly: true,
      rawSecretsSerialized: false,
      liveActionsRemainApprovalBound: true,
    });
  });
});
