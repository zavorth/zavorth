import { AgentManagerTool } from '../../src/tools/AgentManagerTool.js';

describe('AgentManagerTool', () => {
  it('exposes correct name and parameters', () => {
    const tool = new AgentManagerTool();
    expect(tool.name).toBe('agent_manager');
    expect(tool.parameters.properties).toHaveProperty('action');
  });

  it('runs discovery on standard command and resolves candidates', async () => {
    const tool = new AgentManagerTool();
    const result = JSON.parse(await tool.execute({ action: 'discover', target: 'node' }));
    
    expect(result).toHaveProperty('target', 'node');
    expect(result).toHaveProperty('status');
    if (result.status === 'found') {
      expect(result.candidates.length).toBeGreaterThan(0);
      expect(result.candidates[0].command).toBe('node');
    }
  });

  it('prevents shell command injection in discover targets', async () => {
    const tool = new AgentManagerTool();
    // A payload that would execute a command if evaluated by a shell
    const maliciousTarget = 'node; echo "INJECTED_TEST"';
    const result = JSON.parse(await tool.execute({ action: 'discover', target: maliciousTarget }));
    
    // It should not find any candidates and not crash
    expect(result.status).toBe('not_found');
    expect(result.candidates).toEqual([]);
  });
});
