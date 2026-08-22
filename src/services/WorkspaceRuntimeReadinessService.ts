import { AgentWorkspaceConfigService } from './AgentWorkspaceConfigService.js';
import { ProviderConfigService } from './ProviderConfigService.js';
import { ProviderModelRegistry, type ProviderCapability } from './ProviderModelRegistry.js';

export interface WorkspaceRuntimeReadinessIssue {
  code: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
}

export interface WorkspaceRuntimeReadiness {
  workspaceId: string;
  ready: boolean;
  providerReady: boolean;
  modelReady: boolean;
  autonomyReady: boolean;
  policyReady: boolean;
  issues: WorkspaceRuntimeReadinessIssue[];
}

export class WorkspaceRuntimeReadinessService {
  private static instance: WorkspaceRuntimeReadinessService;

  private constructor() {}

  public static getInstance(): WorkspaceRuntimeReadinessService {
    if (!WorkspaceRuntimeReadinessService.instance) {
      WorkspaceRuntimeReadinessService.instance = new WorkspaceRuntimeReadinessService();
    }
    return WorkspaceRuntimeReadinessService.instance;
  }

  public async checkReadiness(workspaceId: string): Promise<WorkspaceRuntimeReadiness> {
    const configService = AgentWorkspaceConfigService.getInstance();
    const providerService = ProviderConfigService.getInstance();

    const config = await configService.getConfig(workspaceId);

    const issues: WorkspaceRuntimeReadinessIssue[] = [];
    let providerReady = false;
    let modelReady = false;

    // Evaluate Default Provider
    if (!config.defaultProviderId) {
      issues.push({
        code: 'missing_default_provider',
        severity: 'error',
        message: 'No default provider configured for this workspace.'
      });
    } else {
      const providerInfo = await providerService.getProvider(config.defaultProviderId);
      if (!providerInfo) {
        issues.push({
          code: 'provider_not_found',
          severity: 'error',
          message: 'The selected default provider was not found.'
        });
      } else if (!providerInfo.enabled) {
        issues.push({
          code: 'provider_disabled',
          severity: 'error',
          message: 'The selected default provider is disabled.'
        });
      } else if (providerInfo.requiresApiKey && !providerInfo.secretRef) {
        issues.push({
          code: 'provider_missing_key',
          severity: 'error',
          message: 'The selected default provider is missing an API key.'
        });
      } else {
        providerReady = true;
      }
    }

    // Evaluate Default Model
    if (!config.defaultModelId) {
      issues.push({
        code: 'missing_default_model',
        severity: 'warning',
        message: 'No default model configured; runtime may fall back or fail.'
      });
    } else if (providerReady && config.defaultProviderId) {
      const providerInfo = await providerService.getProvider(config.defaultProviderId);
      if (providerInfo) {
        modelReady = true;
        // Verify capabilities
        const capabilities = ProviderModelRegistry.getCapabilities(providerInfo.type, config.defaultModelId);
        if (config.allowedCapabilities.length > 0) {
          const unsupported = config.allowedCapabilities.filter(c => !ProviderModelRegistry.hasCapability(capabilities, c as ProviderCapability));
          if (unsupported.length > 0) {
            issues.push({
              code: 'capability_not_supported',
              severity: 'warning',
              message: `Model does not support required capabilities: ${unsupported.join(', ')}`
            });
          }
        }
      }
    }

    // Evaluate Policies
    let policyReady = true;
    if (config.allowPty && !config.allowHostPowerMode) {
      issues.push({
        code: 'pty_requires_host_power_mode',
        severity: 'error',
        message: 'PTY cannot be enabled unless Host Power Mode is also enabled.'
      });
      policyReady = false;
    }

    if (config.allowDeveloperMode) {
      issues.push({
        code: 'developer_mode_not_allowed', // Actually just a warning for preview, let's keep it informative
        severity: 'info',
        message: 'Developer mode is enabled. Ensure this workspace is trusted.'
      });
    }

    if (!config.allowProviderFallback) {
      issues.push({
        code: 'fallback_disabled',
        severity: 'info',
        message: 'Provider fallback is disabled.'
      });
    }

    // Note: Autonomy ready could be hooked into RiskClassifier or safe profiles
    const autonomyReady = true;

    return {
      workspaceId,
      ready: providerReady && modelReady && policyReady,
      providerReady,
      modelReady,
      autonomyReady,
      policyReady,
      issues
    };
  }
}
