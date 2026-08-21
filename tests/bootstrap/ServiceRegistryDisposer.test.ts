import { ServiceRegistry } from '../../src/bootstrap/ServiceRegistry.js';
import { ServiceTokens } from '../../src/bootstrap/ServiceTokens.js';
import { SecurityAuditLogger } from '../../src/services/SecurityAuditLogger.js';
import { ToolHookPipelineService } from '../../src/services/ToolHookPipelineService.js';
import { TelemetryRuntimeService } from '../../src/observability/telemetry/TelemetryRuntimeService.js';
import { logger } from '../../src/logger.js';

describe('ServiceRegistry disposable registrations', () => {
  beforeEach(() => {
    ServiceRegistry.resetForTests();
  });

  afterEach(() => {
    ServiceRegistry.resetForTests();
  });

  it('registers a resolvable instance and returns a working disposer', () => {
    const pipeline = new ToolHookPipelineService();
    const disposer = ServiceRegistry.registerDisposable(ServiceTokens.ToolHookPipelineService, pipeline);

    expect(ServiceRegistry.has(ServiceTokens.ToolHookPipelineService)).toBe(true);
    expect(ServiceRegistry.get(ServiceTokens.ToolHookPipelineService)).toBe(pipeline);

    disposer();

    expect(ServiceRegistry.has(ServiceTokens.ToolHookPipelineService)).toBe(false);
    expect(() => ServiceRegistry.get(ServiceTokens.ToolHookPipelineService)).toThrow('Service not found');
  });

  it('runs the custom cleanup exactly once and stays idempotent across repeated calls', () => {
    const telemetry = new TelemetryRuntimeService();
    const cleanup = jest.fn();
    const disposer = ServiceRegistry.registerDisposable(ServiceTokens.TelemetryRuntimeService, telemetry, cleanup);

    disposer();
    disposer();
    disposer();

    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(ServiceRegistry.has(ServiceTokens.TelemetryRuntimeService)).toBe(false);
  });

  it('fails loud on duplicate disposable registration', () => {
    ServiceRegistry.registerDisposable(ServiceTokens.SecurityAuditLogger, new SecurityAuditLogger());

    expect(() => {
      ServiceRegistry.registerDisposable(ServiceTokens.SecurityAuditLogger, new SecurityAuditLogger());
    }).toThrow('Duplicate service registration');
  });

  it('rejects forged tokens on disposable registration', () => {
    const forgedToken = {
      id: Symbol.for('zavorth.FakeDisposalService'),
      description: 'FakeDisposalService',
    } as never;

    expect(() => {
      ServiceRegistry.registerDisposable(forgedToken, {});
    }).toThrow('Rejected: Attempted to use an unknown or forged service token.');
  });

  it('disposeAll unwinds services in reverse registration order', () => {
    const teardownOrder: string[] = [];
    ServiceRegistry.registerDisposable(ServiceTokens.TelemetryRuntimeService, new TelemetryRuntimeService(), () => {
      teardownOrder.push('telemetry');
    });
    ServiceRegistry.registerDisposable(ServiceTokens.ToolHookPipelineService, new ToolHookPipelineService(), () => {
      teardownOrder.push('hook-pipeline');
    });
    ServiceRegistry.registerDisposable(ServiceTokens.SecurityAuditLogger, new SecurityAuditLogger(), () => {
      teardownOrder.push('audit-logger');
    });

    ServiceRegistry.disposeAll();

    expect(teardownOrder).toEqual(['audit-logger', 'hook-pipeline', 'telemetry']);
    expect(ServiceRegistry.has(ServiceTokens.TelemetryRuntimeService)).toBe(false);
    expect(ServiceRegistry.has(ServiceTokens.ToolHookPipelineService)).toBe(false);
    expect(ServiceRegistry.has(ServiceTokens.SecurityAuditLogger)).toBe(false);
  });

  it('disposeAll keeps unwinding remaining services when one disposer throws', () => {
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
    const survivorCleanup = jest.fn();
    try {
      ServiceRegistry.registerDisposable(ServiceTokens.TelemetryRuntimeService, new TelemetryRuntimeService());
      ServiceRegistry.registerDisposable(
        ServiceTokens.ToolHookPipelineService,
        new ToolHookPipelineService(),
        () => {
          throw new Error('simulated hook pipeline teardown failure');
        },
      );
      ServiceRegistry.registerDisposable(
        ServiceTokens.SecurityAuditLogger,
        new SecurityAuditLogger(),
        survivorCleanup,
      );

      expect(() => ServiceRegistry.disposeAll()).not.toThrow();

      expect(survivorCleanup).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('ToolHookPipelineService'));
      expect(ServiceRegistry.has(ServiceTokens.TelemetryRuntimeService)).toBe(false);
      expect(ServiceRegistry.has(ServiceTokens.SecurityAuditLogger)).toBe(false);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('resetForTests unwinds disposable registrations before clearing the registry', () => {
    const cleanup = jest.fn();
    ServiceRegistry.registerDisposable(ServiceTokens.SecurityAuditLogger, new SecurityAuditLogger(), cleanup);

    ServiceRegistry.resetForTests();

    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(ServiceRegistry.has(ServiceTokens.SecurityAuditLogger)).toBe(false);
  });
});
