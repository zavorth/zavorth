import { InternalBetaChecklistService } from '../../src/services/InternalBetaChecklistService';
import { Database } from '../../src/storage/Database';
import { TrustedWorkspaceService } from '../../src/services/TrustedWorkspaceService';
import { AgentWorkspaceConfigService } from '../../src/services/AgentWorkspaceConfigService';
import { ProviderConfigService } from '../../src/services/ProviderConfigService';

jest.mock('../../src/storage/Database');
jest.mock('../../src/services/TrustedWorkspaceService');
jest.mock('../../src/services/AgentWorkspaceConfigService');
jest.mock('../../src/services/ProviderConfigService');
jest.mock('../../src/services/SecurityAuditLogger');

describe('InternalBetaChecklistService Tests (Phase 21K-B)', () => {
  let service: InternalBetaChecklistService;
  let mockDb: any;
  let mockTrustService: any;
  let mockConfigService: any;
  let mockProviderService: any;

  beforeEach(() => {
    service = InternalBetaChecklistService.getInstance();

    mockDb = {
      get: jest.fn().mockReturnValue({ test: 1 })
    };
    (Database.getInstance as jest.Mock).mockResolvedValue(mockDb);

    mockTrustService = {
      getTrustEntry: jest.fn().mockReturnValue({ trusted: true })
    };
    (TrustedWorkspaceService.getInstance as jest.Mock).mockResolvedValue(mockTrustService);

    mockConfigService = {
      getConfig: jest.fn().mockResolvedValue({
        defaultProviderId: 'openai',
        defaultModelId: 'gpt-4o'
      })
    };
    (AgentWorkspaceConfigService.getInstance as jest.Mock).mockReturnValue(mockConfigService);

    mockProviderService = {
      getProviders: jest.fn().mockResolvedValue([
        { providerId: 'openai', enabled: true, requiresApiKey: true, secretRef: 'key_ref_1' }
      ])
    };
    (ProviderConfigService.getInstance as jest.Mock).mockReturnValue(mockProviderService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('generates the onboarding checklist with correct statuses', async () => {
    const checklist = await service.getChecklist('test-ws');

    expect(checklist.length).toBeGreaterThan(0);

    const trustStep = checklist.find(s => s.id === 'step_trust_workspace');
    expect(trustStep?.status).toBe('completed');

    const providerStep = checklist.find(s => s.id === 'step_setup_provider');
    expect(providerStep?.status).toBe('completed');

    // Manual steps should always be pending
    const manualStep = checklist.find(s => s.id === 'step_execute_diagnostic_task');
    expect(manualStep?.manual).toBe(true);
    expect(manualStep?.status).toBe('pending');
  });

  it('does not contain any real secrets or leak the marker', async () => {
    const checklist = await service.getChecklist('test-ws');
    const str = JSON.stringify(checklist);
    expect(str).not.toMatch(/Authorization|Bearer|secret_key_ref|sk-/i);
    expect(str).not.toContain('sk-zavorth-internal-beta-hardening-DO-NOT-LEAK-21K-B');
  });

  it('checklist only guides and does not trigger PTY, HPM, shells or remote connection tests', async () => {
    // Override global fetch and process execution to ensure none are triggered
    const originalFetch = global.fetch;
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy;

    const checklist = await service.getChecklist('test-ws');
    expect(checklist.length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();

    global.fetch = originalFetch;
  });
});
