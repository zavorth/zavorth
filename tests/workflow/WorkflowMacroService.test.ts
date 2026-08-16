import { describe, it, expect, beforeEach } from '@jest/globals';
import { WorkflowMacroService } from '../../src/services/workflow/WorkflowMacroService.js';

describe('WorkflowMacroService (CLI Workflow Automation)', () => {
  const testMacroName = 'test-deploy-flow';

  beforeEach(() => {
    WorkflowMacroService.deleteMacro(testMacroName);
  });

  it('should record, save, list, and delete workflow macros cleanly', () => {
    expect(WorkflowMacroService.isRecording()).toBe(false);

    WorkflowMacroService.startRecording(testMacroName, 'Build and test pipeline');
    expect(WorkflowMacroService.isRecording()).toBe(true);
    expect(WorkflowMacroService.getActiveRecordingName()).toBe(testMacroName);

    WorkflowMacroService.recordStep('/doctor');
    WorkflowMacroService.recordStep('/models');
    WorkflowMacroService.recordStep('/notify test');

    const saved = WorkflowMacroService.stopRecording();
    expect(saved).not.toBeNull();
    expect(saved?.name).toBe(testMacroName);
    expect(saved?.steps.length).toBe(3);
    expect(WorkflowMacroService.isRecording()).toBe(false);

    const fetched = WorkflowMacroService.getMacro(testMacroName);
    expect(fetched).not.toBeNull();
    expect(fetched?.steps[0].command).toBe('/doctor');

    const list = WorkflowMacroService.listMacros();
    expect(list.some((m) => m.name === testMacroName)).toBe(true);

    const deleted = WorkflowMacroService.deleteMacro(testMacroName);
    expect(deleted).toBe(true);
    expect(WorkflowMacroService.getMacro(testMacroName)).toBeNull();
  });
});
