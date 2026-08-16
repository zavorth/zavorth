import { ZavorthStealthBrowseTool } from '../../src/tools/ZavorthStealthBrowseTool.js';

describe('ZavorthStealthBrowseTool', () => {
  it('should generate anti-detection fingerprint headers', async () => {
    const rawResult = await ZavorthStealthBrowseTool.execute({
      action: 'generate_fingerprint',
      spoofPlatform: 'windows',
    });

    const result = JSON.parse(rawResult);
    expect(result.status).toBe('success');
    expect(result.action).toBe('generate_fingerprint');
    expect(result.platform).toBe('windows');
    expect(result.headers['User-Agent']).toContain('Windows');
  });

  it('should extract markdown from raw HTML', async () => {
    const rawHtml = '<html><head><title>API Reference</title></head><body><h1>Endpoint</h1><p>Returns status 200 OK.</p></body></html>';
    const rawResult = await ZavorthStealthBrowseTool.execute({
      action: 'extract_markdown',
      rawHtml,
    });

    const result = JSON.parse(rawResult);
    expect(result.status).toBe('success');
    expect(result.title).toBe('API Reference');
    expect(result.markdown).toContain('# Endpoint');
    expect(result.markdown).toContain('Returns status 200 OK.');
  });
});
