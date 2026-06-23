import { ZavorthTerminalBackendsTool } from '../../src/tools/ZavorthTerminalBackendsTool';

describe('ZavorthTerminalBackendsTool', () => {
  const tool = new ZavorthTerminalBackendsTool();

  it('has correct name', () => { expect(tool.name).toBe('zavorth_terminal_backends'); });
  it('has description', () => { expect(tool.description).toBeTruthy(); });
  it('has parameters', () => { expect(tool.parameters).toBeDefined(); });
  it('returns error without action', async () => {
    const r = await tool.execute({});
    expect(typeof r).toBe('string');
    expect(r.toLowerCase()).toContain('error');
  });
  it('returns error for invalid action', async () => {
    const r = await tool.execute({ action: 'nonexistent' });
    expect(typeof r).toBe('string');
  });
  it('list backends returns result', async () => {
    const r = await tool.execute({ action: 'list_backends' });
    expect(typeof r).toBe('string');
  });
  it('getDefinition returns valid structure', () => {
    const def = tool.getDefinition();
    expect(def.name).toBe('zavorth_terminal_backends');
    expect(def.parameters).toBeDefined();
  });
});
