import { ZavorthSubagentAutoInvocationPolicyService } from '../../src/services/ZavorthSubagentAutoInvocationPolicyService.js';

describe('ZavorthSubagentAutoInvocationPolicyService', () => {
  it('does not treat free-text subagent phrases as explicit request (LLM/tools decide)', () => {
    const service = new ZavorthSubagentAutoInvocationPolicyService();

    const decision = service.decide({
      text: 'use subagents: one agent analyzes architecture and another reviews risks',
      channel: 'telegram',
      mode: 'default',
    });

    expect(decision.explicitSubagentRequest).toBe(false);
    expect(decision.telemetry.selectedBy).not.toBe('explicit-user-request');
  });

  it('marks structured security/audit task kinds as implicit complexity without free-text keywords', () => {
    const service = new ZavorthSubagentAutoInvocationPolicyService();

    const decision = service.decide({
      text: 'run a deep audit across Zavorth, find failures, compare risks, and validate findings',
      taskKind: 'security',
      taskSubtype: 'audit',
    });

    expect(decision.explicitSubagentRequest).toBe(false);
    expect(decision.implicitComplexityMatch).toBe(true);
    // Free-text phrase scores were removed (purity). Structured taskKind alone may not
    // reach the auto-live confidence bar; LLM/tools still own multi-agent choice.
    expect(decision.triggers.some((t) => t.startsWith('task-kind:') || t.startsWith('task-subtype:'))).toBe(true);
  });

  it('does not invent workspace-mutation risk from free-text patch phrases alone', () => {
    const service = new ZavorthSubagentAutoInvocationPolicyService();

    const decision = service.decide({
      text: 'use structured delegation to edit files and apply a patch to the project',
    });

    // Risk signals and explicit request both empty without structured flags.
    expect(decision.explicitSubagentRequest).toBe(false);
    expect(decision.riskSignals).toEqual([]);
  });

  it('does not implicitly delegate in direct mode', () => {
    const service = new ZavorthSubagentAutoInvocationPolicyService();

    const decision = service.decide({
      text: 'run a deep audit across all of Zavorth and validate the findings',
      mode: 'direct',
      taskKind: 'security',
      taskSubtype: 'audit',
    });

    expect(decision.shouldInvoke).toBe(false);
    expect(decision.reason).toContain('Direct mode');
  });
});
