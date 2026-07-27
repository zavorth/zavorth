export interface SafeNormalizedError {
  code: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  recoverable: boolean;
  details?: Record<string, string | number | boolean>;
}

export class ErrorNormalizationService {
  private static instance: ErrorNormalizationService;

  public static getInstance(): ErrorNormalizationService {
    if (!ErrorNormalizationService.instance) {
      ErrorNormalizationService.instance = new ErrorNormalizationService();
    }
    return ErrorNormalizationService.instance;
  }

  public sanitizeText(value: string): string {
    if (!value) return '';
    let sanitized = value;

    // Redaction: Authorization / Bearer first so full credentials become opaque markers
    // before nested sk- token patterns rewrite the secret payload.
    sanitized = sanitized.replace(/Authorization:\s*Bearer\s+\S+/gi, '[REDACTED_AUTHORIZATION]');
    sanitized = sanitized.replace(/Authorization:\s*[A-Za-z0-9\-._~+/=]+/gi, '[REDACTED_AUTHORIZATION]');
    sanitized = sanitized.replace(/Bearer\s+\S+/gi, '[REDACTED_BEARER]');

    // Redaction: sk-* tokens (remaining bare secrets)
    sanitized = sanitized.replace(/sk-[A-Za-z0-9]{20,}/g, '[REDACTED_SECRET]');
    sanitized = sanitized.replace(/sk-[A-Za-z0-9\-]+/g, '[REDACTED_SECRET]');

    // Redaction: secretRef/...
    sanitized = sanitized.replace(/secret_[A-Za-z0-9_\-]+/g, '[REDACTED_SECRET_REF]');

    // Redaction: absolute local DB paths and filesystem paths containing DB or starting with drive letter
    // Match absolute paths like C:\foo\bar or /usr/local/var/
    sanitized = sanitized.replace(/[a-zA-Z]:\\[\\\w\.\-\s_]+/g, '[REDACTED_PATH]');
    sanitized = sanitized.replace(/\/[a-zA-Z0-9_\-\.]+\/[a-zA-Z0-9_\-\.\/]+/g, '[REDACTED_PATH]');
    sanitized = sanitized.replace(/[\w\.\-\s_\/]+\.db/gi, '[REDACTED_PATH]');

    // Redaction: long base64-ish or hex blobs (longer than 80 chars of uninterrupted alphanumeric chars)
    sanitized = sanitized.replace(/[A-Za-z0-9+/]{80,}=*/g, '[REDACTED_BLOB]');

    return sanitized;
  }

  public normalize(error: unknown, fallbackCode = 'unknown_error'): SafeNormalizedError {
    let rawMessage = '';
    let details: Record<string, string | number | boolean> | undefined = undefined;

    if (error instanceof Error) {
      rawMessage = error.message;
    } else if (typeof error === 'string') {
      rawMessage = error;
    } else if (error && typeof error === 'object') {
      const errObj = error as Record<string, any>;
      rawMessage = String(errObj.message || errObj.code || JSON.stringify(error));
      if (errObj.details) {
        details = {};
        for (const [key, val] of Object.entries(errObj.details)) {
          if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
            details[key] = typeof val === 'string' ? this.sanitizeText(val) : val;
          }
        }
      }
    } else {
      rawMessage = 'Unknown error occurrence';
    }

    const message = this.sanitizeText(rawMessage);
    const lowercaseMsg = message.toLowerCase();

    let code = fallbackCode;
    let severity: 'info' | 'warning' | 'error' = 'error';
    let recoverable = false;

