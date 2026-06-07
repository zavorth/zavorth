import {
  buildWorkflowSlashRequest,
  normalizeWorkflowSlashCommand,
} from '../../../apps/zavorth-control-vite-shell/src/workflow-intent';

describe('zavorth-control workflow slash intent', () => {
  it('turns /go with an objective into a focused mission that can be sent immediately', () => {
    const request = buildWorkflowSlashRequest('go', 'audit the scheduler retry path');

    expect(request.command).toBe('go');
    expect(request.autoSubmit).toBe(true);
    expect(request.effort).toBe('deep');
    expect(request.guidedFlow).toBe('slash-go-focused-mission');
    expect(request.text).toContain('Run this as a focused mission.');
    expect(request.text).toContain('Objective: audit the scheduler retry path');
    expect(request.workflowIntent).toEqual(expect.objectContaining({
      source: 'slash-command',
      command: '/go',
      kind: 'focused-mission',
      effort: 'deep',
      objectivePreview: 'audit the scheduler retry path',
      approvalMode: 'risk-based',
    }));
  });

  it('turns /workflows into governed workflow intent without duplicating secrets in metadata', () => {
    const request = buildWorkflowSlashRequest('workflow', 'fix deploy token=abc123 and test fanout');

    expect(request.command).toBe('workflows');
    expect(request.autoSubmit).toBe(true);
    expect(request.effort).toBe('ultra');
    expect(request.guidedFlow).toBe('slash-workflows-governed-workflow');
    expect(request.workflowIntent).toEqual(expect.objectContaining({
      command: '/workflows',
      kind: 'governed-workflow',
      effort: 'ultra',
      dynamicWorkflow: true,
    }));
    expect(request.text).toContain('Objective: fix deploy token=abc123 and test fanout');
    expect(request.workflowIntent.objectivePreview).toContain('token=[redacted]');
    expect(request.workflowIntent.objectivePreview).not.toContain('abc123');
  });

  it('keeps empty workflow commands as editable drafts instead of pretending work started', () => {
    const request = buildWorkflowSlashRequest('go', '');

    expect(request.autoSubmit).toBe(false);
    expect(request.text).toContain('Objective: ');
    expect(request.workflowIntent.objectivePreview).toBeNull();
  });

  it('normalizes aliases without accepting unrelated commands', () => {
    expect(normalizeWorkflowSlashCommand('workflow')).toBe('workflows');
    expect(normalizeWorkflowSlashCommand('/workflows')).toBe('workflows');
    expect(normalizeWorkflowSlashCommand('go')).toBe('go');
    expect(normalizeWorkflowSlashCommand('effort')).toBeNull();
  });
});
