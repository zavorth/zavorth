import { AgentRuntimeBudgetEnforcementService } from '../../src/services/AgentRuntimeBudgetEnforcementService.js';
import type { ZavorthAutonomyBudget } from '../../src/contracts/runtime/AutonomousEngineeringPartnerContract.js';

const budget: ZavorthAutonomyBudget = {
  scope: 'run', maxActions: 2, maxMutableActions: 1, maxCost: 5, maxDurationMs: 1000,
  maxNetworkCalls: 2, maxFilesystemWrites: 2, maxExternalDeliveries: 0, pauseOnFailureCount: 1,
  requiresHumanReviewAboveRisk: 'medium', expiresAt: '2026-07-15T00:00:00.000Z',
};

describe('AgentRuntimeBudgetEnforcementService', () => {
  const service = new AgentRuntimeBudgetEnforcementService({ now: () => new Date('2026-07-14T00:00:00.000Z') });

  it('allows a request that remains inside the canonical mission budget', async () => {
    const result = await service.authorize({
      workspaceId: 'workspace-a', missionId: 'mission-a', budget,
      usage: { actions: 1 }, requested: { actions: 1, filesystemWrites: 1 }, riskLevel: 'medium',
    });
    expect(result.allowed).toBe(true);
    expect(result.usage.actions).toBe(2);
    expect(result.remaining.filesystemWrites).toBe(1);
  });

  it('blocks before execution when a limit, expiry, or risk threshold is exceeded', async () => {
    const result = await service.authorize({
      workspaceId: 'workspace-a', missionId: 'mission-a', budget,
      usage: { actions: 2 }, requested: { actions: 1 }, riskLevel: 'high',
    });
    expect(result.allowed).toBe(false);
    expect(result.blockers).toEqual(expect.arrayContaining([
      'actions would exceed its runtime budget.',
      'The requested risk level requires human review.',
    ]));
  });

  it('rejects untyped negative counters', async () => {
    await expect(service.authorize({
      workspaceId: 'workspace-a', missionId: 'mission-a', budget,
      usage: {}, requested: { networkCalls: -1 },
    })).rejects.toThrow('requested.networkCalls');
  });

  it('reserves allowed usage in the runtime so concurrent callers cannot reuse stale counters', async () => {
    const isolated = new AgentRuntimeBudgetEnforcementService({ now: () => new Date('2026-07-14T00:00:00.000Z') });
    const request = { workspaceId: 'workspace-b', missionId: 'mission-b', budget, usage: {}, requested: { actions: 2 } };
    const [first, second] = await Promise.all([isolated.authorize(request), isolated.authorize(request)]);
    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(false);
  });
});
