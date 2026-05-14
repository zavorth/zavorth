import { TrustDecisionService } from '../../src/services/TrustDecisionService.js';

describe('TrustDecisionService', () => {
  const runtimeProfileService = {
    getProfile: jest.fn(() => 'core'),
    isCore: jest.fn(() => true),
    supportsRecurringAutomation: jest.fn(() => false),
  };

  it('allows safe risk-reducing actions without permission requests', async () => {
    const permissionService = {
      createRequest: jest.fn(),
      findApprovedRequest: jest.fn(),
    };
    const service = new TrustDecisionService({
      runtimeProfileService: runtimeProfileService as any,
      permissionService: permissionService as any,
    });

    const decision = await service.evaluate({
      domain: 'trust',
      actionId: 'set-mcp-profile',
      payload: { profile: 'safe' },
    });

    expect(decision.decision).toBe('allowed');
    expect(permissionService.createRequest).not.toHaveBeenCalled();
  });

  it('blocks recurring automation activation in core profile', async () => {
    const service = new TrustDecisionService({
      runtimeProfileService: runtimeProfileService as any,
      permissionService: {
        createRequest: jest.fn(),
        findApprovedRequest: jest.fn(),
      } as any,
    });

    const decision = await service.evaluate({
      domain: 'automation',
      actionId: 'create',
      approvalRequired: true,
    });

    expect(decision.decision).toBe('blocked');
    expect(decision.reason).toContain('Perfil core');
  });

  it('creates canonical approval when dormant Watch Mode is requested', async () => {
    const permissionService = {
      findApprovedRequest: jest.fn(async () => undefined),
      createRequest: jest.fn(async () => ({
        permission_id: 'perm-watch-1',
        status: 'pending',
        scope: 'once',
      })),
    };
    const capabilityLifecycleService = {
      shouldBootCapability: jest.fn(() => false),
      describeCapability: jest.fn(),
      registerCapabilityDemand: jest.fn(),
    };
    const service = new TrustDecisionService({
      runtimeProfileService: {
        ...runtimeProfileService,
        getProfile: jest.fn(() => 'ops'),
        isCore: jest.fn(() => false),
        supportsRecurringAutomation: jest.fn(() => true),
      } as any,
      capabilityLifecycleService: capabilityLifecycleService as any,
      permissionService: permissionService as any,
    });

    const decision = await service.evaluate({
      domain: 'watch',
      actionId: 'start',
      planId: 'plan-watch-1',
      capabilityId: 'watch-mode',
      requestedBy: 'tester',
    });

    expect(decision.decision).toBe('requires_approval');
    expect(decision.permission?.permission_id).toBe('perm-watch-1');
    expect(capabilityLifecycleService.registerCapabilityDemand).toHaveBeenCalledWith(
      'watch-mode',
      'tester',
      expect.any(String),
    );
  });

  it('routes Natural Setup through Capability Lifecycle before activating dormant channels', async () => {
    const permissionService = {
      findApprovedRequest: jest.fn(async () => undefined),
      createRequest: jest.fn(async () => ({
        permission_id: 'perm-setup-1',
        status: 'pending',
        scope: 'once',
      })),
    };
    const capabilityLifecycleService = {
      shouldBootCapability: jest.fn(() => false),
      describeCapability: jest.fn(),
      registerCapabilityDemand: jest.fn(),
    };
    const service = new TrustDecisionService({
      runtimeProfileService: {
        ...runtimeProfileService,
        getProfile: jest.fn(() => 'core'),
        isCore: jest.fn(() => true),
      } as any,
      capabilityLifecycleService: capabilityLifecycleService as any,
      permissionService: permissionService as any,
    });

    const decision = await service.evaluate({
      domain: 'setup',
      actionId: 'natural-setup',
      planId: 'setup-plan-1',
      capabilityId: 'slack',
      requestedBy: 'tester',
      approvalRequired: true,
    });

    expect(decision.decision).toBe('requires_approval');
    expect(decision.permission?.permission_id).toBe('perm-setup-1');
    expect(capabilityLifecycleService.registerCapabilityDemand).toHaveBeenCalledWith(
      'slack',
      'tester',
      expect.any(String),
    );
  });
});
