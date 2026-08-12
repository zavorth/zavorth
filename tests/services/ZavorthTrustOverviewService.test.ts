import { ZavorthTrustOverviewService } from '../../src/services/ZavorthTrustOverviewService.js';

describe('ZavorthTrustOverviewService', () => {
  it('aggregates governance, trust and tenants into a trust overview', () => {
    const service = new ZavorthTrustOverviewService({
      now: () => new Date('2026-04-16T19:00:00.000Z'),
      workspaceRoot: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      governanceControlPlaneService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            posture: 'attention',
            tenants: 6,
            pendingOnboarding: 2,
            restrictedShared: 1,
            pendingApprovals: 3,
            highRiskCapabilities: 2,
            trustedPlugins: 4,
            restrictedNodes: 1,
            decisions: 5,
          },
          actions: [
            {
              id: 'governance-review',
              label: 'Revisar aprovacoes pendentes',
              severity: 'warn',
              reason: 'Existem tres aprovacoes travando o runtime.',
              command: '/trust approvals',
            },
          ],
          narrative: {
            nextAction: 'Revisar superficies e allowlists.',
          },
        })),
      },
      trustPlaneService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            posture: 'critical',
            pendingApprovals: 3,
            highRiskCapabilities: 2,
            trustedPlugins: 4,
            restrictedNodes: 1,
            mcpProfile: 'strict',
          },
          suggestedActions: [
            {
              id: 'trust-killswitch',
              label: 'Auditar kill switch',
              severity: 'critical',
              reason: 'Boundary sensivel ainda esta pedindo validacao.',
              command: '/trust',
            },
          ],
        })),
      },
      tenantGovernanceService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            total: 6,
            pendingOnboarding: 2,
            restrictedShared: 1,
          },
          pendingOnboarding: [
            {
              tenantId: 'tenant-a',
              operatorSummary: 'Tenant A ainda nao concluiu onboarding.',
              actions: [
                {
                  command: '/tenants tenant-a',
                },
              ],
            },
          ],
          narrative: {
            nextAction: 'Fechar onboarding dos tenants compartilhados.',
          },
        })),
      },
    });

    const snapshot = service.buildSnapshot({ limit: 6 });

    expect(snapshot.generatedAt).toBe('2026-04-16T19:00:00.000Z');
    expect(snapshot.summary.posture).toBe('critical');
    expect(snapshot.summary.tenants).toBe(6);
    expect(snapshot.summary.pendingOnboarding).toBe(2);
    expect(snapshot.summary.pendingApprovals).toBe(3);
    expect(snapshot.actions.map((entry) => entry.source)).toEqual(expect.arrayContaining([
      'trust',
      'governance',
      'tenants',
    ]));
    expect(service.renderReport()).toContain('Trust Overview');
  });
});
