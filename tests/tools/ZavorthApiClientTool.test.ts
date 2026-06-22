import { ZavorthApiClientTool } from '../../src/tools/ZavorthApiClientTool';

describe('ZavorthApiClientTool', () => {
  const tool = new ZavorthApiClientTool();

  it('exposes correct name', () => {
    expect(tool.name).toBe('zavorth_api_client');
  });

  it('returns error when url is missing', async () => {
    const result = await tool.execute({});
    expect(result).toContain('Erro');
    expect(result).toContain('url');
  });

  it('returns error for invalid URL', async () => {
    const result = await tool.execute({ url: 'not-a-url' });
    expect(result).toContain('Erro');
    expect(result).toContain('invalida');
  });

  it('returns error for non-http protocol', async () => {
    const result = await tool.execute({ url: 'ftp://example.com' });
    expect(result).toContain('Erro');
    expect(result).toContain('protocolo');
  });

  it('returns error for blocked domain', async () => {
    const result = await tool.execute({ url: 'https://malware.com/test' });
    expect(result).toContain('Erro');
    expect(result).toContain('bloqueio');
  });

  it('returns error for invalid method', async () => {
    const result = await tool.execute({ url: 'https://example.com', method: 'PATCHY' });
    expect(result).toContain('Erro');
    expect(result).toContain('invalido');
  });

  it('returns error for excessive timeout', async () => {
    const result = await tool.execute({ url: 'https://example.com', timeout_ms: 999999 });
    expect(result).toContain('Erro');
    expect(result).toContain('timeout');
  });

  it('validates trusted domains', async () => {
    const result = await tool.execute({ url: 'https://api.github.com' });
    expect(result).toContain('HTTP');
  });

  it('handles GET request to httpbin', async () => {
    const result = await tool.execute({
      url: 'https://httpbin.org/get',
      timeout_ms: 10000,
    });
    expect(result).toContain('HTTP');
  }, 15000);

  it('handles query parameters', async () => {
    const result = await tool.execute({
      url: 'https://httpbin.org/get',
      query_params: JSON.stringify({ key: 'value', foo: 'bar' }),
      timeout_ms: 10000,
    });
    expect(result).toContain('HTTP');
  }, 15000);

  it('handles POST with JSON body', async () => {
    const result = await tool.execute({
      method: 'POST',
      url: 'https://httpbin.org/post',
      body: JSON.stringify({ test: true }),
      body_type: 'json',
      timeout_ms: 10000,
    });
    expect(result).toContain('HTTP');
  }, 15000);

  it('handles bearer auth', async () => {
    const result = await tool.execute({
      url: 'https://httpbin.org/bearer',
      auth_type: 'bearer',
      auth_token: 'test_token',
      timeout_ms: 10000,
    });
    expect(result).toContain('HTTP');
  }, 15000);

  it('handles HEAD request', async () => {
    const result = await tool.execute({
      method: 'HEAD',
      url: 'https://httpbin.org',
      timeout_ms: 10000,
    });
    expect(result).toContain('HTTP');
  }, 15000);
});
