import { ServiceRegistry } from '../../src/bootstrap/ServiceRegistry.js';
import { ServiceTokens } from '../../src/bootstrap/ServiceTokens.js';
import { ServiceCompositionRoot } from '../../src/bootstrap/ServiceCompositionRoot.js';
import { SecurityAuditLogger } from '../../src/services/SecurityAuditLogger.js';

describe('ServiceCompositionRoot Tests', () => {
  beforeEach(() => {
    ServiceRegistry.resetForTests();
    ServiceCompositionRoot.resetForTests();
  });

  afterEach(() => {
    ServiceRegistry.resetForTests();
    ServiceCompositionRoot.resetForTests();
  });

  it('composition root registers only allowed stable services (SecurityAuditLogger)', () => {
    expect(ServiceRegistry.has(ServiceTokens.SecurityAuditLogger)).toBe(false);

    ServiceCompositionRoot.bootstrap();

    expect(ServiceRegistry.has(ServiceTokens.SecurityAuditLogger)).toBe(true);
    const resolved = ServiceRegistry.get(ServiceTokens.SecurityAuditLogger);
    expect(resolved).toBeInstanceOf(SecurityAuditLogger);
  });

  it('composition root bootstrap is idempotent and does not fail or duplicate on multiple calls', () => {
    ServiceCompositionRoot.bootstrap();
    const resolvedFirst = ServiceRegistry.get(ServiceTokens.SecurityAuditLogger);

    expect(() => {
      ServiceCompositionRoot.bootstrap();
    }).not.toThrow();

    const resolvedSecond = ServiceRegistry.get(ServiceTokens.SecurityAuditLogger);
    expect(resolvedSecond).toBe(resolvedFirst);
  });

  it('resetForTests resets composition root state allowing re-bootstrap', () => {
    ServiceCompositionRoot.bootstrap();
    expect(ServiceRegistry.has(ServiceTokens.SecurityAuditLogger)).toBe(true);

    ServiceRegistry.resetForTests();
    ServiceCompositionRoot.resetForTests();
    expect(ServiceRegistry.has(ServiceTokens.SecurityAuditLogger)).toBe(false);

    ServiceCompositionRoot.bootstrap();
    expect(ServiceRegistry.has(ServiceTokens.SecurityAuditLogger)).toBe(true);
  });

  it('protects resetForTests from execution outside test environment', () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      expect(() => {
        ServiceCompositionRoot.resetForTests();
      }).toThrow('resetForTests is only allowed in test environment');
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it('composition root does not register forbidden sensitive services or secrets', () => {
    ServiceCompositionRoot.bootstrap();

    const forbiddenTokens = [
      Symbol.for('zavorth.SecureStorageService'),
      Symbol.for('zavorth.Database'),
      Symbol.for('zavorth.AIGatewayProxyService'),
    ];

    for (const sym of forbiddenTokens) {
      const fakeToken = { id: sym, description: 'Fake' } as any;
      expect(ServiceRegistry.has(fakeToken)).toBe(false);
    }
  });

  it('composition root does not require cloud environment variables or provider secrets to function', () => {
    const originalOpenAi = process.env.OPENAI_API_KEY;
    const originalDbUrl = process.env.ZAVORTH_DATABASE_URL;

    try {
      delete process.env.OPENAI_API_KEY;
      delete process.env.ZAVORTH_DATABASE_URL;

      expect(() => {
        ServiceCompositionRoot.bootstrap();
      }).not.toThrow();

      expect(ServiceRegistry.has(ServiceTokens.SecurityAuditLogger)).toBe(true);
    } finally {
      process.env.OPENAI_API_KEY = originalOpenAi;
      process.env.ZAVORTH_DATABASE_URL = originalDbUrl;
    }
  });

  it('composition root bootstrap does not change approval or risk classification behavior', () => {
    ServiceCompositionRoot.bootstrap();

    expect(process.env.ZAVORTH_HEADLESS_MODE).toBeUndefined();
    expect(process.env.ZAVORTH_PERSONAL_BYPASS).toBeUndefined();
  });
});
