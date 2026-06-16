import { ServiceRegistry } from './ServiceRegistry.js';
import { ServiceTokens } from './ServiceTokens.js';
import { SecurityAuditLogger } from '../services/SecurityAuditLogger.js';

export class ServiceCompositionRoot {
  private static bootstrapped = false;

  private constructor() {
    // Prevent instantiation
  }

  /**
   * Initializes and registers the stable core services of Zavorth.
   * This method is idempotent; subsequent calls will be safe and do nothing if already bootstrapped.
   */
  public static bootstrap(): void {
    if (this.bootstrapped) {
      return;
    }

    // Initialize the SecurityAuditLogger
    // Note: SecurityAuditLogger is stable, non-secret-bearing, and low-risk.
    if (!ServiceRegistry.has(ServiceTokens.SecurityAuditLogger)) {
      const securityAuditLogger = new SecurityAuditLogger();
      ServiceRegistry.register(ServiceTokens.SecurityAuditLogger, securityAuditLogger);
    }

    this.bootstrapped = true;
  }

  /**
   * Resets the bootstrapped state flag for tests.
   */
  public static resetForTests(): void {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('resetForTests is only allowed in test environment');
    }
    this.bootstrapped = false;
  }
}
