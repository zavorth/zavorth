import { InternalBetaDiagnosticsService } from '../../src/services/InternalBetaDiagnosticsService';
import { Database } from '../../src/storage/Database';
import { SecurityAuditLogger } from '../../src/services/SecurityAuditLogger';
import { TrustedWorkspaceService } from '../../src/services/TrustedWorkspaceService';
import { AgentWorkspaceConfigService } from '../../src/services/AgentWorkspaceConfigService';
import { WorkspaceRuntimeReadinessService } from '../../src/services/WorkspaceRuntimeReadinessService';
import { ProviderConfigService } from '../../src/services/ProviderConfigService';

jest.mock('../../src/storage/Database');
jest.mock('../../src/services/SecurityAuditLogger');
jest.mock('../../src/services/TrustedWorkspaceService');
jest.mock('../../src/services/AgentWorkspaceConfigService');
jest.mock('../../src/services/WorkspaceRuntimeReadinessService');
jest.mock('../../src/services/ProviderConfigService');

describe('InternalBetaDiagnosticsService Tests', () => {
  let service: InternalBetaDiagnosticsService;
  let mockDb: any;
  let mockAuditLogger: any;
  let mockTrustService: any;
  let mockConfigService: any;
  let mockReadinessService: any;
  let mockProviderService: any;

  beforeEach(() => {
    service = InternalBetaDiagnosticsService.getInstance();

    mockDb = {
      get: jest.fn().mockReturnValue({ test: 1 }),
      run: jest.fn()
    };
    (Database.getInstance as jest.Mock).mockResolvedValue(mockDb);

    mockAuditLogger = {
      logWorkspaceEvent: jest.fn().mockResolvedValue(true)
    };
    (SecurityAuditLogger as jest.Mock).mockImplementation(() => mockAuditLogger);

    mockTrustService = {
      getTrustEntry: jest.fn().mockReturnValue({ trusted: true })
    };
    (TrustedWorkspaceService.getInstance as jest.Mock).mockResolvedValue(mockTrustService);

    mockConfigService = {
      getConfig: jest.fn().mockResolvedValue({
        allowDeveloperMode: false,
        allowHostPowerMode: false,
        allowPty: false,
        allowTaskMandates: true,
        allowTemporaryDirectoryTrust: false,
        allowProviderFallback: false,
        defaultProviderId: 'openai',
        defaultModelId: 'gpt-4o'
      })
    };
    (AgentWorkspaceConfigService.getInstance as jest.Mock).mockReturnValue(mockConfigService);

    mockReadinessService = {
      checkReadiness: jest.fn().mockResolvedValue({
        ready: true,
        issues: []
      })
    };
    (WorkspaceRuntimeReadinessService.getInstance as jest.Mock).mockReturnValue(mockReadinessService);

    mockProviderService = {
      getProvider: jest.fn().mockResolvedValue({
        providerId: 'openai',
        enabled: true,
        requiresApiKey: true,
        secretRef: 'secret_key_ref'
      })
    };
    (ProviderConfigService.getInstance as jest.Mock).mockReturnValue(mockProviderService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('generates pass diagnostics for healthy configuration without secrets', async () => {
    const report = await service.runDiagnostics('test-ws');

    expect(report.readyForInternalBeta).toBe(true);
    expect(report.checks.length).toBeGreaterThan(0);

    // Check specific checks
    const dbCheck = report.checks.find(c => c.id === 'database_reachable');
    expect(dbCheck?.status).toBe('pass');

    const trustCheck = report.checks.find(c => c.id === 'workspace_trusted');
    expect(trustCheck?.status).toBe('pass');

    const providerCheck = report.checks.find(c => c.id === 'provider_configured');
    expect(providerCheck?.status).toBe('pass');

    // Ensure no secrets leaked in stringified report
    const str = JSON.stringify(report);
    expect(str).not.toMatch(/secret_key_ref|API key|Authorization|Bearer/i);
    expect(str).not.toContain('sk-zavorth-internal-beta-hardening-DO-NOT-LEAK-21K-B');
  });

  it('detects missing provider configuration and reports fail', async () => {
    mockConfigService.getConfig.mockResolvedValue({
      allowDeveloperMode: false,
      allowHostPowerMode: false,
      allowPty: false,
      allowTaskMandates: true,
      allowTemporaryDirectoryTrust: false,
      allowProviderFallback: false,
      defaultProviderId: '',
      defaultModelId: ''
    });

    const report = await service.runDiagnostics('test-ws');
    expect(report.readyForInternalBeta).toBe(false);

    const providerCheck = report.checks.find(c => c.id === 'provider_default_selected');
    expect(providerCheck?.status).toBe('fail');
  });

  it('safely handles database unreachable and applies safe defaults', async () => {
    (Database.getInstance as jest.Mock).mockRejectedValueOnce(new Error('Connection lost'));

    const report = await service.runDiagnostics('test-ws');
    expect(report.readyForInternalBeta).toBe(false);

    const dbCheck = report.checks.find(c => c.id === 'database_reachable');
    expect(dbCheck?.status).toBe('fail');

    // Trust check should fail since db is unreachable
    const trustCheck = report.checks.find(c => c.id === 'workspace_trusted');
    expect(trustCheck?.status).toBe('fail');
  });

  it('does not leak sk-zavorth-internal-beta-hardening-DO-NOT-LEAK-21K-B if present in environment or mocks', async () => {
    mockConfigService.getConfig.mockResolvedValue({
      allowDeveloperMode: false,
      allowHostPowerMode: false,
      allowPty: false,
      allowTaskMandates: true,
      allowTemporaryDirectoryTrust: false,
      allowProviderFallback: false,
      defaultProviderId: 'sk-zavorth-internal-beta-hardening-DO-NOT-LEAK-21K-B',
      defaultModelId: 'gpt-4o'
    });

    const report = await service.runDiagnostics('test-ws');
    const str = JSON.stringify(report);
    expect(str).not.toContain('sk-zavorth-internal-beta-hardening-DO-NOT-LEAK-21K-B');
  });

  it('does not send remote external network calls or telemetry', async () => {
    // Assert fetch was not called or global.fetch was not invoked
    const originalFetch = global.fetch;
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy;

    await service.runDiagnostics('test-ws');

    expect(fetchSpy).not.toHaveBeenCalled();
    global.fetch = originalFetch;
  });
});
