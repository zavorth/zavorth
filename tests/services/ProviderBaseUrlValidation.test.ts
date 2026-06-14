import { ProviderConfigService } from '../../src/services/ProviderConfigService';

describe('Base URL Validation (Phase 21H)', () => {
  let service: ProviderConfigService;

  beforeAll(() => {
    service = ProviderConfigService.getInstance();
  });

  it('rejects file:// and ftp:// protocols', () => {
    expect(() => service.validateBaseUrl('file:///etc/passwd', false)).toThrow('file:// protocol is not allowed');
    // Note: Our code only allows http/https so ftp will be caught by the remote/local checks
    expect(() => service.validateBaseUrl('ftp://example.com', false)).toThrow('Remote providers must use https://');
  });

  it('blocks SSRF on remote providers by rejecting private IPs and localhost', () => {
    expect(() => service.validateBaseUrl('https://localhost:8080', false)).toThrow('Private IPs/localhost are not allowed for remote providers');
    expect(() => service.validateBaseUrl('https://127.0.0.1:8080', false)).toThrow('Private IPs/localhost are not allowed for remote providers');
    expect(() => service.validateBaseUrl('https://192.168.1.1', false)).toThrow('Private IPs/localhost are not allowed for remote providers');
    expect(() => service.validateBaseUrl('https://10.0.0.5', false)).toThrow('Private IPs/localhost are not allowed for remote providers');
  });

  it('allows localhost for local providers like Ollama', () => {
    const validLocal1 = service.validateBaseUrl('http://localhost:11434', true);
    expect(validLocal1).toBe('http://localhost:11434');
    
    const validLocal2 = service.validateBaseUrl('http://127.0.0.1:11434', true);
    expect(validLocal2).toBe('http://127.0.0.1:11434');
  });

  it('rejects URLs containing credentials or sensitive query params', () => {
    expect(() => service.validateBaseUrl('https://user:pass@example.com', false)).toThrow('URL containing username/password is not allowed');
    expect(() => service.validateBaseUrl('https://example.com?token=123', false)).toThrow('Query string containing tokens is not allowed');
    expect(() => service.validateBaseUrl('https://example.com?KEY=abc', false)).toThrow('Query string containing tokens is not allowed');
  });

  it('allows valid remote provider URLs', () => {
    const valid = service.validateBaseUrl('https://api.openai.com/v1/', false);
    // Trailing slash should be stripped
    expect(valid).toBe('https://api.openai.com/v1');
  });
});
