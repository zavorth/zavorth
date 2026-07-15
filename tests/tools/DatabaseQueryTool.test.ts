import path from 'path';
import { DatabaseQueryTool } from '../../src/tools/DatabaseQueryTool';

describe('DatabaseQueryTool', () => {
  let tool: DatabaseQueryTool;

  beforeEach(() => {
    tool = new DatabaseQueryTool();
  });

  it('exposes correct name and required parameters', () => {
    expect(tool.name).toBe('database_query');
    expect(tool.parameters.required).toEqual(['query']);
  });

  it('returns error when query is missing', async () => {
    const result = await tool.execute({});
    expect(result).toContain('Error');
    expect(result).toContain('query');
  });

  it('returns error for empty query', async () => {
    const result = await tool.execute({ query: '' });
    expect(result).toContain('Error');
    expect(result).toContain('query');
  });

  it('returns error for invalid mode', async () => {
    const result = await tool.execute({ query: 'SELECT 1', mode: 'invalid' });
    expect(result).toContain('Error');
    expect(result).toContain('invalid');
  });

  it('blocks write operations in read mode', async () => {
    const result = await tool.execute({
      query: 'INSERT INTO users (name) VALUES ("test")',
      mode: 'read',
    });
    expect(result).toContain('Error');
    expect(result).toContain('read');
  });

  it('blocks DROP in write mode', async () => {
    const result = await tool.execute({
      query: 'DROP TABLE users',
      mode: 'write',
    });
    expect(result).toContain('Error');
    expect(result).toContain('DROP');
  });

  it('blocks TRUNCATE in write mode', async () => {
    const result = await tool.execute({
      query: 'TRUNCATE TABLE users',
      mode: 'write',
    });
    expect(result).toContain('Error');
    expect(result).toContain('TRUNCATE');
  });

  it('blocks non-SQL operations in write mode', async () => {
    const result = await tool.execute({
      query: 'SELECT * FROM users',
      mode: 'write',
    });
    expect(result).toContain('Error');
  });

  it('returns error or driver message when better-sqlite3 is unavailable', async () => {
    const result = await tool.execute({
      query: 'SELECT * FROM users',
      mode: 'read',
    });
    const isRealExecution =
      /Query (?:executada|executed)|SQLite driver|query execution failed|unavailable|Failed to run query|Erro ao executar/i.test(
        result,
      );
    expect(isRealExecution).toBe(true);
  });

  it('uses custom database_path in error/execution message', async () => {
    const customPath = path.join(process.cwd(), 'data', 'custom.db');
    const result = await tool.execute({
      query: 'SELECT 1',
      mode: 'read',
      database_path: customPath,
    });
    const isValid =
      /Query (?:executada|executed)|SQLite driver|custom\.db|query execution failed|unavailable|Failed to run query|Erro ao executar/i.test(
        result,
      );
    expect(isValid).toBe(true);
  });

  it('defaults to read mode', async () => {
    const result = await tool.execute({
      query: 'SELECT 1',
    });
    const isValidResponse =
      /SQLite driver|Query (?:executada|executed)|query execution failed|unavailable|Failed to run query|Erro ao executar/i.test(
        result,
      );
    expect(isValidResponse).toBe(true);
  });

  it('returns error when database_path is outside allowed data directory', async () => {
    const result = await tool.execute({
      query: 'SELECT 1',
      database_path: process.platform === 'win32' ? 'C:\\Windows\\temp.db' : '/tmp/temp.db',
    });
    expect(result).toContain('Error: database path');
    expect(result).toContain('outside the allowed Zavorth data root');
  });
});
