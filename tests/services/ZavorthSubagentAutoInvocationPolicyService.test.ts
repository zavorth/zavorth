import { ZavorthSubagentAutoInvocationPolicyService } from '../../src/services/ZavorthSubagentAutoInvocationPolicyService.js';

describe('ZavorthSubagentAutoInvocationPolicyService', () => {
  it('auto-selects live subagents for explicit read-only delegation without requiring --live', () => {
    const service = new ZavorthSubagentAutoInvocationPolicyService();

    const decision = service.decide({
      text: 'use subagentes: um agente analisa a arquitetura e outro revisa os riscos',
      channel: 'telegram',
      mode: 'default',
    });

    expect(decision.action).toBe('invoke_live_subagents');
    expect(decision.shouldInvoke).toBe(true);
    expect(decision.live).toBe(true);
    expect(decision.roleIds).toEqual(expect.arrayContaining(['planner', 'auditor']));
    expect(decision.telemetry.selectedBy).toBe('explicit-user-request');
    expect(decision.telemetry.roles.map((role) => role.roleId)).toEqual(expect.arrayContaining(['planner', 'auditor']));
    expect(decision.telemetry.publicRationale).toContain('pedido explicito');
    expect(decision.telemetry.safety.noRawChainOfThought).toBe(true);
  });

  it('uses implicit live subagents for complex read-only audits', () => {
    const service = new ZavorthSubagentAutoInvocationPolicyService();

    const decision = service.decide({
      text: 'faca uma auditoria profunda em todo o Zavorth, procure falhas, compare riscos e valide os achados',
      taskKind: 'security',
      taskSubtype: 'audit',
    });

    expect(decision.shouldInvoke).toBe(true);
    expect(decision.explicitSubagentRequest).toBe(false);
    expect(decision.implicitComplexityMatch).toBe(true);
    expect(decision.confidence).toBeGreaterThanOrEqual(0.82);
    expect(decision.telemetry.selectedBy).toBe('implicit-complexity');
    expect(decision.telemetry.dashboard.status).toBe('auto-selected');
  });

  it('requires approval for explicit subagents that would mutate the workspace', () => {
    const service = new ZavorthSubagentAutoInvocationPolicyService();

    const decision = service.decide({
      text: 'use subagentes para editar os arquivos e aplicar patch no projeto',
    });

    expect(decision.action).toBe('require_approval');
    expect(decision.requiresApproval).toBe(true);
    expect(decision.live).toBe(false);
    expect(decision.riskSignals).toContain('workspace-mutation');
    expect(decision.telemetry.dashboard.status).toBe('approval-required');
    expect(decision.telemetry.dashboard.nextSafeAction).toContain('aprovacao');
  });

  it('does not implicitly delegate in direct mode', () => {
    const service = new ZavorthSubagentAutoInvocationPolicyService();

    const decision = service.decide({
      text: 'faca uma auditoria profunda em todo o Zavorth e valide os achados',
      mode: 'direct',
      taskKind: 'security',
      taskSubtype: 'audit',
    });

    expect(decision.shouldInvoke).toBe(false);
    expect(decision.reason).toContain('Direct mode');
  });
});
