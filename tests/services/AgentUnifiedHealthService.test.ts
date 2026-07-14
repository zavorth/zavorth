import { AgentUnifiedHealthService } from '../../src/services/AgentUnifiedHealthService.js';

describe('AgentUnifiedHealthService', () => {
  it('aggregates canonical diagnostic providers without hiding unavailable checks', async () => {
    const service = new AgentUnifiedHealthService({
      workspaceId: 'workspace-a', now: () => new Date('2026-07-14T00:00:00.000Z'),
      providers: [
        { id: 'operations', label: 'Operations', read: () => ({ status: 'healthy', summary: 'Runtime is ready.', recommendedAction: null }) },
        { id: 'architecture', label: 'Architecture', read: () => { throw new Error('Report missing'); } },
      ],
    });
    const snapshot = await service.readSnapshot();
    expect(snapshot.status).toBe('attention');
    expect(snapshot.diagnostics[1]).toEqual(expect.objectContaining({ status: 'unavailable', summary: 'Report missing' }));
  });

  it('promotes critical diagnostics to the overall status', async () => {
    const service = new AgentUnifiedHealthService({ workspaceId: 'workspace-a', providers: [
      { id: 'security', label: 'Security', read: async () => ({ status: 'critical', summary: 'Audit failed.', recommendedAction: 'Run the security audit.' }) },
    ] });
    expect((await service.readSnapshot()).status).toBe('critical');
  });
});