    // Mapping rules based on the error message keywords
    // Match true path-traversal tokens only — do not treat ellipsis ("...") as traversal.
    if (
      lowercaseMsg.includes('path traversal')
      || lowercaseMsg.includes('../')
      || lowercaseMsg.includes('..\\')
      || /(^|[^\.])\.\.([^\.]|$)/.test(lowercaseMsg)
    ) {
      code = 'path_traversal';
      severity = 'error';
      recoverable = false;
    } else if (lowercaseMsg.includes('absolute path')) {
      code = 'absolute_path_blocked';
      severity = 'error';
      recoverable = false;
    } else if (lowercaseMsg.includes('rootpath') || lowercaseMsg.includes('root path rejected')) {
      code = 'root_path_rejected';
      severity = 'error';
      recoverable = false;
    } else if (lowercaseMsg.includes('cross-workspace')) {
      code = 'cross_workspace_access';
      severity = 'error';
      recoverable = false;
    } else if (lowercaseMsg.includes('workspace not trusted')) {
      code = 'workspace_not_trusted';
      severity = 'warning';
      recoverable = true;
    } else if (lowercaseMsg.includes('workspace access denied')) {
      code = 'workspace_access_denied';
      severity = 'error';
      recoverable = false;
    } else if (lowercaseMsg.includes('hpm_disabled') || lowercaseMsg.includes('host power mode is disabled') || lowercaseMsg.includes('host power mode disabled')) {
      code = 'hpm_disabled';
      severity = 'warning';
      recoverable = true;
    } else if (lowercaseMsg.includes('pty_disabled') || lowercaseMsg.includes('pty is disabled') || lowercaseMsg.includes('pty disabled')) {
      code = 'pty_disabled';
      severity = 'warning';
      recoverable = true;
    } else if (lowercaseMsg.includes('developer mode') || lowercaseMsg.includes('developer_mode_disabled')) {
      code = 'developer_mode_disabled';
      severity = 'warning';
      recoverable = true;
    } else if (lowercaseMsg.includes('missing api key') || lowercaseMsg.includes('missing_key') || lowercaseMsg.includes('lacks key')) {
      code = 'missing_key';
      severity = 'warning';
      recoverable = true;
    } else if (
      lowercaseMsg.includes('invalid key')
      || lowercaseMsg.includes('invalid api key')
      || lowercaseMsg.includes('invalid_key')
      || lowercaseMsg.includes('unauthorized')
      || lowercaseMsg.includes('forbidden')
    ) {
      code = 'invalid_key';
      severity = 'error';
      recoverable = true;
    } else if (
      lowercaseMsg.includes('timeout')
      || lowercaseMsg.includes('timed out')
      || lowercaseMsg.includes('time out')
      || lowercaseMsg.includes('exceeded timeout')
      || lowercaseMsg.includes('etimedout')
      || lowercaseMsg.includes('gateway timeout')
      || lowercaseMsg.includes('gateway_timeout')
    ) {
      code = 'timeout';
      severity = 'warning';
      recoverable = true;
    } else if (
      lowercaseMsg.includes('network')
      || lowercaseMsg.includes('fetch failed')
      || lowercaseMsg.includes('econnrefused')
      || lowercaseMsg.includes('enotfound')
      || lowercaseMsg.includes('econnreset')
      || lowercaseMsg.includes('socket hang up')
      || lowercaseMsg.includes('dns')
      || lowercaseMsg.includes('bad gateway')
      || lowercaseMsg.includes('bad_gateway')
      || lowercaseMsg.includes('service unavailable')
      || lowercaseMsg.includes('service_unavailable')
    ) {
      code = 'network_error';
      severity = 'error';
      recoverable = true;
    } else if (lowercaseMsg.includes('rate limit') || lowercaseMsg.includes('429') || lowercaseMsg.includes('rate_limited')) {
      code = 'rate_limited';
      severity = 'warning';
      recoverable = true;
    } else if (lowercaseMsg.includes('quota') || lowercaseMsg.includes('insufficient_quota') || lowercaseMsg.includes('insufficient quota')) {
      code = 'quota_exceeded';
      severity = 'error';
      recoverable = false;
    } else if (lowercaseMsg.includes('provider disabled') || lowercaseMsg.includes('provider_disabled')) {
      code = 'provider_disabled';
      severity = 'warning';
      recoverable = true;
    } else if (lowercaseMsg.includes('provider not found') || lowercaseMsg.includes('provider_not_found')) {
      code = 'provider_not_found';
      severity = 'error';
      recoverable = true;
    } else if (lowercaseMsg.includes('model not found') || lowercaseMsg.includes('model_not_found')) {
      code = 'model_not_found';
      severity = 'error';
      recoverable = true;
    } else if (
      lowercaseMsg.includes('capability_not_supported')
      || lowercaseMsg.includes('capability not supported')
      || (lowercaseMsg.includes('capability') && lowercaseMsg.includes('not supported'))
      || lowercaseMsg.includes('not supported')
    ) {
      code = 'capability_not_supported';
      severity = 'error';
      recoverable = true;
    } else if (lowercaseMsg.includes('approval required') || lowercaseMsg.includes('approval_required')) {
      code = 'approval_required';
      severity = 'info';
      recoverable = true;
    } else if (lowercaseMsg.includes('critical confirmation') || lowercaseMsg.includes('critical_confirmation_required')) {
      code = 'critical_confirmation_required';
      severity = 'warning';
      recoverable = true;
    } else if (
      lowercaseMsg.includes('provider error')
      || lowercaseMsg.includes('provider_error')
      || lowercaseMsg.includes('invalid response from provider')
      || lowercaseMsg.includes('invalid_response')
    ) {
      code = 'provider_error';
      severity = 'error';
      recoverable = true;
    }

    return {
      code,
      message,
      severity,
      recoverable,
      details
    };
  }
}
