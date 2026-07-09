/**
 * Normalize unknown thrown values for catch blocks across the runtime.
 */

export type ErrorLike = {
  message: string;
  stack?: string;
  name?: string;
  code?: string | number;
  [key: string]: unknown;
};

function readMessage(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) return value;
  return fallback;
}

export function asErrorLike(error: unknown): ErrorLike {
  if (error instanceof Error) {
    return {
      // preserve enumerable extras without losing message
      ...(error as unknown as Record<string, unknown>),
      message: readMessage(error.message, error.name || 'Error'),
      stack: typeof error.stack === 'string' ? error.stack : undefined,
      name: error.name,
    };
  }
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const message = readMessage(record.message, 'Unexpected error');
    return {
      ...record,
      message,
      stack: typeof record.stack === 'string' ? record.stack : undefined,
      name: typeof record.name === 'string' ? record.name : undefined,
      code:
        typeof record.code === 'string' || typeof record.code === 'number'
          ? record.code
          : undefined,
    };
  }
  if (typeof error === 'string' && error.trim()) {
    return { message: error };
  }
  if (typeof error === 'number' || typeof error === 'boolean') {
    return { message: String(error) };
  }
  return { message: 'Unexpected error' };
}

export function errorMessage(error: unknown, fallback = 'Unexpected error'): string {
  const value = asErrorLike(error).message;
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  return fallback;
}
