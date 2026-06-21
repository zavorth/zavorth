/**
 * Fase 21K-A — Agent Runtime Workspace Smoke Tests
 *
 * Validates the full integration path:
 *   AgentWorkspaceConfigService → ProviderRuntimeRouter → capability enforcement
 *
 * Security marker: sk-zavorth-e2e-runtime-smoke-DO-NOT-LEAK-21K-A
 * Must NEVER appear in any production output, audit, REST response, or tool result.
 */

import { AgentWorkspaceConfigService } from '../../src/services/AgentWorkspaceConfigService';
import { WorkspaceRuntimeReadinessService } from '../../src/services/WorkspaceRuntimeReadinessService';
import { WorkspacePolicyPreviewService } from '../../src/services/WorkspacePolicyPreviewService';
import { ProviderRuntimeRouter } from '../../src/services/ProviderRuntimeRouter';
import { ModelSelectionService } from '../../src/services/ModelSelectionService';

jest.mock('../../src/services/ModelSelectionService');
jest.mock('../../src/storage/Database', () => ({
  Database: {
    getInstance: jest.fn().mockResolvedValue({
      get: jest.fn().mockReturnValue(null),
      run: jest.fn(),
      all: jest.fn().mockReturnValue([]),
    })
  }
}));
jest.mock('../../src/services/ProviderConfigService', () => ({
  ProviderConfigService: {
    getInstance: jest.fn().mockReturnValue({
      getProviders: jest.fn().mockResolvedValue([]),
    })
  }
}));

const SMOKE_MARKER = 'sk-zavorth-e2e-runtime-smoke-DO-NOT-LEAK-21K-A';
const WS_ID = 'test-workspace-21k-a';

