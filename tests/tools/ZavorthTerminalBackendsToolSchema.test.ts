import { ZavorthTerminalBackendsTool } from '../../src/tools/ZavorthTerminalBackendsTool.js';

describe('ZavorthTerminalBackendsTool Schema Optimization', () => {
  it('exposes compact, token-optimized schema with full parameter integrity', () => {
    const tool = new ZavorthTerminalBackendsTool();

    expect(tool.name).toBe('terminal_backends');
    expect(tool.parameters.type).toBe('object');
    expect(tool.parameters.required).toContain('action');

    const props = tool.parameters.properties;
    expect(props.action.enum).toEqual(['connect', 'disconnect', 'status', 'execute', 'log', 'stats']);
    expect(props.backend.enum).toEqual(['local', 'docker', 'ssh', 'wsl', 'singularity', 'modal']);
    expect(props.command.type).toBe('string');
    expect(props.options.type).toBe('object');
    expect(props.timeout_ms.type).toBe('number');
    expect(props.working_directory.type).toBe('string');

    // Verify token efficiency: total schema character count is compact (< 800 chars)
    const schemaJson = JSON.stringify(tool.parameters);
    expect(schemaJson.length).toBeLessThan(800);
  });
});
