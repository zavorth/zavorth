import fs from 'fs';
import os from 'os';
import path from 'path';
import { MemoryLanceDBService } from '../../src/services/plugins/MemoryLanceDBService';

describe('MemoryLanceDBService', () => {
  let service: MemoryLanceDBService;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lancedb-test-'));
    service = new MemoryLanceDBService({ dbPath: tempDir, dimension: 64 });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates a collection', () => {
    const result = service.createCollection('test');
    expect(result).toContain('criada');
  });

  it('prevents duplicate collection', () => {
    service.createCollection('test');
    const result = service.createCollection('test');
    expect(result).toContain('ja existe');
  });

  it('lists collections', () => {
    service.createCollection('a');
    service.createCollection('b');
    const result = service.listCollections();
    expect(result).toContain('a');
    expect(result).toContain('b');
  });

  it('inserts a document', () => {
    service.createCollection('docs');
    const result = service.insert('docs', 'Hello world', { type: 'test' });
    expect(result).toContain('inserido');
  });

  it('inserts batch documents', () => {
    service.createCollection('docs');
    const result = service.insertBatch('docs', [
      { content: 'Doc 1' },
      { content: 'Doc 2' },
      { content: 'Doc 3' },
    ]);
    expect(result).toContain('3 documentos');
  });

  it('queries documents', () => {
    service.createCollection('docs');
    service.insert('docs', 'TypeScript is great');
    service.insert('docs', 'Python is also great');
    service.insert('docs', 'Cooking recipes');
    const results = service.query('docs', 'programming language', 3);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].score).toBeGreaterThan(0);
  });

  it('queries with metadata filter', () => {
    service.createCollection('docs');
    service.insert('docs', 'Hello', { lang: 'en' });
    service.insert('docs', 'Hola', { lang: 'es' });
    const results = service.query('docs', 'greeting', 5, { lang: 'en' });
    expect(results.length).toBe(1);
  });

  it('deletes a document', () => {
    service.createCollection('docs');
    service.insert('docs', 'Delete me');
    const docs = service.query('docs', 'delete', 1);
    const result = service.delete('docs', docs[0].id);
    expect(result).toContain('deletado');
  });

  it('deletes a collection', () => {
    service.createCollection('temp');
    const result = service.deleteCollection('temp');
    expect(result).toContain('deletada');
  });

  it('gets stats', () => {
    service.createCollection('docs');
    service.insert('docs', 'Test');
    const result = service.getStats('docs');
    expect(result).toContain('1 documentos');
  });

  it('gets global stats', () => {
    service.createCollection('a');
    service.createCollection('b');
    service.insert('a', 'Test');
    const result = service.getStats();
    expect(result).toContain('2 colecoes');
  });
});
