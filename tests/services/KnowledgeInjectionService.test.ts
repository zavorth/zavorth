import fs from 'fs';
import os from 'os';
import path from 'path';
import { KnowledgeInjectionService } from '../../src/services/KnowledgeInjectionService';

describe('KnowledgeInjectionService', () => {
  let tempDir = '';

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-knowledge-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('starts with zero entries when no KNOWLEDGE.md exists', () => {
    const service = new KnowledgeInjectionService({ projectRoot: tempDir });

    const status = service.getStatus();

    expect(status.totalEntries).toBe(0);
    expect(status.filePath).toBe(path.join(tempDir, 'KNOWLEDGE.md'));
  });

  it('adds an inline entry and persists it to KNOWLEDGE.md', () => {
    const service = new KnowledgeInjectionService({ projectRoot: tempDir });

    const entry = service.addEntry({
      id: 'coding-standards',
      sourceType: 'inline',
      category: 'reference',
      label: 'Coding Standards',
      description: 'Project coding standards',
      content: 'Use TypeScript strict mode.',
      tags: ['standards', 'typescript'],
    });

    expect(entry.id).toBe('coding-standards');
    expect(fs.existsSync(path.join(tempDir, 'KNOWLEDGE.md'))).toBe(true);
    const fileContent = fs.readFileSync(path.join(tempDir, 'KNOWLEDGE.md'), 'utf8');
    expect(fileContent).toContain('Coding Standards');
    expect(fileContent).toContain('id:coding-standards');
  });

  it('lists entries across multiple sections', () => {
    const service = new KnowledgeInjectionService({ projectRoot: tempDir });
    service.addEntry({ id: 'ref-1', sourceType: 'inline', category: 'reference', label: 'Ref One', description: 'desc', tags: [] });
    service.addEntry({ id: 'dom-1', sourceType: 'inline', category: 'domain', label: 'Dom One', description: 'desc', tags: [] });

    const entries = service.listEntries();

    expect(entries.length).toBe(2);
    expect(entries.map((e) => e.id)).toEqual(expect.arrayContaining(['ref-1', 'dom-1']));
  });

  it('removes an entry by id', () => {
    const service = new KnowledgeInjectionService({ projectRoot: tempDir });
    service.addEntry({ id: 'to-remove', sourceType: 'inline', category: 'reference', label: 'Remove Me', description: 'desc', tags: [] });

    const removed = service.removeEntry('to-remove');

    expect(removed).toBe(true);
    expect(service.listEntries().length).toBe(0);
  });

  it('returns false when removing a non-existent id', () => {
    const service = new KnowledgeInjectionService({ projectRoot: tempDir });

    const removed = service.removeEntry('does-not-exist');

    expect(removed).toBe(false);
  });

  it('validates sources reporting missing file paths as invalid', () => {
    const service = new KnowledgeInjectionService({ projectRoot: tempDir });
    service.addEntry({ id: 'missing-file', sourceType: 'file', category: 'project', label: 'Missing', description: 'desc', path: 'nonexistent.txt', tags: [] });

    const result = service.validateSources();

    expect(result.invalid).toContain('missing-file');
  });
});
