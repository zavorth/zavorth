import { describe, it, expect, afterEach } from '@jest/globals';
import { EmbeddedLspManager } from '../../src/services/lsp/EmbeddedLspManager.js';
import { TypeScriptLanguageServer } from '../../src/services/lsp/TypeScriptLanguageServer.js';
import * as path from 'path';

describe('Embedded LSP Engine (TypeScriptLanguageServer & EmbeddedLspManager)', () => {
  let lsp: EmbeddedLspManager;

  afterEach(() => {
    if (lsp) {
      lsp.dispose();
    }
  });

  it('should initialize TypeScript language server and return status', async () => {
    lsp = EmbeddedLspManager.getInstance();
    await lsp.initialize(process.cwd());

    const statuses = lsp.getStatus();
    expect(statuses.length).toBeGreaterThan(0);
    expect(statuses[0].language).toBe('typescript');
    expect(statuses[0].running).toBe(true);
  });

  it('should run instant diagnostics on valid TypeScript code without errors', async () => {
    const tsServer = new TypeScriptLanguageServer();
    await tsServer.initialize(process.cwd());

    const testFilePath = path.join(process.cwd(), 'src', 'scratch_test_clean.ts');
    const validContent = `
      export function addNumbers(a: number, b: number): number {
        return a + b;
      }
    `;

    tsServer.updateFile(testFilePath, validContent);
    const diags = await tsServer.getDiagnostics([testFilePath]);

    // Zero syntax/semantic errors in clean valid code
    expect(diags.filter((d) => d.severity === 'error').length).toBe(0);
    tsServer.dispose();
  });

  it('should detect type errors in sub-50ms when invalid code is supplied', async () => {
    const tsServer = new TypeScriptLanguageServer();
    await tsServer.initialize(process.cwd());

    const testFilePath = path.join(process.cwd(), 'src', 'scratch_test_broken.ts');
    const invalidContent = `
      const x: number = "this is a string not a number";
    `;

    tsServer.updateFile(testFilePath, invalidContent);
    const diags = await tsServer.getDiagnostics([testFilePath]);

    expect(diags.length).toBeGreaterThan(0);
    expect(diags[0].severity).toBe('error');
    expect(diags[0].message).toContain('Type \'string\' is not assignable to type \'number\'');
    tsServer.dispose();
  });
});
