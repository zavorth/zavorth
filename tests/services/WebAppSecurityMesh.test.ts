import { config } from '../../src/config/index.js';
import { DashboardService } from '../../src/services/DashboardService.js';
import {
  createTestLogRepo,
  fetchDashboardJson,
} from '../helpers/dashboardWebTestUtils.js';

describe('Web app security mesh endpoint', () => {
  const logRepo = createTestLogRepo();
  const originalWebAuthToken = config.zavorthWebAuthToken;

  afterEach(() => {
    config.zavorthWebAuthToken = originalWebAuthToken;
  });

  it('exposes the Runtime & Security Mesh on the protected web surface', async () => {
    config.zavorthWebAuthToken = 'phase-7-token';
    const service = new DashboardService(logRepo, {
      securityMeshService: {
        buildSnapshot: jest.fn(() => ({
          posture: {
            level: 'guarded',
            label: 'Guarded',
            summary: 'Container forte pronto e microVM em preparo.',
          },
          summary: {
            totalModes: 5,
            coreReady: 2,
            extensionsReady: 0,
            gvisorActive: true,
            firecrackerReady: false,
            neverDowngrade: true,
          },
          policies: {
            lowRiskToLocalJail: true,
            mediumRiskToContainer: true,
            highRiskToMicrovm: true,
            neverDowngrade: true,
            containerHardening: true,
            gvisorActive: true,
            firecrackerReady: false,
            nodeHostAvailable: false,
            remoteSidecarAvailable: false,
          },
          modes: {
            core: [],
            extensions: [],
          },
          auditTrail: {
            available: true,
            ok: true,
            totalEvents: 4,
            latestEventType: 'PERMISSION_DECISION',
            latestTaskId: 'task-audit-1',
            latestTimestamp: '2026-04-03T12:00:00.000Z',
            latestChainHash: 'abcdef1234567890',
            recentChain: [
              {
                eventId: 'audit-0000004',
                eventType: 'PERMISSION_DECISION',
                taskId: 'task-audit-1',
                timestamp: '2026-04-03T12:00:00.000Z',
                chainHash: 'abcdef1234567890',
                previousChainHash: '1234567890abcdef',
              },
            ],
          },
          suggestedActions: [
            {
              id: 'microvm-smoke',
              label: 'Validar microVM',
              command: 'npm run sandbox:firecracker:smoke',
              severity: 'warn',
              reason: 'Firecracker ainda pede smoke.',
            },
          ],
          narrative: {
            headline: 'Runtime & Security Mesh',
            operatorSummary: 'Container forte pronto; microVM ainda em preparo.',
            trustBoundary: 'Alto risco continua bloqueando sem rebaixar.',
          },
        })),
      } as any,
      webUserId: '1',
    });

    await service.start();
    const result = await fetchDashboardJson(service.getUrl(), '/api/web/security-mesh', {
      token: 'phase-7-token',
    });
    await service.stopAsync();

    expect(result.status).toBe(200);
    expect(result.payload).toEqual(
      expect.objectContaining({
        ok: true,
        securityMesh: expect.objectContaining({
          posture: expect.objectContaining({
            level: 'guarded',
          }),
          auditTrail: expect.objectContaining({
            totalEvents: 4,
            latestEventType: 'PERMISSION_DECISION',
            latestChainHash: 'abcdef1234567890',
          }),
          suggestedActions: expect.arrayContaining([
            expect.objectContaining({
              id: 'microvm-smoke',
            }),
          ]),
        }),
      }),
    );
  });
});
