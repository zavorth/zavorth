import type { SecurityAuditLogger } from '../services/SecurityAuditLogger.js';

export interface ServiceToken<T> {
  readonly id: symbol;
  readonly description: string;
}

export const ServiceTokens = {
  SecurityAuditLogger: {
    id: Symbol.for('zavorth.SecurityAuditLogger'),
    description: 'SecurityAuditLogger',
  } as ServiceToken<SecurityAuditLogger>,
} as const;
