import { DashboardService } from '../../src/services/DashboardService';
import {
  createTestLogRepo,
  fetchDashboardJson,
  fetchNoKeepAlive,
} from '../helpers/dashboardWebTestUtils.js';

describe('Dashboard security mesh surface', () => {
  const logRepo = createTestLogRepo();

  it('publishes the Runtime & Security Mesh endpoint and classic dashboard block', async () => {
    const service = new DashboardService(logRepo, {
      securityMeshService: {
        buildSnapshot: jest.fn(() => ({
          posture: {
            level: 'zero-trust-ready',
            label: 'Zero-trust pronto',
            summary: 'Container endurecido, gVisor e microVM estao prontos.',
          },
          summary: {
            totalModes: 5,
            coreReady: 3,
            extensionsReady: 1,
            gvisorActive: true,
            firecrackerReady: true,
            neverDowngrade: true,
          },
          policies: {
            lowRiskToLocalJail: true,
            mediumRiskToContainer: true,
            highRiskToMicrovm: true,
            neverDowngrade: true,
            containerHardening: true,
            gvisorActive: true,
            firecrackerReady: true,
            nodeHostAvailable: false,
            remoteSidecarAvailable: true,
          },
          modes: {
            core: [],
            extensions: [],
          },
          auditTrail: {
            available: true,
            ok: true,
            totalEvents: 3,
            latestEventType: 'APPROVAL_DECISION',
            latestTaskId: 'task-audit-1',
            latestTimestamp: '2026-04-03T11:40:00.000Z',
            latestChainHash: 'fedcba0987654321',
            recentChain: [
              {
                eventId: 'audit-0000003',
                eventType: 'APPROVAL_DECISION',
                taskId: 'task-audit-1',
                timestamp: '2026-04-03T11:40:00.000Z',
                chainHash: 'fedcba0987654321',
                previousChainHash: '1234567890abcdef',
              },
            ],
          },
          suggestedActions: [],
          narrative: {
            headline: 'Runtime & Security Mesh',
            operatorSummary: 'Todos os tiers core estao prontos.',
            trustBoundary: 'Conteudo de alto risco sobe para microVM sem rebaixar.',
          },
        })),
      } as any,
    });

    await service.start();
    const baseUrl = service.getUrl();
    const [{ status: endpointStatus, payload: endpointPayload }, classicResponse] = await Promise.all([
      fetchDashboardJson(baseUrl, '/api/operations/security-mesh'),
      fetchNoKeepAlive(`${baseUrl}/classic`),
    ]);
    const classicHtml = await classicResponse.text();
    await service.stopAsync();

    expect(endpointStatus).toBe(200);
    expect(endpointPayload).toEqual(
      expect.objectContaining({
        posture: expect.objectContaining({
          level: 'zero-trust-ready',
        }),
        auditTrail: expect.objectContaining({
          totalEvents: 3,
          latestEventType: 'APPROVAL_DECISION',
          latestChainHash: 'fedcba0987654321',
        }),
        summary: expect.objectContaining({
          coreReady: 3,
        }),
      }),
    );
    expect(classicHtml).toContain('operations-security-mesh');
    expect(classicHtml).toContain('renderOperationsSecurityMesh');
  });
});
