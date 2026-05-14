import { checkBodySize } from '../../../../src/ai-gateway/shared/middleware/bodySizeGuard.js';
import { normalizeCorsOrigin } from '../../../../src/ai-gateway/shared/utils/cors.js';

describe('shared CORS utilities', () => {
  it('accepts only concrete http(s) origins and rejects wildcards/placeholders', () => {
    expect(normalizeCorsOrigin('https://zavorth.example.com/path?q=1')).toBe('https://zavorth.example.com');
    expect(normalizeCorsOrigin('http://127.0.0.1:33333/control')).toBe('http://127.0.0.1:33333');
    expect(normalizeCorsOrigin('*')).toBe('');
    expect(normalizeCorsOrigin('file:///tmp/index.html')).toBe('');
    expect(normalizeCorsOrigin('not a url')).toBe('');
  });

  it('does not emit an empty Access-Control-Allow-Origin on body-size rejections', async () => {
    const response = checkBodySize(
      new Request('http://localhost/api/test', {
        method: 'POST',
        headers: {
          'content-length': '1024',
        },
      }),
      1,
    );

    expect(response?.status).toBe(413);
    expect(response?.headers.get('access-control-allow-origin')).toBeNull();
    expect(response?.headers.get('access-control-allow-methods')).toBe('GET, POST, PUT, DELETE, OPTIONS');
  });
});
