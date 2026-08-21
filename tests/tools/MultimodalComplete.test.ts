import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZavorthVisionService } from '../../src/services/plugins/ZavorthVisionService';
import { ZavorthAudioAnalyzerService } from '../../src/services/plugins/ZavorthAudioAnalyzerService';
import { ZavorthVideoAnalyzerService } from '../../src/services/plugins/ZavorthVideoAnalyzerService';
import { MultimodalProviderSelector } from '../../src/services/plugins/MultimodalProviderSelector';
import { DocumentIntelligenceService } from '../../src/services/plugins/DocumentIntelligenceService';
import { CodeIntelligenceService } from '../../src/services/plugins/CodeIntelligenceService';

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'multimodal-'));

describe('Multimodal Services', () => {
  let dir: string;
  beforeEach(() => { dir = tmpDir(); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  describe('ZavorthVisionService', () => {
    const svc = new ZavorthVisionService();

    it('has correct name', () => { expect(svc.name).toBe('zavorth_vision'); });
    it('has description', () => { expect(svc.description).toBeTruthy(); });
    it('has parameters', () => { expect(svc.parameters).toBeDefined(); });
    it('returns error without action', async () => { expect(await svc.execute({})).toContain('Error'); });
    it('returns error without image', async () => { expect(await svc.execute({ action: 'analyze' })).toContain('Error'); });
    it('returns error for invalid action', async () => {
      const r = await svc.execute({ action: 'invalid', image_path: '/tmp/test.jpg' });
      expect(r).toContain('invalid');
    });
    it('returns error for non-existent file', async () => {
      const r = await svc.execute({ action: 'analyze', image_path: '/nonexistent' });
      expect(r).toContain('Error');
    });
    it('getDefinition returns valid structure', () => {
      const def = svc.getDefinition();
      expect(def.name).toBe('zavorth_vision');
      expect(def.parameters).toBeDefined();
    });
  });

  describe('ZavorthAudioAnalyzerService', () => {
    const svc = new ZavorthAudioAnalyzerService();

    it('has correct name', () => { expect(svc.name).toBe('zavorth_audio_analyzer'); });
    it('has description', () => { expect(svc.description).toBeTruthy(); });
    it('has parameters', () => { expect(svc.parameters).toBeDefined(); });
    it('returns error without action', async () => { expect(await svc.execute({})).toContain('Error'); });
    it('returns error without audio', async () => { expect(await svc.execute({ action: 'analyze' })).toContain('Error'); });
    it('lists capabilities', async () => { expect(await svc.execute({ action: 'list_capabilities' })).toContain('analyze'); });
    it('returns error for invalid action', async () => {
      const r = await svc.execute({ action: 'invalid', audio_path: '/tmp/test.mp3' });
      expect(r).toContain('invalid');
    });
    it('returns error for non-existent file', async () => {
      const r = await svc.execute({ action: 'analyze', audio_path: '/nonexistent' });
      expect(r).toContain('Error');
    });
    it('getDefinition returns valid structure', () => {
      const def = svc.getDefinition();
      expect(def.name).toBe('zavorth_audio_analyzer');
      expect(def.parameters).toBeDefined();
    });
  });

  describe('ZavorthVideoAnalyzerService', () => {
    const svc = new ZavorthVideoAnalyzerService();

    it('has correct name', () => { expect(svc.name).toBe('zavorth_video_analyzer'); });
    it('has description', () => { expect(svc.description).toBeTruthy(); });
    it('has parameters', () => { expect(svc.parameters).toBeDefined(); });
    it('returns error without action', async () => { expect(await svc.execute({})).toContain('Error'); });
    it('returns error without video', async () => { expect(await svc.execute({ action: 'analyze' })).toContain('Error'); });
    it('lists capabilities', async () => { expect(await svc.execute({ action: 'list_capabilities' })).toContain('analyze'); });
    it('returns error for invalid action', async () => {
      const r = await svc.execute({ action: 'invalid', video_path: '/tmp/test.mp4' });
      expect(r).toContain('invalid');
    });
    it('returns error for non-existent file', async () => {
      const r = await svc.execute({ action: 'analyze', video_path: '/nonexistent' });
      expect(r).toContain('Error');
    });
    it('getDefinition returns valid structure', () => {
      const def = svc.getDefinition();
      expect(def.name).toBe('zavorth_video_analyzer');
      expect(def.parameters).toBeDefined();
    });
  });

  describe('MultimodalProviderSelector', () => {
    it('loads module', async () => {
      const mod = await import('../../src/services/plugins/MultimodalProviderSelector');
      expect(mod).toBeDefined();
    });

    it('has listProviders function', async () => {
      const mod = await import('../../src/services/plugins/MultimodalProviderSelector');
      expect(typeof mod.listProviders).toBe('function');
    });

    it('has getSetupInstructions function', async () => {
      const mod = await import('../../src/services/plugins/MultimodalProviderSelector');
      expect(typeof mod.getSetupInstructions).toBe('function');
    });

    it('has getQuickSetup function', async () => {
      const mod = await import('../../src/services/plugins/MultimodalProviderSelector');
      expect(typeof mod.getQuickSetup).toBe('function');
    });

    it('has getAvailableProviders function', async () => {
      const mod = await import('../../src/services/plugins/MultimodalProviderSelector');
      expect(typeof mod.getAvailableProviders).toBe('function');
    });

    it('has getBestProvider function', async () => {
      const mod = await import('../../src/services/plugins/MultimodalProviderSelector');
      expect(typeof mod.getBestProvider).toBe('function');
    });
  });

  describe('DocumentIntelligenceService', () => {
    const svc = new DocumentIntelligenceService({ storageDir: dir });

    it('analyzes document', async () => {
      const file = path.join(dir, 'test.txt');
      fs.writeFileSync(file, 'Hello world. This is a test document with some content.');
      const r = await svc.analyze(file);
      expect(r).toContain('Document Analysis');
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
    const svc = new CodeIntelligenceService({ storageDir: dir });

    it('analyzes code', () => {
      const file = path.join(dir, 'test.ts');
      fs.writeFileSync(file, 'function hello() {\n  console.log("hi");\n}\n');
      const r = svc.analyzeCode(file);
      expect(r).toContain('Code Analysis');
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
});
