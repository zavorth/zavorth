import path from 'node:path';
import { AgentSmartnessService, buildStructuredToolFailurePlan } from '../../../src/services/agent-smartness/AgentSmartnessService.js';
import { ProfileManifestService } from '../../../src/services/ProfileManifestService.js';
import { resolveRuntimeProfileId } from '../../../src/services/ExperienceRuntimeProfileMap.js';
import { DailyReturnContinuityService } from '../../../src/services/DailyReturnContinuityService.js';


describe('AgentSmartnessService', () => {
  const profileDir = path.join(__dirname, 'config', 'profile-manifests');

  it('runs hermetic smartness missions without simulation', async () => {
    const report = await new AgentSmartnessService({
      profileDir,
      profileService: new ProfileManifestService({ profileDir }),
    }).run();

    expect(report.simulated).toBe(false);
    expect(report.mode).toBe('hermetic-unit');
    expect(report.claimsLiveIntelligence).toBe(false);
    expect(report.total).toBeGreaterThanOrEqual(5);
    expect(report.ok).toBe(true);
    expect(report.failed).toBe(0);
    expect(report.results.every((entry) => entry.pass)).toBe(true);
  });

  it('compiles business and power experience profiles to runtime manifests', () => {
    const service = new ProfileManifestService({ profileDir });
    expect(resolveRuntimeProfileId('business')).toBe('business');
    expect(resolveRuntimeProfileId('power')).toBe('power');
    expect(service.compileProfileById('business')?.id).toBe('business');
    expect(service.compileProfileById('power')?.id).toBe('power');
    expect(service.compileProfileById('business')?.id).not.toBe('personal');
    expect(service.compileAll().map((b) => b.id)).toEqual(expect.arrayContaining([
      'personal', 'developer', 'business', 'power', 'creator', 'operator', 'team',
    ]));
  });

  it('builds structured recovery plans for permanent tool failures', () => {
    const plan = buildStructuredToolFailurePlan({
      toolName: 'read_file',
      errorMessage: 'ENOENT: no such file or directory',
      availableAlternatives: ['list_directory', 'web_search'],
    });
    expect(plan.shouldRetry).toBe(false);
    expect(plan.preferredAlternative).toBe('list_directory');
    expect(plan.nextActions).toEqual(expect.arrayContaining([
      'report_failure',
      'try_alternative:list_directory',
      'ask_user_if_blocked',
    ]));
    expect(plan.userVisibleSummary).toContain('read_file');
    // Beyond transient 120ms retry: permanent failures replan to alternate tools + user-visible summary.
    expect(plan.nextActions).not.toContain('retry_once');
  });

  it('only retries transient failures once in the structured plan', () => {
    const plan = buildStructuredToolFailurePlan({
      toolName: 'web_search',
      errorMessage: 'ETIMEDOUT: connection timeout',
      availableAlternatives: ['web_fetch'],
    });
    expect(plan.shouldRetry).toBe(true);
    expect(plan.nextActions).toEqual(['retry_once']);
    expect(plan.preferredAlternative).toBeNull();
  });
});

describe('DailyReturnContinuityService', () => {
  it('prefers pending approvals, then continue session, then start chat', () => {
    const service = new DailyReturnContinuityService();
    const withApprovals = service.buildSnapshot({
      pendingApprovals: 2,
      providerReady: true,
      sessions: [{ id: 's1', title: 'Yesterday', updatedAt: '2026-07-10T12:00:00.000Z' }],
    });
    expect(withApprovals.nextAction.kind).toBe('review-approval');

    const continueSession = service.buildSnapshot({
      pendingApprovals: 0,
      providerReady: true,
      sessions: [{ id: 's1', title: 'Yesterday', updatedAt: '2026-07-10T12:00:00.000Z' }],
    });
    expect(continueSession.nextAction.kind).toBe('continue-session');
    expect(continueSession.hasHistory).toBe(true);

    const day1 = service.buildSnapshot({
      previousOpenAt: '2026-07-10T09:00:00.000Z',
      currentOpenAt: '2026-07-11T10:00:00.000Z',
      providerReady: true,
      sessions: [{ id: 's1', title: 'Work', updatedAt: '2026-07-10T20:00:00.000Z' }],
    });
    expect(day1.day1ReturnEligible).toBe(true);
  });
});
