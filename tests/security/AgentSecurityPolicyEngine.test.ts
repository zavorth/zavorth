import {
  AgentSecurityPolicyEngine,
} from '../../src/security/AgentSecurityPolicyEngine';
import {
  createMcpAgentToolSecurityDefinition,
  NATIVE_AGENT_TOOL_SECURITY_DEFINITIONS,
} from '../../src/security/AgentToolSecurityCatalog';

describe('AgentSecurityPolicyEngine', () => {
  const engine = AgentSecurityPolicyEngine.fromDefinitions(NATIVE_AGENT_TOOL_SECURITY_DEFINITIONS);

  it('denies unknown tools by default', () => {
    const decision = engine.evaluateToolInvocation({
      toolName: 'unknown_tool',
      operation: 'execute',
    });

    expect(decision.allowed).toBe(false);
    expect(decision.action).toBe('deny');
    expect(decision.rule).toBe('UNKNOWN_TOOL_DEFAULT_DENY');
  });

  it('allows safe read-only tools without confirmation', () => {
    const decision = engine.evaluateToolInvocation({
      toolName: 'read_file',
      operation: 'execute',
      sourceTrust: 'trusted-user',
    });

    expect(decision.allowed).toBe(true);
    expect(decision.action).toBe('allow');
    expect(decision.risk).toBe('safe');
    expect(decision.capabilities).toEqual(expect.arrayContaining(['filesystem', 'local-observation']));
    expect(decision.securityProfile).toEqual(expect.objectContaining({
      id: 'professional',
    }));
  });

  it('keeps low-friction safe lookup tools available under enterprise profile', () => {
    const decision = engine.evaluateToolInvocation({
      toolName: 'web_search',
      operation: 'execute',
      sourceTrust: 'trusted-user',
      securityProfile: 'enterprise',
    });

    expect(decision.allowed).toBe(true);
    expect(decision.action).toBe('allow');
    expect(decision.securityProfile).toEqual(expect.objectContaining({
      id: 'enterprise',
    }));
  });

  it('requires profile confirmation for safe-looking external-send tools', () => {
    const profileEngine = AgentSecurityPolicyEngine.fromDefinitions([
      {
        toolName: 'notify_external',
        surface: 'native-tool',
        capabilities: ['external-send'],
        defaultRisk: 'safe',
        requiresConfirmation: false,
        description: 'Sends a notification outside the local trust boundary.',
      },
    ]);

    const decision = profileEngine.evaluateToolInvocation({
      toolName: 'notify_external',
      sourceTrust: 'trusted-user',
      securityProfile: 'personal',
    });

    expect(decision.allowed).toBe(false);
    expect(decision.action).toBe('require_confirmation');
    expect(decision.rule).toBe('CONFIRMATION_REQUIRED');
    expect(decision.reasons.join(' ')).toContain('Perfil personal');
  });

  it('denies unknown capabilities through the active profile', () => {
    const profileEngine = AgentSecurityPolicyEngine.fromDefinitions([
      {
        toolName: 'mystery_tool',
        surface: 'native-tool',
        capabilities: ['unknown'],
        defaultRisk: 'safe',
        requiresConfirmation: false,
        description: 'Misclassified tool.',
      },
    ]);

    const decision = profileEngine.evaluateToolInvocation({
      toolName: 'mystery_tool',
      sourceTrust: 'trusted-user',
      securityProfile: 'professional',
    });

    expect(decision.allowed).toBe(false);
    expect(decision.rule).toBe('SECURITY_PROFILE_DENY');
  });

  it('requires confirmation for filesystem mutation tools', () => {
    const decision = engine.evaluateToolInvocation({
      toolName: 'create_file',
      operation: 'execute',
      sourceTrust: 'trusted-user',
    });

    expect(decision.allowed).toBe(false);
    expect(decision.action).toBe('require_confirmation');
    expect(decision.rule).toBe('CONFIRMATION_REQUIRED');
  });

  it('allows review tools after explicit confirmation', () => {
    const decision = engine.evaluateToolInvocation({
      toolName: 'create_file',
      operation: 'execute',
      sourceTrust: 'trusted-user',
      userConfirmed: true,
    });

    expect(decision.allowed).toBe(true);
    expect(decision.action).toBe('allow');
    expect(decision.rule).toBe('CONFIRMED_ALLOW');
  });

  it('blocks high-risk tools when the trigger is untrusted content', () => {
    const decision = engine.evaluateToolInvocation({
      toolName: 'desktop_automation',
      operation: 'execute',
      sourceTrust: 'untrusted-content',
      userConfirmed: true,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.action).toBe('deny');
    expect(decision.rule).toBe('UNTRUSTED_CONTENT_HIGH_RISK_TOOL');
  });

  it('blocks filesystem access from untrusted content even when confirmation is smuggled in args', () => {
    const decision = engine.evaluateToolInvocation({
      toolName: 'create_file',
      operation: 'execute',
      sourceTrust: 'untrusted-content',
      userConfirmed: true,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.action).toBe('deny');
    expect(decision.rule).toBe('UNTRUSTED_CONTENT_HIGH_RISK_TOOL');
    expect(decision.capabilities).toEqual(expect.arrayContaining(['filesystem']));
  });

  it('classifies MCP tools as review-gated external execution surfaces', () => {
    const mcpEngine = AgentSecurityPolicyEngine.fromDefinitions([
      createMcpAgentToolSecurityDefinition('external_search'),
    ]);

    const decision = mcpEngine.evaluateToolInvocation({
      toolName: 'external_search',
      sourceTrust: 'trusted-user',
    });

    expect(decision.allowed).toBe(false);
    expect(decision.action).toBe('require_confirmation');
    expect(decision.capabilities).toEqual(expect.arrayContaining(['mcp', 'network', 'external-send']));
  });
});
