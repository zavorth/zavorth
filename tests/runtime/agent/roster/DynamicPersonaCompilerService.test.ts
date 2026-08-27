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
    expect(result.role).toContain('SQL & Database');
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
    expect(result.isolationMode).toBe('docker'); // Untrusted web crawling defaults to container isolation
  });

  it('should compile a security auditor persona when security/vulnerability intent is requested', async () => {
    const result = await compiler.compileFromIntent({
      userIntent: 'audit project for hardcoded secrets, open ports, and vulnerable dependencies',
    });

    expect(result.id).toBe('security-specialist');
    expect(result.role).toContain('Security');
    expect(result.avatar).toBe('shield');
  });

  it('should throw an error when intent is empty', async () => {
    await expect(compiler.compileFromIntent({ userIntent: '   ' })).rejects.toThrow('User intent cannot be empty');
  });
});
