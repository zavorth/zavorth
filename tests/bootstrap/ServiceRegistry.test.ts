import { ServiceRegistry } from '../../src/bootstrap/ServiceRegistry.js';
import { ServiceTokens } from '../../src/bootstrap/ServiceTokens.js';
import { SecurityAuditLogger } from '../../src/services/SecurityAuditLogger.js';

describe('ServiceRegistry Tests', () => {
  beforeEach(() => {
    ServiceRegistry.resetForTests();
  });

  afterEach(() => {
    ServiceRegistry.resetForTests();
  });

  it('can register and resolve a known service token', () => {
    const logger = new SecurityAuditLogger();
    expect(ServiceRegistry.has(ServiceTokens.SecurityAuditLogger)).toBe(false);

    ServiceRegistry.register(ServiceTokens.SecurityAuditLogger, logger);
    expect(ServiceRegistry.has(ServiceTokens.SecurityAuditLogger)).toBe(true);

    const resolved = ServiceRegistry.get(ServiceTokens.SecurityAuditLogger);
    expect(resolved).toBe(logger);
  });

  it('throws on duplicate registration', () => {
    const logger1 = new SecurityAuditLogger();
    const logger2 = new SecurityAuditLogger();

    ServiceRegistry.register(ServiceTokens.SecurityAuditLogger, logger1);

    expect(() => {
      ServiceRegistry.register(ServiceTokens.SecurityAuditLogger, logger2);
    }).toThrow('Duplicate service registration');
  });

  it('throws on missing service resolution', () => {
    expect(() => {
      ServiceRegistry.get(ServiceTokens.SecurityAuditLogger);
    }).toThrow('Service not found');
  });

  it('rejects fake/unknown/forged tokens', () => {
    const forgedToken = {
      id: Symbol.for('zavorth.FakeService'),
      description: 'FakeService',
    } as any;

    expect(() => {
      ServiceRegistry.register(forgedToken, {});
    }).toThrow('Rejected: Attempted to use an unknown or forged service token.');

    expect(() => {
      ServiceRegistry.get(forgedToken);
    }).toThrow('Rejected: Attempted to use an unknown or forged service token.');

    expect(ServiceRegistry.has(forgedToken)).toBe(false);
  });

  it('protects resetForTests from execution outside test environment', () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      expect(() => {
        ServiceRegistry.resetForTests();
      }).toThrow('resetForTests is only allowed in test environment');
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it('resetForTests successfully clears all registered services in test environment', () => {
    const logger = new SecurityAuditLogger();
    ServiceRegistry.register(ServiceTokens.SecurityAuditLogger, logger);
    expect(ServiceRegistry.has(ServiceTokens.SecurityAuditLogger)).toBe(true);

    ServiceRegistry.resetForTests();
    expect(ServiceRegistry.has(ServiceTokens.SecurityAuditLogger)).toBe(false);
  });

  it('get() does not instantiate services implicitly', () => {
    expect(() => {
      ServiceRegistry.get(ServiceTokens.SecurityAuditLogger);
    }).toThrow('Service not found');
  });
});
