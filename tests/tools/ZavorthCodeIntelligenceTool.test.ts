import fs from 'fs';
import path from 'path';
import os from 'os';
import { ZavorthCodeIntelligenceTool } from '../../src/tools/ZavorthCodeIntelligenceTool';

describe('ZavorthCodeIntelligenceTool', () => {
  let tool: ZavorthCodeIntelligenceTool;
  let tmpDir: string;

  beforeEach(() => {
    tool = new ZavorthCodeIntelligenceTool();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'code-intel-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('exposes correct name', () => {
    expect(tool.name).toBe('zavorth_code_intelligence');
  });

  it('returns error without action', async () => {
    const result = await tool.execute({});
    expect(result).toContain('Error');
    expect(result).toContain('action');
  });

  it('returns error for invalid action', async () => {
    const result = await tool.execute({ action: 'deploy' });
    expect(result).toContain('Error');
    expect(result).toContain('invalid');
  });

  describe('analyze', () => {
    it('analyzes a file', async () => {
      const filePath = path.join(tmpDir, 'sample.ts');
      fs.writeFileSync(filePath, 'export function hello() {\n  return "world";\n}\n', 'utf-8');
      const result = await tool.execute({ action: 'analyze', file_path: filePath });
      expect(result).toContain('Code Analysis');
      expect(result).toContain('Lines:');
      expect(result).toContain('Language: TypeScript');
    });

    it('analyzes a directory', async () => {
      fs.writeFileSync(path.join(tmpDir, 'a.ts'), 'const x = 1;', 'utf-8');
      fs.writeFileSync(path.join(tmpDir, 'b.js'), 'var y = 2;', 'utf-8');
      const result = await tool.execute({ action: 'analyze', file_path: tmpDir });
      expect(result).toContain('Files:');
      expect(result).toContain('.ts:');
      expect(result).toContain('.js:');
    });

    it('returns error for non-existent file', async () => {
      const result = await tool.execute({ action: 'analyze', file_path: '/nonexistent/file.ts' });
      expect(result).toContain('Error');
      expect(result).toContain('not found');
    });

    it('counts comment lines', async () => {
      const filePath = path.join(tmpDir, 'comments.ts');
      fs.writeFileSync(filePath, '// comment\nconst x = 1;\n/* block */\n', 'utf-8');
      const result = await tool.execute({ action: 'analyze', file_path: filePath });
      expect(result).toContain('Comments:');
    });
  });

  describe('find_tests', () => {
    it('finds test files', async () => {
      fs.writeFileSync(path.join(tmpDir, 'foo.test.ts'), 'test("x", () => {})', 'utf-8');
      fs.writeFileSync(path.join(tmpDir, 'bar.spec.js'), 'test("y", () => {})', 'utf-8');
      fs.writeFileSync(path.join(tmpDir, 'util.ts'), 'export const x = 1;', 'utf-8');
      const result = await tool.execute({ action: 'find_tests', file_path: tmpDir });
      expect(result).toContain('foo.test.ts');
      expect(result).toContain('bar.spec.js');
      expect(result).not.toContain('util.ts');
    });

    it('returns message when no tests found', async () => {
      fs.writeFileSync(path.join(tmpDir, 'app.ts'), 'const x = 1;', 'utf-8');
      const result = await tool.execute({ action: 'find_tests', file_path: tmpDir });
      expect(result).toContain('No test files found');
    });

    it('returns error for non-existent directory', async () => {
      const result = await tool.execute({ action: 'find_tests', file_path: '/nonexistent' });
      expect(result).toContain('Error');
    });
  });

  describe('extract symbols', () => {
    it('extracts class and function symbols', async () => {
      const content = [
        'export class MyClass {',
        '  method() {}',
        '}',
        'export function myFunc() {}',
        'const myVar = 42;',
      ].join('\n');
      const filePath = path.join(tmpDir, 'symbols.ts');
      fs.writeFileSync(filePath, content, 'utf-8');
      const result = await tool.execute({ action: 'symbols', file_path: filePath });
      expect(result).toContain('MyClass');
      expect(result).toContain('myFunc');
      expect(result).toContain('myVar');
    });

    it('extracts interfaces and types', async () => {
      const content = 'export interface MyInterface {}\nexport type MyType = string;\nexport enum MyEnum { A, B }\n';
      const filePath = path.join(tmpDir, 'types.ts');
      fs.writeFileSync(filePath, content, 'utf-8');
      const result = await tool.execute({ action: 'symbols', file_path: filePath });
      expect(result).toContain('MyInterface');
      expect(result).toContain('MyType');
      expect(result).toContain('MyEnum');
    });

    it('returns message when no symbols found', async () => {
      const filePath = path.join(tmpDir, 'empty.ts');
      fs.writeFileSync(filePath, '// just a comment\n', 'utf-8');
      const result = await tool.execute({ action: 'symbols', file_path: filePath });
      expect(result).toContain('No symbols found');
    });

    it('returns error for non-existent file', async () => {
      const result = await tool.execute({ action: 'symbols', file_path: '/nonexistent' });
      expect(result).toContain('Error');
    });
  });

  describe('analyze complexity', () => {
    it('analyzes a simple file', async () => {
      const content = 'function hello() {\n  return "world";\n}\n';
      const filePath = path.join(tmpDir, 'simple.ts');
      fs.writeFileSync(filePath, content, 'utf-8');
      const result = await tool.execute({ action: 'complexity', file_path: filePath });
      expect(result).toContain('Complexity Analysis');
      expect(result).toContain('Functions:');
      expect(result).toContain('Cyclomatic complexity:');
      expect(result).toContain('Simple');
    });

    it('detects branches and loops', async () => {
      const content = [
        'function process(data) {',
        '  if (data) {',
        '    for (const item of data) {',
        '      if (item.active) { return item; }',
        '    }',
        '  }',
        '  while (false) {}',
        '  return null;',
        '}',
      ].join('\n');
      const filePath = path.join(tmpDir, 'complex.ts');
      fs.writeFileSync(filePath, content, 'utf-8');
      const result = await tool.execute({ action: 'complexity', file_path: filePath });
      expect(result).toContain('Branches:');
      expect(result).toContain('Loops:');
    });

    it('returns error for non-existent file', async () => {
      const result = await tool.execute({ action: 'complexity', file_path: '/nonexistent' });
      expect(result).toContain('Error');
    });
  });
});
