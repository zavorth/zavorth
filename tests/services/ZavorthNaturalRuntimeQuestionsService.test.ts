import { ZavorthNaturalRuntimeQuestionsService } from '../../src/services/ZavorthNaturalRuntimeQuestionsService';

describe('ZavorthNaturalRuntimeQuestionsService', () => {
  it('answers provider questions without live execution authority', () => {
    const snapshot = new ZavorthNaturalRuntimeQuestionsService({
      now: () => new Date('2026-05-15T12:00:00.000Z'),
    }).buildSnapshot({ question: 'Which providers are ready?' });

    expect(snapshot.surface).toBe('natural-runtime-questions');
    expect(snapshot.intent).toBe('providers_ready');
    expect(snapshot.runtimeProjection.executionAuthority).toBe(false);
    expect(snapshot.safety.projectionOnly).toBe(true);
    expect(snapshot.safety.noLiveNetworkByDefault).toBe(true);
    expect(snapshot.answer.cards).toHaveLength(1);
    expect(snapshot.answer.cards[0]?.id).toBe('providers');
  });

  it('routes approval questions to the Satellite approval projection', () => {
    const snapshot = new ZavorthNaturalRuntimeQuestionsService().buildSnapshot({
      question: 'Do I have pending approvals?',
    });

    expect(snapshot.intent).toBe('approvals_pending');
    expect(snapshot.answer.cards[0]?.id).toBe('approvals');
    expect(snapshot.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'approvals',
        surface: 'satellite-approval-companion',
        route: '/satellite',
        executionAuthority: false,
      }),
    ]));
  });

  it('does not misroute channel readiness questions to providers', () => {
    const snapshot = new ZavorthNaturalRuntimeQuestionsService().buildSnapshot({
      question: 'Which channels are ready?',
    });

    expect(snapshot.intent).toBe('channels_ready');
    expect(snapshot.answer.cards).toHaveLength(1);
    expect(snapshot.answer.cards[0]?.id).toBe('channels');
  });

  it('answers isolated executor questions from backend readiness without executing commands', () => {
    const terminalBackends = {
      execute: jest.fn(() => ({
        status: 'preview',
        selectedBackend: 'local',
        command: {
          raw: null,
          redacted: null,
          risk: 'read-only',
          approvalRequired: false,
          timeoutMs: 30000,
          workspace: 'C:/workspace',
        },
        plan: {
          mode: 'status-only',
          executable: null,
          args: [],
          displayCommand: null,
          backendConfigured: true,
          willExecute: false,
          reason: 'No command was provided; returning backend readiness and safety metadata.',
        },
        execution: {
          attempted: false,
          performed: false,
          exitCode: null,
          stdoutPreview: null,
          stderrPreview: null,
          error: null,
        },
        backends: [
          {
            id: 'local',
            label: 'Local supervised shell',
            status: 'ready',
            isolation: 'host-process',
            liveCapable: true,
            liveReady: true,
            requiresConfiguration: [],
            defaultCommand: 'powershell.exe -NoProfile -Command <command>',
            nextCommand: 'zavorth execution-backends --backend local --command "npm test"',
            limitations: ['No OS sandbox; mutation commands still require approval and receipts.'],
            readinessProof: {
              kind: 'local-host',
              observed: true,
              summary: 'Local supervised shell exists on this host.',
              command: null,
              rawSecretSerialized: false,
            },
          },
          {
            id: 'docker',
            label: 'Docker container',
            status: 'ready',
            isolation: 'container',
            liveCapable: true,
            liveReady: true,
            requiresConfiguration: ['Docker daemon reachable'],
            defaultCommand: 'docker run --rm --network none <image> sh -lc <command>',
            nextCommand: 'zavorth execution-backends --backend docker',
            limitations: ['Network is disabled by default.'],
            readinessProof: {
              kind: 'host-probe',
              observed: true,
              summary: '29.5.2',
              command: 'docker version --format {{.Server.Version}}',
              rawSecretSerialized: false,
            },
          },
          {
            id: 'wsl',
            label: 'WSL Linux runtime',
            status: 'ready',
            isolation: 'linux-vm',
            liveCapable: true,
            liveReady: true,
            requiresConfiguration: ['wsl.exe available'],
            defaultCommand: 'wsl.exe -- sh -lc <command>',
            nextCommand: 'zavorth execution-backends --backend wsl --command "npm test"',
            limitations: ['Workspace path translation depends on the host WSL installation.'],
            readinessProof: {
              kind: 'host-probe',
              observed: true,
              summary: 'wsl.exe responded to readiness probe.',
              command: 'wsl.exe -- sh -lc true',
              rawSecretSerialized: false,
            },
          },
        ],
        receipts: [],
        safety: {
          noBackendLiveByDefault: true,
          highRiskRequiresApproval: true,
          backendConfigRequiredForRemoteExecution: true,
          commandEnvelopeUsesStructuredArgs: true,
          stdoutStderrRedacted: true,
          receiptsRequired: true,
          cloudBackendsRequireExplicitConfiguration: true,
        },
      })),
    };
    const snapshot = new ZavorthNaturalRuntimeQuestionsService({ terminalBackends }).buildSnapshot({
      question: 'Docker e WSL estao prontos para rodar isolado?',
    });
    const serialized = JSON.stringify(snapshot);

    expect(snapshot.intent).toBe('execution_backends_ready');
    expect(snapshot.answer.cards).toHaveLength(1);
    expect(snapshot.answer.cards[0]?.id).toBe('execution-backends');
    expect(serialized).toContain('Docker');
    expect(serialized).toContain('WSL');
    expect(snapshot.runtimeProjection.executionAuthority).toBe(false);
    expect(snapshot.safety.projectionOnly).toBe(true);
    expect(terminalBackends.execute).toHaveBeenCalledWith({});
  });

  it('describes dormant on-demand executors as available instead of broken', () => {
    const terminalBackends = {
      execute: jest.fn(() => ({
        status: 'preview',
        selectedBackend: 'local',
        command: {
          raw: null,
          redacted: null,
          risk: 'read-only',
          approvalRequired: false,
          timeoutMs: 30000,
          workspace: 'C:/workspace',
        },
        plan: {
          mode: 'status-only',
          executable: null,
          args: [],
          displayCommand: null,
          backendConfigured: true,
          willExecute: false,
          reason: 'No command was provided; returning backend readiness and safety metadata.',
        },
        execution: {
          attempted: false,
          performed: false,
          exitCode: null,
          stdoutPreview: null,
          stderrPreview: null,
          error: null,
        },
        backends: [
          {
            id: 'local',
            label: 'Local supervised shell',
            status: 'ready',
            isolation: 'host-process',
            liveCapable: true,
            liveReady: true,
            installed: true,
            dormant: false,
            activationMode: 'always',
            requiresConfiguration: [],
            defaultCommand: 'powershell.exe -NoProfile -Command <command>',
            nextCommand: 'zavorth execution-backends --backend local --command "npm test"',
            limitations: ['No OS sandbox; mutation commands still require approval and receipts.'],
            readinessProof: {
              kind: 'local-host',
              observed: true,
              summary: 'Local supervised shell exists on this host.',
              command: null,
              rawSecretSerialized: false,
            },
          },
          {
            id: 'docker',
            label: 'Docker container',
            status: 'available-on-demand',
            isolation: 'container',
            liveCapable: true,
            liveReady: false,
            installed: true,
            dormant: true,
            activationMode: 'on-demand',
            requiresConfiguration: ['Docker daemon reachable when activated'],
            defaultCommand: 'docker run --rm --network none <image> sh -lc <command>',
            nextCommand: 'ask Zavorth to use Docker for this task',
            limitations: ['Kept asleep by default to save notebook resources.'],
            readinessProof: {
              kind: 'available-dormant',
              observed: true,
              summary: 'Docker CLI was found; daemon probe is deferred until a task asks for isolated execution.',
              command: 'where.exe docker',
              rawSecretSerialized: false,
            },
          },
          {
            id: 'wsl',
            label: 'WSL Linux runtime',
            status: 'available-on-demand',
            isolation: 'linux-vm',
            liveCapable: true,
            liveReady: false,
            installed: true,
            dormant: true,
            activationMode: 'on-demand',
            requiresConfiguration: ['wsl.exe available'],
            defaultCommand: 'wsl.exe -- sh -lc <command>',
            nextCommand: 'ask Zavorth to use WSL for this task',
            limitations: ['Kept asleep by default to save notebook resources.'],
            readinessProof: {
              kind: 'available-dormant',
              observed: true,
              summary: 'WSL executable was found; distro probe is deferred until a task asks for Linux execution.',
              command: 'where.exe wsl.exe',
              rawSecretSerialized: false,
            },
          },
        ],
        receipts: [],
        safety: {
          noBackendLiveByDefault: true,
          highRiskRequiresApproval: true,
          backendConfigRequiredForRemoteExecution: true,
          commandEnvelopeUsesStructuredArgs: true,
          stdoutStderrRedacted: true,
          receiptsRequired: true,
          cloudBackendsRequireExplicitConfiguration: true,
        },
      })),
    };
    const snapshot = new ZavorthNaturalRuntimeQuestionsService({ terminalBackends }).buildSnapshot({
      question: 'Docker e WSL estao disponiveis sem pesar meu notebook?',
    });
    const serialized = JSON.stringify(snapshot).toLowerCase();

    expect(snapshot.intent).toBe('execution_backends_ready');
    expect(snapshot.answer.cards[0]?.status).toBe('attention');
    expect(serialized).toContain('available on demand');
    expect(serialized).toContain('asleep');
    expect(serialized).not.toContain('not ready yet');
    expect(terminalBackends.execute).toHaveBeenCalledWith({});
  });

  it('keeps unknown questions helpful and redacts secrets', () => {
    const googleToken = ['AI', 'za', '123456789012345678901234567890'].join('');
    const snapshot = new ZavorthNaturalRuntimeQuestionsService().buildSnapshot({
      question: `sk-secretshouldnotleak123456789 ${googleToken} Bearer abc.def.ghi what can you explain?`,
    });
    const serialized = JSON.stringify(snapshot);

    expect(snapshot.intent).toBe('unknown');
    expect(snapshot.confidence).toBe('low');
    expect(snapshot.answer.askableFollowups.length).toBeGreaterThan(2);
    expect(serialized).not.toContain('sk-secretshouldnotleak');
    expect(serialized).not.toContain(googleToken);
    expect(serialized).not.toContain('abc.def.ghi');
    expect(serialized).toContain('[REDACTED_SECRET]');
  });
});
