export type ErrorLike = Error & { code?: string; status?: number };

/** Normalize unknown thrown values for logging and UI messages. */
export function asErrorLike(error: unknown): ErrorLike {
  if (error instanceof Error) {
    return error as ErrorLike;
  }
  return new Error(errorMessage(error)) as ErrorLike;
}

export function errorMessage(error: unknown, fallback = 'Unexpected error'): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof error === 'string' && error.trim()) {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }
  return fallback;
}
