export interface PublicErrorDetail {
  code: string;
  message: string;
  target?: string; // e.g., field name in validation error
}

export interface PublicErrorResponse {
  error: {
    code: string; // e.g., 'INVALID_REQUEST', 'NOT_FOUND', 'UNAUTHORIZED', 'INTERNAL_ERROR'
    message: string;
    details?: PublicErrorDetail[];
    traceId?: string; // useful for log correlation
  };
}

export type ApiResponse<T> = T | PublicErrorResponse;

// Canonical Base Classes for Gateway to wrap runtime errors into Public ones
export class ZavorthPublicError extends Error {
  public statusCode: number;
  public code: string;
  public details?: PublicErrorDetail[];

  constructor(statusCode: number, code: string, message: string, details?: PublicErrorDetail[]) {
    super(message);
    this.name = 'ZavorthPublicError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class NotFoundError extends ZavorthPublicError {
  constructor(message: string = 'Resource not found') {
    super(404, 'NOT_FOUND', message);
  }
}

export class InvalidRequestError extends ZavorthPublicError {
  constructor(message: string = 'Invalid request', details?: PublicErrorDetail[]) {
    super(400, 'INVALID_REQUEST', message, details);
  }
}

export class UnauthorizedError extends ZavorthPublicError {
  constructor(message: string = 'Unauthorized') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends ZavorthPublicError {
  constructor(message: string = 'Forbidden') {
    super(403, 'FORBIDDEN', message);
  }
}

export class InternalServerError extends ZavorthPublicError {
  constructor(message: string = 'Internal server error', details?: PublicErrorDetail[]) {
    super(500, 'INTERNAL_ERROR', message, details);
  }
}
