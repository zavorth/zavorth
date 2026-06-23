import fs from 'fs';
import os from 'os';
import path from 'path';
import { DocumentIntelligenceService } from '../../src/services/plugins/DocumentIntelligenceService';

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'doc-intel-'));

describe('DocumentIntelligenceService', () => {
  let svc: DocumentIntelligenceService;
  let dir: string;
  beforeEach(() => { dir = tmpDir(); svc = new DocumentIntelligenceService({ storageDir: dir }); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

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

  it('returns error for non-existent file', async () => {
    expect(await svc.analyze('/nonexistent')).toContain('Error');
  });

  it('returns error for non-existent search', () => {
    expect(svc.searchInDocument('/nonexistent', 'test')).toContain('Error');
  });
});
