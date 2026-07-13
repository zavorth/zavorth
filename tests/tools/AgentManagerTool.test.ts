import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AgentManagerTool } from '../../src/tools/AgentManagerTool.js';

describe('AgentManagerTool', () => {
  it('exposes correct name and parameters', () => {
    const tool = new AgentManagerTool();
    expect(tool.name).toBe('agent_manager');
    expect(tool.parameters.properties).toHaveProperty('action');
    expect(String(tool.description)).toMatch(/Brand-agnostic|path/i);
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

  it('does not special-case product brand phrases for discovery', async () => {
    const tool = new AgentManagerTool();
    // Brand phrases must not map to a hard-coded binary synonym list.
    // They only resolve if that exact token exists as a CLI on PATH.
    const result = JSON.parse(
      await tool.execute({ action: 'discover', target: 'the coding assistant in this folder' }),
    );
    expect(result.status).toBe('not_found');
    expect(result.candidates).toEqual([]);
    expect(String(result.suggestion || '')).toMatch(/path|URL|CLI command/i);
  });

  it('discovers brand-agnostic agent project markers by path', async () => {
    const tool = new AgentManagerTool();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-agent-mgr-'));
    try {
      fs.writeFileSync(path.join(dir, 'AGENTS.md'), '# agents\n', 'utf8');
      const result = JSON.parse(await tool.execute({ action: 'discover', target: dir }));
      expect(result.status).toBe('found');
      expect(result.candidates[0].label).toBe('Agent project');
      expect(result.candidates[0].evidence.join(' ')).toMatch(/AGENTS\.md/);
      expect(String(result.candidates[0].label)).not.toMatch(/Claude|Cursor/i);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
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
