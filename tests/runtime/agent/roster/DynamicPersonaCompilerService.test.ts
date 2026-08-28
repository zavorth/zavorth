import { DynamicPersonaCompilerService } from '../../../../src/runtime/agent/roster/DynamicPersonaCompilerService.js';

describe('DynamicPersonaCompilerService', () => {
  const compiler = new DynamicPersonaCompilerService();

  it('should compile a specialized database persona from SQL-related intent', async () => {
    const result = await compiler.compileFromIntent({
      userIntent: 'optimize slow PostgreSQL queries and review table indexes',
      requestedId: 'pg-tuner',
    });

    expect(result.id).toBe('pg-tuner');
    expect(result.name).toBe('Database Specialist');
    expect(result.role).toContain('Database');
    expect(result.allowedTools).toEqual(expect.arrayContaining(['database_query', 'database_explain', 'read_file']));
    expect(result.isolationMode).toBe('direct');
    expect(result.systemPrompt).toContain('optimize slow PostgreSQL queries');
  });

  it('should compile a web navigation persona with docker isolation when web scraping intent is detected', async () => {
    const result = await compiler.compileFromIntent({
      userIntent: 'crawl and scrape public documentation from web pages with playwright',
    });

    expect(result.id).toBe('web-navigator');
    expect(result.allowedTools).toEqual(expect.arrayContaining(['read_url_content', 'playwright_browser']));
    expect(result.isolationMode).toBe('docker');
  });

  it('should compile a security auditor persona when security/vulnerability intent is requested', async () => {
    const result = await compiler.compileFromIntent({
      userIntent: 'audit project for hardcoded secrets, open ports, and vulnerable dependencies',
    });

    expect(result.id).toBe('security-specialist');
    expect(result.role).toContain('Security');
    expect(result.avatar).toBe('shield');
  });

  it('should support LLM-centered intelligent semantic synthesis when llmClient is provided', async () => {
    const mockLlmClient = {
      completePrompt: jest.fn(async () => JSON.stringify({
        id: 'cockroach-optimizer',
        name: 'CockroachDB Specialist',
        role: 'Distributed SQL & Raft Consensus Performance Specialist',
        avatar: 'database',
        tools: ['database_query', 'database_explain'],
        isolationMode: 'docker',
        systemPrompt: 'Optimize distributed SQL execution across multi-region clusters.',
      })),
    };

    const llmCompiler = new DynamicPersonaCompilerService(mockLlmClient);
    const result = await llmCompiler.compileFromIntent({
      userIntent: 'tune distributed queries across multi-region CockroachDB clusters',
    });

    expect(mockLlmClient.completePrompt).toHaveBeenCalledTimes(1);
    expect(result.id).toBe('cockroach-optimizer');
    expect(result.name).toBe('CockroachDB Specialist');
    expect(result.role).toContain('Distributed SQL');
    expect(result.isolationMode).toBe('docker');
  });

  it('should throw an error when intent is empty', async () => {
    await expect(compiler.compileFromIntent({ userIntent: '   ' })).rejects.toThrow('User intent cannot be empty');
  });
});
