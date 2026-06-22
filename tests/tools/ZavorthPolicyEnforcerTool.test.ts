import { ZavorthPolicyEnforcerTool } from '../../src/tools/ZavorthPolicyEnforcerTool';

describe('ZavorthPolicyEnforcerTool', () => {
  const tool = new ZavorthPolicyEnforcerTool();

  it('exposes correct name', () => {
    expect(tool.name).toBe('zavorth_policy_enforcer');
  });

  it('returns error when action is missing', async () => {
    const result = await tool.execute({});
    expect(result).toContain('Error');
  });

  it('lists all policies', async () => {
    const result = await tool.execute({ action: 'list_policies' });
    expect(result).toContain('Policies');
    expect(result).toContain('Email Send');
    expect(result).toContain('Destructive Command');
    expect(result).toContain('Sensitive Data');
  });

  it('checks policy for email send with high risk', async () => {
    const result = await tool.execute({
      action: 'check',
      tool_name: 'send_email',
      risk_level: 'high',
    });
    expect(result).toContain('send_email');
  });

  it('checks policy for destructive command', async () => {
    const result = await tool.execute({
      action: 'check',
      tool_name: 'remote_shell',
      tool_args: JSON.stringify({ command: 'rm -rf /tmp/test' }),
      risk_level: 'critical',
    });
    expect(result).toContain('remote_shell');
  });

  it('checks policy for sensitive file access', async () => {
    const result = await tool.execute({
      action: 'check',
      tool_name: 'read_file',
      tool_args: JSON.stringify({ path: '.env' }),
      risk_level: 'medium',
    });
    expect(result).toContain('read_file');
  });

  it('checks policy for safe tool', async () => {
    const result = await tool.execute({
      action: 'check',
      tool_name: 'web_search',
      risk_level: 'low',
    });
    expect(result).toContain('web_search');
  });

  it('audits policies', async () => {
    const result = await tool.execute({ action: 'audit' });
    expect(result).toContain('Audit');
    expect(result).toContain('Total');
    expect(result).toContain('Enabled');
  });

  it('runs policy tests', async () => {
    const result = await tool.execute({ action: 'test' });
    expect(result).toContain('Test');
  });

  it('adds a custom policy', async () => {
    const result = await tool.execute({
      action: 'add_policy',
      policy_name: 'Custom Block Policy',
      policy_description: 'Blocks custom operations',
      policy_category: 'tool_access',
      policy_condition: 'tool_name == "custom_tool"',
      policy_action: 'deny',
      policy_severity: 'block',
    });
    expect(result).toContain('created successfully');
  });

  it('returns error for invalid action', async () => {
    const result = await tool.execute({ action: 'dance' });
    expect(result).toContain('Error');
  });

  it('returns error for check without tool_name', async () => {
    const result = await tool.execute({ action: 'check' });
    expect(result).toContain('Error');
    expect(result).toContain('tool_name');
  });
});
