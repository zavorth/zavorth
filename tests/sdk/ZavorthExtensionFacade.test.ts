import { ZavorthExtensionFacade } from '../../src/sdk/ZavorthExtensionFacade.js';
import { ServiceRegistry } from '../../src/bootstrap/ServiceRegistry.js';
import { ServiceTokens } from '../../src/bootstrap/ServiceTokens.js';
import type { CustomToolDescriptor } from '../../src/sdk/CustomToolDescriptor.js';

describe('ZavorthExtensionFacade Tests', () => {
  let mockAuditLogger: any;

  beforeEach(() => {
    // Reset service registry and facade state
    ServiceRegistry.resetForTests();
    ZavorthExtensionFacade.resetForTests();

    // Create a mock audit logger and register it
    mockAuditLogger = {
      logMcpRuntimeEvent: jest.fn(),
    };
    ServiceRegistry.register(ServiceTokens.SecurityAuditLogger, mockAuditLogger);
  });

  afterEach(() => {
    ServiceRegistry.resetForTests();
    ZavorthExtensionFacade.resetForTests();
  });

  const validDescriptor: CustomToolDescriptor = {
    namespace: 'personal',
    name: 'notes',
    description: 'Manage personal notes.',
    inputSchema: { type: 'object', properties: {} },
    capabilities: ['filesystem'],
    riskClass: 'safe',
    handler: jest.fn(),
  };

  it('registra descriptor valido como pending/unapproved e retorna qualifiedName e fingerprint', () => {
    const result = ZavorthExtensionFacade.registerCustomTool(validDescriptor);

    expect(result.namespace).toBe('personal');
    expect(result.name).toBe('notes');
    expect(result.qualifiedName).toBe('personal:notes');
    expect(result.status).toBe('registered_unapproved'); // 'safe' risk maps to registered_unapproved
    expect(result.fingerprint.length).toBe(64);

    // Assert handler was NOT executed during registration
    expect(validDescriptor.handler).not.toHaveBeenCalled();

    // Verify correct safe audit log was emitted
    expect(mockAuditLogger.logMcpRuntimeEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'mcp_tool_registered',
        serverId: 'personal',
        toolName: 'notes',
        namespacedToolId: 'personal:notes',
        effectiveAllowed: true,
      }),
    );
  });

  it('registra medium/high/unknown risk como pending_approval', () => {
    const mediumDescriptor = {
      ...validDescriptor,
      name: 'notes_medium',
      riskClass: 'medium' as const,
    };
    const result = ZavorthExtensionFacade.registerCustomTool(mediumDescriptor);
    expect(result.status).toBe('pending_approval');
  });

  it('rejects duplicate namespace/name collision com a mesma assinatura', () => {
    ZavorthExtensionFacade.registerCustomTool(validDescriptor);

    expect(() => {
      ZavorthExtensionFacade.registerCustomTool(validDescriptor);
    }).toThrow('Duplicate tool collision');
  });

  it('detecta drift de descriptor (mesmo qualifiedName com fingerprint diferente)', () => {
    ZavorthExtensionFacade.registerCustomTool(validDescriptor);

    const driftedDescriptor = {
      ...validDescriptor,
      inputSchema: { type: 'object', properties: { newValue: { type: 'string' } } },
    };

    const result = ZavorthExtensionFacade.registerCustomTool(driftedDescriptor);

    expect(result.status).toBe('drift_detected');
    expect(mockAuditLogger.logMcpRuntimeEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'mcp_schema_drift_detected',
        serverId: 'personal',
        toolName: 'notes',
        namespacedToolId: 'personal:notes',
      }),
    );
  });

  it('failure claramente se o audit logger required estiver unavailable', () => {
    // Unregister logger
    ServiceRegistry.resetForTests();

    expect(() => {
      ZavorthExtensionFacade.registerCustomTool(validDescriptor);
    }).toThrow('Audit logger is unavailable in the service container. Tool registration is blocked.');
  });

  it('protects resetForTests from execution outside test environment', () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      expect(() => {
        ZavorthExtensionFacade.resetForTests();
      }).toThrow('resetForTests is only allowed in test environment');
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});