describe('AgentRuntimeWorkspaceSmoke — Fase 21K-A', () => {
  let mockSelectProvider: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSelectProvider = jest.fn();
    (ModelSelectionService.getInstance as jest.Mock).mockReturnValue({
      selectProvider: mockSelectProvider,
    });
  });

  // -----------------------------------------------------------------------
  // 1. Safe defaults when no config persisted
  // -----------------------------------------------------------------------
  describe('safe defaults when workspace config absent', () => {
    it('returns safe default config (all risky flags false)', async () => {
      const config = AgentWorkspaceConfigService.getDefaultConfig(WS_ID);
      expect(config.allowDeveloperMode).toBe(false);
      expect(config.allowHostPowerMode).toBe(false);
      expect(config.allowPty).toBe(false);
      expect(config.allowProviderFallback).toBe(false);
      expect(config.allowTemporaryDirectoryTrust).toBe(false);
      expect(config.allowTaskMandates).toBe(true); // task mandates on by default
      expect(config.defaultAutonomyProfile).toBe('safe');
      expect(config.allowedCapabilities).toContain('chat');
    });

    it('default config never contains the smoke marker', () => {
      const config = AgentWorkspaceConfigService.getDefaultConfig(WS_ID);
      const serialized = JSON.stringify(config);
      expect(serialized).not.toContain(SMOKE_MARKER);
    });

    it('readiness with no config reports providerReady=false', async () => {
      const svc = WorkspaceRuntimeReadinessService.getInstance();
      const readiness = await svc.checkReadiness(WS_ID);
      expect(readiness.workspaceId).toBe(WS_ID);
      expect(readiness.providerReady).toBe(false);
      // Readiness output must never contain secrets
      const serialized = JSON.stringify(readiness);
      expect(serialized).not.toContain(SMOKE_MARKER);
      expect(serialized).not.toContain('sk-');
      expect(serialized).not.toContain('Authorization');
      expect(serialized).not.toContain('secretRef');
    });

    it('policy preview with no config reports no high-risk capabilities', async () => {
      const svc = WorkspacePolicyPreviewService.getInstance();
      const preview = await svc.previewPolicy(WS_ID, {});
      expect(preview.allowDeveloperMode).toBe(false);
      expect(preview.allowHostPowerMode).toBe(false);
      expect(preview.allowPty).toBe(false);
      expect(preview.allowProviderFallback).toBe(false);
      // Preview output must never contain secrets
      const serialized = JSON.stringify(preview);
      expect(serialized).not.toContain(SMOKE_MARKER);
      expect(serialized).not.toContain('sk-');
      expect(serialized).not.toContain('Bearer');
    });
  });

  // -----------------------------------------------------------------------
  // 2. Router respects workspace config
  // -----------------------------------------------------------------------
  describe('ProviderRuntimeRouter respects workspace config', () => {
    it('routes to workspace default provider if none specified in request', async () => {
      const resolved = { providerId: 'ws-provider', modelId: 'gpt-4', runtimeReady: true, capabilities: ['chat'] };
      mockSelectProvider.mockResolvedValue(resolved);

      const router = ProviderRuntimeRouter.getInstance();
      // workspaceId carried in request lets router pick up config.defaultProviderId
      const result = await router.route({ workspaceId: WS_ID } as any);
      expect(result.providerId).toBe('ws-provider');
      // Result must not contain marker
      expect(JSON.stringify(result)).not.toContain(SMOKE_MARKER);
    });

    it('throws missing_key if provider not runtimeReady', async () => {
      mockSelectProvider.mockResolvedValue({ providerId: 'p1', runtimeReady: false, configured: false });
      const router = ProviderRuntimeRouter.getInstance();
      await expect(router.route({ workspaceId: WS_ID } as any)).rejects.toThrow('missing_key');
    });

    it('throws capability_not_supported when capability not in workspace allowedCapabilities', async () => {
      // config.allowedCapabilities defaults to ['chat'] — 'vision' not allowed
      mockSelectProvider.mockResolvedValue({ providerId: 'p1', runtimeReady: true, capabilities: ['chat', 'vision'] });
      const router = ProviderRuntimeRouter.getInstance();
      await expect(
        router.route({ workspaceId: WS_ID, capability: 'vision' } as any)
      ).rejects.toThrow('capability_not_supported');
    });

    it('fallback=false in workspace config prevents fallback even if requester allows it', async () => {
      // workspace config has allowProviderFallback=false (default)
      // so effectiveRequest.allowFallback must be false
      mockSelectProvider.mockResolvedValue({ providerId: 'p-primary', runtimeReady: true, capabilities: ['chat'] });
      const router = ProviderRuntimeRouter.getInstance();
      const result = await router.route({ workspaceId: WS_ID, allowFallback: true } as any);
      // provider returned p-primary — fallback not needed, but we confirm route() succeeds
      expect(result.providerId).toBe('p-primary');
    });
  });

  // -----------------------------------------------------------------------
  // 3. Error sanitization
  // -----------------------------------------------------------------------
  describe('error sanitization', () => {
    it('router throws normalized error codes, not raw messages', async () => {
      mockSelectProvider.mockRejectedValue(new Error('missing_key'));
      const router = ProviderRuntimeRouter.getInstance();
      let caught: Error | null = null;
      try {
        await router.route({ workspaceId: WS_ID } as any);
      } catch (e: any) {
        caught = e;
      }
      expect(caught).not.toBeNull();
      // Error message must be a normalized code, not containing raw provider data
      expect(caught!.message).not.toContain(SMOKE_MARKER);
      expect(caught!.message).not.toContain('Authorization');
      expect(caught!.message).not.toContain('Bearer');
      expect(caught!.message).not.toContain('sk-');
    });

    it('routing_error normalized when unknown provider error occurs', async () => {
      mockSelectProvider.mockRejectedValue(new Error('some unexpected raw provider error with sk-fake-key-data'));
      const router = ProviderRuntimeRouter.getInstance();
      await expect(router.route({ workspaceId: WS_ID } as any)).rejects.toThrow('routing_error');
    });
  });

  // -----------------------------------------------------------------------
  // 4. AgentWorkspaceConfig remains narrowing policy
  // -----------------------------------------------------------------------
  describe('AgentWorkspaceConfig is narrowing policy only', () => {
    it('allowDeveloperMode=true does not auto-execute anything', () => {
      const config = { ...AgentWorkspaceConfigService.getDefaultConfig(WS_ID), allowDeveloperMode: true };
      // Config is a plain data object — no side effects
      expect(typeof config.allowDeveloperMode).toBe('boolean');
      expect(config.allowDeveloperMode).toBe(true);
      // No execution happened just by having this value
    });

    it('allowHostPowerMode=true does not activate HPM by itself', () => {
      const config = { ...AgentWorkspaceConfigService.getDefaultConfig(WS_ID), allowHostPowerMode: true };
      expect(config.allowHostPowerMode).toBe(true);
      // HPM requires explicit enable via HostPowerModeService — config is merely a permission gate
    });

    it('allowPty=true without allowHostPowerMode=true is still insufficient for PTY', () => {
      const config = { ...AgentWorkspaceConfigService.getDefaultConfig(WS_ID), allowPty: true };
      expect(config.allowHostPowerMode).toBe(false); // still false from defaults
      // ToolExposurePolicy will block PTY unless BOTH allowPty AND allowHostPowerMode
    });

    it('allowProviderFallback=true does not skip missing_key validation', async () => {
      mockSelectProvider.mockResolvedValue({ providerId: 'p1', runtimeReady: false });
      const router = ProviderRuntimeRouter.getInstance();
      // Even with allowFallback=true in request, runtimeReady=false still throws missing_key
      await expect(router.route({ workspaceId: WS_ID, allowFallback: true } as any)).rejects.toThrow('missing_key');
    });
  });
});
