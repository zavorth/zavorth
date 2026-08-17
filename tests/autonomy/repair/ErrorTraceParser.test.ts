import { ErrorTraceParser } from '../../../src/autonomy/repair/ErrorTraceParser.js';

describe('ErrorTraceParser', () => {
  it('should parse TypeScript compiler errors', () => {
    const output = `
    src/utils/math.ts(14,28): error TS2339: Property 'divide' does not exist on type 'Calculator'.
    src/auth/token.ts(45,10): warning TS6133: 'secret' is declared but never read.
    `;

    const findings = ErrorTraceParser.parse(output);
    expect(findings.length).toBe(2);
    expect(findings[0].filePath).toBe('src/utils/math.ts');
    expect(findings[0].line).toBe(14);
    expect(findings[0].column).toBe(28);
    expect(findings[0].errorCode).toBe('TS2339');
    expect(findings[0].severity).toBe('error');

    expect(findings[1].filePath).toBe('src/auth/token.ts');
    expect(findings[1].severity).toBe('warning');
  });

  it('should parse esbuild errors', () => {
    const output = `
    ✘ [ERROR] The symbol "DuplicateTool" has already been declared

    src/bootstrap/bootstrapToolRuntime.ts:137:10:
      137 │   const { DuplicateTool } = require('../tools/DuplicateTool.js');
          ╵           ~~~~~~~~~~~~~
    `;

    const findings = ErrorTraceParser.parse(output);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings.some((f) => f.filePath?.includes('bootstrapToolRuntime.ts'))).toBe(true);
  });
});
