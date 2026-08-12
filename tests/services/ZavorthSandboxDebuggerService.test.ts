import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZavorthSandboxDebuggerService } from '../../src/services/ZavorthSandboxDebuggerService.js';

describe('ZavorthSandboxDebuggerService', () => {
  let tempDir = '';
  let mockToolPath = '';

  beforeEach(() => {
    mockToolPath = path.join(process.cwd(), 'src', 'tools', 'MockTool.ts');
    fs.writeFileSync(
      mockToolPath,
      `export class MockTool {
        public execute() {
          return "original";
        }
      }`,
      'utf-8'
    );
  });

  afterEach(() => {
    if (mockToolPath && fs.existsSync(mockToolPath)) {
      fs.rmSync(mockToolPath, { force: true });
    }
  });

  it('applies changes successfully for valid TypeScript code', () => {
    const validCode = `export class MockTool {
      public execute() {
        return "repaired";
      }
    }`;

    // tsc --noEmit won't report errors since the new code compiles fine
    const result = ZavorthSandboxDebuggerService.validateAndApply(mockToolPath, validCode);
    
    expect(result).toBe(true);
    expect(fs.readFileSync(mockToolPath, 'utf-8')).toBe(validCode);
  });

  it('rolls back changes and returns false for syntactically invalid TypeScript code', () => {
    const invalidCode = `export class MockTool {
      public execute() {
        return "repaired"
        // Missing closing braces and syntax error
    `;

    const result = ZavorthSandboxDebuggerService.validateAndApply(mockToolPath, invalidCode);

    expect(result).toBe(false);
    // Should have rolled back to original content
    expect(fs.readFileSync(mockToolPath, 'utf-8')).toContain('original');
  });
});
