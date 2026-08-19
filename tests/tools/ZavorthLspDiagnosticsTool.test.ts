import { ZavorthLspDiagnosticsTool } from '../../src/tools/ZavorthLspDiagnosticsTool';
import { ZavorthLspBridgeService } from '../../src/services/lsp/ZavorthLspBridgeService';

describe('ZavorthLspDiagnosticsTool', () => {
  let tool: ZavorthLspDiagnosticsTool;
  let service: ZavorthLspBridgeService;

  beforeEach(() => {
    service = new ZavorthLspBridgeService();
    tool = new ZavorthLspDiagnosticsTool(service);
  });

  it('should detect supported languages via tool execution', async () => {
    const res = await tool.execute({
      action: 'detect_language',
      filePath: 'src/main.ts',
    });

    const parsed = JSON.parse(res);
    expect(parsed.success).toBe(true);
    expect(parsed.detectedLanguage).toBe('typescript');
    expect(parsed.isSupported).toBe(true);
  });

  it('should normalize and format diagnostics cleanly via tool execution', async () => {
    const rawDiagnostics = [
      {
        range: { start: { line: 5, character: 10 }, end: { line: 5, character: 20 } },
        severity: 1,
        message: 'Type error: string is not assignable to number',
      },
    ];

    const res = await tool.execute({
      action: 'check',
      filePath: 'src/calc.ts',
      rawDiagnostics,
    });

    const parsed = JSON.parse(res);
    expect(parsed.success).toBe(true);
    expect(parsed.errorCount).toBe(1);
    expect(parsed.formattedSummary).toContain('1 errors');
  });
});
