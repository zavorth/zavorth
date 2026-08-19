import { ZavorthLspBridgeService } from '../../../src/services/lsp/ZavorthLspBridgeService';

describe('ZavorthLspBridgeService', () => {
  let service: ZavorthLspBridgeService;

  beforeEach(() => {
    service = new ZavorthLspBridgeService();
  });

  it('should accurately detect supported languages from file extensions', () => {
    expect(service.detectLanguageForFile('src/auth.ts')).toBe('typescript');
    expect(service.detectLanguageForFile('scripts/build.py')).toBe('python');
    expect(service.detectLanguageForFile('crates/core/src/lib.rs')).toBe('rust');
    expect(service.detectLanguageForFile('cmd/main.go')).toBe('golang');
    expect(service.detectLanguageForFile('docs/readme.txt')).toBeNull();
  });

  it('should format and parse JSON-RPC protocol frames reliably without regex bugs', () => {
    const payload = { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} };
    const framed = service.formatJsonRpcMessage(payload);

    expect(framed).toContain('Content-Length: ');
    expect(framed).toContain('\r\n\r\n');

    const parsed = service.parseJsonRpcFrames(framed);
    expect(parsed.frames.length).toBe(1);
    expect(parsed.frames[0]).toEqual(payload);
    expect(parsed.remaining).toBe('');
  });

  it('should normalize raw LSP diagnostics into strongly typed models and format summaries', () => {
    const rawDiagnostics = [
      {
        range: { start: { line: 10, character: 4 }, end: { line: 10, character: 15 } },
        severity: 1,
        message: 'Cannot find name "foo"',
        source: 'typescript',
      },
      {
        range: { start: { line: 20, character: 2 }, end: { line: 20, character: 8 } },
        severity: 2,
        message: 'Unused variable "bar"',
        source: 'typescript',
      },
    ];

    const normalized = service.normalizeDiagnostics('src/index.ts', rawDiagnostics);
    expect(normalized.length).toBe(2);
    expect(normalized[0].severity).toBe('ERROR');
    expect(normalized[1].severity).toBe('WARNING');

    const summary = service.formatDiagnosticsSummary(normalized);
    expect(summary).toContain('1 errors');
    expect(summary).toContain('1 warnings');
    expect(summary).toContain('Cannot find name');
  });
});
