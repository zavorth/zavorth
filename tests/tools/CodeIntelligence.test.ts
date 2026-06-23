import fs from 'fs';
import os from 'os';
import path from 'path';
import { CodeIntelligenceService } from '../../src/services/plugins/CodeIntelligenceService';

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'code-intel-'));

describe('CodeIntelligenceService', () => {
  let svc: CodeIntelligenceService;
  let dir: string;
  beforeEach(() => { dir = tmpDir(); svc = new CodeIntelligenceService({ storageDir: dir }); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('analyzes code', () => {
    const file = path.join(dir, 'test.ts');
    fs.writeFileSync(file, 'function hello() {\n  console.log("hi");\n}\n');
    const r = svc.analyzeCode(file);
    expect(r).toContain('Code Analysis');
    expect(r).toContain('test.ts');
  });

  it('gets metrics', () => {
    const file = path.join(dir, 'test.ts');
    fs.writeFileSync(file, '// comment\nconst x = 1;\n\nfunction foo() {}\n');
    const metrics = svc.getMetrics(file);
    expect(metrics.language).toBe('typescript');
    expect(metrics.functions).toBe(1);
  });

  it('extracts functions', () => {
    const content = 'function hello() {}\nconst foo = () => {}\n';
    const funcs = svc.extractFunctions(content, 'typescript');
    expect(funcs.length).toBe(2);
  });

  it('extracts classes', () => {
    const content = 'class MyClass {\n  method() {}\n}\n';
    const classes = svc.extractClasses(content, 'typescript');
    expect(classes.length).toBe(1);
    expect(classes[0].name).toBe('MyClass');
  });

  it('calculates complexity', () => {
    const content = 'if (a) { if (b) { if (c) {} } }';
    const complexity = svc.calculateComplexity(content, 'typescript');
    expect(complexity).toBeGreaterThan(1);
  });

  it('detects issues', () => {
    const content = 'console.log("test");\n// TODO: fix this';
    const issues = svc.detectIssues(content, 'typescript');
    expect(issues.length).toBeGreaterThan(0);
  });

  it('searches code', () => {
    const subdir = path.join(dir, 'src');
    fs.mkdirSync(subdir);
    fs.writeFileSync(path.join(subdir, 'test.ts'), 'function hello() {}');
    const r = svc.searchCode(dir, 'hello');
    expect(r).toContain('hello');
  });

  it('suggests refactoring', () => {
    const file = path.join(dir, 'test.ts');
    fs.writeFileSync(file, 'function foo() {}\n');
    const r = svc.suggestRefactoring(file);
    expect(r).toBeDefined();
  });

  it('returns error for non-existent file', () => {
    expect(svc.analyzeCode('/nonexistent')).toContain('Error');
  });

  it('returns error for non-existent search', () => {
    expect(svc.searchCode('/nonexistent', 'test')).toContain('Error');
  });
});
