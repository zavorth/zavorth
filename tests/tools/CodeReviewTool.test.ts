import { CodeReviewTool } from '../../src/tools/CodeReviewTool';

describe('CodeReviewTool', () => {
  let tool: CodeReviewTool;

  beforeEach(() => {
    tool = new CodeReviewTool();
  });

  it('exposes correct name and required parameters', () => {
    expect(tool.name).toBe('code_review');
    expect(tool.parameters.required).toEqual(['target']);
  });

  it('returns error when target is missing', async () => {
    const result = await tool.execute({});
    expect(result).toContain('Error');
    expect(result).toContain('target');
  });

  it('returns error for invalid focus', async () => {
    const result = await tool.execute({ target: 'code', focus: 'invalid' });
    expect(result).toContain('Error');
    expect(result).toContain('focus');
  });

  it('returns error for invalid severity threshold', async () => {
    const result = await tool.execute({ target: 'code', severity_threshold: 'invalid' });
    expect(result).toContain('Error');
    expect(result).toContain('severity');
  });

  it('detects eval() usage as critical security issue', async () => {
    const code = 'const result = eval(userInput);';
    const result = await tool.execute({ target: code, focus: 'security' });

    expect(result).toContain('eval()');
    expect(result).toContain('CRITICAL');
  });

  it('detects innerHTML as security issue', async () => {
    const code = 'element.innerHTML = userContent;';
    const result = await tool.execute({ target: code, focus: 'security' });

    expect(result).toContain('innerHTML');
    expect(result).toContain('ERROR');
  });

  it('detects hardcoded credentials', async () => {
    const code = 'const api_key = "sk-1234567890abcdef";';
    const result = await tool.execute({ target: code, focus: 'security' });

    expect(result).toContain('CRITICAL');
    expect(result).toContain('credential');
  });

  it('detects SELECT * as performance issue', async () => {
    const code = 'SELECT * FROM users WHERE active = 1;';
    const result = await tool.execute({ target: code, focus: 'performance' });

    expect(result).toContain('SELECT *');
    expect(result).toContain('WARNING');
  });

  it('detects console.log as style issue', async () => {
    const code = 'console.log("debug info");';
    const result = await tool.execute({ target: code, focus: 'style' });

    expect(result).toContain('console.log');
    expect(result).toContain('INFO');
  });

  it('detects long lines as style issue', async () => {
    const longLine = 'const x = ' + '"a"'.repeat(50) + ';';
    const result = await tool.execute({ target: longLine, focus: 'style' });

    expect(result).toContain('characters');
    expect(result).toContain('[INFO]');
  });

  it('returns no issues for clean code', async () => {
    const code = 'const x = 1;\nconst y = 2;\nconst z = x + y;';
    const result = await tool.execute({ target: code, focus: 'all' });

    expect(result).toMatch(/Review completed|Nenhum problema|No issues/i);
  });

  it('filters findings by severity threshold', async () => {
    const code = 'console.log("test");\neval("bad");';
    const result = await tool.execute({ target: code, focus: 'all', severity_threshold: 'error' });

    expect(result).toContain('eval()');
    expect(result).toContain('[CRITICAL]');
    expect(result).not.toContain('console.log() encontrado');
  });

  it('analyzes multiple issues in all mode', async () => {
    const code = ['const password = "secret123";', 'console.log("debug");', 'const result = eval(code);'].join('\n');

    const result = await tool.execute({ target: code, focus: 'all' });

    expect(result).toContain('Total de achados:');
    expect(result).toContain('CRITICAL');
  });

  it('handles code with no issues across all focus areas', async () => {
    const code = 'function add(a: number, b: number): number {\n  return a + b;\n}';
    const result = await tool.execute({ target: code, focus: 'all', severity_threshold: 'warning' });

    expect(result).toMatch(/Review completed|Nenhum problema|No issues/i);
  });
});
