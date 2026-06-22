import fs from 'fs';
import os from 'os';
import path from 'path';
import { ImageGenComfyUITool } from '../../src/services/plugins/ImageGenComfyUITool';
import { MemoryQdrantService } from '../../src/services/plugins/MemoryQdrantService';
import { DiskCleanupService } from '../../src/services/plugins/DiskCleanupService';
import { CodexSupervisorService } from '../../src/services/plugins/CodexSupervisorService';

describe('ImageGenComfyUITool', () => {
  const tool = new ImageGenComfyUITool();

  it('exposes correct name', () => {
    expect(tool.name).toBe('zavorth_comfyui');
  });

  it('lists workflows', async () => {
    const result = await tool.execute({ action: 'list_workflows' });
    expect(result).toContain('txt2img');
    expect(result).toContain('img2img');
  });

  it('returns error without action', async () => {
    const result = await tool.execute({});
    expect(result).toContain('Erro');
  });

  it('returns error for invalid action', async () => {
    const result = await tool.execute({ action: 'dance' });
    expect(result).toContain('Erro');
  });
});

describe('MemoryQdrantService', () => {
  let service: MemoryQdrantService;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qdrant-'));
    service = new MemoryQdrantService({ storageDir: tempDir });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates a collection', () => {
    const result = service.createCollection('test', 64);
    expect(result).toContain('criada');
  });

  it('prevents duplicate collection', () => {
    service.createCollection('test', 64);
    const result = service.createCollection('test', 64);
    expect(result).toContain('ja existe');
  });

  it('validates collection name', () => {
    const result = service.createCollection('../etc/passwd');
    expect(result).toContain('Erro');
  });

  it('upserts vectors', () => {
    service.createCollection('test', 4);
    const result = service.upsert('test', [
      { id: 'v1', vector: [1, 0, 0, 0], payload: { content: 'hello' } },
      { id: 'v2', vector: [0, 1, 0, 0], payload: { content: 'world' } },
    ]);
    expect(result).toContain('2');
  });

  it('searches by vector', () => {
    service.createCollection('test', 4);
    service.upsert('test', [
      { id: 'v1', vector: [1, 0, 0, 0], payload: { content: 'hello' } },
      { id: 'v2', vector: [0, 1, 0, 0], payload: { content: 'world' } },
    ]);
    const results = service.search('test', [1, 0, 0, 0], 2);
    expect(results.length).toBe(2);
    expect(results[0].id).toBe('v1');
  });

  it('searches and returns formatted results', () => {
    service.createCollection('test', 4);
    service.upsert('test', [{ id: 'v1', vector: [1, 0, 0, 0], payload: { content: 'hello world' } }]);
    const result = service.searchAndReturn('test', 'hello', 5);
    expect(result).toContain('hello');
  });

  it('retrieves a point', () => {
    service.createCollection('test', 4);
    service.upsert('test', [{ id: 'v1', vector: [1, 0, 0, 0], payload: { content: 'test' } }]);
    const point = service.retrieve('test', 'v1');
    expect(point).toBeTruthy();
    expect(point!.payload.content).toBe('test');
  });

  it('deletes points', () => {
    service.createCollection('test', 4);
    service.upsert('test', [{ id: 'v1', vector: [1, 0, 0, 0] }]);
    const result = service.delete('test', ['v1']);
    expect(result).toContain('1');
  });

  it('deletes collection', () => {
    service.createCollection('temp', 4);
    const result = service.deleteCollection('temp');
    expect(result).toContain('deletada');
  });

  it('lists collections', () => {
    service.createCollection('a', 4);
    service.createCollection('b', 8);
    const result = service.listCollections();
    expect(result).toContain('a');
    expect(result).toContain('b');
  });

  it('gets stats', () => {
    service.createCollection('test', 4);
    service.upsert('test', [{ id: 'v1', vector: [1, 0, 0, 0] }]);
    const result = service.getStats('test');
    expect(result).toContain('1 vetores');
  });

  it('validates vector dimension', () => {
    service.createCollection('test', 4);
    const result = service.upsert('test', [{ id: 'v1', vector: [1, 0] }]);
    expect(result).toContain('Erro');
  });
});

describe('DiskCleanupService', () => {
  let service: DiskCleanupService;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cleanup-'));
    service = new DiskCleanupService({ storageDir: tempDir });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('lists rules', () => {
    const result = service.listRules();
    expect(result).toContain('temp_files');
    expect(result).toContain('screenshots');
  });

  it('adds a custom rule', () => {
    const result = service.addRule({
      name: 'Custom cleanup',
      pattern: '*.custom',
      max_age_days: 1,
      max_size_mb: 10,
      directories: [tempDir],
      dry_run: false,
      enabled: true,
    });
    expect(result).toContain('adicionada');
  });

  it('toggles a rule', () => {
    const result = service.toggleRule('temp_files', false);
    expect(result).toContain('desabilitada');
  });

  it('returns error for non-existent rule toggle', () => {
    const result = service.toggleRule('nonexistent', true);
    expect(result).toContain('nao encontrada');
  });
});

describe('CodexSupervisorService', () => {
  let service: CodexSupervisorService;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'supervisor-'));
    service = new CodexSupervisorService({ storageDir: tempDir, maxConcurrent: 2 });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('lists tasks when empty', () => {
    const result = service.listTasks();
    expect(result).toContain('Nenhuma');
  });

  it('gets stats', () => {
    const result = service.getStats();
    expect(result).toContain('Supervisor Stats');
    expect(result).toContain('0');
  });

  it('returns error for non-existent task status', () => {
    const result = service.getStatus('nonexistent');
    expect(result).toContain('nao encontrada');
  });

  it('returns error for kill on non-existent task', () => {
    const result = service.kill('nonexistent');
    expect(result).toContain('nao encontrada');
  });

  it('cleans up old tasks', () => {
    const result = service.cleanup(0);
    expect(result).toContain('removida');
  });
});
