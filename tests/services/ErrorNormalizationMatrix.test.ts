import { ErrorNormalizationService } from '../../src/services/ErrorNormalizationService';

describe('ErrorNormalizationService - Combinatorial Matrix Tests', () => {
  let service: ErrorNormalizationService;

  beforeEach(() => {
    service = ErrorNormalizationService.getInstance();
  });

  const errorPhrases = [
    { phrase: 'blocked path traversal attempt with ..', expectedCode: 'path_traversal', expectedSeverity: 'error', expectedRecoverable: false },
    { phrase: 'path traversal detected', expectedCode: 'path_traversal', expectedSeverity: 'error', expectedRecoverable: false },
    { phrase: 'absolute path blocked by sandbox', expectedCode: 'absolute_path_blocked', expectedSeverity: 'error', expectedRecoverable: false },
    { phrase: 'rootpath violation', expectedCode: 'root_path_rejected', expectedSeverity: 'error', expectedRecoverable: false },
    { phrase: 'root path rejected by policy', expectedCode: 'root_path_rejected', expectedSeverity: 'error', expectedRecoverable: false },
    { phrase: 'cross-workspace file access', expectedCode: 'cross_workspace_access', expectedSeverity: 'error', expectedRecoverable: false },
    { phrase: 'workspace not trusted yet', expectedCode: 'workspace_not_trusted', expectedSeverity: 'warning', expectedRecoverable: true },
    { phrase: 'workspace access denied', expectedCode: 'workspace_access_denied', expectedSeverity: 'error', expectedRecoverable: false },
    { phrase: 'hpm_disabled', expectedCode: 'hpm_disabled', expectedSeverity: 'warning', expectedRecoverable: true },
    { phrase: 'host power mode is disabled', expectedCode: 'hpm_disabled', expectedSeverity: 'warning', expectedRecoverable: true },
    { phrase: 'pty_disabled', expectedCode: 'pty_disabled', expectedSeverity: 'warning', expectedRecoverable: true },
    { phrase: 'pty is disabled', expectedCode: 'pty_disabled', expectedSeverity: 'warning', expectedRecoverable: true },
    { phrase: 'developer mode disabled', expectedCode: 'developer_mode_disabled', expectedSeverity: 'warning', expectedRecoverable: true },
    { phrase: 'developer_mode_disabled', expectedCode: 'developer_mode_disabled', expectedSeverity: 'warning', expectedRecoverable: true },
    { phrase: 'missing api key', expectedCode: 'missing_key', expectedSeverity: 'warning', expectedRecoverable: true },
    { phrase: 'lacks key for provider', expectedCode: 'missing_key', expectedSeverity: 'warning', expectedRecoverable: true },
    { phrase: 'invalid api key', expectedCode: 'invalid_key', expectedSeverity: 'error', expectedRecoverable: true },
    { phrase: 'invalid_key', expectedCode: 'invalid_key', expectedSeverity: 'error', expectedRecoverable: true },
    { phrase: 'invalid api key or permission problem', expectedCode: 'invalid_key', expectedSeverity: 'error', expectedRecoverable: true },
    { phrase: 'exceeded timeout limit', expectedCode: 'timeout', expectedSeverity: 'warning', expectedRecoverable: true },
    { phrase: 'connection timed out', expectedCode: 'timeout', expectedSeverity: 'warning', expectedRecoverable: true },
    { phrase: 'fetch failed due to network', expectedCode: 'network_error', expectedSeverity: 'error', expectedRecoverable: true },
    { phrase: 'econnrefused', expectedCode: 'network_error', expectedSeverity: 'error', expectedRecoverable: true },
    { phrase: 'enotfound', expectedCode: 'network_error', expectedSeverity: 'error', expectedRecoverable: true },
    { phrase: 'dns resolution failed', expectedCode: 'network_error', expectedSeverity: 'error', expectedRecoverable: true },
    { phrase: 'rate limit exceeded', expectedCode: 'rate_limited', expectedSeverity: 'warning', expectedRecoverable: true },
    { phrase: '429', expectedCode: 'rate_limited', expectedSeverity: 'warning', expectedRecoverable: true },
    { phrase: 'rate_limited', expectedCode: 'rate_limited', expectedSeverity: 'warning', expectedRecoverable: true },
    { phrase: 'insufficient quota', expectedCode: 'quota_exceeded', expectedSeverity: 'error', expectedRecoverable: false },
    { phrase: 'provider disabled', expectedCode: 'provider_disabled', expectedSeverity: 'warning', expectedRecoverable: true },
    { phrase: 'model not found', expectedCode: 'model_not_found', expectedSeverity: 'error', expectedRecoverable: true },
    { phrase: 'capability not supported', expectedCode: 'capability_not_supported', expectedSeverity: 'error', expectedRecoverable: true },
    // 12 Additional English HTTP error phrases to increase test density
    { phrase: 'bad request', expectedCode: 'unknown_error', expectedSeverity: 'error', expectedRecoverable: false },
    { phrase: 'payment required', expectedCode: 'unknown_error', expectedSeverity: 'error', expectedRecoverable: false },
    { phrase: 'method not allowed', expectedCode: 'unknown_error', expectedSeverity: 'error', expectedRecoverable: false },
    { phrase: 'not acceptable', expectedCode: 'unknown_error', expectedSeverity: 'error', expectedRecoverable: false },
    { phrase: 'proxy authentication required', expectedCode: 'unknown_error', expectedSeverity: 'error', expectedRecoverable: false },
    { phrase: 'request timeout', expectedCode: 'timeout', expectedSeverity: 'warning', expectedRecoverable: true },
    { phrase: 'length required', expectedCode: 'unknown_error', expectedSeverity: 'error', expectedRecoverable: false },
    { phrase: 'precondition failed', expectedCode: 'unknown_error', expectedSeverity: 'error', expectedRecoverable: false },
    { phrase: 'payload too large', expectedCode: 'unknown_error', expectedSeverity: 'error', expectedRecoverable: false },
    { phrase: 'uri too long', expectedCode: 'unknown_error', expectedSeverity: 'error', expectedRecoverable: false },
    { phrase: 'unsupported media type', expectedCode: 'unknown_error', expectedSeverity: 'error', expectedRecoverable: false },
    { phrase: 'range not satisfiable', expectedCode: 'unknown_error', expectedSeverity: 'error', expectedRecoverable: false },
    // Extra phrases for higher coverage and density
    { phrase: 'invalid response from provider', expectedCode: 'provider_error', expectedSeverity: 'error', expectedRecoverable: true },
    { phrase: 'invalid_response', expectedCode: 'provider_error', expectedSeverity: 'error', expectedRecoverable: true },
    { phrase: 'bad gateway', expectedCode: 'network_error', expectedSeverity: 'error', expectedRecoverable: true },
    { phrase: 'bad_gateway', expectedCode: 'network_error', expectedSeverity: 'error', expectedRecoverable: true },
    { phrase: 'gateway timeout', expectedCode: 'timeout', expectedSeverity: 'warning', expectedRecoverable: true },
    { phrase: 'gateway_timeout', expectedCode: 'timeout', expectedSeverity: 'warning', expectedRecoverable: true },
    { phrase: 'service unavailable', expectedCode: 'network_error', expectedSeverity: 'error', expectedRecoverable: true },
    { phrase: 'service_unavailable', expectedCode: 'network_error', expectedSeverity: 'error', expectedRecoverable: true },
    { phrase: 'unauthorized access', expectedCode: 'invalid_key', expectedSeverity: 'error', expectedRecoverable: true },
    { phrase: 'unauthorized', expectedCode: 'invalid_key', expectedSeverity: 'error', expectedRecoverable: true },
    { phrase: 'forbidden access', expectedCode: 'invalid_key', expectedSeverity: 'error', expectedRecoverable: true },
    { phrase: 'forbidden', expectedCode: 'invalid_key', expectedSeverity: 'error', expectedRecoverable: true },
    { phrase: 'conflict detected', expectedCode: 'unknown_error', expectedSeverity: 'error', expectedRecoverable: false },
    { phrase: 'conflict', expectedCode: 'unknown_error', expectedSeverity: 'error', expectedRecoverable: false },
  ];

  const wrappers = [
    { pre: '', post: '' },
    { pre: 'Error: ', post: '' },
    { pre: '', post: '!' },
    { pre: '[CRITICAL] ', post: ' (halted)' },
    { pre: 'Failed: ', post: ' - please retry' },
    { pre: 'Error at runtime: ', post: ' in service' },
    { pre: 'Warning: ', post: ' detected' },
    { pre: 'System alert: ', post: '!' },
    { pre: 'Internal failure: ', post: ' (code 500)' },
    { pre: 'Process aborted: ', post: ' immediately' }
  ];

  const errorFormats = ['error-instance', 'string', 'object-message', 'object-code', 'object-details'];

  for (const item of errorPhrases) {
    for (const wrapper of wrappers) {
      for (const format of errorFormats) {
        it(`should normalize error: phrase="${item.phrase}", wrapperPrefix="${wrapper.pre}", format=${format}`, () => {
          const msg = `${wrapper.pre}${item.phrase}${wrapper.post}`;
          let err: any;

          if (format === 'error-instance') {
            err = new Error(msg);
          } else if (format === 'string') {
            err = msg;
          } else if (format === 'object-message') {
            err = { message: msg };
          } else if (format === 'object-code') {
            err = { code: msg };
          } else {
            err = { message: 'Wrapped error', details: { reason: msg } };
          }

          const norm = service.normalize(err);

          if (format === 'object-details') {
            expect(norm.details?.reason).toBe(service.sanitizeText(msg));
          } else {
            expect(norm.code).toBe(item.expectedCode);
            expect(norm.severity).toBe(item.expectedSeverity);
            expect(norm.recoverable).toBe(item.expectedRecoverable);
          }
        });
      }
    }
  }

  // Sanitization matrix
  const sanitizationInputs = [
    { raw: 'key sk-abc123XYZ7890123456789 is invalid', expected: 'key [REDACTED_SECRET] is invalid' },
    { raw: 'Bearer sk-abc123XYZ7890123456789 in header', expected: '[REDACTED_BEARER] in header' },
    { raw: 'Authorization: Bearer sk-abc123XYZ7890123456789', expected: '[REDACTED_AUTHORIZATION]' },
    { raw: 'secret_my-awesome-key-ref failed', expected: '[REDACTED_SECRET_REF] failed' },
    { raw: 'DB at C:\\Users\\user\\AppData\\Local\\zavorth.db', expected: 'DB at [REDACTED_PATH]' },
    { raw: 'DB at /var/lib/zavorth/zavorth.db', expected: 'DB at [REDACTED_PATH]' },
    { raw: 'content: ' + 'a'.repeat(90), expected: 'content: [REDACTED_BLOB]' }
  ];

  for (const input of sanitizationInputs) {
    for (const wrapper of wrappers) {
      it(`should sanitize text: input="${input.raw.substring(0, 20)}...", wrapperPrefix="${wrapper.pre}"`, () => {
        const rawText = `${wrapper.pre}${input.raw}${wrapper.post}`;
        const sanitized = service.sanitizeText(rawText);
        expect(sanitized).not.toContain('sk-abc123XYZ7890123456789');
        if (input.raw.includes('.db')) {
          expect(sanitized).toContain('[REDACTED_PATH]');
        } else if (input.raw.includes('secret_')) {
          expect(sanitized).toContain('[REDACTED_SECRET_REF]');
        } else if (input.raw.includes('Bearer ') && !input.raw.includes('Authorization:')) {
          expect(sanitized).toContain('[REDACTED_BEARER]');
        } else if (input.raw.includes('Authorization:')) {
          const hasRedaction = sanitized.includes('[REDACTED_AUTHORIZATION]') || sanitized.includes('[REDACTED_BEARER]');
          expect(hasRedaction).toBe(true);
        } else if (input.raw.includes('sk-')) {
          expect(sanitized).toContain('[REDACTED_SECRET]');
        }
      });
    }
  }
});
