import { ServiceTokens } from './ServiceTokens.js';
import type { ServiceToken } from './ServiceTokens.js';export class ServiceRegistry {
  private static readonly services = new Map<symbol, unknown>();

  private constructor() {
    // Prevent instantiation
  }

  /**
   * Validates if the given token object is a known token registered in ServiceTokens.
   */
  private static validateToken<T>(token: ServiceToken<T>): void {
    if (!token || !token.id || !token.description) {
      throw new Error('Rejected: Invalid or empty service token.');
    }
    const isKnown = Object.values(ServiceTokens).some(
      (t) => t === token || (t.id === token.id && t.description === token.description),
    );
    if (!isKnown) {
      throw new Error('Rejected: Attempted to use an unknown or forged service token.');
    }
  }

  public static register<T>(token: ServiceToken<T>, instance: T): void {
    this.validateToken(token);
    if (instance === undefined || instance === null) {
      throw new Error(`Cannot register null or undefined instance for service "${token.description}".`);
    }
    if (this.services.has(token.id)) {
      throw new Error(`Duplicate service registration: Service "${token.description}" is already registered.`);
    }
    this.services.set(token.id, instance);
  }

  public static get<T>(token: ServiceToken<T>): T {
    this.validateToken(token);
    const service = this.services.get(token.id);
    if (service === undefined) {
      throw new Error(`Service not found: "${token.description}" has not been registered in the container.`);
    }
    return service as T;
  }

  public static has<T>(token: ServiceToken<T>): boolean {
    if (!token || !token.id) {
      return false;
    }
    try {
      this.validateToken(token);
      return this.services.has(token.id);
    } catch (error: unknown) {return false;
    }
  }

  /**
   * Clears the service registry.
   * This method is intended for test isolation only and throws if called outside of test environments.
   */
  public static resetForTests(): void {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('resetForTests is only allowed in test environment');
    }
    this.services.clear();
  }
}
