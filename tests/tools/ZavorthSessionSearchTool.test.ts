import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZavorthSessionSearchTool } from '../../src/tools/ZavorthSessionSearchTool';

describe('ZavorthSessionSearchTool', () => {
  let tool: ZavorthSessionSearchTool;
  let tempDir: string;
  let sessionsDir: string;
  let memoryDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'session-search-'));
    sessionsDir = path.join(tempDir, 'sessions');
    memoryDir = path.join(tempDir, 'memory');
    fs.mkdirSync(sessionsDir, { recursive: true });
    fs.mkdirSync(memoryDir, { recursive: true });

    fs.writeFileSync(path.join(sessionsDir, 'session1.md'), 'User asked about TypeScript generics.\nAssistant explained with examples.');
    fs.writeFileSync(path.join(sessionsDir, 'session2.md'), 'User wanted to deploy Docker containers.\nAssistant helped with Dockerfile.');
    fs.writeFileSync(path.join(memoryDir, '2025-01-01.md'), 'Learned about Zavorth architecture.');

    tool = new ZavorthSessionSearchTool({ sessionsDir, memoryDir });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('exposes correct name', () => {
    expect(tool.name).toBe('zavorth_session_search');
  });

  it('returns error when query is missing', async () => {
    const result = await tool.execute({});
    expect(result).toContain('Erro');
    expect(result).toContain('query');
  });

  it('finds matches in sessions', async () => {
    const result = await tool.execute({ query: 'TypeScript' });
    expect(result).toContain('TypeScript');
    expect(result).toContain('resultado');
  });

  it('finds matches in memory', async () => {
    const result = await tool.execute({ query: 'Zavorth' });
    expect(result).toContain('Zavorth');
  });

  it('returns no results for missing query', async () => {
    const result = await tool.execute({ query: 'nonexistent_term_xyz' });
    expect(result).toContain('Nenhum resultado');
  });

  it('limits results with max_results', async () => {
    const result = await tool.execute({ query: 'a', max_results: 1 });
    expect(result).toContain('1 resultado');
  });

  it('supports exact search mode', async () => {
    const result = await tool.execute({ query: 'TypeScript generics', search_mode: 'exact' });
    expect(result).toContain('TypeScript');
  });

  it('filters by date', async () => {
    const result = await tool.execute({
      query: 'Zavorth',
      date_from: '2025-01-01',
      date_to: '2025-12-31',
    });
    expect(result).toContain('Zavorth');
  });
});
