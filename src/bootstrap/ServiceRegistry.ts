import { ServiceTokens } from './ServiceTokens.js';
import type { ServiceToken } from './ServiceTokens.js';
import { logger } from '../logger.js';

export type ServiceDisposer = () => void;

export class ServiceRegistry {
  private static readonly services = new Map<symbol, unknown>();
  private static readonly disposables = new Map<symbol, ServiceDisposer>();

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

  /**
   * Registers an instance together with a reversible teardown handle.
   * The returned disposer is idempotent: the first call removes the service and
   * runs the optional custom cleanup; subsequent calls do nothing.
   * Duplicate registration fails loud, matching register() semantics.
   */
  public static registerDisposable<T>(
    token: ServiceToken<T>,
    instance: T,
    onDispose?: () => void,
  ): ServiceDisposer {
    this.register(token, instance);
    let disposed = false;
    const disposer: ServiceDisposer = () => {
      if (disposed) {
        return;
      }
      disposed = true;
      this.services.delete(token.id);
      this.disposables.delete(token.id);
      if (onDispose) {
        try {
          onDispose();
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          logger.error(`Service "${token.description}" disposer failed during teardown: ${message}`);
        }
      }
    };
    this.disposables.set(token.id, disposer);
    return disposer;
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
   * Unwinds every disposable registration in reverse registration order so that
   * dependents tear down before their dependencies. A failing disposer is logged
   * with context and does not prevent the remaining services from unwinding.
   */
  public static disposeAll(): void {
    const ordered = Array.from(this.disposables.values()).reverse();
    for (const disposer of ordered) {
      disposer();
    }
  }

  /**
   * Clears the service registry.
   * This method is intended for test isolation only and throws if called outside of test environments.
   * Disposable registrations are unwound in reverse order before the remaining entries are dropped.
   */
  public static resetForTests(): void {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('resetForTests is only allowed in test environment');
    }
    this.disposeAll();
    this.services.clear();
    this.disposables.clear();
  }
}
