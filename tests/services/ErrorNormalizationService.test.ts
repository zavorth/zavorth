import { ErrorNormalizationService } from '../../src/services/ErrorNormalizationService';

describe('ErrorNormalizationService Tests', () => {
  let service: ErrorNormalizationService;

  beforeEach(() => {
    service = ErrorNormalizationService.getInstance();
  });

  it('normalizes missing_key errors', () => {
    const err = new Error('lacks key for provider');
    const norm = service.normalize(err);
    expect(norm.code).toBe('missing_key');
    expect(norm.severity).toBe('warning');
    expect(norm.recoverable).toBe(true);
  });

  it('normalizes invalid_key errors', () => {
    const err = new Error('invalid api key or permission problem');
    const norm = service.normalize(err);
    expect(norm.code).toBe('invalid_key');
    expect(norm.severity).toBe('error');
    expect(norm.recoverable).toBe(true);
  });

  it('normalizes timeout errors', () => {
    const err = new Error('exceeded timeout limit');
    const norm = service.normalize(err);
    expect(norm.code).toBe('timeout');
    expect(norm.severity).toBe('warning');
    expect(norm.recoverable).toBe(true);
  });

  it('normalizes network_error errors', () => {
    const err = new Error('fetch failed due to DNS error');
    const norm = service.normalize(err);
    expect(norm.code).toBe('network_error');
    expect(norm.severity).toBe('error');
    expect(norm.recoverable).toBe(true);
  });

  it('normalizes workspace_not_trusted errors', () => {
    const err = new Error('workspace not trusted yet');
    const norm = service.normalize(err);
    expect(norm.code).toBe('workspace_not_trusted');
    expect(norm.severity).toBe('warning');
    expect(norm.recoverable).toBe(true);
  });

  it('normalizes path_traversal errors', () => {
    const err = new Error('blocked path traversal attempt with ..');
    const norm = service.normalize(err);
    expect(norm.code).toBe('path_traversal');
    expect(norm.severity).toBe('error');
    expect(norm.recoverable).toBe(false);
  });

  it('normalizes root_path_rejected errors', () => {
    const err = new Error('root path rejected by safety policies');
    const norm = service.normalize(err);
    expect(norm.code).toBe('root_path_rejected');
    expect(norm.severity).toBe('error');
    expect(norm.recoverable).toBe(false);
  });

  it('removes sk-* token and redacts it', () => {
    const rawText = 'API key sk-abc123XYZ7890123456789 is invalid';
    const sanitized = service.sanitizeText(rawText);
    expect(sanitized).toBe('API key [REDACTED_SECRET] is invalid');
  });

  it('removes Authorization: Bearer token and redacts it', () => {
    const rawText = 'Authorization: Bearer sk-abc123XYZ7890123456789 in header';
    const sanitized = service.sanitizeText(rawText);
    expect(sanitized).toContain('[REDACTED_AUTHORIZATION]');
    expect(sanitized).not.toContain('Bearer');
    expect(sanitized).not.toContain('sk-abc');
  });

  it('removes secretRef references', () => {
    const rawText = 'reference to secret_my-awesome-key-ref failed';
    const sanitized = service.sanitizeText(rawText);
    expect(sanitized).toBe('reference to [REDACTED_SECRET_REF] failed');
  });

  it('removes absolute local DB paths', () => {
    const rawTextWindows = 'Failed to load SQLite DB at C:\\Users\\user\\AppData\\Local\\zavorth.db';
    const sanitizedWindows = service.sanitizeText(rawTextWindows);
    expect(sanitizedWindows).toBe('Failed to load SQLite DB at [REDACTED_PATH]');

    const rawTextUnix = 'Failed to load SQLite DB at /var/lib/zavorth/zavorth.db';
    const sanitizedUnix = service.sanitizeText(rawTextUnix);
    expect(sanitizedUnix).toBe('Failed to load SQLite DB at [REDACTED_PATH]');
  });

  it('removes long base64-ish blobs', () => {
    const longBlob = 'a'.repeat(90);
    const rawText = `Payload content: ${longBlob}`;
    const sanitized = service.sanitizeText(rawText);
    expect(sanitized).toBe('Payload content: [REDACTED_BLOB]');
  });

  it('proves that the marker 21K-B does not leak and is redacted', () => {
    const marker = 'sk-zavorth-internal-beta-hardening-DO-NOT-LEAK-21K-B';
    const rawText = `Failed with key ${marker}`;
    const sanitized = service.sanitizeText(rawText);
    expect(sanitized).not.toContain(marker);
    expect(sanitized).not.toContain('DO-NOT-LEAK-21K-B');
    expect(sanitized).toBe('Failed with key [REDACTED_SECRET]');
  });
});
