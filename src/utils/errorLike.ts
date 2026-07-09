/**
 * Normalize unknown thrown values for catch blocks across the runtime.
 */

export type ErrorLike = {
  message?: string;
  stack?: string;
  name?: string;
  code?: string | number;
  [key: string]: unknown;
};

export function asErrorLike(error: unknown): ErrorLike {
  if (error && typeof error === 'object') {
    return error as ErrorLike;
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
