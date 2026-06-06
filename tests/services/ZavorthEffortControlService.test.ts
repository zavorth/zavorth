import { ZavorthEffortControlService } from '../../src/services/ZavorthEffortControlService.js';

describe('ZavorthEffortControlService', () => {
  it('maps low effort to a cheap, quiet, bounded route', () => {
    const snapshot = new ZavorthEffortControlService().buildSnapshot({
      level: 'low',
      request: 'resuma este documento rapidamente',
    });

    expect(snapshot.contractVersion).toBe('zavorth-effort-control/1');
    expect(snapshot.effectiveLevel).toBe('low');
    expect(snapshot.runtime.internalEffort).toBe('light');
    expect(snapshot.routing.workerModelClass).toBe('cheap');
    expect(snapshot.routing.synthesisModelClass).toBe('standard');
    expect(snapshot.budget.maxSubagents).toBe(1);
    expect(snapshot.approval.required).toBe(false);
    expect(snapshot.safety.noChainOfThoughtExposure).toBe(true);
    expect(snapshot.safety.costGuardRequired).toBe(true);
  });

  it('treats ultra-code as a governed wide workflow profile with premium synthesis approval', () => {
    const snapshot = new ZavorthEffortControlService().buildSnapshot({
      level: 'ultra',
      request: 'revise todo o repo e use token=secret-value sem vazar nada',
      maxCents: 200,
    });

    expect(snapshot.effectiveLevel).toBe('ultra-code');
    expect(snapshot.requestPreview).not.toContain('secret-value');
    expect(snapshot.runtime.internalEffort).toBe('heavy');
    expect(snapshot.routing.dynamicWorkflowsRecommended).toBe(true);
    expect(snapshot.routing.agentTeamsRecommended).toBe(true);
    expect(snapshot.routing.synthesisModelClass).toBe('premium');
    expect(snapshot.budget.maxSubagents).toBeGreaterThanOrEqual(24);
    expect(snapshot.approval.required).toBe(true);
    expect(snapshot.approval.reasons).toEqual(expect.arrayContaining([
      'premium synthesis tier',
      'large fanout route',
    ]));
    expect(snapshot.commandPreview.dynamicWorkflow).toContain('zavorth workflows');
    expect(snapshot.commandPreview.costGuard).toContain('zavorth model-cost');
  });

  it('normalizes aliases and keeps unknown values on standard effort', () => {
    const service = new ZavorthEffortControlService();

    expect(service.buildSnapshot({ level: 'ultra_code' }).effectiveLevel).toBe('ultra-code');
    expect(service.buildSnapshot({ level: 'max' }).effectiveLevel).toBe('ultra-code');
    expect(service.buildSnapshot({ level: 'unknown-mode' }).effectiveLevel).toBe('standard');
  });
});
