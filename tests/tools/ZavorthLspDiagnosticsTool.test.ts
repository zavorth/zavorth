import { describe, it, expect } from '@jest/globals';
import { ZavorthLspDiagnosticsTool } from '../../src/tools/ZavorthLspDiagnosticsTool.js';

describe('ZavorthLspDiagnosticsTool (Embedded LSP Tool)', () => {
  const tool = new ZavorthLspDiagnosticsTool();

  it('exposes correct metadata', () => {
    expect(tool.name).toBe('zavorth_lsp_diagnostics');
  });

  it('retrieves server statuses', async () => {
    const res = JSON.parse(await tool.execute({ action: 'status' }));
    expect(res.success).toBe(true);
    expect(Array.isArray(res.statuses)).toBe(true);
  });

  it('runs fast diagnostics on in-memory code', async () => {
    const validCode = 'export const greeting: string = "Hello World";';
    const res = JSON.parse(await tool.execute({
      action: 'check',
      filePath: 'src/test-sample.ts',
      content: validCode,
    }));
    expect(res.success).toBe(true);
    expect(res.errorCount).toBe(0);
  });
});
