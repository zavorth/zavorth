import { describe, it, expect } from '@jest/globals';
import { ZavorthMacroTool } from '../../src/tools/ZavorthMacroTool.js';

describe('ZavorthMacroTool (Workflow Macro Tool)', () => {
  const tool = new ZavorthMacroTool();

  it('exposes correct metadata and parameters', () => {
    expect(tool.name).toBe('zavorth_macro');
    expect(tool.description).toContain('workflow');
  });

  it('records, stops, lists, and deletes macros', async () => {
    // 1. Start recording
    const startRes = JSON.parse(await tool.execute({ action: 'record', name: 'build-and-test', description: 'Runs build then tests' }));
    expect(startRes.success).toBe(true);

    // 2. Stop recording
    const stopRes = JSON.parse(await tool.execute({ action: 'stop' }));
    expect(stopRes.success).toBe(true);
    expect(stopRes.macro.name).toBe('build-and-test');

    // 3. List macros
    const listRes = JSON.parse(await tool.execute({ action: 'list' }));
    expect(listRes.success).toBe(true);
    expect(listRes.macros.some((m: any) => m.name === 'build-and-test')).toBe(true);

    // 4. Delete macro
    const deleteRes = JSON.parse(await tool.execute({ action: 'delete', name: 'build-and-test' }));
    expect(deleteRes.success).toBe(true);
  });
});
