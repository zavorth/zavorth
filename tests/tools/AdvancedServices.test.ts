import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZavorthPluginMarketplaceService } from '../../src/services/plugins/ZavorthPluginMarketplaceService';
import { DocumentIntelligenceService } from '../../src/services/plugins/DocumentIntelligenceService';
import { CodeIntelligenceService } from '../../src/services/plugins/CodeIntelligenceService';
import { DataPipelineService } from '../../src/services/plugins/DataPipelineService';

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'marketplace-'));

describe('ZavorthPluginMarketplaceService', () => {
  let svc: ZavorthPluginMarketplaceService;
  let dir: string;
  beforeEach(() => { dir = tmpDir(); svc = new ZavorthPluginMarketplaceService({ storageDir: dir }); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('creates instance', () => { expect(svc).toBeDefined(); });
  it('searches plugins', () => { expect(svc.search('vision')).toContain('Vision'); });
  it('searches by category', () => { expect(svc.search('', 'ai-safety')).toContain('AI Safety'); });
  it('gets plugin info', () => { expect(svc.getPlugin('zavorth-llm-router')).toContain('LLM Router'); });
  it('returns error for non-existent plugin', () => { expect(svc.getPlugin('nonexistent')).toContain('Error'); });
  it('installs plugin', () => { expect(svc.installPlugin('zavorth-ai-safety')).toContain('already installed'); });
  it('uninstalls plugin', () => { expect(svc.uninstallPlugin('zavorth-ai-safety')).toContain('uninstalled'); });
  it('enables plugin', () => { expect(svc.enablePlugin('zavorth-ai-safety')).toContain('enabled'); });
  it('disables plugin', () => { expect(svc.disablePlugin('zavorth-ai-safety')).toContain('disabled'); });
  it('rates plugin', () => { expect(svc.ratePlugin('zavorth-ai-safety', 'user1', 5, 'Great!')).toContain('submitted'); });
  it('gets reviews', () => { svc.ratePlugin('zavorth-ai-safety', 'user1', 5, 'Great!'); expect(svc.getReviews('zavorth-ai-safety')).toContain('Great!'); });
  it('lists categories', () => { expect(svc.listCategories()).toContain('ai-safety'); });
  it('gets featured', () => { expect(svc.getFeatured()).toContain('Featured'); });
  it('gets trending', () => { expect(svc.getTrending()).toContain('Trending'); });
  it('gets stats', () => { expect(svc.getStats()).toContain('Total plugins'); });
});

describe('DocumentIntelligenceService', () => {
  let svc: DocumentIntelligenceService;
  let dir: string;
  beforeEach(() => { dir = tmpDir(); svc = new DocumentIntelligenceService({ storageDir: dir }); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('creates instance', () => { expect(svc).toBeDefined(); });
  it('analyzes document', async () => {
    const file = path.join(dir, 'test.txt');
    fs.writeFileSync(file, 'Hello world. This is a test document with some content.');
    const r = await svc.analyze(file);
    expect(r).toContain('Document Analysis');
    expect(r).toContain('test.txt');
  });
  it('extracts text', () => {
    const file = path.join(dir, 'test.txt');
    fs.writeFileSync(file, 'Hello world');
    expect(svc.extractText(file)).toBe('Hello world');
  });
  it('gets metadata', () => {
    const file = path.join(dir, 'test.txt');
    fs.writeFileSync(file, 'Hello world test');
    const meta = svc.getMetadata(file);
    expect(meta.filename).toBe('test.txt');
    expect(meta.words).toBe(3);
  });
  it('extracts sections', () => {
    const content = '# Title\nSome content\n## Subtitle\nMore content';
    const sections = svc.extractSections(content);
    expect(sections.length).toBe(2);
    expect(sections[0].title).toBe('Title');
  });
  it('generates summary', () => {
    const content = 'This is sentence one. This is sentence two. This is sentence three.';
    const summary = svc.generateSummary(content, 50);
    expect(summary.length).toBeLessThanOrEqual(60);
  });
  it('compares documents', () => {
    const file1 = path.join(dir, 'a.txt');
    const file2 = path.join(dir, 'b.txt');
    fs.writeFileSync(file1, 'hello world foo');
    fs.writeFileSync(file2, 'hello world bar');
    const r = svc.compareDocuments(file1, file2);
    expect(r).toContain('Similarity');
  });
  it('searches in document', () => {
    const file = path.join(dir, 'test.txt');
    fs.writeFileSync(file, 'Line 1\nLine 2 with keyword\nLine 3');
    const r = svc.searchInDocument(file, 'keyword');
    expect(r).toContain('keyword');
  });
  it('extracts keywords', () => {
    const content = 'hello world hello test world hello';
    const r = svc.extractKeywords(content);
    expect(r).toContain('hello');
  });
  it('returns error for non-existent file', async () => { expect(await svc.analyze('/nonexistent')).toContain('Error'); });
  it('returns error for non-existent search', () => { expect(svc.searchInDocument('/nonexistent', 'test')).toContain('Error'); });
});

describe('CodeIntelligenceService', () => {
  let svc: CodeIntelligenceService;
  let dir: string;
  beforeEach(() => { dir = tmpDir(); svc = new CodeIntelligenceService({ storageDir: dir }); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('creates instance', () => { expect(svc).toBeDefined(); });
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
  it('returns error for non-existent file', () => { expect(svc.analyzeCode('/nonexistent')).toContain('Error'); });
  it('returns error for non-existent search', () => { expect(svc.searchCode('/nonexistent', 'test')).toContain('Error'); });
});

describe('DataPipelineService', () => {
  let svc: DataPipelineService;
  let dir: string;
  beforeEach(() => { dir = tmpDir(); svc = new DataPipelineService({ storageDir: dir }); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('creates instance', () => { expect(svc).toBeDefined(); });
  it('creates pipeline', () => { expect(svc.createPipeline('test', 'desc')).toContain('created'); });
  it('lists pipelines', () => { svc.createPipeline('test', 'desc'); expect(svc.listPipelines()).toContain('test'); });
  it('gets pipeline info', () => { svc.createPipeline('test', 'desc'); const id = svc.listPipelines().match(/pipeline_\w+/)?.[0] || ''; expect(svc.getPipeline(id)).toContain('test'); });
  it('adds step', () => { svc.createPipeline('test', 'desc'); const id = svc.listPipelines().match(/pipeline_\w+/)?.[0] || ''; expect(svc.addStep(id, 'extract', { source: 'test.json' })).toContain('added'); });
  it('deletes pipeline', () => { svc.createPipeline('test', 'desc'); const id = svc.listPipelines().match(/pipeline_\w+/)?.[0] || ''; expect(svc.deletePipeline(id)).toContain('deleted'); });
  it('returns error for non-existent pipeline', () => { expect(svc.getPipeline('nonexistent')).toContain('Error'); });
  it('gets stats', () => { svc.createPipeline('test', 'desc'); expect(svc.getStats()).toContain('Pipelines: 1'); });
  it('lists when empty', () => { expect(svc.listPipelines()).toContain('No pipelines'); });
  it('runs extract pipeline', async () => {
    const data = [{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }];
    fs.writeFileSync(path.join(dir, 'input.json'), JSON.stringify(data));
    svc.createPipeline('test', 'desc');
    const id = svc.listPipelines().match(/pipeline_\w+/)?.[0] || '';
    svc.addStep(id, 'extract', { source: path.join(dir, 'input.json'), format: 'json' });
    const r = await svc.runPipeline(id);
    expect(r).toContain('completed');
  });
  it('runs filter pipeline', async () => {
    const data = [{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }];
    fs.writeFileSync(path.join(dir, 'input.json'), JSON.stringify(data));
    svc.createPipeline('test', 'desc');
    const id = svc.listPipelines().match(/pipeline_\w+/)?.[0] || '';
    svc.addStep(id, 'extract', { source: path.join(dir, 'input.json'), format: 'json' });
    svc.addStep(id, 'filter', { field: 'age', operator: 'gt', value: 27 });
    const r = await svc.runPipeline(id);
    expect(r).toContain('completed');
  });
  it('runs sort pipeline', async () => {
    const data = [{ name: 'Bob', age: 25 }, { name: 'Alice', age: 30 }];
    fs.writeFileSync(path.join(dir, 'input.json'), JSON.stringify(data));
    svc.createPipeline('test', 'desc');
    const id = svc.listPipelines().match(/pipeline_\w+/)?.[0] || '';
    svc.addStep(id, 'extract', { source: path.join(dir, 'input.json'), format: 'json' });
    svc.addStep(id, 'sort', { field: 'age', order: 'asc' });
    const r = await svc.runPipeline(id);
    expect(r).toContain('completed');
  });
  it('runs aggregate pipeline', async () => {
    const data = [{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }];
    fs.writeFileSync(path.join(dir, 'input.json'), JSON.stringify(data));
    svc.createPipeline('test', 'desc');
    const id = svc.listPipelines().match(/pipeline_\w+/)?.[0] || '';
    svc.addStep(id, 'extract', { source: path.join(dir, 'input.json'), format: 'json' });
    svc.addStep(id, 'aggregate', { field: 'age', operation: 'avg' });
    const r = await svc.runPipeline(id);
    expect(r).toContain('completed');
  });
});
