import fs from 'fs';
import os from 'os';
import path from 'path';
import { ActiveMemoryService } from '../../src/services/plugins/ActiveMemoryService';

describe('ActiveMemoryService', () => {
  let service: ActiveMemoryService;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'active-mem-'));
    service = new ActiveMemoryService({ storageDir: tempDir });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('remembers content', () => {
    const result = service.remember('User likes TypeScript');
    expect(result).toContain('Remembered');
  });

  it('recalls by query', () => {
    service.remember('TypeScript is great for large projects');
    service.remember('Python is good for data science');
    const result = service.recall('TypeScript');
    expect(result).toContain('TypeScript');
  });

  it('forgets an entry', () => {
    const id = service.remember('Forget me');
    const memId = id.match(/\[mem_\w+\]/)![0].slice(1, -1);
    const result = service.forget(memId);
    expect(result).toContain('forgotten');
  });

  it('updates an entry', () => {
    const id = service.remember('Original');
    const memId = id.match(/\[mem_\w+\]/)![0].slice(1, -1);
    const result = service.update(memId, { content: 'Updated' });
    expect(result).toContain('updated');
  });

  it('promotes and demotes', () => {
    const id = service.remember('Important');
    const memId = id.match(/\[mem_\w+\]/)![0].slice(1, -1);
    const promoteResult = service.promote(memId);
    expect(promoteResult).toContain('promoted');
    const demoteResult = service.demote(memId);
    expect(promoteResult).toBeTruthy();
  });

  it('consolidates memories', () => {
    service.remember('Test 1');
    service.remember('Test 2');
    const result = service.consolidate();
    expect(result).toContain('Consolidation');
  });

  it('gets stats', () => {
    service.remember('Test');
    const result = service.getStats();
    expect(result).toContain('Total: 1');
  });

  it('lists entries', () => {
    service.remember('Fact 1', { category: 'fact' });
    service.remember('Pref 1', { category: 'preference' });
    const result = service.listEntries();
    expect(result).toContain('2');
  });

  it('processes interaction for name', () => {
    const decisions = service.processInteraction('Me chamo Ermys', 'Prazer, Ermys!');
    expect(decisions.length).toBeGreaterThan(0);
  });

  it('processes interaction for preference', () => {
    const decisions = service.processInteraction('Eu gosto de chocolate', 'Legal!');
    expect(decisions.length).toBeGreaterThan(0);
  });
});
