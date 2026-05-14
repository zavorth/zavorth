import { CanonicalExecutionPipelineService } from '../../src/services/CanonicalExecutionPipelineService.js';

describe('CanonicalExecutionPipelineService', () => {
  it('builds one canonical run link for events emitted by a side engine', () => {
    const service = new CanonicalExecutionPipelineService();

    const link = service.buildLink([
      {
        engine: 'automation',
        kind: 'plan',
        id: 'plan-1',
        status: 'approval_required',
        summary: 'Automation requires approval.',
        requestedBy: 'operator',
        surface: 'telegram',
        runId: 'run-1',
        approvalId: 'approval-1',
      },
      {
        engine: 'automation',
        kind: 'approval',
        id: 'approval-1',
        status: 'approval_required',
        summary: 'Approval linked.',
        requestedBy: 'operator',
        surface: 'telegram',
        runId: 'run-1',
        approvalId: 'approval-1',
      },
    ]);

    expect(link.runId).toBe('run-1');
    expect(link.approvalId).toBe('approval-1');
    expect(link.runContext).toEqual(expect.objectContaining({
      runId: 'run-1',
      surface: 'telegram',
      requestedBy: 'operator',
    }));
    expect(link.lifecycle).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'plan', source: 'automation', runId: 'run-1' }),
      expect.objectContaining({ kind: 'approval', approvalId: 'approval-1' }),
    ]));
  });
});
