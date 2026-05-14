export type FailureSemanticsSeverity = 'warning' | 'error';

export type FailureSemanticsInput = {
  source?: string | null;
  code?: string | null;
  message?: string | null;
  retryable?: boolean | null;
  compensatable?: boolean | null;
  requiresPreview?: boolean | null;
  requiresApproval?: boolean | null;
  rollbackStrategy?: string | null;
  externalSideEffect?: boolean | null;
  error?: unknown;
  metadata?: Record<string, unknown>;
};

export type FailureSemantics = {
  source: string;
  code: string;
  message: string;
  retryable: boolean;
  compensatable: boolean;
  requiresPreview: boolean;
  requiresApproval: boolean;
  rollbackStrategy: string | null;
  externalSideEffect: boolean;
  severity: FailureSemanticsSeverity;
  metadata: Record<string, unknown>;
};

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readErrorField(error: unknown, field: string): unknown {
  return normalizeRecord(error)[field];
}

function messageFromError(error: unknown): string | null {
  if (!error) {
    return null;
  }
  if (typeof error === 'string') {
    return normalizeText(error) || null;
  }
  const message = normalizeText(readErrorField(error, 'message'));
  return message || normalizeText(error) || null;
}

function codeFromError(error: unknown): string | null {
  const code = normalizeText(readErrorField(error, 'code'));
  if (code) {
    return code;
  }
  const name = normalizeText(readErrorField(error, 'name'));
  return name || null;
}

function inferRetryable(code: string, message: string): boolean {
  const haystack = `${code} ${message}`.toLowerCase();
  return [
    'timeout',
    'timedout',
    'econnreset',
    'econnrefused',
    'network',
    'temporar',
    'rate_limit',
    '429',
  ].some((token) => haystack.includes(token));
}

export class FailureSemanticsRegistry {
  public resolve(input: FailureSemanticsInput = {}): FailureSemantics {
    const errorMessage = messageFromError(input.error);
    const message = normalizeText(
      input.message,
      errorMessage || 'Executor falhou sem mensagem detalhada.',
    );
    const code = normalizeText(
      input.code,
      codeFromError(input.error) || 'executor_failure',
    );
    const retryable = input.retryable ?? inferRetryable(code, message);

    return {
      source: normalizeText(input.source, 'executor'),
      code,
      message,
      retryable,
      compensatable: input.compensatable === true,
      requiresPreview: input.requiresPreview === true,
      requiresApproval: input.requiresApproval === true,
      rollbackStrategy: normalizeText(input.rollbackStrategy) || null,
      externalSideEffect: input.externalSideEffect === true,
      severity: retryable ? 'warning' : 'error',
      metadata: {
        ...(input.metadata || {}),
        source: 'FailureSemanticsRegistry',
      },
    };
  }

  public fromError(error: unknown, input: Omit<FailureSemanticsInput, 'error'> = {}): FailureSemantics {
    return this.resolve({
      ...input,
      error,
    });
  }
}
