import { ZavorthProductizationProtectedRuntimeService } from '../../src/services/ZavorthProductizationProtectedRuntimeService.js';
import type { SandboxHostReadinessSnapshot } from '../../src/services/SandboxHostReadinessService.js';

describe('ZavorthProductizationProtectedRuntimeService', () => {
  it('builds the daily product contract with modes, journey, templates and receipts', () => {
    const service = new ZavorthProductizationProtectedRuntimeService({
      now: () => new Date('2026-05-12T12:00:00.000Z'),
      sandboxHostReadiness: readinessWithDocker(false),
    });

    const snapshot = service.buildSnapshot({
      dailyMode: 'governed',
      detailMode: 'advanced',
      request: 'review this repo with sk-test-secret-should-not-leak',
    });

    expect(snapshot.productMode.selected).toEqual({
      dailyMode: 'governed',
      detailMode: 'advanced',
    });
    expect(snapshot.templates).toHaveLength(5);
    expect(snapshot.firstRun.primaryCommands.onboard).toBe('zavorth onboard');
    expect(snapshot.mission.execution.policyBrokerRequired).toBe(true);
    expect(snapshot.dashboardProjection.executionAuthority).toBe(false);
    expect(snapshot.zavorthControlProjection.executionAuthority).toBe(false);
    expect(snapshot.zavorthControlProjection.route).toBe('/control');
    expect(snapshot.receipt.redaction.rawSecretsPresent).toBe(false);
    expect(JSON.stringify(snapshot)).not.toContain('sk-test-secret-should-not-leak');
  });

  it('keeps mutations in dry-run when no strong sandbox is ready', () => {
    const service = new ZavorthProductizationProtectedRuntimeService({
      now: () => new Date('2026-05-12T12:00:00.000Z'),
      sandboxHostReadiness: readinessWithDocker(false),
    });

    const snapshot = service.buildSnapshot({
      selectedTemplateId: 'file-organization',
    });

    expect(snapshot.sandbox.status).toBe('fallback');
    expect(snapshot.sandbox.mutationMode).toBe('dry-run');
    expect(snapshot.sandbox.defaultPolicy.liveMutationsAllowed).toBe(false);
    expect(snapshot.sandbox.doctor.simpleStatus).toBe('needs_sandbox');
    expect(snapshot.mission.status).toBe('dry_run');
    expect(snapshot.receipt.simpleText).toContain('safe preview');
  });

  it('uses strong sandbox readiness when Docker is available but still requires approval for mutations', () => {
    const service = new ZavorthProductizationProtectedRuntimeService({
      now: () => new Date('2026-05-12T12:00:00.000Z'),
      sandboxHostReadiness: readinessWithDocker(true),
    });

    const snapshot = service.buildSnapshot({
      selectedTemplateId: 'file-organization',
    });

    expect(snapshot.sandbox.status).toBe('ready');
    expect(snapshot.sandbox.preferredStrongTier).toBe('docker');
    expect(snapshot.sandbox.defaultPolicy.liveMutationsAllowed).toBe(true);
    expect(snapshot.sandbox.doctor.simpleStatus).toBe('ready');
    expect(snapshot.mission.execution.mutationMode).toBe('sandbox');
    expect(snapshot.mission.status).toBe('needs_approval');
    expect(snapshot.mission.approvals[0]).toEqual(expect.objectContaining({
      status: 'pending',
    }));
  });

  it('renders compact CLI text for templates, missions, receipts and sandbox', () => {
    const service = new ZavorthProductizationProtectedRuntimeService({
      now: () => new Date('2026-05-12T12:00:00.000Z'),
      sandboxHostReadiness: readinessWithDocker(false),
    });
    const snapshot = service.buildSnapshot();

    expect(service.renderText(snapshot, 'templates')).toContain('[templates]');
    expect(service.renderText(snapshot, 'missions')).toContain('[mission]');
    expect(service.renderText(snapshot, 'receipts')).toContain('[receipt]');
    expect(service.renderText(snapshot, 'sandbox')).toContain('[sandbox]');
  });
});

function readinessWithDocker(dockerReady: boolean) {
  return {
    inspect: (): SandboxHostReadinessSnapshot => ({
      stage: '38',
      generatedAt: '2026-05-12T12:00:00.000Z',
      platform: 'linux',
      osRelease: 'test',
      summary: {
        ok: true,
        readyTiers: dockerReady ? ['local-jail', 'docker'] : ['local-jail'],
        dormantTiers: dockerReady ? [] : ['docker', 'gvisor', 'firecracker'],
        unavailableStrongTiers: dockerReady ? [] : ['docker', 'gvisor', 'firecracker'],
        blockingIssues: [],
      },
      defaultPolicy: {
        strongSandboxReady: dockerReady,
        liveMutationDefault: dockerReady ? 'sandboxed-with-approval' : 'dry-run-only',
        safeWithoutStrongSandbox: ['read-only', 'preview', 'doctor', 'receipt'],
        blockedWithoutStrongSandbox: [
          'workspace-write',
          'host-command',
          'network-write',
          'channel-send',
          'live-skill-apply',
        ],
        explanation: dockerReady
          ? 'Strong sandbox is ready; mutable execution still requires approval.'
          : 'Only lightweight fallback is ready; live mutations remain dry-run.',
      },
      tiers: [
        {
          id: 'local-jail',
          label: 'Local jail sandbox',
          status: 'ready',
          canRun: true,
          strongBoundary: false,
          startsOnRead: false,
          platform: 'linux',
          reasons: ['local fallback ready'],
          checks: [],
        },
        {
          id: 'docker',
          label: 'Docker hardened sandbox',
          status: dockerReady ? 'ready' : 'not_installed',
          canRun: dockerReady,
          strongBoundary: true,
          startsOnRead: false,
          platform: 'linux',
          reasons: [dockerReady ? 'docker ready' : 'docker missing'],
          checks: [],
        },
        {
          id: 'gvisor',
          label: 'gVisor runsc sandbox',
          status: 'dormant',
          canRun: false,
          strongBoundary: true,
          startsOnRead: false,
          platform: 'linux',
          reasons: ['not configured'],
          checks: [],
        },
        {
          id: 'firecracker',
          label: 'Firecracker MicroVM sandbox',
          status: 'dormant',
          canRun: false,
          strongBoundary: true,
          startsOnRead: false,
          platform: 'linux',
          reasons: ['not configured'],
          checks: [],
        },
      ],
      actions: [],
      contracts: [],
    }),
  };
}
